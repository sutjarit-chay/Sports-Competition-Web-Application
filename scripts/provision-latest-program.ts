/** Run with node --env-file=.env.local --import tsx scripts/provision-latest-program.ts [--apply].
 * No schema, RLS, account, registration or match writes. Source dates are session metadata.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile, chmod } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { buildLatestProgram } from "../lib/latest-program";
import { readManagement } from "../lib/production-competitions";
async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const tableNames = [
    "schools",
    "competitions",
    "matches",
    "registrations",
    "athletics_events",
    "athletics_results",
    "medals",
    "profiles",
  ] as const;
  async function read(table: string) {
    let all: Record<string, any>[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db
        .from(table)
        .select("*")
        .order("id")
        .range(offset, offset + 499);
      if (error) throw Error(`${table}: ${error.message}`);
      all.push(...data);
      if (data.length < 500) return all;
    }
  }
  const before: Record<string, Record<string, any>[]> = Object.fromEntries(
    await Promise.all(tableNames.map(async (t) => [t, await read(t)])),
  );
  const targets = buildLatestProgram(
    before.schools as { id: string; name: string }[],
  );
  const plans: { id: string; row: any; previous: any | null }[] = [];
  for (const target of targets) {
    const previous = before.competitions.find((c) => c.id === target.id);
    if (!previous) {
      if (before.competitions.some((c) => c.name === target.name))
        throw Error(`พบชื่อรายการซ้ำที่ใช้รหัสอื่น: ${target.name}`);
      plans.push({ id: target.id, row: target, previous: null });
      continue;
    }
    if (
      previous.sport !== target.sport ||
      previous.gender !== target.gender ||
      previous.age_group !== target.age_group
    )
      throw Error(`ประเภทเดิมเปลี่ยน: ${target.name}`);
    const old = readManagement(previous.registration_policy);
    if (!old) throw Error(`ข้อมูลผังเดิมไม่สมบูรณ์: ${target.name}`);
    const incoming = target.registration_policy.management;
    if ((old as any).source?.kind === "latest-pdf-program") continue; // Never overwrite later organizer edits on retry.
    if (
      old.fixtures.length !== incoming.fixtures.length ||
      incoming.fixtures.some(
        (f) =>
          !old.fixtures.some(
            (o) =>
              o.id === f.id &&
              o.home === f.home &&
              o.away === f.away &&
              o.round === f.round &&
              o.sourceNumber === f.sourceNumber,
          ),
      )
    )
      throw Error(`ผังคู่เดิมเปลี่ยน กรุณาตรวจ: ${target.name}`);
    const management = {
      ...old,
      revision: old.revision + 1,
      details: incoming.details,
      source: incoming.source,
      fixtures: old.fixtures.map((f) => {
        const source = incoming.fixtures.find((s) => s.id === f.id)!;
        return {
          ...f,
          competitionDate: source.competitionDate,
          sessionStart: source.sessionStart,
          timeMode: source.timeMode,
          venue: f.venue || source.venue,
        };
      }),
    };
    plans.push({
      id: target.id,
      row: {
        registration_policy: { ...previous.registration_policy, management },
      },
      previous,
    });
  }
  console.log(
    JSON.stringify({
      mode: process.argv.includes("--apply") ? "apply" : "dry-run",
      targetCompetitions: targets.length,
      targetFixtureSlots: targets.reduce(
        (n, c) => n + c.registration_policy.management.fixtures.length,
        0,
      ),
      newCompetitions: plans.filter((p) => !p.previous).length,
      dateUpdates: plans.filter((p) => p.previous).length,
      athleticsCategories: targets.filter((c) => c.sport === "กรีฑา").length,
      existingMatches: before.matches.length,
      existingRegistrations: before.registrations.length,
    }),
  );
  if (!process.argv.includes("--apply")) return;
  const backupDir =
    process.env.NKG_BACKUP_DIRECTORY ||
    path.join(process.cwd(), ".local-backups");
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  await chmod(backupDir, 0o700);
  const backup = path.join(
    backupDir,
    `latest-program-${new Date().toISOString().replaceAll(":", "-")}.json`,
  );
  await writeFile(
    backup,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        source: "สูจิบัตรกีฬากลุ่ม 69 12.11.69.pdf",
        before,
        plans,
      },
      null,
      2,
    ),
    { mode: 0o600, flag: "wx" },
  );
  for (const plan of plans) {
    const result = plan.previous
      ? await db
          .from("competitions")
          .update(plan.row)
          .eq("id", plan.id)
          .eq(
            "registration_policy->management->>revision",
            String(plan.previous.registration_policy.management.revision),
          )
          .select("id")
      : await db.from("competitions").insert(plan.row).select("id");
    if (result.error || result.data?.length !== 1)
      throw Error(
        `นำเข้าไม่สำเร็จ ${plan.id}: ${result.error?.message || "ข้อมูลเปลี่ยนจากอุปกรณ์อื่น"}; สำรอง ${backup}`,
      );
  }
  const after: Record<string, Record<string, any>[]> = Object.fromEntries(
    await Promise.all(tableNames.map(async (t) => [t, await read(t)])),
  );
  for (const t of tableNames.filter((t) => t !== "competitions"))
    if (!isDeepStrictEqual(before[t], after[t]))
      throw Error(
        `มีข้อมูล ${t} เปลี่ยนระหว่างนำเข้า กรุณาตรวจสำรอง ${backup}`,
      );
  for (const plan of plans) {
    const saved = after.competitions.find((c) => c.id === plan.id);
    if (
      !saved ||
      !isDeepStrictEqual(
        saved.registration_policy,
        plan.row.registration_policy,
      )
    )
      throw Error(`ข้อมูลที่บันทึกไม่ตรงกับแผน ${plan.id}; สำรอง ${backup}`);
  }
  for (const target of targets) {
    const actual = after.competitions.find((c) => c.id === target.id);
    if (!actual || !readManagement(actual.registration_policy))
      throw Error(`อ่านกลับไม่สำเร็จ: ${target.name}`);
  }
  console.log(
    JSON.stringify({
      verified: true,
      competitions: after.competitions.length,
      fixtureSlots: after.competitions.reduce(
        (n, c) =>
          n + (c.registration_policy?.management?.fixtures?.length || 0),
        0,
      ),
      matchesPreserved: after.matches.length,
      registrationsPreserved: after.registrations.length,
      accountsPreserved: after.profiles.length,
      backup,
    }),
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "นำเข้าไม่สำเร็จ");
  process.exitCode = 1;
});
