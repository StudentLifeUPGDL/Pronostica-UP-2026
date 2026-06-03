import { CreditCard, ExternalLink } from 'lucide-react';
import type { Prediction } from '../data/worldcup';
import { buildPredictionPaymentUrl, paymentConfigured, PAYMENT_CTA_LABEL } from '../../lib/payment';

// Button that sends the user to the external payment link (a payment app, or a
// pre-filled Google Form in legacy mode) to complete/confirm their payment.
export function PaymentCta({ prediction, email, compact }: {
  prediction: Prediction;
  email?: string;
  compact?: boolean;
}) {
  if (prediction.paymentStatus === 'paid') return null;
  const url = buildPredictionPaymentUrl(prediction, email);

  if (!paymentConfigured || !url) {
    return (
      <span style={{ color: '#4a7d65', fontSize: '0.7rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'" }}>
        pago no configurado
      </span>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg cursor-pointer transition-all"
      style={{
        background: 'rgba(212,242,38,0.12)', color: '#d4f226',
        border: '1px solid rgba(212,242,38,0.3)',
        fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", letterSpacing: '0.04em',
        fontSize: compact ? '0.72rem' : '0.8rem',
        padding: compact ? '4px 10px' : '8px 14px',
      }}>
      <CreditCard size={compact ? 12 : 14} />
      {PAYMENT_CTA_LABEL}
      <ExternalLink size={compact ? 10 : 12} />
    </a>
  );
}
