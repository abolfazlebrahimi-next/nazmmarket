export async function notifyCourier(
  tx,
  courierId,
  { key, kind, title, body, target },
) {
  await tx.run(
    "INSERT IGNORE INTO courier_notifications (courier_id,event_key,kind,title,body,target,created_at) VALUES (?,?,?,?,?,?,?)",
    [courierId, key, kind, title, body, target, new Date().toISOString()],
  );
}
