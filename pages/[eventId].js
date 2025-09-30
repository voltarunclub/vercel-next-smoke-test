function loadScannerScript() {
  const sources = [
    'https://unpkg.com/html5-qrcode@2.3.10/minified/html5-qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.10/minified/html5-qrcode.min.js',
    'https://esm.sh/html5-qrcode@2.3.10?bundle' // fallback ESM
  ];

  return new Promise(async (resolve, reject) => {
    if (typeof window !== 'undefined' && window.Html5QrcodeScanner) return resolve();

    let lastErr = null;
    for (const src of sources) {
      try {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = src;
          s.async = true;

          // por si el CDN responde pero no descarga (red lenta/bloqueada)
          const to = setTimeout(() => rej(new Error('timeout')), 6000);

          s.onload = () => { clearTimeout(to); res(); };
          s.onerror = () => { clearTimeout(to); rej(new Error('network')); };

          document.body.appendChild(s);
        });
        if (window.Html5QrcodeScanner) return resolve();
      } catch (e) {
        lastErr = e;
      }
    }
    reject(lastErr || new Error('No se pudo cargar el lector'));
  });
}
