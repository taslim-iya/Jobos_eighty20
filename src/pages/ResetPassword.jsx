import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) {
      setError("Invalid or expired reset link.");
    }
  }, []);

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setMessage("Password updated! Redirecting...");
      setTimeout(() => navigate("/"), 2000);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#F8F6F1", fontFamily: "'Sora', sans-serif", padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 420, background: "white", borderRadius: 16,
        padding: 40, boxShadow: "0 12px 32px rgba(0,0,0,0.1)", border: "1px solid #EAE6DC",
      }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 700, textAlign: "center", marginBottom: 24 }}>
          Set New Password
        </div>
        {error && <div style={{ background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.2)", color: "#C0392B", padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{error}</div>}
        {message && <div style={{ background: "rgba(26,127,90,0.08)", border: "1px solid rgba(26,127,90,0.2)", color: "#1A7F5A", padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{message}</div>}
        <form onSubmit={handleReset}>
          <input
            type="password"
            placeholder="New password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: "100%", background: "#fff", border: "1.5px solid #DDD8CC", borderRadius: 8,
              padding: "11px 14px", fontFamily: "'Sora', sans-serif", fontSize: 13, color: "#1C1C1C",
              outline: "none", marginBottom: 14, boxSizing: "border-box",
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: 12, borderRadius: 8, background: "#1A2744", color: "white",
              fontFamily: "'Sora', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: "none", opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
