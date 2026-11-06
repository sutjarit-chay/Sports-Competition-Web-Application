import assert from "node:assert/strict";
import test from "node:test";
import { POST as signup } from "../app/api/school-account/route";
import { GET, POST } from "../app/api/account-requests/route";
import { withAuthFixture } from "./helpers/account-fixture";
const registration = (role: string) =>
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
const review = (
  token: string,
  kind: string,
  id: string,
  decision = "approved",
) =>
  new Request("http://localhost/api/account-requests", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ kind, id, decision, role: "admin" }),
  });

test("pending applicants cannot read the approval queue or approve themselves", async () => {
  await withAuthFixture(async (f) => {
    await signup(registration("referee"));
    const before = f.writes.length;
    const res = await POST(review(f.token(f.newId), "referee", f.newId));
    assert.equal(res.status, 403);
    assert.equal(f.profiles.length, 1);
    assert.equal(f.writes.length, before);
    assert.equal(
      (
        await GET(
          new Request("http://localhost/api/account-requests", {
            headers: { authorization: `Bearer ${f.token(f.newId)}` },
          }),
        )
      ).status,
      403,
    );
  });
});
test("admin approval grants the production referee role despite an admin role in editable metadata and cannot approve twice", async () => {
  await withAuthFixture(async (f) => {
    await signup(registration("referee"));
    f.users[1].user_metadata = {
      role: "admin",
      registration: { role: "admin", status: "approved" },
    };
    assert.equal(
      (await POST(review(f.token(f.adminId), "referee", f.newId))).status,
      200,
    );
    assert.deepEqual(
      f.profiles.find((p) => p.id === f.newId),
      { id: f.newId, role: "referee", school_id: null },
    );
    assert.equal(f.users[1].app_metadata.registration.status, "approved");
    assert.equal(
      (await POST(review(f.token(f.adminId), "referee", f.newId))).status,
      409,
    );
    assert.equal(f.profiles.length, 2);
  });
});
test("rejecting a referee leaves it without a working profile and returns the reason", async () => {
  await withAuthFixture(async (f) => {
    await signup(registration("referee"));
    const request = new Request("http://localhost/api/account-requests", {
      method: "POST",
      headers: {
        authorization: `Bearer ${f.token(f.adminId)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        kind: "referee",
        id: f.newId,
        decision: "rejected",
        note: "กรุณาติดต่อผู้จัด",
      }),
    });
    assert.equal((await POST(request)).status, 200);
    assert.equal(f.profiles.length, 1);
    const login = await signup(
      new Request("http://localhost/api/school-account", {
        method: "POST",
        body: JSON.stringify({
          mode: "login",
          username: "referee01",
          password: "test-password-123",
        }),
      }),
    );
    assert.equal((await login.json()).account.status, "rejected");
    assert.equal(
      f.users[1].app_metadata.registration.note,
      "กรุณาติดต่อผู้จัด",
    );
  });
});
test("school approval uses the existing transactional review RPC", async () => {
  await withAuthFixture(async (f) => {
    await signup(registration("school"));
    assert.equal(
      (await POST(review(f.token(f.adminId), "school", f.requests[0].id)))
        .status,
      200,
    );
    assert.equal(f.schools.length, 1);
    assert.equal(
      f.profiles.find((p) => p.id === f.newId)?.role,
      "school_admin",
    );
    assert.equal(
      f.writes.filter((w) => w.path.endsWith("/rpc/review_school_registration"))
        .length,
      1,
    );
  });
});
test("approval queue paginates Auth users and ignores editable user metadata", async () => {
  await withAuthFixture(async (f) => {
    for (let i = 0; i < 110; i++)
      f.users.push({
        id: `unrelated-${i}`,
        email: `other${i}@example.invalid`,
        app_metadata: {},
        user_metadata: { registration: { role: "referee", status: "pending" } },
      });
    await signup(registration("referee"));
    const res = await GET(
      new Request("http://localhost/api/account-requests", {
        headers: { authorization: `Bearer ${f.token(f.adminId)}` },
      }),
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.requests.length, 1);
    assert.equal(data.requests[0].id, f.newId);
    assert.equal(data.requests[0].kind, "referee");
  });
});

test("concurrent approve and reject accept only one referee decision", async () => {
  await withAuthFixture(async (f) => {
    await signup(registration("referee"));
    const originalFetch = globalThis.fetch;
    let arrived = 0,
      release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      const response = await originalFetch(input, init);
      if (
        (init?.method || "GET") === "GET" &&
        url.pathname.endsWith("/profiles") &&
        url.searchParams.get("id") === `eq.${f.newId}`
      ) {
        arrived++;
        if (arrived === 2) release();
        await gate;
      }
      return response;
    };
    const responses = await Promise.all([
      POST(review(f.token(f.adminId), "referee", f.newId, "approved")),
      POST(review(f.token(f.adminId), "referee", f.newId, "rejected")),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
    const successful = responses.find((r) => r.status === 200)!;
    const decision = (await successful.json()).status;
    if (decision === "approved")
      assert.equal(f.profiles.find((p) => p.id === f.newId)?.role, "referee");
    else
      assert.equal(
        f.profiles.find((p) => p.id === f.newId),
        undefined,
      );
    assert.equal(f.users[1].app_metadata.registration.status, decision);
  });
});

test("a failed referee profile insert restores the request without granting access", async () => {
  await withAuthFixture(async (f) => {
    await signup(registration("referee"));
    const original = globalThis.fetch;
    globalThis.fetch = async (input, init) =>
      String(input).includes("/rest/v1/profiles") && init?.method === "POST"
        ? new Response(
            JSON.stringify({ code: "23514", message: "role constraint" }),
            { status: 400, headers: { "content-type": "application/json" } },
          )
        : original(input, init);
    assert.equal(
      (await POST(review(f.token(f.adminId), "referee", f.newId))).status,
      409,
    );
    assert.equal(f.profiles.length, 1);
    assert.equal(f.requests[0].status, "pending");
    assert.equal(f.requests[0].reviewed_at, null);
    assert.equal(f.users[1].app_metadata.registration.status, "pending");
  });
});
test("a partially completed approval can resume the same decision without duplicating profiles", async () => {
  await withAuthFixture(async (f) => {
    await signup(registration("referee"));
    const original = globalThis.fetch;
    let fail = true;
    globalThis.fetch = async (input, init) => {
      if (
        fail &&
        String(input).includes(`/auth/v1/admin/users/${f.newId}`) &&
        init?.method === "PUT"
      ) {
        fail = false;
        return new Response(
          JSON.stringify({ message: "temporary metadata failure" }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      }
      return original(input, init);
    };
    assert.equal(
      (await POST(review(f.token(f.adminId), "referee", f.newId))).status,
      503,
    );
    assert.equal(f.profiles.find((p) => p.id === f.newId)?.role, "referee");
    assert.equal(
      (await POST(review(f.token(f.adminId), "referee", f.newId, "rejected")))
        .status,
      409,
    );
    assert.equal(
      (await POST(review(f.token(f.adminId), "referee", f.newId))).status,
      409,
    );
    f.requests[0].reviewed_at = new Date(Date.now() - 121_000).toISOString();
    assert.equal(
      (await POST(review(f.token(f.adminId), "referee", f.newId))).status,
      200,
    );
    assert.equal(f.profiles.length, 2);
    assert.equal(f.requests[0].status, "approved");
    assert.equal(f.users[1].app_metadata.registration.status, "approved");
  });
});
test("a referee request cannot be approved as a school by changing its kind", async () => {
  await withAuthFixture(async (f) => {
    await signup(registration("referee"));
    const result = await POST(
      review(f.token(f.adminId), "school", f.requests[0].id),
    );
    assert.equal(result.status, 400);
    assert.equal(f.profiles.length, 1);
    assert.equal(f.schools.length, 0);
  });
});

test("an applicant cannot reset an in-progress referee decision through the existing resubmit RPC", async () => {
  await withAuthFixture(async (f) => {
    await signup(registration("referee"));
    const original = globalThis.fetch;
    let attempted = false;
    let resubmitStatus = 0;
    globalThis.fetch = async (input, init) => {
      const response = await original(input, init);
      if (
        !attempted &&
        String(input).includes("/rest/v1/school_registration_requests") &&
        init?.method === "PATCH" &&
        String(init.body).includes("referee-review-v1")
      ) {
        attempted = true;
        const replay = await original(
          "https://fixture.invalid/rest/v1/rpc/resubmit_school_registration",
          {
            method: "POST",
            headers: { authorization: `Bearer ${f.token(f.newId)}` },
            body: JSON.stringify({
              p_school_name: "retry",
              p_contact_name: "retry",
            }),
          },
        );
        resubmitStatus = replay.status;
      }
      return response;
    };
    const res = await POST(review(f.token(f.adminId), "referee", f.newId));
    assert.equal(resubmitStatus, 400);
    assert.equal(res.status, 200);
    assert.equal(f.requests[0].status, "approved");
  });
});
