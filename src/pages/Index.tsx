import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import JobSearchOS from "../components/JobSearchOS";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#F8F6F1", fontFamily: "'Sora', sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 42, height: 42, background: "linear-gradient(135deg, #B8843F, #E8BD7A)",
            borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 18, color: "#121D36",
            margin: "0 auto 16px", boxShadow: "0 2px 8px rgba(184,132,63,0.4)",
          }}>JS</div>
          <div style={{ fontSize: 14, color: "#6B6B6B" }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <JobSearchOS />;
};

export default Index;
