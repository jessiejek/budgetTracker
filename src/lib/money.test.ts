import test from "node:test";
import assert from "node:assert/strict";
import { parseAmount, monthKey, money } from "./money.ts";
test("amounts preserve centavos", () => {
  assert.equal(parseAmount("150.25"), 150.25);
  assert.equal(parseAmount("0.01"), 0.01);
});
test("invalid amounts are rejected", () => {
  for (const v of ["", "0", "-1", "NaN", "1.001", "1e3", "1000000000"])
    assert.throws(() => parseAmount(v));
});
test("month keys and peso formatting", () => {
  assert.equal(monthKey("2026-11-08"), "2026-11-01");
  assert.match(money(12480), /12,480.00/);
});
