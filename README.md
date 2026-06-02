# Quiniela Mundial 2026

App de pronósticos del Mundial FIFA 2026: cuentas con verificación por correo, almacenamiento en
la nube, puntaje automático, **ligas de "arreglos"** posteriores al inicio (R32 y R16) con premios
aparte, y un **reporte privado de administrador**.

- **Stack:** React 18 + TypeScript + Vite + TailwindCSS. Backend: **Firebase** (Auth + Cloud Firestore).
- **Deploy:** estático en **Vercel** (`vite build` → `dist/`).

---

## 1. Requisitos

- Node 18+ (incluye `corepack`). Este repo usa **pnpm**; actívalo con `corepack` si no lo tienes:
  ```sh
  corepack pnpm install      # o: pnpm install / npm install
  ```

## 2. Crear el proyecto de Firebase

1. En [console.firebase.google.com](https://console.firebase.google.com) crea un proyecto.
2. **Authentication → Sign-in method →** habilita **Email/Password**. (Opcional: personaliza en
   español los correos de verificación y de restablecimiento.)
3. **Firestore Database →** crea la base de datos (modo producción).
4. **Project settings → General → Your apps →** registra una app **Web** y copia el objeto de
   configuración (`apiKey`, `authDomain`, etc.).

## 3. Variables de entorno

Copia `.env.example` a **`.env.local`** y llena los valores de Firebase y del formulario de pago:

```sh
cp .env.example .env.local
```

> La `apiKey` web de Firebase **no es secreta** (es un identificador); la seguridad la dan las
> reglas de Firestore + Auth. Es seguro incluirla en el bundle.

## 4. Reglas de seguridad

Despliega `firestore.rules` (incluidas en el repo):

```sh
pnpm dlx firebase-tools login
pnpm dlx firebase-tools use --add        # selecciona tu proyecto
pnpm dlx firebase-tools deploy --only firestore:rules
```

(O pega el contenido de `firestore.rules` en **Firestore → Rules** y publica.)

## 5. Administrador

1. Regístrate en la app con el correo del organizador (`hectorineg10@gmail.com`).
2. Otorga el claim de admin (una sola vez):
   ```sh
   # Project settings → Service accounts → "Generate new private key"
   # guarda el archivo como scripts/serviceAccount.json (está en .gitignore)
   pnpm add -D firebase-admin
   node scripts/setAdmin.mjs hectorineg10@gmail.com
   ```
3. Cierra sesión y vuelve a entrar. Aparecerá la pestaña **Admin**.
4. En **Admin → Resultados / Config**, pulsa **Guardar configuración** una vez para inicializar el
   documento `config/app` (fechas de cierre, cuotas, % de premio, etc.). **Esto es necesario** para
   que los participantes puedan crear quinielas.

## 6. Formulario de pago (Google Forms)

1. Crea un Google Form "Comprobante de pago — Quiniela 2026" con campos: **ID de quiniela**,
   **Correo**, **Competencia/Arreglo**, **Comprobante** (archivo o enlace).
2. "Obtener vínculo previamente rellenado" → llena valores de ejemplo → copia el enlace y extrae
   los IDs `entry.XXXXXXX` de cada campo.
3. Pásalos a `.env.local` (`VITE_PAYMENT_FORM_BASE_URL`, `VITE_PAYMENT_FORM_ENTRY_PREDID`,
   `VITE_PAYMENT_FORM_ENTRY_EMAIL`, `VITE_PAYMENT_FORM_ENTRY_LEAGUE`).

## 7. Desarrollo

```sh
corepack pnpm dev      # http://localhost:5173
corepack pnpm build    # genera dist/
```

## 8. Deploy en Vercel

1. Sube el repo a GitHub e impórtalo en [vercel.com](https://vercel.com).
2. Framework: **Vite**. Build: `pnpm build`. Output: `dist`. (`vercel.json` ya añade el rewrite SPA.)
3. En **Settings → Environment Variables** agrega todas las `VITE_*` de tu `.env.local`.
4. Tras el primer deploy, en **Firebase → Authentication → Settings → Authorized domains** agrega el
   dominio de Vercel (`tu-app.vercel.app`).

---

## Reglas del juego (resumen)

- **Cuentas:** correo + contraseña, con verificación por email (y recuperación de contraseña).
- **Quinielas:** ilimitadas por persona, máx. 5 con pago pendiente a la vez. Cada una se paga por
  separado vía el Google Form; el admin confirma el pago manualmente. Las pendientes vencidas se
  pueden anular tras la fecha límite.
- **Puntaje:** grupos por **posición exacta** (2 pts c/u por 1°, 2°, 3°); eliminatorias por **equipo
  que avanza** (R32=3, R16=5, Cuartos=8, Semis=13); Campeón=25, Subcampeón=10, 3°=7.
- **Ganador único:** se ordena por puntos; los empates se rompen por hora de registro (el primero gana).
- **Arreglos (ligas aparte):** tras el inicio, con la quiniela principal pagada, se puede comprar un
  arreglo de **R32** (al conocerse los grupos) y otro de **R16** (al conocerse R32). Cada arreglo es
  una liga independiente con su propio bote; reparte el 90% del bote (configurable), redondeado hacia
  abajo a 100.
- **Clasificación:** privada del organizador (pestaña **Admin → Reporte general**, con exportación CSV).
