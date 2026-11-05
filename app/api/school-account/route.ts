import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { normalizeUsername, usernameEmail } from "@/lib/school-auth";

type RequestBody = {
  mode?: unknown;
  username?: unknown;
  password?: unknown;
};

function response(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 4096) {
    return response("ข้อมูลคำขอมีขนาดใหญ่เกินไป", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) return response("ไม่พบข้อมูลคำขอ", 400);
  const chunks: Uint8Array[] = [];
  let bodyLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bodyLength += value.byteLength;
    if (bodyLength > 4096) {
      await reader.cancel();
      return response("ข้อมูลคำขอมีขนาดใหญ่เกินไป", 413);
    }
    chunks.push(value);
  }
  const bodyBytes = new Uint8Array(bodyLength);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const rawBody = new TextDecoder().decode(bodyBytes);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return response("รูปแบบคำขอไม่ถูกต้อง", 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return response("รูปแบบคำขอไม่ถูกต้อง", 400);
  }
  const body = parsed as RequestBody;

  const username = normalizeUsername(body.username);
  if (!username || typeof body.password !== "string") {
    return response("ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง", 400);
  }
  if (body.password.length < 10 || body.password.length > 128) {
    return response("รหัสผ่านต้องมีความยาว 10–128 ตัวอักษร", 400);
  }
  if (body.mode !== "register" && body.mode !== "login") {
    return response("ไม่รองรับวิธีดำเนินการนี้", 400);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey) {
    return response("ยังไม่ได้ตั้งค่า Supabase URL และ public key", 503);
  }

  const authClient = createClient(url, publicKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const email = usernameEmail(username);

  if (body.mode === "register") {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return response("เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า service-role secret", 503);
    }

    const adminClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const clientIp = request.headers.get("x-real-ip")?.trim() || "unknown";
    const ipHash = createHmac("sha256", serviceKey)
      .update(clientIp)
      .digest("hex");
    const { data: allowed, error: rateLimitError } = await adminClient.rpc(
      "allow_school_signup",
      { p_ip_hash: ipHash },
    );
    if (rateLimitError) {
      return response("ระบบจำกัดการสมัครยังไม่พร้อม กรุณาลองใหม่ภายหลัง", 503);
    }
    if (!allowed) {
      return response(
        "สมัครบัญชีได้ไม่เกิน 5 ครั้งต่อชั่วโมงจากเครือข่ายนี้",
        429,
      );
    }
    const { error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: { username },
    });
    if (createError) {
      return response("สร้างบัญชีไม่สำเร็จ ชื่อบัญชีอาจถูกใช้แล้ว", 409);
    }
  }

  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password: body.password,
  });
  if (error || !data.session) {
    return response(
      body.mode === "register"
        ? "สร้างบัญชีแล้ว แต่เริ่มต้นการเข้าสู่ระบบไม่สำเร็จ กรุณาลองเข้าสู่ระบบอีกครั้ง"
        : "ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง",
      body.mode === "register" ? 502 : 401,
    );
  }

  return Response.json({ session: data.session });
}
