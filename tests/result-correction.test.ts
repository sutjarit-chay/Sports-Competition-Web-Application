import assert from "node:assert/strict";
import test from "node:test";
import { winnerCorrectionError } from "../lib/result-correction";
import type { Management } from "../lib/production-competitions";
const management: Management = {
  revision: 1,
  format: "knockout",
  teamLimit: 4,
  details: "",
  teams: [],
  fixtures: [
    {
      id: "semi",
      sourceNumber: 13,
      home: "a",
      away: "b",
      round: "semi",
      startsAt: "",
      venue: "",
    },
    {
      id: "final",
      sourceNumber: 16,
      home: "ผู้ชนะคู่ 13",
      away: "c",
      round: "final",
      startsAt: "",
      venue: "",
    },
    {
      id: "bronze",
      sourceNumber: 15,
      home: "ผู้แพ้คู่ 13",
      away: "d",
      round: "bronze",
      startsAt: "",
      venue: "",
    },
  ],
};
test("terminal finals and bronze fixtures allow winner corrections", () => {
  assert.equal(winnerCorrectionError(management, "final"), undefined);
  assert.equal(winnerCorrectionError(management, "bronze"), undefined);
});
test("winner and loser references use source numbers and protect downstream fixtures", () => {
  assert.match(winnerCorrectionError(management, "semi") || "", /16, 15/);
  assert.ok(
    winnerCorrectionError(
      {
        ...management,
        fixtures: management.fixtures.filter((f) => f.id !== "final"),
      },
      "semi",
    ),
  );
});
test("missing metadata cannot authorize a knockout winner correction", () => {
  assert.ok(winnerCorrectionError(null, "unknown"));
  assert.ok(winnerCorrectionError(management, "unknown"));
});
