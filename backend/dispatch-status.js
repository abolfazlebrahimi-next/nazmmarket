export const SEARCH_WINDOW_MS = 15 * 60000;
export const DECLINE_COOLDOWN_MS = 5 * 60000;
export function dispatchStatus(order, couriers, declines, now = Date.now()) {
  const start =
    order.search_started_at || order.dispatch_started_at || order.created_at;
  if (Number(order.status) !== 3 || order.assigned_courier_id != null)
    return { state: "assigned", eligible: 0, declined: 0 };
  if (order.dispatch_paused)
    return { state: "paused", eligible: 0, declined: 0 };
  if (!start || now - Date.parse(start) >= SEARCH_WINDOW_MS)
    return { state: "timed_out", eligible: 0, declined: 0 };
  // همهٔ سفیرهای آنلاین شهر، بدون توجه به فاصله (کیلومتر)، پیشنهاد را می‌گیرند.
  const eligible = couriers;
  const recent = declines.filter(
    (d) =>
      String(d.order_id) === String(order.id) &&
      now - Date.parse(d.created_at) < DECLINE_COOLDOWN_MS,
  );
  const declined = eligible.filter((c) =>
    recent.some((d) => Number(d.courier_id) === Number(c.id)),
  ).length;
  return {
    state: !eligible.length
      ? "no_couriers"
      : declined === eligible.length
        ? "all_declined"
        : "searching",
    eligible: eligible.length,
    declined,
  };
}
