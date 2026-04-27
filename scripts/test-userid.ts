import { userIdSchema } from "../src/lib/userid";

const cases: { v: string; ok: boolean }[] = [
  { v: "ric2k1", ok: true },
  { v: "_alice", ok: true },
  { v: "a_b", ok: true },
  { v: "OK_user", ok: true },
  { v: "ab", ok: false }, // too short
  { v: "abcdefghijklmnop", ok: false }, // too long (16)
  { v: "1abc", ok: false }, // starts with digit
  { v: "abc!def", ok: false }, // bad char
  { v: "has space", ok: false },
];

let pass = 0;
for (const c of cases) {
  const r = userIdSchema.safeParse(c.v);
  const ok = r.success === c.ok;
  console.log(
    `${ok ? "✓" : "✗"} "${c.v}" expected ${c.ok ? "valid" : "invalid"}, got ${r.success ? "valid" : "invalid"}`
  );
  if (ok) pass++;
}
console.log(`\n${pass}/${cases.length} passed`);
process.exit(pass === cases.length ? 0 : 1);
