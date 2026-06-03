import { useState, useEffect, useCallback } from 'react';
import {
  type Prediction, type AppConfig, type Results, type Ticket, type Pool, type PublicStats,
  DEFAULT_CONFIG, EMPTY_RESULTS, EMPTY_PUBLIC_STATS,
} from './data/worldcup';
import { useAuth } from '../lib/auth';
import {
  fetchMyPredictions, fetchConfig, fetchResults,
  saveMainPrediction, saveSideEntry, deletePrediction,
} from '../lib/predictions';
import { fetchMyTickets, fetchPools, buyTicket, deleteTicket } from '../lib/rifa';
import { fetchPublicStats } from '../lib/stats';
import { AuthPage } from './components/AuthPage';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { ResultsPage } from './components/ResultsPage';
import { BracketWizard } from './components/BracketWizard';
import { MyPredictions } from './components/MyPredictions';
import { RifaPage } from './components/RifaPage';
import { ExplanationsPage } from './components/ExplanationsPage';
import { AdminReport } from './components/AdminReport';
import { AdminRifa } from './components/AdminRifa';
import { AdminResultsEntry } from './components/AdminResultsEntry';

export type Page = 'home' | 'results' | 'bracket' | 'my-predictions' | 'rifa' | 'explanations' | 'admin';
type WizardMode = 'main' | 'joinR32' | 'joinR16';

interface WizardState {
  mode: WizardMode;
  base: Prediction | null;
  name: string;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{ background: '#0a3d28', fontFamily: "'Twemoji Country Flags', Nunito Sans, sans-serif" }}>
      {children}
    </div>
  );
}

function FirebaseSetupNotice() {
  return (
    <Shell>
      <div className="max-w-lg">
        <h1 style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#f5a623', fontSize: '1.6rem', letterSpacing: '0.04em' }}>
          FALTA CONFIGURAR FIREBASE
        </h1>
        <p style={{ color: '#c0d8cc', fontSize: '0.9rem', marginTop: '12px', lineHeight: 1.6 }}>
          Crea un proyecto en Firebase, habilita <strong>Email/Password</strong> y Firestore, y copia
          las claves a un archivo <code style={{ color: '#d4f226' }}>.env.local</code> (usa
          <code style={{ color: '#d4f226' }}> .env.example</code> como plantilla). Reinicia el servidor
          de desarrollo después.
        </p>
      </div>
    </Shell>
  );
}

export default function App() {
  const { user, loading, configured, isAdmin, logOut } = useAuth();

  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [results, setResults] = useState<Results>(EMPTY_RESULTS);
  const [stats, setStats] = useState<PublicStats>(EMPTY_PUBLIC_STATS);
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const [adminTab, setAdminTab] = useState<'report' | 'rifa' | 'results'>('report');
  const [actionError, setActionError] = useState('');

  const uid = user?.uid ?? null;

  const reloadData = useCallback(async () => {
    if (!uid) return;
    try {
      const [preds, cfg, res, st] = await Promise.all([fetchMyPredictions(uid), fetchConfig(), fetchResults(), fetchPublicStats()]);
      setPredictions(preds);
      setConfig(cfg);
      setResults(res);
      setStats(st);
    } catch (e) {
      console.error('Error cargando datos', e);
    }
    // Rifa data is loaded separately so a permission error here (e.g. before the
    // pools/tickets rules are published) never breaks the core quiniela load.
    try {
      const [tks, pls] = await Promise.all([fetchMyTickets(uid), fetchPools()]);
      setTickets(tks);
      setPools(pls);
    } catch (e) {
      console.error('Error cargando datos de la rifa', e);
    }
  }, [uid]);

  useEffect(() => {
    if (uid) reloadData();
    else { setPredictions([]); setTickets([]); setPools([]); setWizard(null); }
  }, [uid, reloadData]);

  // ─── Lock / join windows ────────────────────────────────────────────────────
  const now = Date.now();
  const lockPassed = now >= new Date(config.lockDate).getTime();
  // Side-league join windows: open to anyone (no main needed) until that round's
  // first match. Players seed a provisional bracket now; it auto-updates to the real
  // teams as results arrive, so late joiners can pick from teams that already advanced.
  const r32JoinOpen = now < new Date(config.r32StartDate).getTime();
  const r16JoinOpen = now < new Date(config.r16StartDate).getTime();

  // ─── Navigation / wizard ────────────────────────────────────────────────────
  function handleNavigate(page: Page) {
    setCurrentPage(page);
    setWizard(null);
    setActionError('');
  }

  function handleNewPrediction() {
    if (lockPassed) { setActionError('El torneo ya inició: no se pueden crear nuevos pronósticos.'); return; }
    const n = predictions.filter(p => p.league === 'main').length + 1;
    setWizard({ mode: 'main', base: null, name: `Mi Pronóstico #${n}` });
    setCurrentPage('bracket');
  }

  function handleEditPrediction(pred: Prediction) {
    // Standalone side-league entry (r32/r16): editable until its round starts.
    if (pred.league !== 'main') {
      const open = pred.league === 'r32' ? r32JoinOpen : r16JoinOpen;
      if (!open) { setActionError('La ventana de esta liga ya cerró.'); return; }
      setWizard({ mode: pred.league === 'r32' ? 'joinR32' : 'joinR16', base: pred, name: pred.name });
      setCurrentPage('bracket');
      return;
    }
    if (lockPassed) { setActionError('El torneo ya inició: los pronósticos quedaron bloqueados.'); return; }
    setWizard({ mode: 'main', base: pred, name: pred.name });
    setCurrentPage('bracket');
  }

  function handleJoin(round: 'r32' | 'r16') {
    // Standalone entry: no parent main. The player builds a provisional combination
    // that seeds the bracket; real results overlay it as they come in.
    setWizard({
      mode: round === 'r32' ? 'joinR32' : 'joinR16',
      base: null,
      name: round === 'r32' ? 'Mi Pronóstico R32 · Liga aparte' : 'Mi Pronóstico R16 · Liga aparte',
    });
    setCurrentPage('bracket');
  }

  async function handleWizardSave(pred: Prediction) {
    // Persist and refresh local data. Navigation is deferred: the wizard shows its
    // own confirmation screen (with the folio) and closes via onCancel. Errors
    // propagate so the wizard can surface them inline next to the save button.
    if (pred.league === 'main') {
      const isNew = !predictions.some(p => p.id === pred.id);
      await saveMainPrediction(pred, isNew);
    } else {
      await saveSideEntry(pred);
    }
    await reloadData();
  }

  async function handleDeletePrediction(id: string) {
    setActionError('');
    try {
      await deletePrediction(id);
      await reloadData();
    } catch (e) {
      setActionError((e as Error).message ?? 'No se pudo eliminar.');
    }
  }

  // ─── Rifa de Países (modo tradicional) ──────────────────────────────────────
  async function handleBuyTicket() {
    if (!user) return;
    await buyTicket({ uid: user.uid, email: user.email ?? undefined, displayName });
    await reloadData();
  }

  async function handleDeleteTicket(id: string) {
    await deleteTicket(id);
    await reloadData();
  }

  // ─── Gating ────────────────────────────────────────────────────────────────
  if (!configured) return <FirebaseSetupNotice />;
  if (loading) {
    return (
      <Shell>
        <div style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#7eb89a', letterSpacing: '0.1em' }}>CARGANDO…</div>
      </Shell>
    );
  }
  if (!user) return <AuthPage />;

  const displayName = user.displayName || user.email?.split('@')[0] || 'Participante';
  const showAdmin = isAdmin && currentPage === 'admin';

  return (
    <div className="min-h-screen" style={{ background: '#0a3d28', fontFamily: "'Twemoji Country Flags', Nunito Sans, sans-serif" }}>
      <Header
        currentPage={currentPage}
        onNavigate={handleNavigate}
        userName={displayName}
        isAdmin={isAdmin}
        showRifa={config.rifaEnabled}
        onLogout={logOut}
      />

      {actionError && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="px-4 py-2.5 rounded-xl" style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.25)', color: '#e63946', fontSize: '0.82rem' }}>
            {actionError}
          </div>
        </div>
      )}

      <main style={{ minHeight: 'calc(100vh - 56px)' }}>
        {wizard && currentPage === 'bracket' ? (
          <BracketWizard
            userId={user.uid}
            userEmail={user.email ?? undefined}
            userDisplayName={displayName}
            mode={wizard.mode}
            basePrediction={wizard.base}
            predictionName={wizard.name}
            results={results}
            onSave={handleWizardSave}
            onCancel={() => { setWizard(null); setCurrentPage('my-predictions'); }}
          />
        ) : (
          <>
            {currentPage === 'home' && (
              <HomePage
                userName={displayName}
                onNavigate={handleNavigate}
                predictions={predictions}
                results={results}
                config={config}
                stats={stats}
              />
            )}
            {currentPage === 'results' && <ResultsPage results={results} />}
            {(currentPage === 'bracket' || currentPage === 'my-predictions') && (
              <MyPredictions
                predictions={predictions}
                results={results}
                email={user.email ?? undefined}
                lockPassed={lockPassed}
                r32JoinOpen={r32JoinOpen}
                r16JoinOpen={r16JoinOpen}
                maxPending={config.maxPendingPerUser}
                onNew={handleNewPrediction}
                onEdit={handleEditPrediction}
                onDelete={handleDeletePrediction}
                onJoin={handleJoin}
              />
            )}
            {currentPage === 'rifa' && config.rifaEnabled && (
              <RifaPage
                tickets={tickets}
                pools={pools}
                config={config}
                results={results}
                email={user.email ?? undefined}
                onBuy={handleBuyTicket}
                onDelete={handleDeleteTicket}
              />
            )}
            {currentPage === 'explanations' && <ExplanationsPage config={config} />}
            {showAdmin && (
              <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="flex gap-2 mb-5">
                  {([['report', 'Reporte general'], ['rifa', 'Quiniela'], ['results', 'Resultados / Config']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setAdminTab(key)}
                      className="px-4 py-2 rounded-lg cursor-pointer"
                      style={{
                        fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontSize: '0.82rem', letterSpacing: '0.05em',
                        background: adminTab === key ? '#f5a623' : '#0d5035',
                        color: adminTab === key ? '#062b1a' : '#9cc4b2',
                        border: '1px solid rgba(245,166,35,0.2)',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
                {adminTab === 'report' && <AdminReport config={config} results={results} />}
                {adminTab === 'rifa' && <AdminRifa config={config} results={results} />}
                {adminTab === 'results' && <AdminResultsEntry config={config} onSaved={reloadData} />}
              </div>
            )}
            {currentPage === 'admin' && !isAdmin && (
              <div className="max-w-4xl mx-auto px-4 py-12 text-center" style={{ color: '#7eb89a' }}>
                Acceso restringido.
              </div>
            )}
          </>
        )}
      </main>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px', textAlign: 'center' }}>
        <div className="h-1 mb-3" style={{ background: 'repeating-linear-gradient(90deg, #f5a623 0px, #f5a623 8px, #d4f226 8px, #d4f226 16px, #0a3d28 16px, #0a3d28 24px)', borderRadius: '999px', maxWidth: '200px', margin: '0 auto 12px' }} />
        <p style={{ color: '#3a6b55', fontSize: '0.72rem', fontFamily: "'Twemoji Country Flags', 'DM Mono', monospace", letterSpacing: '0.08em' }}>
          PANTERA MUNDIALISTA · UNIVERSIDAD PANAMERICANA · MUNDIAL FIFA 2026 · EE.UU. · CANADÁ · MÉXICO
        </p>
      </footer>
    </div>
  );
}
