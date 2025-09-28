import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';

function loadScannerScript() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Html5QrcodeScanner) return resolve();
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/html5-qrcode@2.3.10/minified/html5-qrcode.min.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

// Esperamos algo como https://luma.com/check-in/ev_xxx?pk=g-xxxx (o ticket key)
function parseLumaUrl(text) {
  try {
    const u = new URL(text);
    const parts = u.pathname.split('/').filter(Boolean);
    const eventId = parts.length >= 2 ? parts[1] : undefined; // check-in/<ev_xxx>
    const pk = u.searchParams.get('pk') || undefined;
    return { eventId, pk };
  } catch {
    return {};
  }
}

export default function EventPage() {
  const containerRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | ok | err
  const [msg, setMsg] = useState('');
  const [manual, setManual] = useState('');

  useEffect(() => { loadScannerScript(); }, []);

  const startScan = async () => {
    setMsg(''); setStatus('idle');
    const targetId = 'qr-reader';
    if (!document.getElementById(targetId)) {
      const d = document.createElement('div');
      d.id = targetId;
      containerRef.current?.appendChild(d);
    }
    const scanner = new window.Html5QrcodeScanner(targetId, { fps: 10, qrbox: 250 }, false);
    scanner.render(async (text) => {
      scanner.clear();
      await handleText(text);
    }, () => {});
  };

  const handleText = async (text) => {
    const { eventId, pk } = parseLumaUrl(text);
    if (!eventId || !pk) {
      setStatus('err'); setMsg('Ese QR no parece de Luma. Abre tu ticket desde el email/Wallet.');
      return;
    }
    try {
      setBusy(true);
      const resp = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, pk })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'No se pudo completar el check-in.');
      setStatus('ok'); setMsg('✅ Check-in completado. ¡Gracias!');
    } catch (e) {
      setStatus('err'); setMsg(e?.message || 'Error desconocido');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: '24px auto', fontFamily: 'system-ui' }}>
      <Head><title>Volta | Check-in</title></Head>
      <h1>Check-in Volta</h1>
      <p>Escanea tu QR de Luma aquí 👇</p>

      <div ref={containerRef} />
      <button onClick={startScan} disabled={busy}>
        {busy ? 'Escaneando…' : 'Escanear mi ticket'}
      </button>

      <div style={{ height: 12 }} />
      <details>
        <summary>¿No te lee el QR? Pega el enlace de tu ticket</summary>
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="https://luma.com/check-in/ev_xxx?pk=g-xxxx"
          style={{ width: '100%', padding: 12 }}
        />
        <div style={{ height: 8 }} />
        <button onClick={() => handleText(manual)} disabled={busy}>Enviar</button>
      </details>

      {status === 'ok' && <p style={{ color: 'green' }}>{msg}</p>}
      {status === 'err' && <p style={{ color: 'red' }}>{msg}</p>}

      <hr style={{ margin: '24px 0' }} />
      <p style={{ fontSize: 12, opacity: 0.75 }}>
        Privacidad: este dispositivo no guarda tus datos. Solo enviamos la clave del ticket a nuestros servidores para marcar asistencia.
      </p>
    </main>
  );
}
