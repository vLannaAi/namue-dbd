import { test } from "node:test";
import assert from "node:assert/strict";
import { STRINGS, toBuddhistDate, formatDate, statusLabel } from "../src/i18n.ts";

test("STRINGS has matching keys in both languages", () => {
  const en = Object.keys(STRINGS.en).sort();
  const th = Object.keys(STRINGS.th).sort();
  assert.deepEqual(en, th, "TH and EN must have the same set of keys");
});

test("STRINGS.en and STRINGS.th have non-empty values", () => {
  for (const lang of ["en", "th"] as const) {
    for (const [k, v] of Object.entries(STRINGS[lang])) {
      if (typeof v === "string") {
        assert.notEqual(v, "", `${lang}.${k} is empty`);
      } else {
        assert.equal(typeof v, "function", `${lang}.${k} should be string or function`);
      }
    }
  }
});

test("formatter functions handle representative inputs", () => {
  assert.equal(STRINGS.en.resultsLine(1, 1, 1), "1 result · page 1 of 1");
  assert.equal(STRINGS.en.resultsLine(269, 1, 27), "269 results · page 1 of 27");
  assert.equal(STRINGS.th.resultsLine(269, 1, 27), "269 รายการ · หน้า 1 จาก 27");
  assert.equal(STRINGS.en.connectFailed("timeout"), "connect failed — timeout");
  assert.equal(STRINGS.th.connectFailed("timeout"), "เชื่อมต่อล้มเหลว — timeout");
});

test("toBuddhistDate adds 543 to the year", () => {
  assert.equal(toBuddhistDate("2023-02-03"), "2566-02-03");
  assert.equal(toBuddhistDate("2024-12-31"), "2567-12-31");
});

test("toBuddhistDate passes through nulls and unparseable strings", () => {
  assert.equal(toBuddhistDate(null), null);
  assert.equal(toBuddhistDate("not-a-date"), "not-a-date");
});

test("formatDate switches behaviour on lang", () => {
  assert.equal(formatDate("2024-03-15", "en"), "2024-03-15");
  assert.equal(formatDate("2024-03-15", "th"), "2567-03-15");
  assert.equal(formatDate(null, "en"), null);
});

test("switchTo shows the opposite language label", () => {
  // The toggle shows what you'd switch TO.
  assert.equal(STRINGS.en.switchTo, "TH");
  assert.equal(STRINGS.th.switchTo, "EN");
});

test("statusLabel maps DBD status code 1 to Operating in EN, ดำเนินกิจการ in TH", () => {
  assert.equal(statusLabel("1", "anything", "en"), "Operating");
  assert.equal(statusLabel("1", "ignored", "th"), "ยังดำเนินกิจการอยู่");
  assert.equal(statusLabel("3", "ignored", "en"), "Dissolution");
});

test("statusLabel falls back to Other for unknown codes in EN (no Thai leak)", () => {
  const out = statusLabel("99", "บางอย่าง", "en");
  assert.equal(out, "Other");
  // Must not contain Thai characters
  assert.ok(!/[฀-๿]/.test(out), "EN fallback should be pure ASCII");
});

test("statusLabel preserves DBD's Thai description for unknown codes in TH mode", () => {
  assert.equal(statusLabel("99", "บางสถานะ", "th"), "บางสถานะ");
});

test("counterUnit is concise in both languages", () => {
  assert.equal(STRINGS.en.counterUnit, "found");
  assert.equal(STRINGS.th.counterUnit, "รายการ");
});

test("loadingMoreShort is set in both languages", () => {
  assert.notEqual(STRINGS.en.loadingMoreShort, "");
  assert.notEqual(STRINGS.th.loadingMoreShort, "");
});

test("recordPosition formats both languages", () => {
  assert.equal(STRINGS.en.recordPosition(3, 269), "Record 3 of 269");
  assert.equal(STRINGS.th.recordPosition(3, 269), "รายการ 3 จาก 269");
});
