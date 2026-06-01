import { useState, useEffect, useCallback } from 'react';
import {
  type Prediction, type AppConfig, type Results,
  DEFAULT_CONFIG, EMPTY_RESULTS,
} from './data/worldcup';
import { useAuth } from '../lib/auth';
import {
  fetchMyPredictions, fetchConfig, fetchResults,
  saveMainPrediction, saveFix, deletePrediction,
} from '../lib/predictions';
import { AuthPage } from './components/AuthPage';
import { VerifyEmailNotice } from './components/VerifyEmailNotice';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { ResultsPage } from './components/ResultsPage';
import { BracketWizard } from './components/BracketWizard';
import { MyPredictions } from './components/MyPredictions';
import { ExplanationsPage } from './components/ExplanationsPage';
import { AdminReport } from './components/AdminReport';
import { AdminResultsEntry } from './components/AdminResultsEntry';

export type Page = 'home' | 'results' | 'bracket' | 'my-predictions' | 'explanations' | 'admin';
type WizardMode = 'main' | 'fixR32' | 'fixR16';

interface WizardState {
  mode: WizardMode;
  base: Prediction | null;
  parentMainId?: string;
  name: string;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{ background: '#0a3d28', fontFamily: 'Nunito Sans, sans-serif' }}>
      {children}
    </div>
  );
}

function FirebaseSetupNotice() {
  return (
    <Shell>
      <div className="max-w-lg">
        <h1 style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1.6rem', letterSpacing: '0.04em' }}>
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
  const { user, loading, configured, isVerified, isAdmin, logOut } = useAuth();

  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [results, setResults] = useState<Results>(EMPTY_RESULTS);
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const [adminTab, setAdminTab] = useState<'report' | 'results'>('report');
  const [actionError, setActionError] = useState('');

  const uid = user?.uid ?? null;

  const reloadData = useCallback(async () => {
    if (!uid) return;
    try {
      const [preds, cfg, res] = await Promise.all([fetchMyPredictions(uid), fetchConfig(), fetchResults()]);
      setPredictions(preds);
      setConfig(cfg);
      setResults(res);
    } catch (e) {
      console.error('Error cargando datos', e);
    }
  }, [uid]);

  useEffect(() => {
    if (uid) reloadData();
    else { setPredictions([]); setWizard(null); }
  }, [uid, reloadData]);

  // ─── Lock / fix windows ─────────────────────────────────────────────────────
  const now = Date.now();
  const lockPassed = now >= new Date(config.lockDate).getTime();
  const groupResultsReady = Object.keys(results.groups).length >= 12;
  const r32ResultsReady = results.r32Winners.length >= 16;
  const r32WindowOpen = groupResultsReady && now < new Date(config.r32StartDate).getTime();
  const r16WindowOpen = r32ResultsReady && now < new Date(config.r16StartDate).getTime();

  // ─── Navigation / wizard ────────────────────────────────────────────────────
  function handleNavigate(page: Page) {
    setCurrentPage(page);
    setWizard(null);
    setActionError('');
  }

  function handleNewPrediction() {
    if (!isVerified) { setActionError('Verifica tu correo para crear quinelas.'); return; }
    if (lockPassed) { setActionError('El torneo ya inició: no se pueden crear nuevas quinelas.'); return; }
    const n = predictions.filter(p => p.league === 'main').length + 1;
    setWizard({ mode: 'main', base: null, name: `Mi Quinela #${n}` });
    setCurrentPage('bracket');
  }

  function handleEditPrediction(pred: Prediction) {
    if (!isVerified) { setActionError('Verifica tu correo para editar.'); return; }
    if (lockPassed) { setActionError('El torneo ya inició: los pronósticos quedaron bloqueados.'); return; }
    setWizard({ mode: 'main', base: pred, name: pred.name });
    setCurrentPage('bracket');
  }

  function handleFix(mainPred: Prediction, round: 'r32' | 'r16') {
    if (!isVerified) { setActionError('Verifica tu correo para arreglar tu quinela.'); return; }
    // Build on the latest paid state: R16 fix uses the R32 fix snapshot if it exists.
    let base = mainPred;
    if (round === 'r16') {
      const r32fix = predictions.find(p => p.parentId === mainPred.id && p.league === 'r32');
      if (r32fix) base = r32fix;
    }
    setWizard({
      mode: round === 'r32' ? 'fixR32' : 'fixR16',
      base,
      parentMainId: mainPred.id,
      name: `${mainPred.name} · Arreglo ${round === 'r32' ? 'R32' : 'R16'}`,
    });
    setCurrentPage('bracket');
  }

  async function handleWizardSave(pred: Prediction) {
    setActionError('');
    try {
      if (pred.league === 'main') {
        const isNew = !predictions.some(p => p.id === pred.id);
        await saveMainPrediction(pred, isNew);
      } else {
        await saveFix(pred);
      }
      setWizard(null);
      setCurrentPage('my-predictions');
      await reloadData();
    } catch (e) {
      setActionError((e as Error).message ?? 'No se pudo guardar la quinela.');
    }
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

  // ─── Gating ────────────────────────────────────────────────────────────────
  if (!configured) return <FirebaseSetupNotice />;
  if (loading) {
    return (
      <Shell>
        <div style={{ fontFamily: 'Oswald, sans-serif', color: '#7eb89a', letterSpacing: '0.1em' }}>CARGANDO…</div>
      </Shell>
    );
  }
  if (!user) return <AuthPage />;

  const displayName = user.displayName || user.email?.split('@')[0] || 'Participante';
  const showAdmin = isAdmin && currentPage === 'admin';

  return (
    <div className="min-h-screen" style={{ background: '#0a3d28', fontFamily: 'Nunito Sans, sans-serif' }}>
      <Header
        currentPage={currentPage}
        onNavigate={handleNavigate}
        userName={displayName}
        isAdmin={isAdmin}
        onLogout={logOut}
      />

      {!isVerified && <VerifyEmailNotice />}

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
            parentMainId={wizard.parentMainId}
            predictionName={wizard.name}
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
              />
            )}
            {currentPage === 'results' && <ResultsPage />}
            {(currentPage === 'bracket' || currentPage === 'my-predictions') && (
              <MyPredictions
                predictions={predictions}
                results={results}
                email={user.email ?? undefined}
                lockPassed={lockPassed}
                canSubmit={isVerified}
                r32WindowOpen={r32WindowOpen}
                r16WindowOpen={r16WindowOpen}
                maxPending={config.maxPendingPerUser}
                onNew={handleNewPrediction}
                onEdit={handleEditPrediction}
                onDelete={handleDeletePrediction}
                onFix={handleFix}
              />
            )}
            {currentPage === 'explanations' && <ExplanationsPage config={config} />}
            {showAdmin && (
              <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="flex gap-2 mb-5">
                  {([['report', 'Reporte general'], ['results', 'Resultados / Config']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setAdminTab(key)}
                      className="px-4 py-2 rounded-lg cursor-pointer"
                      style={{
                        fontFamily: 'Oswald, sans-serif', fontSize: '0.82rem', letterSpacing: '0.05em',
                        background: adminTab === key ? '#f5a623' : '#0d5035',
                        color: adminTab === key ? '#062b1a' : '#9cc4b2',
                        border: '1px solid rgba(245,166,35,0.2)',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
                {adminTab === 'report'
                  ? <AdminReport config={config} results={results} />
                  : <AdminResultsEntry config={config} onSaved={reloadData} />}
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
        <p style={{ color: '#3a6b55', fontSize: '0.72rem', fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em' }}>
          QUINELA MUNDIAL FIFA 2026 · EE.UU. · CANADÁ · MÉXICO
        </p>
      </footer>
    </div>
  );
}
