import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRequest, CAPABILITIES, PROTOCOL_VERSION } from "../src/rpc.ts";
import { ValidationError } from "../src/errors.ts";

test("validateRequest accepts capabilities query", () => {
  const req = validateRequest({ type: "capabilities" });
  assert.equal(req.type, "capabilities");
});

test("validateRequest accepts session.ensure", () => {
  const req = validateRequest({ type: "session.ensure" });
  assert.equal(req.type, "session.ensure");
});

test("validateRequest accepts session.status", () => {
  const req = validateRequest({ type: "session.status" });
  assert.equal(req.type, "session.status");
});

test("validateRequest accepts well-formed company-translate", () => {
  const req = validateRequest({ type: "translate", scope: "company", query: "ลานนา" });
  assert.equal(req.type, "translate");
  if (req.type === "translate" && req.scope === "company") {
    assert.equal(req.query, "ลานนา");
  } else {
    assert.fail("expected translate/company");
  }
});

test("validateRequest preserves pvCodeList + jpStatusList on company translate", () => {
  const req = validateRequest({
    type: "translate", scope: "company", query: "x",
    pvCodeList: ["10", "50"], jpStatusList: ["1"],
  });
  if (req.type === "translate" && req.scope === "company") {
    assert.deepEqual(req.pvCodeList, ["10", "50"]);
    assert.deepEqual(req.jpStatusList, ["1"]);
  } else {
    assert.fail();
  }
});

test("validateRequest drops empty pvCodeList / jpStatusList", () => {
  const req = validateRequest({
    type: "translate", scope: "company", query: "x",
    pvCodeList: [], jpStatusList: [],
  });
  if (req.type === "translate" && req.scope === "company") {
    assert.equal(req.pvCodeList, undefined);
    assert.equal(req.jpStatusList, undefined);
  } else {
    assert.fail();
  }
});

test("validateRequest preserves optional page on company translate", () => {
  const req = validateRequest({ type: "translate", scope: "company", query: "x", page: 3 });
  if (req.type === "translate" && req.scope === "company") {
    assert.equal(req.page, 3);
  } else {
    assert.fail();
  }
});

test("validateRequest accepts director scope with juristicId+typeCode", () => {
  const req = validateRequest({
    type: "translate", scope: "director", juristicId: "0105563012345", typeCode: "5",
  });
  if (req.type === "translate" && req.scope === "director") {
    assert.equal(req.juristicId, "0105563012345");
    assert.equal(req.typeCode, "5");
  } else {
    assert.fail();
  }
});

test("validateRequest rejects unknown type", () => {
  assert.throws(() => validateRequest({ type: "wat" }), (e) => e instanceof ValidationError);
});

test("validateRequest rejects unknown scope", () => {
  assert.throws(
    () => validateRequest({ type: "translate", scope: "person", query: "x" }),
    (e) => e instanceof ValidationError,
  );
});

test("validateRequest accepts company.detail with typeCode+juristicId", () => {
  const req = validateRequest({ type: "company.detail", typeCode: "5", juristicId: "0105563012345" });
  if (req.type === "company.detail") {
    assert.equal(req.typeCode, "5");
    assert.equal(req.juristicId, "0105563012345");
  } else { assert.fail(); }
});

test("validateRequest rejects company.detail without ids", () => {
  assert.throws(
    () => validateRequest({ type: "company.detail" }),
    (e) => e instanceof ValidationError,
  );
});

test("validateRequest accepts company.full and rejects missing ids", () => {
  const r = validateRequest({ type: "company.full", typeCode: "5", juristicId: "0105563012345" });
  assert.equal(r.type, "company.full");
  assert.throws(() => validateRequest({ type: "company.full" }), (e) => e instanceof ValidationError);
});

test("validateRequest rejects director without ids", () => {
  assert.throws(
    () => validateRequest({ type: "translate", scope: "director" }),
    (e) => e instanceof ValidationError,
  );
});

test("validateRequest rejects company-translate without query", () => {
  assert.throws(
    () => validateRequest({ type: "translate", scope: "company" }),
    (e) => e instanceof ValidationError,
  );
});

test("validateRequest rejects non-object input", () => {
  assert.throws(() => validateRequest(null), (e) => e instanceof ValidationError);
  assert.throws(() => validateRequest("hi"), (e) => e instanceof ValidationError);
  assert.throws(() => validateRequest([]), (e) => e instanceof ValidationError);
});

test("CAPABILITIES advertises expected services", () => {
  assert.ok(Array.isArray(CAPABILITIES.services));
  assert.ok(CAPABILITIES.services.includes("translate.company"));
  assert.ok(CAPABILITIES.services.includes("translate.director"));
  assert.ok(CAPABILITIES.services.includes("session.ensure"));
  assert.ok(CAPABILITIES.services.includes("session.status"));
  assert.equal(CAPABILITIES.protocolVersion, PROTOCOL_VERSION);
});
