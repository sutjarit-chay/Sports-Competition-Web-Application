import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { POST } from "../app/api/match-results/route";
const actor = "10000000-0000-4000-8000-000000000001",
  competition = "20000000-0000-4000-8000-000000000001",
  home = "30000000-0000-4000-8000-000000000001",
  away = "30000000-0000-4000-8000-000000000002",
  matchId = "40000000-0000-4000-8000-000000000001";
type Row = Record<string, any>;
async function fixture(
  work: (f: {
    tables: Record<string, Row[]>;
    match: Row;
    writes: Row[];
    setRole: (role: string) => void;
    failAdvance: () => void;
  }) => Promise<void>,
) {
  const match: Row = {
    id: matchId,
    sport: "ฟุตบอล",
    division: "ประถมศึกษา",
    gender: "ชาย",
    pool: "รอบ 1",
    competition_id: competition,
    home,
    away,
    starts_at: "2026-11-10T09:00",
    venue: "Court A",
    status: "scheduled",
    revision: 3,
    referee_id: actor,
  };
  const tables: Record<string, Row[]> = {
    schools: [
      { id: home, name: "Home" },
      { id: away, name: "Away" },
    ],
    competitions: [
      {
        id: competition,
        name: "Football",
        sport: "ฟุตบอล",
        age_group: "ประถมศึกษา",
        gender: "ชาย",
        win_points: 3,
        draw_points: 1,
        loss_points: 0,
        registration_policy: {
          ruleId: "football-male",
          reserves: 3,
          eventQuotas: {},
          maxEventsPerAthlete: null,
        },
      },
    ],
    matches: [
      {
        id: matchId,
        competition_id: competition,
        group_name: "รอบ 1",
        home_school_id: home,
        away_school_id: away,
        starts_at: "2026-11-10T02:00:00Z",
        venue: "Court A",
        status: "scheduled",
        home_score: null,
        away_score: null,
        revision: 3,
        referee_id: actor,
      },
    ],
    registrations: [],
    athletics_events: [],
    athletics_results: [],
    medals: [],
  };
  const writes: Row[] = [];
  let role = "admin",
    advanceFailure = false;
  const previousFetch = globalThis.fetch;
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const old = keys.map((k) => process.env[k]);
  process.env[keys[0]] = "https://match-fixture.invalid";
  process.env[keys[1]] = "public-fixture";
  process.env[keys[2]] = "service-fixture";
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    assert.equal(url.origin, "https://match-fixture.invalid");
    const method = init?.method || "GET",
      headers = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const response = (data: unknown, status = 200, total?: number) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          "content-type": "application/json",
          ...(total !== undefined
            ? { "content-range": `0-${Math.max(0, total - 1)}/${total}` }
            : {}),
        },
      });
    if (url.pathname === "/auth/v1/user")
      return response({
        id: actor,
        aud: "authenticated",
        app_metadata: {},
        user_metadata: {},
      });
    if (url.pathname.startsWith("/storage/v1/"))
      return new Response(
        JSON.stringify({ statusCode: "404", message: "Object not found" }),
        { status: 404, headers: { "content-type": "application/json" } },
      );
    const table = url.pathname.split("/").at(-1)!;
    if (table === "profiles")
      return response({ id: actor, role, school_id: null });
    if (method !== "GET") {
      if (headers.get("apikey") !== "service-fixture")
        return response(
          { message: "permission denied for table matches", code: "42501" },
          403,
        );
      writes.push({ table, method, body });
    }
    if (advanceFailure && table === "matches" && method === "POST")
      return response({ message: "temporary failure", code: "XX000" }, 503);
    if (table === "matches" && method !== "GET" && body?.status === "confirmed")
      return response(
        {
          message: "new row violates check constraint matches_status_check",
          code: "23514",
        },
        400,
      );
    const rows = tables[table];
    assert.ok(rows, table);
    const selected = rows.filter((row) =>
      [...url.searchParams].every(
        ([key, val]) =>
          !val.startsWith("eq.") || String(row[key]) === val.slice(3),
      ),
    );
    if (method === "PATCH") {
      selected.forEach((row) => Object.assign(row, body));
      return response(selected);
    }
    if (method === "POST") {
      rows.push({ ...body });
      return response([body]);
    }
    const result = headers.get("accept")?.includes("object+json")
      ? selected[0] || null
      : selected;
    return response(result, 200, selected.length);
  };
  try {
    await work({
      tables,
      match,
      writes,
      setRole: (r) => (role = r),
      failAdvance: () => {
        advanceFailure = true;
      },
    });
  } finally {
    globalThis.fetch = previousFetch;
    keys.forEach((k, i) =>
      old[i] === undefined ? delete process.env[k] : (process.env[k] = old[i]),
    );
  }
}
const post = (match: Row, auth = true) =>
  POST(
    new Request("http://localhost/api/match-results", {
      method: "POST",
      headers: auth ? { authorization: "Bearer actor-token" } : {},
      body: JSON.stringify({ match }),
    }),
  );
test("production fixture denies direct browser match writes while authorized server score saves succeed", async () =>
  fixture(async (f) => {
    const browser = createClient(
      "https://match-fixture.invalid",
      "public-fixture",
      { auth: { persistSession: false } },
    );
    assert.equal(
      (
        await browser
          .from("matches")
          .update({ home_score: 5 })
          .eq("id", matchId)
      ).error?.code,
      "42501",
    );
    f.setRole("referee");
    const res = await post({
      ...f.match,
      status: "finished",
      home_score: 2,
      away_score: 1,
    });
    assert.equal(res.status, 200, JSON.stringify(await res.json()));
    assert.equal(f.tables.matches[0].status, "finished");
    assert.equal(f.tables.matches[0].home_score, 2);
    assert.equal(f.tables.matches[0].revision, 4);
  }));
test("unauthenticated, school, and unassigned referee score requests cannot write", async () =>
  fixture(async (f) => {
    assert.equal((await post(f.match, false)).status, 401);
    f.setRole("school");
    assert.equal((await post(f.match)).status, 403);
    f.setRole("referee");
    f.tables.matches[0].referee_id = away;
    assert.equal(
      (
        await post({
          ...f.match,
          status: "finished",
          home_score: 2,
          away_score: 1,
        })
      ).status,
      403,
    );
    assert.equal(f.writes.length, 0);
  }));
test("match identity and stale revision cannot be used to replace another team or overwrite a result", async () =>
  fixture(async (f) => {
    assert.equal((await post({ ...f.match, home: away })).status, 409);
    assert.equal((await post({ ...f.match, revision: 2 })).status, 409);
    assert.equal((await post({ ...f.match, id: away })).status, 404);
    assert.equal(f.writes.length, 0);
  }));
test("referees cannot change schedule or assignments and malformed scores are rejected", async () =>
  fixture(async (f) => {
    f.setRole("referee");
    assert.equal(
      (await post({ ...f.match, venue: "Other Court" })).status,
      403,
    );
    assert.equal((await post({ ...f.match, referee_id: away })).status, 403);
    for (const score of [-1, 1.5, "2"])
      assert.equal(
        (
          await post({
            ...f.match,
            status: "finished",
            home_score: score,
            away_score: 0,
          })
        ).status,
        400,
      );
    assert.equal(
      (await post({ ...f.match, status: "finished", home_score: 2 })).status,
      400,
    );
    assert.equal((await post({ ...f.match, status: "unknown" })).status, 400);
    assert.equal(f.writes.length, 0);
  }));
test("admin schedule changes enforce global conflicts and preserve confirmed schedules", async () =>
  fixture(async (f) => {
    f.tables.matches.push({
      ...f.tables.matches[0],
      id: away,
      competition_id: competition,
      home_school_id: away,
      away_school_id: home,
      starts_at: "2026-11-10T03:00:00Z",
      venue: "Court B",
    });
    assert.equal(
      (
        await post({
          ...f.match,
          starts_at: "2026-11-10T10:00",
          venue: "Court C",
        })
      ).status,
      409,
    );
    f.tables.matches[0].status = "finished";
    f.tables.matches[0].home_score = 2;
    f.tables.matches[0].away_score = 1;
    assert.equal((await post({ ...f.match, status: "scheduled" })).status, 409);
    assert.equal(
      (
        await post({
          ...f.match,
          status: "finished",
          home_score: 2,
          away_score: 1,
          starts_at: "2026-11-11T09:00",
        })
      ).status,
      409,
    );
    assert.equal(f.writes.length, 0);
  }));
function knockout(f: { tables: Record<string, Row[]> }) {
  const h2 = "30000000-0000-4000-8000-000000000003",
    a2 = "30000000-0000-4000-8000-000000000004",
    second = "40000000-0000-4000-8000-000000000002",
    final = "40000000-0000-4000-8000-000000000003";
  f.tables.schools.push({ id: h2, name: "Home2" }, { id: a2, name: "Away2" });
  f.tables.matches.push({
    ...f.tables.matches[0],
    id: second,
    home_school_id: h2,
    away_school_id: a2,
    status: "finished",
    home_score: 3,
    away_score: 0,
    starts_at: "2026-11-10T03:00:00Z",
    venue: "Court B",
  });
  f.tables.competitions[0].registration_policy.management = {
    revision: 1,
    format: "knockout",
    teamLimit: 4,
    details: "",
    teams: [home, away, h2, a2],
    fixtures: [
      {
        id: matchId,
        round: "รอบ 1",
        home,
        away,
        startsAt: "2026-11-10T09:00",
        venue: "Court A",
      },
      {
        id: second,
        round: "รอบ 1",
        home: h2,
        away: a2,
        startsAt: "2026-11-10T10:00",
        venue: "Court B",
      },
      {
        id: final,
        round: "รอบชิงชนะเลิศ",
        home: "ผู้ชนะคู่ 1",
        away: "ผู้ชนะคู่ 2",
        startsAt: "2026-11-11T09:00",
        venue: "Court A",
      },
    ],
  };
  return { h2, final };
}
test("saved decisive knockout scores automatically materialize the next scheduled ready round", async () =>
  fixture(async (f) => {
    const { h2, final } = knockout(f);
    f.setRole("referee");
    const res = await post({
      ...f.match,
      status: "finished",
      home_score: 2,
      away_score: 1,
    });
    assert.equal(res.status, 200, JSON.stringify(await res.json()));
    const next = f.tables.matches.find((m) => m.id === final)!;
    assert.equal(next.home_school_id, home);
    assert.equal(next.away_school_id, h2);
    assert.equal(next.status, "scheduled");
  }));
test("advancement failure explicitly reports the score was saved and preserves its revision", async () =>
  fixture(async (f) => {
    knockout(f);
    f.failAdvance();
    const res = await post({
      ...f.match,
      status: "finished",
      home_score: 2,
      away_score: 1,
    });
    assert.equal(res.status, 200);
    assert.ok((await res.json()).note);
    assert.equal(f.tables.matches[0].home_score, 2);
    assert.equal(f.tables.matches[0].revision, 4);
    assert.equal(f.tables.matches.length, 2);
  }));
test("confirmed knockout winner cannot be changed through the service-role score API", async () =>
  fixture(async (f) => {
    knockout(f);
    Object.assign(f.tables.matches[0], {
      status: "finished",
      home_score: 2,
      away_score: 1,
    });
    assert.equal(
      (
        await post({
          ...f.match,
          status: "finished",
          home_score: 0,
          away_score: 3,
        })
      ).status,
      409,
    );
    assert.equal(f.tables.matches[0].home_score, 2);
    assert.equal(f.writes.length, 0);
  }));
test("legacy finished match schedules and statuses are protected too", async () =>
  fixture(async (f) => {
    Object.assign(f.tables.matches[0], {
      status: "finished",
      home_score: 2,
      away_score: 1,
    });
    assert.equal((await post({ ...f.match, status: "scheduled" })).status, 409);
    assert.equal(
      (
        await post({
          ...f.match,
          status: "finished",
          home_score: 2,
          away_score: 1,
          venue: "Other",
        })
      ).status,
      409,
    );
    assert.equal(f.writes.length, 0);
  }));

test("a concurrent revision change between trusted read and write cannot be overwritten", async () =>
  fixture(async (f) => {
    const original = globalThis.fetch;
    let raced = false;
    globalThis.fetch = async (input, init) => {
      if (
        !raced &&
        String(input).includes("/rest/v1/matches") &&
        init?.method === "PATCH"
      ) {
        raced = true;
        Object.assign(f.tables.matches[0], {
          revision: 4,
          home_score: 5,
          away_score: 4,
          status: "finished",
        });
      }
      return original(input, init);
    };
    assert.equal(
      (
        await post({
          ...f.match,
          status: "finished",
          home_score: 2,
          away_score: 1,
        })
      ).status,
      409,
    );
    assert.equal(f.tables.matches[0].home_score, 5);
    assert.equal(f.tables.matches[0].revision, 4);
  }));
