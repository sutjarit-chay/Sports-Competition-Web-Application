import assert from "node:assert/strict";
import test from "node:test";
import { canManageCompetitions } from "../lib/competition-access";
test("admin and approved referee roles can manage competitions", () => {
  for (const role of ["admin", "referee", "recorder"])
    assert.equal(canManageCompetitions(role), true, role);
});
test("school, viewer, pending and unknown roles cannot manage competitions", () => {
  for (const role of ["school", "school_admin", "viewer", "pending", ""])
    assert.equal(canManageCompetitions(role), false, role);
});
