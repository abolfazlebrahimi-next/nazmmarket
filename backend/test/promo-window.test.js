import test from "node:test";
import assert from "node:assert/strict";
import { promoDateBound } from "../promos.js";

/**
 * A discount code's window comes out of a Persian date picker, so the panels
 * speak in days while the store keeps instants. These bounds are what decides
 * whether a code is still offered, whether checkout accepts it, and whether a
 * seller can save "today" as the last valid day.
 */
test("a bare day becomes the whole day, not a single instant", () => {
  assert.equal(promoDateBound("2026-11-10", "start"), "2026-11-10T00:00:00.000Z");
  assert.equal(promoDateBound("2026-11-10", "end"), "2026-11-10T23:59:59.999Z");
  // The end bound must still be live at the last minute of the picked day.
  assert.ok(promoDateBound("2099-01-01", "end") > new Date().toISOString());
});

test("an expiry of today is accepted, an expired day is not", () => {
  const today = new Date().toISOString().slice(0, 10);
  const endOfToday = promoDateBound(today, "end");
  assert.ok(endOfToday > new Date().toISOString(), "today must not be in the past");
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  assert.ok(promoDateBound(yesterday, "end") <= new Date().toISOString());
});

test("an explicit instant is kept and junk is rejected", () => {
  assert.equal(
    promoDateBound("2026-11-10T06:30:00.000Z", "end"),
    "2026-11-10T06:30:00.000Z",
  );
  assert.equal(promoDateBound("", "end"), null);
  assert.equal(promoDateBound(null, "end"), null);
  assert.equal(promoDateBound(undefined, "start"), null);
  assert.equal(promoDateBound("پانزده آبان", "end"), undefined);
});
