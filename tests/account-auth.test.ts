import assert from "node:assert/strict";
import test from "node:test";
import { POST, GET } from "../app/api/school-account/route";
import { withAuthFixture } from "./helpers/account-fixture";
export const signup = (role: string) =>
  new Request("http://localhost/api/school-account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "register",
      role,
      username: "referee01",
      password: "test-password-123",
      fullName: "ผู้ทดสอบ",
      schoolName: "โรงเรียนทดสอบ",
      phone: "0812345678",
    }),
  });

test("public signup refuses admin role before creating an Auth user", async () => {
  await withAuthFixture(async (f) => {
    const res = await POST(signup("admin"));
    assert.equal(res.status, 400);
    assert.equal(f.users.length, 1);
  });
});
test("referee signup stores a pending server-managed request without granting a profile", async () => {
  await withAuthFixture(async (f) => {
    const res = await POST(signup("referee"));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.account.status, "pending");
    assert.equal(f.profiles.length, 1);
    assert.equal(f.users[1].app_metadata.registration.role, "referee");
    assert.equal(f.users[1].app_metadata.registration.status, "pending");
    assert.ok(
      !JSON.stringify(f.users[1].app_metadata).includes("test-password-123"),
    );
    assert.equal(f.requests.length, 1);
  });
});
test("school signup creates a pending request using the user's own session", async () => {
  await withAuthFixture(async (f) => {
    const res = await POST(signup("school"));
    assert.equal(res.status, 200);
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0].user_id, f.newId);
    assert.equal(f.requests[0].school_name, "โรงเรียนทดสอบ");
    assert.equal(f.profiles.length, 1);
    assert.equal((await res.json()).account.status, "pending");
  });
});

test("existing approved school email accounts can log in with only their old email prefix", async () => {
  await withAuthFixture(async (f) => {
    f.users.push({
      id: f.newId,
      email: "school.old@example.invalid",
      aud: "authenticated",
      created_at: "2026-11-06T00:00:00Z",
      app_metadata: {},
      user_metadata: {},
    });
    f.profiles.push({
      id: f.newId,
      role: "school_admin",
      school_id: "school-existing",
    });
    const res = await POST(
      new Request("http://localhost/api/school-account", {
        method: "POST",
        body: JSON.stringify({
          mode: "login",
          username: "school.old",
          password: "test-password-123",
        }),
      }),
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).account.role, "school_admin");
    assert.equal(f.users[1].email, "school.old@example.invalid");
    assert.equal(
      f.writes.filter(
        (w) => w.path.startsWith("/auth/v1/admin/users") && w.method !== "GET",
      ).length,
      0,
    );
  });
});

test("legacy passwords shorter than the new signup minimum still authenticate", async () => {
  await withAuthFixture(async (f) => {
    const email = "school.old@example.invalid";
    f.users.push({
      id: f.newId,
      email,
      aud: "authenticated",
      created_at: "2026-11-06T00:00:00Z",
      app_metadata: {},
      user_metadata: {},
    });
    f.profiles.push({
      id: f.newId,
      role: "school_admin",
      school_id: "old-school",
    });
    f.passwords.set(email, "old12345");
    const res = await POST(
      new Request("http://localhost/api/school-account", {
        method: "POST",
        body: JSON.stringify({
          mode: "login",
          username: "school.old",
          password: "old12345",
        }),
      }),
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).account.status, "approved");
  });
});
test("ambiguous legacy usernames never choose the first matching account", async () => {
  await withAuthFixture(async (f) => {
    for (const [i, email] of [
      "school.old@one.invalid",
      "school.old@two.invalid",
    ].entries()) {
      const id = `20000000-0000-4000-8000-00000000000${i + 1}`;
      f.users.push({ id, email, app_metadata: {}, user_metadata: {} });
      f.profiles.push({ id, role: "school_admin", school_id: `school-${i}` });
    }
    const res = await POST(
      new Request("http://localhost/api/school-account", {
        method: "POST",
        body: JSON.stringify({
          mode: "login",
          username: "school.old",
          password: "test-password-123",
        }),
      }),
    );
    assert.equal(res.status, 401);
    assert.equal(f.writes.filter((w) => w.path === "/auth/v1/token").length, 0);
  });
});
test("signup cannot shadow an existing school's legacy username", async () => {
  await withAuthFixture(async (f) => {
    f.users.push({
      id: f.newId,
      email: "referee01@old.invalid",
      app_metadata: {},
      user_metadata: {},
    });
    f.profiles.push({
      id: f.newId,
      role: "school_admin",
      school_id: "old-school",
    });
    const res = await POST(signup("referee"));
    assert.equal(res.status, 409);
    assert.equal(f.users.length, 2);
  });
});
test("editable user metadata cannot turn a pending request into approved access", async () => {
  await withAuthFixture(async (f) => {
    await POST(signup("referee"));
    f.users[1].user_metadata = {
      username: "referee01",
      role: "admin",
      registration: { status: "approved", role: "admin" },
    };
    const res = await GET(
      new Request("http://localhost/api/school-account", {
        headers: { authorization: `Bearer ${f.token(f.newId)}` },
      }),
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).account.status, "pending");
    assert.equal(f.profiles.length, 1);
  });
});
test("signup does not expose a session and oversized JSON is rejected before Auth writes", async () => {
  await withAuthFixture(async (f) => {
    const res = await POST(signup("referee"));
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.ok(!("session" in (await res.json())));
    const before = f.writes.length;
    const large = await POST(
      new Request("http://localhost/api/school-account", {
        method: "POST",
        body: "x".repeat(4097),
      }),
    );
    assert.equal(large.status, 413);
    assert.equal(f.writes.length, before);
  });
});
