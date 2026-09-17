import { useEffect, useState } from "react";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { startLogin } from "@/const";

const OFFICIAL_MARK = "/manus-storage/menu-collapsed_962cea64.png";

export function LoginOverlay() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("authError") === "unauthorized") {
      setErrorMessage(
        "Seu e-mail não está cadastrado para acessar esta ferramenta. Fale com o administrador para solicitar a liberação."
      );
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="login-backdrop">
      <div className="login-card-container">
        <div className="login-card">
          <div className="login-card-glow" />

          <div className="login-header">
            <img
              src={OFFICIAL_MARK}
              alt="Indicadores de Serviços"
              className="login-official-mark"
            />
            <h1 className="login-title">
              <span className="login-title-white">INDICADORES DE </span>
              <span className="login-title-blue">SERVIÇOS</span>
            </h1>
            <p className="login-institutional-message">
              Acompanhe os principais indicadores de serviços, clientes e movimentações em um único painel executivo.
            </p>
          </div>

          <div className="login-action-box">
            <button
              type="button"
              className="google-sso-button"
              onClick={() => startLogin()}
            >
              <svg className="google-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.76-2.11-6.71-4.96H1.24v3.15C3.26 21.36 7.34 24 12 24z" />
                <path fill="#FBBC05" d="M5.29 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.24C.45 8.24 0 10.06 0 12s.45 3.76 1.24 5.39l4.05-3.15z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.24 6.61l4.05 3.15c.95-2.85 3.59-4.96 6.71-4.96z" />
              </svg>
              <span className="google-sso-label">ENTRAR COM GOOGLE SSO</span>
            </button>
          </div>

          <p className="login-helper-text">
            Você será direcionado para a autenticação segura da sua conta Google.
          </p>

          {errorMessage && (
            <div className="login-error-alert" role="alert">
              <AlertCircle size={18} className="login-error-icon" />
              <div className="login-error-text">
                <strong>Acesso não liberado</strong>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        <div className="login-security-badge">
          <ShieldCheck size={14} className="security-shield-icon" />
          <span>ACESSO SEGURO · INDICADORES DE SERVIÇOS</span>
        </div>
      </div>
    </div>
  );
}
