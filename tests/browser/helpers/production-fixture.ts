import { expect, type Page } from "@playwright/test";
import { decodeHosted, type HostedRows } from "../../../lib/hosted";
import { prepareRoster } from "../../../lib/registration";
import { defaultPolicy } from "../../../lib/registration";
export const sid = "20000000-0000-4000-8000-000000000001",
  sid2 = "20000000-0000-4000-8000-000000000002";
export const football = "10000000-0000-4000-8000-000000000001",
  track = "10000000-0000-4000-8000-000000000006";
export type Row = Record<string, unknown>;
export async function fixture(page: Page, fail = false, rosters = false) {
  const db: Record<string, Row[]> = {
    schools: [
      { id: sid, name: "โรงเรียนจริง ก" },
      { id: sid2, name: "โรงเรียนจริง ข" },
    ],
    competitions: [
      {
        id: football,
        sport: "ฟุตบอล",
        name: "ฟุตบอลชาย ประถม",
        age_group: "ประถม",
        gender: "ชาย",
        registration_policy: defaultPolicy("football-male"),
        win_points: 2,
        draw_points: 1,
        loss_points: 0,
      },
      {
        id: track,
        sport: "กรีฑา",
        registration_policy: {
          ...defaultPolicy("athletics-individual"),
          eventQuotas: { run60: 1, run100: 2 },
        },
        name: "กรีฑาชาย ประถม",
        age_group: "ประถม",
        gender: "ชาย",
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
    profiles: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        role: "admin",
        school_id: null,
      },
    ],
  };
  if (rosters) {
    Object.assign(db.competitions[0], {
      gender: "ชาย",
      age_group: "ประถม",
      registration_policy: defaultPolicy("football-male"),
    });
  }
  const columns: Record<string, string[]> = {
    competitions: ["registration_policy"],
    schools: ["id", "name"],
    registrations: [
      "id",
      "school_id",
      "competition_id",
      "athlete_name",
      "bib",
      "roster_details",
    ],
    matches: [
      "id",
      "competition_id",
      "group_name",
      "home_school_id",
      "away_school_id",
      "starts_at",
      "venue",
      "status",
      "home_score",
      "away_score",
      "revision",
      "referee_id",
    ],
    athletics_events: [
      "id",
      "competition_id",
      "name",
      "kind",
      "round",
      "heat",
      "direction",
      "unit",
      "starts_at",
      "venue",
      "referee_id",
    ],
    athletics_results: [
      "id",
      "event_id",
      "school_id",
      "bib",
      "value",
      "status",
    ],
    medals: ["id", "competition_id", "school_id", "award", "event_label"],
  };
  const control: { readGate?: Promise<void>; fail: boolean } = { fail };
  const writes: { table: string; method: string; payload: Row[] }[] = [];
  const user: Row = {
    id: db.profiles[0].id,
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.invalid",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const sessionPayload = () => {
    const token = [
      { alg: "HS256", typ: "JWT" },
      {
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: "authenticated",
      },
      { fixture: true },
    ]
      .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
      .join(".");
    return {
      access_token: token,
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "test-fixture-only",
      user,
    };
  };
  const privateState: { profile: Row; coaches: Row[]; version: string | null } =
    {
      profile: {
        shortName: "",
        schoolType: "",
        logo: "",
        contactName: "",
        contactPhone: "",
        address: "",
      },
      coaches: [],
      version: null,
    };
  await page.route("**/api/school-profile**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("public") === "1") {
      await route.fulfill({ json: { schools: [] } });
      return;
    }
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    if (route.request().method() === "PUT") {
      privateState.profile = route.request().postDataJSON().profile;
      privateState.version = "2026-11-06T01:00:00Z";
    }
    await route.fulfill({
      json: { profile: privateState.profile, version: privateState.version },
    });
  });
  await page.route("**/api/coaches**", async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    if (route.request().method() === "PUT")
      privateState.coaches = route.request().postDataJSON().coaches;
    await route.fulfill({
      json: { coaches: privateState.coaches, version: privateState.version },
    });
  });
  await page.route("**/api/schools", async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    const body = route.request().postDataJSON();
    const school = db.schools.find((row) => row.id === body.schoolId)!;
    school.name = body.name;
    await route.fulfill({ json: { school } });
  });
  await page.route("**/api/admin-accounts", (route) =>
    route.fulfill({ json: { accounts: [] } }),
  );
  await page.route("**/api/competition-reset**", (route) =>
    route.fulfill({
      json: {
        preview: { counts: {}, fingerprint: "empty" },
        job: null,
        archives: [],
        nextOffset: null,
      },
    }),
  );
  await page.route("**/api/athlete-registrations", async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    try {
      const { athletes } = route.request().postDataJSON();
      const state = decodeHosted(db as unknown as HostedRows);
      const prepared = [
        ...new Set<string>(athletes.map((a: Row) => String(a.competition_id))),
      ].flatMap((id) => {
        const policy = db.competitions.find(
          (c) => c.id === id,
        )?.registration_policy;
        const incoming = athletes.filter((a: Row) => a.competition_id === id);
        if (
          !policy &&
          incoming.some(
            (a: Row) => !db.registrations.some((r) => r.id === a.id),
          )
        )
          throw Error("ผู้ดูแลยังไม่ได้ตั้งค่ากติกาของรายการนี้");
        return policy
          ? prepareRoster(
              state.athletes,
              incoming,
              policy as Parameters<typeof prepareRoster>[2],
            )
          : incoming;
      });
      const inserts: Row[] = [];
      for (const a of prepared) {
        const original = db.registrations.find((r) => r.id === a.id);
        if (original) {
          const patch = { athlete_name: a.name, bib: a.bib || a.id };
          Object.assign(original, patch);
          writes.push({
            table: "registrations",
            method: "PATCH",
            payload: [patch],
          });
        } else
          inserts.push({
            id: a.id,
            competition_id: a.competition_id,
            school_id: a.school_id,
            athlete_name: a.name,
            bib: a.bib || a.id,
            roster_details: a.roster || null,
          });
      }
      if (inserts.length) {
        db.registrations.push(...inserts);
        writes.push({
          table: "registrations",
          method: "POST",
          payload: inserts,
        });
      }
      await route.fulfill({ json: { ok: true } });
    } catch (e) {
      await route.fulfill({
        status: 400,
        json: { error: e instanceof Error ? e.message : "ข้อมูลไม่ถูกต้อง" },
      });
    }
  });
  await page.route("**/api/match-results", async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    const { match } = route.request().postDataJSON();
    const actual = db.matches.find((m) => m.id === match.id)!;
    if (Number(actual.revision) !== match.revision) {
      await route.fulfill({
        status: 409,
        json: { error: "ผลแข่งขันเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่" },
      });
      return;
    }
    const patch = {
      home_score: match.home_score ?? null,
      away_score: match.away_score ?? null,
      status: match.status,
      starts_at: new Date(match.starts_at + "+07:00").toISOString(),
      venue: match.venue,
      referee_id: match.referee_id || null,
      revision: Number(actual.revision) + 1,
    };
    Object.assign(actual, patch);
    writes.push({ table: "matches", method: "PATCH", payload: [patch] });
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/athletics-results", async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    const { race } = route.request().postDataJSON();
    const athlete = db.registrations.find((a) => a.id === race.athlete_id)!;
    let event = race.event_id
      ? db.athletics_events.find((e) => e.id === race.event_id)
      : db.athletics_events.find(
          (e) =>
            e.competition_id === race.competition_id &&
            e.name === race.event &&
            e.round === race.stage &&
            e.heat === race.heat,
        );
    if (!event) {
      expect(race.starts_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(race.venue.trim()).not.toBe("");
      event = {
        id: crypto.randomUUID(),
        competition_id: race.competition_id,
        name: race.event,
        kind: race.kind || "track",
        round: race.stage,
        heat: race.heat,
        direction: race.direction === "desc" ? "higher" : "lower",
        unit: race.unit || "s",
        starts_at: new Date(race.starts_at + "+07:00").toISOString(),
        venue: race.venue,
        referee_id: race.referee_id || null,
      };
      db.athletics_events.push(event);
      writes.push({
        table: "athletics_events",
        method: "POST",
        payload: [event],
      });
    }
    const existing = db.athletics_results.find(
      (r) =>
        r.id === race.id ||
        (r.event_id === event!.id &&
          r.school_id === athlete.school_id &&
          r.bib === athlete.bib),
    );
    const payload = {
      id: existing?.id || race.id,
      event_id: event.id,
      school_id: athlete.school_id,
      bib: athlete.bib,
      status: race.status,
      value: race.status === "OK" ? race.value : null,
    };
    if (existing) Object.assign(existing, payload);
    else db.athletics_results.push(payload);
    writes.push({
      table: "athletics_results",
      method: existing ? "PATCH" : "POST",
      payload: [payload],
    });
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/competitions", async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    const body = route.request().postDataJSON();
    if (body.action === "draw") {
      const competition = db.competitions.find((c) => c.id === body.id)!;
      const matchId = "60000000-0000-4000-8000-000000000001";
      const fixture = {
        id: matchId,
        round: "รอบชิงชนะเลิศ",
        home: body.teams[0],
        away: body.teams[1],
        startsAt: "",
        venue: "",
      };
      competition.registration_policy = {
        ...(competition.registration_policy as Row),
        management: {
          revision: 1,
          format: "knockout",
          teamLimit: 10,
          details: "",
          teams: body.teams,
          fixtures: [fixture],
        },
      };
    } else if (body.action === "schedule") {
      expect(body.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(body.venue.trim()).not.toBe("");
      const policy = db.competitions.find((c) => c.id === body.id)!
        .registration_policy as Row;
      const management = policy.management as { fixtures: Row[] } | undefined;
      const fixture = management?.fixtures.find((f) => f.id === body.fixtureId);
      if (fixture)
        Object.assign(fixture, { startsAt: body.startsAt, venue: body.venue });
      let match = db.matches.find((m) => m.id === body.fixtureId);
      if (!match) {
        expect(fixture).toBeDefined();
        match = {
          id: body.fixtureId,
          competition_id: body.id,
          group_name: fixture!.round,
          home_school_id: fixture!.home,
          away_school_id: fixture!.away,
          home_score: null,
          away_score: null,
          status: "scheduled",
          revision: -1,
          referee_id: null,
        };
        db.matches.push(match);
      }
      Object.assign(match, {
        starts_at: new Date(body.startsAt + "+07:00").toISOString(),
        venue: body.venue,
        revision: Number(match.revision) + 1,
      });
    } else if (body.action === "policy") {
      db.competitions.find((c) => c.id === body.id)!.registration_policy =
        body.policy;
    } else if (body.action !== "advance") {
      await route.fulfill({
        status: 400,
        json: { error: "Unsupported fixture action" },
      });
      return;
    }
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/school-account", async (route) => {
    const profile = db.profiles[0];
    const registration = (user.app_metadata as Row | undefined)
      ?.registration as Row | undefined;
    const account =
      profile?.role && profile.role !== "viewer"
        ? { status: "approved", role: profile.role }
        : {
            status: registration?.status || "pending",
            role: registration?.role || "referee",
            note: registration?.note,
          };
    await route.fulfill({
      json: {
        account,
        ...(route.request().method() === "POST"
          ? { session: sessionPayload() }
          : {}),
      },
    });
  });
  await page.route("**/auth/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/token"))
      await route.fulfill({ json: sessionPayload() });
    else if (url.pathname.endsWith("/logout"))
      await route.fulfill({ status: 204 });
    else await route.fulfill({ json: user });
  });
  await page.route("**/rest/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      table = url.pathname.split("/").pop()!;
    if (!(table in db)) {
      await route.fulfill({
        status: 404,
        json: { message: "Unknown table: " + table },
      });
      return;
    }
    if (control.fail && table === "medals") {
      await route.fulfill({
        status: 403,
        json: { message: "Fixture read denied" },
      });
      return;
    }
    if (
      req.method() !== "GET" &&
      ["matches", "athletics_events", "athletics_results"].includes(table)
    ) {
      await route.fulfill({
        status: 403,
        json: { message: "permission denied for table " + table },
      });
      return;
    }
    let rows = db[table];
    for (const [key, value] of url.searchParams)
      if (value.startsWith("eq."))
        rows = rows.filter((r) => String(r[key]) === value.slice(3));
    if (req.method() === "GET") {
      if (table === "schools" && control.readGate) await control.readGate;
      // A small server cap intentionally exercises paginated loading.
      const offset = Number(url.searchParams.get("offset") || 0),
        limit = Math.min(Number(url.searchParams.get("limit") || 500), 1);
      const result = rows.slice(offset, offset + limit);
      await route.fulfill({
        status: 200,
        json: result,
        headers: {
          "content-range": result.length
            ? `${offset}-${offset + result.length - 1}/${rows.length}`
            : `*/${rows.length}`,
        },
      });
      return;
    }
    if (req.method() === "POST" || req.method() === "PATCH") {
      const body = req.postDataJSON(),
        payload = (Array.isArray(body) ? body : [body]) as Row[];
      for (const p of payload)
        for (const k of Object.keys(p))
          expect(columns[table], `unexpected ${table}.${k}`).toContain(k);
      if (["matches", "athletics_events"].includes(table)) {
        for (const incoming of payload) {
          const merged = {
            ...(req.method() === "PATCH" ? rows[0] : {}),
            ...incoming,
          };
          expect(typeof merged.starts_at, `${table}.starts_at required`).toBe(
            "string",
          );
          expect(Number.isFinite(Date.parse(String(merged.starts_at)))).toBe(
            true,
          );
          expect(typeof merged.venue, `${table}.venue required`).toBe("string");
          expect(String(merged.venue).trim()).not.toBe("");
        }
      }
      writes.push({ table, method: req.method(), payload });
      if (req.method() === "POST")
        for (const row of payload)
          db[table].push({
            ...row,
            ...(table === "matches" ? { revision: 0 } : {}),
          });
      else for (const row of rows) Object.assign(row, body);
      await route.fulfill({
        status: 200,
        json: req.headers().prefer?.includes("return=representation")
          ? rows
          : [],
      });
      return;
    }
    await route.fulfill({
      status: 405,
      json: { message: "No fixture deletes" },
    });
  });
  return { db, writes, control, user };
}
export async function enter(page: Page) {
  await page.goto("/");
  await expect(
    page.getByText("Supabase · ข้อมูลจริง", { exact: true }),
  ).toBeVisible();
}
export async function login(page: Page, label = "ผู้ดูแลระบบ") {
  await page
    .getByRole("button", { name: "โรงเรียน / บัญชี", exact: true })
    .click();
  if (label === "ผู้ดูแลระบบ") {
    await page
      .getByRole("button", { name: "ผู้ดูแลระบบ (อีเมล)", exact: true })
      .click();
    await page
      .getByLabel("อีเมล", { exact: true })
      .fill("test@example.invalid");
  } else {
    await page.getByLabel("ชื่อบัญชี", { exact: true }).fill("fixture-user");
  }
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("fixture-only");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.locator(".role")).toContainText(label);
}
