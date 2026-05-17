import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSearchBody, normalizeKeyword, parseSearchPage } from "../src/dw/search.ts";
import { ParseError } from "../src/errors.ts";

test("buildSearchBody uppercases keyword and applies defaults", () => {
  const b = buildSearchBody("lanna");
  assert.equal(b.keyword, "LANNA");
  assert.equal(b.sortBy, "jpName");
  assert.equal(b.currentPage, 1);
  assert.equal(b.type, "");
  assert.equal((b as { pvCodeList?: string[] }).pvCodeList, undefined);
});

test("normalizeKeyword strips spaces (matches DBD's indexed normalization)", () => {
  assert.equal(normalizeKeyword("lanna ai"), "LANNAAI");
  assert.equal(normalizeKeyword("LANNA AI"), "LANNAAI");
  assert.equal(normalizeKeyword("lanna  ai"), "LANNAAI");
});

test("normalizeKeyword strips punctuation and hyphens", () => {
  assert.equal(normalizeKeyword("Lanna AI Co., Ltd."), "LANNAAICOLTD");
  assert.equal(normalizeKeyword("lanna-ai"), "LANNAAI");
});

test("normalizeKeyword preserves Thai letters and digits", () => {
  assert.equal(normalizeKeyword("ลานนา เอไอ"), "ลานนาเอไอ");
  assert.equal(normalizeKeyword("0505551004444"), "0505551004444");
});

test("buildSearchBody attaches non-empty list filters only", () => {
  const b = buildSearchBody("x", { pvCodeList: ["10"], jpStatusList: [] });
  assert.deepEqual(b.pvCodeList, ["10"]);
  assert.equal((b as { jpStatusList?: string[] }).jpStatusList, undefined);
});

test("buildSearchBody honours custom page and sortBy", () => {
  const b = buildSearchBody("x", { page: 3, sortBy: "jpStatus" });
  assert.equal(b.currentPage, 3);
  assert.equal(b.sortBy, "jpStatus");
});

test("parseSearchPage parses DBD-shaped response", () => {
  const raw = {
    meta: { currentPage: 1, totalItems: 1, totalPages: 1, itemsPerPage: 20 },
    contents: [{
      jpNo: "0105563012345",
      jpTypeCode: "5",
      jpName: "บริษัท ลานนา จำกัด",
      jpNameE: "LANNA COMPANY LIMITED",
      jpStatus: { jpStatCode: "1", jpStatDesc: "ดำเนินกิจการ" },
      pvCode: "50",
    }],
  };
  const page = parseSearchPage(raw);
  assert.equal(page.meta.totalItems, 1);
  assert.equal(page.contents[0]!.juristicId, "0105563012345");
  assert.equal(page.contents[0]!.nameEn, "LANNA COMPANY LIMITED");
  assert.equal(page.contents[0]!.status.code, "1");
});

test("parseSearchPage handles missing jpNameE as null", () => {
  const raw = {
    meta: { currentPage: 1, totalItems: 1, totalPages: 1, itemsPerPage: 20 },
    contents: [{
      jpNo: "0", jpTypeCode: "5", jpName: "ก", jpNameE: null,
      jpStatus: { jpStatCode: "1", jpStatDesc: "x" }, pvCode: "10",
    }],
  };
  const page = parseSearchPage(raw);
  assert.equal(page.contents[0]!.nameEn, null);
});

test("parseSearchPage throws ParseError on bad shape", () => {
  assert.throws(() => parseSearchPage("nope"), (e) => e instanceof ParseError);
  assert.throws(() => parseSearchPage({ meta: {} }), (e) => e instanceof ParseError);
});
