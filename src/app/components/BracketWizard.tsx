import { useState, useMemo, Dispatch, SetStateAction } from 'react';
import {
  ChevronLeft, ChevronRight, Save, Check, Trophy, Star,
  XCircle, MapPin, Calendar, Lock, AlertCircle,
} from 'lucide-react';
import {
  GROUPS, OFFICIAL_R32, R16_PAIRS, QF_PAIRS, SF_PAIRS,
  getTeam, Prediction, GroupPick, TeamSlot,
} from '../data/worldcup';

// ─── Step config ──────────────────────────────────────────────────────────────

type Step = 'grupos' | 'terceros' | 'r32' | 'r16' | 'qf' | 'sf' | 'final';
const STEPS: Step[] = ['grupos', 'terceros', 'r32', 'r16', 'qf', 'sf', 'final'];
const STEP_LABELS: Record<Step, string> = {
  grupos:   'GRUPOS',
  terceros: '3° LUGAR',
  r32:      'DIECISÉISAVOS',
  r16:      'OCTAVOS',
  qf:       'CUARTOS',
  sf:       'SEMIFINAL',
  final:    'FINAL',
};

interface BracketWizardProps {
  userId: string;
  userEmail?: string;
  userDisplayName?: string;
  mode?: 'main' | 'fixR32' | 'fixR16';
  basePrediction?: Prediction | null;   // edit source (main) or prefill base (fix)
  parentMainId?: string;                 // MAIN entry a fix derives from
  onSave: (prediction: Prediction) => void;
  onCancel: () => void;
  predictionName?: string;
}

// ─── BracketWizard ────────────────────────────────────────────────────────────

export function BracketWizard({
  userId, userEmail, userDisplayName,
  mode = 'main', basePrediction, parentMainId,
  onSave, onCancel, predictionName = 'Mi Quinela',
}: BracketWizardProps) {
  const name = mode === 'main' ? (basePrediction?.name ?? predictionName) : predictionName;
  // In a fix, earlier phases are frozen; the user only re-picks from the fix round on.
  const lockedSteps: Step[] = mode === 'fixR32' ? ['grupos', 'terceros']
    : mode === 'fixR16' ? ['grupos', 'terceros', 'r32']
    : [];
  const firstEditable: Step = mode === 'fixR32' ? 'r32' : mode === 'fixR16' ? 'r16' : 'grupos';
  const isLocked = (s: Step) => lockedSteps.includes(s);
  const [step, setStep] = useState<Step>(firstEditable);
  const [activeGroup, setActiveGroup] = useState('A');
  const [navError, setNavError] = useState('');

  // ─── Prediction state ─────────────────────────────────────────────────────

  const [groups,         setGroups]        = useState<Record<string, GroupPick>>(basePrediction?.groups ?? {});
  const [elim3rd,        setElim3rd]       = useState<string[]>(basePrediction?.eliminatedThird ?? []);
  const [r32Thirds,      setR32Thirds]     = useState<Record<string, string>>(basePrediction?.r32Thirds ?? {});
  const [r32,            setR32]           = useState<Record<string, string>>(basePrediction?.r32 ?? {});
  const [r16,            setR16]           = useState<Record<string, string>>(basePrediction?.r16 ?? {});
  const [qf,             setQf]            = useState<Record<string, string>>(basePrediction?.qf ?? {});
  const [sf,             setSf]            = useState<Record<string, string>>(basePrediction?.sf ?? {});
  const [champion,       setChampion]      = useState(basePrediction?.champion ?? '');
  const [runnerUp,       setRunnerUp]      = useState(basePrediction?.runnerUp ?? '');
  const [thirdPlace,     setThirdPlace]    = useState(basePrediction?.thirdPlace ?? '');

  // ─── Derived data ─────────────────────────────────────────────────────────

  const allThirds = useMemo(() =>
    GROUPS.map(g => ({ group: g.id, teamId: groups[g.id]?.third ?? '' })).filter(t => t.teamId),
    [groups],
  );

  const advancingThirds = useMemo(() =>
    allThirds.filter(t => !elim3rd.includes(t.teamId)),
    [allThirds, elim3rd],
  );

  // Resolve a slot to a team ID
  function resolveSlot(slot: TeamSlot, matchId: string): string | undefined {
    if (slot.type === 'pos') {
      const pick = groups[slot.group];
      if (!pick) return undefined;
      return (slot.pos === 1 ? pick.first : pick.second) || undefined;
    }
    return r32Thirds[matchId] || undefined;
  }

  // ─── Step completion ──────────────────────────────────────────────────────

  function gruposComplete() {
    return GROUPS.every(g => {
      const p = groups[g.id];
      return p?.first && p?.second && p?.third;
    });
  }
  function tercerosComplete() { return elim3rd.length === 4; }
  function r32Complete() {
    return OFFICIAL_R32.every(m => {
      if (m.away.type === 'best3rd' && !r32Thirds[m.id]) return false;
      return !!r32[m.id];
    });
  }
  function r16Complete() { return R16_PAIRS.every(p => r16[p.id]); }
  function qfComplete()  { return QF_PAIRS.every(p => qf[p.id]); }
  function sfComplete()  { return SF_PAIRS.every(p => sf[p.id]); }
  function finalComplete(){ return !!champion; }

  function isStepComplete(s: Step): boolean {
    switch (s) {
      case 'grupos':   return gruposComplete();
      case 'terceros': return tercerosComplete();
      case 'r32':      return r32Complete();
      case 'r16':      return r16Complete();
      case 'qf':       return qfComplete();
      case 'sf':       return sfComplete();
      case 'final':    return finalComplete();
    }
  }

  // A step is accessible if all previous steps are complete
  function isStepAccessible(s: Step): boolean {
    const idx = STEPS.indexOf(s);
    for (let i = 0; i < idx; i++) {
      if (!isStepComplete(STEPS[i])) return false;
    }
    return true;
  }

  function getMissingMessage(s: Step): string {
    switch (s) {
      case 'grupos': {
        const miss = GROUPS.filter(g => { const p = groups[g.id]; return !p?.first || !p?.second || !p?.third; });
        return `Completa los grupos: ${miss.map(g => g.id).join(', ')}`;
      }
      case 'terceros':
        return `Elimina ${4 - elim3rd.length} equipo(s) más`;
      case 'r32': {
        const unassigned = OFFICIAL_R32.filter(m => m.away.type === 'best3rd' && !r32Thirds[m.id]);
        if (unassigned.length > 0)
          return `Asigna el 3° lugar en: ${unassigned.map(m => `P${m.matchNum}`).join(', ')}`;
        const unpicked = OFFICIAL_R32.filter(m => !r32[m.id]);
        return `Selecciona el ganador de ${unpicked.length} partido(s)`;
      }
      case 'r16': {
        const n = R16_PAIRS.filter(p => !r16[p.id]).length;
        return `Selecciona ${n} ganador(es) de octavos`;
      }
      case 'qf': {
        const n = QF_PAIRS.filter(p => !qf[p.id]).length;
        return `Selecciona ${n} ganador(es) de cuartos`;
      }
      case 'sf': {
        const n = SF_PAIRS.filter(p => !sf[p.id]).length;
        return `Selecciona ${n} finalista(s)`;
      }
      case 'final': return 'Selecciona al campeón del mundo';
    }
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  const stepIdx = STEPS.indexOf(step);

  function handleNext() {
    if (!isStepComplete(step)) {
      setNavError(getMissingMessage(step));
      return;
    }
    setNavError('');
    if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1]);
  }

  function handlePrev() {
    setNavError('');
    if (stepIdx > 0) setStep(STEPS[stepIdx - 1]);
  }

  function handleStepClick(s: Step) {
    if (!isStepAccessible(s) && STEPS.indexOf(s) > stepIdx) {
      setNavError(getMissingMessage(step));
      return;
    }
    setNavError('');
    setStep(s);
  }

  function handleSave() {
    const isMainEdit = mode === 'main' && !!basePrediction && basePrediction.league === 'main';
    const league: 'main' | 'r32' | 'r16' = mode === 'fixR32' ? 'r32' : mode === 'fixR16' ? 'r16' : 'main';
    const id = isMainEdit
      ? basePrediction!.id
      : league === 'main' ? `pred-${Date.now()}` : `fix-${league}-${Date.now()}`;
    const nowIso = new Date().toISOString();
    onSave({
      id,
      uid: userId,
      userEmail,
      userDisplayName,
      name,
      league,
      parentId: league === 'main' ? undefined : parentMainId,
      createdAt: isMainEdit ? basePrediction!.createdAt : nowIso,
      updatedAt: nowIso,
      groups, eliminatedThird: elim3rd, r32Thirds,
      r32, r16, qf, sf, champion, runnerUp, thirdPlace,
      paymentStatus: isMainEdit ? basePrediction!.paymentStatus : 'pending',
      paidAt: isMainEdit ? basePrediction!.paidAt : undefined,
      points: isMainEdit ? basePrediction!.points : 0,
    });
  }

  // ─── Group picks ──────────────────────────────────────────────────────────

  function getGroupPos(groupId: string, teamId: string): '1°' | '2°' | '3°' | '' {
    const g = groups[groupId];
    if (!g) return '';
    if (g.first  === teamId) return '1°';
    if (g.second === teamId) return '2°';
    if (g.third  === teamId) return '3°';
    return '';
  }

  function pickGroupTeam(groupId: string, teamId: string) {
    const group = GROUPS.find(g => g.id === groupId)!;
    const cur = groups[groupId] ?? { first: '', second: '', third: '' };
    let { first, second, third } = cur;

    if      (teamId === first)  first  = '';
    else if (teamId === second) second = '';
    else if (teamId === third)  third  = '';
    else if (!first)            first  = teamId;
    else if (!second)           second = teamId;
    else if (!third)            third  = teamId;
    else                        third  = teamId;

    const picked = [first, second, third].filter(Boolean);
    const remaining = group.teams.map(t => t.id).filter(id => !picked.includes(id));
    if (!third && picked.length === 2 && remaining.length === 1) third = remaining[0];

    setGroups(g => ({ ...g, [groupId]: { first, second, third } }));
  }

  // ─── 3rd elimination ──────────────────────────────────────────────────────

  function toggleElim(teamId: string) {
    setElim3rd(prev => {
      if (prev.includes(teamId)) return prev.filter(id => id !== teamId);
      if (prev.length >= 4)      return prev;
      return [...prev, teamId];
    });
  }

  // ─── Winner pickers ───────────────────────────────────────────────────────

  function pickR32(matchId: string, teamId: string) {
    setR32(p => ({ ...p, [matchId]: teamId }));
    setNavError('');
  }

  // ─── STEP RENDERS ─────────────────────────────────────────────────────────

  function renderGrupos() {
    const group = GROUPS.find(g => g.id === activeGroup)!;

    return (
      <div>
        <p style={{ color: '#7eb89a', fontSize: '0.82rem', marginBottom: '14px' }}>
          Elige <strong style={{ color: '#f5a623' }}>1°</strong>, <strong style={{ color: '#d4f226' }}>2°</strong> y <strong style={{ color: '#9cc4b2' }}>3°</strong> lugar en cada uno de los 12 grupos.
          Los primeros dos avanzan directamente; el 3° puede pasar como mejor 3ro.
        </p>

        {/* Group tabs */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {'ABCDEFGHIJKL'.split('').map(g => {
            const gp = groups[g];
            const ok = gp?.first && gp?.second && gp?.third;
            return (
              <button key={g} onClick={() => setActiveGroup(g)}
                className="w-10 h-10 rounded-lg cursor-pointer transition-all relative"
                style={{
                  fontFamily: 'Oswald, sans-serif', fontSize: '0.9rem', fontWeight: 700,
                  background: activeGroup === g ? '#f5a623' : '#0d5035',
                  color: activeGroup === g ? '#062b1a' : ok ? '#c0d8cc' : '#7eb89a',
                  border: ok && activeGroup !== g ? '1.5px solid rgba(74,222,128,0.4)' : '1px solid rgba(255,255,255,0.07)',
                }}>
                {g}
                {ok && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ background: '#4ade80' }} />}
              </button>
            );
          })}
        </div>

        {/* Active group */}
        <div className="rounded-xl overflow-hidden mb-4" style={{ background: '#083524', border: '1px solid rgba(245,166,35,0.15)' }}>
          <div className="px-4 py-2.5 flex items-center justify-between"
            style={{ background: 'rgba(245,166,35,0.07)', borderBottom: '1px solid rgba(245,166,35,0.12)' }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1rem', letterSpacing: '0.06em' }}>
              GRUPO {activeGroup}
            </span>
            <span style={{ color: '#4a7d65', fontSize: '0.68rem', fontFamily: 'DM Mono' }}>Toca para asignar posición</span>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {group.teams.map(team => {
              const pos = getGroupPos(activeGroup, team.id);
              const clr: Record<string, string> = { '1°': '#f5a623', '2°': '#d4f226', '3°': '#9cc4b2' };
              const pc = clr[pos] ?? '';
              return (
                <button key={team.id} onClick={() => pickGroupTeam(activeGroup, team.id)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left cursor-pointer transition-all"
                  style={{
                    background: pos ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                    border: pos ? `1.5px solid ${pc}35` : '1px solid rgba(255,255,255,0.05)',
                  }}>
                  <span className="text-2xl">{team.flag}</span>
                  <div className="flex-1">
                    <div style={{ fontSize: '0.9rem', color: '#e0f0e8', fontFamily: 'Nunito Sans, sans-serif', fontWeight: 600 }}>{team.name}</div>
                    <div style={{ fontSize: '0.68rem', color: '#3a6b55', fontFamily: 'DM Mono' }}>{team.confederation}</div>
                  </div>
                  {pos && (
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${pc}18`, border: `1.5px solid ${pc}40` }}>
                      <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.9rem', color: pc, fontWeight: 700 }}>{pos}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {GROUPS.map(g => {
            const gp = groups[g.id];
            const ok = gp?.first && gp?.second && gp?.third;
            return (
              <button key={g.id} onClick={() => setActiveGroup(g.id)}
                className="rounded-lg p-2.5 text-left cursor-pointer transition-all"
                style={{
                  background: activeGroup === g.id ? 'rgba(245,166,35,0.08)' : '#0d5035',
                  border: activeGroup === g.id ? '1px solid rgba(245,166,35,0.25)' : ok ? '1px solid rgba(74,222,128,0.15)' : '1px solid rgba(255,255,255,0.05)',
                }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.68rem', letterSpacing: '0.1em', marginBottom: '4px' }}>
                  GR. {g.id}
                </div>
                {(['first','second','third'] as const).map((pos, pi) => {
                  const tid = gp?.[pos];
                  const t = tid ? getTeam(tid) : null;
                  const pc = ['#f5a623','#d4f226','#9cc4b2'][pi];
                  return (
                    <div key={pos} className="flex items-center gap-1">
                      <span style={{ fontFamily: 'DM Mono', fontSize: '0.56rem', color: pc, minWidth: '14px' }}>{pi+1}°</span>
                      {t ? (<><span style={{ fontSize: '0.78rem' }}>{t.flag}</span><span style={{ fontSize: '0.65rem', color: '#a0c4b0', fontFamily: 'Nunito Sans' }}>{t.shortName}</span></>)
                         : (<span style={{ fontSize: '0.6rem', color: '#2a4a3a', fontStyle: 'italic' }}>—</span>)}
                    </div>
                  );
                })}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── TERCEROS ────────────────────────────────────────────────────────────

  function renderTerceros() {
    const done = elim3rd.length === 4;
    const advancing = allThirds.filter(t => !elim3rd.includes(t.teamId));

    return (
      <div>
        <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(230,57,70,0.07)', border: '1px solid rgba(230,57,70,0.2)' }}>
          <div className="flex items-center gap-2 mb-1">
            <XCircle size={14} style={{ color: '#e63946' }} />
            <span style={{ fontFamily: 'Oswald, sans-serif', color: '#e63946', fontSize: '0.88rem', letterSpacing: '0.05em' }}>
              SELECCIONA 4 TERCEROS QUE NO AVANZAN
            </span>
          </div>
          <p style={{ color: '#9cc4b2', fontSize: '0.8rem', fontFamily: 'Nunito Sans, sans-serif' }}>
            De los 12 equipos en 3er lugar, <strong style={{ color: '#4ade80' }}>8 avanzan</strong> a dieciséisavos y <strong style={{ color: '#e63946' }}>4 son eliminados</strong>. Haz clic en los 4 que no pasan.
          </p>
        </div>

        {/* Counters */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.6rem', color: '#4ade80', fontWeight: 700, lineHeight: 1 }}>
              {advancing.length}<span style={{ fontSize: '0.8rem', color: '#1a5a3a' }}>/8</span>
            </div>
            <div style={{ fontSize: '0.66rem', color: '#7eb89a', fontFamily: 'DM Mono', letterSpacing: '0.06em', marginTop: '2px' }}>AVANZAN</div>
          </div>
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'rgba(230,57,70,0.06)', border: `1px solid ${done ? 'rgba(230,57,70,0.4)' : 'rgba(230,57,70,0.15)'}` }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.6rem', color: '#e63946', fontWeight: 700, lineHeight: 1 }}>
              {elim3rd.length}<span style={{ fontSize: '0.8rem', color: '#5a1a1a' }}>/4</span>
            </div>
            <div style={{ fontSize: '0.66rem', color: '#e63946', fontFamily: 'DM Mono', letterSpacing: '0.06em', marginTop: '2px' }}>ELIMINADOS</div>
          </div>
        </div>

        {allThirds.length < 12 && (
          <div className="rounded-xl p-3 mb-4 flex items-center gap-2" style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.15)' }}>
            <AlertCircle size={14} style={{ color: '#f5a623' }} />
            <span style={{ color: '#f5a623', fontSize: '0.8rem', fontFamily: 'Nunito Sans' }}>
              Regresa a Grupos para completarlos ({allThirds.length}/12 asignados).
            </span>
          </div>
        )}

        {/* 12 thirds grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {GROUPS.map(g => {
            const gp = groups[g.id];
            const teamId = gp?.third ?? '';
            const team = teamId ? getTeam(teamId) : null;
            const isElim = elim3rd.includes(teamId);
            const canElim = !isElim && elim3rd.length < 4 && !!teamId;

            return (
              <button key={g.id}
                onClick={() => teamId && toggleElim(teamId)}
                disabled={!teamId || (!canElim && !isElim)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                style={{
                  cursor: teamId && (canElim || isElim) ? 'pointer' : 'default',
                  background: isElim ? 'rgba(230,57,70,0.08)' : 'rgba(255,255,255,0.03)',
                  border: isElim ? '1.5px solid rgba(230,57,70,0.35)' : '1px solid rgba(255,255,255,0.07)',
                  opacity: !teamId ? 0.35 : 1,
                }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: isElim ? 'rgba(230,57,70,0.15)' : 'rgba(245,166,35,0.1)' }}>
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.8rem', fontWeight: 700,
                    color: isElim ? '#e63946' : '#f5a623' }}>{g.id}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {team ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">{team.flag}</span>
                        <span style={{ fontSize: '0.85rem', fontFamily: 'Nunito Sans', fontWeight: 600,
                          color: isElim ? '#e63946' : '#e0f0e8' }}>{team.name}</span>
                      </div>
                      <div style={{ fontSize: '0.63rem', color: isElim ? '#a03040' : '#3a6b55', fontFamily: 'DM Mono' }}>
                        3° Grupo {g.id}
                      </div>
                    </>
                  ) : (
                    <span style={{ color: '#2a5040', fontSize: '0.78rem', fontStyle: 'italic', fontFamily: 'Nunito Sans' }}>Sin asignar (completa el grupo {g.id})</span>
                  )}
                </div>
                <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs"
                  style={{ background: isElim ? 'rgba(230,57,70,0.15)' : teamId ? 'rgba(74,222,128,0.1)' : 'transparent',
                    color: isElim ? '#e63946' : '#4ade80', fontFamily: 'DM Mono', fontSize: '0.6rem' }}>
                  {isElim ? 'ELIMINADO' : teamId ? 'AVANZA' : ''}
                </span>
              </button>
            );
          })}
        </div>

        {/* Advancing summary */}
        {advancing.length > 0 && (
          <div className="mt-4 rounded-xl p-4" style={{ background: '#083524', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#7eb89a', fontSize: '0.72rem', letterSpacing: '0.08em', marginBottom: '8px' }}>
              EQUIPOS QUE AVANZAN ({advancing.length}/8)
            </div>
            <div className="flex flex-wrap gap-2">
              {advancing.map(t => {
                const team = getTeam(t.teamId);
                return (
                  <div key={t.teamId} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)' }}>
                    <span>{team.flag}</span>
                    <span style={{ fontSize: '0.75rem', color: '#4ade80', fontFamily: 'Nunito Sans', fontWeight: 600 }}>{team.shortName}</span>
                    <span style={{ fontSize: '0.58rem', color: '#2a5a3a', fontFamily: 'DM Mono' }}>3°{t.group}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── R32 ─────────────────────────────────────────────────────────────────

  function renderR32() {
    // Used thirds (assigned to other matches)
    const usedThirds = (matchId: string) =>
      new Set(Object.entries(r32Thirds).filter(([mid]) => mid !== matchId).map(([, tid]) => tid));

    // Group by date
    const byDate = OFFICIAL_R32.reduce<Record<string, typeof OFFICIAL_R32>>((acc, m) => {
      (acc[m.date] ??= []).push(m);
      return acc;
    }, {});

    return (
      <div>
        <p style={{ color: '#7eb89a', fontSize: '0.82rem', marginBottom: '14px' }}>
          Para los partidos con <span style={{ color: '#c084fc' }}>3° mejor</span>, primero asigna qué equipo tercero juega ahí. Luego elige el ganador de cada partido.
        </p>

        <div className="flex flex-col gap-6">
          {Object.entries(byDate).map(([date, matches]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={12} style={{ color: '#f5a623' }} />
                <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.82rem', letterSpacing: '0.08em' }}>
                  {date.toUpperCase()}
                </span>
                <div className="flex-1 h-px" style={{ background: 'rgba(245,166,35,0.15)' }} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {matches.map(m => {
                  const homeId = resolveSlot(m.home, m.id);
                  const awayId = resolveSlot(m.away, m.id);
                  const needsThird = m.away.type === 'best3rd' && !r32Thirds[m.id];
                  const eligibleGroups = m.away.type === 'best3rd' ? m.away.eligibleGroups : [];
                  const used = usedThirds(m.id);

                  const eligible = advancingThirds.filter(t => eligibleGroups.includes(t.group));

                  return (
                    <div key={m.id} className="rounded-xl overflow-hidden flex flex-col"
                      style={{ background: '#0b4730', border: needsThird ? '1px solid rgba(192,132,252,0.3)' : r32[m.id] ? '1px solid rgba(245,166,35,0.2)' : '1px solid rgba(255,255,255,0.07)' }}>

                      {/* Match header */}
                      <div className="px-3 py-1.5 flex items-center justify-between gap-2"
                        style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.72rem', letterSpacing: '0.1em' }}>
                          P{m.matchNum}
                        </span>
                        <div className="flex items-center gap-2">
                          <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#4a7d65', fontSize: '0.6rem', fontFamily: 'DM Mono' }}>
                            <Calendar size={8} />{m.date}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#4a7d65', fontSize: '0.6rem', fontFamily: 'DM Mono',
                            maxWidth: '110px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            <MapPin size={8} />{m.stadium}
                          </span>
                        </div>
                      </div>

                      <div className="p-2.5 flex flex-col gap-2 flex-1">
                        {/* Home team (always a position slot) */}
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          {homeId ? (
                            <>
                              <span className="text-base">{getTeam(homeId).flag}</span>
                              <span style={{ fontSize: '0.82rem', fontFamily: 'Nunito Sans', fontWeight: 600, color: '#c0d8cc' }}>
                                {getTeam(homeId).name}
                              </span>
                            </>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#3a6b55', fontFamily: 'DM Mono', fontStyle: 'italic' }}>
                              {m.home.type === 'pos' ? `1° Gr.${m.home.group}` : '?'} — pendiente
                            </span>
                          )}
                          <span style={{ marginLeft: 'auto', fontSize: '0.58rem', color: '#3a6b55', fontFamily: 'DM Mono' }}>
                            {m.home.type === 'pos' ? `${m.home.pos}°${m.home.group}` : ''}
                          </span>
                        </div>

                        <div className="text-center" style={{ color: '#2a5a3a', fontSize: '0.62rem', fontFamily: 'DM Mono', letterSpacing: '0.1em' }}>
                          VS
                        </div>

                        {/* Away slot */}
                        {needsThird ? (
                          <div className="rounded-lg p-2.5" style={{ background: 'rgba(192,132,252,0.06)', border: '1px solid rgba(192,132,252,0.2)' }}>
                            <div style={{ fontSize: '0.64rem', color: '#c084fc', fontFamily: 'DM Mono', letterSpacing: '0.06em', marginBottom: '6px' }}>
                              3° MEJOR ({eligibleGroups.join('/')}) — ASIGNA UN EQUIPO:
                            </div>
                            {eligible.length === 0 ? (
                              <div style={{ fontSize: '0.75rem', color: '#5a4060', fontFamily: 'Nunito Sans', fontStyle: 'italic' }}>
                                Sin equipos elegibles disponibles. Verifica tus picks de terceros.
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {eligible.map(t => {
                                  const team = getTeam(t.teamId);
                                  const taken = used.has(t.teamId);
                                  return (
                                    <button key={t.teamId} disabled={taken}
                                      onClick={() => setR32Thirds(p => ({ ...p, [m.id]: t.teamId }))}
                                      className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all cursor-pointer"
                                      style={{
                                        background: taken ? 'rgba(255,255,255,0.03)' : 'rgba(192,132,252,0.12)',
                                        border: `1px solid ${taken ? 'rgba(255,255,255,0.05)' : 'rgba(192,132,252,0.3)'}`,
                                        opacity: taken ? 0.4 : 1,
                                        cursor: taken ? 'not-allowed' : 'pointer',
                                      }}>
                                      <span style={{ fontSize: '0.82rem' }}>{team.flag}</span>
                                      <span style={{ fontSize: '0.7rem', color: taken ? '#4a7d65' : '#c084fc', fontFamily: 'Nunito Sans', fontWeight: 600 }}>
                                        {team.shortName}
                                      </span>
                                      <span style={{ fontSize: '0.56rem', color: '#5a4060', fontFamily: 'DM Mono' }}>
                                        3°{t.group}
                                      </span>
                                      {taken && <span style={{ fontSize: '0.56rem', color: '#4a7d65', fontFamily: 'DM Mono' }}>✓usado</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            {awayId ? (
                              <>
                                <span className="text-base">{getTeam(awayId).flag}</span>
                                <span style={{ fontSize: '0.82rem', fontFamily: 'Nunito Sans', fontWeight: 600, color: '#c0d8cc' }}>
                                  {getTeam(awayId).name}
                                </span>
                                {m.away.type === 'best3rd' && (
                                  <button onClick={() => setR32Thirds(p => { const n = { ...p }; delete n[m.id]; return n; })}
                                    className="ml-auto cursor-pointer"
                                    title="Cambiar equipo"
                                    style={{ color: '#4a7d65', fontSize: '0.6rem', fontFamily: 'DM Mono' }}>
                                    cambiar ✕
                                  </button>
                                )}
                              </>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#3a6b55', fontFamily: 'DM Mono', fontStyle: 'italic' }}>
                                {m.away.type === 'pos' ? `${m.away.pos}°${m.away.group}` : '?'} — pendiente
                              </span>
                            )}
                          </div>
                        )}

                        {/* Winner picker — only when both teams are known */}
                        {homeId && awayId && !needsThird && (
                          <>
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '2px 0' }} />
                            <div style={{ fontSize: '0.62rem', color: '#4a7d65', fontFamily: 'DM Mono', letterSpacing: '0.06em' }}>
                              GANADOR:
                            </div>
                            <div className="flex gap-1.5">
                              {[homeId, awayId].map(tid => {
                                const t = getTeam(tid);
                                const sel = r32[m.id] === tid;
                                return (
                                  <button key={tid} onClick={() => pickR32(m.id, tid)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg cursor-pointer transition-all"
                                    style={{
                                      background: sel ? 'rgba(245,166,35,0.18)' : 'rgba(255,255,255,0.03)',
                                      border: sel ? '1.5px solid rgba(245,166,35,0.5)' : '1px solid rgba(255,255,255,0.06)',
                                    }}>
                                    <span style={{ fontSize: '0.9rem' }}>{t.flag}</span>
                                    <span style={{ fontSize: '0.72rem', color: sel ? '#f5a623' : '#9cc4b2', fontFamily: 'Nunito Sans', fontWeight: 600 }}>
                                      {t.shortName}
                                    </span>
                                    {sel && <Check size={11} style={{ color: '#f5a623' }} />}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── R16 ─────────────────────────────────────────────────────────────────

  function renderRound(
    pairs: { id: string; [k: string]: string }[],
    getTeamA: (pair: typeof pairs[0]) => string | undefined,
    getTeamB: (pair: typeof pairs[0]) => string | undefined,
    picks: Record<string, string>,
    setPicks: Dispatch<SetStateAction<Record<string, string>>>,
    labelPrefix: string,
  ) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {pairs.map((pair, i) => {
          const homeId = getTeamA(pair);
          const awayId = getTeamB(pair);
          const winner = picks[pair.id];
          const both   = homeId && awayId;
          return (
            <div key={pair.id} className="rounded-xl overflow-hidden"
              style={{ background: '#0b4730', border: winner ? '1px solid rgba(245,166,35,0.2)' : '1px solid rgba(255,255,255,0.07)' }}>
              <div className="px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', color: '#4a7d65', fontSize: '0.62rem', letterSpacing: '0.06em' }}>
                  {labelPrefix} {i + 1}
                </span>
              </div>
              <div className="p-2.5 flex flex-col gap-1.5">
                {both ? (
                  <>
                    {[homeId, awayId].map(tid => {
                      const t = getTeam(tid!);
                      const sel = winner === tid;
                      return (
                        <button key={tid} onClick={() => { setPicks(p => ({ ...p, [pair.id]: tid! })); setNavError(''); }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg w-full text-left cursor-pointer transition-all"
                          style={{
                            background: sel ? 'rgba(245,166,35,0.15)' : 'rgba(255,255,255,0.03)',
                            border: sel ? '1.5px solid rgba(245,166,35,0.5)' : '1px solid rgba(255,255,255,0.05)',
                          }}>
                          <span className="text-xl">{t.flag}</span>
                          <span style={{ flex: 1, fontSize: '0.82rem', fontFamily: 'Nunito Sans', fontWeight: 600,
                            color: sel ? '#f5a623' : '#c0d8cc' }}>{t.name}</span>
                          {sel && <Check size={13} style={{ color: '#f5a623' }} />}
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <div className="py-3 text-center" style={{ color: '#3a6b55', fontSize: '0.78rem', fontStyle: 'italic', fontFamily: 'Nunito Sans' }}>
                    Completa la fase anterior
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderR16() {
    return (
      <div>
        <p style={{ color: '#7eb89a', fontSize: '0.82rem', marginBottom: '14px' }}>Elige el ganador de cada octavo de final.</p>
        {renderRound(
          R16_PAIRS,
          p => r32[p.r32a],
          p => r32[p.r32b],
          r16, setR16, 'OCTAVO',
        )}
      </div>
    );
  }

  function renderQF() {
    return (
      <div>
        <p style={{ color: '#7eb89a', fontSize: '0.82rem', marginBottom: '14px' }}>Elige los cuatro semifinalistas.</p>
        {renderRound(
          QF_PAIRS,
          p => r16[p.r16a],
          p => r16[p.r16b],
          qf, setQf, 'CUARTO',
        )}
      </div>
    );
  }

  function renderSF() {
    return (
      <div>
        <p style={{ color: '#7eb89a', fontSize: '0.82rem', marginBottom: '14px' }}>Elige los dos finalistas.</p>
        {renderRound(
          SF_PAIRS,
          p => qf[p.qfa],
          p => qf[p.qfb],
          sf, setSf, 'SEMIFINAL',
        )}
      </div>
    );
  }

  // ─── FINAL ────────────────────────────────────────────────────────────────

  function renderFinal() {
    const f1 = sf['sf-1'];
    const f2 = sf['sf-2'];
    const sf1Loser = f1 ? (qf['qf-1'] === f1 ? qf['qf-2'] : qf['qf-1']) : undefined;
    const sf2Loser = f2 ? (qf['qf-3'] === f2 ? qf['qf-4'] : qf['qf-3']) : undefined;

    return (
      <div>
        <div className="rounded-xl p-4 mb-4 text-center" style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.2)' }}>
          <Trophy size={28} style={{ color: '#f5a623', margin: '0 auto 6px' }} />
          <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1.1rem', letterSpacing: '0.08em' }}>GRAN FINAL</div>
          <p style={{ color: '#4a7d65', fontSize: '0.7rem', fontFamily: 'DM Mono', marginTop: '2px' }}>19 jul 2026 · MetLife Stadium, Nueva York</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.78rem', letterSpacing: '0.08em', marginBottom: '8px' }}>🏆 FINAL — CAMPEÓN</div>
            <div className="grid grid-cols-1 gap-1.5">
              {[f1, f2].filter(Boolean).map(tid => {
                const t = getTeam(tid!);
                const sel = champion === tid;
                return (
                  <button key={tid} onClick={() => { setChampion(tid!); setRunnerUp(tid === f1 ? (f2 ?? '') : (f1 ?? '')); setNavError(''); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all"
                    style={{ background: sel ? 'rgba(245,166,35,0.15)' : '#0b4730', border: sel ? '1.5px solid rgba(245,166,35,0.5)' : '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="text-xl">{t.flag}</span>
                    <span style={{ flex: 1, fontSize: '0.82rem', fontFamily: 'Nunito Sans', fontWeight: 600, color: sel ? '#f5a623' : '#c0d8cc' }}>{t.name}</span>
                    {sel && <><Check size={13} style={{ color: '#f5a623' }} /><span style={{ fontSize: '0.65rem', color: '#f5a623', fontFamily: 'DM Mono' }}>CAMPEÓN</span></>}
                  </button>
                );
              })}
              {!f1 && !f2 && <div style={{ color: '#3a6b55', fontSize: '0.78rem', fontStyle: 'italic', fontFamily: 'Nunito Sans', textAlign: 'center', padding: '12px' }}>Completa las semis primero</div>}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#9cc4b2', fontSize: '0.78rem', letterSpacing: '0.08em', marginBottom: '8px' }}>🥉 3ER Y 4TO LUGAR</div>
            <div className="grid grid-cols-1 gap-1.5">
              {[sf1Loser, sf2Loser].filter(Boolean).map(tid => {
                const t = getTeam(tid!);
                const sel = thirdPlace === tid;
                return (
                  <button key={tid} onClick={() => { setThirdPlace(tid!); setNavError(''); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all"
                    style={{ background: sel ? 'rgba(155,155,155,0.12)' : '#0b4730', border: sel ? '1.5px solid rgba(155,155,155,0.35)' : '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="text-xl">{t.flag}</span>
                    <span style={{ flex: 1, fontSize: '0.82rem', fontFamily: 'Nunito Sans', fontWeight: 600, color: sel ? '#9cc4b2' : '#c0d8cc' }}>{t.name}</span>
                    {sel && <><Check size={13} style={{ color: '#9cc4b2' }} /><span style={{ fontSize: '0.65rem', color: '#9cc4b2', fontFamily: 'DM Mono' }}>3° LUG.</span></>}
                  </button>
                );
              })}
              {(!sf1Loser || !sf2Loser) && <div style={{ color: '#3a6b55', fontSize: '0.78rem', fontStyle: 'italic', fontFamily: 'Nunito Sans', textAlign: 'center', padding: '12px' }}>Completa las semis primero</div>}
            </div>
          </div>
        </div>

        {champion && (
          <div className="rounded-xl p-4" style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.2)' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.78rem', letterSpacing: '0.08em', marginBottom: '8px' }}>RESUMEN</div>
            {[{ label: '🏆 Campeón', id: champion }, { label: '🥈 Subcampeón', id: runnerUp }, { label: '🥉 3er Lugar', id: thirdPlace }].map(({ label, id }) => {
              const t = id ? getTeam(id) : null;
              return (
                <div key={label} className="flex items-center gap-2 mb-1.5">
                  <span style={{ color: '#7eb89a', fontSize: '0.78rem', fontFamily: 'Nunito Sans', minWidth: '110px' }}>{label}</span>
                  {t ? <><span>{t.flag}</span><span style={{ fontSize: '0.88rem', color: '#e0f0e8', fontFamily: 'Nunito Sans', fontWeight: 600 }}>{t.name}</span></>
                     : <span style={{ color: '#2a5040', fontSize: '0.78rem', fontStyle: 'italic' }}>—</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const currentComplete = isStepComplete(step);
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.04em' }}>{name}</h1>
          <p style={{ color: mode === 'main' ? '#4a7d65' : '#c084fc', fontSize: '0.7rem', fontFamily: 'DM Mono' }}>
            {mode === 'main' ? (userDisplayName ?? '') : `LIGA APARTE · ARREGLO ${mode === 'fixR32' ? 'R32' : 'R16'}`}
          </p>
        </div>
        <button onClick={onCancel} style={{ color: '#7eb89a', fontSize: '0.76rem', fontFamily: 'DM Mono', cursor: 'pointer' }}>← Volver</button>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-0.5 mb-5 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const done = isStepComplete(s);
          const accessible = isStepAccessible(s);
          const isCurrent = step === s;
          const locked = !accessible && !isCurrent;
          return (
            <div key={s} className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => handleStepClick(s)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all"
                style={{
                  cursor: locked ? 'not-allowed' : 'pointer',
                  fontFamily: 'Oswald, sans-serif', fontSize: '0.64rem', letterSpacing: '0.07em',
                  background: isCurrent ? '#f5a623' : done ? 'rgba(74,222,128,0.12)' : locked ? 'rgba(255,255,255,0.03)' : '#083524',
                  color: isCurrent ? '#062b1a' : done ? '#4ade80' : locked ? '#2a4a3a' : '#4a7d65',
                  border: done && !isCurrent ? '1px solid rgba(74,222,128,0.2)' : locked ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  opacity: locked ? 0.5 : 1,
                }}>
                {locked ? <Lock size={8} /> : done && !isCurrent ? <Check size={9} /> : null}
                {STEP_LABELS[s]}
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight size={9} style={{ color: '#1a4a2a', flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="rounded-xl p-5 mb-4" style={{ background: '#083524', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Star size={13} style={{ color: '#f5a623' }} />
          <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.95rem', letterSpacing: '0.06em' }}>
            {STEP_LABELS[step]}
          </span>
          {/* Completion badge */}
          <span className="ml-auto px-2 py-0.5 rounded-full"
            style={{
              background: currentComplete ? 'rgba(74,222,128,0.1)' : 'rgba(245,166,35,0.08)',
              color: currentComplete ? '#4ade80' : '#f5a623',
              fontSize: '0.62rem', fontFamily: 'DM Mono',
            }}>
            {currentComplete ? '✓ completo' : getMissingMessage(step).split(' ').slice(0, 4).join(' ') + '…'}
          </span>
        </div>

        {isLocked(step) ? (
          <div className="rounded-xl p-5 text-center" style={{ background: 'rgba(192,132,252,0.06)', border: '1px solid rgba(192,132,252,0.2)' }}>
            <Lock size={20} style={{ color: '#c084fc', margin: '0 auto 8px' }} />
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#c084fc', fontSize: '0.9rem', letterSpacing: '0.05em' }}>FASE FIJA</div>
            <p style={{ color: '#9cc4b2', fontSize: '0.82rem', marginTop: '6px', fontFamily: 'Nunito Sans' }}>
              En este arreglo conservas tus picks de esta fase. Avanza para volver a elegir desde {STEP_LABELS[firstEditable]}.
            </p>
          </div>
        ) : (
          <>
            {step === 'grupos'   && renderGrupos()}
            {step === 'terceros' && renderTerceros()}
            {step === 'r32'      && renderR32()}
            {step === 'r16'      && renderR16()}
            {step === 'qf'       && renderQF()}
            {step === 'sf'       && renderSF()}
            {step === 'final'    && renderFinal()}
          </>
        )}
      </div>

      {/* Nav error banner */}
      {navError && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-3"
          style={{ background: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.22)' }}>
          <AlertCircle size={14} style={{ color: '#e63946', flexShrink: 0 }} />
          <span style={{ color: '#e63946', fontSize: '0.8rem', fontFamily: 'Nunito Sans, sans-serif' }}>
            {navError}
          </span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={handlePrev} disabled={stepIdx === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg cursor-pointer transition-all disabled:opacity-30"
          style={{ background: '#0d5035', color: '#7eb89a', fontFamily: 'Oswald, sans-serif', fontSize: '0.82rem', letterSpacing: '0.05em', border: '1px solid rgba(255,255,255,0.07)' }}>
          <ChevronLeft size={15} /> ANTERIOR
        </button>

        <button onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg cursor-pointer"
          style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', fontFamily: 'Oswald, sans-serif', fontSize: '0.82rem', letterSpacing: '0.05em', border: '1px solid rgba(74,222,128,0.22)' }}>
          <Save size={14} /> GUARDAR
        </button>

        <button onClick={isLast ? handleSave : handleNext}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg cursor-pointer transition-all"
          style={{
            background: isLast ? '#f5a623' : currentComplete ? '#0d5035' : 'rgba(255,255,255,0.04)',
            color: isLast ? '#062b1a' : currentComplete ? '#7eb89a' : '#3a6b55',
            fontFamily: 'Oswald, sans-serif', fontSize: '0.82rem', letterSpacing: '0.05em',
            border: currentComplete || isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
          }}>
          {!currentComplete && !isLast && <Lock size={13} />}
          {isLast ? <><Save size={14}/> FINALIZAR</> : <>SIGUIENTE <ChevronRight size={15}/></>}
        </button>
      </div>
    </div>
  );
}
