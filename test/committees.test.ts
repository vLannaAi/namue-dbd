import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommittees } from "../src/dw/committees.ts";

test("parseCommittees extracts TH/EN name parts and builds fullName", () => {
  const raw = [{
    cmtTypeCode: "01", cmtSeq: 1,
    firstName: "สมชาย ", middleName: null, lastName: "ใจดี/",
    firstNameE: "Somchai", middleNameE: null, lastNameE: "Jaidee",
    titleName: "นาย", titleNameE: "Mr.", titleCode: "001", ntCode: "TH",
  }];
  const out = parseCommittees(raw);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.firstName, "สมชาย");
  assert.equal(out[0]!.lastName, "ใจดี");
  assert.equal(out[0]!.firstNameE, "Somchai");
  assert.equal(out[0]!.lastNameE, "Jaidee");
  assert.equal(out[0]!.fullName, "นาย สมชาย ใจดี");
  assert.equal(out[0]!.titleNameE, "Mr.");
  assert.equal(out[0]!.cmtSeq, 1);
});

test("parseCommittees returns [] for non-array input", () => {
  assert.deepEqual(parseCommittees(null), []);
  assert.deepEqual(parseCommittees("nope"), []);
  assert.deepEqual(parseCommittees({ x: 1 }), []);
});

test("parseCommittees handles middle name in fullName", () => {
  const raw = [{
    firstName: "John", middleName: "Paul", lastName: "Doe",
    titleName: "Mr.", titleCode: null,
  }];
  const out = parseCommittees(raw);
  assert.equal(out[0]!.fullName, "Mr. John Paul Doe");
});

test("parseCommittees skips middle name when null", () => {
  const raw = [{
    firstName: "Jane", middleName: null, lastName: "Smith", titleName: "Ms.",
  }];
  const out = parseCommittees(raw);
  assert.equal(out[0]!.fullName, "Ms. Jane Smith");
});

test("parseCommittees tolerates missing English fields", () => {
  const raw = [{ firstName: "ก", lastName: "ข" }];
  const out = parseCommittees(raw);
  assert.equal(out[0]!.firstNameE, null);
  assert.equal(out[0]!.lastNameE, null);
  assert.equal(out[0]!.titleNameE, null);
});
