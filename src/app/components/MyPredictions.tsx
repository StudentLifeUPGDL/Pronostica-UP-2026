import { useState } from 'react';
import { Plus, Trophy, Trash2, Edit3, Star, ChevronRight, Wrench, Lock } from 'lucide-react';
import { type Prediction, type Results, type PaymentStatus, getTeam } from '../data/worldcup';
import { computeScore } from '../../lib/scoring';
import { leagueLabel } from '../../lib/payment';
import { PaymentCta } from './PaymentCta';

interface MyPredictionsProps {
  predictions: Prediction[];
  results: Results;
  email?: string;
  lockPassed: boolean;
  canSubmit: boolean;
  r32WindowOpen: boolean;
  r16WindowOpen: boolean;
  maxPending: number;
  onNew: () => void;
  onEdit: (prediction: Prediction) => void;
  onDelete: (id: string) => void;
  onFix: (mainPred: Prediction, round: 'r32' | 'r16') => void;
}

const STATUS_STYLE: Record<PaymentStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'PAGO PENDIENTE', color: '#f5a623', bg: 'rgba(245,166,35,0.12)' },
  paid: { label: 'PAGADO', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  void: { label: 'ANULADA', color: '#e63946', bg: 'rgba(230,57,70,0.12)' },
};

function StatusBadge({ status }: { status: PaymentStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color, fontSize: '0.6rem', fontFamily: 'DM Mono', letterSpacing: '0.05em' }}>
      {s.label}
    </span>
  );
}

function PodiumRow({ prediction }: { prediction: Prediction }) {
  const champion = prediction.champion ? getTeam(prediction.champion) : null;
  const runnerUp = prediction.runnerUp ? getTeam(prediction.runnerUp) : null;
  const thirdPlace = prediction.thirdPlace ? getTeam(prediction.thirdPlace) : null;
  if (!champion) return null;
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {[{ label: '🏆', team: champion }, { label: '🥈', team: runnerUp }, { label: '🥉', team: thirdPlace }].map(({ label, team }) =>
        team ? (
          <div key={label} className="flex items-center gap-1.5">
            <span style={{ fontSize: '0.85rem' }}>{label}</span>
            <span>{team.flag}</span>
            <span style={{ fontSize: '0.8rem', color: '#e0f0e8', fontFamily: 'Nunito Sans', fontWeight: 600 }}>{team.shortName}</span>
          </div>
        ) : null,
      )}
    </div>
  );
}

function FixRow({ fix, results, email }: { fix: Prediction; results: Results; email?: string }) {
  const pts = computeScore(fix, results).total;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <Wrench size={14} style={{ color: '#c084fc', flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div style={{ color: '#d8c8f0', fontSize: '0.78rem', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.03em' }}>
          {leagueLabel(fix.league)}
        </div>
        <div className="mt-1"><StatusBadge status={fix.paymentStatus} /></div>
      </div>
      <PaymentCta prediction={fix} email={email} compact />
      <div className="text-right">
        <div style={{ fontFamily: 'Oswald, sans-serif', color: '#c084fc', fontSize: '1rem', fontWeight: 700 }}>{pts}</div>
        <div style={{ color: '#4a7d65', fontSize: '0.58rem', fontFamily: 'DM Mono' }}>PTS</div>
      </div>
    </div>
  );
}

function MainCard({ main, fixes, results, email, lockPassed, r32WindowOpen, r16WindowOpen, onEdit, onDelete, onFix }: {
  main: Prediction;
  fixes: Prediction[];
  results: Results;
  email?: string;
  lockPassed: boolean;
  r32WindowOpen: boolean;
  r16WindowOpen: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onFix: (round: 'r32' | 'r16') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pts = computeScore(main, results).total;
  const createdAt = new Date(main.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  const isPaid = main.paymentStatus === 'paid';
  const hasFix = (round: 'r32' | 'r16') => fixes.some(f => f.league === round);
  const canFixR32 = r32WindowOpen && isPaid && !hasFix('r32');
  const canFixR16 = r16WindowOpen && isPaid && !hasFix('r16');

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.15)' }}>
          <Star size={18} style={{ color: '#f5a623' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontFamily: 'Oswald, sans-serif', color: '#e0f0e8', fontSize: '1rem', letterSpacing: '0.03em' }}>{main.name}</div>
          <div className="flex items-center gap-2 mt-1">
            <span style={{ color: '#4a7d65', fontSize: '0.68rem', fontFamily: 'DM Mono' }}>Creado {createdAt}</span>
            <StatusBadge status={main.paymentStatus} />
          </div>
        </div>
        <div className="text-right">
          <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1.2rem', fontWeight: 700 }}>{pts}</div>
          <div style={{ color: '#4a7d65', fontSize: '0.62rem', fontFamily: 'DM Mono' }}>PTS</div>
        </div>
      </div>

      <div className="px-5 pb-4"><PodiumRow prediction={main} /></div>

      {main.paymentStatus !== 'paid' && (
        <div className="px-5 pb-3">
          <PaymentCta prediction={main} email={email} />
        </div>
      )}

      {fixes.length > 0 && (
        <div className="px-5 pb-3 flex flex-col gap-2">
          {fixes.map(f => <FixRow key={f.id} fix={f} results={results} email={email} />)}
        </div>
      )}

      {(canFixR32 || canFixR16) && (
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          {canFixR32 && (
            <button onClick={() => onFix('r32')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer"
              style={{ background: 'rgba(192,132,252,0.12)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.3)', fontFamily: 'Oswald, sans-serif', fontSize: '0.74rem', letterSpacing: '0.04em' }}>
              <Wrench size={12} /> ARREGLAR R32 (LIGA APARTE)
            </button>
          )}
          {canFixR16 && (
            <button onClick={() => onFix('r16')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer"
              style={{ background: 'rgba(192,132,252,0.12)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.3)', fontFamily: 'Oswald, sans-serif', fontSize: '0.74rem', letterSpacing: '0.04em' }}>
              <Wrench size={12} /> ARREGLAR R16 (LIGA APARTE)
            </button>
          )}
        </div>
      )}
      {(r32WindowOpen || r16WindowOpen) && !isPaid && (
        <div className="px-5 pb-3" style={{ color: '#7eb89a', fontSize: '0.74rem', fontFamily: 'Nunito Sans' }}>
          Confirma el pago de esta quinela para poder comprar un arreglo.
        </div>
      )}

      {expanded && (
        <div className="px-5 pb-4">
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '12px' }} />
          <div style={{ fontFamily: 'Oswald, sans-serif', color: '#7eb89a', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '10px' }}>PICKS DE GRUPOS</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(main.groups).map(([gId, gPick]) => {
              const t1 = gPick.first ? getTeam(gPick.first) : null;
              const t2 = gPick.second ? getTeam(gPick.second) : null;
              return (
                <div key={gId} className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.68rem', marginBottom: '4px', letterSpacing: '0.1em' }}>GR. {gId}</div>
                  {[t1, t2].map((t, i) => t && (
                    <div key={i} className="flex items-center gap-1">
                      <span style={{ fontFamily: 'DM Mono', color: i === 0 ? '#f5a623' : '#d4f226', fontSize: '0.62rem' }}>{i + 1}°</span>
                      <span style={{ fontSize: '0.82rem' }}>{t.flag}</span>
                      <span style={{ fontSize: '0.68rem', color: '#c0d8cc', fontFamily: 'Nunito Sans' }}>{t.shortName}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-5 py-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 cursor-pointer" style={{ color: '#7eb89a', fontFamily: 'DM Mono', fontSize: '0.72rem' }}>
          {expanded ? 'ocultar detalles ▲' : 'ver detalles ▼'}
        </button>
        <div className="flex-1" />
        {lockPassed ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ color: '#4a7d65', fontFamily: 'Oswald, sans-serif', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
            <Lock size={11} /> BLOQUEADA
          </span>
        ) : (
          <>
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: 'rgba(245,166,35,0.1)', color: '#f5a623', fontFamily: 'Oswald, sans-serif', fontSize: '0.75rem', letterSpacing: '0.05em', border: '1px solid rgba(245,166,35,0.2)' }}>
              <Edit3 size={12} /> EDITAR
            </button>
            <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: 'rgba(230,57,70,0.08)', color: '#e63946', fontFamily: 'Oswald, sans-serif', fontSize: '0.75rem', letterSpacing: '0.05em', border: '1px solid rgba(230,57,70,0.15)' }}>
              <Trash2 size={12} /> ELIMINAR
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function MyPredictions({
  predictions, results, email, lockPassed, canSubmit,
  r32WindowOpen, r16WindowOpen, maxPending, onNew, onEdit, onDelete, onFix,
}: MyPredictionsProps) {
  const mains = predictions.filter(p => p.league === 'main');
  const pendingCount = mains.filter(p => p.paymentStatus === 'pending').length;
  const newDisabled = lockPassed || !canSubmit || pendingCount >= maxPending;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1.8rem', fontWeight: 700, letterSpacing: '0.04em' }}>MIS PRONÓSTICOS</h1>
          <p style={{ color: '#7eb89a', fontSize: '0.82rem', marginTop: '4px' }}>
            {mains.length} quinela{mains.length !== 1 ? 's' : ''} · {pendingCount}/{maxPending} con pago pendiente
          </p>
        </div>
        <button
          onClick={onNew}
          disabled={newDisabled}
          title={lockPassed ? 'El torneo ya inició' : !canSubmit ? 'Verifica tu correo' : pendingCount >= maxPending ? `Máximo ${maxPending} pendientes` : ''}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: '#f5a623', color: '#062b1a', fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.05em' }}>
          <Plus size={16} /> NUEVA QUINELA
        </button>
      </div>

      {mains.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#0d5035', border: '2px dashed rgba(245,166,35,0.2)' }}>
          <Trophy size={48} style={{ color: '#2a5a3a', margin: '0 auto 16px' }} />
          <div style={{ fontFamily: 'Oswald, sans-serif', color: '#4a7d65', fontSize: '1.2rem', letterSpacing: '0.05em', marginBottom: '8px' }}>AÚN NO TIENES QUINELAS</div>
          <p style={{ color: '#3a6b55', fontSize: '0.85rem', marginBottom: '20px' }}>Crea tu primer pronóstico antes de que inicie el Mundial.</p>
          <button onClick={onNew} disabled={newDisabled} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl cursor-pointer disabled:opacity-40" style={{ background: '#f5a623', color: '#062b1a', fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '0.9rem' }}>
            <Plus size={18} /> CREAR PRIMERA QUINELA
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {mains.map(main => (
            <MainCard
              key={main.id}
              main={main}
              fixes={predictions.filter(p => p.parentId === main.id)}
              results={results}
              email={email}
              lockPassed={lockPassed}
              r32WindowOpen={r32WindowOpen}
              r16WindowOpen={r16WindowOpen}
              onEdit={() => onEdit(main)}
              onDelete={() => onDelete(main.id)}
              onFix={(round) => onFix(main, round)}
            />
          ))}
        </div>
      )}

      {mains.length > 0 && (
        <div className="mt-6 rounded-xl p-4" style={{ background: 'rgba(13,80,53,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2 mb-2">
            <ChevronRight size={14} style={{ color: '#f5a623' }} />
            <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.85rem', letterSpacing: '0.06em' }}>CÓMO FUNCIONA</span>
          </div>
          <p style={{ color: '#7eb89a', fontSize: '0.8rem' }}>
            Tus puntos se actualizan con los resultados reales. Tras el inicio del torneo puedes comprar
            hasta dos <strong style={{ color: '#c084fc' }}>arreglos</strong> (R32 y R16): cada uno compite en su
            propia liga con premio aparte y requiere un pago adicional. La clasificación general es privada
            del organizador.
          </p>
        </div>
      )}
    </div>
  );
}
