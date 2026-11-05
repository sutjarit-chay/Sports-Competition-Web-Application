import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUsername, usernameEmail } from "../lib/school-auth";

test("school username is canonicalized and mapped to an internal Auth identity", () => {
  assert.equal(normalizeUsername("  Coach_01 "), "coach_01");
  assert.equal(
    usernameEmail(normalizeUsername("Coach_01")!),
    "coach_01@accounts.sports-competition.invalid",
  );
});

test("school username rejects malformed and non-string input", () => {
  for (const value of ["ab", "bad name", ".starts", "ends-", "ไทย", null, 42]) {
    assert.equal(normalizeUsername(value), null);
  }
});
