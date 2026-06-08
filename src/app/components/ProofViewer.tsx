import { useState } from 'react';
import { X, Download } from 'lucide-react';

// Shows a payment-proof capture. The proof is stored INLINE as a `data:` URL
// (see lib/paymentProof.ts), and browsers block top-level navigation to data:
// URLs — so `<a href={dataUrl} target="_blank">` just opens a blank tab. We
// render the image in an in-app lightbox instead (data URLs work fine as <img
// src>), with a download fallback for keeping a copy.
export function ProofViewer({ url, label = 'ver', note }: { url: string; label?: string; note?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ color: '#60a5fa', fontFamily: "'Twemoji Country Flags', 'DM Mono'", fontSize: '0.72rem', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
        {label}
      </button>

      {open && (
        <div onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(3,20,13,0.82)', backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()}
            className="flex flex-col rounded-2xl overflow-hidden"
            style={{ background: '#0d5035', border: '1px solid rgba(245,166,35,0.25)', maxWidth: '92vw', maxHeight: '92vh' }}>

            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="flex-1" style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#f5a623', fontSize: '0.9rem', letterSpacing: '0.04em' }}>
                COMPROBANTE
              </span>
              <a href={url} download="comprobante.jpg"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer"
                style={{ color: '#d4f226', background: 'rgba(212,242,38,0.1)', border: '1px solid rgba(212,242,38,0.3)', fontFamily: "'Twemoji Country Flags', 'DM Mono'", fontSize: '0.7rem', textDecoration: 'none' }}>
                <Download size={12} /> descargar
              </a>
              <button onClick={() => setOpen(false)} className="cursor-pointer p-1 rounded-lg" style={{ color: '#9cc4b2' }} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-auto" style={{ padding: '12px' }}>
              <img src={url} alt="comprobante de pago" style={{ display: 'block', maxWidth: '100%', maxHeight: '74vh', margin: '0 auto', borderRadius: '8px' }} />
              {note && (
                <p style={{ color: '#9cc4b2', fontSize: '0.78rem', marginTop: '10px', fontFamily: "'Twemoji Country Flags', 'Nunito Sans'", textAlign: 'center' }}>
                  Nota: {note}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
