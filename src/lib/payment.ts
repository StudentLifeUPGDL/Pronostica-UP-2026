import type { League, Prediction } from '../app/data/worldcup';

// Google Form for transfer/payment confirmation. The form is created externally;
// its base "viewform" URL and field entry IDs come from the form's pre-filled link
// and are provided via env vars.
const BASE = import.meta.env.VITE_PAYMENT_FORM_BASE_URL;
const ENTRY_PREDID = import.meta.env.VITE_PAYMENT_FORM_ENTRY_PREDID;
const ENTRY_EMAIL = import.meta.env.VITE_PAYMENT_FORM_ENTRY_EMAIL;
const ENTRY_LEAGUE = import.meta.env.VITE_PAYMENT_FORM_ENTRY_LEAGUE;

export const paymentFormConfigured = Boolean(BASE);

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

// Builds a pre-filled Google Form URL carrying the entry's ID, the user's email,
// and which competition the payment is for, so the user only pastes their transfer.
export function buildGoogleFormUrl(prediction: Prediction, email?: string): string {
  return buildPaymentFormUrl(prediction.id, leagueLabel(prediction.league), email || prediction.userEmail);
}

// Same pre-filled payment form, addressed by an arbitrary id + competition label.
// Used by Rifa tickets (which aren't Predictions but share the same form/fields).
export function buildPaymentFormUrl(id: string, competition: string, email?: string): string {
  if (!BASE) return '';
  let url: URL;
  try {
    url = new URL(BASE);
  } catch {
    return '';
  }
  url.searchParams.set('usp', 'pp_url');
  if (ENTRY_PREDID) url.searchParams.set(ENTRY_PREDID, id);
  if (ENTRY_EMAIL && email) url.searchParams.set(ENTRY_EMAIL, email);
  if (ENTRY_LEAGUE) url.searchParams.set(ENTRY_LEAGUE, competition);
  return url.toString();
}
