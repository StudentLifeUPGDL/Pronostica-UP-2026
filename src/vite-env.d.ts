/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_PAYMENT_FORM_BASE_URL: string;
  readonly VITE_PAYMENT_FORM_ENTRY_PREDID: string;
  readonly VITE_PAYMENT_FORM_ENTRY_EMAIL: string;
  readonly VITE_PAYMENT_FORM_ENTRY_LEAGUE: string;
}
