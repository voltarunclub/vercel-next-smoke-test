// Marca un invitado como "checked_in" en Luma usando eventId + pk de su ticket
// Requisitos: Variable de entorno LUMA_API_KEY configurada en Vercel

const BASE = 'https://public-api.luma.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { eventId, pk } = req.body || {};
  if (!eventId || !pk) return res.status(400).json({ error: 'Missing eventId or pk' });

  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server not configured: LUMA_API_KEY missing' });

  try {
    // 1) Intento directo: obtener el invitado por pk para ese eventId
    // (Algunas cuentas tienen este endpoint disponible)
    let guestId = null;

    const tryDirect = async () => {
      const url = `${BASE}/v1/event/get-guest?event_id=${encodeURIComponent(eventId)}&pk=${encodeURIComponent(pk)}`;
      const r = await fetch(url, { headers: { 'x-luma-api-key': apiKey } });
      if (r.ok) {
        const data = await r.json();
        guestId = data?.guest_id || data?.id || null;
      }
    };

    // 2) Fallback: listar invitados del evento y buscar la pk entre sus claves conocidas
    const tryList = async () => {
      const url = `${BASE}/v1/event/get-guests?event_id=${encodeURIComponent(eventId)}`;
      const r = await fetch(url, { headers: { 'x-luma-api-key': apiKey } });
      if (!r.ok) return;
      const d = await r.json();
      const guests = Array.isArray(d?.guests) ? d.guests : (Array.isArray(d) ? d : []);
      for (const g of guests) {
        const keys = [];
        if (g?.guest_key) keys.push(g.guest_key);
        if (g?.key) keys.push(g.key);
        if (g?.pk) keys.push(g.pk);
        if (Array.isArray(g?.tickets)) {
          for (const t of g.tickets) {
            if (t?.ticket_key) keys.push(t.ticket_key);
            if (t?.pk) keys.push(t.pk);
          }
        }
        if (keys.includes(pk)) {
          guestId = g?.guest_id || g?.id || null;
          break;
        }
      }
    };

    await tryDirect();
    if (!guestId) await tryList();
    if (!guestId) {
      return res.status(404).json({ error: 'No encontramos tu registro. Verifica que el QR corresponde a este evento.' });
    }

    // 3) Actualizar el estado del invitado
    const body = { event_id: eventId, guest_id: guestId, status: 'checked_in' };
    const r3 = await fetch(`${BASE}/v1/event/update-guest-status`, {
      method: 'POST',
      headers: { 'x-luma-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!r3.ok) {
      const txt = await r3.text();
      return res.status(400).json({ error: `Luma error: ${txt}` });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}

