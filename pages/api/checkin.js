export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { eventId, pk } = req.body || {};
  if (!eventId || !pk) return res.status(400).json({ error: 'Missing eventId or pk' });

  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server not configured: LUMA_API_KEY missing' });

  try {
    // 🔑 Aquí deberías llamar a la API de Luma de verdad:
    // 1) Buscar el guest/ticket usando eventId + pk
    // 2) Llamar a update-guest-status con status=checked_in
    // De momento, simulamos éxito para probar el flujo.
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
