import test from "node:test";
import assert from "node:assert/strict";
import { dispatchStatus } from "../dispatch-status.js";
const now = Date.now();
const order = {
  id: "test",
  status: 3,
  dispatch_started_at: new Date(now - 60000).toISOString(),
  store_lat: 35.96,
  store_lng: 50.65,
};
const couriers = [
  { id: 1, lat: 35.96, lng: 50.65 },
  { id: 2, lat: 35.96, lng: 50.65 },
];
test("dispatch reports unavailable couriers, active search and all declined truthfully", () => {
  assert.equal(dispatchStatus(order, [], [], now).state, "no_couriers");
  assert.equal(dispatchStatus(order, couriers, [], now).state, "searching");
  const declines = couriers.map((c) => ({
    order_id: "test",
    courier_id: c.id,
    created_at: new Date(now).toISOString(),
  }));
  assert.deepEqual(dispatchStatus(order, couriers, declines, now), {
    state: "all_declined",
    eligible: 2,
    declined: 2,
  });
  assert.equal(
    dispatchStatus(order, couriers, declines, now + 301000).state,
    "searching",
  );
});
test("dispatch stops on pause or fifteen-minute timeout; distance is ignored", () => {
  assert.equal(
    dispatchStatus({ ...order, dispatch_paused: 1 }, couriers, [], now).state,
    "paused",
  );
  assert.equal(
    dispatchStatus(order, couriers, [], now + 15 * 60000).state,
    "timed_out",
  );
  // به کیلومتر دقت نمی‌شود؛ سفیر آنلاین در هر نقطه‌ای واجد شرایط است.
  assert.equal(
    dispatchStatus(order, [{ id: 1, lat: 0, lng: 0 }], [], now).state,
    "searching",
  );
  assert.equal(
    dispatchStatus({ ...order, assigned_courier_id: 2 }, couriers, [], now)
      .state,
    "assigned",
  );
});
