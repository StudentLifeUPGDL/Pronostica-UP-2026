import { doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

// Flow: the user pays through the external payment app (which can't notify us back),
// then uploads a screenshot here and checks which entries it covers. We flip the
// selected predictions/tickets to 'review' ("CONFIRMANDO PAGO"); the admin later
// verifies the proof and marks them 'paid'.
//
// TEMPORARY, NO-BILLING STORAGE: Firebase Storage needs the Blaze (billing) plan, so
// for now we compress the screenshot to a small JPEG *data URL* and store it inline
// on each entry's `proofUrl`. Firestore stays on the free Spark plan. The admin's
// "ver" link opens the data URL directly. To switch to real Storage later, restore
// the uploadBytes/getDownloadURL version (see git history) — only this file changes.

// What the user selected as covered by a single proof screenshot.
export interface ProofSelection {
  predictionIds: string[];
  ticketIds: string[];
}

export const MAX_PROOF_BYTES = 10 * 1024 * 1024; // 10 MB before compression

// Firestore docs cap at ~1 MB total. Keep the inline image comfortably under that so
// it fits alongside the entry's other fields (and isn't huge when copied onto several
// entries at once). A payment receipt stays perfectly legible at this size.
const MAX_DATA_URL_CHARS = 500 * 1024; // ~500 KB

function encodeJpeg(bitmap: ImageBitmap, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen en este navegador.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

// Downscale + re-encode until the data URL fits under the cap. Screenshots shrink a
// lot, so the first attempt almost always wins.
async function compressToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('No se pudo leer la imagen. Sube una captura PNG o JPG.');
  try {
    const attempts: Array<[number, number]> = [
      [1280, 0.72], [1024, 0.68], [820, 0.62], [640, 0.55], [480, 0.5],
    ];
    let smallest = '';
    for (const [maxSide, quality] of attempts) {
      const dataUrl = encodeJpeg(bitmap, maxSide, quality);
      smallest = dataUrl;
      if (dataUrl.length <= MAX_DATA_URL_CHARS) return dataUrl;
    }
    // Even the most aggressive attempt is still too big.
    throw new Error('La imagen es muy pesada. Toma una captura más pequeña o recórtala e inténtalo de nuevo.');
  } finally {
    bitmap.close();
  }
}

// Flip every selected entry to 'review' in one batch, with the proof image inline.
// Firestore rules only allow the owner to set pending → review and attach the proof
// fields (nothing else), so this is safe.
export async function submitPaymentProof(opts: {
  uid: string;
  file: File;
  selection: ProofSelection;
  note?: string;
}): Promise<void> {
  const { file, selection, note } = opts;
  const { predictionIds, ticketIds } = selection;
  if (predictionIds.length === 0 && ticketIds.length === 0) {
    throw new Error('Selecciona al menos un pronóstico o boleto que estás pagando.');
  }
  if (file.size > MAX_PROOF_BYTES) {
    throw new Error('La imagen es demasiado grande (máximo 10 MB).');
  }

  const proofUrl = await compressToDataUrl(file);

  const patch: Record<string, unknown> = {
    paymentStatus: 'review',
    proofUrl,
    proofSubmittedAt: new Date().toISOString(),
  };
  if (note && note.trim()) patch.paymentNote = note.trim();

  const batch = writeBatch(db);
  for (const id of predictionIds) batch.update(doc(db, 'predictions', id), patch);
  for (const id of ticketIds) batch.update(doc(db, 'tickets', id), patch);
  await batch.commit();
}
