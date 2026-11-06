import assert from "node:assert/strict";
import test from "node:test";
import { GET, DELETE } from "../app/api/admin-schools/route";
import { withAuthFixture } from "./helpers/account-fixture";
const id = "30000000-0000-4000-8000-000000000001";
test("school preview blocks JSON, SQL and private document dependencies; deletion requires unchanged typed preview", async () => {
  await withAuthFixture(async (f) => {
    const original = globalThis.fetch;
    const rows: Record<string, any[]> = {
      schools: [{ id, name: "School" }],
      profiles: [],
      registrations: [],
      matches: [],
      athletics_results: [],
      medals: [],
      team_files: [],
      competitions: [],
    };
    let privateFiles: any[] = [];
    let documentFolder = "school-profiles";
    let deletes = 0;
    globalThis.fetch = async (input, init) => {
      const u = new URL(String(input));
      if (
        u.pathname.includes("/auth/") ||
        (u.pathname === "/rest/v1/profiles" &&
          u.searchParams.get("id") === `eq.${f.adminId}`)
      )
        return original(input, init);
      if (u.pathname.includes("competition-reset/claim.json"))
        return Response.json(
          { statusCode: "404", message: "Object not found" },
          { status: 404 },
        );
      if (u.pathname.startsWith("/storage/")) {
        const prefix = JSON.parse(String(init?.body)).prefix;
        return Response.json(
          !privateFiles.length
            ? []
            : prefix === ""
              ? [{ name: documentFolder, id: null }]
              : prefix === documentFolder
                ? [{ name: id, id: null }]
                : privateFiles,
        );
      }
      const table = u.pathname.split("/").pop()!;
      assert.ok(table in rows, table);
      if (init?.method === "DELETE") {
        deletes++;
        return Response.json(rows.schools);
      }
      let data = rows[table];
      if (table === "schools") return Response.json(data[0]);
      const offset = Number(u.searchParams.get("offset") || 0);
      return Response.json(data.slice(offset, offset + 500));
    };
    const request = (body?: unknown) =>
      new Request(`http://localhost/api/admin-schools?schoolId=${id}`, {
        method: body ? "DELETE" : "GET",
        headers: { authorization: `Bearer ${f.token(f.adminId)}` },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const preview = async () => {
      const r = await GET(request());
      assert.equal(r.status, 200);
      return (await r.json()).preview;
    };
    let p = await preview();
    assert.equal(p.canDelete, true);
    rows.competitions.push({
      id: "competition",
      registration_policy: { management: { teams: [id], fixtures: [] } },
    });
    p = await preview();
    assert.equal(p.canDelete, false);
    assert.ok(p.dependencies.management > 0);
    assert.equal(
      (
        await DELETE(
          request({
            schoolId: id,
            confirmation: "School",
            fingerprint: p.fingerprint,
          }),
        )
      ).status,
      409,
    );
    assert.equal(deletes, 0);
    rows.competitions = [];
    privateFiles = [{ name: "version.json", id: "object" }];
    p = await preview();
    assert.equal(p.canDelete, true);
    assert.equal(p.retainedProfileFiles, 1);
    documentFolder = "school-coaches";
    p = await preview();
    assert.equal(p.canDelete, false);
    documentFolder = "school-profiles";
    privateFiles = [];
    p = await preview();
    assert.equal(
      (
        await DELETE(
          request({
            schoolId: id,
            confirmation: "Wrong",
            fingerprint: p.fingerprint,
          }),
        )
      ).status,
      400,
    );
    rows.registrations = Array.from({ length: 1001 }, (_, i) => ({
      id: `unrelated-${i}`,
      school_id: "other",
    }));
    rows.registrations.push({ id: "new", school_id: id });
    assert.equal(
      (
        await DELETE(
          request({
            schoolId: id,
            confirmation: "School",
            fingerprint: p.fingerprint,
          }),
        )
      ).status,
      409,
    );
    assert.equal(deletes, 0);
    rows.registrations = [];
    privateFiles = [{ name: "version.json", id: "object" }];
    p = await preview();
    const deleted = await DELETE(
      request({
        schoolId: id,
        confirmation: "School",
        fingerprint: p.fingerprint,
      }),
    );
    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), {
      ok: true,
      retainedProfileFiles: 1,
    });
    assert.equal(
      privateFiles.length,
      1,
      "profile history is retained privately",
    );
    assert.equal(deletes, 1);
  });
});
test("school endpoints deny non-admin profiles before service access", async () => {
  await withAuthFixture(async (f) => {
    f.profiles[0].role = "school_admin";
    f.users[0].app_metadata.role = "admin";
    const headers = { authorization: `Bearer ${f.token(f.adminId)}` };
    assert.equal(
      (
        await GET(
          new Request(`http://localhost/api/admin-schools?schoolId=${id}`, {
            headers,
          }),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await DELETE(
          new Request("http://localhost/api/admin-schools", {
            method: "DELETE",
            headers,
            body: JSON.stringify({ schoolId: id }),
          }),
        )
      ).status,
      403,
    );
    assert.equal(f.writes.length, 0);
  });
});
