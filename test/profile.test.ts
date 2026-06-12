import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProfileDetail, parseDescriptions } from "../src/dw/profile.ts";
import { ParseError } from "../src/errors.ts";

test("parseProfileDetail extracts core fields with ISO dates", () => {
  const raw = {
    jpNo: "0105563012345",
    jpTypeCode: "5",
    jpName: "บริษัท ลานนา เอไอ จำกัด",
    jpNameE: "LANNA AI CO., LTD.",
    jpStatus: { jpStatCode: "1", jpStatDesc: "ยังดำเนินกิจการอยู่", jpStatDescE: "Operating" },
    regDate: [2024, 3, 15],
    closeDate: null,
    address: "888/8 ถนนสุขุมวิท",
    addressE: "888/8 Sukhumvit Road",
    locationProvince: { pvCode: "10", pvDesc: "กรุงเทพมหานคร", pvDescE: "Bangkok" },
    locationAmpur: { ampurCode: "1004", ampurDesc: "บางกะปิ", ampurDescE: "Bang Kapi" },
    locationTumbon: { tumbonCode: "100401", tumbonDesc: "หัวหมาก", tumbonDescE: "Hua Mak" },
    zipCode: "10240",
  };
  const p = parseProfileDetail(raw);
  assert.equal(p.juristicId, "0105563012345");
  assert.equal(p.typeCode, "5");
  assert.equal(p.name, "บริษัท ลานนา เอไอ จำกัด");
  assert.equal(p.nameEn, "LANNA AI CO., LTD.");
  assert.equal(p.status.descTh, "ยังดำเนินกิจการอยู่");
  assert.equal(p.status.descEn, "Operating");
  // Contact/business fields absent in the fixture → null/empty, never undefined.
  assert.equal(p.phone, null);
  assert.deepEqual(p.websites, []);
  assert.equal(p.registrationDate, "2024-03-15");
  assert.equal(p.dissolutionDate, null);
  assert.equal(p.province!.nameTh, "กรุงเทพมหานคร");
  assert.equal(p.district!.nameEn, "Bang Kapi");
  assert.equal(p.subdistrict!.nameEn, "Hua Mak");
  assert.equal(p.zipCode, "10240");
});

test("parseProfileDetail handles YYYYMMDD string dates (per-juristic endpoint shape)", () => {
  const raw = {
    jpNo: "0", jpTypeCode: "5", jpName: "x",
    regDate: "20240315",
    closeDate: "20251220",
  };
  const p = parseProfileDetail(raw);
  assert.equal(p.registrationDate, "2024-03-15");
  assert.equal(p.dissolutionDate, "2025-12-20");
});

test("parseProfileDetail returns null location parts when fields absent", () => {
  const raw = { jpNo: "0", jpTypeCode: "5", jpName: "x" };
  const p = parseProfileDetail(raw);
  assert.equal(p.province, null);
  assert.equal(p.district, null);
  assert.equal(p.subdistrict, null);
});

test("parseProfileDetail throws ParseError on wrong shape", () => {
  assert.throws(() => parseProfileDetail(null), (e) => e instanceof ParseError);
  assert.throws(() => parseProfileDetail([]), (e) => e instanceof ParseError);
});

test("parseDescriptions extracts objectives with code fallback chain", () => {
  const raw = [
    { objectiveCode: "62010", description: "Computer programming activities" },
    { tsicCode: "62020", description: "Computer consultancy" },
    { isicCode: "47190", desc: "Other retail trade in non-specialized stores" },
  ];
  const out = parseDescriptions(raw);
  assert.equal(out.length, 3);
  assert.equal(out[0]!.code, "62010");
  assert.equal(out[1]!.code, "62020");
  assert.equal(out[2]!.code, "47190");
  assert.equal(out[2]!.description, "Other retail trade in non-specialized stores");
});

test("parseDescriptions returns [] for non-array input", () => {
  assert.deepEqual(parseDescriptions(null), []);
  assert.deepEqual(parseDescriptions({ x: 1 }), []);
});

test("parseProfileDetail carries contact and business-type fields when present", () => {
  const p = parseProfileDetail({
    jpNo: "0105563012345",
    jpTypeCode: "5",
    jpName: "บริษัท ทดสอบ จำกัด",
    phoneNo: "053-123456",
    email: "info@example.co.th",
    webSite1: "https://example.co.th",
    webSite2: "",
    webSite3: "https://shop.example.co.th",
    businessSizeCode: "S",
    businessTypeCode: "G",
    businessType: { businessTypeCode: "G", businessTypeDesc: "การขายส่งและการขายปลีก", businessTypeDescE: "Wholesale and retail trade" },
  });
  assert.equal(p.phone, "053-123456");
  assert.equal(p.email, "info@example.co.th");
  assert.deepEqual(p.websites, ["https://example.co.th", "https://shop.example.co.th"]);
  assert.equal(p.businessSizeCode, "S");
  assert.equal(p.businessTypeDesc, "การขายส่งและการขายปลีก");
  assert.equal(p.businessTypeDescE, "Wholesale and retail trade");
});
