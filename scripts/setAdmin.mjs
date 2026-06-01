// One-time script to grant the admin custom claim. NOT part of the app bundle.
//
// Setup:
//   1. Firebase console > Project settings > Service accounts > "Generate new private key".
//      Save the file as scripts/serviceAccount.json (it is gitignored — keep it secret).
//   2. pnpm add -D firebase-admin
//   3. node scripts/setAdmin.mjs hectorineg10@gmail.com
//
// The target user must already have signed up. After running, they must sign out and
// back in (or reload the page) for the new claim to appear in their ID token.

import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/setAdmin.mjs <email>');
  process.exit(1);
}

const serviceAccount = JSON.parse(
  readFileSync(new URL('./serviceAccount.json', import.meta.url), 'utf8'),
);
initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const user = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid, { admin: true });
console.log(`✅ admin:true set for ${email} (uid ${user.uid}).`);
console.log('They must sign out and back in for the claim to take effect.');
