import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDirectPlacements,
  directPlacementsEnabled,
  normalizePlacements,
  readDirectPlacements,
} from "../lib/direct-placements";
import { buildCertificateCandidates } from "../lib/certificate-eligibility";
import { calculateMedalAwards } from "../lib/medal-calculation";
import { schoolMedalDetails } from "../lib/school-medal-details";
import type { Snapshot } from "../lib/hosted";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";
const D = "00000000-0000-4000-8000-00000000000d";

const placements = (over: Record<string, unknown> = {}) => ({
  directPlacements: {
    enabled: true,
    revision: 1,
    first: [B],
    second: [A],
    third: [C, D],
    ...over,
  },
});
const competition = (policy: unknown, sport = "ฟุตบอล") => ({
  id: "c",
  sport,
  age_group: "ป",
  gender: "ชาย",
  registration_policy: policy,
});

test("normalize accepts 1/1/many and rejects duplicates, overflow and unknown schools", () => {
  assert.deepEqual(
    normalizePlacements({ first: [A], second: [B], third: [C, D] }),
    { first: [A], second: [B], third: [C, D] },
  );
  assert.throws(() =>
    normalizePlacements({ first: [A, B], second: [], third: [] }),
  );
  assert.throws(() =>
    normalizePlacements({ first: [A], second: [A], third: [] }),
  );
  assert.throws(() =>
    normalizePlacements({ first: [], second: [], third: [A, B, C, D, "x"] }),
  );
  assert.throws(() =>
    normalizePlacements({ first: [A], second: [], third: [] }, new Set([B])),
  );
});

test("malformed stored placements are ignored instead of trusted", () => {
  assert.equal(readDirectPlacements({}), null);
  assert.equal(
    readDirectPlacements({ directPlacements: { enabled: true } }),
    null,
  );
  assert.equal(
    directPlacementsEnabled(
      competition(placements({ first: [A], second: [A] })),
    ),
    false,
  );
});

test("direct mode replaces calculated medals once and leaves other competitions alone", () => {
  const calculated = [
    {
      id: "x",
      event: "e",
      division: "ป",
      gender: "ชาย",
      school_id: A,
      medal: "gold",
      competition_id: "c",
    },
    {
      id: "y",
      event: "e2",
      division: "ป",
      gender: "ชาย",
      school_id: A,
      medal: "gold",
      competition_id: "other",
    },
  ];
  const result = applyDirectPlacements(calculated, [
    competition(placements()),
    { ...competition(null), id: "other" },
  ]);
  assert.deepEqual(
    result.map((a) => [a.competition_id, a.school_id, a.medal]).sort(),
    [
      ["c", A, "silver"],
      ["c", B, "gold"],
      ["c", C, "bronze"],
      ["c", D, "bronze"],
      ["other", A, "gold"],
    ].sort(),
  );
  const details = schoolMedalDetails(result, A);
  assert.equal(details.totals.total, 2);
  assert.equal(details.totals.gold, 1);
});

test("disabled mode keeps stored ranks but changes nothing, and athletics is never direct", () => {
  const off = competition(placements({ enabled: false }));
  assert.equal(applyDirectPlacements([], [off]).length, 0);
  assert.equal(
    directPlacementsEnabled(competition(placements(), "กรีฑา")),
    false,
  );
});

test("enabled with empty ranks awards nothing rather than falling back to scores", () => {
  const result = applyDirectPlacements(
    [
      {
        id: "x",
        event: "e",
        division: "ป",
        gender: "ชาย",
        school_id: A,
        medal: "gold",
        competition_id: "c",
      },
    ],
    [competition(placements({ first: [], second: [], third: [] }))],
  );
  assert.deepEqual(result, []);
});

function snapshot(policy: unknown, withMatch: boolean): Snapshot {
  return {
    rows: {
      schools: [],
      competitions: [
        {
          ...competition(policy),
          name: "ฟุตบอล",
          win_points: 3,
          draw_points: 1,
          loss_points: 0,
        },
      ],
      registrations: [],
      matches: [],
      athletics_events: [],
      athletics_results: [],
      medals: [],
    } as unknown as Snapshot["rows"],
    state: {
      schools: [
        { id: A, name: "A" },
        { id: B, name: "B" },
        { id: C, name: "C" },
        { id: D, name: "D" },
      ],
      athletes: [A, B, C, D].map((school_id, i) => ({
        id: `p${i}`,
        name: `p${i}`,
        school_id,
        sport: "ฟุตบอล",
        division: "ป",
        gender: "ชาย",
        competition_id: "c",
      })),
      // Bracket says A won; direct placements say B won.
      matches: withMatch
        ? [
            {
              id: "m",
              sport: "ฟุตบอล",
              division: "ป",
              gender: "ชาย",
              competition_id: "c",
              pool: "รอบชิงชนะเลิศ",
              home: A,
              away: B,
              starts_at: "",
              venue: "",
              status: "finished",
              home_score: 2,
              away_score: 1,
            },
          ]
        : [],
      races: [],
      awards: [],
    },
  } as unknown as Snapshot;
}

test("certificates follow direct ranks even with no bracket, while scores stay untouched", () => {
  const snap = snapshot(placements(), true);
  const before = JSON.stringify(snap.state.matches);
  const { candidates, blocked } = buildCertificateCandidates(snap, []);
  assert.deepEqual(blocked, []);
  const byId = Object.fromEntries(
    candidates.map((c) => [c.recipientId, c.award]),
  );
  assert.deepEqual(byId, {
    p0: "silver",
    p1: "gold",
    p2: "bronze",
    p3: "bronze",
  });
  assert.equal(JSON.stringify(snap.state.matches), before);
  assert.equal(
    calculateMedalAwards({
      matches: snap.state.matches,
      races: [],
      athletes: [],
    }).find((a) => a.medal === "gold")?.school_id,
    A,
  );
  const empty = buildCertificateCandidates(snapshot(placements(), false), []);
  assert.equal(empty.candidates.length, 4);
});

test("certificates are blocked until ranks 1 and 2 are recorded in direct mode", () => {
  const result = buildCertificateCandidates(
    snapshot(placements({ first: [], second: [], third: [] }), true),
    [],
  );
  assert.equal(result.candidates.length, 0);
  assert.equal(result.blocked.length, 1);
});
