import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SCHOOLS,
  INITIAL_ATHLETICS_DATA,
  addLaneToEventRound,
  assignUniqueRankInLanes,
  calculateSchoolAthleticsStandings,
  computeFinalsWinners,
  defaultLanes,
  removeLaneFromEventRound,
  syncQualifiersToFinals,
} from "../components/athletics-scoresheet";
import {
  athleticsScoresheetAwards,
  matchAthleticsRowToCompetition,
  matchSchoolByName,
  mergeAthleticsScoresheetAwards,
  readAthleticsScoresheet,
  validateAthleticsScoresheetRows,
  writeAthleticsScoresheet,
} from "../lib/athletics-scoresheet-store";
import {
  GET as scoresheetGet,
  PUT as scoresheetPut,
} from "../app/api/athletics-scoresheet/route";
import { buildLatestProgram } from "../lib/latest-program";
import { IMAGE_PROGRAM } from "../lib/image-program";
import type { SupabaseClient } from "@supabase/supabase-js";

test("athletics data contains 20 canonical events and marks direct-final and expandable mini-marathon events", () => {
  assert.equal(INITIAL_ATHLETICS_DATA.length, 20);
  const directIds = INITIAL_ATHLETICS_DATA.filter((r) => r.directFinal).map(
    (r) => r.id,
  );
  assert.deepEqual(directIds, [1, 2, 3, 4]);
  const expandableIds = INITIAL_ATHLETICS_DATA.filter(
    (r) => r.expandableLanes,
  ).map((r) => r.id);
  assert.deepEqual(expandableIds, [1, 2, 3, 4]);
});

test("mini-marathon can continuously add lanes beyond 6 and remove lanes with renumbering", () => {
  let mini = structuredClone(INITIAL_ATHLETICS_DATA[0]); // รายการที่ 1 วิ่ง มินิมาราธอน ประถม ชาย
  assert.equal(mini.r3Lanes.length, 6);

  // Add lanes 7, 8, 9 (multiple athletes from same school allowed)
  mini = addLaneToEventRound(mini, "r3");
  mini = addLaneToEventRound(mini, "r3");
  mini = addLaneToEventRound(mini, "r3");
  assert.equal(mini.r3Lanes.length, 9);
  assert.equal(mini.r3Lanes[8].lane, 9);

  mini.r3Lanes[6].schoolName = "โรงเรียนบ้านหนองแดน";
  mini.r3Lanes[6].athleteName = "คนที่ 1";
  mini.r3Lanes[7].schoolName = "โรงเรียนบ้านหนองแดน";
  mini.r3Lanes[7].athleteName = "คนที่ 2";
  mini.r3Lanes[8].schoolName = "โรงเรียนบ้านดงซ่อม";
  mini.r3Lanes[8].athleteName = "คนที่ 3";
  mini.r3Lanes[8].rank = "1";

  // Remove lane 8 (index 7) -> lane 9 becomes lane 8 and keeps rank 1
  mini = removeLaneFromEventRound(mini, "r3", 7);
  assert.equal(mini.r3Lanes.length, 8);
  assert.equal(mini.r3Lanes[7].lane, 8);
  assert.equal(mini.r3Lanes[7].schoolName, "โรงเรียนบ้านดงซ่อม");
  assert.equal(mini.winners?.[0].schoolName, "โรงเรียนบ้านดงซ่อม");
});

test("computeFinalsWinners does not award premature medals to unranked lanes", () => {
  const lanes = defaultLanes(6);
  lanes[0].schoolName = "โรงเรียนบ้านหนองแดน";
  lanes[1].schoolName = "โรงเรียนบ้านดงซ่อม";
  lanes[2].schoolName = "โรงเรียนบ้านคลองเมือง";

  const beforeRace = computeFinalsWinners(lanes);
  assert.equal(beforeRace[0].schoolName, "");
  assert.equal(beforeRace[0].score, 0);
  assert.equal(beforeRace[1].schoolName, "");
  assert.equal(beforeRace[2].schoolName, "");

  // Assign ranks 1, 2, 3
  lanes[2].rank = "1";
  lanes[0].rank = "2";
  lanes[1].rank = "3";

  const afterRace = computeFinalsWinners(lanes);
  assert.equal(afterRace[0].schoolName, "โรงเรียนบ้านคลองเมือง");
  assert.equal(afterRace[0].score, 3);
  assert.equal(afterRace[1].schoolName, "โรงเรียนบ้านหนองแดน");
  assert.equal(afterRace[1].score, 2);
  assert.equal(afterRace[2].schoolName, "โรงเรียนบ้านดงซ่อม");
  assert.equal(afterRace[2].score, 1);
});

test("assignUniqueRankInLanes clears duplicate rank from previous lane in the same heat", () => {
  let lanes = defaultLanes(5);
  lanes[0].schoolName = "โรงเรียนบ้านหนองแดน";
  lanes[1].schoolName = "โรงเรียนบ้านดงซ่อม";

  lanes = assignUniqueRankInLanes(lanes, 0, "1");
  assert.equal(lanes[0].rank, "1");

  // Assign rank "1" to lane 2 -> lane 1's rank "1" must be cleared
  lanes = assignUniqueRankInLanes(lanes, 1, "1");
  assert.equal(lanes[0].rank, "");
  assert.equal(lanes[1].rank, "1");
});

test("syncQualifiersToFinals seeds 3-2-1-1-2-3 and clears finals lane when qualifier fouls or loses rank", () => {
  const row = structuredClone(INITIAL_ATHLETICS_DATA[4]); // รายการที่ 5 วิ่ง 50 เมตร อนุบาล หญิง
  row.r1Lanes[0] = { lane: 1, schoolName: "โรงเรียนบ้านหนองแดน", athleteName: "ด.ญ. ก", rank: "1", isFoul: false };
  row.r1Lanes[1] = { lane: 2, schoolName: "โรงเรียนบ้านโนนสมบูรณ์", athleteName: "ด.ญ. ข", rank: "2", isFoul: false };
  row.r1Lanes[2] = { lane: 3, schoolName: "โรงเรียนบ้านคลองเมือง", athleteName: "ด.ญ. ค", rank: "3", isFoul: false };

  row.r2Lanes[0] = { lane: 1, schoolName: "โรงเรียนบ้านมะเดื่อชุมพร", athleteName: "ด.ญ. ง", rank: "1", isFoul: false };
  row.r2Lanes[1] = { lane: 2, schoolName: "โรงเรียนบ้านดงซ่อม", athleteName: "ด.ญ. จ", rank: "2", isFoul: false };
  row.r2Lanes[2] = { lane: 3, schoolName: "โรงเรียนบ้านไร่ลำปาง", athleteName: "ด.ญ. ฉ", rank: "3", isFoul: false };

  const synced1 = syncQualifiersToFinals(row).row;
  // Seeding order across lanes 1-6: 3, 2, 1, 1, 2, 3
  assert.deepEqual(synced1.r3, [
    "โรงเรียนบ้านคลองเมือง",   // ลู่ 1 = R1 #3
    "โรงเรียนบ้านโนนสมบูรณ์",  // ลู่ 2 = R1 #2
    "โรงเรียนบ้านหนองแดน",     // ลู่ 3 = R1 #1
    "โรงเรียนบ้านมะเดื่อชุมพร", // ลู่ 4 = R2 #1
    "โรงเรียนบ้านดงซ่อม",      // ลู่ 5 = R2 #2
    "โรงเรียนบ้านไร่ลำปาง",     // ลู่ 6 = R2 #3
  ]);

  // Now mark R1 #1 (โรงเรียนบ้านหนองแดน) as foul -> Finals Lane 3 must be cleared
  synced1.r1Lanes[0].isFoul = true;
  synced1.r1Lanes[0].rank = "DQ";

  const synced2 = syncQualifiersToFinals(synced1).row;
  assert.equal(synced2.r3[2], "");
  assert.equal(synced2.r3Lanes[2].schoolName, "");
});

test("calculateSchoolAthleticsStandings breaks score ties by gold, silver, bronze counts", () => {
  const rows = structuredClone(INITIAL_ATHLETICS_DATA);

  // School A: 1 Gold (3 pts)
  rows[0].r3Lanes[0] = { lane: 1, schoolName: "โรงเรียนบ้านหนองแดน", athleteName: "A", rank: "1", isFoul: false };
  // School B: 1 Silver + 1 Bronze (2 + 1 = 3 pts)
  rows[0].r3Lanes[1] = { lane: 2, schoolName: "โรงเรียนบ้านดงซ่อม", athleteName: "B1", rank: "2", isFoul: false };
  rows[1].r3Lanes[0] = { lane: 1, schoolName: "โรงเรียนบ้านดงซ่อม", athleteName: "B2", rank: "3", isFoul: false };

  const standings = calculateSchoolAthleticsStandings(rows);
  assert.equal(standings.length, 2);
  // Both have 3 points, but โรงเรียนบ้านหนองแดน has 1 Gold so it ranks 1st
  assert.equal(standings[0].schoolName, "โรงเรียนบ้านหนองแดน");
  assert.equal(standings[0].totalScore, 3);
  assert.equal(standings[0].gold, 1);
  assert.equal(standings[0].place, 1);

  assert.equal(standings[1].schoolName, "โรงเรียนบ้านดงซ่อม");
  assert.equal(standings[1].totalScore, 3);
  assert.equal(standings[1].gold, 0);
  assert.equal(standings[1].silver, 1);
  assert.equal(standings[1].bronze, 1);
  assert.equal(standings[1].place, 2);
});

test("all 20 athletics scoresheet rows map 1-to-1 to the 20 Supabase athletics competitions and 11 schools", () => {
  const schools = Object.entries(IMAGE_PROGRAM.schools).map(([, name], i) => ({
    id: `a0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    name: name
      .replace("บ้านคงซ่อม", "บ้านดงซ่อม")
      .replace("โรงเรียนมะเดื่อชุมพร", "โรงเรียนบ้านมะเดื่อชุมพร"),
  }));
  const competitions = buildLatestProgram(schools);
  const matchedIds = new Set<string>();

  for (const row of INITIAL_ATHLETICS_DATA) {
    const matched = matchAthleticsRowToCompetition(row, competitions);
    assert.ok(matched, `Row ${row.id} (${row.name} ${row.grade} ${row.type}) must match a Supabase competition`);
    matchedIds.add(matched.id);
  }
  assert.equal(matchedIds.size, 20);

  // Every school in DEFAULT_SCHOOLS (and variations with spaces around parentheses or สาขาบ้านโละโคะ) matches a Supabase school UUID
  for (const sName of [
    ...DEFAULT_SCHOOLS,
    "โรงเรียนอนุบาลโกสัมพีนคร (บ้านท่าคูณ)",
    "โรงเรียนบ้านโกสัมพี (วิเศษน้อมมิตรอนุกูล)",
    "โรงเรียนบ้านหนองแดน สาขาบ้านโละโคะ",
  ]) {
    const found = matchSchoolByName(sName, schools);
    assert.ok(found, `School "${sName}" must resolve to a Supabase school record`);
  }
});

test("athleticsScoresheetAwards converts finals winners into Gold/Silver/Bronze awards for main medal standings", () => {
  const schools = Object.entries(IMAGE_PROGRAM.schools).map(([, name], i) => ({
    id: `a0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    name: name
      .replace("บ้านคงซ่อม", "บ้านดงซ่อม")
      .replace("โรงเรียนมะเดื่อชุมพร", "โรงเรียนบ้านมะเดื่อชุมพร"),
  }));
  const competitions = buildLatestProgram(schools);

  const rows = structuredClone(INITIAL_ATHLETICS_DATA);
  // Event 1 (Mini Marathon Primary Male): 1st, 2nd, 3rd
  rows[0].r3Lanes[0] = { lane: 1, schoolName: "โรงเรียนบ้านหนองแดน", athleteName: "ด.ช. ทอง", rank: "1", isFoul: false };
  rows[0].r3Lanes[1] = { lane: 2, schoolName: "โรงเรียนอนุบาลโกสัมพีนคร (บ้านท่าคูณ)", athleteName: "ด.ช. เงิน", rank: "2", isFoul: false };
  rows[0].r3Lanes[2] = { lane: 3, schoolName: "โรงเรียนบ้านหนองแดน สาขาบ้านโละโคะ", athleteName: "ด.ช. ทองแดง", rank: "3", isFoul: false };

  const awards = athleticsScoresheetAwards(rows, schools, competitions);
  assert.equal(awards.length, 3);
  assert.deepEqual(
    awards.map((a) => a.medal),
    ["gold", "silver", "bronze"],
  );
  assert.ok(awards.every((a) => Boolean(a.competition_id)));

  const merged = mergeAthleticsScoresheetAwards(
    [
      {
        id: "team-1",
        event: "ฟุตบอล · ประถม · ชาย",
        division: "ประถมศึกษา",
        gender: "ชาย",
        school_id: schools[0].id,
        medal: "gold",
        competition_id: "football-1",
      },
    ],
    awards,
  );
  assert.equal(merged.length, 4);
});

test("readAthleticsScoresheet and writeAthleticsScoresheet persist to Supabase Storage with CAS versioning", async () => {
  const files = new Map<string, { content: string; created_at: string }>();
  let clock = 1000;

  const mockAdmin = {
    storage: {
      from(bucketName: string) {
        assert.equal(bucketName, "team-files");
        return {
          async list(prefix: string) {
            const items = [...files.entries()]
              .filter(([k]) => k.startsWith(`${prefix}/`))
              .map(([k, v]) => ({
                name: k.slice(prefix.length + 1),
                created_at: v.created_at,
              }))
              .sort((a, b) => b.created_at.localeCompare(a.created_at));
            return { data: items.slice(0, 1), error: null };
          },
          async download(path: string) {
            const found = files.get(path);
            if (!found) {
              return {
                data: null,
                error: { statusCode: "404", message: "Object not found" },
              };
            }
            return {
              data: new Blob([found.content], { type: "application/json" }),
              error: null,
            };
          },
          async upload(
            path: string,
            body: string,
            opts: { upsert: boolean },
          ) {
            assert.equal(opts.upsert, false);
            if (files.has(path)) {
              return {
                data: null,
                error: { statusCode: "409", message: "The resource already exists" },
              };
            }
            clock += 1000;
            files.set(path, {
              content: body,
              created_at: new Date(clock).toISOString(),
            });
            return { data: { path }, error: null };
          },
        };
      },
    },
  } as unknown as SupabaseClient;

  // 1. Initial read when empty returns default 20 rows and null version
  const initial = await readAthleticsScoresheet(mockAdmin);
  assert.equal(initial.version, null);
  assert.equal(initial.rows.length, 20);

  // 2. Modify Mini Marathon (add lane 7) and Event 5 (R1 qualifiers -> auto-seed finals)
  const draft = structuredClone(initial.rows);
  draft[0] = addLaneToEventRound(draft[0], "r3");
  draft[0].r3Lanes[6].schoolName = "โรงเรียนบ้านหนองแดน";
  draft[0].r3Lanes[6].athleteName = "ด.ช. มาราธอน 7";
  draft[0].r3Lanes[6].rank = "1";

  draft[4].r1Lanes[0].schoolName = "โรงเรียนบ้านดงซ่อม";
  draft[4].r1Lanes[0].athleteName = "ด.ญ. สปีด";
  draft[4].r1Lanes[0].rank = "1";

  const saved1 = await writeAthleticsScoresheet(
    mockAdmin,
    draft,
    null,
    "admin-user-id",
  );
  assert.ok(saved1.version && /^[0-9a-f-]{36}\.json$/i.test(saved1.version));
  assert.equal(saved1.rows[0].r3Lanes.length, 7);
  assert.equal(saved1.rows[0].winners?.[0].schoolName, "โรงเรียนบ้านหนองแดน");
  // R1 rank 1 automatically seeded into Finals lane 3 (index 2)
  assert.equal(saved1.rows[4].r3Lanes[2].schoolName, "โรงเรียนบ้านดงซ่อม");

  // 3. Stale expectedVersion (null) must fail with 409 Conflict
  await assert.rejects(
    () => writeAthleticsScoresheet(mockAdmin, saved1.rows, null),
    (err: { status?: number }) => err.status === 409,
  );

  // 4. Subsequent read returns persisted state
  const reloaded = await readAthleticsScoresheet(mockAdmin);
  assert.equal(reloaded.version, saved1.version);
  assert.equal(reloaded.rows[0].r3Lanes.length, 7);
  assert.equal(reloaded.rows[4].r3Lanes[2].schoolName, "โรงเรียนบ้านดงซ่อม");

  // 5. Validation rejects non-array input
  assert.throws(() => validateAthleticsScoresheetRows(null));
});

test("/api/athletics-scoresheet route enforces role permissions and persists via Supabase Storage HTTP endpoints", async () => {
  const previousFetch = globalThis.fetch;
  const savedEnv = { ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://athletics-fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

  const storageFiles = new Map<string, { content: string; created_at: string }>();
  let currentRole = "school_admin";
  let clock = 1000;

  globalThis.fetch = async (input, init) => {
    const req =
      input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(req.url);
    const json = (value: unknown, status = 200) =>
      Response.json(value, { status });

    if (url.pathname === "/auth/v1/user") {
      if (req.headers.get("authorization") !== "Bearer valid")
        return json({}, 401);
      return json({ id: "user-1", aud: "authenticated", role: "authenticated" });
    }
    if (url.pathname === "/rest/v1/profiles") {
      return json({ id: "user-1", role: currentRole, school_id: null });
    }
    if (url.pathname === "/storage/v1/object/list/team-files") {
      const body = await req.json();
      const prefix = String(body.prefix || "");
      const items = [...storageFiles.entries()]
        .filter(([k]) => k.startsWith(`${prefix}/`))
        .map(([k, v]) => ({
          name: k.slice(prefix.length + 1),
          created_at: v.created_at,
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return json(items.slice(0, 1));
    }
    if (url.pathname.startsWith("/storage/v1/object/team-files/")) {
      const objectPath = decodeURIComponent(
        url.pathname.slice("/storage/v1/object/team-files/".length),
      );
      if (req.method === "GET") {
        const found = storageFiles.get(objectPath);
        if (!found) return json({ statusCode: "404", message: "Not found" }, 404);
        return new Response(found.content, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (req.method === "POST") {
        if (storageFiles.has(objectPath)) {
          return json({ statusCode: "409", message: "Duplicate" }, 409);
        }
        clock += 1000;
        storageFiles.set(objectPath, {
          content: await req.text(),
          created_at: new Date(clock).toISOString(),
        });
        return json({ Key: `team-files/${objectPath}` });
      }
    }
    return json({ message: `Unexpected ${req.method} ${url.pathname}` }, 500);
  };

  try {
    // 1. Unauthenticated PUT -> 401
    const unauthRes = await scoresheetPut(
      new Request("https://app.invalid/api/athletics-scoresheet", {
        method: "PUT",
        body: JSON.stringify({ rows: INITIAL_ATHLETICS_DATA }),
      }),
    );
    assert.equal(unauthRes.status, 401);

    // 2. school_admin PUT -> 403
    const forbiddenRes = await scoresheetPut(
      new Request("https://app.invalid/api/athletics-scoresheet", {
        method: "PUT",
        headers: { Authorization: "Bearer valid" },
        body: JSON.stringify({ rows: INITIAL_ATHLETICS_DATA }),
      }),
    );
    assert.equal(forbiddenRes.status, 403);

    // 3. referee PUT -> 200
    currentRole = "referee";
    const rows = structuredClone(INITIAL_ATHLETICS_DATA);
    rows[0].r3Lanes[0].schoolName = "โรงเรียนบ้านหนองแดน";
    rows[0].r3Lanes[0].athleteName = "ด.ช. ทดสอบ";
    rows[0].r3Lanes[0].rank = "1";

    const okRes = await scoresheetPut(
      new Request("https://app.invalid/api/athletics-scoresheet", {
        method: "PUT",
        headers: { Authorization: "Bearer valid" },
        body: JSON.stringify({ rows, expectedVersion: null }),
      }),
    );
    assert.equal(okRes.status, 200);
    const savedBody = await okRes.json();
    assert.equal(savedBody.ok, true);
    assert.ok(savedBody.version);
    assert.equal(
      savedBody.rows[0].winners[0].schoolName,
      "โรงเรียนบ้านหนองแดน",
    );

    // 4. Public GET returns persisted version and winners
    const getRes = await scoresheetGet();
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.version, savedBody.version);
    assert.equal(getBody.rows[0].winners[0].schoolName, "โรงเรียนบ้านหนองแดน");
  } finally {
    globalThis.fetch = previousFetch;
    process.env = savedEnv;
  }
});
