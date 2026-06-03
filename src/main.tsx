import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { AuthProvider } from "./lib/auth.tsx";
import "./styles/index.css";

// Note: country flags render via the self-hosted "Twemoji Country Flags"
// @font-face declared in styles/fonts.css (applied through body/heading
// font-family in theme.css).

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
