import { useState } from 'react';
import { MailWarning, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '../../lib/auth';

// Shown while the signed-in user has not verified their email. They can browse
// read-only pages but cannot create or edit predictions until verified.
export function VerifyEmailNotice() {
  const { user, resendVerification, reloadUser } = useAuth();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true); setMsg('');
    try {
      await resendVerification();
      setMsg('Correo de verificación reenviado. Revisa tu bandeja y la carpeta de spam.');
    } catch {
      setMsg('No se pudo reenviar ahora. Espera un momento e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  async function recheck() {
    setBusy(true); setMsg('');
    try {
      await reloadUser();
      setMsg('Si ya confirmaste, la app se desbloqueará. Si sigues viendo esto, vuelve a intentar en unos segundos.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pt-5">
      <div className="rounded-xl p-4" style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.25)' }}>
        <div className="flex items-start gap-3">
          <MailWarning size={20} style={{ color: '#f5a623', flexShrink: 0, marginTop: '2px' }} />
          <div className="flex-1">
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.95rem', letterSpacing: '0.04em' }}>
              VERIFICA TU CORREO
            </div>
            <p style={{ color: '#c0d8cc', fontSize: '0.82rem', marginTop: '4px', fontFamily: 'Nunito Sans' }}>
              Enviamos un enlace de verificación a <strong style={{ color: '#e0f0e8' }}>{user?.email}</strong>.
              Confírmalo para poder crear y guardar tus quinelas.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={recheck} disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                style={{ background: '#f5a623', color: '#062b1a', fontFamily: 'Oswald, sans-serif', fontSize: '0.78rem', letterSpacing: '0.05em', fontWeight: 700 }}>
                <RefreshCw size={13} /> YA VERIFIQUÉ
              </button>
              <button onClick={resend} disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                style={{ background: 'rgba(245,166,35,0.12)', color: '#f5a623', fontFamily: 'Oswald, sans-serif', fontSize: '0.78rem', letterSpacing: '0.05em', border: '1px solid rgba(245,166,35,0.25)' }}>
                <Send size={13} /> REENVIAR CORREO
              </button>
            </div>
            {msg && <p style={{ color: '#9cc4b2', fontSize: '0.76rem', marginTop: '8px', fontFamily: 'Nunito Sans' }}>{msg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
