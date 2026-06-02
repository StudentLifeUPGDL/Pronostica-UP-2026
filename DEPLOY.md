# 🚀 Checklist de despliegue — Quiniela Mundial 2026

Guía paso a paso para pasar de "el código ya compila" a "la app está en línea y la
gente puede jugar". El **código ya está listo** (compila sin errores); lo que falta
es **configuración externa y secretos** que, correctamente, no viven en el repo.

> **Orden importa.** Hay 2 pasos que casi siempre se olvidan y dejan la app inservible:
> el **paso 8** (claim de admin) y el **paso 9** (sembrar `config/app`). Sin el paso 9,
> *nadie* puede crear quinielas aunque todo lo demás esté bien.

Tiempo estimado: **30–45 min**.

---

## Resumen de lo que falta

| Paso | Qué | Bloquea si falta |
|------|-----|------------------|
| 1 | Proyecto Firebase (Auth + Firestore + app web) | Todo |
| 2 | `.env.local` con las claves | Login / datos |
| 3 | Desplegar `firestore.rules` | Permisos (todo se rechaza) |
| 4 | Google Form de pago + IDs `entry.*` | Botón de pago |
| 5 | Prueba local (`pnpm dev`) | — (verificación) |
| 6 | Proyecto en Vercel + variables `VITE_*` | Sitio público |
| 7 | Dominio de Vercel en "Authorized domains" | Login en producción |
| 8 | Claim `admin` (`setAdmin.mjs`) | Escrituras de admin |
| 9 | **Sembrar `config/app`** (Admin → Guardar config) | **Crear quinielas** |
| 10 | Prueba de humo end-to-end | — (verificación) |

---

## Requisitos previos

- [ ] **Node 18+** instalado (`node -v`).
- [ ] **pnpm** vía corepack: `corepack enable` (este repo usa pnpm; ya hay `pnpm-lock.yaml`).
- [ ] Cuenta de **Google/Firebase** y cuenta de **Vercel** (puedes entrar con GitHub).
- [ ] El repo clonado y dependencias instaladas:
  ```sh
  corepack pnpm install
  ```

---

## Paso 1 — Crear el proyecto de Firebase

1. [ ] En [console.firebase.google.com](https://console.firebase.google.com) → **Agregar proyecto**.
2. [ ] **Build → Authentication → Sign-in method →** habilita **Email/Password**.
   - (Opcional) En **Templates** personaliza en español los correos de *verificación* y
     *restablecimiento de contraseña*.
3. [ ] **Build → Firestore Database → Crear base de datos →** modo **producción** (no "test").
   Elige una región cercana (p. ej. `us-central` / `nam5`).
4. [ ] **⚙️ Project settings → General → Your apps →** clic en **`</>` (Web)**, registra la
   app (un nombre cualquiera, *sin* Hosting) y **copia el objeto `firebaseConfig`**. Lo
   necesitas en el paso 2.

> La `apiKey` web de Firebase **no es secreta** (es un identificador). La seguridad la dan
> las reglas de Firestore + Auth, así que es seguro incluirla en el bundle.

---

## Paso 2 — Variables de entorno (`.env.local`)

1. [ ] Copia la plantilla:
   ```sh
   cp .env.example .env.local
   ```
2. [ ] Llena las 6 variables de Firebase con los valores del `firebaseConfig` del paso 1:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=tu-proyecto
   VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=1:...:web:...
   ```
3. [ ] Las 4 variables `VITE_PAYMENT_FORM_*` se llenan en el **paso 4** (puedes dejarlas
   vacías por ahora; el botón de pago simplemente no aparecerá hasta que las pongas).

> ⚠️ Vite **incrusta** estas variables al compilar (`vite build`). Por eso también hay que
> ponerlas en Vercel **antes** del build (paso 6), no solo en tu máquina.

---

## Paso 3 — Desplegar las reglas de seguridad

Las reglas ya están escritas en `firestore.rules`, pero hay que **publicarlas** al proyecto.

**Opción A (CLI):**
```sh
corepack pnpm dlx firebase-tools login
corepack pnpm dlx firebase-tools use --add        # selecciona tu proyecto
corepack pnpm dlx firebase-tools deploy --only firestore:rules
```

**Opción B (consola):** Firestore → pestaña **Rules** → pega el contenido de
`firestore.rules` → **Publicar**.

- [ ] Reglas publicadas.

---

## Paso 4 — Google Form de pago

1. [ ] Crea un **Google Form** "Comprobante de pago — Quiniela 2026" con campos:
   **ID de quiniela**, **Correo**, **Competencia/Arreglo**, **Comprobante** (archivo o enlace).
2. [ ] Menú **⋮ → Obtener vínculo previamente rellenado** → llena valores de ejemplo →
   **Obtener vínculo** → copia la URL.
3. [ ] De esa URL extrae el `.../viewform` (base) y los IDs `entry.XXXXXXX` de cada campo.
4. [ ] Pásalos a `.env.local`:
   ```
   VITE_PAYMENT_FORM_BASE_URL=https://docs.google.com/forms/d/e/XXXX/viewform
   VITE_PAYMENT_FORM_ENTRY_PREDID=entry.1111111
   VITE_PAYMENT_FORM_ENTRY_EMAIL=entry.2222222
   VITE_PAYMENT_FORM_ENTRY_LEAGUE=entry.3333333
   ```

---

## Paso 5 — Probar en local

```sh
corepack pnpm dev      # http://localhost:5173
```

- [ ] Si ves la pantalla **"FALTA CONFIGURAR FIREBASE"**, revisa el `.env.local`
  (`VITE_FIREBASE_API_KEY` y `VITE_FIREBASE_PROJECT_ID`) y reinicia `pnpm dev`.
- [ ] Regístrate con el correo del organizador: **`hectorineg10@gmail.com`** (lo necesitas
  para el paso 8). Revisa que llegue el correo de verificación.

---

## Paso 6 — Desplegar en Vercel

1. [ ] Sube el repo a GitHub e impórtalo en [vercel.com](https://vercel.com) → **Add New → Project**.
2. [ ] Framework preset: **Vite**. Build command: `pnpm build`. Output dir: `dist`.
   (`vercel.json` ya añade el *rewrite* SPA.)
3. [ ] **Settings → Environment Variables:** agrega **todas** las `VITE_*` de tu `.env.local`
   (las 6 de Firebase + las 4 del formulario), para los entornos *Production* y *Preview*.
4. [ ] **Deploy.** Anota la URL final (`tu-app.vercel.app`).

> Si cambias variables después, hay que **volver a desplegar** (Redeploy) para que Vite las
> vuelva a incrustar.

---

## Paso 7 — Autorizar el dominio de Vercel en Firebase

- [ ] Firebase → **Authentication → Settings → Authorized domains → Add domain →**
  agrega `tu-app.vercel.app`.

Sin esto, el login en producción falla con `auth/unauthorized-domain`.

---

## Paso 8 — Otorgar el claim de administrador (una sola vez)

El allowlist de correos solo muestra la *interfaz* de admin; el permiso real para
**escribir** (config, resultados, confirmar pagos) lo da el *custom claim* `admin`.

> `firebase-admin` ya está incluido como devDependency en este repo (no necesitas
> instalarlo aparte).

1. [ ] Firebase → **⚙️ Project settings → Service accounts → Generate new private key**.
   Guarda el archivo como **`scripts/serviceAccount.json`** (ya está en `.gitignore` — no
   lo subas).
2. [ ] Con el organizador ya registrado en la app (paso 5), ejecuta:
   ```sh
   node scripts/setAdmin.mjs hectorineg10@gmail.com
   ```
3. [ ] **Cierra sesión y vuelve a entrar** (o recarga). Debe aparecer la pestaña **Admin**.

---

## Paso 9 — ⭐ Sembrar `config/app` (¡el paso que todos olvidan!)

Las reglas de seguridad llaman `get(config/app)` cada vez que alguien crea/edita una
quiniela. Si ese documento **no existe**, esas llamadas fallan y **nadie puede crear
quinielas** (error de permisos), aunque todo lo demás esté perfecto.

1. [ ] Entra como admin → pestaña **Admin → Resultados / Config**.
2. [ ] Revisa fechas, cuotas y % de premio.
3. [ ] Pulsa **Guardar configuración** **una vez**. Esto crea el documento `config/app`.

Valores por defecto (editables en esa pantalla):

- Cierre quiniela principal: **11 jun 2026, 16:00 (CDMX)**
- Límite de pago: **14 jun 2026, 23:59**
- Inicio R32 / R16: **28 jun** / **4 jul 2026**
- Cuotas: principal **$100**, arreglos **$50** · Moneda **MXN** · Premio **90%**, redondeo a **100**

---

## Paso 10 — Prueba de humo end-to-end

Con una cuenta de prueba (un segundo correo, no el de admin):

- [ ] Registro → llega correo de verificación → verificar.
- [ ] Crear una quiniela principal → guardar (debe aparecer en **Mis Quinielas** como *pendiente*).
- [ ] Botón de pago abre el Google Form **pre-rellenado** con ID, correo y competencia.
- [ ] Como **admin**: en **Reporte general**, confirmar el pago de esa quiniela → pasa a *pagada*.
- [ ] Como **admin**: en **Resultados / Config**, capturar algún resultado → el puntaje se
  recalcula en el reporte.
- [ ] (Opcional) Exportar **CSV** del reporte.

Si todos los pasos pasan, **estás en vivo**. 🎉

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| Pantalla "FALTA CONFIGURAR FIREBASE" | Faltan `VITE_FIREBASE_*` o no se reinició Vite | Revisa `.env.local`, reinicia `pnpm dev` / Redeploy en Vercel |
| Login falla con `auth/unauthorized-domain` | Dominio no autorizado | Paso 7 |
| "Missing or insufficient permissions" al **crear quiniela** | `config/app` no sembrado | Paso 9 |
| "Missing or insufficient permissions" al **guardar config/resultados** | Falta el claim `admin` | Paso 8 (y volver a iniciar sesión) |
| No aparece la pestaña **Admin** | No re-iniciaste sesión tras el claim, o el correo no está en `adminEmails` | Cierra y abre sesión; verifica el correo |
| El botón de pago no aparece | Faltan `VITE_PAYMENT_FORM_*` | Paso 4 + Redeploy |
| Variables nuevas no surten efecto en producción | Vite incrusta en build | **Redeploy** en Vercel |

---

## Comandos de referencia

```sh
corepack pnpm install     # instalar dependencias
corepack pnpm dev         # desarrollo  → http://localhost:5173
corepack pnpm build       # genera dist/  (lo que Vercel publica)
node scripts/setAdmin.mjs <correo>   # otorgar claim admin (requiere serviceAccount.json)
```
