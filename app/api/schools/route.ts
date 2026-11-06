import {
  AccountError,
  accountBody,
  accountError,
  accountJson,
} from "@/lib/account-server";
import { authorizeSchool, schoolUuid } from "@/lib/school-storage";

export async function PATCH(request: Request) {
  try {
    const body = await accountBody(request);
    const schoolId = schoolUuid(body.schoolId);
    const admin = await authorizeSchool(request, schoolId);
    if (
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.trim().length > 200 ||
      typeof body.expectedName !== "string" ||
      !body.expectedName ||
      body.expectedName.length > 200
    )
      throw new AccountError(
        "กรอกชื่อโรงเรียนไม่เกิน 200 ตัวอักษร และชื่อเดิมที่ต้องการแก้ไข",
      );
    const name = body.name.trim();
    const duplicate = await admin
      .from("schools")
      .select("id")
      .eq("name", name)
      .neq("id", schoolId)
      .limit(1);
    if (duplicate.error)
      throw new AccountError("ตรวจสอบชื่อโรงเรียนไม่สำเร็จ", 503);
    if (duplicate.data?.length)
      throw new AccountError("มีโรงเรียนชื่อนี้อยู่แล้ว กรุณาตรวจสอบชื่อ", 409);
    const updated = await admin
      .from("schools")
      .update({ name })
      .eq("id", schoolId)
      .eq("name", body.expectedName)
      .select("id,name");
    if (updated.error)
      throw new AccountError(
        updated.error.code === "23505"
          ? "มีโรงเรียนชื่อนี้อยู่แล้ว กรุณาตรวจสอบชื่อ"
          : "บันทึกชื่อโรงเรียนไม่สำเร็จ",
        updated.error.code === "23505" ? 409 : 503,
      );
    if (!updated.data?.length)
      throw new AccountError(
        "ชื่อโรงเรียนเปลี่ยนจากอุปกรณ์อื่น กรุณาโหลดข้อมูลใหม่ก่อนแก้ไข",
        409,
      );
    return accountJson({ school: updated.data[0] });
  } catch (error) {
    return accountError(error);
  }
}
