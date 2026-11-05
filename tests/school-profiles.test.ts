import assert from "node:assert/strict";
import test from "node:test";
import { parseSchoolProfiles } from "../lib/school-profiles";

test("school profiles allow older records without presentation fields", () => {
  assert.deepEqual(
    parseSchoolProfiles(
      JSON.stringify({
        school1: {
          contactName: "ครูตัวอย่าง",
          contactPhone: "0800000000",
          address: "อำเภอโกสัมพี",
        },
      }),
    ),
    {
      school1: {
        shortName: "",
        logo: "",
        contactName: "ครูตัวอย่าง",
        contactPhone: "0800000000",
        address: "อำเภอโกสัมพี",
      },
    },
  );
});

test("school profiles accept only supported inline logo images", () => {
  const profile = {
    shortName: "บ้านตัวอย่าง",
    logo: "data:image/webp;base64,AAAA",
    contactName: "",
    contactPhone: "",
    address: "",
  };
  assert.deepEqual(parseSchoolProfiles(JSON.stringify({ school1: profile })), {
    school1: profile,
  });
  assert.throws(() =>
    parseSchoolProfiles(
      JSON.stringify({ school1: { ...profile, logo: "javascript:alert(1)" } }),
    ),
  );
});
