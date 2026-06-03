# 🚀 Checklist de despliegue — Quiniela Mundial 2026

> **Estado:** la app base **ya está en línea y operando** (Firebase, reglas, pago por
> Google Form, Vercel, claim de admin y `config/app` sembrado). Esta guía conserva esos
> pasos como **referencia / ya completado** y agrega lo único nuevo pendiente: **activar
> la Rifa de Países** (sección ⭐ al final).

---

## ✅ Base — ya completado (referencia)

| Paso | Qué | Estado |
|------|-----|--------|
| 1 | Proyecto Firebase (Auth + Firestore + app web) | ✅ Hecho |
| 2 | `.env.local` + variables `VITE_*` | ✅ Hecho |
| 3 | Reglas `firestore.rules` publicadas | ✅ Hecho · ⚠️ **re-publicar** (cambiaron, ver abajo) |
| 4 | Google Form de pago + IDs `entry.*` | ✅ Hecho |
| 5 | Prueba local (`pnpm dev`) | ✅ Hecho |
| 6 | Vercel + variables `VITE_*` | ✅ Hecho |
| 7 | Dominio de Vercel en "Authorized domains" | ✅ Hecho |
| 8 | Claim `admin` (`setAdmin.mjs`) | ✅ Hecho |
| 9 | `config/app` sembrado (Admin → Guardar config) | ✅ Hecho · ⚠️ **re-guardar** (campos nuevos) |
| 10 | Prueba de humo end-to-end | ✅ Hecho |

> Si necesitas el detalle de cualquiera de estos pasos, está en el historial de git de
> este archivo (commit anterior). Los comandos de referencia siguen al final.

---

## ⭐ NUEVO — Activar la "Rifa de Países" (modo tradicional)

La Rifa permite comprar boletos que asignan **una selección al azar**. Cuando un pool
junta **48 boletos pagados**, un **cron de GitHub Actions** sortea los 48 equipos,
**envía un correo** (Resend) a cada dueño y abre el siguiente pool. Toda la asignación
ocurre en el servidor (cron con `firebase-admin`), nunca en el navegador, así que nadie
puede elegir su equipo.

Tiempo estimado: **15–25 min**.

### A — Re-publicar las reglas de Firestore (obligatorio)

`firestore.rules` ahora incluye las colecciones `pools` y `tickets`. Sin esto, comprar
boletos falla con *"Missing or insufficient permissions"*.

```sh
corepack pnpm dlx firebase-tools deploy --only firestore:rules
```
o pega `firestore.rules` en Firestore → **Rules → Publicar**.

- [ ] Reglas re-publicadas.

### B — Re-guardar la configuración (campos nuevos)

`config/app` ahora tiene `rifaEnabled`, `rifaFee` y `rifaPayoutSplit`.

1. [ ] Entra como admin → **Admin → Resultados / Config**.
2. [ ] En la sección **RIFA DE PAÍSES**: activa el modo, fija el **precio por boleto**
   (default $50) y el **reparto del bote** (default 70% campeón / 20% subcampeón / 10% 3°).
3. [ ] Pulsa **Guardar configuración**.

### C — Crear una "Contraseña de aplicación" de Gmail (correos)

Los correos se envían por **Gmail SMTP** desde tu propia cuenta — no necesitas dominio.
Sale autenticado por Google, así que entrega bien (no spam). Límite ~500 correos/día.

1. [ ] En la cuenta de Gmail que enviará los correos, activa **Verificación en 2 pasos**
   (https://myaccount.google.com/security).
2. [ ] Crea una **Contraseña de aplicación**: https://myaccount.google.com/apppasswords
   → nómbrala "Pronostica Pantera" → copia los **16 caracteres** (sin espacios).
3. [ ] Esa cadena es tu `GMAIL_APP_PASSWORD` (NO es tu contraseña normal de Gmail).

> ⚠️ El correo `@up.edu.mx` no sirve aquí (Resend exigía verificar el dominio y no eres
> su administrador). Gmail SMTP evita ese problema usando tu cuenta personal de Gmail.

### D — Secrets en GitHub (para el cron)

En el repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor | ¿Ya existía? |
|--------|-------|--------------|
| `FIREBASE_SERVICE_ACCOUNT` | El JSON de la cuenta de servicio en **una sola línea** | Sí, lo usa `sync-results` |
| `GMAIL_USER` | El Gmail que envía, ej. `tucorreo@gmail.com` | **Nuevo** |
| `GMAIL_APP_PASSWORD` | Los 16 caracteres del paso C | **Nuevo** |
| `GMAIL_FROM_NAME` | `Pronostica Pantera` (opcional, nombre visible) | **Nuevo** |
| `APP_URL` | `https://tu-app.vercel.app` (opcional, botón del correo) | **Nuevo** |

> Si `FIREBASE_SERVICE_ACCOUNT` ya está configurado para `sync-results.yml`, **no** hay
> que volver a crearlo; el workflow nuevo (`manage-pools.yml`) usa el mismo secret.

### E — El workflow del cron

`.github/workflows/manage-pools.yml` ya está en el repo. Corre cada **5 min** y también
se puede disparar a mano.

- [ ] GitHub → pestaña **Actions** → workflow **"Manage Rifa pools"** → habilítalo si
  Actions está deshabilitado.
- [ ] (Prueba) **Run workflow** para forzar una corrida inmediata.

> ⚠️ **Sobre "inmediato":** GitHub Actions **no garantiza** crons por debajo de ~5 min y
> puede retrasarlos bajo carga. La asignación es **casi inmediata** (≈ cada 5 min). Para
> un sorteo al instante, usa **Run workflow** manualmente. Una asignación verdaderamente
> instantánea requeriría Cloud Functions (plan Blaze), que este proyecto no usa.

### F — Prueba de humo de la Rifa

- [ ] Como usuario: **Rifa de Países → Comprar boleto** → aparece el folio `RIFA-XXXXX` y
  el botón **Confirmar transferencia** (abre el Google Form prellenado con folio y correo).
- [ ] Como admin: **Admin → Rifa de Países** → cambia ese boleto a **pagado**.
- [ ] (Para probar la asignación sin esperar 48 boletos) baja temporalmente la prueba:
  marca 48 boletos como pagados, o ejecuta el cron en seco localmente:
  ```sh
  node scripts/managePools.mjs --dry-run      # muestra qué pools/asignaciones haría
  node scripts/managePools.mjs --write        # asigna + envía correos
  node scripts/managePools.mjs --write --no-email   # asigna sin correos
  ```
  (Requiere `scripts/serviceAccount.json` y, para correos, `RESEND_API_KEY` + `RESEND_FROM`.)
- [ ] Al llenarse el pool: cada boleto muestra su equipo y llega el correo. ✅

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| Pantalla "FALTA CONFIGURAR FIREBASE" | Faltan `VITE_FIREBASE_*` o no se reinició Vite | Revisa `.env.local`, reinicia `pnpm dev` / Redeploy en Vercel |
| Login falla con `auth/unauthorized-domain` | Dominio no autorizado | Authentication → Settings → Authorized domains |
| "Missing or insufficient permissions" al **crear quiniela** | `config/app` no sembrado | Admin → Guardar configuración |
| "Missing or insufficient permissions" al **comprar boleto** | Reglas nuevas no publicadas | Sección **A** (re-publicar `firestore.rules`) |
| "Missing or insufficient permissions" al **guardar config/resultados** | Falta el claim `admin` | `setAdmin.mjs` (y volver a iniciar sesión) |
| No aparece la pestaña **Rifa de Países** | `rifaEnabled` apagado | Admin → Resultados / Config → activar Rifa → Guardar |
| Los pools no se asignan | El cron no corre / faltan secrets | Actions → habilitar **"Manage Rifa pools"**; revisa `FIREBASE_SERVICE_ACCOUNT` |
| No llegan correos | `RESEND_*` mal o dominio sin verificar | Revisa secrets `RESEND_API_KEY`/`RESEND_FROM` y el dominio en Resend |
| El botón de pago no aparece | Faltan `VITE_PAYMENT_FORM_*` | Configurar el Google Form + Redeploy |
| Variables nuevas no surten efecto en producción | Vite incrusta en build | **Redeploy** en Vercel |

---

## Comandos de referencia

```sh
corepack pnpm install     # instalar dependencias
corepack pnpm dev         # desarrollo  → http://localhost:5173
corepack pnpm build       # genera dist/  (lo que Vercel publica)

node scripts/setAdmin.mjs <correo>            # otorgar claim admin (requiere serviceAccount.json)
node scripts/syncResults.mjs --dry-run        # ver resultados que sincronizaría
node scripts/managePools.mjs --dry-run        # ver asignaciones de Rifa que haría
node scripts/managePools.mjs --write          # asignar pools llenos + enviar correos
```
