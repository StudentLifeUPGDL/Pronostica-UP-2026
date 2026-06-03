import type { League, Prediction } from '../app/data/worldcup';

// Payment link shown on the "pagar" buttons. Two modes, picked by which env vars
// are set:
//   1. Plain link (preferred) — VITE_PAYMENT_URL points at the external payment
//      app/page. It's opened exactly as given (no query params appended), since a
//      third-party payment page can't be pre-filled the way a Google Form can.
//   2. Google Form (legacy fallback) — VITE_PAYMENT_FORM_BASE_URL + the ENTRY_*
//      field IDs; the form is pre-filled with the entry id / email / competition.
const PAY_URL = import.meta.env.VITE_PAYMENT_URL;
const FORM_BASE = import.meta.env.VITE_PAYMENT_FORM_BASE_URL;
const ENTRY_PREDID = import.meta.env.VITE_PAYMENT_FORM_ENTRY_PREDID;
const ENTRY_EMAIL = import.meta.env.VITE_PAYMENT_FORM_ENTRY_EMAIL;
const ENTRY_LEAGUE = import.meta.env.VITE_PAYMENT_FORM_ENTRY_LEAGUE;

// A plain external link takes precedence over the legacy Google Form.
const usePlainLink = Boolean(PAY_URL);

// True once any payment destination is configured. While false, payments aren't
// live yet: the pay buttons stay dormant and the pending cap is not enforced.
export const paymentConfigured = Boolean(PAY_URL || FORM_BASE);

// Button label. A bank-transfer form says "confirmar transferencia"; a payment app
// says "pagar". Overridable via env when you know the exact flow.
export const PAYMENT_CTA_LABEL: string =
  import.meta.env.VITE_PAYMENT_CTA_LABEL || (usePlainLink ? 'PAGAR' : 'CONFIRMAR TRANSFERENCIA');

const LEAGUE_LABEL: Record<League, string> = {
  main: 'Pronóstico principal',
  r32: 'Liga Dieciseisavos (R32)',
  r16: 'Liga Octavos (R16)',
};

export function leagueLabel(league: League): string {
  return LEAGUE_LABEL[league] ?? league;
}

// Label shown for Quiniela (random-team) tickets on the payment form.
export const RIFA_LABEL = 'Quiniela';

// Payment URL for a MAIN/side-league prediction.
export function buildPredictionPaymentUrl(prediction: Prediction, email?: string): string {
  return buildPaymentUrl(prediction.id, leagueLabel(prediction.league), email || prediction.userEmail);
}

// Payment URL for an arbitrary entry (a prediction id or a Rifa ticket folio).
//   - Plain-link mode: returns VITE_PAYMENT_URL untouched (id/competition/email are
//     ignored — a third-party page can't be pre-filled).
//   - Google Form mode: returns the form pre-filled with the entry's id, email and
//     competition so the user only pastes their transfer.
export function buildPaymentUrl(id: string, competition: string, email?: string): string {
  if (usePlainLink) return PAY_URL as string;
  if (!FORM_BASE) return '';
  let url: URL;
  try {
    url = new URL(FORM_BASE);
  } catch {
    return '';
  }
  url.searchParams.set('usp', 'pp_url');
  if (ENTRY_PREDID) url.searchParams.set(ENTRY_PREDID, id);
  if (ENTRY_EMAIL && email) url.searchParams.set(ENTRY_EMAIL, email);
  if (ENTRY_LEAGUE) url.searchParams.set(ENTRY_LEAGUE, competition);
  return url.toString();
}
