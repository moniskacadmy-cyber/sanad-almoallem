export default async function handler(_req: any, res: any) {
  try {
    await import('../server.js');
    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({
      name: e?.name,
      code: e?.code,
      message: String(e?.message).slice(0, 400),
    });
  }
}
