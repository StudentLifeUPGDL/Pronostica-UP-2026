import { useState } from 'react';
import { Trophy, Mail, Lock, User, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';

type Tab = 'login' | 'signup' | 'reset';

function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email': return 'El correo no es válido.';
    case 'auth/missing-password': return 'Ingresa tu contraseña.';
    case 'auth/weak-password': return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/email-already-in-use': return 'Ya existe una cuenta con ese correo. Inicia sesión.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Correo o contraseña incorrectos.';
    case 'auth/too-many-requests': return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
    case 'auth/network-request-failed': return 'Error de red. Revisa tu conexión.';
    default: return (err as { message?: string })?.message ?? 'Ocurrió un error. Inténtalo de nuevo.';
  }
}

const inputStyle = {
  background: '#0b4730',
  border: '1px solid rgba(245,166,35,0.3)',
  color: '#f0f7f2',
  fontFamily: 'Nunito Sans, sans-serif',
  fontSize: '0.95rem',
} as const;

function Field({ icon, ...props }: { icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative mb-3">
      <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#7eb89a' }}>{icon}</div>
      <input
        {...props}
        className="w-full pl-10 pr-4 py-3 rounded-lg outline-none transition-all"
        style={inputStyle}
      />
    </div>
  );
}

export function AuthPage() {
  const { signUp, logIn, resetPassword } = useAuth();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  function switchTab(t: Tab) {
    setTab(t); setError(''); setSuccess('');
  }

  async function handleSubmit() {
    setError(''); setSuccess('');
    if (!email.trim()) { setError('Ingresa tu correo.'); return; }
    setBusy(true);
    try {
      if (tab === 'login') {
        await logIn(email, password);
      } else if (tab === 'signup') {
        if (displayName.trim().length < 2) { setError('Ingresa tu nombre.'); setBusy(false); return; }
        if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); setBusy(false); return; }
        await signUp(email, password, displayName);
        setSuccess('¡Cuenta creada! Te enviamos un correo de verificación. Revísalo (y la carpeta de spam).');
      } else {
        await resetPassword(email);
        setSuccess('Te enviamos un enlace para restablecer tu contraseña.');
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'login', label: 'Entrar' },
    { key: 'signup', label: 'Crear cuenta' },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative" style={{ background: '#0a3d28' }}>
      <div className="absolute top-0 left-0 right-0 h-2" style={{ background: 'repeating-linear-gradient(90deg, #f5a623 0px, #f5a623 8px, #d4f226 8px, #d4f226 16px, #0a3d28 16px, #0a3d28 24px)' }} />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 shadow-xl" style={{ background: 'linear-gradient(135deg, #f5a623, #e8890f)' }}>
            <Trophy size={36} style={{ color: '#062b1a' }} />
          </div>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '2.4rem', fontWeight: 700, letterSpacing: '0.05em', lineHeight: 1 }}>PRONOSTICA PANTERA</h1>
          <p style={{ fontFamily: 'Oswald, sans-serif', color: '#7eb89a', fontSize: '1rem', letterSpacing: '0.2em' }}>MUNDIAL FIFA 2026</p>
          <p style={{ fontFamily: 'Oswald, sans-serif', color: '#d4f226', fontSize: '0.8rem', letterSpacing: '0.18em', marginTop: '6px' }}>UNIVERSIDAD PANAMERICANA</p>
          <p style={{ color: '#9cc4b2', fontSize: '0.85rem', marginTop: '8px' }}>Estados Unidos · Canadá · México</p>
        </div>

        <div className="rounded-xl p-6 shadow-2xl" style={{ background: '#0d5035', border: '1px solid rgba(245,166,35,0.2)' }}>
          {tab !== 'reset' && (
            <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.18)' }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => switchTab(t.key)}
                  className="flex-1 py-2 rounded-md cursor-pointer transition-all"
                  style={{
                    fontFamily: 'Oswald, sans-serif', fontSize: '0.85rem', letterSpacing: '0.05em',
                    background: tab === t.key ? '#f5a623' : 'transparent',
                    color: tab === t.key ? '#062b1a' : '#9cc4b2',
                    fontWeight: 700,
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {tab === 'reset' && (
            <div className="flex items-center gap-2 mb-4">
              <Lock size={16} style={{ color: '#f5a623' }} />
              <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1rem', letterSpacing: '0.05em' }}>RECUPERAR CONTRASEÑA</span>
            </div>
          )}

          {tab === 'signup' && (
            <Field icon={<User size={16} />} type="text" value={displayName}
              onChange={e => setDisplayName(e.target.value)} placeholder="Tu nombre" maxLength={40} autoComplete="name" />
          )}

          <Field icon={<Mail size={16} />} type="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" autoComplete="email"
            onKeyDown={e => e.key === 'Enter' && tab === 'reset' && handleSubmit()} />

          {tab !== 'reset' && (
            <Field icon={<Lock size={16} />} type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Contraseña"
              autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          )}

          {error && (
            <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.25)' }}>
              <AlertCircle size={14} style={{ color: '#e63946', marginTop: '2px', flexShrink: 0 }} />
              <span style={{ color: '#e63946', fontSize: '0.8rem' }}>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)' }}>
              <CheckCircle2 size={14} style={{ color: '#4ade80', marginTop: '2px', flexShrink: 0 }} />
              <span style={{ color: '#4ade80', fontSize: '0.8rem' }}>{success}</span>
            </div>
          )}

          <button onClick={handleSubmit} disabled={busy}
            className="w-full py-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #f5a623, #e8890f)', color: '#062b1a', fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em' }}>
            {busy ? 'PROCESANDO…' : tab === 'login' ? 'ENTRAR' : tab === 'signup' ? 'CREAR CUENTA' : 'ENVIAR ENLACE'}
            {!busy && <ChevronRight size={18} />}
          </button>

          <div className="mt-4 text-center text-xs" style={{ color: '#7eb89a', fontFamily: 'Nunito Sans' }}>
            {tab === 'login' && (
              <button onClick={() => switchTab('reset')} className="cursor-pointer" style={{ color: '#9cc4b2', textDecoration: 'underline' }}>
                ¿Olvidaste tu contraseña?
              </button>
            )}
            {tab === 'reset' && (
              <button onClick={() => switchTab('login')} className="cursor-pointer" style={{ color: '#9cc4b2', textDecoration: 'underline' }}>
                ← Volver a iniciar sesión
              </button>
            )}
          </div>
        </div>

        <p className="text-center mt-6" style={{ color: '#4a7d65', fontSize: '0.72rem' }}>
          48 equipos · 12 grupos · 64 partidos · 1 campeón
        </p>
      </div>
    </div>
  );
}
