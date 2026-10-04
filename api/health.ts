export default async function handler(_req: any, res: any) {
  try {
    await import('../server.js');
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Health check failed:', error instanceof Error ? error.message : 'unknown');
    res.status(500).json({
      ok: false,
      error: 'الخدمة غير متاحة حالياً.',
    });
  }
}
