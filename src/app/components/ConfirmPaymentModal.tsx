import { useEffect, useMemo, useState } from 'react';
import { X, Upload, Loader2, CheckCircle2, ImageUp, Receipt } from 'lucide-react';
import { type Prediction, type Ticket, getTeam } from '../data/worldcup';
import { leagueLabel } from '../../lib/payment';
import { submitPaymentProof } from '../../lib/paymentProof';

interface ConfirmPaymentModalProps {
  open: boolean;
  onClose: () => void;
  uid: string;
  predictions: Prediction[];
  tickets: Ticket[];
  onSubmitted: () => Promise<void> | void;
}

const PANEL = '#0d5035';
const ACCENT = '#f5a623';

// One shared form: the user uploads a single payment screenshot and checks every
// pronóstico/boleto that the transfer covers. On submit, the selected entries flip
// to "CONFIRMANDO PAGO" (review) and the pay button disappears for them.
export function ConfirmPaymentModal({ open, onClose, uid, predictions, tickets, onSubmitted }: ConfirmPaymentModalProps) {
  const pendingPreds = useMemo(() => predictions.filter(p => p.paymentStatus === 'pending'), [predictions]);
  const pendingTickets = useMemo(() => tickets.filter(t => t.paymentStatus === 'pending'), [tickets]);

  // Default: everything pending is selected (most people pay for all at once).
  const [selPreds, setSelPreds] = useState<Set<string>>(() => new Set(pendingPreds.map(p => p.id)));
  const [selTickets, setSelTickets] = useState<Set<string>>(() => new Set(pendingTickets.map(t => t.id)));
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Build (and revoke) the preview object URL only when the chosen file changes.
  useEffect(() => {
    if (!file) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!open) return null;

  const selectedCount = selPreds.size + selTickets.size;
  const nothingPending = pendingPreds.length === 0 && pendingTickets.length === 0;

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  }

  function pickFile(f: File | null) {
    setError('');
    if (f && !f.type.startsWith('image/')) { setError('Sube una imagen (captura o foto del comprobante).'); return; }
    setFile(f);
  }

  async function handleSubmit() {
    setError('');
    if (!file) { setError('Sube la captura de tu comprobante de pago.'); return; }
    if (selectedCount === 0) { setError('Selecciona al menos un pronóstico o boleto que estás pagando.'); return; }
    setBusy(true);
    try {
      await submitPaymentProof({
        uid, file, note,
        selection: { predictionIds: [...selPreds], ticketIds: [...selTickets] },
      });
      await onSubmitted();
      setDone(true);
    } catch (e) {
      setError((e as Error).message || 'No se pudo enviar el comprobante. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(3,20,13,0.72)', backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
        style={{ background: PANEL, border: '1px solid rgba(245,166,35,0.25)' }}>

        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 sticky top-0" style={{ background: PANEL, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <Receipt size={18} style={{ color: ACCENT }} />
          <span className="flex-1" style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: ACCENT, fontSize: '1.05rem', letterSpacing: '0.04em' }}>
            CONFIRMAR PAGO
          </span>
          <button onClick={onClose} className="cursor-pointer p-1 rounded-lg" style={{ color: '#9cc4b2' }} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center flex flex-col items-center gap-3">
            <CheckCircle2 size={44} style={{ color: '#4ade80' }} />
            <div style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#e0f0e8', fontSize: '1.1rem', letterSpacing: '0.03em' }}>
              ¡COMPROBANTE ENVIADO!
            </div>
            <p style={{ color: '#9cc4b2', fontSize: '0.85rem', lineHeight: 1.5, maxWidth: '340px' }}>
              Tus entradas quedaron en <strong style={{ color: ACCENT }}>CONFIRMANDO PAGO</strong>. El organizador verificará tu
              transferencia y las marcará como pagadas. No necesitas hacer nada más.
            </p>
            <button onClick={onClose} className="mt-2 px-5 py-2.5 rounded-xl cursor-pointer"
              style={{ background: ACCENT, color: '#062b1a', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.05em' }}>
              LISTO
            </button>
          </div>
        ) : nothingPending ? (
          <div className="px-6 py-10 text-center" style={{ color: '#9cc4b2', fontSize: '0.88rem' }}>
            No tienes pagos pendientes por confirmar. 🎉
          </div>
        ) : (
          <div className="px-5 py-4 flex flex-col gap-5">
            <p style={{ color: '#9cc4b2', fontSize: '0.82rem', lineHeight: 1.5 }}>
              Ya que pagaste en la app, sube aquí la <strong style={{ color: '#e0f0e8' }}>captura del comprobante</strong> y marca
              qué estás pagando. El organizador lo verifica y confirma tu pago.
            </p>

            {/* ── 1. Upload ── */}
            <div className="flex flex-col gap-2">
              <span style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: ACCENT, fontSize: '0.78rem', letterSpacing: '0.06em' }}>
                1 · COMPROBANTE
              </span>
              <label className="cursor-pointer rounded-xl flex items-center gap-3 px-4 py-3 transition-all"
                style={{ background: 'rgba(212,242,38,0.06)', border: '1px dashed rgba(212,242,38,0.4)' }}>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => pickFile(e.target.files?.[0] ?? null)} />
                {previewUrl ? (
                  <img src={previewUrl} alt="comprobante" className="rounded-lg" style={{ width: '52px', height: '52px', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: '52px', height: '52px', background: 'rgba(212,242,38,0.1)' }}>
                    <ImageUp size={22} style={{ color: '#d4f226' }} />
                  </div>
                )}
                <div className="min-w-0">
                  <div style={{ color: '#d4f226', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontSize: '0.82rem', letterSpacing: '0.03em' }}>
                    {file ? 'CAMBIAR IMAGEN' : 'SUBIR CAPTURA / FOTO'}
                  </div>
                  <div className="truncate" style={{ color: '#7eb89a', fontSize: '0.72rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'" }}>
                    {file ? file.name : 'PNG o JPG · captura de la transferencia'}
                  </div>
                </div>
              </label>
            </div>

            {/* ── 2. Which entries ── */}
            <div className="flex flex-col gap-2">
              <span style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: ACCENT, fontSize: '0.78rem', letterSpacing: '0.06em' }}>
                2 · ¿QUÉ ESTÁS PAGANDO? ({selectedCount})
              </span>

              {pendingPreds.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span style={{ color: '#7eb89a', fontSize: '0.68rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'", letterSpacing: '0.05em' }}>PRONÓSTICOS</span>
                  {pendingPreds.map(p => (
                    <Row key={p.id} checked={selPreds.has(p.id)} onToggle={() => toggle(selPreds, p.id, setSelPreds)}
                      folio={p.id} title={p.name} subtitle={leagueLabel(p.league)} />
                  ))}
                </div>
              )}

              {pendingTickets.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <span style={{ color: '#7eb89a', fontSize: '0.68rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'", letterSpacing: '0.05em' }}>QUINIELA · BOLETOS</span>
                  {pendingTickets.map(t => (
                    <Row key={t.id} checked={selTickets.has(t.id)} onToggle={() => toggle(selTickets, t.id, setSelTickets)}
                      folio={t.id} title={t.teamId ? getTeam(t.teamId).name : 'Boleto · equipo por asignar'} subtitle="Quiniela" />
                  ))}
                </div>
              )}
            </div>

            {/* ── 3. Optional note ── */}
            <div className="flex flex-col gap-2">
              <span style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: ACCENT, fontSize: '0.78rem', letterSpacing: '0.06em' }}>
                3 · NOTA (OPCIONAL)
              </span>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Ej. referencia, banco o nombre de quien transfirió…"
                className="rounded-xl px-3 py-2 resize-none"
                style={{ background: '#0b4730', color: '#e0f0e8', border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'Twemoji Country Flags', 'Nunito Sans'", fontSize: '0.82rem' }} />
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.25)', color: '#e63946', fontSize: '0.8rem' }}>
                {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={busy || !file || selectedCount === 0}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: ACCENT, color: '#062b1a', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em' }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {busy ? 'ENVIANDO…' : 'ENVIAR COMPROBANTE'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ checked, onToggle, folio, title, subtitle }: {
  checked: boolean; onToggle: () => void; folio: string; title: string; subtitle: string;
}) {
  return (
    <button onClick={onToggle} type="button"
      className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-left transition-all"
      style={{
        background: checked ? 'rgba(245,166,35,0.1)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${checked ? 'rgba(245,166,35,0.35)' : 'rgba(255,255,255,0.07)'}`,
      }}>
      <span className="flex items-center justify-center rounded-md flex-shrink-0"
        style={{ width: '20px', height: '20px', background: checked ? ACCENT : 'transparent', border: `1.5px solid ${checked ? ACCENT : 'rgba(255,255,255,0.25)'}` }}>
        {checked && <CheckCircle2 size={14} style={{ color: '#062b1a' }} />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ color: '#e0f0e8', fontSize: '0.84rem', fontFamily: "'Twemoji Country Flags', 'Nunito Sans'", fontWeight: 600 }}>{title}</div>
        <div style={{ color: '#7eb89a', fontSize: '0.68rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'" }}>{subtitle}</div>
      </div>
      <span className="flex-shrink-0" style={{ color: '#d4f226', fontSize: '0.7rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'" }}>{folio}</span>
    </button>
  );
}
