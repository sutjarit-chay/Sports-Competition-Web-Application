import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_ATHLETICS_DATA,
  assignUniqueRankInLanes,
  calculateSchoolAthleticsStandings,
  computeFinalsWinners,
  defaultLanes,
  syncQualifiersToFinals,
} from "../components/athletics-scoresheet";

test("athletics data contains 20 canonical events and marks direct-final events", () => {
  assert.equal(INITIAL_ATHLETICS_DATA.length, 20);
  const directIds = INITIAL_ATHLETICS_DATA.filter((r) => r.directFinal).map(
    (r) => r.id,
  );
  assert.deepEqual(directIds, [1, 2, 3, 4, 15, 16, 19, 20]);
});

test("computeFinalsWinners does not award premature medals to unranked lanes", () => {
  const lanes = defaultLanes(6);
  lanes[0].schoolName = "โรงเรียนบ้านหนองแดน";
  lanes[1].schoolName = "โรงเรียนบ้านดงซ่อม";
  lanes[2].schoolName = "โรงเรียนบ้านคลองเมือง";

  const beforeRace = computeFinalsWinners(lanes);
  assert.equal(beforeRace[0].schoolName, "");
  assert.equal(beforeRace[0].score, 0);
  assert.equal(beforeRace[1].schoolName, "");
  assert.equal(beforeRace[2].schoolName, "");

  // Assign ranks 1, 2, 3
  lanes[2].rank = "1";
  lanes[0].rank = "2";
  lanes[1].rank = "3";

  const afterRace = computeFinalsWinners(lanes);
  assert.equal(afterRace[0].schoolName, "โรงเรียนบ้านคลองเมือง");
  assert.equal(afterRace[0].score, 3);
  assert.equal(afterRace[1].schoolName, "โรงเรียนบ้านหนองแดน");
  assert.equal(afterRace[1].score, 2);
  assert.equal(afterRace[2].schoolName, "โรงเรียนบ้านดงซ่อม");
  assert.equal(afterRace[2].score, 1);
});

test("assignUniqueRankInLanes clears duplicate rank from previous lane in the same heat", () => {
  let lanes = defaultLanes(5);
  lanes[0].schoolName = "โรงเรียนบ้านหนองแดน";
  lanes[1].schoolName = "โรงเรียนบ้านดงซ่อม";

  lanes = assignUniqueRankInLanes(lanes, 0, "1");
  assert.equal(lanes[0].rank, "1");

  // Assign rank "1" to lane 2 -> lane 1's rank "1" must be cleared
  lanes = assignUniqueRankInLanes(lanes, 1, "1");
  assert.equal(lanes[0].rank, "");
  assert.equal(lanes[1].rank, "1");
});

test("syncQualifiersToFinals seeds 3-2-1-1-2-3 and clears finals lane when qualifier fouls or loses rank", () => {
  const row = structuredClone(INITIAL_ATHLETICS_DATA[4]); // รายการที่ 5 วิ่ง 50 เมตร อนุบาล หญิง
  row.r1Lanes[0] = { lane: 1, schoolName: "โรงเรียนบ้านหนองแดน", athleteName: "ด.ญ. ก", rank: "1", isFoul: false };
  row.r1Lanes[1] = { lane: 2, schoolName: "โรงเรียนบ้านโนนสมบูรณ์", athleteName: "ด.ญ. ข", rank: "2", isFoul: false };
  row.r1Lanes[2] = { lane: 3, schoolName: "โรงเรียนบ้านคลองเมือง", athleteName: "ด.ญ. ค", rank: "3", isFoul: false };

  row.r2Lanes[0] = { lane: 1, schoolName: "โรงเรียนบ้านมะเดื่อชุมพร", athleteName: "ด.ญ. ง", rank: "1", isFoul: false };
  row.r2Lanes[1] = { lane: 2, schoolName: "โรงเรียนบ้านดงซ่อม", athleteName: "ด.ญ. จ", rank: "2", isFoul: false };
  row.r2Lanes[2] = { lane: 3, schoolName: "โรงเรียนบ้านไร่ลำปาง", athleteName: "ด.ญ. ฉ", rank: "3", isFoul: false };

  const synced1 = syncQualifiersToFinals(row).row;
  // Seeding order across lanes 1-6: 3, 2, 1, 1, 2, 3
  assert.deepEqual(synced1.r3, [
    "โรงเรียนบ้านคลองเมือง",   // ลู่ 1 = R1 #3
    "โรงเรียนบ้านโนนสมบูรณ์",  // ลู่ 2 = R1 #2
    "โรงเรียนบ้านหนองแดน",     // ลู่ 3 = R1 #1
    "โรงเรียนบ้านมะเดื่อชุมพร", // ลู่ 4 = R2 #1
    "โรงเรียนบ้านดงซ่อม",      // ลู่ 5 = R2 #2
    "โรงเรียนบ้านไร่ลำปาง",     // ลู่ 6 = R2 #3
  ]);

  // Now mark R1 #1 (โรงเรียนบ้านหนองแดน) as foul -> Finals Lane 3 must be cleared
  synced1.r1Lanes[0].isFoul = true;
  synced1.r1Lanes[0].rank = "DQ";

  const synced2 = syncQualifiersToFinals(synced1).row;
  assert.equal(synced2.r3[2], "");
  assert.equal(synced2.r3Lanes[2].schoolName, "");
});

test("calculateSchoolAthleticsStandings breaks score ties by gold, silver, bronze counts", () => {
  const rows = structuredClone(INITIAL_ATHLETICS_DATA);

  // School A: 1 Gold (3 pts)
  rows[0].r3Lanes[0] = { lane: 1, schoolName: "โรงเรียนบ้านหนองแดน", athleteName: "A", rank: "1", isFoul: false };
  // School B: 1 Silver + 1 Bronze (2 + 1 = 3 pts)
  rows[0].r3Lanes[1] = { lane: 2, schoolName: "โรงเรียนบ้านดงซ่อม", athleteName: "B1", rank: "2", isFoul: false };
  rows[1].r3Lanes[0] = { lane: 1, schoolName: "โรงเรียนบ้านดงซ่อม", athleteName: "B2", rank: "3", isFoul: false };

  const standings = calculateSchoolAthleticsStandings(rows);
  assert.equal(standings.length, 2);
  // Both have 3 points, but โรงเรียนบ้านหนองแดน has 1 Gold so it ranks 1st
  assert.equal(standings[0].schoolName, "โรงเรียนบ้านหนองแดน");
  assert.equal(standings[0].totalScore, 3);
  assert.equal(standings[0].gold, 1);
  assert.equal(standings[0].place, 1);

  assert.equal(standings[1].schoolName, "โรงเรียนบ้านดงซ่อม");
  assert.equal(standings[1].totalScore, 3);
  assert.equal(standings[1].gold, 0);
  assert.equal(standings[1].silver, 1);
  assert.equal(standings[1].bronze, 1);
  assert.equal(standings[1].place, 2);
});
