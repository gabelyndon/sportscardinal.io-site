import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, normalizeGrade } from "../src/vision.ts";

const base = {
  slabbed: true, grader: "PSA", certNumber: "75912436", year: "2020", set: "PANINI CONTENDERS",
  player: "COLE KMET", cardNumber: "118", parallel: null, readable: true, notes: null,
};

test("splits a printed grade into numeric + label", () => {
  const r = normalize({ ...base, gradeNumeric: 10, gradeLabel: "GEM MT 10" });
  assert.equal(r.gradeNumeric, 10);
  assert.equal(r.gradeLabel, "GEM MT 10");
  assert.equal("grade" in r, false, "old `grade` field must be gone");
});

test("keeps decimal grades (BGS/SGC 9.5)", () => {
  assert.deepEqual(normalizeGrade(9.5, "GEM MINT 9.5"), { gradeNumeric: 9.5, gradeLabel: "GEM MINT 9.5" });
  assert.deepEqual(normalizeGrade(9.5, "9.5"), { gradeNumeric: 9.5, gradeLabel: "9.5" });
});

test("accepts a numeric string from the model", () => {
  assert.equal(normalizeGrade("7", "NM 7").gradeNumeric, 7);
});

test("gradeNumeric is null when the number is not in the printed label", () => {
  // e.g. model reported 10 but the label only says "MINT 9"
  assert.deepEqual(normalizeGrade(10, "MINT 9"), { gradeNumeric: null, gradeLabel: "MINT 9" });
});

test("gradeNumeric is null when there is no label (grade not visible, e.g. back of slab)", () => {
  assert.deepEqual(normalizeGrade(9, null), { gradeNumeric: null, gradeLabel: null });
  const r = normalize({ ...base, gradeNumeric: 9, gradeLabel: null });
  assert.equal(r.gradeNumeric, null);
  assert.equal(r.gradeLabel, null);
});

test("label with no number leaves numeric null", () => {
  assert.deepEqual(normalizeGrade(null, "AUTHENTIC"), { gradeNumeric: null, gradeLabel: "AUTHENTIC" });
});

test("rejects non-finite / garbage numerics", () => {
  for (const bad of [NaN, Infinity, "abc", {}, [], undefined]) {
    assert.equal(normalizeGrade(bad, "NM 7").gradeNumeric, null);
  }
});

test("blank label strings become null", () => {
  const r = normalize({ ...base, gradeNumeric: 8, gradeLabel: "   " });
  assert.equal(r.gradeLabel, null);
  assert.equal(r.gradeNumeric, null);
});

test("other fields are still coerced (grader enum, blanks, readable)", () => {
  const r = normalize({ ...base, grader: "psa", player: "", gradeNumeric: 9, gradeLabel: "MINT 9", readable: "yes" });
  assert.equal(r.grader, "PSA");
  assert.equal(r.player, null);
  assert.equal(r.readable, false, "only a literal true counts");
  assert.equal(normalize({ ...base, grader: "CGC", gradeNumeric: null, gradeLabel: null }).grader, null);
});
