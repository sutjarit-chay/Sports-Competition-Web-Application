import assert from "node:assert/strict";
const adminId = "10000000-0000-4000-8000-000000000001";
const newId = "20000000-0000-4000-8000-000000000001";
type Row = Record<string, any>;
export async function withAuthFixture(
  work: (fixture: ReturnType<typeof authFixture>) => Promise<void>,
) {
  const fixture = authFixture();
  const previousFetch = globalThis.fetch;
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const;
  const previous = keys.map((k) => process.env[k]);
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-public";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-only";
  globalThis.fetch = fixture.fetch;
  try {
    await work(fixture);
  } finally {
    globalThis.fetch = previousFetch;
    keys.forEach((k, i) => {
      if (previous[i] === undefined) delete process.env[k];
      else process.env[k] = previous[i];
    });
  }
}
function authFixture() {
  const admin: Row = {
    id: adminId,
    email: "admin@example.invalid",
    aud: "authenticated",
    created_at: "2026-11-06T00:00:00Z",
    app_metadata: {},
    user_metadata: {},
  };
  const users: Row[] = [admin],
    profiles: Row[] = [{ id: adminId, role: "admin", school_id: null }],
    requests: Row[] = [],
    schools: Row[] = [],
    writes: Row[] = [];
  const passwords = new Map<string, string>();
  const token = (id: string) =>
    [
      {},
      {
        sub: id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: "authenticated",
      },
      {},
    ]
      .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
      .join(".");
  const response = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { "content-type": "application/json" },
    });
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    assert.equal(
      url.origin,
      "https://fixture.invalid",
      "tests must never call a live Supabase project",
    );
    const method = init?.method || "GET",
      body = init?.body ? JSON.parse(String(init.body)) : null;
    const headers = new Headers(init?.headers);
    const bearer = headers.get("authorization")?.replace(/^Bearer /, "");
    let uid = "";
    try {
      uid = JSON.parse(
        Buffer.from((bearer || "").split(".")[1], "base64url").toString(),
      ).sub;
    } catch {}
    if (method !== "GET") writes.push({ path: url.pathname, method, body });
    if (url.pathname === "/auth/v1/admin/users" && method === "POST") {
      if (users.some((u) => u.email === body.email))
        return response({ message: "duplicate", code: "email_exists" }, 422);
      const { password, ...attributes } = body;
      passwords.set(body.email, password);
      const user = { ...admin, ...attributes, id: newId };
      users.push(user);
      return response(user);
    }
    if (url.pathname === "/auth/v1/token") {
      const user = users.find((u) => u.email === body.email);
      if (
        !user ||
        body.password !== (passwords.get(body.email) || "test-password-123")
      )
        return response({ message: "invalid credentials" }, 400);
      return response({
        user,
        access_token: token(user.id),
        refresh_token: "fixture-refresh",
        token_type: "bearer",
        expires_in: 3600,
      });
    }
    if (url.pathname === "/auth/v1/user")
      return users.some((u) => u.id === uid)
        ? response(users.find((u) => u.id === uid))
        : response({ message: "invalid token" }, 401);
    if (url.pathname === "/auth/v1/admin/users" && method === "GET") {
      const page = Number(url.searchParams.get("page") || 1),
        limit = Number(url.searchParams.get("per_page") || 100);
      return response({
        users: users.slice((page - 1) * limit, page * limit),
        aud: "authenticated",
        total: users.length,
      });
    }
    if (url.pathname.startsWith("/auth/v1/admin/users/")) {
      const user = users.find((u) => u.id === url.pathname.split("/").pop());
      if (!user) return response({ message: "not found" }, 404);
      if (method === "PUT") Object.assign(user, body);
      return response(user);
    }
    if (url.pathname.endsWith("/rpc/allow_school_signup"))
      return response(true);
    if (url.pathname.endsWith("/rpc/resubmit_school_registration")) {
      const row = requests.find(
        (r) => r.user_id === uid && r.status === "rejected",
      );
      if (!row) return response({ message: "not a rejected request" }, 400);
      Object.assign(row, {
        status: "pending",
        review_note: null,
        reviewed_at: null,
        school_name: body.p_school_name,
        contact_name: body.p_contact_name,
      });
      return response(null);
    }
    if (url.pathname.endsWith("/rpc/review_school_registration")) {
      const row = requests.find((r) => r.id === body.p_request_id);
      if (!row || row.status !== "pending")
        return response({ message: "already reviewed" }, 400);
      row.status = body.p_decision;
      if (row.status === "approved") {
        schools.push({ id: "school-created", name: row.school_name });
        profiles.push({
          id: row.user_id,
          role: "school_admin",
          school_id: "school-created",
        });
      }
      return response(null);
    }
    const table = url.pathname.split("/").pop();
    const db =
      table === "profiles"
        ? profiles
        : table === "school_registration_requests"
          ? requests
          : null;
    if (!db) throw Error(`Unexpected request ${method} ${url.pathname}`);
    let rows = db.filter((row) =>
      [...url.searchParams].every(
        ([key, value]) =>
          !value.startsWith("eq.") || String(row[key]) === value.slice(3),
      ),
    );
    for (const [key, value] of url.searchParams)
      if (value.startsWith("in.("))
        rows = rows.filter((r) =>
          value.slice(4, -1).split(",").includes(r[key]),
        );
    if (method === "POST") {
      if (table === "profiles" && db.some((r) => r.id === body.id))
        return response({ message: "duplicate", code: "23505" }, 409);
      const row =
        table === "profiles"
          ? { ...body }
          : {
              id: "30000000-0000-4000-8000-000000000001",
              user_id: uid,
              status: "pending",
              created_at: "2026-11-06T00:00:00Z",
              ...body,
            };
      db.push(row);
      rows = [row];
    }
    if (method === "PATCH") for (const row of rows) Object.assign(row, body);
    if (method === "GET") {
      const offset = Number(url.searchParams.get("offset") || 0),
        limit = Number(url.searchParams.get("limit") || rows.length);
      rows = rows.slice(offset, offset + limit);
    }
    return response(
      headers.get("accept")?.includes("vnd.pgrst.object")
        ? rows[0] || null
        : rows,
    );
  };
  return {
    users,
    profiles,
    requests,
    schools,
    writes,
    token,
    fetch,
    adminId,
    newId,
    passwords,
  };
}
