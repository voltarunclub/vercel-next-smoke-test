import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';

function loadScannerScript() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Html5QrcodeScanner) return resolve();
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/html5-qrcode@2.3.10/minified/html5-qrcode.min.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar el lector de QR'));
    document.body.appendChild(s);
  });
}

function parseLumaUrl(text) {
  try {
    const u = new URL(text);
    const parts = u.pathname.split('/').filter(Boolean);
    let eventId;
    if (parts[0] === 'check-in' && parts[1]) eventId = parts[1];         // ev_xxx
    else if (parts[0] === 'e' && parts[1] === 'ticket' && parts[2]) eventId = parts[2]; // evt-xxx
    const pk = u.searchParams.get('pk') || undefined;
    return { eventId, pk };
  } catch { return {}; }
}

export default function EventPage() {
  const containerRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | ok | err
  const [msg, setMsg] = useState('');
  const [manual, setManual] = useState('');

  useEffect(() => {
    // Pre-cargar el script en segundo plano; ignoramos errores aquí
    loadScannerScript().catch(() => {});
  }, []);

  const startScan = async () => {
    try {
      setMsg(''); setStatus('idle'); setBusy(true);

      // 1) Asegura que el script está cargado
      await loadScannerScript();
      if (!window.Html5QrcodeScanner) {
        throw new Error('Lector no disponible. Recarga la página e intenta de nuevo.');
      }

      // 2) Crear contenedor si no existe
      const targetId = 'qr-reader';
      if (!document.getElementById(targetId)) {
        const d = document.createElement('div');
        d.id = targetId;
        containerRef.current?.appendChild(d);
      }

      // 3) Lanzar el escáner (esto pedirá permiso de cámara)
      const scanner = new window.Html5QrcodeScanner(
        targetId,
        { fps: 10, qrbox: 250 },
        /* verbose */ false
      );

      scanner.render(
        async (text) => { // onSuccess
          try {
            await handleText(text);
          } finally {
            // limpiar el escáner para poder volver a pulsar el botón
            scanner.clear().catch(()=>{});
            document.getElementById(targetId)?.remove();
            setBusy(false);
          }
        },
        (err) => {
          // onError del escaneo continuo (ruido); no lo mostramos al usuario
          // console.debug(err);
        }
      );
    } catch (e) {
      setStatus('err');
      setMsg(e?.message || 'No se pudo iniciar la cámara. Revisa permisos.');
      setBusy(false);
    }
  };

  const handleText = async (text) => {
    const { eventId, pk } = parseLumaUrl(text);
    if (!eventId || !pk) {
      setStatus('err'); setMsg('Ese QR no parece de Luma. Abre tu ticket desde el email/Wallet.');
      return;
    }
    const resp = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, pk })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || 'No se pudo completar el check-in.');
    setStatus('ok'); setMsg('✅ Check-in completado. ¡Gracias!');
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
          placeholder="https://luma.com/check-in/ev_xxx?pk=g-xxxx  o  https://luma.com/e/ticket/evt-xxx?pk=g-xxxx"
          style={{ width: '100%', padding: 12 }}
        />
        <div style={{ height: 8 }} />
        <button onClick={() => handleText(manual)} disabled={busy}>Enviar</button>
      </details>

      {status === 'ok' && <p style={{ color: 'green' }}>{msg}</p>}
      {status === 'err' && <p style={{ color: 'red' }}>{msg}</p>}

      <hr style={{ margin: '24px 0' }} />
      <ul style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.4 }}>
        <li>La página debe abrirse bajo <b>https://</b> y aceptar permisos de cámara.</li>
        <li>Si estás en iPhone, usa Safari o Chrome (no pestaña privada).</li>
        <li>Si no aparece el cuadro del escáner tras pulsar, recarga la página y acepta permisos.</li>
      </ul>
    </main>
  );
}
