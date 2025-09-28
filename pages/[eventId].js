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

function parseLumaUrl(text) {
  try {
    const u = new URL(text);
    const parts = u.pathname.split('/').filter(Boolean);
    const eventId = parts.length >= 2 ? parts[1] : undefined;
    const pk = u.searchParams.get('pk') || undefined;
    return { eventId, pk };
  } catch {
    return {};
  }
}

export default function EventPage() {
  const containerRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadScannerScript(); }, []);

  const startScan = async () => {
    setMessage('');
    setStatus('idle');
    const id = 'qr-reader';
    if (!document.getElementById(id)) {
      const d = document.createElement('div');
      d.id = id;
      containerRef.current?.appendChild(d);
    }
    const scanner = new window.Html5QrcodeScanner(id, { fps: 10, qrbox: 250 }, false);
    scanner.render(async (text) => {
      scanner.clear();
      await handleText(text);
    }, () => {});
  };

  const handleText = async (text) => {
    const { eventId, pk } = parseLumaUrl(text);
    if (!eventId || !pk) {
      setStatus('error');
      setMessage('Ese QR no parece de Luma. Abre tu ticket desde el email.');
      return;
    }
    try {
      setBusy(true);
      const resp = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, pk }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Error desconocido');
      setStatus('success');
      setMessage('✅ Check-in completado, gracias!');
    } catch (e) {
      setStatus('error');
      setMessage(e.message || 'No se pudo completar el check-in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: '24px auto', fontFamily: 'system-ui' }}>
      <Head><title>Volta | Check-in</title></Head>
      <h1>Check-in Volta</h1>
      <p>Escanea tu QR de Luma aquí 👇</p>
      <div ref={containerRef}/>
      <button onClick={startScan} disabled={busy}>
        {busy ? 'Escaneando…' : 'Escanear mi ticket'}
      </button>
      {status === 'success' && <p style={{ color: 'green' }}>{message}</p>}
      {status === 'error' && <p style={{ color: 'red' }}>{message}</p>}
    </main>
  );
}
