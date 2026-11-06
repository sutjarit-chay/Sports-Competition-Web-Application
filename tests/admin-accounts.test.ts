import assert from "node:assert/strict";
import test from "node:test";
import { GET, PATCH } from "../app/api/admin-accounts/route";
import { withAuthFixture } from "./helpers/account-fixture";
const req = (token: string, body?: unknown) =>
  new Request("http://localhost/api/admin-accounts", {
    method: body ? "PATCH" : "GET",
    headers: { authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
test("directory excludes admins and pending accounts and returns only safe fields", async () => {
  await withAuthFixture(async (f) => {
    f.users.push({
      ...f.users[0],
      id: f.newId,
      email: "school.old@example.invalid",
      user_metadata: { full_name: "School", password: "secret" },
    });
    f.profiles.push({ id: f.newId, role: "school_admin", school_id: null });
    const r = await GET(req(f.token(f.adminId)));
    assert.equal(r.status, 200);
    const { accounts } = await r.json();
    assert.deepEqual(Object.keys(accounts[0]).sort(), [
      "displayName",
      "id",
      "role",
      "schoolId",
      "username",
    ]);
    assert.equal(accounts[0].username, "school.old");
  });
});
test("actual role denies forged admin metadata and admin targets", async () => {
  await withAuthFixture(async (f) => {
    f.users[0].app_metadata.role = "admin";
    f.profiles[0].role = "school";
    assert.equal(
      (
        await PATCH(
          req(f.token(f.adminId), {
            action: "password",
            userId: f.adminId,
            password: "new-password-123",
          }),
        )
      ).status,
      403,
    );
    assert.equal(f.writes.length, 0);
    f.profiles[0].role = "admin";
    assert.equal(
      (
        await PATCH(
          req(f.token(f.adminId), {
            action: "password",
            userId: f.adminId,
            password: "new-password-123",
          }),
        )
      ).status,
      403,
    );
    assert.equal(f.writes.length, 0);
  });
});
test("username changes only server alias, collisions fail and password update is never disclosed", async () => {
  await withAuthFixture(async (f) => {
    f.users.push({
      ...f.users[0],
      id: f.newId,
      email: "school.old@example.invalid",
      app_metadata: { keep: true },
    });
    f.profiles.push({ id: f.newId, role: "school_admin", school_id: null });
    const token = f.token(f.adminId);
    assert.equal(
      (
        await PATCH(
          req(token, {
            action: "username",
            userId: f.newId,
            username: "NEW.NAME",
          }),
        )
      ).status,
      200,
    );
    assert.equal(f.users[1].email, "school.old@example.invalid");
    assert.deepEqual(f.writes.at(-1)?.body, {
      app_metadata: { keep: true, login_username: "new.name" },
    });
    const r = await PATCH(
      req(token, {
        action: "password",
        userId: f.newId,
        password: "new-password-123",
      }),
    );
    assert.equal(r.status, 200);
    assert.deepEqual(f.writes.at(-1)?.body, { password: "new-password-123" });
    assert.ok(!(await r.text()).includes("new-password"));
  });
});
test("colliding alias and invalid passwords are refused without writes", async () => {
  await withAuthFixture(async (f) => {
    f.users.push({
      ...f.users[0],
      id: f.newId,
      email: "school.old@example.invalid",
      app_metadata: {},
    });
    f.users.push({
      ...f.users[0],
      id: "40000000-0000-4000-8000-000000000001",
      email: "taken@example.invalid",
      app_metadata: { login_username: "taken" },
    });
    f.profiles.push({ id: f.newId, role: "school_admin", school_id: null });
    const token = f.token(f.adminId);
    assert.equal(
      (
        await PATCH(
          req(token, {
            action: "username",
            userId: f.newId,
            username: "taken",
          }),
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await PATCH(
          req(token, {
            action: "password",
            userId: f.newId,
            password: "short",
          }),
        )
      ).status,
      400,
    );
    assert.equal(f.writes.length, 0);
  });
});
test("school assignment compares old school and never changes role", async () => {
  await withAuthFixture(async (f) => {
    const oldSchool = "30000000-0000-4000-8000-000000000001",
      schoolId = "40000000-0000-4000-8000-000000000001";
    f.users.push({
      ...f.users[0],
      id: f.newId,
      email: "school.old@example.invalid",
    });
    f.profiles.push({
      id: f.newId,
      role: "school_admin",
      school_id: oldSchool,
    });
    const fetch = globalThis.fetch;
    globalThis.fetch = async (input, init) =>
      new URL(String(input)).pathname === "/rest/v1/schools"
        ? Response.json({ id: schoolId })
        : fetch(input, init);
    const token = f.token(f.adminId);
    assert.equal(
      (
        await PATCH(
          req(token, {
            action: "school",
            userId: f.newId,
            schoolId,
            expectedSchoolId: null,
          }),
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await PATCH(
          req(token, {
            action: "school",
            userId: f.newId,
            schoolId,
            expectedSchoolId: oldSchool,
            role: "admin",
          }),
        )
      ).status,
      200,
    );
    assert.deepEqual(f.profiles[1], {
      id: f.newId,
      role: "school_admin",
      school_id: schoolId,
    });
    assert.deepEqual(f.writes.at(-1)?.body, { school_id: schoolId });
  });
});
test("directory follows all Auth pages", async () => {
  await withAuthFixture(async (f) => {
    for (let i = 0; i < 105; i++) {
      const id = `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
      f.users.push({ ...f.users[0], id, email: `school${i}@example.invalid` });
      f.profiles.push({ id, role: "school_admin", school_id: null });
    }
    const r = await GET(req(f.token(f.adminId)));
    assert.equal((await r.json()).accounts.length, 105);
  });
});
test("concurrent alias claims have exactly one owner and historical aliases cannot be reused", async () => {
  await withAuthFixture(async (f) => {
    const other = "40000000-0000-4000-8000-000000000001";
    for (const [id, email] of [
      [f.newId, "first@example.invalid"],
      [other, "second@example.invalid"],
    ]) {
      f.users.push({ ...f.users[0], id, email, app_metadata: {} });
      f.profiles.push({ id, role: "school_admin", school_id: null });
    }
    const token = f.token(f.adminId);
    const responses = await Promise.all(
      [f.newId, other].map((userId) =>
        PATCH(
          req(token, { action: "username", userId, username: "same.claim" }),
        ),
      ),
    );
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
    const winner = responses[0].status === 200 ? f.newId : other;
    const loser = winner === f.newId ? other : f.newId;
    assert.equal(
      (
        await PATCH(
          req(token, {
            action: "username",
            userId: winner,
            username: "new.claim",
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await PATCH(
          req(token, {
            action: "username",
            userId: loser,
            username: "same.claim",
          }),
        )
      ).status,
      409,
    );
  });
});
