import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const FEATURES = [
  {
    icon: "📊",
    title: "Pipeline Tracker",
    desc: "Kanban board to manage every application from Saved → Offer. Drag, filter, and never lose track of a role.",
  },
  {
    icon: "🔍",
    title: "AI Job Discovery",
    desc: "Intelligent search across top career sites. Match scores rank opportunities against your profile and preferences.",
  },
  {
    icon: "🎙️",
    title: "Interview Prep",
    desc: "AI-powered mock interviews tailored to IB, Consulting, and Product roles. Get real-time feedback on your answers.",
  },
  {
    icon: "📝",
    title: "Cover Letter Generator",
    desc: "One-click cover letters crafted from your CV and the job description. Edit, refine, and export to PDF.",
  },
  {
    icon: "📧",
    title: "Outreach CRM",
    desc: "Track networking contacts, email sequences, and follow-ups. Never let a warm lead go cold.",
  },
  {
    icon: "📄",
    title: "Document Vault",
    desc: "Store CVs, transcripts, and writing samples. AI extracts key entities so your materials are always search-ready.",
  },
];

const TRACKS = [
  { emoji: "🏦", name: "Investment Banking", color: "bg-navy text-primary-foreground" },
  { emoji: "📈", name: "Consulting", color: "bg-secondary text-secondary-foreground" },
  { emoji: "🚀", name: "Product & Tech", color: "bg-navy-light text-primary-foreground" },
  { emoji: "🎓", name: "Post-Graduate Path", color: "bg-primary text-primary-foreground" },
];

const STATS = [
  { value: "6", label: "Integrated Modules" },
  { value: "AI", label: "Powered Intelligence" },
  { value: "∞", label: "Applications Tracked" },
  { value: "4", label: "Career Tracks" },
];

export default function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background font-body">
      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-secondary to-gold-light flex items-center justify-center font-display font-bold text-navy text-sm shadow-md">
              JS
            </div>
            <span className="font-display font-bold text-lg text-foreground">Job Search OS</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/auth")}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold shadow-md hover:bg-navy-light transition-all hover:-translate-y-0.5"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gold-bg to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto px-5 pt-20 pb-24 md:pt-28 md:pb-32 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold-bg border border-secondary/30 mb-8">
            <span className="font-mono text-xs font-semibold tracking-wider uppercase text-secondary">
              Built for ambitious candidates
            </span>
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold text-foreground leading-[1.08] mb-6 tracking-tight">
            Your entire job search,
            <br />
            <span className="text-secondary">one operating system.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Track applications, prep for interviews, generate cover letters, and manage
            networking — all from a single, beautifully-designed command centre.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate("/auth")}
              className="px-8 py-3.5 bg-primary text-primary-foreground rounded-xl text-base font-semibold shadow-lg hover:bg-navy-light transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              Start for Free →
            </button>
            <button
              onClick={() => {
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="px-8 py-3.5 border border-border text-muted-foreground rounded-xl text-base font-medium hover:bg-card hover:text-foreground transition-all"
            >
              See Features
            </button>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-y border-border bg-card">
        <div className="max-w-5xl mx-auto px-5 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-mono text-3xl md:text-4xl font-bold text-secondary mb-1">{s.value}</div>
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-20 md:py-28">
        <div className="text-center mb-16">
          <div className="font-mono text-xs font-semibold tracking-[0.2em] uppercase text-secondary mb-4">
            Everything you need
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
            Six modules. One mission.
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Each module is purpose-built for the competitive finance, consulting, and tech recruiting landscape.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group bg-card border border-border rounded-2xl p-7 hover:shadow-lg hover:border-secondary/30 transition-all duration-300"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRACKS ── */}
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-5 py-20 md:py-28">
          <div className="text-center mb-14">
            <div className="font-mono text-xs font-semibold tracking-[0.2em] uppercase text-gold-light mb-4">
              Purpose-built tracks
            </div>
            <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
              Tailored for your career path.
            </h2>
            <p className="text-primary-foreground/60 text-lg max-w-lg mx-auto">
              Whether you're targeting bulge-bracket banks, MBB consulting, or top tech firms — the OS adapts to you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TRACKS.map((t) => (
              <div
                key={t.name}
                className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center hover:bg-white/10 transition-all"
              >
                <div className="text-4xl mb-4">{t.emoji}</div>
                <h3 className="font-display text-2xl font-bold mb-2">{t.name}</h3>
                <p className="text-sm text-primary-foreground/50">
                  Custom playbooks, question banks, and interview frameworks designed for this track.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="max-w-4xl mx-auto px-5 py-20 md:py-28">
        <div className="text-center mb-16">
          <div className="font-mono text-xs font-semibold tracking-[0.2em] uppercase text-secondary mb-4">
            Simple workflow
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground">
            From sign-up to offer in four steps.
          </h2>
        </div>

        <div className="space-y-8">
          {[
            { step: "01", title: "Create your profile", desc: "Tell us your target track, university, and experience level. We'll personalise everything." },
            { step: "02", title: "Discover & save roles", desc: "AI scans career pages and matches jobs to your profile. Save the best ones to your pipeline." },
            { step: "03", title: "Prep & apply", desc: "Generate cover letters, practice interviews, and manage your documents — all in one place." },
            { step: "04", title: "Track & close", desc: "Move roles through your Kanban board. Manage outreach, follow-ups, and negotiations." },
          ].map((s) => (
            <div key={s.step} className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-xl bg-gold-bg border border-secondary/20 flex items-center justify-center font-mono text-sm font-bold text-secondary flex-shrink-0">
                {s.step}
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-foreground mb-1">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-gradient-to-br from-secondary/10 via-background to-gold-bg border-t border-border">
        <div className="max-w-3xl mx-auto px-5 py-20 md:py-28 text-center">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-5">
            Ready to land your dream role?
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-lg mx-auto">
            Join ambitious candidates using Job Search OS to organise their search and stand out in competitive recruiting.
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="px-10 py-4 bg-primary text-primary-foreground rounded-xl text-base font-semibold shadow-lg hover:bg-navy-light transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            Get Started — It's Free
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-secondary to-gold-light flex items-center justify-center font-display font-bold text-navy text-xs">
              JS
            </div>
            <span className="font-display font-bold text-sm text-foreground">Job Search OS</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Job Search OS. Built for candidates, by candidates.
          </p>
        </div>
      </footer>
    </div>
  );
}
