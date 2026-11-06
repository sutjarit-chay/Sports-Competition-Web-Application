import assert from "node:assert/strict";
import test from "node:test";
import {
  GET as profileGet,
  PUT as profilePut,
} from "../app/api/school-profile/route";
import { GET as coachesGet, PUT as coachesPut } from "../app/api/coaches/route";
import { GET as logoGet } from "../app/api/school-profile/logo/route";
import { PATCH as renameSchool } from "../app/api/schools/route";
import { safeLogo } from "../lib/school-storage";
const school = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  competition = "33333333-3333-4333-8333-333333333333",
  second = "44444444-4444-4444-8444-444444444444";
const profile = {
  shortName: "ทดสอบ",
  schoolType: "ขนาดเล็ก",
  logo: "",
  contactName: "Private contact",
  contactPhone: "0812345678",
  address: "Private address",
};
async function fixture(
  work: (f: {
    files: Map<string, string>;
    setRole: (role: string) => void;
    writes: string[];
    synchronizeLists: () => void;
  }) => Promise<void>,
) {
  const previousFetch = globalThis.fetch,
    saved = { ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://school-fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  const files = new Map<string, string>(),
    writes: string[] = [];
  let role = "school";
  let listBarrier: {
    count: number;
    promise: Promise<void>;
    release: () => void;
  } | null = null;
  let canonicalName = "Original school";
  globalThis.fetch = async (input, init) => {
    const req =
        input instanceof Request ? input : new Request(String(input), init),
      url = new URL(req.url);
    const json = (value: unknown, status = 200) =>
      Response.json(value, { status });
    if (url.pathname === "/auth/v1/user") {
      if (req.headers.get("authorization") !== "Bearer valid")
        return json({}, 401);
      return json({ id: "user", aud: "authenticated", role: "authenticated" });
    }
    if (url.pathname === "/rest/v1/profiles")
      return json({ id: "user", role, school_id: school });
    if (url.pathname === "/rest/v1/schools") {
      if (req.method === "PATCH") {
        assert.equal(req.headers.get("authorization"), "Bearer service");
        const body = await req.json();
        assert.deepEqual(Object.keys(body), ["name"]);
        if (
          url.searchParams.get("id") !== `eq.${school}` ||
          url.searchParams.get("name") !== `eq.${canonicalName}`
        )
          return json([]);
        canonicalName = body.name;
        writes.push("schools:name");
        return json([{ id: school, name: canonicalName }]);
      }
      if (url.searchParams.has("name"))
        return json(
          url.searchParams.get("name") === "eq.Duplicate school"
            ? [{ id: other }]
            : [],
        );
      return json(
        url.searchParams.has("id")
          ? { id: url.searchParams.get("id")!.slice(3), name: canonicalName }
          : [{ id: school }, { id: other }],
      );
    }
    if (url.pathname === "/rest/v1/competitions")
      return json({ id: competition });
    if (url.pathname === "/storage/v1/object/list/team-files") {
      const body = await req.json();
      const matching = [...files.keys()]
        .filter((key) => key.startsWith(body.prefix + "/"))
        .reverse();
      const barrier = listBarrier;
      if (barrier) {
        barrier.count++;
        if (barrier.count === 2) {
          listBarrier = null;
          barrier.release();
        }
        await barrier.promise;
      }
      return json(
        matching.slice(0, body.limit).map((key) => ({
          name: key.split("/").at(-1),
          created_at: new Date().toISOString(),
        })),
      );
    }
    const match =
      /^\/storage\/v1\/object\/(?:authenticated\/)?team-files\/(.+)$/.exec(
        url.pathname,
      );
    if (match) {
      assert.equal(req.headers.get("authorization"), "Bearer service");
      if (req.method === "GET")
        return files.has(match[1])
          ? new Response(files.get(match[1]), {
              headers: { "Content-Type": "application/json" },
            })
          : json({}, 404);
      assert.equal(req.method, "POST");
      const content = await req.text();
      if (files.has(match[1]))
        return json(
          {
            statusCode: "409",
            error: "Duplicate",
            message: "The resource already exists",
          },
          409,
        );
      files.set(match[1], content);
      writes.push(match[1]);
      return json({ Key: match[1] });
    }
    throw Error(`Unexpected SDK request ${req.method} ${url.pathname}`);
  };
  try {
    await work({
      files,
      writes,
      synchronizeLists: () => {
        let release!: () => void;
        const promise = new Promise<void>((resolve) => {
          release = resolve;
        });
        listBarrier = { count: 0, promise, release };
      },
      setRole: (value) => {
        role = value;
      },
    });
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}
function request(path: string, body?: unknown, token = "valid") {
  return new Request(`http://localhost/api/${path}`, {
    method: body ? "PUT" : "GET",
    headers: token
      ? { authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
test("profile persists through SDK HTTP storage and a fresh read; public projection excludes contacts", async () =>
  fixture(async (f) => {
    const saved = await profilePut(
      request("school-profile", {
        schoolId: school,
        expectedVersion: null,
        profile,
      }),
    );
    assert.equal(saved.status, 200);
    const version = (await saved.json()).version;
    assert.ok(version);
    const loaded = await profileGet(
      request(`school-profile?schoolId=${school}`),
    );
    assert.deepEqual(await loaded.json(), { profile, version });
    const projected = await profileGet(
      request("school-profile?public=1", undefined, ""),
    );
    assert.equal(projected.status, 200);
    const raw = await projected.text();
    assert.ok(raw.includes("ทดสอบ"));
    assert.ok(!raw.includes("Private"));
    assert.ok(!raw.includes("0812345678"));
    assert.equal(f.writes.length, 1);
    assert.equal(
      (
        await profilePut(
          request("school-profile", {
            schoolId: school,
            expectedVersion: null,
            profile,
          }),
        )
      ).status,
      409,
    );
    assert.equal(f.writes.length, 1);
  }));
test("private school data rejects unauthenticated, cross-school, viewer and referee access before storage", async () =>
  fixture(async (f) => {
    assert.equal(
      (
        await profileGet(
          request(`school-profile?schoolId=${school}`, undefined, ""),
        )
      ).status,
      401,
    );
    assert.equal(
      (await profileGet(request(`school-profile?schoolId=${other}`))).status,
      403,
    );
    for (const role of ["viewer", "referee", "recorder"]) {
      f.setRole(role);
      assert.equal(
        (
          await profilePut(
            request("school-profile", {
              schoolId: school,
              expectedVersion: null,
              profile,
            }),
          )
        ).status,
        403,
      );
    }
    assert.equal(f.files.size, 0);
    f.setRole("admin");
    assert.equal(
      (await profileGet(request(`school-profile?schoolId=${other}`))).status,
      200,
    );
  }));
test("coaches persist with competition isolation and reject cross-school rows and stale clients", async () =>
  fixture(async (f) => {
    const coaches = [
      {
        id: "55555555-5555-4555-8555-555555555555",
        school_id: school,
        competition_id: competition,
        name: "Coach",
        title: "Trainer",
        phone: "0812345678",
      },
    ];
    const saved = await coachesPut(
      request("coaches", {
        schoolId: school,
        competitionId: competition,
        expectedVersion: null,
        coaches,
      }),
    );
    assert.equal(saved.status, 200);
    const version = (await saved.json()).version;
    assert.deepEqual(
      await (
        await coachesGet(
          request(`coaches?schoolId=${school}&competitionId=${competition}`),
        )
      ).json(),
      { coaches, version },
    );
    assert.deepEqual(
      await (
        await coachesGet(
          request(`coaches?schoolId=${school}&competitionId=${second}`),
        )
      ).json(),
      { coaches: [], version: null },
    );
    assert.equal(
      (
        await coachesPut(
          request("coaches", {
            schoolId: school,
            competitionId: competition,
            expectedVersion: null,
            coaches,
          }),
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await coachesPut(
          request("coaches", {
            schoolId: school,
            competitionId: competition,
            expectedVersion: version,
            coaches: [{ ...coaches[0], school_id: other }],
          }),
        )
      ).status,
      403,
    );
    assert.equal(f.writes.length, 1);
  }));
test("logo validation rejects SVG, mislabeled payloads, malformed UUIDs and excess size", async () =>
  fixture(async () => {
    for (const logo of [
      "data:image/svg+xml;base64,PHN2Zz4=",
      "data:image/png;base64,PHNjcmlwdD4=",
      "https://evil.invalid/logo.png",
    ])
      assert.equal(
        (
          await profilePut(
            request("school-profile", {
              schoolId: school,
              expectedVersion: null,
              profile: { ...profile, logo },
            }),
          )
        ).status,
        400,
      );
    assert.throws(() =>
      safeLogo(
        `data:image/png;base64,${Buffer.alloc(1_000_001).toString("base64")}`,
      ),
    );
    assert.equal(
      (await logoGet(request("school-profile/logo?schoolId=../../private")))
        .status,
      400,
    );
    assert.equal(
      (await logoGet(request(`school-profile/logo?schoolId=${school}`))).status,
      404,
    );
  }));

test("versioned profile edits retain all history and safe logos are served without exposing private JSON", async () =>
  fixture(async (f) => {
    const logo =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFwoAAAAASUVORK5CYII=";
    const first = await profilePut(
      request("school-profile", {
        schoolId: school,
        expectedVersion: null,
        profile: { ...profile, logo },
      }),
    );
    assert.equal(first.status, 200);
    const initial = await first.json();
    const served = await logoGet(
      request(`school-profile/logo?schoolId=${school}`),
    );
    assert.equal(served.status, 200);
    assert.equal(served.headers.get("Content-Type"), "image/png");
    assert.equal(served.headers.get("X-Content-Type-Options"), "nosniff");
    assert.deepEqual(
      Buffer.from(await served.arrayBuffer()),
      Buffer.from(logo.split(",")[1], "base64"),
    );
    const update = await profilePut(
      request("school-profile", {
        schoolId: school,
        expectedVersion: initial.version,
        profile: { ...profile, logo, shortName: "Updated" },
      }),
    );
    assert.equal(update.status, 200);
    assert.equal(f.files.size, 2);
    assert.equal(
      (
        await (
          await profileGet(request(`school-profile?schoolId=${school}`))
        ).json()
      ).profile.shortName,
      "Updated",
    );
  }));

test("school rename denies cross-school and stale edits and only updates canonical name", async () =>
  fixture(async (f) => {
    const rename = (body: unknown, token = "valid") =>
      renameSchool(
        new Request("http://localhost/api/schools", {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }),
      );
    assert.equal(
      (
        await rename({
          schoolId: other,
          name: "New school",
          expectedName: "Original school",
        })
      ).status,
      403,
    );
    f.setRole("viewer");
    assert.equal(
      (
        await rename({
          schoolId: school,
          name: "New school",
          expectedName: "Original school",
        })
      ).status,
      403,
    );
    f.setRole("school_admin");
    assert.equal(
      (
        await rename({
          schoolId: school,
          name: "New school",
          expectedName: "Old school",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await rename({
          schoolId: school,
          name: "Duplicate school",
          expectedName: "Original school",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await rename({
          schoolId: school,
          name: " ",
          expectedName: "Original school",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await rename({
          schoolId: school,
          name: "x".repeat(201),
          expectedName: "Original school",
        })
      ).status,
      400,
    );
    assert.equal(f.writes.length, 0);
    const result = await rename({
      schoolId: school,
      name: "  New school  ",
      expectedName: "Original school",
    });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), {
      school: { id: school, name: "New school" },
    });
    assert.equal(
      (
        await rename({
          schoolId: school,
          name: "Another school",
          expectedName: "Original school",
        })
      ).status,
      409,
    );
    assert.deepEqual(f.writes, ["schools:name"]);
  }));

test("concurrent profile and coach writers from the same version have exactly one immutable successor", async () =>
  fixture(async (f) => {
    f.synchronizeLists();
    const profileWrites = await Promise.all(
      ["Writer A", "Writer B"].map((shortName) =>
        profilePut(
          request("school-profile", {
            schoolId: school,
            expectedVersion: null,
            profile: { ...profile, shortName },
          }),
        ),
      ),
    );
    assert.deepEqual(profileWrites.map((r) => r.status).sort(), [200, 409]);
    assert.equal(f.files.size, 1);
    const winner = await profileWrites.find((r) => r.status === 200)!.json();
    f.synchronizeLists();
    const successors = await Promise.all(
      ["Writer C", "Writer D"].map((shortName) =>
        profilePut(
          request("school-profile", {
            schoolId: school,
            expectedVersion: winner.version,
            profile: { ...profile, shortName },
          }),
        ),
      ),
    );
    assert.deepEqual(successors.map((r) => r.status).sort(), [200, 409]);
    assert.equal(f.files.size, 2);
    const loaded = await (
      await profileGet(request(`school-profile?schoolId=${school}`))
    ).json();
    assert.equal(
      loaded.profile.shortName,
      (await successors.find((r) => r.status === 200)!.json()).profile
        .shortName,
    );
    f.synchronizeLists();
    const coachWrites = await Promise.all(
      ["Coach A", "Coach B"].map((name) =>
        coachesPut(
          request("coaches", {
            schoolId: school,
            competitionId: competition,
            expectedVersion: null,
            coaches: [
              {
                id: "55555555-5555-4555-8555-555555555555",
                school_id: school,
                competition_id: competition,
                name,
                title: "Trainer",
                phone: "",
              },
            ],
          }),
        ),
      ),
    );
    assert.deepEqual(coachWrites.map((r) => r.status).sort(), [200, 409]);
    assert.equal(f.files.size, 3);
  }));
