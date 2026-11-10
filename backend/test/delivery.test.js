import test from "node:test";
import assert from "node:assert/strict";
import { distanceKm, deliveryQuote, validPoint } from "../delivery.js";
test("normal delivery always costs between 50k and 80k, including heavy long trips", () => {
  for (const km of [0, 0.01, 0.1, 1, 10, 40])
    for (const weightKg of [0.1, 0.5, 4, 20, 200]) {
      const q = deliveryQuote({
        from: { lat: 35, lng: 50 },
        to: { lat: 35 + km, lng: 50 },
        weightKg,
      });
      assert.ok(q.fee >= 50000 && q.fee <= 80000);
      assert.equal(q.estimated, true);
    }
});
test("rain and snow are capped at 100k; distance, time and weight raise the tariff", () => {
  for (const weather of ["rain", "snow"]) {
    const quote = deliveryQuote({
      from: { lat: 35, lng: 50 },
      to: { lat: 36, lng: 51 },
      weightKg: 100,
      weather,
    });
    assert.equal(quote.fee, 100000);
  }
  const a = deliveryQuote({
    from: { lat: 35, lng: 50 },
    to: { lat: 35, lng: 50 },
    weightKg: 1,
  });
  const b = deliveryQuote({
    from: { lat: 35, lng: 50 },
    to: { lat: 35.03, lng: 50 },
    weightKg: 5,
  });
  assert.ok(b.fee > a.fee);
  assert.ok(b.minutes > a.minutes);
});
test("missing coordinates are explicit, not a fabricated route", () => {
  const q = deliveryQuote();
  assert.equal(q.fee, 50000);
  assert.equal(q.locationMissing, true);
  assert.equal(q.distanceKm, null);
  assert.equal(distanceKm({ lat: null, lng: 50 }, { lat: 35, lng: 50 }), null);
  assert.equal(validPoint(95, 50), false);
  assert.equal(distanceKm({ lat: 35, lng: 50 }, { lat: 35, lng: 50 }), 0);
});
