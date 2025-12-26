export default async function handler(req, res) {
  try {
    // (Opcional) consultar pago con req.body?.data?.id
    res.status(200).json({ ok: true }); // idempotente
  } catch {
    res.status(200).json({ ok: true });
  }
}
