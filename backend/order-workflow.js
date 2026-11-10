export const ORDER = Object.freeze({
  CANCELLED: 0,
  PLACED: 1,
  PREPARING: 2,
  READY: 3,
  SHIPPING: 4,
  COMPLETED: 5,
});
export async function recordOrderEvent(tx, orderId, status, role, actorId) {
  await tx.run(
    "INSERT INTO order_events (order_id,status,actor_role,actor_id,created_at) VALUES (?,?,?,?,?)",
    [orderId, status, role, actorId, new Date().toISOString()],
  );
}
export function allowedTransition(role, from, to) {
  return role === "seller"
    ? (from === 1 && to === 2) || (from === 2 && to === 3)
    : role === "courier"
      ? (from === 3 && to === 4) || (from === 4 && to === 5)
      : role === "customer"
        ? from === 1 && to === 0
        : false;
}
