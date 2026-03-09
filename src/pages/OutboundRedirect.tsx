import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const BLOCKED_SCHEMES = ["javascript:", "data:", "blob:", "vbscript:"];

function validateUrl(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (BLOCKED_SCHEMES.some((s) => trimmed.toLowerCase().startsWith(s))) return null;
  let url = trimmed;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    new URL(url);
    return url;
  } catch {
    return null;
  }
}

export default function OutboundRedirect() {
  const [params] = useSearchParams();
  const raw = params.get("u") || "";
  const validUrl = validateUrl(raw);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (validUrl) {
      const t = setTimeout(() => window.location.replace(validUrl), 100);
      return () => clearTimeout(t);
    }
  }, [validUrl]);

  const copy = () => {
    if (validUrl) {
      navigator.clipboard.writeText(validUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!validUrl) {
    return (
      <div style={{ padding: 48, fontFamily: "sans-serif", textAlign: "center" }}>
        <h1>Invalid link</h1>
        <p>The URL provided is not valid.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 48, fontFamily: "sans-serif", textAlign: "center" }}>
      <meta name="referrer" content="no-referrer" />
      <p style={{ marginBottom: 16 }}>Redirecting…</p>
      <a
        href={validUrl}
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        style={{ color: "#2563EB", textDecoration: "underline", fontSize: 14 }}
      >
        Continue to site →
      </a>
      <br />
      <button
        onClick={copy}
        style={{
          marginTop: 12,
          padding: "6px 16px",
          border: "1px solid #ccc",
          borderRadius: 6,
          cursor: "pointer",
          background: copied ? "#e8f5e9" : "#fff",
        }}
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
