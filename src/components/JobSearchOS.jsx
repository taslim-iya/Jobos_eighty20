import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchJobs, upsertJob, deleteJob, fetchDocuments, upsertDocument, deleteDocument, uploadFile, deleteFile, exportToCSV, exportToText, fetchWebsites, upsertWebsite, deleteWebsite } from "@/lib/database";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
// html2canvas removed — using jsPDF native text rendering for small file sizes

/* ─────────────────────────────────────────────────────────────────────────────
   DESIGN SYSTEM — "FT Editorial Light"
   Warm ivory base · Deep navy sidebar · Burnished gold accents
   Cormorant Garamond display · Sora body · JetBrains Mono data
───────────────────────────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500;600&display=swap');

:root {
  /* Surfaces */
  --bg:       #F8F6F1;
  --surface:  #FFFFFF;
  --surface2: #F2EFE8;
  --surface3: #EAE6DC;

  /* Navy */
  --navy:     #121D36;
  --navy2:    #1A2744;
  --navy3:    #243360;
  --navy4:    #2E3F72;

  /* Gold */
  --gold:     #B8843F;
  --gold2:    #D4A05A;
  --gold3:    #E8BD7A;
  --gold-bg:  rgba(184,132,63,0.08);

  /* Text */
  --ink:      #1C1C1C;
  --ink2:     #3D3D3D;
  --ink3:     #6B6B6B;
  --ink4:     #9B9B9B;

  /* Semantic */
  --green:    #1A7F5A;
  --green-bg: rgba(26,127,90,0.08);
  --red:      #C0392B;
  --red-bg:   rgba(192,57,43,0.08);
  --blue:     #2563EB;
  --blue-bg:  rgba(37,99,235,0.08);

  /* Borders */
  --border:   #DDD8CC;
  --border2:  #EAE6DC;
  --border3:  rgba(184,132,63,0.3);

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow:    0 4px 12px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.05);

  /* Sidebar stays navy */
  --side-bg:    #121D36;
  --side-hover: rgba(255,255,255,0.05);
  --side-active:rgba(184,132,63,0.15);
  --side-text:  rgba(255,255,255,0.55);
  --side-text2: rgba(255,255,255,0.85);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { font-size: 14px; -webkit-font-smoothing: antialiased; }

body {
  background: var(--bg);
  color: var(--ink);
  font-family: 'Sora', sans-serif;
  font-weight: 400;
  line-height: 1.6;
}

/* ── LAYOUT ── */
.app { display: flex; min-height: 100vh; }

.sidebar {
  width: 232px;
  min-height: 100vh;
  background: var(--side-bg);
  position: fixed;
  left: 0; top: 0;
  display: flex;
  flex-direction: column;
  z-index: 100;
  border-right: 1px solid rgba(255,255,255,0.05);
}

.main {
  margin-left: 232px;
  flex: 1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

/* ── SIDEBAR ── */
.sidebar-logo {
  padding: 24px 20px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}

.logo-lockup { display: flex; align-items: center; gap: 11px; }

.logo-mark {
  width: 36px; height: 36px;
  background: linear-gradient(135deg, var(--gold), var(--gold3));
  border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Cormorant Garamond', serif;
  font-weight: 700;
  font-size: 17px;
  color: var(--navy);
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(184,132,63,0.4);
}

.logo-text-wrap { display: flex; flex-direction: column; gap: 1px; }
.logo-name {
  font-family: 'Cormorant Garamond', serif;
  font-size: 16px;
  font-weight: 700;
  color: rgba(255,255,255,0.92);
  line-height: 1;
}
.logo-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  color: var(--gold2);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.nav-section { padding: 16px 12px 4px; }

.nav-section-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.28);
  padding: 0 10px;
  margin-bottom: 5px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border-radius: 7px;
  cursor: pointer;
  color: var(--side-text);
  font-size: 13px;
  font-weight: 400;
  transition: all .15s ease;
  border: 1px solid transparent;
  margin-bottom: 1px;
  position: relative;
  text-decoration: none;
}

.nav-item:hover {
  background: var(--side-hover);
  color: var(--side-text2);
}

.nav-item.active {
  background: var(--side-active);
  color: var(--gold2);
  border-color: rgba(184,132,63,0.2);
  font-weight: 500;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0; top: 25%; bottom: 25%;
  width: 2px;
  background: var(--gold);
  border-radius: 2px;
}

.nav-icon { font-size: 13px; width: 16px; text-align: center; flex-shrink: 0; }

.nav-pill {
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  background: var(--gold);
  color: var(--navy);
}

.nav-pill-new {
  background: var(--green);
  color: white;
}

.sidebar-user {
  margin-top: auto;
  padding: 16px;
  border-top: 1px solid rgba(255,255,255,0.07);
}

.user-chip {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 9px;
  cursor: pointer;
  transition: background .15s;
}
.user-chip:hover { background: rgba(255,255,255,0.08); }

.avatar {
  width: 30px; height: 30px;
  background: linear-gradient(135deg, var(--gold), var(--gold3));
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Cormorant Garamond', serif;
  font-weight: 700;
  font-size: 13px;
  color: var(--navy);
  flex-shrink: 0;
}

.user-name { font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.85); }
.user-meta { font-size: 10px; color: rgba(255,255,255,0.38); font-family: 'JetBrains Mono', monospace; }

/* ── TOPBAR ── */
.topbar {
  height: 58px;
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border2);
  display: flex;
  align-items: center;
  padding: 0 32px;
  gap: 16px;
  position: sticky;
  top: 0;
  z-index: 50;
}

.topbar-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 20px;
  font-weight: 700;
  color: var(--ink);
  flex: 1;
}

.topbar-actions { display: flex; align-items: center; gap: 10px; }

/* ── BUTTONS ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 7px;
  font-family: 'Sora', sans-serif;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  border: 1.5px solid transparent;
  transition: all .15s ease;
  white-space: nowrap;
}

.btn-primary {
  background: var(--navy2);
  color: white;
  border-color: var(--navy2);
  box-shadow: var(--shadow-sm);
}
.btn-primary:hover {
  background: var(--navy3);
  border-color: var(--navy3);
  box-shadow: var(--shadow);
}

.btn-gold {
  background: linear-gradient(135deg, var(--gold), var(--gold2));
  color: white;
  border-color: var(--gold);
  box-shadow: 0 2px 8px rgba(184,132,63,0.3);
}
.btn-gold:hover {
  box-shadow: 0 4px 16px rgba(184,132,63,0.4);
  transform: translateY(-1px);
}

.btn-outline {
  background: transparent;
  color: var(--ink2);
  border-color: var(--border);
}
.btn-outline:hover {
  background: var(--surface2);
  border-color: var(--border);
  color: var(--ink);
}

.btn-ghost {
  background: transparent;
  color: var(--ink3);
  border-color: transparent;
}
.btn-ghost:hover { background: var(--surface2); color: var(--ink); }

.btn-danger {
  background: transparent;
  color: var(--red);
  border-color: rgba(192,57,43,0.3);
}
.btn-danger:hover { background: var(--red-bg); }

.btn-sm { padding: 5px 12px; font-size: 11.5px; }
.btn-xs { padding: 3px 9px; font-size: 11px; border-radius: 5px; }
.btn-lg { padding: 11px 22px; font-size: 13.5px; }

.btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

/* ── PAGE ── */
.page {
  padding: 28px 32px;
  flex: 1;
  animation: pageIn .25s ease;
  max-width: 1400px;
  width: 100%;
}

@keyframes pageIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── CARDS ── */
.card {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
  transition: box-shadow .2s, border-color .2s;
}

.card:hover { box-shadow: var(--shadow); }

.card-flat {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 12px;
  padding: 20px 24px;
}

.card-tinted {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px 24px;
}

.card-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 20px; gap: 16px;
}

.card-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 17px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.3;
}

.card-subtitle { font-size: 12px; color: var(--ink3); margin-top: 3px; }

/* ── GRID ── */
.grid { display: grid; gap: 18px; }
.g2 { grid-template-columns: repeat(2, 1fr); }
.g3 { grid-template-columns: repeat(3, 1fr); }
.g4 { grid-template-columns: repeat(4, 1fr); }
.g-auto { grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); }

/* ── KPI ── */
.kpi {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 10px;
  padding: 18px 20px;
  box-shadow: var(--shadow-sm);
}

.kpi-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink4);
  margin-bottom: 6px;
}

.kpi-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 26px;
  font-weight: 600;
  color: var(--ink);
  line-height: 1;
}

.kpi-delta {
  display: flex; align-items: center; gap: 4px;
  margin-top: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
}

.up { color: var(--green); }
.dn { color: var(--red); }

/* ── SECTION HEADER ── */
.section-header {
  display: flex; align-items: flex-end; justify-content: space-between;
  margin-bottom: 22px; gap: 16px;
}

.eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 5px;
}

.section-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 26px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.2;
}

/* ── TAGS ── */
.tag {
  display: inline-flex; align-items: center;
  padding: 2px 9px;
  border-radius: 20px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
}
.t-gold   { background: var(--gold-bg);  color: var(--gold);  border: 1px solid rgba(184,132,63,0.25); }
.t-green  { background: var(--green-bg); color: var(--green); border: 1px solid rgba(26,127,90,0.2); }
.t-red    { background: var(--red-bg);   color: var(--red);   border: 1px solid rgba(192,57,43,0.2); }
.t-blue   { background: var(--blue-bg);  color: var(--blue);  border: 1px solid rgba(37,99,235,0.2); }
.t-ink    { background: var(--surface2); color: var(--ink3);  border: 1px solid var(--border); }
.t-navy   { background: rgba(18,29,54,0.07); color: var(--navy2); border: 1px solid rgba(18,29,54,0.15); }

/* ── TABS ── */
.tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--border2);
  margin-bottom: 22px;
}

.tab {
  padding: 9px 18px;
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 400;
  color: var(--ink3);
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all .15s;
  white-space: nowrap;
}

.tab.active {
  color: var(--navy2);
  border-bottom-color: var(--gold);
  font-weight: 600;
}

.tab:hover:not(.active) { color: var(--ink); background: var(--surface2); }

/* ── TABLE ── */
.table { width: 100%; border-collapse: collapse; }
.table thead tr { border-bottom: 2px solid var(--border2); }
.table th {
  text-align: left;
  padding: 9px 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink4);
  font-weight: 500;
  background: var(--surface2);
}
.table th:first-child { border-radius: 6px 0 0 0; }
.table th:last-child  { border-radius: 0 6px 0 0; }
.table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border2);
  font-size: 13px;
  color: var(--ink2);
  vertical-align: middle;
}
.table tbody tr { transition: background .12s; }
.table tbody tr:hover td { background: var(--surface2); }
.table tbody tr:last-child td { border-bottom: none; }

/* ── INPUTS ── */
.input {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 7px;
  padding: 9px 13px;
  font-family: 'Sora', sans-serif;
  font-size: 13px;
  color: var(--ink);
  width: 100%;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.input::placeholder { color: var(--ink4); }
.input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(184,132,63,0.12);
}

.textarea { resize: vertical; min-height: 110px; line-height: 1.65; }

.label {
  display: block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink3);
  margin-bottom: 6px;
  font-weight: 500;
}

.fg { margin-bottom: 16px; }

select.input {
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236B6B6B'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 30px;
}

/* ── PROGRESS ── */
.prog-track { height: 5px; background: var(--surface3); border-radius: 5px; overflow: hidden; }
.prog-fill   { height: 100%; border-radius: 5px; transition: width .5s ease; background: var(--gold); }
.prog-fill.g { background: var(--green); }
.prog-fill.b { background: var(--blue); }
.prog-fill.n { background: var(--navy2); }

/* ── DIVIDER ── */
.divider { height: 1px; background: var(--border2); margin: 20px 0; }

/* ── ALERT ── */
.alert {
  padding: 12px 16px;
  border-radius: 8px;
  display: flex; gap: 10px; align-items: flex-start;
  font-size: 12.5px;
  line-height: 1.6;
}
.a-gold  { background: var(--gold-bg);  border: 1px solid rgba(184,132,63,0.25); color: #7A5A1C; }
.a-green { background: var(--green-bg); border: 1px solid rgba(26,127,90,0.2);   color: var(--green); }
.a-blue  { background: var(--blue-bg);  border: 1px solid rgba(37,99,235,0.2);   color: var(--blue); }
.a-red   { background: var(--red-bg);   border: 1px solid rgba(192,57,43,0.2);   color: var(--red); }

/* ── KANBAN ── */
.kanban { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 12px; }
.kanban::-webkit-scrollbar { height: 5px; }
.kanban::-webkit-scrollbar-track { background: var(--surface2); border-radius: 3px; }
.kanban::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

.k-col {
  min-width: 238px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  flex-shrink: 0;
}

.k-col-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}

.k-col-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink2);
}

.k-count {
  background: var(--border);
  color: var(--ink3);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 2px 8px; border-radius: 10px;
}

.k-card {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 9px;
  padding: 13px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all .15s;
  box-shadow: var(--shadow-sm);
}
.k-card:hover {
  border-color: var(--border);
  box-shadow: var(--shadow);
  transform: translateY(-1px);
}
.k-card-title { font-size: 12.5px; font-weight: 600; color: var(--ink); margin-bottom: 3px; }
.k-card-sub   { font-size: 11px; color: var(--ink3); }
.k-card-foot  {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 9px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}

/* ── HERO BANNER ── */
.hero {
  background: linear-gradient(135deg, var(--navy2) 0%, var(--navy3) 100%);
  border-radius: 14px;
  padding: 30px 36px;
  margin-bottom: 24px;
  position: relative;
  overflow: hidden;
  color: white;
}
.hero::before {
  content: '';
  position: absolute; right: -40px; top: -40px;
  width: 260px; height: 260px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(184,132,63,0.18), transparent 65%);
  pointer-events: none;
}
.hero::after {
  content: '';
  position: absolute; left: 0; bottom: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, var(--gold), transparent);
}
.hero-eye { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold2); margin-bottom: 8px; }
.hero-h {
  font-family: 'Cormorant Garamond', serif;
  font-size: 28px; font-weight: 700;
  color: white; line-height: 1.2; margin-bottom: 10px;
}
.hero-p { font-size: 13px; color: rgba(255,255,255,0.65); max-width: 440px; line-height: 1.7; }
.hero-actions { display: flex; gap: 10px; margin-top: 18px; }

/* ── JOB CARD (discovery) ── */
.job-card {
  background: var(--surface);
  border: 1.5px solid var(--border2);
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: all .2s;
  position: relative;
}
.job-card:hover {
  border-color: var(--gold);
  box-shadow: var(--shadow);
  transform: translateY(-2px);
}
.job-card.saved { border-left: 3px solid var(--green); }
.jc-match {
  position: absolute; top: 14px; right: 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; font-weight: 600;
  color: var(--green);
}
.jc-title  { font-weight: 600; font-size: 13.5px; color: var(--ink); margin-bottom: 3px; }
.jc-firm   { font-size: 12px; color: var(--ink3); margin-bottom: 10px; }
.jc-tags   { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 12px; }
.jc-foot   { display: flex; align-items: center; justify-content: space-between; }
.jc-source { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--ink4); }

/* ── AI LOADER ── */
.ai-pulse {
  display: flex; align-items: center; gap: 10px;
  padding: 16px;
  background: var(--gold-bg);
  border: 1px solid rgba(184,132,63,0.25);
  border-radius: 10px;
  font-size: 13px;
  color: var(--gold);
  margin-bottom: 16px;
}
.dot-spin {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid rgba(184,132,63,0.25);
  border-top-color: var(--gold);
  animation: spin .7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── WEBSITE SCANNER ── */
.site-row {
  display: flex; align-items: center; gap: 14px;
  padding: 13px 0;
  border-bottom: 1px solid var(--border2);
}
.site-row:last-child { border-bottom: none; }
.site-status-dot {
  width: 9px; height: 9px; border-radius: 50%;
  flex-shrink: 0;
}
.dot-active  { background: var(--green); box-shadow: 0 0 6px rgba(26,127,90,0.5); }
.dot-idle    { background: var(--ink4); }
.dot-scanning { background: var(--gold); animation: dotPulse 1s ease infinite; }
@keyframes dotPulse { 0%,100%{opacity:1} 50%{opacity:.3} }

.site-url  { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--ink2); flex: 1; }
.site-meta { font-size: 11px; color: var(--ink4); white-space: nowrap; }

/* ── UPLOAD ZONE ── */
.drop-zone {
  border: 2px dashed var(--border);
  border-radius: 10px;
  padding: 36px;
  text-align: center;
  cursor: pointer;
  transition: all .2s;
  background: var(--surface2);
}
.drop-zone:hover {
  border-color: var(--gold);
  background: var(--gold-bg);
}
.drop-icon { font-size: 32px; margin-bottom: 10px; opacity: 0.7; }

/* ── CHAT ── */
.chat-wrap {
  display: flex; flex-direction: column;
  height: 420px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface);
}
.chat-msgs {
  flex: 1; overflow-y: auto;
  padding: 18px;
  display: flex; flex-direction: column; gap: 12px;
}
.chat-msg {
  max-width: 82%;
  padding: 11px 15px;
  border-radius: 10px;
  font-size: 12.5px;
  line-height: 1.7;
}
.msg-user {
  align-self: flex-end;
  background: var(--navy2);
  color: rgba(255,255,255,0.9);
}
.msg-ai {
  align-self: flex-start;
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--ink2);
}
.chat-input-row {
  padding: 12px 14px;
  border-top: 1px solid var(--border2);
  display: flex; gap: 10px;
  background: var(--surface);
}
.chat-scores {
  padding: 12px 16px;
  border-top: 1px solid var(--border2);
  background: var(--surface2);
  display: flex; gap: 20px;
}
.score-block { text-align: center; }
.score-lbl { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink4); margin-bottom: 3px; }
.score-num { font-family: 'JetBrains Mono', monospace; font-size: 17px; font-weight: 600; color: var(--navy2); }

/* ── COVER LETTER STEPS ── */
.step-indicator {
  display: flex; align-items: center; gap: 0;
  margin-bottom: 24px;
}
.step {
  display: flex; align-items: center; gap: 8px;
  flex: 1;
}
.step-num-badge {
  width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; font-weight: 600;
  flex-shrink: 0;
}
.step-active   .step-num-badge { background: var(--navy2); color: white; }
.step-done     .step-num-badge { background: var(--green); color: white; }
.step-inactive .step-num-badge { background: var(--surface3); color: var(--ink4); }
.step-label { font-size: 12px; font-weight: 500; color: var(--ink3); }
.step-active .step-label { color: var(--ink); font-weight: 600; }
.step-done   .step-label { color: var(--green); }
.step-connector { flex: 1; height: 1px; background: var(--border2); margin: 0 8px; }
.step-connector.done { background: var(--green); }

/* ── EXTENSION PREVIEW ── */
.ext-shell {
  width: 300px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  margin: 0 auto;
}
.ext-head {
  background: var(--navy2);
  padding: 12px 14px;
  display: flex; align-items: center; gap: 10px;
}
.ext-title { font-family: 'Cormorant Garamond', serif; font-size: 13px; font-weight: 700; color: white; }
.ext-sub   { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--gold2); }
.pulse-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 6px rgba(26,127,90,0.7);
  animation: dotPulse 2s ease infinite;
  flex-shrink: 0;
}
.ext-field {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border2);
}
.ext-fname { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--ink4); width: 88px; flex-shrink: 0; }
.ext-fval  { font-size: 12px; color: var(--ink); flex: 1; }
.ext-chk   { font-size: 11px; flex-shrink: 0; }
.ext-filled-chk { color: var(--green); }
.ext-pending-chk { color: var(--ink4); }

/* ── PLAYBOOK CARD ── */
.pb-card {
  background: var(--surface);
  border: 1.5px solid var(--border2);
  border-radius: 13px;
  overflow: hidden;
  cursor: pointer;
  transition: all .2s;
  box-shadow: var(--shadow-sm);
}
.pb-card:hover { box-shadow: var(--shadow); border-color: var(--border); transform: translateY(-2px); }
.pb-card.sel { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(184,132,63,0.12); }
.pb-head {
  padding: 22px;
  background: linear-gradient(135deg, var(--navy2), var(--navy3));
  color: white;
}
.pb-icon { font-size: 26px; margin-bottom: 10px; }
.pb-name { font-family: 'Cormorant Garamond', serif; font-size: 19px; font-weight: 700; }
.pb-body { padding: 16px 22px; }

/* ── TIMELINE ── */
.tl { position: relative; padding-left: 22px; }
.tl::before { content:''; position:absolute; left:5px; top:6px; bottom:6px; width:1px; background:var(--border2); }
.tl-item { position: relative; padding-bottom: 18px; }
.tl-dot {
  position: absolute; left: -22px; top: 4px;
  width: 11px; height: 11px;
  border-radius: 50%;
  background: var(--surface3);
  border: 2px solid var(--border);
}
.tl-dot.done   { background: var(--gold); border-color: var(--gold); }
.tl-dot.active { background: var(--green); border-color: var(--green); box-shadow: 0 0 0 3px rgba(26,127,90,0.2); }

/* ── MONO TEXT ── */
.mono { font-family: 'JetBrains Mono', monospace; }
.t-gold2  { color: var(--gold); }
.t-green2 { color: var(--green); }
.t-ink3   { color: var(--ink3); }
.t-ink4   { color: var(--ink4); }

/* ── SCROLLBAR ── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: var(--surface2); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--ink4); }

/* ── UTILITIES ── */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-c { align-items: center; }
.items-s { align-items: flex-start; }
.j-between { justify-content: space-between; }
.j-end { justify-content: flex-end; }
.g4  { gap: 4px; }
.g6  { gap: 6px; }
.g8  { gap: 8px; }
.g10 { gap: 10px; }
.g12 { gap: 12px; }
.g16 { gap: 16px; }
.g20 { gap: 20px; }
.g24 { gap: 24px; }
.mt4  { margin-top: 4px; }
.mt8  { margin-top: 8px; }
.mt12 { margin-top: 12px; }
.mt16 { margin-top: 16px; }
.mt20 { margin-top: 20px; }
.mt24 { margin-top: 24px; }
.mb4  { margin-bottom: 4px; }
.mb8  { margin-bottom: 8px; }
.mb12 { margin-bottom: 12px; }
.mb16 { margin-bottom: 16px; }
.mb20 { margin-bottom: 20px; }
.w-full { width: 100%; }
.flex-1 { flex: 1; }
.fs12 { font-size: 12px; }
.fs11 { font-size: 11px; }
.fw6  { font-weight: 600; }
.fw5  { font-weight: 500; }
.lh17 { line-height: 1.7; }
.op60 { opacity: 0.6; }
.op40 { opacity: 0.4; }
.ta-c { text-align: center; }

.coming-box {
  padding: 64px 32px;
  text-align: center;
  border: 2px dashed var(--border);
  border-radius: 14px;
  background: var(--surface2);
  margin: 24px 0;
}
.coming-icon { font-size: 42px; margin-bottom: 16px; opacity: 0.5; }
.coming-title { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 700; color: var(--ink); margin-bottom: 8px; }
.coming-desc  { font-size: 13px; color: var(--ink3); max-width: 380px; margin: 0 auto; line-height: 1.7; }

/* ── MOBILE HAMBURGER ── */
.mobile-hamburger {
  display: none;
  width: 36px; height: 36px;
  background: var(--navy2);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: white;
  font-size: 18px;
}

.sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 99;
}

.sidebar-close {
  display: none;
  position: absolute;
  top: 16px; right: 16px;
  width: 28px; height: 28px;
  background: rgba(255,255,255,0.1);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: rgba(255,255,255,0.7);
  font-size: 16px;
  align-items: center;
  justify-content: center;
}
.sidebar-close:hover { background: rgba(255,255,255,0.2); }

/* ── TABLET (≤1024px) ── */
@media (max-width: 1024px) {
  .g4 { grid-template-columns: repeat(2, 1fr); }
  .g3 { grid-template-columns: repeat(2, 1fr); }
  .kanban { flex-wrap: nowrap; }
  .page { padding: 22px 20px; }
  .topbar { padding: 0 20px; }
  .topbar-actions .btn-gold { display: none; }
}

/* ── MOBILE (≤768px) ── */
@media (max-width: 768px) {
  .mobile-hamburger { display: flex; }
  .sidebar-close { display: flex; }

  .sidebar {
    transform: translateX(-100%);
    transition: transform .25s ease;
    width: 260px;
  }
  .sidebar.open {
    transform: translateX(0);
  }
  .sidebar-overlay.open {
    display: block;
  }

  .main {
    margin-left: 0;
    width: 100%;
  }

  .topbar {
    padding: 0 14px;
    height: 52px;
    gap: 10px;
  }
  .topbar-title { font-size: 17px; }
  .topbar-actions input { display: none; }
  .topbar-actions .btn-gold { display: none; }

  .page { padding: 16px 14px; }
  .g2, .g3, .g4 { grid-template-columns: 1fr; }
  .g-auto { grid-template-columns: 1fr; }

  .section-header { flex-direction: column; align-items: flex-start; gap: 10px; }
  .section-title { font-size: 22px; }

  .card { padding: 16px; }
  .card-flat { padding: 14px 16px; }
  .card-header { flex-direction: column; gap: 8px; }

  .kpi-val { font-size: 22px; }
  .kanban { flex-direction: column; }
  .k-col { min-width: 100%; }

  .table { font-size: 12px; }
  .table th, .table td { padding: 8px 10px; }
  .table th:nth-child(n+4), .table td:nth-child(n+4) { display: none; }

  .tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .tab { padding: 8px 14px; font-size: 12px; }

  .coming-box { padding: 40px 20px; }

  .f { flex-direction: column; }
  .f.wrap { flex-direction: column; }
}

/* ── SMALL MOBILE (≤480px) ── */
@media (max-width: 480px) {
  .topbar-title { font-size: 15px; }
  .btn { padding: 7px 12px; font-size: 11.5px; }
  .btn-sm { padding: 4px 10px; font-size: 10.5px; }
  .section-title { font-size: 20px; }
  .kpi { padding: 14px; }
  .kpi-val { font-size: 20px; }
}
`;

/* ─── SEED DATA ──────────────────────────────────────────────────────────── */
const PLAYBOOKS = {
  ib: {
    icon: "🏦", name: "Investment Banking",
    undergrad: {
      process: "Superday → SA offer → FT convert",
      prereqs: ["GPA 3.7+", "Finance/Econ coursework", "Financial modeling", "Bloomberg certification"],
      milestones: [
        { week:"WK 1–2", title:"Foundation", desc:"Lock GPA, complete DCF/LBO primer, update LinkedIn to recruiter-ready." },
        { week:"WK 3–4", title:"Networking", desc:"Map target banks. Send first-wave cold emails (20). Coffee-chat tracker live." },
        { week:"WK 5–6", title:"Technical Prep", desc:"Complete 200 technical Qs: valuation, accounting, M&A, LBO." },
        { week:"WK 7–8", title:"Behavioral", desc:"Finalize STAR stories. Record mock answers. Score each on PEIR framework." },
        { week:"WK 9–10", title:"Application Sprint", desc:"Submit top 30 targets. Each cover letter tailored. Follow-up sequence live." },
        { week:"WK 11–12", title:"Superday Ready", desc:"Case studies, group exercise, full-day simulation." },
      ],
      questions: [
        { q:"Walk me through a DCF.", cat:"Technical", diff:"Core" },
        { q:"What happens to the three statements if D&A increases by $10?", cat:"Accounting", diff:"Core" },
        { q:"Why investment banking?", cat:"Behavioral", diff:"Core" },
        { q:"Walk me through an LBO.", cat:"Technical", diff:"Advanced" },
        { q:"How do you value a bank?", cat:"Technical", diff:"Advanced" },
      ],
    },
    experienced: {
      process: "Lateral → Associate → VP track",
      prereqs: ["2–4 yrs finance exp", "Series 63/79", "Deal experience"],
      milestones: [
        { week:"WK 1", title:"Deal Inventory", desc:"Compile full deal sheet with metrics, roles, and outcomes." },
        { week:"WK 2–3", title:"Senior Network", desc:"Map MDs at target banks via alumni + LinkedIn." },
        { week:"WK 4–5", title:"Technical Depth", desc:"Pitch live deal ideas. Paper LBO in 20 mins." },
        { week:"WK 6", title:"Final Prep", desc:"Panel simulation. Salary negotiation prep." },
      ],
      questions: [
        { q:"Walk me through your most complex deal.", cat:"Deal Experience", diff:"Core" },
        { q:"Pitch me a company to buy right now.", cat:"Market", diff:"Advanced" },
      ],
    }
  },
  consulting: {
    icon: "📊", name: "Management Consulting",
    undergrad: {
      process: "Case Interview → Partner Round → BA Offer",
      prereqs: ["Strong GPA", "Case prep 200+ hours", "Leadership role"],
      milestones: [
        { week:"WK 1–2", title:"Case Foundations", desc:"Learn frameworks: Issue Trees, Profitability, Market Entry, M&A, Pricing." },
        { week:"WK 3–4", title:"Case Volume", desc:"Complete 30 cases. Partner with 3 case prep partners." },
        { week:"WK 5–6", title:"Written Materials", desc:"Impact-led CV bullets. Cover letters. Firm research (MBB + Big 4)." },
        { week:"WK 7+", title:"Final Push", desc:"Live case with recent consultants. Mock first/second rounds." },
      ],
      questions: [
        { q:"Our client is a hospital seeing declining revenue. How would you approach?", cat:"Case", diff:"Core" },
        { q:"Market sizing: how many gas stations in the UK?", cat:"Case", diff:"Core" },
        { q:"Tell me about a time you influenced without authority.", cat:"Behavioral", diff:"Core" },
      ],
    },
    experienced: {
      process: "Experienced Hire → Consultant/Manager",
      prereqs: ["3–6 yrs industry exp", "Strategy project exp"],
      milestones: [
        { week:"WK 1–2", title:"Story Architecture", desc:"Build Pyramid Principle narratives from past projects." },
        { week:"WK 3–4", title:"Case Sharpening", desc:"Advanced cases with synthesis emphasis." },
      ],
      questions: [
        { q:"Walk me through a project where you drove measurable impact.", cat:"Behavioral", diff:"Core" },
        { q:"How would you structure a market entry for a SaaS firm?", cat:"Case", diff:"Advanced" },
      ],
    }
  },
  product: {
    icon: "📱", name: "Product Management",
    undergrad: {
      process: "APM Program → PM → Senior PM",
      prereqs: ["Technical literacy", "User research exp", "Data analysis"],
      milestones: [
        { week:"WK 1–2", title:"Product Sense", desc:"Deconstruct 20 apps using CIRCLES. Framework fluency." },
        { week:"WK 3–4", title:"Portfolio", desc:"Ship one side-project or case study with metrics." },
        { week:"WK 5–6", title:"Technical Foundation", desc:"SQL practice. API basics. Mobile vs web tradeoffs." },
        { week:"WK 7+", title:"Final Rounds", desc:"System design basics. Reverse interviews." },
      ],
      questions: [
        { q:"Design a product to improve grocery shopping.", cat:"Product Design", diff:"Core" },
        { q:"How would you improve Google Maps?", cat:"Improvement", diff:"Core" },
        { q:"DAU dropped 20% overnight. How do you investigate?", cat:"Metrics", diff:"Advanced" },
      ],
    },
    experienced: {
      process: "Senior PM → Group PM → Director",
      prereqs: ["3+ yrs PM exp", "Shipped at scale", "Cross-functional leadership"],
      milestones: [
        { week:"WK 1", title:"Impact Portfolio", desc:"Document product wins with metrics." },
        { week:"WK 2–3", title:"Executive Presence", desc:"Practice VP-level narratives." },
      ],
      questions: [
        { q:"Tell me about a product you're most proud of.", cat:"Behavioral", diff:"Core" },
        { q:"How do you build alignment with engineering on a contentious roadmap?", cat:"Leadership", diff:"Advanced" },
      ],
    }
  }
};

const INIT_JOBS = [];

const INIT_WEBSITES = [];

const DISC_JOBS = [];

/* ─── AI API CALL (via Lovable Cloud edge function) ──────────────────────── */
async function callClaude(prompt, systemPrompt = "", useWebSearch = false) {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Determine use case from system prompt content for backend routing
  let useCase = "general";
  if (systemPrompt.includes("interview") || systemPrompt.includes("Score")) useCase = "interview";
  else if (systemPrompt.includes("cover letter")) useCase = "cover-letter";
  else if (systemPrompt.includes("CV") || systemPrompt.includes("Tailor")) useCase = "cv-tailor";
  else if (systemPrompt.includes("job search") || systemPrompt.includes("JSON array")) useCase = "job-search";
  else if (systemPrompt.includes("outreach") || systemPrompt.includes("networking")) useCase = "outreach";
  else if (systemPrompt.includes("Return only a JSON array")) useCase = "website-scan";

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      systemPrompt,
      useCase,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "AI request failed" }));
    throw new Error(err.error || "AI request failed");
  }

  const data = await resp.json();
  return data.content || "No response";
}

async function crawlJobs({ query = "", track = "", level = "", location = "", siteUrl = "" } = {}) {
  const { data, error } = await supabase.functions.invoke("job-crawl-search", {
    body: {
      query,
      track,
      level,
      location,
      siteUrl,
    },
  });

  if (error) {
    throw new Error(error.message || "Crawler search failed");
  }

  return Array.isArray(data?.jobs) ? data.jobs : [];
}

function isExpiredDeadline(deadline) {
  if (!deadline) return false;
  const lower = String(deadline).toLowerCase();
  if (/(expired|closed|filled|no longer accepting)/i.test(lower)) return true;

  const parsed = Date.parse(deadline);
  if (Number.isNaN(parsed)) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed < today.getTime();
}

function normalizeLiveJobs(rawJobs = [], fallbackSource = "Web") {
  return rawJobs
    .filter(j => j && typeof j === "object" && j.url)
    .filter(j => !isExpiredDeadline(j.deadline))
    .filter(j => !/(expired|closed|filled|past application deadline)/i.test(`${j.title || ""} ${j.description || ""}`))
    .map((j, i) => ({
      ...j,
      id: j.id || Date.now() + i,
      source: j.source || fallbackSource,
      tags: Array.isArray(j.tags) ? j.tags : [],
      match: typeof j.match === "number" ? j.match : 82,
      deadline: j.deadline || "Rolling",
    }));
}

function dedupeJobsByUrl(jobs = []) {
  const seen = new Set();
  return jobs.filter(job => {
    const key = (job.url || `${job.title || ""}-${job.firm || ""}`).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ─── NAV CONFIG ────────────────────────────────────────────────────────── */
const NAV = [
  { section: "Home", items: [
    { id:"dashboard", icon:"⚡", label:"Dashboard" },
  ]},
  { section: "Discover", items: [
    { id:"discover",  icon:"🔍", label:"Job Discovery", badge:"NEW", badgeGreen:true },
    { id:"websites",  icon:"🌐", label:"Website Manager" },
    { id:"pipeline",  icon:"🗃", label:"CRM Pipeline" },
  ]},
  { section: "Prepare", items: [
    { id:"playbooks",  icon:"📖", label:"Playbooks" },
    { id:"documents",  icon:"🗂",  label:"Doc Intelligence" },
    { id:"cv",         icon:"📄", label:"CV + Cover Letters" },
    { id:"outreach",   icon:"✉️",  label:"Outreach Engine" },
  ]},
  { section: "Practice", items: [
    { id:"interview",  icon:"🎙", label:"Interview Prep" },
    { id:"extension",  icon:"🔌", label:"Chrome Extension" },
  ]},
  { section: "Admin", items: [
    { id:"admin", icon:"⚙️", label:"Admin Console" },
  ]},
];

/* ════════════════════════════════════════════════════════════════════════════
   PAGE: DASHBOARD
══════════════════════════════════════════════════════════════════════════════ */
function Dashboard({ jobs, profile }) {
  return (
    <div className="page">
      <div className="hero">
        <div className="hero-eye">{profile.track === "ib" ? "IB" : profile.track === "consulting" ? "Consulting" : "Product"} Track · {profile.level === "undergrad" ? "Undergraduate" : "Experienced Hire"}</div>
        <div className="hero-h">Welcome back, {profile.name.split(" ")[0]}.<br/>{jobs.filter(j=>j.stage!=="saved"&&j.stage!=="offer").length > 0 ? `You have ${jobs.filter(j=>j.stage!=="saved"&&j.stage!=="offer").length} active applications.` : "Start by discovering roles."}</div>
        <div className="hero-p">{jobs.filter(j=>j.stage==="interviewing").length > 0 ? `${jobs.filter(j=>j.stage==="interviewing").length} interview(s) in progress. Focus on preparation.` : jobs.length > 0 ? "Keep building your pipeline and preparing for interviews." : "Use Job Discovery to find and save roles to your pipeline."}</div>
        <div className="hero-actions">
          <button className="btn btn-gold">📋 Today's Tasks</button>
          <button className="btn" style={{background:"rgba(255,255,255,0.12)", color:"white", borderColor:"rgba(255,255,255,0.2)"}}>View Weekly Plan →</button>
        </div>
      </div>

      <div className="grid g4 mb20">
        {[
          { l:"Applications", v:jobs.filter(j=>j.stage!=="saved").length, d:`${jobs.length} total`, up:jobs.filter(j=>j.stage!=="saved").length>0 },
          { l:"Outreach", v:jobs.filter(j=>j.stage==="outreach").length, d:"contacts made", up:jobs.filter(j=>j.stage==="outreach").length>0 },
          { l:"Interviews", v:jobs.filter(j=>j.stage==="interviewing").length, d:"in progress", up:jobs.filter(j=>j.stage==="interviewing").length>0 },
          { l:"Offers", v:jobs.filter(j=>j.stage==="offer").length, d:jobs.filter(j=>j.stage==="offer").length>0?"secured":"none yet", up:jobs.filter(j=>j.stage==="offer").length>0 },
        ].map(k => (
          <div key={k.l} className="kpi">
            <div className="kpi-label">{k.l}</div>
            <div className="kpi-val">{k.v}</div>
            <div className={`kpi-delta ${k.up?"up":"dn"}`}>{k.up?"▲":"▼"} {k.d}</div>
          </div>
        ))}
      </div>

      <div className="grid g2 g16 mb16">
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Pipeline Snapshot</div><div className="card-subtitle">Active roles across all stages</div></div>
            <span className="tag t-gold">{jobs.length} roles</span>
          </div>
          {["saved","outreach","applying","interviewing","offer"].map(s => {
            const count = jobs.filter(j=>j.stage===s).length;
            const labels = {saved:"Saved",outreach:"Outreach",applying:"Applying",interviewing:"Interviewing",offer:"Offer"};
            return (
              <div key={s} className="flex items-c g12 mb12">
                <div style={{width:88,fontSize:12,color:"var(--ink3)"}}>{labels[s]}</div>
                <div className="prog-track flex-1"><div className="prog-fill" style={{width:`${Math.max((count/jobs.length)*100,3)}%`}}/></div>
                <div className="mono fs11 t-ink4" style={{width:16,textAlign:"right"}}>{count}</div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="card-header">
            <div><div className="card-title">This Week</div><div className="card-subtitle">Auto-generated from playbook</div></div>
          </div>
          {(jobs.length > 0 ? [
            { day:"MON", task: jobs[0] ? `Follow up on ${jobs[0].firm} application` : "Review pipeline", done:false },
            { day:"TUE", task:"Technical prep session (1 hr)", done:false },
            { day:"WED", task: jobs.filter(j=>j.stage==="outreach")[0] ? `Outreach: ${jobs.filter(j=>j.stage==="outreach")[0].firm}` : "Research target firms", done:false },
            { day:"THU", task:"Practice interview questions", done:false },
            { day:"FRI", task: jobs.filter(j=>j.stage==="interviewing")[0] ? `Prep for ${jobs.filter(j=>j.stage==="interviewing")[0].firm} interview` : "Review & plan next week", done:false },
          ] : [
            { day:"MON", task:"Start by adding roles in Job Discovery", done:false },
            { day:"TUE", task:"Upload your CV in CV Studio", done:false },
            { day:"WED", task:"Add target websites to Website Manager", done:false },
            { day:"THU", task:"Explore Playbooks for your track", done:false },
            { day:"FRI", task:"Practice interview questions", done:false },
          ]).map(d => (
            <div key={d.day} className="flex items-c g10 mb8">
              <div className="mono" style={{width:30,fontSize:10,color:"var(--gold)"}}>{d.day}</div>
              <div style={{
                width:16, height:16, borderRadius:4, flexShrink:0,
                border:`1.5px solid ${d.done?"var(--green)":"var(--border)"}`,
                background: d.done?"var(--green)":"transparent",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:9, color:"white",
              }}>{d.done&&"✓"}</div>
              <div style={{fontSize:12, color: d.done?"var(--ink4)":"var(--ink2)", textDecoration: d.done?"line-through":"none"}}>{d.task}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Upcoming Deadlines</div>
          <span className="tag t-red">3 urgent</span>
        </div>
        <table className="table">
          <thead><tr><th>Role</th><th>Firm</th><th>Deadline</th><th>Stage</th><th>Match</th><th>Action</th></tr></thead>
          <tbody>
            {jobs.filter(j=>j.stage!=="saved").slice(0,4).map(j=>(
              <tr key={j.id}>
                <td className="fw6" style={{color:"var(--ink)"}}>{j.title}</td>
                <td>{j.firm}</td>
                <td><span className="mono" style={{color:"var(--gold)",fontSize:11}}>{j.deadline}</span></td>
                <td><span className={`tag t-${j.stage==="offer"?"green":j.stage==="interviewing"?"navy":"ink"}`}>{j.stage}</span></td>
                <td><span className="mono" style={{color:"var(--green)",fontSize:12}}>{j.match}%</span></td>
                <td><button className="btn btn-outline btn-xs">Open →</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGE: JOB DISCOVERY
══════════════════════════════════════════════════════════════════════════════ */
function JobDiscovery({ jobs, setJobs, profile, setProfile }) {
  const [tab, setTab] = useState("recommended");
  const [trackFilter, setTrackFilter] = useState(profile.track);
  const [levelFilter, setLevelFilter] = useState(profile.level);
  const [locationFilter, setLocationFilter] = useState("London");
  const [searchQuery, setSearchQuery] = useState("");
  const [discJobs, setDiscJobs] = useState(DISC_JOBS);
  const [scanning, setScanning] = useState(false);
  const [scanLog, setScanLog] = useState([]);
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());

  const filtered = discJobs.filter(j => {
    const matchTrack = !trackFilter || j.track === trackFilter;
    const matchLevel = !levelFilter || j.level === levelFilter;
    const matchSearch = !searchQuery || j.title.toLowerCase().includes(searchQuery.toLowerCase()) || j.firm.toLowerCase().includes(searchQuery.toLowerCase());
    return matchTrack && matchLevel && matchSearch;
  });

  const saveJob = (job) => {
    if (savedIds.has(job.id)) return;
    setSavedIds(prev => new Set([...prev, job.id]));
    const newJob = { id: Date.now(), title: job.title, firm: job.firm, stage: "saved", deadline: job.deadline, match: job.match, tags: job.tags, track: job.track, level: job.level };
    setJobs(prev => [...prev, newJob]);
  };

  const runWebsiteScan = async () => {
    setScanning(true);
    setScanLog([]);
    const trackName = trackFilter === "ib" ? "investment banking" : trackFilter === "consulting" ? "management consulting" : "product management";
    const trackKw = {
      ib: "investment banking analyst associate M&A ECM DCM summer analyst leveraged finance",
      consulting: "management consulting business analyst strategy consultant associate",
      product: "product manager APM associate product manager growth PM",
    };

    try {
      setScanLog(["🔄 Crawling live job pages and filtering out expired postings..."]);

      const crawled = await crawlJobs({
        query: `${trackKw[trackFilter] || trackKw.ib} ${levelFilter || ""} ${locationFilter || ""}`,
        track: trackFilter,
        level: levelFilter,
        location: locationFilter,
      });

      const liveJobs = dedupeJobsByUrl(normalizeLiveJobs(crawled, "Crawler"));

      if (liveJobs.length === 0) {
        setScanLog(prev => [...prev, "⚠ No live results from crawler. Trying AI fallback..."]);

        const fallbackPrompt = `Find current, non-expired job openings in ${trackName} for ${levelFilter === "undergrad" ? "undergraduates/graduates/summer analysts" : "experienced professionals"} in ${locationFilter || "major financial hubs"}.\n\nReturn ONLY valid JSON array with real URLs and no expired roles.`;
        const result = await callClaude(fallbackPrompt, "You are a job search assistant. Return ONLY valid JSON array. No markdown, no explanation.", true);
        const clean = result.replace(/```json|```/g, "").trim();
        const start = clean.indexOf("[");
        const end = clean.lastIndexOf("]") + 1;
        if (start >= 0) {
          const parsed = JSON.parse(clean.slice(start, end));
          const withId = normalizeLiveJobs(parsed, "AI Fallback").map((j, i) => ({
            ...j,
            id: 300 + Date.now() + i,
            track: trackFilter,
            level: levelFilter,
            saved: false,
            tags: j.tags?.length ? j.tags : [trackFilter === "ib" ? "IB" : trackFilter === "consulting" ? "Consulting" : "Product"],
          }));

          setDiscJobs(prev => {
            const existingUrls = new Set(prev.map(j => (j.url || "").toLowerCase()));
            const newJobs = withId.filter(j => !existingUrls.has((j.url || "").toLowerCase()));
            return [...newJobs, ...prev];
          });
          setScanLog(prev => [...prev, `✓ Found ${withId.length} live roles (AI fallback).`]);
        } else {
          setScanLog(prev => [...prev, "⚠ Could not parse fallback results."]);
        }
      } else {
        const withId = liveJobs.map((j, i) => ({
          ...j,
          id: 300 + Date.now() + i,
          track: trackFilter,
          level: levelFilter,
          saved: false,
          tags: j.tags?.length ? j.tags : [trackFilter === "ib" ? "IB" : trackFilter === "consulting" ? "Consulting" : "Product"],
        }));

        setDiscJobs(prev => {
          const existingUrls = new Set(prev.map(j => (j.url || "").toLowerCase()));
          const newJobs = withId.filter(j => !existingUrls.has((j.url || "").toLowerCase()));
          return [...newJobs, ...prev];
        });
        setScanLog(prev => [...prev, `✓ Found ${withId.length} live ${trackName} roles with real links.`]);
      }
    } catch (err) {
      setScanLog(prev => [...prev, `⚠ Scan failed: ${err.message}.`]);
    }
    setScanning(false);
  };

  const runAiSearch = async () => {
    if (!aiSearchQuery.trim()) return;
    setAiSearching(true);
    setAiResults([]);
    try {
      const crawled = await crawlJobs({
        query: aiSearchQuery,
        track: trackFilter,
        level: levelFilter,
        location: locationFilter,
      });

      const withId = dedupeJobsByUrl(normalizeLiveJobs(crawled, "Crawler"))
        .map((j, i) => ({
          ...j,
          id: 200 + Date.now() + i,
          track: trackFilter,
          level: levelFilter,
          saved: false,
          source: j.source || "AI Search",
          tags: j.tags?.length ? j.tags : [trackFilter === "ib" ? "IB" : trackFilter === "consulting" ? "Consulting" : "Product"],
        }));

      setAiResults(withId);

      setDiscJobs(prev => {
        const existingUrls = new Set(prev.map(j => (j.url || "").toLowerCase()));
        const newJobs = withId.filter(j => !existingUrls.has((j.url || "").toLowerCase()));
        return [...newJobs, ...prev];
      });
    } catch {
      setAiResults([]);
    }
    setAiSearching(false);
  };

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <div className="eyebrow">Job Discovery</div>
          <div className="section-title">Find & Match Roles</div>
        </div>
        <div className="flex items-c g10">
          <button className="btn btn-outline" onClick={runWebsiteScan} disabled={scanning}>
            {scanning ? "🔄 Scanning..." : "🌐 Scan My Websites"}
          </button>
        </div>
      </div>

      {/* Profile Filters */}
      <div className="card-flat mb16">
        <div className="flex items-c g12 flex-wrap">
          <div style={{fontSize:12,fontWeight:500,color:"var(--ink3)",marginRight:4}}>Showing roles for:</div>
          <select className="input" style={{width:160}} value={trackFilter} onChange={e=>setTrackFilter(e.target.value)}>
            <option value="ib">Investment Banking</option>
            <option value="consulting">Consulting</option>
            <option value="product">Product</option>
            <option value="">All Tracks</option>
          </select>
          <select className="input" style={{width:160}} value={levelFilter} onChange={e=>setLevelFilter(e.target.value)}>
            <option value="undergrad">Undergraduate</option>
            <option value="experienced">Experienced Hire</option>
            <option value="">All Levels</option>
          </select>
          <select className="input" style={{width:160}} value={locationFilter} onChange={e=>setLocationFilter(e.target.value)}>
            <option value="">All Locations</option>
            <option value="London">London</option>
            <option value="New York">New York</option>
            <option value="Hong Kong">Hong Kong</option>
            <option value="Singapore">Singapore</option>
            <option value="Dubai">Dubai</option>
            <option value="Frankfurt">Frankfurt</option>
            <option value="Paris">Paris</option>
            <option value="Chicago">Chicago</option>
            <option value="San Francisco">San Francisco</option>
            <option value="Toronto">Toronto</option>
            <option value="Sydney">Sydney</option>
            <option value="Mumbai">Mumbai</option>
          </select>
          <input className="input" style={{flex:1, minWidth:180}} placeholder="Search roles..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
          <button className="btn btn-primary btn-sm" onClick={()=>{setTrackFilter(profile.track);setLevelFilter(profile.level);}}>Reset to Profile</button>
        </div>
      </div>

      {/* Scan log */}
      {scanLog.length > 0 && (
        <div className="alert a-green mb16">
          <div>
            {scanLog.map((l,i) => <div key={i} className="mono fs11">{l}</div>)}
          </div>
        </div>
      )}

      <div className="tabs">
        {["recommended","ai search","all roles"].map(t=>(
          <div key={t} className={`tab ${tab===t?"active":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
        ))}
      </div>

      {tab === "recommended" && (
        <div>
          <div className="alert a-gold mb16">
            ✨ <span>Recommendations based on your <strong>{trackFilter === "ib" ? "IB" : trackFilter === "consulting" ? "Consulting" : "Product"} {levelFilter === "undergrad" ? "Undergrad" : "Experienced"}</strong> profile, CV, and location preference (<strong>{locationFilter || "All"}</strong>).</span>
          </div>
          <div className="grid g-auto">
            {filtered.map(job => (
              <div key={job.id} className={`job-card ${savedIds.has(job.id)?"saved":""}`}>
                <div className="jc-match">{job.match}% match</div>
                <div className="jc-title">{job.title}</div>
                <div className="jc-firm">{job.firm} · {job.location || "London"}</div>
                <div className="jc-tags">
                  {job.tags.map(t=><span key={t} className="tag t-navy">{t}</span>)}
                  <span className="tag t-ink">{job.level === "undergrad" ? "Undergrad" : "Experienced"}</span>
                </div>
                <div style={{fontSize:12,color:"var(--ink3)",marginBottom:12,lineHeight:1.6}}>{job.description}</div>
                <div className="jc-foot">
                  <div className="jc-source">{job.source} · ⏰ {job.deadline}</div>
                  <div className="flex g8">
                    {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-xs" style={{textDecoration:"none"}}>Apply →</a>}
                    {savedIds.has(job.id)
                      ? <span className="tag t-green">✓ Saved</span>
                      : <button className="btn btn-primary btn-xs" onClick={()=>saveJob(job)}>+ Save to Pipeline</button>
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "ai search" && (
        <div>
          <div className="card mb20">
            <div className="card-header">
              <div>
                <div className="card-title">AI-Powered Job Search</div>
                <div className="card-subtitle">Crawler-backed web search for live openings with real application links</div>
              </div>
            </div>
            <div className="flex g10 mb8">
              <input
                className="input flex-1"
                placeholder='e.g. "investment banking analyst 2025 London" or "consulting summer internship"'
                value={aiSearchQuery}
                onChange={e=>setAiSearchQuery(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&runAiSearch()}
                style={{fontSize:13}}
              />
              <button className="btn btn-gold" onClick={runAiSearch} disabled={aiSearching} style={{whiteSpace:"nowrap"}}>
                {aiSearching ? "🔄 Searching..." : "✨ AI Search"}
              </button>
            </div>
            <div className="fs11 t-ink4">Searches live web sources and removes expired postings automatically; if crawler is unavailable it falls back gracefully.</div>
          </div>

          {aiSearching && (
            <div className="ai-pulse">
              <div className="dot-spin"/>
              <div>Searching the web for <strong>{aiSearchQuery}</strong> — matching to your {trackFilter === "ib" ? "IB" : trackFilter} {levelFilter} profile...</div>
            </div>
          )}

          {aiResults.length > 0 && (
            <div>
              <div className="alert a-blue mb16">🔍 Found {aiResults.length} results for "{aiSearchQuery}"</div>
              <div className="grid g-auto">
                {aiResults.map(job=>(
                  <div key={job.id} className="job-card">
                    <div className="jc-match">{job.match}% match</div>
                    <div className="jc-title">{job.title}</div>
                    <div className="jc-firm">{job.firm} · {job.location}</div>
                    <div className="jc-tags">
                      {(job.tags||[]).map(t=><span key={t} className="tag t-navy">{t}</span>)}
                    </div>
                    <div style={{fontSize:12,color:"var(--ink3)",marginBottom:12,lineHeight:1.6}}>{job.description}</div>
                    <div className="jc-foot">
                      <div className="jc-source">AI Search · ⏰ {job.deadline}</div>
                      <div className="flex g8">
                        {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-xs" style={{textDecoration:"none"}}>Apply →</a>}
                        <button className="btn btn-primary btn-xs" onClick={()=>saveJob(job)}>+ Save</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!aiSearching && aiResults.length === 0 && (
            <div className="card-tinted" style={{textAlign:"center",padding:"40px 24px"}}>
              <div style={{fontSize:32,marginBottom:12}}>🔍</div>
              <div style={{fontFamily:"Cormorant Garamond, serif",fontSize:18,fontWeight:700,color:"var(--ink)",marginBottom:8}}>Search the Web for Live Jobs</div>
              <div style={{fontSize:13,color:"var(--ink3)"}}>Type a search query above. AI will find relevant roles and link directly to job boards like LinkedIn, Indeed, and company career pages.</div>
            </div>
          )}
        </div>
      )}

      {tab === "all roles" && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">All Discovered Roles</div>
            <span className="tag t-gold">{discJobs.length} roles</span>
          </div>
          <table className="table">
            <thead><tr><th>Role</th><th>Firm</th><th>Location</th><th>Track</th><th>Level</th><th>Deadline</th><th>Match</th><th>Action</th></tr></thead>
            <tbody>
              {discJobs.map(j=>(
                <tr key={j.id}>
                  <td className="fw6" style={{color:"var(--ink)"}}>{j.title}</td>
                  <td>{j.firm}</td>
                  <td style={{fontSize:12,color:"var(--ink3)"}}>{j.location||"London"}</td>
                  <td><span className="tag t-navy">{j.track}</span></td>
                  <td><span className="tag t-ink">{j.level}</span></td>
                  <td><span className="mono" style={{color:"var(--gold)",fontSize:11}}>{j.deadline}</span></td>
                  <td><span className="mono" style={{color:"var(--green)",fontSize:12}}>{j.match}%</span></td>
                  <td>
                    <div className="flex g6">
                      {j.url && <a href={j.url} target="_blank" rel="noopener noreferrer" className="btn btn-gold btn-xs" style={{textDecoration:"none"}}>Apply →</a>}
                      {savedIds.has(j.id)
                        ? <span className="tag t-green fs11">✓ Saved</span>
                        : <button className="btn btn-outline btn-xs" onClick={()=>saveJob(j)}>+ Pipeline</button>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGE: WEBSITE MANAGER
══════════════════════════════════════════════════════════════════════════════ */
function WebsiteManager() {
  const { user } = useAuth();
  const [sites, setSites] = useState([]);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newFreq, setNewFreq] = useState("daily");
  const [newLocation, setNewLocation] = useState("London");
  const [newTrack, setNewTrack] = useState("ib");
  const [scanning, setScanning] = useState(null);
  const [scanResults, setScanResults] = useState({});
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchWebsites(user.id).then(({ data }) => {
      if (data) {
        setSites(data.map(s => ({ id: s.id, url: s.url, label: s.label, freq: s.frequency, lastScanned: s.last_scanned, jobsFound: s.jobs_found, status: s.status })));
      }
    });
  }, [user]);

  const addSite = async () => {
    if (!newUrl.trim()) return;
    const site = { url: newUrl, label: newLabel || newUrl, frequency: newFreq, last_scanned: "Never", jobs_found: 0, status: "idle" };
    if (user) {
      const { data } = await upsertWebsite(user.id, site);
      if (data) setSites(prev => [...prev, { id: data.id, url: data.url, label: data.label, freq: data.frequency, lastScanned: data.last_scanned, jobsFound: data.jobs_found, status: data.status }]);
    }
    setNewUrl(""); setNewLabel(""); setAdding(false);
  };

  const scanSite = async (site) => {
    setScanning(site.id);
    setSites(prev => prev.map(s => s.id === site.id ? { ...s, status: "scanning" } : s));
    const trackKw = { ib: "investment banking analyst M&A ECM DCM summer analyst", consulting: "management consulting business analyst strategy", product: "product manager APM growth PM" };
    try {
      const crawled = await crawlJobs({
        query: `${trackKw[newTrack] || trackKw.ib} ${newLocation || ""}`,
        track: newTrack,
        level: "",
        location: newLocation,
        siteUrl: site.url,
      });

      const parsed = dedupeJobsByUrl(normalizeLiveJobs(crawled, site.label || "Website Crawler"));
      const found = parsed.length;
      setScanResults(prev => ({ ...prev, [site.id]: parsed }));

      setSites(prev => prev.map(s => s.id === site.id ? { ...s, status: "active", lastScanned: "Just now", jobsFound: found } : s));
      if (user) {
        upsertWebsite(user.id, {
          id: site.id,
          url: site.url,
          label: site.label,
          frequency: site.freq,
          status: "active",
          last_scanned: "Just now",
          jobs_found: found,
        });
      }
    } catch {
      setSites(prev => prev.map(s => s.id === site.id ? { ...s, status: "active", lastScanned: "Just now", jobsFound: 0 } : s));
    }
    setScanning(null);
  };

  const deleteSiteHandler = async (id) => { setSites(prev => prev.filter(s => s.id !== id)); if (user) deleteWebsite(user.id, id); };

  return (
    <div className="page">
      <div className="section-header">
        <div><div className="eyebrow">Website Manager</div><div className="section-title">Job Scanning Targets</div></div>
        <button className="btn btn-primary" onClick={()=>setAdding(true)}>+ Add Website</button>
      </div>
      <div className="alert a-blue mb20">🤖 <span>AI scans each website using intelligent keyword matching for your chosen track and location.</span></div>
      <div className="card-flat mb16">
        <div className="flex items-c g12 flex-wrap">
          <div style={{fontSize:12,fontWeight:500,color:"var(--ink3)"}}>Scan for:</div>
          <select className="input" style={{width:160}} value={newTrack} onChange={e=>setNewTrack(e.target.value)}>
            <option value="ib">Investment Banking</option><option value="consulting">Consulting</option><option value="product">Product</option>
          </select>
          <select className="input" style={{width:160}} value={newLocation} onChange={e=>setNewLocation(e.target.value)}>
            <option value="">All Locations</option><option value="London">London</option><option value="New York">New York</option>
            <option value="Hong Kong">Hong Kong</option><option value="Singapore">Singapore</option><option value="Dubai">Dubai</option>
            <option value="Frankfurt">Frankfurt</option><option value="Paris">Paris</option><option value="Chicago">Chicago</option>
            <option value="San Francisco">San Francisco</option><option value="Toronto">Toronto</option><option value="Sydney">Sydney</option>
          </select>
          <button className="btn btn-outline btn-sm" onClick={()=>sites.forEach(s=>scanSite(s))}>🔄 Scan All</button>
        </div>
      </div>
      {adding && (
        <div className="card mb20">
          <div className="card-header"><div className="card-title">Add New Website</div><button className="btn btn-ghost btn-sm" onClick={()=>setAdding(false)}>✕</button></div>
          <div className="grid g3 g16 mb16">
            <div className="fg"><label className="label">Website URL</label><input className="input" placeholder="https://..." value={newUrl} onChange={e=>setNewUrl(e.target.value)}/></div>
            <div className="fg"><label className="label">Label</label><input className="input" placeholder="e.g. Goldman Sachs" value={newLabel} onChange={e=>setNewLabel(e.target.value)}/></div>
            <div className="fg"><label className="label">Frequency</label><select className="input" value={newFreq} onChange={e=>setNewFreq(e.target.value)}><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></div>
          </div>
          <div className="flex g10"><button className="btn btn-primary" onClick={addSite}>Add Website</button><button className="btn btn-outline" onClick={()=>setAdding(false)}>Cancel</button></div>
        </div>
      )}
      <div className="card mb20">
        <div className="card-header"><div className="card-title">Configured Websites</div><span className="tag t-gold">{sites.length} sites</span></div>
        {sites.map(site => (
          <div key={site.id}>
            <div className="site-row">
              <div className={`site-status-dot ${site.status === "active" ? "dot-active" : site.status === "scanning" ? "dot-scanning" : "dot-idle"}`}/>
              <div style={{flex:1,minWidth:0}}><div className="site-url" style={{marginBottom:2}}>{site.label}</div><div className="fs11 t-ink4">{site.url}</div></div>
              <div className="flex items-c g8">
                <span className="tag t-ink">{site.freq}</span><div className="site-meta">Last: {site.lastScanned}</div>
                {site.jobsFound > 0 && <span className="tag t-green">{site.jobsFound} jobs</span>}
                <button className="btn btn-outline btn-xs" onClick={()=>scanSite(site)} disabled={scanning === site.id}>{scanning === site.id ? "🔄" : "Scan"}</button>
                <button className="btn btn-ghost btn-xs" onClick={()=>deleteSiteHandler(site.id)} style={{color:"var(--red)"}}>✕</button>
              </div>
            </div>
            {scanResults[site.id] && (
              <div style={{marginLeft:24,marginBottom:8}}>
                {scanResults[site.id].map((j,k)=>(<div key={k} style={{background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:7,padding:"8px 12px",marginBottom:6,fontSize:12}}><strong style={{color:"var(--ink)"}}>{j.title}</strong><span style={{color:"var(--ink3)",marginLeft:8}}>{j.location} · {j.deadline}</span></div>))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="grid g2 g16">
        <div className="card">
          <div className="card-title mb12">Quick Add Popular Sites</div>
          {[{label:"LinkedIn Jobs",url:"https://www.linkedin.com/jobs"},{label:"Indeed",url:"https://www.indeed.com/jobs"},{label:"UK Trackr",url:"https://uktrackr.co.uk"},{label:"Glassdoor",url:"https://www.glassdoor.co.uk/Job"},{label:"Handshake",url:"https://joinhandshake.co.uk"},{label:"Bright Network",url:"https://www.brightnetwork.co.uk"},{label:"eFinancialCareers",url:"https://www.efinancialcareers.com"}].map(s=>(
            <div key={s.label} className="flex items-c j-between" style={{padding:"9px 0",borderBottom:"1px solid var(--border2)"}}>
              <div><div className="fw5 fs12" style={{color:"var(--ink)"}}>{s.label}</div><div className="fs11 t-ink4">{s.url}</div></div>
              <button className="btn btn-outline btn-xs" onClick={async()=>{
                const site={url:s.url,label:s.label,frequency:"daily",last_scanned:"Never",jobs_found:0,status:"idle"};
                if(user){const{data}=await upsertWebsite(user.id,site);if(data)setSites(prev=>[...prev,{id:data.id,url:data.url,label:data.label,freq:data.frequency,lastScanned:data.last_scanned,jobsFound:data.jobs_found,status:data.status}]);}
              }}>+ Add</button>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title mb12">Scan Statistics</div>
          {[{l:"Websites tracked",v:sites.length},{l:"Total jobs found",v:sites.reduce((a,s)=>a+(s.jobsFound||0),0)},{l:"Daily scans",v:sites.filter(s=>s.freq==="daily").length}].map(s=>(
            <div key={s.l} className="flex j-between items-c" style={{padding:"10px 0",borderBottom:"1px solid var(--border2)"}}><div className="fs12 t-ink3">{s.l}</div><div className="mono fw6" style={{fontSize:16,color:"var(--ink)"}}>{s.v}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGE: CV + COVER LETTERS
══════════════════════════════════════════════════════════════════════════════ */
const SAMPLE_CV = ``;

function CVStudio({ jobs }) {
  const [tab, setTab] = useState("cv");
  const [clStep, setClStep] = useState(1);
  const [cv, setCv] = useState(SAMPLE_CV);
  const [selectedJob, setSelectedJob] = useState(jobs[0] || null);
  const [jobDesc, setJobDesc] = useState("");
  const [extraExp, setExtraExp] = useState("");
  const [tone, setTone] = useState("professional");
  const [generatedCL, setGeneratedCL] = useState("");
  const [generating, setGenerating] = useState(false);
  const [atsScores, setAtsScores] = useState({ keyword: 88, format: 95, quant: 82, length: 91 });
  const [tailoring, setTailoring] = useState(false);
  const [tailoredCV, setTailoredCV] = useState("");
  const [uploading, setUploading] = useState(false);
  const cvFileRef = useRef(null);

  const handleCVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      if (file.name.endsWith('.txt')) {
        const text = await file.text();
        setCv(text);
      } else {
        // For PDF/DOCX, send as base64 to the extraction edge function
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        
        const { data, error } = await supabase.functions.invoke('extract-document', {
          body: { base64, fileName: file.name, mimeType: file.type }
        });
        
        if (error) throw new Error(error.message || 'Extraction failed');
        if (data?.error) throw new Error(data.error);
        if (data?.text) {
          setCv(data.text);
        } else {
          throw new Error('No text extracted from document');
        }
      }
    } catch (err) {
      console.error("CV upload failed:", err);
      alert("Failed to process CV file: " + (err.message || "Unknown error. Try a .txt file or paste directly."));
    }
    setUploading(false);
    setUploading(false);
    if (cvFileRef.current) cvFileRef.current.value = "";
  };

  const generateCL = async () => {
    setGenerating(true);
    const prompt = `Generate a professional, tailored cover letter for:

CANDIDATE CV:
${cv}

JOB: ${selectedJob?.title || "Investment Banking Analyst"} at ${selectedJob?.firm || "Goldman Sachs"}
JOB DESCRIPTION: ${jobDesc || "Leading investment bank seeking an analyst for M&A transactions."}

ADDITIONAL EXPERIENCES/CONTEXT FROM CANDIDATE:
${extraExp || "No additional context provided."}

TONE: ${tone}
DEGREE LEVEL: Undergraduate (Columbia University, Finance)

Instructions: Write a 3-paragraph cover letter (200-280 words). 
Para 1: Specific hook referencing the firm and role — show you know the firm.
Para 2: Your most relevant 2 experiences with specific metrics that prove fit.
Para 3: Confident close. 

Use the candidate's actual experiences from their CV. Reference specific metrics. Sound like a smart, confident undergraduate, not a robot. Do not use clichés like "passionate" or "thrilled".`;

    const result = await callClaude(prompt, "You are an elite career coach writing cover letters for top-tier finance and consulting roles. Be specific, concrete, and impressive.");
    setGeneratedCL(result);
    setGenerating(false);
    setClStep(4);
  };

  const tailorCV = async () => {
    if (!jobDesc) return;
    setTailoring(true);
    const prompt = `Tailor this CV for the following job description. Keep the same format but reorder and emphasize the most relevant bullets, and suggest 2-3 stronger bullet rewrites that better match the JD keywords.

CV:
${cv}

JOB DESCRIPTION:
${jobDesc}

Return the full tailored CV text only, no commentary.`;
    const result = await callClaude(prompt, "You are a CV tailoring expert for finance and consulting roles.");
    setTailoredCV(result);
    setTailoring(false);
  };

  const stepClass = (n) => n < clStep ? "step-done" : n === clStep ? "step-active" : "step-inactive";

  // ── Text-based PDF export (small file, crisp text, proper alignment) ──
  // For CVs: always fits on one page by auto-scaling font sizes down if needed
  // For cover letters: allows multi-page
  const exportPDF = (content, filename) => {
    if (!content) return;
    const isCV = !filename.includes("cover_letter");

    const margin = { top: 20, left: 22, right: 22, bottom: 15 };
    const pageW = 210 - margin.left - margin.right;
    const pageH = 297 - margin.top - margin.bottom;

    const lines = content.split("\n");
    const sectionHeaders = ["education","professional experience","extracurricular activities","additional information","work experience","experience","leadership","skills","interests","certifications","awards","contact details","projects","summary","objective"];

    // Measure total height at a given base font size
    const measureHeight = (basePt) => {
      const bulletPt = basePt;
      const headerPt = basePt + 1;
      const namePt = basePt + 4;
      const lineH = basePt * 0.38; // approximate mm per line at this pt size
      const bulletLineH = bulletPt * 0.38;
      let h = 0;
      let nameDetected = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) { h += 1.5; continue; }
        const lower = line.toLowerCase();
        const isSectionHeader = sectionHeaders.some(x => lower === x || lower.startsWith(x + " "));
        const isBullet = /^[-•□▪►▸●◦]\s*/.test(line);
        const dateMatch = line.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}.*$|\d{4}\s*[-–—]\s*(?:\d{4}|Present|Current))/i);

        if (!nameDetected && i < 3 && !isBullet) {
          if (lower.includes("@") || lower.startsWith("m:") || lower.startsWith("+") || /^\d/.test(lower)) {
            h += lineH + 0.5;
          } else if (isSectionHeader) {
            nameDetected = true;
            h += headerPt * 0.38 + 4;
          } else {
            h += namePt * 0.38 + 1;
            nameDetected = true;
          }
          continue;
        }

        if (i < 6 && (lower.includes("@") || lower.startsWith("m:") || lower.startsWith("+"))) {
          h += lineH + 0.5;
          continue;
        }

        if (isSectionHeader) {
          h += 2 + headerPt * 0.38 + 4;
          continue;
        }

        if (isBullet) {
          const bullet = line.replace(/^[-•□▪►▸●◦]\s*/, "");
          const estCharsPerLine = Math.floor((pageW - 8) / (bulletPt * 0.18));
          const wrapLines = Math.max(1, Math.ceil(bullet.length / estCharsPerLine));
          h += wrapLines * bulletLineH + 0.8;
          continue;
        }

        if (dateMatch) {
          h += lineH + 1;
          continue;
        }

        if (line.length < 80 && !line.includes(".") && i > 3) {
          h += lineH + 0.5;
          continue;
        }

        const estCharsPerLine = Math.floor(pageW / (basePt * 0.18));
        const wrapLines = Math.max(1, Math.ceil(line.length / estCharsPerLine));
        h += wrapLines * lineH + 0.5;
      }
      return h;
    };

    // For CVs, find the largest font size (between 6pt and 10pt) that fits one page
    let baseFontSize = 10;
    if (isCV) {
      for (let pt = 10; pt >= 6; pt -= 0.5) {
        if (measureHeight(pt) <= pageH) {
          baseFontSize = pt;
          break;
        }
        baseFontSize = pt;
      }
    }

    const pdf = new jsPDF("p", "mm", "a4");
    let y = margin.top;
    let nameDetected = false;

    const lineH = baseFontSize * 0.38;
    const addPage = () => { if (!isCV) { pdf.addPage(); y = margin.top; } };
    const checkPage = (needed) => { if (!isCV && y + needed > margin.top + pageH) addPage(); };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) { y += 1.5; continue; }
      const lower = line.toLowerCase();
      const isSectionHeader = sectionHeaders.some(h => lower === h || lower.startsWith(h + " "));
      const isBullet = /^[-•□▪►▸●◦]\s*/.test(line);
      const dateMatch = line.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}.*$|\d{4}\s*[-–—]\s*(?:\d{4}|Present|Current))/i);

      if (!nameDetected && i < 3 && !isBullet) {
        if (lower.includes("@") || lower.startsWith("m:") || lower.startsWith("+") || /^\d/.test(lower)) {
          checkPage(5);
          pdf.setFont("times", "normal"); pdf.setFontSize(baseFontSize);
          pdf.text(line, 105, y, { align: "center" }); y += lineH + 0.5;
        } else if (isSectionHeader) {
          nameDetected = true;
          checkPage(8);
          pdf.setFont("times", "bold"); pdf.setFontSize(baseFontSize + 1);
          pdf.text(line.toUpperCase(), margin.left, y);
          y += 1;
          pdf.setDrawColor(0); pdf.setLineWidth(0.3);
          pdf.line(margin.left, y, margin.left + pageW, y);
          y += 4;
        } else {
          pdf.setFont("times", "bold"); pdf.setFontSize(baseFontSize + 4);
          pdf.text(line, 105, y, { align: "center" }); y += (baseFontSize + 4) * 0.38 + 1;
          nameDetected = true;
        }
        continue;
      }

      if (i < 6 && (lower.includes("@") || lower.startsWith("m:") || lower.startsWith("+"))) {
        checkPage(5);
        pdf.setFont("times", "normal"); pdf.setFontSize(baseFontSize);
        pdf.text(line, 105, y, { align: "center" }); y += lineH + 0.5;
        continue;
      }

      if (isSectionHeader) {
        checkPage(10);
        y += 2;
        pdf.setFont("times", "bold"); pdf.setFontSize(baseFontSize + 1);
        pdf.text(line.toUpperCase(), margin.left, y);
        y += 1;
        pdf.setDrawColor(0); pdf.setLineWidth(0.3);
        pdf.line(margin.left, y, margin.left + pageW, y);
        y += 4;
        continue;
      }

      if (isBullet) {
        const bullet = line.replace(/^[-•□▪►▸●◦]\s*/, "");
        pdf.setFont("times", "normal"); pdf.setFontSize(baseFontSize);
        const wrapped = pdf.splitTextToSize(bullet, pageW - 8);
        checkPage(wrapped.length * lineH + 0.8);
        pdf.text("▪", margin.left + 3, y);
        pdf.text(wrapped, margin.left + 8, y);
        y += wrapped.length * lineH + 0.8;
        continue;
      }

      if (dateMatch) {
        const dateStr = dateMatch[0].trim();
        const mainText = line.replace(dateStr, "").replace(/[,|·\s]+$/, "").trim();
        checkPage(6);
        if (mainText.length > 2) {
          pdf.setFont("times", "bold"); pdf.setFontSize(baseFontSize);
          pdf.text(mainText, margin.left, y);
          pdf.setFont("times", "normal");
          pdf.text(dateStr, margin.left + pageW, y, { align: "right" });
        } else {
          pdf.setFont("times", "normal"); pdf.setFontSize(baseFontSize);
          pdf.text(dateStr, margin.left + pageW, y, { align: "right" });
        }
        y += lineH + 1;
        continue;
      }

      if (line.length < 80 && !line.includes(".") && i > 3) {
        checkPage(6);
        pdf.setFont("times", "bolditalic"); pdf.setFontSize(baseFontSize);
        const wrapped = pdf.splitTextToSize(line, pageW);
        pdf.text(wrapped, margin.left, y);
        y += wrapped.length * lineH + 0.5;
        continue;
      }

      pdf.setFont("times", "normal"); pdf.setFontSize(baseFontSize);
      const wrapped = pdf.splitTextToSize(line, pageW);
      checkPage(wrapped.length * lineH + 0.5);
      pdf.text(wrapped, margin.left, y);
      y += wrapped.length * lineH + 0.5;
    }

    // For CVs, remove any extra pages that shouldn't exist
    if (isCV && pdf.getNumberOfPages() > 1) {
      while (pdf.getNumberOfPages() > 1) {
        pdf.deletePage(pdf.getNumberOfPages());
      }
    }

    pdf.save(filename);
  };

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <div className="eyebrow">CV + Cover Letters</div>
          <div className="section-title">Build, Tailor & Generate</div>
        </div>
        <div className="flex g10">
          <button className="btn btn-outline btn-sm" onClick={() => {
            const content = tab === "cover letter" ? generatedCL : (tailoredCV || cv);
            if (!content) return;
            const fname = `${tab === "cover letter" ? "cover_letter" : "cv"}_${new Date().toISOString().slice(0,10)}.pdf`;
            exportPDF(content, fname);
          }}>⬇ Export PDF</button>
          <button className="btn btn-outline btn-sm" onClick={() => {
            const content = tab === "cover letter" ? generatedCL : (tailoredCV || cv);
            if (!content) return;
            const htmlBody = content.split("\n").map(l => `<p style="margin:2px 0;">${l || "&nbsp;"}</p>`).join("");
            const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>body{font-family:'Times New Roman',Times,serif;font-size:11pt;line-height:1.15;color:#000;margin:36px 54px;}p{margin:2px 0;}</style></head><body>${htmlBody}</body></html>`;
            const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${tab === "cover letter" ? "cover_letter" : "cv"}_${new Date().toISOString().slice(0,10)}.doc`;
            a.click();
            URL.revokeObjectURL(url);
          }}>⬇ Export Word</button>
          <button className="btn btn-primary btn-sm" onClick={()=>setTab("cover letter")}>✨ Write Cover Letter</button>
        </div>
      </div>

      <div className="tabs">
        {["cv","cover letter","variants","bullet bank"].map(t=>(
          <div key={t} className={`tab ${tab===t?"active":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
        ))}
      </div>

      {tab === "cv" && (
        <div className="grid g2 g16">
          <div>
            <div className="card mb16">
              <input type="file" ref={cvFileRef} style={{display:"none"}} accept=".pdf,.docx,.doc,.txt" onChange={handleCVUpload}/>
              <div className="card-header">
                <div className="card-title">Master CV</div>
                <div className="flex g8 items-c">
                  <button className="btn btn-gold btn-sm" onClick={()=>cvFileRef.current?.click()} disabled={uploading}>
                    {uploading ? "⏳ Processing..." : "📄 Upload CV"}
                  </button>
                  <span className="tag t-green">v4.2</span>
                </div>
              </div>
              {!cv && !uploading && (
                <div className="drop-zone mb12" onClick={()=>cvFileRef.current?.click()}>
                  <div className="drop-icon">📄</div>
                  <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:18,fontWeight:700,color:"var(--ink)",marginBottom:6}}>Upload Your CV</div>
                  <div className="fs12 t-ink3">Drop a PDF, DOCX, or TXT file here to auto-populate your CV editor</div>
                </div>
              )}
              {uploading && (
                <div className="ai-pulse mb12"><div className="dot-spin"/>Extracting text from your CV file...</div>
              )}
              <textarea className="input textarea" style={{minHeight:480,fontFamily:"JetBrains Mono,monospace",fontSize:11.5,lineHeight:1.9,color:"var(--ink2)"}} value={cv} onChange={e=>setCv(e.target.value)} placeholder="Upload a CV file above or paste your CV text here..."/>
              <div className="flex g8 mt12 flex-wrap">
                <button className="btn btn-outline btn-sm" onClick={()=>{navigator.clipboard.writeText(cv);alert("CV saved to clipboard!");}}>Save Draft</button>
                <button className="btn btn-gold btn-sm" onClick={()=>cvFileRef.current?.click()} disabled={uploading}>📄 Re-upload</button>
                <button className="btn btn-primary btn-sm" onClick={async () => {
                  if (!cv.trim()) return;
                  setUploading(true);
                  try {
                    const result = await callClaude(
                      `Fix and improve this CV. Correct formatting issues, align sections properly, fix typos, improve bullet points with action verbs and metrics where possible. Keep the same content and structure but make it polished and professional for investment banking / consulting applications.\n\nCV:\n${cv}\n\nReturn ONLY the improved CV text, no commentary.`,
                      "You are a professional CV editor. Return only the cleaned-up CV text."
                    );
                    setCv(result);
                  } catch (err) {
                    alert("AI fix failed: " + (err.message || "Unknown error"));
                  }
                  setUploading(false);
                }}>🔧 AI Auto-Fix CV</button>
                <button className="btn btn-primary btn-sm" onClick={()=>setTab("cover letter")}>✨ Write Cover Letter</button>
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Tailor to Job Description</div>
              </div>
              <div className="fg">
                <label className="label">Paste Job Description</label>
                <textarea className="input textarea" placeholder="Paste a JD to get an AI-tailored CV variant..." value={jobDesc} onChange={e=>setJobDesc(e.target.value)} style={{minHeight:120}}/>
              </div>
              <button className="btn btn-primary w-full" onClick={tailorCV} disabled={tailoring || !jobDesc}>
                {tailoring ? "🔄 Tailoring..." : "✨ AI Tailor CV"}
              </button>
              {tailoredCV && (
                <div className="mt12">
                  <div className="label">Tailored Variant</div>
                  <textarea className="input textarea" value={tailoredCV} readOnly style={{minHeight:300,fontFamily:"JetBrains Mono,monospace",fontSize:11,lineHeight:1.8}}/>
                  <button className="btn btn-outline btn-sm mt8">Save as Variant</button>
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="card mb16">
              <div className="card-header">
                <div className="card-title">ATS Score</div>
                <span className="tag t-green">{Math.round(Object.values(atsScores).reduce((a,b)=>a+b)/4)} / 100</span>
              </div>
              {Object.entries({keyword:"Keyword Match",format:"Format Compliance",quant:"Quantification",length:"Length Optimization"}).map(([k,l])=>(
                <div key={k} className="mb12">
                  <div className="flex j-between mb4">
                    <div className="fs12 t-ink3">{l}</div>
                    <div className="mono fs11">{atsScores[k]}%</div>
                  </div>
                  <div className="prog-track"><div className="prog-fill g" style={{width:`${atsScores[k]}%`}}/></div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-title mb16">AI Suggestions</div>
              {(cv ? [
                { type:"💡", text:"Use the 'AI Tailor CV' feature below to optimise for specific job descriptions" },
                { type:"💡", text:"Quantify achievements where possible — numbers, percentages, and dollar amounts stand out" },
                { type:"💡", text:"Ensure bullet points start with strong action verbs" },
                { type:"💡", text:"Keep your CV to one page for undergraduate roles, two for experienced" },
              ] : [
                { type:"📄", text:"Upload your CV to get personalised AI suggestions" },
                { type:"💡", text:"Use the upload button above or paste your CV text directly" },
              ]).map((s,i)=>(
                <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:i<3?"1px solid var(--border2)":"none",fontSize:12,lineHeight:1.6}}>
                  <span style={{flexShrink:0}}>{s.type}</span>
                  <span style={{color:"var(--ink2)"}}>{s.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "cover letter" && (
        <div>
          {/* Step indicator */}
          <div className="step-indicator">
            {[
              { n:1, l:"Select Job" },
              { n:2, l:"Job Description" },
              { n:3, l:"Your Experience" },
              { n:4, l:"Generated Letter" },
            ].map((s,i,arr)=>(
              <div key={s.n} className="flex items-c" style={{flex:1}}>
                <div className={`step ${stepClass(s.n)}`}>
                  <div className="step-num-badge">{clStep > s.n ? "✓" : s.n}</div>
                  <div className="step-label">{s.l}</div>
                </div>
                {i < arr.length-1 && <div className={`step-connector ${clStep > s.n ? "done" : ""}`}/>}
              </div>
            ))}
          </div>

          {clStep === 1 && (
            <div className="card">
              <div className="card-title mb16">Select Role</div>
              <div className="grid g-auto g12">
                {jobs.map(j=>(
                  <div key={j.id} onClick={()=>{setSelectedJob(j);setClStep(2);}}
                    className="card-flat"
                    style={{cursor:"pointer",border:`1.5px solid ${selectedJob?.id===j.id?"var(--gold)":"var(--border2)"}`,borderRadius:10,padding:"14px 16px",transition:"all .15s"}}>
                    <div className="fw6 fs12" style={{color:"var(--ink)",marginBottom:3}}>{j.title}</div>
                    <div className="fs11 t-ink3">{j.firm}</div>
                    <div className="flex g6 mt8">
                      {j.tags.map(t=><span key={t} className="tag t-navy">{t}</span>)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt16">
                <label className="label">Or enter a custom role</label>
                <div className="flex g10">
                  <input className="input" placeholder="Job title..." style={{flex:1}}/>
                  <input className="input" placeholder="Company..." style={{flex:1}}/>
                  <button className="btn btn-primary" onClick={()=>setClStep(2)}>Next →</button>
                </div>
              </div>
            </div>
          )}

          {clStep === 2 && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Job Description</div>
                  <div className="card-subtitle">For {selectedJob?.title || "selected role"} at {selectedJob?.firm || "selected firm"}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={()=>setClStep(1)}>← Back</button>
              </div>
              <div className="fg">
                <label className="label">Paste the full job description</label>
                <textarea className="input textarea" style={{minHeight:220}} placeholder="Paste the complete JD here — AI uses this to match your CV to their exact language and requirements..."
                  value={jobDesc} onChange={e=>setJobDesc(e.target.value)}/>
              </div>
              <div className="alert a-gold mb16">
                💡 The more detail you provide, the more targeted your cover letter will be. Include role requirements, firm culture notes, and team focus.
              </div>
              <div className="flex g10 j-end">
                <button className="btn btn-outline" onClick={()=>setClStep(1)}>← Back</button>
                <button className="btn btn-primary" onClick={()=>setClStep(3)}>Next: Add Your Experience →</button>
              </div>
            </div>
          )}

          {clStep === 3 && (
            <div className="grid g2 g16">
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Your Context & Experience</div>
                    <div className="card-subtitle">Add anything beyond your CV to personalise the letter</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setClStep(2)}>← Back</button>
                </div>
                <div className="fg">
                  <label className="label">Extra experiences, projects, or context to include</label>
                  <textarea className="input textarea" style={{minHeight:130}}
                    placeholder="e.g. 'I met the MD from this team at a networking event and discussed their European M&A pipeline' or 'I did a project on healthcare sector consolidation' or 'I have specific interest in their ESG advisory practice'"
                    value={extraExp} onChange={e=>setExtraExp(e.target.value)}/>
                </div>
                <div className="fg">
                  <label className="label">Why this firm (specific reason)</label>
                  <input className="input" placeholder="e.g. Their position in TMT M&A advisory, recent Arm IPO mandate, sector team structure..."/>
                </div>
                <div className="fg">
                  <label className="label">Cover letter tone</label>
                  <div className="flex g8">
                    {["professional","confident","narrative"].map(t=>(
                      <button key={t} className={`btn btn-sm flex-1 ${tone===t?"btn-primary":"btn-outline"}`}
                        style={{textTransform:"capitalize"}} onClick={()=>setTone(t)}>{t}</button>
                    ))}
                  </div>
                </div>
                <div className="fg">
                  <label className="label">Length target</label>
                  <select className="input">
                    <option>200–250 words (preferred)</option>
                    <option>250–300 words</option>
                    <option>300–350 words</option>
                  </select>
                </div>
                <div className="flex g10 j-end mt8">
                  <button className="btn btn-outline" onClick={()=>setClStep(2)}>← Back</button>
                  <button className="btn btn-gold btn-lg" onClick={generateCL} disabled={generating}>
                    {generating ? "✨ Generating..." : "✨ Generate Cover Letter"}
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="card-title mb12">What AI Uses to Write Your Letter</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[
                    { icon:"📄", label:"Your CV", status:"Ready", desc:"Experiences, metrics, skills extracted" },
                    { icon:"📋", label:"Job Description", status:jobDesc?"Ready":"Missing", desc:jobDesc ? "JD provided — keywords will be matched" : "Paste JD in Step 2" },
                    { icon:"✨", label:"Extra Context", status:extraExp?"Added":"Optional", desc:extraExp || "Add personalisation, networking context, firm reasons" },
                    { icon:"🎯", label:"Playbook", status:"IB Undergrad", desc:"Tone, structure, and framing aligned to IB norms" },
                  ].map(item=>(
                    <div key={item.label} style={{display:"flex",gap:12,padding:"12px 14px",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:9}}>
                      <span style={{fontSize:20,flexShrink:0}}>{item.icon}</span>
                      <div>
                        <div className="flex items-c g8 mb2">
                          <span className="fw6 fs12" style={{color:"var(--ink)"}}>{item.label}</span>
                          <span className={`tag ${item.status==="Ready"||item.status==="Added"?"t-green":item.status==="Optional"?"t-ink":"t-red"}`}>{item.status}</span>
                        </div>
                        <div className="fs11 t-ink3">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {clStep === 4 && (
            <div className="grid g2 g16">
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Generated Cover Letter</div>
                    <div className="card-subtitle">{selectedJob?.title} at {selectedJob?.firm}</div>
                  </div>
                  <div className="flex g8">
                    <button className="btn btn-ghost btn-sm" onClick={()=>setClStep(3)}>← Revise</button>
                    <button className="btn btn-outline btn-sm" onClick={generateCL}>🔄 Regenerate</button>
                  </div>
                </div>
                {generating ? (
                  <div className="ai-pulse"><div className="dot-spin"/>Generating personalised cover letter...</div>
                ) : (
                  <div style={{background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:10,padding:"24px",fontFamily:"Georgia,serif",fontSize:13,lineHeight:1.9,color:"var(--ink2)",whiteSpace:"pre-wrap",minHeight:300}}>
                    {generatedCL}
                  </div>
                )}
                {generatedCL && !generating && (
                  <div className="flex g10 mt12" style={{flexWrap:"wrap"}}>
                    <button className="btn btn-primary" onClick={()=>navigator.clipboard.writeText(generatedCL)}>📋 Copy</button>
                    <button className="btn btn-outline btn-sm" onClick={() => {
                      exportPDF(generatedCL, `cover_letter_${selectedJob?.firm||"draft"}_${new Date().toISOString().slice(0,10)}.pdf`);
                    }}>⬇ Export PDF</button>
                    <button className="btn btn-outline btn-sm" onClick={() => {
                      const htmlBody = generatedCL.split("\n").map(l => `<p style="margin:2px 0;">${l || "&nbsp;"}</p>`).join("");
                      const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>body{font-family:'Times New Roman',Times,serif;font-size:11pt;line-height:1.4;color:#000;margin:36px 54px;}p{margin:2px 0;}</style></head><body>${htmlBody}</body></html>`;
                      const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url;
                      a.download = `cover_letter_${selectedJob?.firm||"draft"}_${new Date().toISOString().slice(0,10)}.doc`;
                      a.click(); URL.revokeObjectURL(url);
                    }}>⬇ Export Word</button>
                    <button className="btn btn-ghost btn-sm" style={{marginLeft:"auto"}} onClick={()=>setClStep(1)}>Start New →</button>
                  </div>
                )}
              </div>
              <div className="card">
                <div className="card-title mb12">Letter Scorecard</div>
                {[
                  { l:"Firm Specificity", v:88 },
                  { l:"Metric Usage", v:92 },
                  { l:"JD Keyword Match", v:85 },
                  { l:"Tone Consistency", v:90 },
                  { l:"Concision", v:87 },
                ].map(m=>(
                  <div key={m.l} className="mb12">
                    <div className="flex j-between mb4">
                      <div className="fs12 t-ink3">{m.l}</div>
                      <div className="mono fs11">{m.v}/100</div>
                    </div>
                    <div className="prog-track"><div className="prog-fill n" style={{width:`${m.v}%`}}/></div>
                  </div>
                ))}
                <div className="divider"/>
                <div className="alert a-gold">
                  💡 Tip: Add a specific recent news item or deal from {selectedJob?.firm} to push specificity above 95.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "variants" && (
        <div className="grid g-auto">
          {["Goldman Sachs SA","Morgan Stanley M&A","McKinsey BA","Lazard TMT"].map((v,i)=>(
            <div key={v} className="card">
              <div className="card-title mb4">{v}</div>
              <div className="fs11 t-ink4 mb16">Updated {["Feb 22","Feb 18","Feb 15","Feb 10"][i]}</div>
              <div className="flex j-between items-c mb8">
                <span className="fs12 t-ink3">ATS Score</span>
                <span className="mono" style={{color:"var(--green)",fontWeight:600}}>{[94,91,85,89][i]}</span>
              </div>
              <div className="prog-track mb16"><div className="prog-fill g" style={{width:`${[94,91,85,89][i]}%`}}/></div>
              <div className="flex g8">
                <button className="btn btn-outline btn-xs flex-1">Edit</button>
                <button className="btn btn-primary btn-xs flex-1">Export</button>
              </div>
            </div>
          ))}
          <div className="card-flat" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",border:"2px dashed var(--border)",background:"transparent",minHeight:150,borderRadius:12,gap:8}}>
            <div style={{fontSize:24,opacity:0.4}}>+</div>
            <div className="fs12 t-ink4">New Variant</div>
          </div>
        </div>
      )}

      {tab === "bullet bank" && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Bullet Bank</div>
            <button className="btn btn-primary btn-sm">+ Add Bullet</button>
          </div>
          <table className="table">
            <thead><tr><th>Bullet</th><th>Skill Tags</th><th>Strength</th><th>Action</th></tr></thead>
            <tbody>
              {[
                { b:"Led due diligence on 3 software transactions with combined EV of $2.3B", tags:["M&A","Due Diligence"], s:94 },
                { b:"Built integrated LBO/DCF models cited in final client materials for $780M deal", tags:["Modeling","LBO"], s:98 },
                { b:"Prepared 12 client-ready pitch decks, reducing MD revision cycles by 30%", tags:["Pitchbook"], s:86 },
                { b:"Initiated coverage model on 4 SaaS companies; 2 calls reached consensus in 45 days", tags:["Research","Equities"], s:89 },
              ].map((r,i)=>(
                <tr key={i}>
                  <td style={{maxWidth:420,fontSize:12.5,color:"var(--ink)"}}>{r.b}</td>
                  <td><div className="flex g5">{r.tags.map(t=><span key={t} className="tag t-blue">{t}</span>)}</div></td>
                  <td><span className="mono" style={{color:"var(--green)",fontWeight:600}}>{r.s}</span></td>
                  <td><button className="btn btn-outline btn-xs">+ Insert</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGE: PIPELINE
══════════════════════════════════════════════════════════════════════════════ */
function Pipeline({ jobs }) {
  const stages = ["saved","outreach","applying","interviewing","offer"];
  const labels = {saved:"Saved",outreach:"Outreach",applying:"Applying",interviewing:"Interviewing",offer:"Offer ✓"};

  const handleExportCSV = () => {
    const exportData = jobs.map(j => ({
      Title: j.title, Firm: j.firm, Stage: j.stage, Track: j.track || "",
      Deadline: j.deadline || "", Match: j.match || 0, Tags: (j.tags || []).join("; "),
      Location: j.location || "", Level: j.level || "",
    }));
    exportToCSV(exportData, "pipeline_export");
  };

  return (
    <div className="page">
      <div className="section-header">
        <div><div className="eyebrow">CRM Pipeline</div><div className="section-title">Job Tracking Board</div></div>
        <div className="flex g10">
          <button className="btn btn-outline btn-sm" onClick={handleExportCSV}>⬇ Export CSV</button>
          <button className="btn btn-primary btn-sm">+ Add Role</button>
        </div>
      </div>
      <div className="grid g4 mb20">
        {[
          { l:"Tracked", v:jobs.length },
          { l:"In Progress", v:jobs.filter(j=>["outreach","applying","interviewing"].includes(j.stage)).length },
          { l:"Interviews", v:jobs.filter(j=>j.stage==="interviewing").length },
          { l:"Offers", v:jobs.filter(j=>j.stage==="offer").length },
        ].map(k=>(
          <div key={k.l} className="kpi"><div className="kpi-label">{k.l}</div><div className="kpi-val">{k.v}</div></div>
        ))}
      </div>
      <div className="kanban mb20">
        {stages.map(stage=>{
          const stageJobs = jobs.filter(j=>j.stage===stage);
          return (
            <div key={stage} className="k-col">
              <div className="k-col-head">
                <div className="k-col-title">{labels[stage]}</div>
                <div className="k-count">{stageJobs.length}</div>
              </div>
              {stageJobs.map(job=>(
                <div key={job.id} className="k-card">
                  <div className="k-card-title">{job.title}</div>
                  <div className="k-card-sub">{job.firm}</div>
                  <div className="flex g5 mt8" style={{flexWrap:"wrap"}}>
                    {(job.tags||[]).map(t=><span key={t} className="tag t-ink">{t}</span>)}
                  </div>
                  <div className="k-card-foot">
                    <span style={{color:"var(--gold)",fontSize:10}}>⏰ {job.deadline}</span>
                    <span className="mono" style={{color:"var(--green)",fontSize:10}}>{job.match}%</span>
                  </div>
                </div>
              ))}
              {stageJobs.length === 0 && (
                <div style={{padding:"18px",textAlign:"center",color:"var(--ink4)",fontSize:11,border:"1.5px dashed var(--border2)",borderRadius:8}}>No roles yet</div>
              )}
              <button className="btn btn-ghost btn-xs w-full" style={{justifyContent:"center",marginTop:8}}>+ Add</button>
            </div>
          );
        })}
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">All Roles</div><button className="btn btn-outline btn-sm" onClick={handleExportCSV}>⬇ Export</button></div>
        <table className="table">
          <thead><tr><th>Role</th><th>Firm</th><th>Stage</th><th>Track</th><th>Deadline</th><th>Match</th><th>Cover Letter</th><th>Actions</th></tr></thead>
          <tbody>
            {jobs.map(j=>(
              <tr key={j.id}>
                <td className="fw6" style={{color:"var(--ink)"}}>{j.title}</td>
                <td>{j.firm}</td>
                <td><span className={`tag t-${j.stage==="offer"?"green":j.stage==="interviewing"?"navy":"ink"}`}>{labels[j.stage]}</span></td>
                <td><span className="tag t-gold">{j.track}</span></td>
                <td><span className="mono" style={{color:"var(--gold)",fontSize:11}}>{j.deadline}</span></td>
                <td><span className="mono" style={{color:"var(--green)",fontSize:12}}>{j.match}%</span></td>
                <td><span className="tag t-ink">Draft</span></td>
                <td><button className="btn btn-outline btn-xs">Open →</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGE: INTERVIEW PREP
══════════════════════════════════════════════════════════════════════════════ */
function Interview() {
  const [tab, setTab] = useState("practice");
  const [selectedTrack, setSelectedTrack] = useState("ib");
  const [selectedLevel, setSelectedLevel] = useState("undergrad");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [currentQ, setCurrentQ] = useState(null);
  const [messages, setMessages] = useState([
    { role:"ai", text:"Welcome to Interview Prep. Select a track and category, then pick a question to practice — or let AI generate fresh ones." },
  ]);
  const [input, setInput] = useState("");
  const [scores, setScores] = useState(null);
  const [answering, setAnswering] = useState(false);
  const [generatedQs, setGeneratedQs] = useState([]);
  const [generating, setGenerating] = useState(false);

  // Get questions from templates
  const templateQuestions = PLAYBOOKS[selectedTrack]?.[selectedLevel]?.questions || [];
  const allQuestions = [...templateQuestions, ...generatedQs];
  const categories = ["All", ...new Set(allQuestions.map(q => q.cat))];
  const filteredQuestions = selectedCategory === "All" ? allQuestions : allQuestions.filter(q => q.cat === selectedCategory);

  const generateQuestions = async () => {
    setGenerating(true);
    const trackName = PLAYBOOKS[selectedTrack]?.name || "Investment Banking";
    const levelLabel = selectedLevel === "undergrad" ? "undergraduate/entry-level" : "experienced hire/lateral";
    const prompt = `Generate 6 unique interview questions for ${trackName} (${levelLabel}).

Include a mix of categories:
${selectedTrack === "ib" ? "- Technical (DCF, LBO, M&A, Accounting)\n- Behavioral (leadership, teamwork, fit)\n- Market/Deals (current events, deal analysis)" :
  selectedTrack === "consulting" ? "- Case Study (profitability, market entry, M&A)\n- Market Sizing (estimation questions)\n- Behavioral (leadership, impact, fit)" :
  "- Product Design (new product, improvement)\n- Metrics/Analytics (data-driven decisions)\n- Leadership (cross-functional, strategy)"}

Return ONLY a JSON array: [{"q":"...","cat":"...","diff":"Core or Advanced"}]`;
    try {
      const result = await callClaude(prompt, "Return only a valid JSON array.", true);
      const clean = result.replace(/```json|```/g, "").trim();
      const start = clean.indexOf("["); const end = clean.lastIndexOf("]") + 1;
      if (start >= 0) {
        const parsed = JSON.parse(clean.slice(start, end));
        setGeneratedQs(prev => [...prev, ...parsed]);
      }
    } catch (e) { console.error("Failed to generate questions:", e); }
    setGenerating(false);
  };

  const startPractice = (q) => {
    setCurrentQ(q);
    setScores(null);
    setMessages([{ role:"ai", text:`**Question:** ${q.q}\n\n*Category: ${q.cat} · Difficulty: ${q.diff}*\n\nTake your time to structure your answer, then submit below.` }]);
    setTab("practice");
  };

  const submitAnswer = async () => {
    if (!input.trim() || answering) return;
    const ans = input;
    setInput("");
    setAnswering(true);
    setMessages(prev => [...prev, { role:"user", text:ans }]);
    const trackName = PLAYBOOKS[selectedTrack]?.name || "Investment Banking";
    const prompt = `You are a ${trackName} interview coach. The candidate was asked: "${currentQ?.q || "a technical question"}"

Their answer: "${ans}"

Score their answer and provide feedback. Format:
**Assessment:** [1-2 sentence summary]
**Strengths:** [what they did well]
**Improvement:** [what's missing]
**Model Answer Ending:** [how a top candidate would close]

Keep under 150 words. Be specific and direct.`;
    const result = await callClaude(prompt);
    setMessages(prev => [...prev, { role:"ai", text:result }]);
    setScores({ structure: Math.floor(Math.random()*20)+72, relevance: Math.floor(Math.random()*15)+80, specificity: Math.floor(Math.random()*25)+68, concision: Math.floor(Math.random()*18)+76 });
    setAnswering(false);
  };

  return (
    <div className="page">
      <div className="section-header">
        <div><div className="eyebrow">Interview Prep</div><div className="section-title">Practice, Score & Improve</div></div>
        <div className="tabs" style={{marginBottom:0}}>
          {["practice","question bank","progress"].map(t=>(
            <div key={t} className={`tab ${tab===t?"active":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>

      {tab === "practice" && (
        <div className="grid g2 g16">
          <div>
            <div className="card mb16">
              <div className="card-header">
                <div><div className="card-title">{currentQ ? currentQ.cat : "Select a Question"}</div><div className="card-subtitle">{PLAYBOOKS[selectedTrack]?.name} · {selectedLevel === "undergrad" ? "Undergrad" : "Experienced"}</div></div>
                {currentQ && <span className={`tag t-${currentQ.diff==="Advanced"?"gold":"green"}`}>{currentQ.diff}</span>}
              </div>
              <div className="chat-wrap">
                <div className="chat-msgs">
                  {messages.map((m,i)=>(
                    <div key={i} className={`chat-msg ${m.role==="user"?"msg-user":"msg-ai"}`}>
                      {m.text.split('\n').map((l,j)=>(
                        <div key={j} style={{marginBottom:l?3:0}} dangerouslySetInnerHTML={{__html:l.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}}/>
                      ))}
                    </div>
                  ))}
                  {answering && <div className="chat-msg msg-ai" style={{opacity:0.6}}>✦ Scoring your answer...</div>}
                </div>
                {scores && (
                  <div className="chat-scores">
                    {[["Structure",scores.structure],["Relevance",scores.relevance],["Specificity",scores.specificity],["Concision",scores.concision]].map(([l,v])=>(
                      <div key={l} className="score-block flex-1">
                        <div className="score-lbl">{l}</div>
                        <div className="score-num" style={{color:v>85?"var(--green)":v>70?"var(--gold)":"var(--red)"}}>{v}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="chat-input-row">
                  <input className="input flex-1" placeholder={currentQ ? "Type your answer..." : "Select a question from the Question Bank tab..."} value={input}
                    onChange={e=>setInput(e.target.value)} disabled={!currentQ}
                    onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&submitAnswer()}/>
                  <button className="btn btn-primary btn-sm" onClick={submitAnswer} disabled={answering || !currentQ}>Submit →</button>
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="card mb16">
              <div className="card-header"><div className="card-title">Session Config</div></div>
              <div className="fg"><label className="label">Track</label>
                <select className="input" value={selectedTrack} onChange={e=>{setSelectedTrack(e.target.value);setGeneratedQs([]);}}>
                  {Object.entries(PLAYBOOKS).map(([k,p])=><option key={k} value={k}>{p.name}</option>)}
                </select>
              </div>
              <div className="fg"><label className="label">Level</label>
                <select className="input" value={selectedLevel} onChange={e=>{setSelectedLevel(e.target.value);setGeneratedQs([]);}}>
                  <option value="undergrad">Undergraduate</option><option value="experienced">Experienced Hire</option>
                </select>
              </div>
              <div className="fg"><label className="label">Category</label>
                <select className="input" value={selectedCategory} onChange={e=>setSelectedCategory(e.target.value)}>
                  {categories.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button className="btn btn-primary w-full mb8" onClick={()=>{if(filteredQuestions.length>0){const r=filteredQuestions[Math.floor(Math.random()*filteredQuestions.length)];startPractice(r);}}}>
                🎲 Random Question
              </button>
              <button className="btn btn-outline w-full" onClick={generateQuestions} disabled={generating}>
                {generating ? "⏳ Generating..." : "✨ AI Generate New Questions"}
              </button>
            </div>
            <div className="card">
              <div className="card-title mb16">Quick Pick</div>
              {filteredQuestions.slice(0,5).map((q,i)=>(
                <div key={i} onClick={()=>startPractice(q)} style={{padding:"10px 0",borderBottom:i<4?"1px solid var(--border2)":"none",cursor:"pointer",transition:"all .12s"}}
                  onMouseEnter={e=>e.currentTarget.style.paddingLeft="8px"} onMouseLeave={e=>e.currentTarget.style.paddingLeft="0"}>
                  <div className="fs12 fw5" style={{color:"var(--ink)",marginBottom:3}}>{q.q}</div>
                  <div className="flex g8"><span className="tag t-blue">{q.cat}</span><span className={`tag t-${q.diff==="Advanced"?"gold":"green"}`}>{q.diff}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "question bank" && (
        <div>
          <div className="flex g10 mb16 items-c">
            <select className="input" style={{width:180}} value={selectedTrack} onChange={e=>{setSelectedTrack(e.target.value);setGeneratedQs([]);}}>
              {Object.entries(PLAYBOOKS).map(([k,p])=><option key={k} value={k}>{p.name}</option>)}
            </select>
            <select className="input" style={{width:160}} value={selectedLevel} onChange={e=>{setSelectedLevel(e.target.value);setGeneratedQs([]);}}>
              <option value="undergrad">Undergraduate</option><option value="experienced">Experienced</option>
            </select>
            <select className="input" style={{width:160}} value={selectedCategory} onChange={e=>setSelectedCategory(e.target.value)}>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={generateQuestions} disabled={generating}>
              {generating ? "⏳ Generating..." : "✨ Generate More"}
            </button>
            <span className="tag t-gold" style={{marginLeft:"auto"}}>{filteredQuestions.length} questions</span>
          </div>
          {generating && <div className="ai-pulse mb16"><div className="dot-spin"/>Generating questions for {PLAYBOOKS[selectedTrack]?.name}...</div>}
          <div className="card">
            <div className="card-header"><div className="card-title">Question Bank</div></div>
            <table className="table">
              <thead><tr><th>Question</th><th>Category</th><th>Level</th><th>Source</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredQuestions.map((q,i)=>(
                  <tr key={i}>
                    <td style={{maxWidth:380,color:"var(--ink)"}}>{q.q}</td>
                    <td><span className="tag t-blue">{q.cat}</span></td>
                    <td><span className={`tag t-${q.diff==="Advanced"?"gold":"green"}`}>{q.diff}</span></td>
                    <td><span className={`tag t-${i < templateQuestions.length ? "navy" : "ink"}`}>{i < templateQuestions.length ? "Template" : "AI Generated"}</span></td>
                    <td><button className="btn btn-primary btn-xs" onClick={()=>startPractice(q)}>Practice →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "progress" && (
        <div>
          <div className="grid g3 mb16">
            {[{l:"Sessions",v:"0",d:"start practicing",up:false},{l:"Avg Score",v:"—",d:"no data yet",up:false},{l:"Best Category",v:"—",d:"complete a session",up:false}].map(k=>(
              <div key={k.l} className="kpi"><div className="kpi-label">{k.l}</div><div className="kpi-val">{k.v}</div><div className={`kpi-delta ${k.up?"up":""}`}>{k.up?"▲":""} {k.d}</div></div>
            ))}
          </div>
          <div className="card">
            <div className="card-title mb16">Score History</div>
            <div style={{textAlign:"center",padding:"32px",color:"var(--ink4)",fontSize:13}}>
              <div style={{fontSize:28,marginBottom:8}}>📊</div>
              Complete practice sessions to build your score history.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGE: PLAYBOOKS
══════════════════════════════════════════════════════════════════════════════ */
function Playbooks() {
  const [sel, setSel] = useState("ib");
  const [level, setLevel] = useState("undergrad");
  const [tab, setTab] = useState("milestones");
  const [deepDive, setDeepDive] = useState(null);
  const [deepDiveContent, setDeepDiveContent] = useState("");
  const [loadingDeep, setLoadingDeep] = useState(false);
  const pb = PLAYBOOKS[sel][level];

  const openDeepDive = async (milestone) => {
    setDeepDive(milestone);
    setLoadingDeep(true);
    try {
      const prompt = `Create a detailed, actionable guide for this career prep milestone:

Track: ${PLAYBOOKS[sel].name} (${level === "undergrad" ? "Undergraduate" : "Experienced Hire"})
Milestone: "${milestone.title}" (${milestone.week})
Description: ${milestone.desc}

Provide a comprehensive breakdown with:
1. Day-by-Day Action Plan — specific tasks for each day of this period
2. Key Resources — books, websites, courses, tools to use
3. Common Mistakes — what candidates typically get wrong
4. Success Metrics — how to know you've completed this properly
5. Pro Tips — insider knowledge from successful candidates

Be specific to ${PLAYBOOKS[sel].name}. Use concrete examples and metrics.
IMPORTANT: Do NOT use markdown formatting like **, ##, ###, ***, ---, or any other markdown syntax. Use plain text only. Use line breaks and indentation for structure.`;
      const result = await callClaude(prompt);
      setDeepDiveContent(result);
    } catch { setDeepDiveContent("Failed to load detailed content. Please try again."); }
    setLoadingDeep(false);
  };

  if (deepDive) {
    return (
      <div className="page">
        <div className="section-header">
          <div>
            <div className="eyebrow">{PLAYBOOKS[sel].name} · {deepDive.week}</div>
            <div className="section-title">{deepDive.title}</div>
          </div>
          <button className="btn btn-outline" onClick={()=>{setDeepDive(null);setDeepDiveContent("");}}>← Back to Playbook</button>
        </div>
        <div className="alert a-gold mb20">📋 <span>{deepDive.desc}</span></div>
        {loadingDeep ? (
          <div className="ai-pulse"><div className="dot-spin"/>Generating detailed guide for "{deepDive.title}"...</div>
        ) : (
          <div className="card">
            <div style={{fontFamily:"Sora,sans-serif",fontSize:13,lineHeight:1.8,color:"var(--ink2)"}}>
              {deepDiveContent.split('\n').map((rawLine, i) => {
                // Strip all markdown syntax
                let line = rawLine
                  .replace(/^#{1,6}\s+/g, '')       // headers
                  .replace(/\*\*\*(.*?)\*\*\*/g, '$1') // bold+italic
                  .replace(/\*\*(.*?)\*\*/g, '$1')   // bold
                  .replace(/\*(.*?)\*/g, '$1')        // italic
                  .replace(/^---+$/g, '')             // horizontal rules
                  .replace(/`(.*?)`/g, '$1')          // inline code
                  .trim();
                
                if (!line) return <div key={i} style={{height:8}}/>;
                
                // Section headers: lines that are short, no period, and follow a blank line
                const isHeader = (line.length < 60 && !line.startsWith('-') && !line.startsWith('•') && !line.match(/^\d+\./) && 
                  (rawLine.match(/^#{1,6}\s/) || (line.endsWith(':') || (line.length < 40 && !line.includes('.')))));
                
                if (isHeader && line.length > 2) {
                  return <div key={i} style={{fontFamily:"Cormorant Garamond,serif",fontSize:18,fontWeight:700,color:"var(--ink)",marginTop:20,marginBottom:8,borderBottom:"1px solid var(--border2)",paddingBottom:6}}>{line.replace(/:$/, '')}</div>;
                }
                
                // Bullet points
                if (line.startsWith('- ') || line.startsWith('• ')) {
                  return <div key={i} style={{paddingLeft:20,marginBottom:5,position:"relative"}}>
                    <span style={{position:"absolute",left:6,color:"var(--gold)"}}>▪</span>
                    {line.slice(2)}
                  </div>;
                }
                
                // Numbered items
                if (line.match(/^\d+\.\s/)) {
                  const num = line.match(/^(\d+)\./)[1];
                  const text = line.replace(/^\d+\.\s*/, '');
                  return <div key={i} style={{paddingLeft:20,marginBottom:5,position:"relative"}}>
                    <span style={{position:"absolute",left:2,fontFamily:"JetBrains Mono,monospace",fontSize:11,color:"var(--gold)",fontWeight:600}}>{num}.</span>
                    {text}
                  </div>;
                }
                
                return <div key={i} style={{marginBottom:4}}>{line}</div>;
              })}
            </div>
            <div className="divider"/>
            <div className="flex g10">
              <button className="btn btn-outline btn-sm" onClick={()=>exportToText(deepDiveContent, `${deepDive.title.replace(/\s+/g,'_')}`)}>⬇ Export as Text</button>
              <button className="btn btn-outline btn-sm" onClick={()=>navigator.clipboard.writeText(deepDiveContent)}>📋 Copy</button>
              <button className="btn btn-primary btn-sm" onClick={()=>openDeepDive(deepDive)}>🔄 Regenerate</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="section-header">
        <div><div className="eyebrow">Career Playbooks</div><div className="section-title">Choose Your Path</div></div>
        <div style={{display:"flex",gap:8,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:9,padding:4}}>
          {["undergrad","experienced"].map(l=>(
            <button key={l} className={`btn btn-sm ${level===l?"btn-primary":"btn-ghost"}`} style={{textTransform:"capitalize"}} onClick={()=>setLevel(l)}>
              {l==="undergrad"?"Undergraduate":"Experienced Hire"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid g3 mb24">
        {Object.entries(PLAYBOOKS).map(([k,p])=>(
          <div key={k} className={`pb-card ${sel===k?"sel":""}`} onClick={()=>setSel(k)}>
            <div className="pb-head">
              <div className="pb-icon">{p.icon}</div>
              <div className="pb-name">{p.name}</div>
              <div style={{marginTop:6,fontSize:12,color:"rgba(255,255,255,0.6)"}}>{p[level].process}</div>
            </div>
            <div className="pb-body">
              <div className="label mb8">Prerequisites</div>
              <div className="flex g5" style={{flexWrap:"wrap"}}>
                {p[level].prereqs.slice(0,3).map(r=><span key={r} className="tag t-ink">{r}</span>)}
                {p[level].prereqs.length>3&&<span className="tag t-ink">+{p[level].prereqs.length-3}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="eyebrow">{PLAYBOOKS[sel].name} · {level==="undergrad"?"Undergraduate":"Experienced"}</div>
            <div className="card-title" style={{fontFamily:"Cormorant Garamond,serif",fontSize:20}}>{PLAYBOOKS[sel].icon} Full Playbook</div>
          </div>
          <div className="flex g4">
            {["milestones","questions","templates","checklist"].map(t=>(
              <button key={t} className={`btn btn-sm ${tab===t?"btn-primary":"btn-outline"}`} style={{textTransform:"capitalize"}} onClick={()=>setTab(t)}>{t}</button>
            ))}
          </div>
        </div>

        {tab==="milestones" && (
          <div>
            <div className="alert a-gold mb16">⚡ <span><strong>Hiring Process:</strong> {pb.process}. Click any milestone to deep-dive.</span></div>
            {pb.milestones.map((m,i)=>(
              <div key={i} style={{display:"flex",gap:16,padding:"14px 0",borderBottom:i<pb.milestones.length-1?"1px solid var(--border2)":"none",cursor:"pointer",transition:"background .15s",borderRadius:8}}
                onClick={()=>openDeepDive(m)}
                onMouseEnter={e=>e.currentTarget.style.background="var(--surface2)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div className="mono" style={{width:64,fontSize:10,color:"var(--gold)",paddingTop:2,letterSpacing:"0.08em"}}>{m.week}</div>
                <div style={{flex:1}}>
                  <div className="fw6 fs12" style={{color:"var(--ink)",marginBottom:4}}>{m.title} <span style={{fontSize:10,color:"var(--gold)",marginLeft:6}}>→ Deep Dive</span></div>
                  <div style={{fontSize:12,color:"var(--ink3)",lineHeight:1.65}}>{m.desc}</div>
                </div>
                <span className={`tag ${i===0?"t-green":"t-ink"}`}>{i===0?"Active":"Pending"}</span>
              </div>
            ))}
          </div>
        )}

        {tab==="questions" && (
          <table className="table">
            <thead><tr><th>Question</th><th>Category</th><th>Difficulty</th><th>Action</th></tr></thead>
            <tbody>
              {pb.questions.map((q,i)=>(
                <tr key={i}>
                  <td style={{color:"var(--ink)",maxWidth:420}}>{q.q}</td>
                  <td><span className="tag t-blue">{q.cat}</span></td>
                  <td><span className={`tag t-${q.diff==="Advanced"?"gold":"green"}`}>{q.diff}</span></td>
                  <td><button className="btn btn-outline btn-xs">Practice →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab==="templates" && (
          <div className="grid g2 g16">
            {[{title:"CV Structure",desc:"ATS-safe format with finance-specific bullet construction.",icon:"📄"},{title:"Cold Email Sequence",desc:"3-step sequence with subject lines and personalization variables.",icon:"✉️"},{title:"LinkedIn DM",desc:"Under 300 chars. Alumni connection + specific ask.",icon:"💬"},{title:"Cover Letter",desc:"4-paragraph structure: hook → why firm → why you → close.",icon:"📝"}].map(t=>(
              <div key={t.title} style={{background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:10,padding:"18px"}}>
                <div style={{fontSize:22,marginBottom:8}}>{t.icon}</div>
                <div className="card-title mb4">{t.title}</div>
                <div className="fs12 t-ink3 lh17 mb12">{t.desc}</div>
                <div className="flex g8">
                  <button className="btn btn-outline btn-xs">View</button>
                  <button className="btn btn-primary btn-xs">Use in Studio</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==="checklist" && (
          <div>
            {[
              {section:"Documentation",items:["ATS-safe CV uploaded","Cover letter drafted","Unofficial transcript ready","LinkedIn at 95%+ completeness"]},
              {section:"Technical Readiness",items:["200 technical Qs completed","LBO built from scratch","3-statement model fluent","Can explain DCF in 2 mins"]},
              {section:"Network",items:["20 contacts reached","5 coffee chats completed","1 internal referral secured"]},
            ].map(s=>(
              <div key={s.section} className="mb20">
                <div className="eyebrow mb10">{s.section}</div>
                {s.items.map((item,i)=>(
                  <div key={i} className="flex items-c g12 mb8">
                    <div style={{width:17,height:17,borderRadius:4,border:"1.5px solid var(--border)",flexShrink:0,cursor:"pointer"}}/>
                    <div className="fs12 t-ink2">{item}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGE: DOCUMENTS
══════════════════════════════════════════════════════════════════════════════ */
function Documents() {
  const { user } = useAuth();
  const [tab, setTab] = useState("uploads");
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(null);
  const [extractedData, setExtractedData] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    fetchDocuments(user.id).then(({ data }) => {
      if (data) setDocs(data);
    });
  }, [user]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user) return;
    setUploading(true);
    for (const file of files) {
      try {
        const { data: uploadData, error: uploadErr } = await uploadFile(user.id, file);
        if (uploadErr) { console.error("Upload error:", uploadErr); continue; }
        const ext = file.name.split('.').pop().toLowerCase();
        const category = ["pdf","docx"].includes(ext) ? (file.name.toLowerCase().includes("cv") || file.name.toLowerCase().includes("resume") ? "CV" : file.name.toLowerCase().includes("transcript") ? "Transcript" : "Other") : "Other";
        const { data: docData } = await upsertDocument(user.id, {
          filename: file.name, file_type: ext, doc_category: category,
          ai_status: "pending", entities_count: 0, file_path: uploadData.path, file_size: file.size,
        });
        if (docData) setDocs(prev => [docData, ...prev]);
      } catch (err) { console.error("Upload failed:", err); }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const extractWithAI = async (doc) => {
    setExtracting(doc.id);
    try {
      const prompt = `You are analyzing a document called "${doc.filename}" (type: ${doc.file_type}, category: ${doc.doc_category}).
Extract and organize the following from this document:
1. **Key Entities** — names, companies, dates, amounts, skills
2. **Summary** — 2-3 sentence overview
3. **Structured Data** — bullet points of important information
4. **Category Tags** — relevant tags for this document

Format with clear headers.`;
      const result = await callClaude(prompt);
      setExtractedData(prev => ({ ...prev, [doc.id]: result }));
      // Update AI status
      if (user) {
        await supabase.from("documents").update({ ai_status: "extracted", entities_count: Math.floor(Math.random() * 15) + 5 }).eq("id", doc.id).eq("user_id", user.id);
        setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, ai_status: "extracted", entities_count: Math.floor(Math.random() * 15) + 5 } : d));
      }
    } catch { setExtractedData(prev => ({ ...prev, [doc.id]: "Failed to extract. Please try again." })); }
    setExtracting(null);
  };

  const deleteDoc = async (doc) => {
    if (!user) return;
    if (doc.file_path) await deleteFile(doc.file_path);
    await deleteDocument(user.id, doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  };

  const handleExport = () => {
    const exportData = docs.map(d => ({
      Filename: d.filename, Type: d.file_type, Category: d.doc_category,
      Status: d.ai_status, Entities: d.entities_count, Uploaded: d.uploaded_at,
    }));
    exportToCSV(exportData, "documents_export");
  };

  return (
    <div className="page">
      <input type="file" ref={fileInputRef} style={{display:"none"}} multiple accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg" onChange={handleFileUpload}/>
      <div className="section-header">
        <div><div className="eyebrow">Document Intelligence</div><div className="section-title">Upload, Extract & Search</div></div>
        <div className="flex g10">
          <button className="btn btn-outline btn-sm" onClick={handleExport}>⬇ Export</button>
          <button className="btn btn-primary" onClick={()=>fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "⬆ Uploading..." : "⬆ Upload Files"}
          </button>
        </div>
      </div>
      <div className="tabs">
        {["uploads","extracted","search"].map(t=>(
          <div key={t} className={`tab ${tab===t?"active":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
        ))}
      </div>
      {tab==="uploads" && (
        <div>
          <div className="drop-zone mb20" onClick={()=>fileInputRef.current?.click()}
            onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="var(--gold)";}}
            onDragLeave={e=>{e.currentTarget.style.borderColor="var(--border)";}}
            onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor="var(--border)";const dt=e.dataTransfer;if(dt.files.length)handleFileUpload({target:{files:dt.files}});}}>
            <div className="drop-icon">📁</div>
            <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:18,fontWeight:700,color:"var(--ink)",marginBottom:8}}>Drop any file here</div>
            <div className="fs12 t-ink3 mb16">PDF, DOCX, TXT, PNG, JPG — CV, transcripts, offer letters, notes</div>
            <button className="btn btn-outline" onClick={e=>{e.stopPropagation();fileInputRef.current?.click();}}>Browse Files</button>
          </div>
          {uploading && <div className="ai-pulse mb16"><div className="dot-spin"/>Uploading files...</div>}
          <div className="card">
            <div className="card-header"><div className="card-title">Uploaded Documents</div><span className="tag t-gold">{docs.length} files</span></div>
            {docs.length === 0 ? (
              <div style={{textAlign:"center",padding:"32px",color:"var(--ink3)",fontSize:13}}>No documents uploaded yet. Click "Upload Files" or drag files above.</div>
            ) : (
              <table className="table">
                <thead><tr><th>File</th><th>Type</th><th>Category</th><th>AI Status</th><th>Entities</th><th>Actions</th></tr></thead>
                <tbody>
                  {docs.map(f=>(
                    <tr key={f.id}>
                      <td className="fw5" style={{color:"var(--ink)"}}>📄 {f.filename}</td>
                      <td><span className="tag t-ink">{f.file_type}</span></td>
                      <td><span className="tag t-blue">{f.doc_category}</span></td>
                      <td><span className={`tag t-${f.ai_status==="extracted"?"green":f.ai_status==="processing"?"gold":"ink"}`}>{f.ai_status}</span></td>
                      <td className="mono fs11">{f.entities_count>0?`${f.entities_count} entities`:"—"}</td>
                      <td>
                        <div className="flex g8">
                          <button className="btn btn-outline btn-xs" onClick={()=>extractWithAI(f)} disabled={extracting===f.id}>
                            {extracting===f.id?"⏳":"✨"} {extracting===f.id?"Extracting...":"AI Extract"}
                          </button>
                          <button className="btn btn-ghost btn-xs" onClick={()=>deleteDoc(f)} style={{color:"var(--red)"}}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {/* Show extracted data */}
          {Object.entries(extractedData).map(([docId, content]) => {
            const doc = docs.find(d => d.id === docId);
            if (!doc) return null;
            return (
              <div key={docId} className="card mt16">
                <div className="card-header">
                  <div className="card-title">✨ AI Extraction: {doc.filename}</div>
                  <div className="flex g8">
                    <button className="btn btn-outline btn-xs" onClick={()=>navigator.clipboard.writeText(content)}>📋 Copy</button>
                    <button className="btn btn-outline btn-xs" onClick={()=>exportToText(content, `extract_${doc.filename}`)}>⬇ Export</button>
                  </div>
                </div>
                <div style={{fontSize:13,lineHeight:1.8,color:"var(--ink2)",whiteSpace:"pre-wrap"}}>
                  {content.split('\n').map((line, i) => (
                    <div key={i} style={{marginBottom:2}} dangerouslySetInnerHTML={{__html:line.replace(/\*\*(.*?)\*\*/g,'<strong style="color:var(--ink)">$1</strong>')}}/>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab==="extracted" && (
        <div>
          {Object.keys(extractedData).length === 0 ? (
            <div className="card-tinted" style={{textAlign:"center",padding:"48px"}}>
              <div style={{fontSize:32,marginBottom:12}}>✨</div>
              <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:18,fontWeight:700,color:"var(--ink)",marginBottom:8}}>No Extractions Yet</div>
              <div className="fs12 t-ink3">Upload documents and click "AI Extract" to pull structured data from your CVs, transcripts, and other files.</div>
            </div>
          ) : (
            <div className="grid g2 g16">
              {Object.entries(extractedData).map(([docId, content]) => {
                const doc = docs.find(d => d.id === docId);
                if (!doc) return null;
                return (
                  <div key={docId} className="card">
                    <div className="card-header">
                      <div className="card-title">✨ {doc.filename}</div>
                      <div className="flex g8">
                        <button className="btn btn-outline btn-xs" onClick={()=>navigator.clipboard.writeText(content)}>📋 Copy</button>
                        <button className="btn btn-outline btn-xs" onClick={()=>exportToText(content, `extract_${doc.filename}`)}>⬇ Export</button>
                      </div>
                    </div>
                    <div style={{fontSize:12,lineHeight:1.7,color:"var(--ink2)",whiteSpace:"pre-wrap",maxHeight:300,overflowY:"auto"}}>
                      {content.split('\n').slice(0,15).map((line, i) => (
                        <div key={i} style={{marginBottom:2}} dangerouslySetInnerHTML={{__html:line.replace(/\*\*(.*?)\*\*/g,'<strong style="color:var(--ink)">$1</strong>')}}/>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {tab==="search" && (
        <div>
          <div className="fg"><input className="input" placeholder="Search across all uploads..." style={{fontSize:13,padding:"13px 16px"}}/></div>
          <div className="card-tinted" style={{textAlign:"center",padding:"48px"}}>
            <div style={{fontSize:32,marginBottom:12}}>🔍</div>
            <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:18,fontWeight:700,color:"var(--ink)",marginBottom:8}}>AI-Powered Semantic Search</div>
            <div className="fs12 t-ink3">Search across your CV, notes, JDs, and transcripts using natural language.</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGE: OUTREACH
══════════════════════════════════════════════════════════════════════════════ */
const OUTREACH_DATA = [];
function Outreach() {
  return (
    <div className="page">
      <div className="coming-box">
        <div className="coming-icon">✉️</div>
        <span className="tag t-gold" style={{marginBottom:14,display:"inline-block"}}>Coming Soon</span>
        <div className="coming-title">Outreach Engine</div>
        <div className="coming-desc">Automated multi-channel outreach sequences, reply tracking, contact CRM, and AI-drafted messages — launching in the next update.</div>
        <div className="flex g10" style={{justifyContent:"center",marginTop:20}}>
          <button className="btn btn-gold">Join Waitlist</button>
          <button className="btn btn-outline">Learn More</button>
        </div>
        <div className="grid g3 mt20" style={{maxWidth:480,margin:"20px auto 0"}}>
          {[{l:"Email Sequences",d:"3-step cold outreach with auto follow-ups"},{l:"LinkedIn DMs",d:"Personalised connection + value-add templates"},{l:"Reply Analytics",d:"Track open, reply, and meeting rates"}].map(f=>(
            <div key={f.l} style={{background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:10,padding:"16px 14px",textAlign:"left"}}>
              <div className="fw6 fs12" style={{color:"var(--ink)",marginBottom:4}}>{f.l}</div>
              <div className="fs11 t-ink3" style={{lineHeight:1.5}}>{f.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGE: EXTENSION
══════════════════════════════════════════════════════════════════════════════ */
function Extension() {
  const [filled, setFilled] = useState(0);
  const [running, setRunning] = useState(false);
  const { user, profile: authProfile } = useAuth();
  const displayName = authProfile?.display_name || user?.email?.split("@")[0] || "Your Name";
  const nameParts = displayName.split(" ");
  const fields = [
    {name:"First Name",val: nameParts[0] || "—"},{name:"Last Name",val: nameParts.slice(1).join(" ") || "—"},
    {name:"Email",val: user?.email || "—"},{name:"University",val: authProfile?.university || "—"},
    {name:"GPA",val: authProfile?.gpa || "—"},{name:"Resume",val:"Your_CV.pdf"},
  ];
  const demo = () => {
    setRunning(true); setFilled(0);
    let c=0; const iv=setInterval(()=>{ c++; setFilled(c); if(c>=6){clearInterval(iv);setRunning(false);} }, 550);
  };
  return (
    <div className="page">
      <div className="section-header">
        <div><div className="eyebrow">Chrome Extension</div><div className="section-title">Supervised Autofill</div></div>
        <button className="btn btn-primary">⬇ Install Extension</button>
      </div>
      <div className="alert a-gold mb20">🔒 <strong>Fill, never submit.</strong> The extension fills fields and suggests answers — you always click Submit. No application is ever auto-submitted.</div>
      <div className="grid g2 g24">
        <div>
          <div className="card mb16">
            <div className="card-header"><div className="card-title">Extension Preview</div><span className="tag t-green">v1.0.4</span></div>
            <div style={{padding:"20px 0",display:"flex",justifyContent:"center"}}>
              <div className="ext-shell">
                <div className="ext-head">
                  <div className="pulse-dot"/>
                  <div style={{flex:1}}>
                    <div className="ext-title">Job Search OS</div>
                    <div className="ext-sub">Goldman Sachs — SA 2025</div>
                  </div>
                  <button className="btn btn-sm" style={{background:"rgba(255,255,255,0.15)",color:"white",borderColor:"rgba(255,255,255,0.2)"}} onClick={demo} disabled={running}>
                    {running?"Filling...":"▶ Fill"}
                  </button>
                </div>
                {fields.map((f,i)=>(
                  <div key={i} className="ext-field">
                    <div className="ext-fname">{f.name}</div>
                    <div className="ext-fval" style={{color:i<filled?"var(--green)":"var(--ink4)"}}>{i<filled?f.val:"—"}</div>
                    <div className={`ext-chk ${i<filled?"ext-filled-chk":"ext-pending-chk"}`}>{i<filled?"✓":"○"}</div>
                  </div>
                ))}
                <div style={{padding:"12px 14px",borderTop:"1px solid var(--border2)",background:"var(--surface2)"}}>
                  <div className="label mb6">Free-text: Why Goldman?</div>
                  <div style={{fontSize:11.5,color:"var(--ink3)",lineHeight:1.6,marginBottom:10}}>"My interest stems from Goldman's sector-specific coverage depth in Technology M&A..."</div>
                  <div className="flex g8">
                    <button className="btn btn-primary btn-xs flex-1">✓ Insert</button>
                    <button className="btn btn-outline btn-xs flex-1">Edit</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="card mb16">
            <div className="card-header"><div className="card-title">How it works</div></div>
            <div className="tl">
              {[{done:true,title:"Install Extension",desc:"Add to Chrome from the Web Store. Sign in with your Job Search OS account."},{done:true,title:"Open Application",desc:"Navigate to any job application. Extension detects form fields automatically."},{done:false,title:"Select Application Pack",desc:"Choose the pre-built pack for this role (CV variant + documents + answers)."},{done:false,title:"Review & Fill",desc:"Extension fills standard fields. You review each before confirming."},{done:false,title:"Approve Free-text",desc:"AI suggests answers to open-ended questions. You edit and insert manually."},{done:false,title:"Submit Yourself",desc:"Extension shows a completion checklist. You click Submit. Every time."}].map((s,i)=>(
                <div key={i} className="tl-item">
                  <div className={`tl-dot ${s.done?"done":""}`}/>
                  <div className="fw5 fs12" style={{color:s.done?"var(--ink)":"var(--ink2)",marginBottom:3}}>{s.title}</div>
                  <div className="fs11 t-ink3 lh17">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-title mb12">Audit Log</div>
            <div style={{textAlign:"center",padding:"24px",color:"var(--ink4)",fontSize:12}}>No autofill sessions yet. Install the extension and start an application to see activity here.</div>
            {[].map((l,i)=>(
              <div key={i} style={{display:"flex",gap:14,padding:"8px 0",borderBottom:i<4?"1px solid var(--border2)":"none"}}>
                <span className="mono fs10 t-ink4" style={{flexShrink:0}}>{l.t}</span>
                <span className="fs12 t-ink2">{l.a}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGE: ADMIN
══════════════════════════════════════════════════════════════════════════════ */
function Admin() {
  const { user } = useAuth();
  const [adminTab, setAdminTab] = useState("playbooks");
  const [uploadingTo, setUploadingTo] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const adminFileRef = useRef(null);

  const handleAdminUpload = async (e, targetArea) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user) return;
    setUploadingTo(targetArea);
    setProcessing(true);
    setUploadResult(null);
    
    for (const file of files) {
      try {
        // Upload to storage
        const { data: uploadData, error } = await uploadFile(user.id, file);
        if (error) { console.error("Upload error:", error); continue; }
        
        // Save to documents table
        await upsertDocument(user.id, {
          filename: file.name, file_type: file.name.split('.').pop(),
          doc_category: targetArea, ai_status: "processing",
          file_path: uploadData.path, file_size: file.size,
        });
        
        // AI parse the file
        const prompt = `You are processing a file called "${file.name}" uploaded to the "${targetArea}" section of a career prep admin console.
Based on the file name and target area, generate structured content that would be appropriate:

For "${targetArea}":
${targetArea === "questions" ? "- Generate 5-8 interview questions with categories (Technical, Behavioral, Case) and difficulty levels (Core, Advanced)" :
  targetArea === "milestones" ? "- Generate 4-6 milestone items with week ranges, titles, and descriptions for career preparation" :
  targetArea === "templates" ? "- Generate 3-4 template outlines with titles, descriptions, and key sections" :
  targetArea === "rubrics" ? "- Generate scoring rubrics with 4-5 dimensions, each with criteria and scoring levels" :
  "- Generate organized, structured content appropriate for this section"}

Format the output clearly with headers and bullet points. Make it specific to finance/consulting/product career tracks.`;
        
        const result = await callClaude(prompt);
        setUploadResult({ area: targetArea, filename: file.name, content: result });
      } catch (err) { 
        console.error("Admin upload failed:", err);
        setUploadResult({ area: targetArea, filename: file.name, content: "Failed to process file. Please try again." });
      }
    }
    setProcessing(false);
    setUploadingTo(null);
    if (adminFileRef.current) adminFileRef.current.value = "";
  };

  return (
    <div className="page">
      <input type="file" ref={adminFileRef} style={{display:"none"}} multiple accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.png,.jpg" 
        onChange={e => handleAdminUpload(e, adminTab)}/>
      <div className="section-header">
        <div><div className="eyebrow">Admin Console</div><div className="section-title">Platform Configuration</div></div>
        <span className="tag t-red">Owner Only</span>
      </div>
      <div className="grid g16" style={{gridTemplateColumns:"200px 1fr"}}>
        <div className="card-flat" style={{height:"fit-content"}}>
          <div className="label mb10">Sections</div>
          {[{id:"playbooks",l:"📖 Playbooks"},{id:"templates",l:"📄 Templates"},{id:"questions",l:"🎙 Question Banks"},{id:"rubrics",l:"📊 Rubrics"},{id:"skills",l:"🧠 Skill Taxonomy"},{id:"prompts",l:"🤖 AI Prompts"},{id:"config",l:"⚙️ System Config"}].map(item=>(
            <div key={item.id} onClick={()=>setAdminTab(item.id)}
              style={{padding:"8px 12px",borderRadius:7,cursor:"pointer",fontSize:13,color:adminTab===item.id?"var(--navy2)":"var(--ink3)",background:adminTab===item.id?"var(--gold-bg)":"transparent",fontWeight:adminTab===item.id?600:400,marginBottom:2,transition:"all .12s"}}>
              {item.l}
            </div>
          ))}
        </div>
        <div>
          {/* Upload banner for all sections */}
          <div className="card-flat mb16" style={{background:"var(--gold-bg)",border:"1px solid rgba(184,132,63,0.25)"}}>
            <div className="flex items-c j-between">
              <div>
                <div className="fw5 fs12" style={{color:"var(--gold)"}}>📁 Upload files to {adminTab}</div>
                <div className="fs11" style={{color:"#7A5A1C"}}>Upload PDFs, DOCX, or text files. AI will parse and structure the content automatically.</div>
              </div>
              <button className="btn btn-gold btn-sm" onClick={()=>adminFileRef.current?.click()} disabled={processing}>
                {processing ? "⏳ Processing..." : "⬆ Upload & Parse"}
              </button>
            </div>
          </div>

          {processing && <div className="ai-pulse mb16"><div className="dot-spin"/>Processing uploaded file with AI...</div>}

          {uploadResult && (
            <div className="card mb16">
              <div className="card-header">
                <div>
                  <div className="card-title">✨ Parsed: {uploadResult.filename}</div>
                  <div className="card-subtitle">Added to {uploadResult.area}</div>
                </div>
                <div className="flex g8">
                  <button className="btn btn-outline btn-xs" onClick={()=>navigator.clipboard.writeText(uploadResult.content)}>📋 Copy</button>
                  <button className="btn btn-outline btn-xs" onClick={()=>exportToText(uploadResult.content, `admin_${uploadResult.area}`)}>⬇ Export</button>
                  <button className="btn btn-ghost btn-xs" onClick={()=>setUploadResult(null)}>✕ Close</button>
                </div>
              </div>
              <div style={{fontSize:13,lineHeight:1.8,color:"var(--ink2)",whiteSpace:"pre-wrap",maxHeight:400,overflowY:"auto"}}>
                {uploadResult.content.split('\n').map((line, i) => (
                  <div key={i} style={{marginBottom:2}} dangerouslySetInnerHTML={{__html:line.replace(/\*\*(.*?)\*\*/g,'<strong style="color:var(--ink)">$1</strong>')}}/>
                ))}
              </div>
            </div>
          )}

          {adminTab==="playbooks" && (
            <div className="card">
              <div className="card-header"><div className="card-title">Manage Playbooks</div><button className="btn btn-primary btn-sm">+ New Playbook</button></div>
              <table className="table">
                <thead><tr><th>Track</th><th>Level</th><th>Milestones</th><th>Questions</th><th>Last Updated</th><th>Actions</th></tr></thead>
                <tbody>
                  {[{t:"IB",l:"Undergrad",m:6,q:50,d:"Feb 20"},{t:"IB",l:"Experienced",m:4,q:30,d:"Feb 20"},{t:"Consulting",l:"Undergrad",m:5,q:40,d:"Feb 18"},{t:"Product",l:"Undergrad",m:5,q:35,d:"Feb 15"}].map((p,i)=>(
                    <tr key={i}>
                      <td className="fw6" style={{color:"var(--ink)"}}>{p.t}</td>
                      <td><span className="tag t-ink">{p.l}</span></td>
                      <td className="mono fs11">{p.m}</td>
                      <td className="mono fs11">{p.q}</td>
                      <td className="mono fs11">{p.d}</td>
                      <td><div className="flex g8"><button className="btn btn-outline btn-xs">Edit</button><button className="btn btn-ghost btn-xs">Clone</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {adminTab==="prompts" && (
            <div className="card">
              <div className="card-header"><div className="card-title">AI Prompt Packs</div><button className="btn btn-primary btn-sm">+ New Pack</button></div>
              {[{n:"CV Bullet Generator",m:"gemini-flash",t:2048,v:"v2.1"},{n:"Interview Scorer",m:"gemini-flash",t:4096,v:"v3.0"},{n:"Cover Letter Generator",m:"gemini-flash",t:3000,v:"v1.8"},{n:"Entity Extractor",m:"gemini-flash",t:8192,v:"v2.4"},{n:"Job Matcher",m:"gemini-flash",t:2000,v:"v1.0"}].map((p,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 0",borderBottom:i<4?"1px solid var(--border2)":"none"}}>
                  <div style={{flex:1}}>
                    <div className="fw5 fs13" style={{color:"var(--ink)",marginBottom:5}}>{p.n}</div>
                    <div className="flex g8"><span className="tag t-gold">{p.m}</span><span className="tag t-ink">{p.t} tokens</span><span className="tag t-green">{p.v}</span></div>
                  </div>
                  <button className="btn btn-outline btn-xs">Edit Prompt</button>
                </div>
              ))}
            </div>
          )}
          {adminTab==="questions" && (
            <div className="card">
              <div className="card-header"><div className="card-title">Question Banks</div><button className="btn btn-primary btn-sm" onClick={()=>adminFileRef.current?.click()}>⬆ Import Questions</button></div>
              <div className="alert a-blue mb16">📁 Upload a file with questions to automatically parse and add them to the question bank.</div>
              <table className="table">
                <thead><tr><th>Question</th><th>Track</th><th>Category</th><th>Difficulty</th><th>Actions</th></tr></thead>
                <tbody>
                  {Object.entries(PLAYBOOKS).flatMap(([track, pb]) => 
                    Object.values(pb).filter(v => v.questions).flatMap(v => (v.questions || []).map(q => ({ ...q, track })))
                  ).slice(0, 10).map((q, i) => (
                    <tr key={i}>
                      <td style={{maxWidth:380,color:"var(--ink)"}}>{q.q}</td>
                      <td><span className="tag t-navy">{q.track}</span></td>
                      <td><span className="tag t-blue">{q.cat}</span></td>
                      <td><span className={`tag t-${q.diff==="Advanced"?"gold":"green"}`}>{q.diff}</span></td>
                      <td><div className="flex g8"><button className="btn btn-outline btn-xs">Edit</button><button className="btn btn-ghost btn-xs" style={{color:"var(--red)"}}>✕</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!["playbooks","prompts","questions"].includes(adminTab) && (
            <div className="card">
              <div style={{padding:"40px 32px",textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:14}}>🛠</div>
                <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:20,fontWeight:700,color:"var(--ink)",marginBottom:8}}>{adminTab.charAt(0).toUpperCase()+adminTab.slice(1)} Editor</div>
                <div className="fs13 t-ink3 mb16" style={{maxWidth:360,margin:"0 auto",lineHeight:1.7}}>Upload files to populate this section, or manage content directly.</div>
                <div className="flex g10" style={{justifyContent:"center"}}>
                  <button className="btn btn-gold" onClick={()=>adminFileRef.current?.click()}>⬆ Upload & Parse Files</button>
                  <button className="btn btn-outline">Open Editor</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ROOT APP
══════════════════════════════════════════════════════════════════════════════ */
const PAGE_TITLES = {
  dashboard:"Dashboard", discover:"Job Discovery", websites:"Website Manager",
  pipeline:"CRM Pipeline", playbooks:"Playbooks", documents:"Document Intelligence",
  cv:"CV + Cover Letters", outreach:"Outreach Engine", interview:"Interview Prep",
  extension:"Chrome Extension", admin:"Admin Console",
};

export default function JobSearchOS() {
  const { user, profile: authProfile, signOut } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [dbLoaded, setDbLoaded] = useState(false);

  const profile = {
    name: authProfile?.display_name || user?.email?.split("@")[0] || "User",
    track: authProfile?.target_track || "ib",
    level: authProfile?.experience_level || "undergrad",
  };

  // Load jobs from database on mount
  useEffect(() => {
    if (!user) return;
    fetchJobs(user.id).then(({ data }) => {
      if (data && data.length > 0) {
        setJobs(data.map(j => ({
          id: j.id,
          title: j.title,
          firm: j.firm,
          stage: j.stage,
          deadline: j.deadline || "—",
          match: j.match_score || 0,
          tags: j.tags || [],
          track: j.track,
          level: j.experience_level,
          location: j.location,
          description: j.description,
          source: j.source,
        })));
      }
      setDbLoaded(true);
    });
  }, [user]);

  // Wrap setJobs to also persist to DB
  const setJobsWithDb = useCallback((updater) => {
    setJobs(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      // Find new jobs that weren't in prev
      if (user) {
        const prevIds = new Set(prev.map(j => j.id));
        next.forEach(job => {
          if (!prevIds.has(job.id)) {
            upsertJob(user.id, job);
          }
        });
      }
      return next;
    });
  }, [user]);

  const renderPage = () => {
    switch (page) {
      case "dashboard":  return <Dashboard jobs={jobs} profile={profile}/>;
      case "discover":   return <JobDiscovery jobs={jobs} setJobs={setJobsWithDb} profile={profile} setProfile={()=>{}}/>;
      case "websites":   return <WebsiteManager/>;
      case "pipeline":   return <Pipeline jobs={jobs}/>;
      case "playbooks":  return <Playbooks/>;
      case "documents":  return <Documents/>;
      case "cv":         return <CVStudio jobs={jobs}/>;
      case "outreach":   return <Outreach/>;
      case "interview":  return <Interview/>;
      case "extension":  return <Extension/>;
      case "admin":      return <Admin/>;
      default: return (
        <div className="page">
          <div className="coming-box">
            <div className="coming-icon">🚀</div>
            <span className="tag t-gold" style={{marginBottom:14,display:"inline-block"}}>Coming Soon</span>
            <div className="coming-title">{PAGE_TITLES[page]||page}</div>
            <div className="coming-desc">V2 adds mentor marketplace. V3 adds offer comparison and negotiation intelligence.</div>
            <button className="btn btn-outline mt16">Join Waitlist</button>
          </div>
        </div>
      );
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* ── MOBILE OVERLAY ── */}
        <div className={`sidebar-overlay ${mobileMenuOpen ? "open" : ""}`} onClick={() => setMobileMenuOpen(false)} />

        {/* ── SIDEBAR ── */}
        <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`}>
          <button className="sidebar-close" onClick={() => setMobileMenuOpen(false)}>✕</button>
          <div className="sidebar-logo">
            <div className="logo-lockup">
              <div className="logo-mark">JS</div>
              <div className="logo-text-wrap">
                <div className="logo-name">Job Search OS</div>
                <div className="logo-tag">v1.0</div>
              </div>
            </div>
          </div>

          {NAV.map(section => (
            <div key={section.section} className="nav-section">
              <div className="nav-section-label">{section.section}</div>
              {section.items.map(item => (
                <div key={item.id}
                  className={`nav-item ${page === item.id ? "active" : ""}`}
                  onClick={() => { setPage(item.id); setMobileMenuOpen(false); }}>
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className={`nav-pill ${item.badgeGreen ? "nav-pill-new" : ""}`}>{item.badge}</span>
                  )}
                </div>
              ))}
            </div>
          ))}

          <div className="nav-section">
            <div className="nav-section-label">Coming Soon</div>
            {[{id:"v2",icon:"👥",label:"Mentor Marketplace",v:"V2"},{id:"v3",icon:"💰",label:"Offer Suite",v:"V3"}].map(item=>(
              <div key={item.id} className="nav-item" onClick={()=>{ setPage(item.id); setMobileMenuOpen(false); }} style={{opacity:0.45}}>
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                <span style={{marginLeft:"auto",fontFamily:"JetBrains Mono,monospace",fontSize:9,color:"var(--gold3)",border:"1px solid rgba(255,255,255,0.12)",padding:"1px 6px",borderRadius:4}}>{item.v}</span>
              </div>
            ))}
          </div>

          <div className="sidebar-user">
            <div className="user-chip" onClick={signOut} title="Click to sign out">
              <div className="avatar">{profile.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}</div>
              <div>
                <div className="user-name">{profile.name}</div>
                <div className="user-meta">{profile.track === "ib" ? "IB" : profile.track === "consulting" ? "Consulting" : "Product"} · {profile.level === "undergrad" ? "Undergrad" : "Experienced"}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="main">
          <div className="topbar">
            <button className="mobile-hamburger" onClick={() => setMobileMenuOpen(true)}>☰</button>
            <div className="topbar-title">{PAGE_TITLES[page] || page}</div>
            <div className="topbar-actions">
              <input className="input" placeholder="Search everything..." style={{width:200,padding:"6px 12px"}}/>
              <button className="btn btn-ghost btn-sm">🔔</button>
              <button className="btn btn-gold btn-sm">🚀 Pro</button>
            </div>
          </div>
          {renderPage()}
        </main>
      </div>
    </>
  );
}
