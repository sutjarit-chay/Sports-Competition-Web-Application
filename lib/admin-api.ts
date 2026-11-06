"use client";
import { supabase } from "./supabase";
export async function adminRequest<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (!supabase) throw Error("ยังไม่ได้ตั้งค่า Supabase");
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw Error("กรุณาเข้าสู่ระบบใหม่");
  const response = await fetch(path, {
    method,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error("เชื่อมต่อระบบผู้ดูแลไม่สำเร็จ กรุณาลองใหม่");
  }
  if (!response.ok) throw Error(result.error || "ดำเนินการไม่สำเร็จ");
  return result as T;
}
