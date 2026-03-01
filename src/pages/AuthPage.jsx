import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setMessage("Check your email for a confirmation link!");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage("Check your email for a password reset link!");
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError("");
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) setError(error.message);
  };

  return (
    <div className="auth-page">
      <style>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #F8F6F1;
          font-family: 'Sora', sans-serif;
          padding: 20px;
        }
        .auth-card {
          width: 100%;
          max-width: 420px;
          background: white;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.1);
          border: 1px solid #EAE6DC;
        }
        .auth-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 32px;
          justify-content: center;
        }
        .auth-logo-mark {
          width: 42px; height: 42px;
          background: linear-gradient(135deg, #B8843F, #E8BD7A);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Cormorant Garamond', serif;
          font-weight: 700; font-size: 18px; color: #121D36;
          box-shadow: 0 2px 8px rgba(184,132,63,0.4);
        }
        .auth-logo-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px; font-weight: 700; color: #1C1C1C;
        }
        .auth-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 24px; font-weight: 700; color: #1C1C1C;
          text-align: center; margin-bottom: 8px;
        }
        .auth-sub {
          font-size: 13px; color: #6B6B6B;
          text-align: center; margin-bottom: 28px;
        }
        .auth-input {
          width: 100%;
          background: #FFFFFF;
          border: 1.5px solid #DDD8CC;
          border-radius: 8px;
          padding: 11px 14px;
          font-family: 'Sora', sans-serif;
          font-size: 13px; color: #1C1C1C;
          outline: none; margin-bottom: 14px;
          transition: border-color .15s, box-shadow .15s;
          box-sizing: border-box;
        }
        .auth-input:focus {
          border-color: #B8843F;
          box-shadow: 0 0 0 3px rgba(184,132,63,0.12);
        }
        .auth-input::placeholder { color: #9B9B9B; }
        .auth-btn {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          font-family: 'Sora', sans-serif;
          font-size: 13px; font-weight: 600;
          cursor: pointer; border: none;
          transition: all .15s;
        }
        .auth-btn-primary {
          background: #1A2744; color: white;
          box-shadow: 0 2px 8px rgba(18,29,54,0.2);
        }
        .auth-btn-primary:hover { background: #243360; }
        .auth-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .auth-btn-google {
          background: white; color: #3D3D3D;
          border: 1.5px solid #DDD8CC;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          margin-bottom: 14px;
        }
        .auth-btn-google:hover { background: #F2EFE8; border-color: #DDD8CC; }
        .auth-divider {
          display: flex; align-items: center; gap: 14px;
          margin: 20px 0; color: #9B9B9B; font-size: 12px;
        }
        .auth-divider::before, .auth-divider::after {
          content: ''; flex: 1; height: 1px; background: #EAE6DC;
        }
        .auth-error {
          background: rgba(192,57,43,0.08);
          border: 1px solid rgba(192,57,43,0.2);
          color: #C0392B; padding: 10px 14px;
          border-radius: 8px; font-size: 12px;
          margin-bottom: 14px;
        }
        .auth-message {
          background: rgba(26,127,90,0.08);
          border: 1px solid rgba(26,127,90,0.2);
          color: #1A7F5A; padding: 10px 14px;
          border-radius: 8px; font-size: 12px;
          margin-bottom: 14px;
        }
        .auth-toggle {
          text-align: center; margin-top: 20px;
          font-size: 12.5px; color: #6B6B6B;
        }
        .auth-link {
          color: #B8843F; cursor: pointer;
          font-weight: 600; text-decoration: none;
        }
        .auth-link:hover { text-decoration: underline; }
      `}</style>

      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">JS</div>
          <div className="auth-logo-name">Job Search OS</div>
        </div>

        <div className="auth-title">
          {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset password"}
        </div>
        <div className="auth-sub">
          {mode === "login"
            ? "Sign in to continue your job search"
            : mode === "signup"
            ? "Start tracking your career applications"
            : "We'll send you a reset link"}
        </div>

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-message">{message}</div>}

        {mode !== "forgot" && (
          <>
            <button className="auth-btn auth-btn-google" onClick={handleGoogle}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
            <div className="auth-divider">or</div>
          </>
        )}

        <form onSubmit={handleEmailAuth}>
          {mode === "signup" && (
            <input
              className="auth-input"
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            className="auth-input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {mode !== "forgot" && (
            <input
              className="auth-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          )}
          {mode === "login" && (
            <div style={{ textAlign: "right", marginBottom: 14, marginTop: -8 }}>
              <span className="auth-link" onClick={() => setMode("forgot")} style={{ fontSize: 12 }}>
                Forgot password?
              </span>
            </div>
          )}
          <button className="auth-btn auth-btn-primary" type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Sign in"
              : mode === "signup"
              ? "Create account"
              : "Send reset link"}
          </button>
        </form>

        <div className="auth-toggle">
          {mode === "login" ? (
            <>Don't have an account? <span className="auth-link" onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>Sign up</span></>
          ) : mode === "signup" ? (
            <>Already have an account? <span className="auth-link" onClick={() => { setMode("login"); setError(""); setMessage(""); }}>Sign in</span></>
          ) : (
            <span className="auth-link" onClick={() => { setMode("login"); setError(""); setMessage(""); }}>← Back to sign in</span>
          )}
        </div>
      </div>
    </div>
  );
}
