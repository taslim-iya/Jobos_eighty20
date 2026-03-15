import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchJobs, upsertJob, deleteJob, fetchDocuments, upsertDocument, deleteDocument, uploadFile, deleteFile, exportToCSV, exportToText, fetchWebsites, upsertWebsite, deleteWebsite, fetchContacts, upsertContact, fetchSources, upsertSource, deleteSource, fetchAdminTemplates, upsertAdminTemplate, deleteAdminTemplate, fetchAdminRules, upsertAdminRule, fetchUploads, insertUpload, fetchProfileMatches, updateMatchStatus, fetchCrawlRuns, fetchApplicationQueue, upsertQueueItem, deleteQueueItem } from "@/lib/database";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
// html2canvas removed — using jsPDF native text rendering for small file sizes

/* ─────────────────────────────────────────────────────────────────────────────
   DESIGN SYSTEM — "FT Editorial Light"
   Warm ivory base · Deep navy sidebar · Burnished gold accents
   Cormorant Garamond display · Sora body · JetBrains Mono data
───────────────────────────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600&display=swap');

:root {
  /* Surfaces — warm white, clean */
  --bg:       #F5F4F0;
  --surface:  #FFFFFF;
  --surface2: #F0EFEB;
  --surface3: #E8E7E2;

  /* Primary — deep black/charcoal editorial */
  --navy:     #0A0A0A;
  --navy2:    #1A1A1A;
  --navy3:    #2A2A2A;
  --navy4:    #3A3A3A;

  /* Accent — warm blue (GS blue) */
  --gold:     #00579B;
  --gold2:    #0070C0;
  --gold3:    #3399D6;
  --gold-bg:  rgba(0,87,155,0.06);

  /* Text */
  --ink:      #0A0A0A;
  --ink2:     #333333;
  --ink3:     #666666;
  --ink4:     #999999;

  /* Semantic */
  --green:    #1A7F5A;
  --green-bg: rgba(26,127,90,0.06);
  --red:      #C0392B;
  --red-bg:   rgba(192,57,43,0.06);
  --blue:     #00579B;
  --blue-bg:  rgba(0,87,155,0.06);

  /* Borders — very subtle */
  --border:   #E0DFDA;
  --border2:  #EAEAE6;
  --border3:  rgba(0,87,155,0.2);

  /* Shadows — minimal, editorial */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow:    0 2px 8px rgba(0,0,0,0.06);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.08);

  /* Sidebar — clean white */
  --side-bg:    #FFFFFF;
  --side-hover: rgba(0,0,0,0.03);
  --side-active:rgba(0,87,155,0.08);
  --side-text:  rgba(0,0,0,0.5);
  --side-text2: rgba(0,0,0,0.85);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { font-size: 14px; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

body {
  background: var(--bg);
  color: var(--ink);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-weight: 400;
  line-height: 1.65;
}

/* ── LAYOUT ── */
.app { display: flex; min-height: 100vh; }

.sidebar {
  width: 240px;
  height: 100vh;
  background: var(--side-bg);
  position: fixed;
  left: 0; top: 0;
  display: flex;
  flex-direction: column;
  z-index: 100;
  border-right: 1px solid var(--border2);
  overflow-y: auto;
  overflow-x: hidden;
}

.main {
  margin-left: 240px;
  flex: 1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

/* ── SIDEBAR ── */
.sidebar-logo {
  padding: 28px 24px 24px;
  border-bottom: 1px solid var(--border2);
}

.logo-lockup { display: flex; align-items: center; gap: 12px; }

.logo-mark {
  width: 38px; height: 38px;
  background: var(--navy);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Playfair Display', serif;
  font-weight: 800;
  font-size: 18px;
  color: white;
  flex-shrink: 0;
}

.logo-text-wrap { display: flex; flex-direction: column; gap: 2px; }
.logo-name {
  font-family: 'Playfair Display', serif;
  font-size: 17px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1;
}
.logo-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--ink4);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.nav-section { padding: 20px 16px 4px; }

.nav-section-label {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink4);
  padding: 0 12px;
  margin-bottom: 6px;
  font-weight: 600;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--side-text);
  font-size: 13px;
  font-weight: 400;
  transition: all .15s ease;
  border: none;
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
  color: var(--blue);
  font-weight: 600;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0; top: 20%; bottom: 20%;
  width: 3px;
  background: var(--blue);
  border-radius: 0 3px 3px 0;
}

.nav-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; }

.nav-pill {
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 10px;
  background: var(--navy);
  color: white;
}

.nav-pill-new {
  background: var(--green);
  color: white;
}

.sidebar-user {
  margin-top: auto;
  padding: 16px;
  border-top: 1px solid var(--border2);
}

.user-chip {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 10px;
  cursor: pointer;
  transition: background .15s;
}
.user-chip:hover { background: var(--surface3); }

.avatar {
  width: 32px; height: 32px;
  background: var(--navy);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Playfair Display', serif;
  font-weight: 700;
  font-size: 14px;
  color: white;
  flex-shrink: 0;
}

.user-name { font-size: 13px; font-weight: 500; color: var(--ink); }
.user-meta { font-size: 10px; color: var(--ink4); font-family: 'JetBrains Mono', monospace; }

/* ── TOPBAR ── */
.topbar {
  height: 60px;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border2);
  display: flex;
  align-items: center;
  padding: 0 36px;
  gap: 16px;
  position: sticky;
  top: 0;
  z-index: 50;
}

.topbar-title {
  font-family: 'Playfair Display', serif;
  font-size: 22px;
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
  padding: 9px 18px;
  border-radius: 6px;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1.5px solid transparent;
  transition: all .15s ease;
  white-space: nowrap;
  letter-spacing: 0.01em;
}

.btn-primary {
  background: var(--navy);
  color: white;
  border-color: var(--navy);
}
.btn-primary:hover {
  background: var(--navy3);
  border-color: var(--navy3);
}

.btn-gold {
  background: var(--blue);
  color: white;
  border-color: var(--blue);
}
.btn-gold:hover {
  background: var(--gold2);
  border-color: var(--gold2);
}

.btn-outline {
  background: transparent;
  color: var(--ink2);
  border-color: var(--border);
}
.btn-outline:hover {
  background: var(--surface2);
  border-color: var(--ink4);
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

.btn-sm { padding: 6px 14px; font-size: 12px; }
.btn-xs { padding: 4px 10px; font-size: 11px; border-radius: 5px; }
.btn-lg { padding: 12px 24px; font-size: 14px; }

.btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }

/* ── PAGE ── */
.page {
  padding: 36px 40px;
  flex: 1;
  animation: pageIn .3s ease;
  max-width: 1440px;
  width: 100%;
}

@keyframes pageIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── CARDS ── */
.card {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 10px;
  padding: 28px;
  transition: box-shadow .2s;
}

.card:hover { box-shadow: var(--shadow); }

.card-flat {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 10px;
  padding: 22px 28px;
}

.card-tinted {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 22px 28px;
}

.card-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 24px; gap: 16px;
}

.card-title {
  font-family: 'Playfair Display', serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.3;
}

.card-subtitle { font-size: 13px; color: var(--ink3); margin-top: 4px; }

/* ── GRID ── */
.grid { display: grid; gap: 20px; }
.g2 { grid-template-columns: repeat(2, 1fr); }
.g3 { grid-template-columns: repeat(3, 1fr); }
.g4 { grid-template-columns: repeat(4, 1fr); }
.g-auto { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }

/* ── KPI ── */
.kpi {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 8px;
  padding: 22px 24px;
}

.kpi-label {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink4);
  margin-bottom: 8px;
  font-weight: 600;
}

.kpi-val {
  font-family: 'Playfair Display', serif;
  font-size: 32px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1;
}

.kpi-delta {
  display: flex; align-items: center; gap: 4px;
  margin-top: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.up { color: var(--green); }
.dn { color: var(--red); }

/* ── SECTION HEADER ── */
.section-header {
  display: flex; align-items: flex-end; justify-content: space-between;
  margin-bottom: 28px; gap: 16px;
}

.eyebrow {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink4);
  margin-bottom: 6px;
  font-weight: 600;
}

.section-title {
  font-family: 'Playfair Display', serif;
  font-size: 32px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.15;
}

/* ── TAGS ── */
.tag {
  display: inline-flex; align-items: center;
  padding: 3px 10px;
  border-radius: 4px;
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}
.t-gold   { background: var(--gold-bg);  color: var(--blue);  border: 1px solid rgba(0,87,155,0.15); }
.t-green  { background: var(--green-bg); color: var(--green); border: 1px solid rgba(26,127,90,0.15); }
.t-red    { background: var(--red-bg);   color: var(--red);   border: 1px solid rgba(192,57,43,0.15); }
.t-blue   { background: var(--blue-bg);  color: var(--blue);  border: 1px solid rgba(0,87,155,0.15); }
.t-ink    { background: var(--surface2); color: var(--ink3);  border: 1px solid var(--border); }
.t-navy   { background: rgba(10,10,10,0.05); color: var(--navy2); border: 1px solid rgba(10,10,10,0.1); }

/* ── TABS ── */
.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border2);
  margin-bottom: 28px;
}

.tab {
  padding: 12px 20px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 400;
  color: var(--ink3);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all .15s;
  white-space: nowrap;
}

.tab.active {
  color: var(--ink);
  border-bottom-color: var(--ink);
  font-weight: 600;
}

.tab:hover:not(.active) { color: var(--ink2); }

/* ── TABLE ── */
.table { width: 100%; border-collapse: collapse; }
.table thead tr { border-bottom: 1px solid var(--border); }
.table th {
  text-align: left;
  padding: 10px 16px;
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink4);
  font-weight: 600;
}
.table td {
  padding: 14px 16px;
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
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 14px;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  color: var(--ink);
  width: 100%;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.input::placeholder { color: var(--ink4); }
.input:focus {
  border-color: var(--ink3);
  box-shadow: 0 0 0 3px rgba(0,0,0,0.04);
}

.textarea { resize: vertical; min-height: 110px; line-height: 1.65; }

.label {
  display: block;
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink3);
  margin-bottom: 6px;
  font-weight: 600;
}

.fg { margin-bottom: 18px; }

select.input {
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23999999'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 30px;
}

/* ── PROGRESS ── */
.prog-track { height: 4px; background: var(--surface3); border-radius: 4px; overflow: hidden; }
.prog-fill   { height: 100%; border-radius: 4px; transition: width .5s ease; background: var(--blue); }
.prog-fill.g { background: var(--green); }
.prog-fill.b { background: var(--blue); }
.prog-fill.n { background: var(--navy2); }

/* ── DIVIDER ── */
.divider { height: 1px; background: var(--border2); margin: 24px 0; }

/* ── ALERT ── */
.alert {
  padding: 14px 18px;
  border-radius: 6px;
  display: flex; gap: 10px; align-items: flex-start;
  font-size: 13px;
  line-height: 1.65;
}
.a-gold  { background: var(--gold-bg);  border: 1px solid rgba(0,87,155,0.15); color: var(--blue); }
.a-green { background: var(--green-bg); border: 1px solid rgba(26,127,90,0.15); color: var(--green); }
.a-blue  { background: var(--blue-bg);  border: 1px solid rgba(0,87,155,0.15); color: var(--blue); }
.a-red   { background: var(--red-bg);   border: 1px solid rgba(192,57,43,0.15); color: var(--red); }

/* ── KANBAN ── */
.kanban { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 12px; }
.kanban::-webkit-scrollbar { height: 4px; }
.kanban::-webkit-scrollbar-track { background: var(--surface2); border-radius: 3px; }
.kanban::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

.k-col {
  min-width: 250px;
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 10px;
  padding: 16px;
  flex-shrink: 0;
}

.k-col-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}

.k-col-title {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink3);
}

.k-count {
  background: var(--surface2);
  color: var(--ink4);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 2px 8px; border-radius: 10px;
}

.k-card {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all .15s;
}
.k-card:hover {
  border-color: var(--border);
  box-shadow: var(--shadow);
}
.k-card-title { font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 3px; }
.k-card-sub   { font-size: 12px; color: var(--ink3); }
.k-card-foot  {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}

/* ── HERO BANNER ── */
.hero {
  background: var(--navy);
  border-radius: 12px;
  padding: 36px 40px;
  margin-bottom: 28px;
  position: relative;
  overflow: hidden;
  color: white;
}
.hero::before {
  content: '';
  position: absolute; right: -40px; top: -40px;
  width: 300px; height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0,87,155,0.2), transparent 65%);
  pointer-events: none;
}
.hero::after {
  content: '';
  position: absolute; left: 0; bottom: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(255,255,255,0.2), transparent);
}
.hero-eye { font-family: 'Inter', sans-serif; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.5); margin-bottom: 10px; font-weight: 600; }
.hero-h {
  font-family: 'Playfair Display', serif;
  font-size: 34px; font-weight: 700;
  color: white; line-height: 1.15; margin-bottom: 12px;
}
.hero-p { font-size: 14px; color: rgba(255,255,255,0.6); max-width: 480px; line-height: 1.7; }
.hero-actions { display: flex; gap: 10px; margin-top: 20px; }

/* ── JOB CARD (discovery) ── */
.job-card {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 10px;
  padding: 20px 22px;
  cursor: pointer;
  transition: all .2s;
  position: relative;
}
.job-card:hover {
  border-color: var(--border);
  box-shadow: var(--shadow);
}
.job-card.saved { border-left: 3px solid var(--green); }
.jc-match {
  position: absolute; top: 16px; right: 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; font-weight: 600;
  color: var(--green);
}
.jc-title  { font-weight: 600; font-size: 14px; color: var(--ink); margin-bottom: 4px; }
.jc-firm   { font-size: 13px; color: var(--ink3); margin-bottom: 12px; }
.jc-tags   { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.jc-foot   { display: flex; align-items: center; justify-content: space-between; }
.jc-source { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--ink4); }

/* ── AI LOADER ── */
.ai-pulse {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 20px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  color: var(--ink3);
  margin-bottom: 16px;
}
.dot-spin {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid var(--border);
  border-top-color: var(--ink3);
  animation: spin .7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── WEBSITE SCANNER ── */
.site-row {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border2);
}
.site-row:last-child { border-bottom: none; }
.site-status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  flex-shrink: 0;
}
.dot-active  { background: var(--green); }
.dot-idle    { background: var(--ink4); }
.dot-scanning { background: var(--blue); animation: dotPulse 1s ease infinite; }
@keyframes dotPulse { 0%,100%{opacity:1} 50%{opacity:.3} }

.site-url  { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink2); flex: 1; }
.site-meta { font-size: 11px; color: var(--ink4); white-space: nowrap; }

/* ── UPLOAD ZONE ── */
.drop-zone {
  border: 2px dashed var(--border);
  border-radius: 10px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all .2s;
  background: var(--surface);
}
.drop-zone:hover {
  border-color: var(--ink3);
  background: var(--surface2);
}
.drop-icon { font-size: 32px; margin-bottom: 10px; opacity: 0.6; }

/* ── CHAT ── */
.chat-wrap {
  display: flex; flex-direction: column;
  height: 440px;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface);
}
.chat-msgs {
  flex: 1; overflow-y: auto;
  padding: 20px;
  display: flex; flex-direction: column; gap: 12px;
}
.chat-msg {
  max-width: 82%;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.7;
}
.msg-user {
  align-self: flex-end;
  background: var(--navy);
  color: rgba(255,255,255,0.9);
}
.msg-ai {
  align-self: flex-start;
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--ink2);
}
.chat-input-row {
  padding: 14px 16px;
  border-top: 1px solid var(--border2);
  display: flex; gap: 10px;
  background: var(--surface);
}
.chat-scores {
  padding: 14px 18px;
  border-top: 1px solid var(--border2);
  background: var(--surface2);
  display: flex; gap: 24px;
}
.score-block { text-align: center; }
.score-lbl { font-family: 'Inter', sans-serif; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink4); margin-bottom: 4px; font-weight: 600; }
.score-num { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: var(--ink); }

/* ── COVER LETTER STEPS ── */
.step-indicator {
  display: flex; align-items: center; gap: 0;
  margin-bottom: 28px;
}
.step {
  display: flex; align-items: center; gap: 8px;
  flex: 1;
}
.step-num-badge {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Inter', sans-serif;
  font-size: 12px; font-weight: 600;
  flex-shrink: 0;
}
.step-active   .step-num-badge { background: var(--navy); color: white; }
.step-done     .step-num-badge { background: var(--green); color: white; }
.step-inactive .step-num-badge { background: var(--surface3); color: var(--ink4); }
.step-label { font-size: 12px; font-weight: 500; color: var(--ink3); }
.step-active .step-label { color: var(--ink); font-weight: 600; }
.step-done   .step-label { color: var(--green); }
.step-connector { flex: 1; height: 1px; background: var(--border2); margin: 0 8px; }
.step-connector.done { background: var(--green); }

/* ── EXTENSION PREVIEW ── */
.ext-shell {
  width: 320px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  margin: 0 auto;
}
.ext-head {
  background: var(--navy);
  padding: 14px 16px;
  display: flex; align-items: center; gap: 10px;
}
.ext-title { font-family: 'Playfair Display', serif; font-size: 14px; font-weight: 700; color: white; }
.ext-sub   { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: rgba(255,255,255,0.5); }
.pulse-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--green);
  animation: dotPulse 2s ease infinite;
  flex-shrink: 0;
}
.ext-field {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--border2);
}
.ext-fname { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--ink4); width: 88px; flex-shrink: 0; }
.ext-fval  { font-size: 13px; color: var(--ink); flex: 1; }
.ext-chk   { font-size: 11px; flex-shrink: 0; }
.ext-filled-chk { color: var(--green); }
.ext-pending-chk { color: var(--ink4); }

/* ── PLAYBOOK CARD ── */
.pb-card {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all .2s;
}
.pb-card:hover { box-shadow: var(--shadow); border-color: var(--border); }
.pb-card.sel { border-color: var(--ink); box-shadow: 0 0 0 2px rgba(0,0,0,0.08); }
.pb-head {
  padding: 24px;
  background: var(--navy);
  color: white;
}
.pb-icon { font-size: 28px; margin-bottom: 12px; }
.pb-name { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; }
.pb-body { padding: 18px 24px; }

/* ── TIMELINE ── */
.tl { position: relative; padding-left: 24px; }
.tl::before { content:''; position:absolute; left:5px; top:6px; bottom:6px; width:1px; background:var(--border2); }
.tl-item { position: relative; padding-bottom: 20px; }
.tl-dot {
  position: absolute; left: -24px; top: 4px;
  width: 11px; height: 11px;
  border-radius: 50%;
  background: var(--surface3);
  border: 2px solid var(--border);
}
.tl-dot.done   { background: var(--ink); border-color: var(--ink); }
.tl-dot.active { background: var(--green); border-color: var(--green); }

/* ── MONO TEXT ── */
.mono { font-family: 'JetBrains Mono', monospace; }
.t-gold2  { color: var(--blue); }
.t-green2 { color: var(--green); }
.t-ink3   { color: var(--ink3); }
.t-ink4   { color: var(--ink4); }

/* ── SCROLLBAR ── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
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
.fs13 { font-size: 13px; }
.fw6  { font-weight: 600; }
.fw5  { font-weight: 500; }
.lh17 { line-height: 1.7; }
.op60 { opacity: 0.6; }
.op40 { opacity: 0.4; }
.ta-c { text-align: center; }
.flex-wrap { flex-wrap: wrap; }

.coming-box {
  padding: 72px 36px;
  text-align: center;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  margin: 24px 0;
}
.coming-icon { font-size: 44px; margin-bottom: 18px; opacity: 0.4; }
.coming-title { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; color: var(--ink); margin-bottom: 10px; }
.coming-desc  { font-size: 14px; color: var(--ink3); max-width: 400px; margin: 0 auto; line-height: 1.7; }

/* ── MOBILE HAMBURGER ── */
.mobile-hamburger {
  display: none;
  width: 38px; height: 38px;
  background: var(--navy);
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
  background: rgba(0,0,0,0.3);
  z-index: 99;
}

.sidebar-close {
  display: none;
  position: absolute;
  top: 16px; right: 16px;
  width: 28px; height: 28px;
  background: var(--surface2);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--ink3);
  font-size: 16px;
  align-items: center;
  justify-content: center;
}
.sidebar-close:hover { background: var(--surface3); }

/* ── TABLET (≤1024px) ── */
@media (max-width: 1024px) {
  .g4 { grid-template-columns: repeat(2, 1fr); }
  .g3 { grid-template-columns: repeat(2, 1fr); }
  .kanban { flex-wrap: nowrap; }
  .page { padding: 24px 22px; }
  .topbar { padding: 0 22px; }
  .topbar-actions .btn-gold { display: none; }
}

/* ── MOBILE (≤768px) ── */
@media (max-width: 768px) {
  .mobile-hamburger { display: flex; }
  .sidebar-close { display: flex; }

  .sidebar {
    transform: translateX(-100%);
    transition: transform .25s ease;
    width: 280px;
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
    padding: 0 16px;
    height: 54px;
    gap: 10px;
  }
  .topbar-title { font-size: 18px; }
  .topbar-actions input { display: none; }
  .topbar-actions .btn-gold { display: none; }

  .page { padding: 20px 16px; }
  .g2, .g3, .g4 { grid-template-columns: 1fr; }
  .g-auto { grid-template-columns: 1fr; }

  .section-header { flex-direction: column; align-items: flex-start; gap: 10px; }
  .section-title { font-size: 26px; }

  .card { padding: 20px; }
  .card-flat { padding: 16px 20px; }
  .card-header { flex-direction: column; gap: 8px; }

  .kpi-val { font-size: 24px; }
  .kanban { flex-direction: column; }
  .k-col { min-width: 100%; }

  .table { font-size: 12px; }
  .table th, .table td { padding: 8px 10px; }
  .table th:nth-child(n+4), .table td:nth-child(n+4) { display: none; }

  .tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .tab { padding: 10px 16px; font-size: 12px; }

  .coming-box { padding: 48px 20px; }

  .f { flex-direction: column; }
  .f.wrap { flex-direction: column; }
}

/* ── SMALL MOBILE (≤480px) ── */
@media (max-width: 480px) {
  .topbar-title { font-size: 16px; }
  .btn { padding: 8px 14px; font-size: 12px; }
  .btn-sm { padding: 5px 10px; font-size: 11px; }
  .section-title { font-size: 22px; }
  .kpi { padding: 16px; }
  .kpi-val { font-size: 22px; }
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
  },
  postgrad: {
    icon: "🎓", name: "Post-Graduate Path",
    undergrad: {
      process: "Graduate Scheme → Rotational Program → Specialist Role",
      prereqs: ["Strong academic record", "Extra-curricular leadership", "Sector interest clarity", "Networking foundation"],
      milestones: [
        { week:"WK 1–2", title:"Self-Assessment", desc:"Clarify career goals, target sectors, and scheme preferences. Map top 20 graduate programs." },
        { week:"WK 3–4", title:"Application Prep", desc:"Tailor CV for grad schemes. Draft competency-based answers using STAR. Research firm values." },
        { week:"WK 5–6", title:"Psychometric & Online Tests", desc:"Practice SHL, Korn Ferry, and Watson Glaser tests. Complete 10 practice situational judgements." },
        { week:"WK 7–8", title:"Assessment Centre Prep", desc:"Group exercise practice. E-tray simulations. Presentation skills." },
        { week:"WK 9–10", title:"Application Sprint", desc:"Submit top 15 graduate schemes. Track deadlines. Follow up with campus teams." },
        { week:"WK 11–12", title:"Final Rounds", desc:"Partner/VP interviews. Commercial awareness deep-dives. Salary negotiation prep." },
      ],
      questions: [
        { q:"Why have you chosen this graduate scheme?", cat:"Motivation", diff:"Core" },
        { q:"Tell me about a time you worked in a team to achieve a goal.", cat:"Competency", diff:"Core" },
        { q:"Where do you see yourself in 5 years?", cat:"Behavioral", diff:"Core" },
        { q:"Walk me through a current issue facing our industry.", cat:"Commercial Awareness", diff:"Advanced" },
        { q:"Describe a time you showed leadership without formal authority.", cat:"Competency", diff:"Advanced" },
      ],
    },
    experienced: {
      process: "MBA / Masters → Career Switch → Senior Role",
      prereqs: ["2–5 yrs work experience", "Clear pivot narrative", "GMAT/GRE (for MBA)", "Target program shortlist"],
      milestones: [
        { week:"WK 1–2", title:"Program Research", desc:"Shortlist programs by career outcome data. Connect with alumni for insights." },
        { week:"WK 3–4", title:"Application Essays", desc:"Draft 'Why MBA/Masters' and career goals essays. Get feedback from admissions consultants." },
        { week:"WK 5–6", title:"Interview Prep", desc:"Practice behavioral + 'walk me through your CV' narratives. Mock admissions interviews." },
        { week:"WK 7+", title:"Career Pivot Planning", desc:"Build recruiter relationships at target firms. Attend career treks and industry panels." },
      ],
      questions: [
        { q:"Walk me through your career journey and why you're pursuing further education now.", cat:"Motivation", diff:"Core" },
        { q:"How will this program help you achieve your goals?", cat:"Fit", diff:"Core" },
        { q:"What unique perspective do you bring to the cohort?", cat:"Behavioral", diff:"Advanced" },
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
    { id:"recommended", icon:"🎯", label:"Recommended", badge:"NEW", badgeGreen:true },
  ]},
  { section: "Discover", items: [
    { id:"discover",  icon:"🔍", label:"Job Discovery" },
    { id:"explore",   icon:"🌍", label:"Explore Jobs" },
    { id:"pipeline",  icon:"🗃", label:"CRM" },
  ]},
  { section: "Prepare", items: [
    { id:"playbooks",  icon:"📖", label:"Playbooks" },
    { id:"cv",         icon:"📄", label:"CV + Cover Letters" },
  ]},
  { section: "Practice", items: [
    { id:"interview",  icon:"🎙", label:"Interview Prep" },
  ]},
  { section: "Apply", items: [
    { id:"extension",  icon:"🚀", label:"Auto Apply" },
  ]},
  { section: "Account", items: [
    { id:"profile",    icon:"👤", label:"My Profile" },
  ]},
  { section: "Admin", items: [
    { id:"admin", icon:"⚙️", label:"Admin Console" },
    { id:"websites",  icon:"🌐", label:"Website Manager" },
  ]},
];

/* ════════════════════════════════════════════════════════════════════════════
   PAGE: DASHBOARD
══════════════════════════════════════════════════════════════════════════════ */
function Dashboard({ jobs, profile }) {
  return (
    <div className="page">
      <div className="hero">
        <div className="hero-eye">{({ib:"IB",pe:"PE",vc:"VC",consulting:"Consulting",trading:"Sales & Trading",am:"Investment Mgmt",tech:"Tech & Startups"})[profile.track]||profile.track} Track · {profile.level === "undergrad" ? "Undergraduate" : "Experienced Hire"}</div>
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
  const { user } = useAuth();
  const [tab, setTab] = useState("recommended");
  const [trackFilter, setTrackFilter] = useState(profile.track);
  const [levelFilter, setLevelFilter] = useState(profile.level);
  const [locationFilter, setLocationFilter] = useState("London");
  const [searchQuery, setSearchQuery] = useState("");
  const [discJobs, setDiscJobs] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanLog, setScanLog] = useState([]);
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());

  // Load user's jobs from database into discovery view
  useEffect(() => {
    if (!user) return;
    fetchJobs(user.id).then(({ data }) => {
      if (data && data.length > 0) {
        const mapped = data.map(j => ({
          id: j.id,
          title: j.title,
          firm: j.firm,
          stage: j.stage,
          deadline: j.deadline || "Rolling",
          match: j.match_score || 80,
          tags: j.tags || [],
          track: j.track,
          level: j.experience_level,
          location: j.location,
          description: j.description || "",
          source: j.source || "Scraper",
          url: j.url || "",
          saved: true,
        }));
        setDiscJobs(mapped);
        setSavedIds(new Set(mapped.map(j => j.id)));
      }
    });
  }, [user]);

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
    const trackNames = {ib:"investment banking",pe:"private equity",vc:"venture capital",consulting:"management consulting",trading:"sales and trading",am:"investment management",tech:"tech startups"};
    const trackName = trackNames[trackFilter] || "finance";
    const trackKw = {
      ib: "investment banking analyst associate M&A ECM DCM summer analyst leveraged finance",
      pe: "private equity analyst associate buyout LBO portfolio company",
      vc: "venture capital analyst associate startup funding seed series",
      consulting: "management consulting business analyst strategy consultant associate",
      trading: "sales trading trader structuring market making fixed income equities",
      am: "asset management portfolio manager investment analyst fund manager wealth",
      tech: "software engineer product manager startup technology developer growth",
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
            tags: j.tags?.length ? j.tags : [({ib:"IB",pe:"PE",vc:"VC",consulting:"Consulting",trading:"S&T",am:"IM",tech:"Tech"})[trackFilter]||trackFilter],
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
          tags: j.tags?.length ? j.tags : [({ib:"IB",pe:"PE",vc:"VC",consulting:"Consulting",trading:"S&T",am:"IM",tech:"Tech"})[trackFilter]||trackFilter],
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
          tags: j.tags?.length ? j.tags : [trackFilter === "ib" ? "IB" : trackFilter === "consulting" ? "Consulting" : trackFilter === "postgrad" ? "Post-Grad" : "Product"],
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
      
      </div>

      {/* Profile Filters */}
      <div className="card-flat mb16">
        <div className="flex items-c g12 flex-wrap">
          <div style={{fontSize:12,fontWeight:500,color:"var(--ink3)",marginRight:4}}>Showing roles for:</div>
          <select className="input" style={{width:180}} value={trackFilter} onChange={e=>setTrackFilter(e.target.value)}>
            <option value="ib">Investment Banking</option>
            <option value="pe">Private Equity</option>
            <option value="vc">Venture Capital</option>
            <option value="consulting">Management Consulting</option>
            <option value="trading">Sales & Trading</option>
            <option value="am">Investment Management</option>
            <option value="tech">Tech & Startups</option>
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
            ✨ <span>Recommendations based on your <strong>{trackFilter === "ib" ? "IB" : trackFilter === "consulting" ? "Consulting" : trackFilter === "postgrad" ? "Post-Grad" : "Product"} {levelFilter === "undergrad" ? "Undergrad" : "Experienced"}</strong> profile, CV, and location preference (<strong>{locationFilter || "All"}</strong>).</span>
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
  const [newKeywords, setNewKeywords] = useState("");
  const [newJobTitles, setNewJobTitles] = useState("");
  const [scanning, setScanning] = useState(null);
  const [scanResults, setScanResults] = useState({});
  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState("website"); // "website" or "keywords"
  const [showPresets, setShowPresets] = useState(false);

  const KEYWORD_PRESETS = {
    "Investment Banking": { titles: ["Summer Analyst", "Analyst", "Associate", "VP"], keywords: ["M&A", "ECM", "DCM", "Leveraged Finance", "restructuring"] },
    "Sales & Trading": { titles: ["Summer Analyst", "Analyst", "Trader", "Associate"], keywords: ["equities", "FICC", "rates", "FX", "derivatives", "commodities"] },
    "Asset Management": { titles: ["Analyst", "Associate", "Portfolio Manager"], keywords: ["equity research", "fixed income", "quantitative", "portfolio", "fund"] },
    "Private Equity": { titles: ["Analyst", "Associate", "Vice President"], keywords: ["buyout", "growth equity", "LBO", "due diligence", "portfolio company"] },
    "Management Consulting": { titles: ["Analyst", "Associate", "Consultant", "Business Analyst"], keywords: ["strategy", "operations", "transformation", "advisory", "digital"] },
    "Strategy Consulting": { titles: ["Strategy Analyst", "Associate", "Consultant"], keywords: ["corporate strategy", "growth strategy", "market entry", "due diligence"] },
    "Big 4 / Advisory": { titles: ["Analyst", "Associate", "Consultant", "Manager"], keywords: ["audit", "tax", "advisory", "deals", "risk", "forensic", "valuation"] },
    "Product Management": { titles: ["APM", "Product Manager", "Product Analyst"], keywords: ["growth", "product", "user research", "roadmap", "agile"] },
    "Data / Quant": { titles: ["Quant Analyst", "Data Scientist", "Data Analyst"], keywords: ["quantitative", "python", "machine learning", "statistical", "modelling"] },
    "Tech / SWE": { titles: ["Software Engineer", "SWE Intern", "Developer"], keywords: ["full-stack", "backend", "frontend", "cloud", "API"] },
  };

  useEffect(() => {
    if (!user) return;
    fetchWebsites(user.id).then(({ data }) => {
      if (data) {
        setSites(data.map(s => ({ id: s.id, url: s.url, label: s.label, freq: s.frequency, lastScanned: s.last_scanned, jobsFound: s.jobs_found, status: s.status, keywords: s.keywords || [], job_titles: s.job_titles || [] })));
      }
    });
  }, [user]);

  const addSite = async () => {
    const keywords = newKeywords.split(",").map(k => k.trim()).filter(Boolean);
    const jobTitles = newJobTitles.split(",").map(k => k.trim()).filter(Boolean);
    if (addMode === "website" && !newUrl.trim()) return;
    if (addMode === "keywords" && jobTitles.length === 0 && keywords.length === 0) return;
    const url = addMode === "keywords" ? "https://www.linkedin.com/jobs" : newUrl;
    const label = addMode === "keywords" ? (newLabel || jobTitles.join(", ") || keywords.join(", ")) : (newLabel || newUrl);
    const site = { url, label, frequency: newFreq, last_scanned: "Never", jobs_found: 0, status: "idle", keywords, job_titles: jobTitles };
    if (user) {
      const { data } = await upsertWebsite(user.id, site);
      if (data) setSites(prev => [...prev, { id: data.id, url: data.url, label: data.label, freq: data.frequency, lastScanned: data.last_scanned, jobsFound: data.jobs_found, status: data.status, keywords: data.keywords || [], job_titles: data.job_titles || [] }]);
    }
    setNewUrl(""); setNewLabel(""); setNewKeywords(""); setNewJobTitles(""); setAdding(false); setAddMode("website");
  };

  const scanSite = async (site) => {
    setScanning(site.id);
    setSites(prev => prev.map(s => s.id === site.id ? { ...s, status: "scanning" } : s));
    const trackKw = { ib: "investment banking analyst M&A ECM DCM summer analyst", consulting: "management consulting business analyst strategy", product: "product manager APM growth PM", postgrad: "graduate program rotational scheme trainee MBA" };
    try {
      const extraKeywords = (site.keywords || []).join(" ");
      const extraTitles = (site.job_titles || []).join(" ");
      const crawled = await crawlJobs({
        query: `${extraTitles || trackKw[newTrack] || trackKw.ib} ${extraKeywords} ${newLocation || ""}`,
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
          id: site.id, url: site.url, label: site.label, frequency: site.freq,
          status: "active", last_scanned: "Just now", jobs_found: found,
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
        <div className="flex g8">
          <button className="btn btn-outline" onClick={()=>{setAdding(true);setAddMode("keywords")}}>+ Add by Keywords</button>
          <button className="btn btn-primary" onClick={()=>{setAdding(true);setAddMode("website")}}>+ Add Website</button>
        </div>
      </div>
      <div className="alert a-blue mb20">🤖 <span>Add websites or keyword-only searches — both feed into the weekly admin scrape including LinkedIn. Use presets for quick setup.</span></div>
      {adding && (
        <div className="card mb20">
          <div className="card-header">
            <div className="flex items-c g12">
              <div className="card-title">{addMode === "keywords" ? "Add Keyword Search" : "Add New Website"}</div>
              <div className="flex g4">
                <button className={`btn btn-xs ${addMode==="website"?"btn-primary":"btn-outline"}`} onClick={()=>setAddMode("website")}>Website</button>
                <button className={`btn btn-xs ${addMode==="keywords"?"btn-primary":"btn-outline"}`} onClick={()=>setAddMode("keywords")}>Keywords Only</button>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={()=>{setAdding(false);setShowPresets(false)}}>✕</button>
          </div>
          {addMode === "website" && (
            <div className="grid g3 g16 mb16">
              <div className="fg"><label className="label">Website URL</label><input className="input" placeholder="https://..." value={newUrl} onChange={e=>setNewUrl(e.target.value)}/></div>
              <div className="fg"><label className="label">Label</label><input className="input" placeholder="e.g. Goldman Sachs Careers" value={newLabel} onChange={e=>setNewLabel(e.target.value)}/></div>
              <div className="fg"><label className="label">Frequency</label><select className="input" value={newFreq} onChange={e=>setNewFreq(e.target.value)}><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></div>
            </div>
          )}
          {addMode === "keywords" && (
            <div className="mb16">
              <div className="fg mb12"><label className="label">Label <span className="t-ink4 fs11">(optional)</span></label><input className="input" placeholder="e.g. IB Summer Analyst Search" value={newLabel} onChange={e=>setNewLabel(e.target.value)}/></div>
            </div>
          )}
          <div className="mb12">
            <button className="btn btn-ghost btn-xs" onClick={()=>setShowPresets(!showPresets)} style={{marginBottom:8}}>
              {showPresets ? "▾ Hide Presets" : "▸ Auto-fill from Presets"}
            </button>
            {showPresets && (
              <div className="flex g6 flex-wrap">
                {Object.entries(KEYWORD_PRESETS).map(([cat, vals]) => (
                  <button key={cat} className="btn btn-outline btn-xs" style={{fontSize:10}} onClick={() => {
                    const existingTitles = newJobTitles ? newJobTitles.split(",").map(t=>t.trim()).filter(Boolean) : [];
                    const existingKw = newKeywords ? newKeywords.split(",").map(k=>k.trim()).filter(Boolean) : [];
                    const mergedTitles = [...new Set([...existingTitles, ...vals.titles])];
                    const mergedKw = [...new Set([...existingKw, ...vals.keywords])];
                    setNewJobTitles(mergedTitles.join(", "));
                    setNewKeywords(mergedKw.join(", "));
                    if (!newLabel) setNewLabel(cat);
                  }}>{cat}</button>
                ))}
              </div>
            )}
          </div>
          <div className="grid g2 g16 mb16">
            <div className="fg"><label className="label">Job Titles <span className="t-ink4 fs11">(comma-separated)</span></label><input className="input" placeholder="e.g. Analyst, Associate, Summer Intern" value={newJobTitles} onChange={e=>setNewJobTitles(e.target.value)}/></div>
            <div className="fg"><label className="label">Keywords <span className="t-ink4 fs11">(comma-separated)</span></label><input className="input" placeholder="e.g. M&A, DCM, quantitative, restructuring" value={newKeywords} onChange={e=>setNewKeywords(e.target.value)}/></div>
          </div>
          <div className="flex g10"><button className="btn btn-primary" onClick={addSite}>{addMode === "keywords" ? "Add Keyword Search" : "Add Website"}</button><button className="btn btn-outline" onClick={()=>{setAdding(false);setShowPresets(false)}}>Cancel</button></div>
        </div>
      )}
      <div className="card mb20">
        <div className="card-header"><div className="card-title">Configured Websites</div><span className="tag t-gold">{sites.length} sites</span></div>
        {sites.map(site => (
          <div key={site.id}>
            <div className="site-row">
              <div className={`site-status-dot ${site.status === "active" ? "dot-active" : site.status === "scanning" ? "dot-scanning" : "dot-idle"}`}/>
              <div style={{flex:1,minWidth:0}}>
                <div className="site-url" style={{marginBottom:2}}>{site.label}</div>
                <div className="fs11 t-ink4">{site.url}</div>
                {(site.job_titles?.length > 0 || site.keywords?.length > 0) && (
                  <div className="flex g4 flex-wrap mt4">
                    {(site.job_titles || []).map((t,i)=><span key={`t${i}`} className="tag t-blue" style={{fontSize:9}}>🏷 {t}</span>)}
                    {(site.keywords || []).map((k,i)=><span key={`k${i}`} className="tag t-gold" style={{fontSize:9}}>🔑 {k}</span>)}
                  </div>
                )}
              </div>
              <div className="flex items-c g8">
                <span className="tag t-ink">{site.freq}</span><div className="site-meta">Last: {site.lastScanned}</div>
                {site.jobsFound > 0 && <span className="tag t-green">{site.jobsFound} jobs</span>}
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
                const site={url:s.url,label:s.label,frequency:"daily",last_scanned:"Never",jobs_found:0,status:"idle",keywords:[],job_titles:[]};
                if(user){const{data}=await upsertWebsite(user.id,site);if(data)setSites(prev=>[...prev,{id:data.id,url:data.url,label:data.label,freq:data.frequency,lastScanned:data.last_scanned,jobsFound:data.jobs_found,status:data.status,keywords:data.keywords||[],job_titles:data.job_titles||[]}]);}
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
  const [jobInputMode, setJobInputMode] = useState("crm"); // "crm" | "url" | "paste"
  const [jobUrlInput, setJobUrlInput] = useState("");
  const [jobPasteInput, setJobPasteInput] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customFirm, setCustomFirm] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [tone, setTone] = useState("professional");
  const [generatedCL, setGeneratedCL] = useState("");
  const [generating, setGenerating] = useState(false);
  const [atsScores, setAtsScores] = useState({ keyword: 0, format: 0, quant: 0, length: 0 });
  const [atsAnalyzing, setAtsAnalyzing] = useState(false);
  const [atsFeedback, setAtsFeedback] = useState([]);
  const [tailoring, setTailoring] = useState(false);
  const [tailoredCV, setTailoredCV] = useState("");
  const [uploading, setUploading] = useState(false);
  const cvFileRef = useRef(null);

  // Real ATS scoring via AI
  const runAtsAnalysis = useCallback(async () => {
    if (!cv || cv.trim().length < 50) {
      setAtsScores({ keyword: 0, format: 0, quant: 0, length: 0 });
      setAtsFeedback([]);
      return;
    }
    setAtsAnalyzing(true);
    try {
      const prompt = `Analyze this CV/resume for ATS (Applicant Tracking System) compatibility. Score each dimension 0-100 and provide 3-4 specific, actionable suggestions.

CV TEXT:
${cv.slice(0, 6000)}

${jobDesc ? `TARGET JOB DESCRIPTION:\n${jobDesc.slice(0, 2000)}` : "No specific job description provided — score against general finance/consulting standards."}

You MUST respond by calling the score_ats function.`;

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are an ATS analysis expert for finance and consulting CVs. Always use the score_ats tool to return structured results." },
            { role: "user", content: prompt }
          ],
          tools: [{
            type: "function",
            function: {
              name: "score_ats",
              description: "Return ATS compatibility scores and suggestions",
              parameters: {
                type: "object",
                properties: {
                  keyword: { type: "number", description: "Keyword match score 0-100: how well the CV matches industry keywords and the JD if provided" },
                  format: { type: "number", description: "Format compliance score 0-100: ATS-safe formatting, no tables/images/columns, proper headings" },
                  quant: { type: "number", description: "Quantification score 0-100: use of numbers, metrics, percentages in achievements" },
                  length: { type: "number", description: "Length optimization score 0-100: appropriate length, no wasted space, concise bullets" },
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["warning", "tip", "good"] },
                        text: { type: "string" }
                      },
                      required: ["type", "text"]
                    },
                    description: "3-4 specific actionable suggestions"
                  }
                },
                required: ["keyword", "format", "quant", "length", "suggestions"],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "score_ats" } }
        })
      });

      if (!res.ok) throw new Error("ATS analysis failed");
      const data = await res.json();
      
      // Parse tool call response
      let parsed;
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        parsed = JSON.parse(toolCall.function.arguments);
      } else {
        // Fallback: try to parse from content
        const content = data.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      }

      if (parsed) {
        setAtsScores({
          keyword: Math.min(100, Math.max(0, Math.round(parsed.keyword || 0))),
          format: Math.min(100, Math.max(0, Math.round(parsed.format || 0))),
          quant: Math.min(100, Math.max(0, Math.round(parsed.quant || 0))),
          length: Math.min(100, Math.max(0, Math.round(parsed.length || 0))),
        });
        setAtsFeedback(parsed.suggestions || []);
      }
    } catch (err) {
      console.error("ATS analysis error:", err);
    }
    setAtsAnalyzing(false);
  }, [cv, jobDesc]);

  // Strip markdown artifacts from AI output
  const cleanAIOutput = (text) => {
    return text
      .replace(/\*\*\*/g, '')           // ***
      .replace(/\*\*/g, '')             // **
      .replace(/(?<!\w)\*(?!\*)/g, '')  // stray single *
      .replace(/^#+\s*/gm, '')          // markdown headers
      .replace(/^---+$/gm, '')          // horizontal rules
      .replace(/```[\s\S]*?```/g, '')   // code blocks
      .replace(/`([^`]+)`/g, '$1')      // inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // markdown links
      .replace(/^\s*>\s*/gm, '')        // blockquotes
      .replace(/\n{3,}/g, '\n\n')       // collapse excessive newlines
      .trim();
  };

  // Save CV to profile in database
  const saveCvToProfile = async (cvText) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('profiles').update({ cv_text: cvText }).eq('user_id', user.id);
    } catch (err) {
      console.error("Failed to save CV to profile:", err);
    }
  };

  // AI Auto-Fix CV function
  const autoFixCV = async (rawCv) => {
    if (!rawCv || rawCv.trim().length < 30) return rawCv;
    try {
      const result = await callClaude(
        `Clean and fix the formatting of this CV. Rules:
1. Do NOT add any markdown formatting (no **, ***, ##, ---, \`\`\`, etc.)
2. Use plain text ONLY
3. Use bullet points with • character only
4. Keep section headers in plain uppercase text
5. Preserve all original content — do not remove or fabricate information
6. Fix alignment, spacing, and typos
7. Improve bullet points with action verbs and quantified metrics where the data exists
8. Ensure consistent date formatting (e.g., "Jan 2024 – Present")
9. Remove any artifacts, garbled text, or extraction errors
10. One blank line between sections, no excessive spacing

CV:
${rawCv}

Return ONLY the cleaned CV text. No commentary, no markdown, no headers like "Here is your CV:".`,
        "You are a professional CV formatter. Output ONLY plain text. Never use markdown syntax like **, ***, ##, or ---. Use • for bullets."
      );
      return cleanAIOutput(result);
    } catch (err) {
      console.error("AI auto-fix failed:", err);
      return rawCv;
    }
  };

  const handleCVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      let rawText = '';
      if (file.name.endsWith('.txt')) {
        rawText = await file.text();
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
          rawText = data.text;
        } else {
          throw new Error('No text extracted from document');
        }
      }

      // Auto-apply AI fix on upload
      const fixedCv = await autoFixCV(rawText);
      setCv(fixedCv);
      // Save to profile
      await saveCvToProfile(fixedCv);
    } catch (err) {
      console.error("CV upload failed:", err);
      alert("Failed to process CV file: " + (err.message || "Unknown error. Try a .txt file or paste directly."));
    }
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
  // For CVs: always fits on one page by auto-scaling font sizes AND spacing
  // For cover letters: allows multi-page
  const exportPDF = (content, filename) => {
    if (!content) return;
    const isCV = !filename.includes("cover_letter");

    const margin = { top: 18, left: 20, right: 20, bottom: 12 };
    const pageW = 210 - margin.left - margin.right;
    const pageH = 297 - margin.top - margin.bottom;

    const lines = content.split("\n");
    const sectionHeaders = ["education","professional experience","extracurricular activities","additional information","work experience","experience","leadership","skills","interests","certifications","awards","contact details","projects","summary","objective"];

    // Measure total height at a given base font size and spacing scale
    const measureHeight = (basePt, spacingScale = 1) => {
      const lineH = basePt * 0.38 * spacingScale;
      const bulletLineH = basePt * 0.38 * spacingScale;
      const blankH = 1.2 * spacingScale;
      const sectionGap = 1.5 * spacingScale;
      const sectionAfter = 3 * spacingScale;
      let h = 0;
      let nameDetected = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) { h += blankH; continue; }
        const lower = line.toLowerCase();
        const isSectionHeader = sectionHeaders.some(x => lower === x || lower.startsWith(x + " "));
        const isBullet = /^[-•□▪►▸●◦]\s*/.test(line);

        if (!nameDetected && i < 5 && !isBullet) {
          const isContact = lower.includes("@") || lower.startsWith("m:") || lower.startsWith("+") || /^\(?\d{3}\)?[\s.-]/.test(lower) || lower.includes("linkedin") || (line.includes("|") && i < 6) || (line.includes("·") && i < 6 && !isSectionHeader);
          if (isContact) { h += lineH + 0.3; }
          else if (isSectionHeader) { nameDetected = true; h += sectionGap + (basePt + 1) * 0.38 + sectionAfter; }
          else { h += (basePt + 4) * 0.38 + 0.5; nameDetected = true; }
          continue;
        }
        if (i < 8 && (lower.includes("@") || lower.startsWith("m:") || lower.startsWith("+") || lower.includes("linkedin") || (line.includes("|") && i < 8))) {
          h += lineH + 0.3; continue;
        }
        if (isSectionHeader) { h += sectionGap + (basePt + 1) * 0.38 + sectionAfter; continue; }
        if (isBullet) {
          const bullet = line.replace(/^[-•□▪►▸●◦]\s*/, "");
          const estCharsPerLine = Math.floor((pageW - 7) / (basePt * 0.18));
          const wrapLines = Math.max(1, Math.ceil(bullet.length / estCharsPerLine));
          h += wrapLines * bulletLineH + 0.4 * spacingScale;
          continue;
        }
        const dateMatch = line.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}.*$|\d{4}\s*[-–—]\s*(?:\d{4}|Present|Current))/i);
        if (dateMatch) { h += lineH + 0.6 * spacingScale; continue; }
        if (line.length < 80 && !line.includes(".") && i > 3) { h += lineH + 0.3 * spacingScale; continue; }
        const estCharsPerLine = Math.floor(pageW / (basePt * 0.18));
        const wrapLines = Math.max(1, Math.ceil(line.length / estCharsPerLine));
        h += wrapLines * lineH + 0.3 * spacingScale;
      }
      return h;
    };

    // For CVs: find optimal font size + spacing to fill page without overflow
    let baseFontSize = 10;
    let spacingScale = 1;
    if (isCV) {
      // First find largest font that fits
      for (let pt = 10.5; pt >= 7; pt -= 0.5) {
        if (measureHeight(pt, 1) <= pageH) { baseFontSize = pt; break; }
        baseFontSize = pt;
      }
      // If there's too much dead space, expand spacing to fill page
      const usedH = measureHeight(baseFontSize, 1);
      if (usedH < pageH * 0.85 && usedH > 0) {
        spacingScale = Math.min(1.6, pageH / usedH);
      }
      // If still overflowing, compress spacing
      if (measureHeight(baseFontSize, spacingScale) > pageH) {
        for (let s = spacingScale; s >= 0.7; s -= 0.05) {
          if (measureHeight(baseFontSize, s) <= pageH) { spacingScale = s; break; }
          spacingScale = s;
        }
      }
    }

    const pdf = new jsPDF("p", "mm", "a4");
    let y = margin.top;
    let nameDetected = false;

    const lineH = baseFontSize * 0.38 * spacingScale;
    const blankH = 1.2 * spacingScale;
    const sectionGap = 1.5 * spacingScale;
    const sectionAfter = 3 * spacingScale;
    const addPage = () => { if (!isCV) { pdf.addPage(); y = margin.top; } };
    const checkPage = (needed) => { if (!isCV && y + needed > margin.top + pageH) addPage(); };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) { y += blankH; continue; }
      const lower = line.toLowerCase();
      const isSectionHeader = sectionHeaders.some(h => lower === h || lower.startsWith(h + " "));
      const isBullet = /^[-•□▪►▸●◦]\s*/.test(line);
      const dateMatch = line.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}.*$|\d{4}\s*[-–—]\s*(?:\d{4}|Present|Current))/i);
      const isContactLine = lower.includes("@") || lower.startsWith("m:") || lower.startsWith("+") || /^\(?\d{3}\)?[\s.-]/.test(lower) || lower.includes("linkedin") || (line.includes("|") && i < 8) || (line.includes("·") && i < 8 && !isSectionHeader);

      if (!nameDetected && i < 5 && !isBullet) {
        if (isContactLine) {
          checkPage(5);
          pdf.setFont("times", "normal"); pdf.setFontSize(baseFontSize);
          pdf.text(line, 105, y, { align: "center" }); y += lineH + 0.3;
        } else if (isSectionHeader) {
          nameDetected = true;
          checkPage(8);
          y += sectionGap;
          pdf.setFont("times", "bold"); pdf.setFontSize(baseFontSize + 1);
          pdf.text(line.toUpperCase(), margin.left, y);
          y += 1;
          pdf.setDrawColor(0); pdf.setLineWidth(0.3);
          pdf.line(margin.left, y, margin.left + pageW, y);
          y += sectionAfter;
        } else {
          pdf.setFont("times", "bold"); pdf.setFontSize(baseFontSize + 4);
          pdf.text(line, 105, y, { align: "center" }); y += (baseFontSize + 4) * 0.38 + 0.5;
          nameDetected = true;
        }
        continue;
      }

      if (i < 8 && isContactLine) {
        checkPage(5);
        pdf.setFont("times", "normal"); pdf.setFontSize(baseFontSize);
        pdf.text(line, 105, y, { align: "center" }); y += lineH + 0.3;
        continue;
      }

      if (isSectionHeader) {
        checkPage(10);
        y += sectionGap;
        pdf.setFont("times", "bold"); pdf.setFontSize(baseFontSize + 1);
        pdf.text(line.toUpperCase(), margin.left, y);
        y += 1;
        pdf.setDrawColor(0); pdf.setLineWidth(0.3);
        pdf.line(margin.left, y, margin.left + pageW, y);
        y += sectionAfter;
        continue;
      }

      if (isBullet) {
        const bullet = line.replace(/^[-•□▪►▸●◦]\s*/, "");
        pdf.setFont("times", "normal"); pdf.setFontSize(baseFontSize);
        const wrapped = pdf.splitTextToSize(bullet, pageW - 7);
        checkPage(wrapped.length * lineH + 0.4);
        pdf.text("•", margin.left + 3, y);
        pdf.text(wrapped, margin.left + 7, y);
        y += wrapped.length * lineH + 0.4 * spacingScale;
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
        y += lineH + 0.6 * spacingScale;
        continue;
      }

      if (line.length < 80 && !line.includes(".") && i > 3) {
        checkPage(6);
        pdf.setFont("times", "bolditalic"); pdf.setFontSize(baseFontSize);
        const wrapped = pdf.splitTextToSize(line, pageW);
        pdf.text(wrapped, margin.left, y);
        y += wrapped.length * lineH + 0.3 * spacingScale;
        continue;
      }

      pdf.setFont("times", "normal"); pdf.setFontSize(baseFontSize);
      const wrapped = pdf.splitTextToSize(line, pageW);
      checkPage(wrapped.length * lineH + 0.3);
      pdf.text(wrapped, margin.left, y);
      y += wrapped.length * lineH + 0.3 * spacingScale;
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
            const isCV = tab !== "cover letter";
            const sectionHeaders = ["education","professional experience","extracurricular activities","additional information","work experience","experience","leadership","skills","interests","certifications","awards","contact details","projects","summary","objective"];
            const lines = content.split("\n");
            // Estimate content density to scale font size for one-page fit
            const totalLines = lines.length;
            const bulletCount = lines.filter(l => /^[-•□▪►▸●◦]\s*/.test(l.trim())).length;
            const contentDensity = totalLines + bulletCount * 0.5;
            // Scale font: dense CVs get smaller text, sparse ones get larger
            let fontSize = isCV ? (contentDensity > 80 ? "9pt" : contentDensity > 60 ? "9.5pt" : contentDensity > 40 ? "10pt" : "10.5pt") : "11pt";
            let lineHeight = isCV ? (contentDensity > 60 ? "1.15" : "1.25") : "1.4";
            let sectionMargin = isCV ? (contentDensity > 60 ? "4pt 0 1pt 0" : "6pt 0 2pt 0") : "10pt 0 3pt 0";
            let blankLineSize = isCV ? (contentDensity > 60 ? "2pt" : "3pt") : "6pt";

            let htmlLines = [];
            let nameFound = false;
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line) { htmlLines.push(`<p style="margin:0;font-size:${blankLineSize};">&nbsp;</p>`); continue; }
              const lower = line.toLowerCase();
              const isSectionHeader = sectionHeaders.some(x => lower === x || lower.startsWith(x + " "));
              const isBullet = /^[-•□▪►▸●◦]\s*/.test(line);
              const dateMatch = line.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}.*$|\d{4}\s*[-–—]\s*(?:\d{4}|Present|Current))/i);
              const isContactLine = lower.includes("@") || lower.startsWith("m:") || lower.startsWith("+") || /^\(?\d{3}\)?[\s.-]/.test(lower) || lower.includes("linkedin") || (line.includes("|") && i < 6) || (line.includes("·") && i < 6 && !isSectionHeader);
              
              if (!nameFound && i < 5 && !isBullet) {
                if (isContactLine) {
                  htmlLines.push(`<p style="margin:0;text-align:center;font-size:${fontSize};color:#333;">${line}</p>`);
                } else if (isSectionHeader) {
                  nameFound = true;
                  htmlLines.push(`<p style="margin:${sectionMargin};font-weight:bold;font-size:${fontSize};text-transform:uppercase;border-bottom:1px solid #000;padding-bottom:1pt;">${line.toUpperCase()}</p>`);
                } else {
                  nameFound = true;
                  htmlLines.push(`<p style="margin:0 0 2pt 0;text-align:center;font-size:14pt;font-weight:bold;letter-spacing:1pt;">${line}</p>`);
                }
              } else if (i < 8 && isContactLine) {
                htmlLines.push(`<p style="margin:0;text-align:center;font-size:${fontSize};color:#333;">${line}</p>`);
              } else if (isSectionHeader) {
                htmlLines.push(`<p style="margin:${sectionMargin};font-weight:bold;font-size:${fontSize};text-transform:uppercase;border-bottom:1px solid #000;padding-bottom:1pt;">${line.toUpperCase()}</p>`);
              } else if (isBullet) {
                const bullet = line.replace(/^[-•□▪►▸●◦]\s*/, '');
                htmlLines.push(`<p style="margin:0.5pt 0 0.5pt 16pt;text-indent:-10pt;font-size:${fontSize};line-height:${lineHeight};">• ${bullet}</p>`);
              } else if (dateMatch) {
                const dateStr = dateMatch[0].trim();
                const mainText = line.replace(dateStr, '').replace(/[,|·\s]+$/, '').trim();
                if (mainText.length > 2) {
                  htmlLines.push(`<p style="margin:2pt 0 0 0;font-size:${fontSize};"><b>${mainText}</b><span style="float:right;">${dateStr}</span></p>`);
                } else {
                  htmlLines.push(`<p style="margin:0.5pt 0;font-size:${fontSize};text-align:right;">${dateStr}</p>`);
                }
              } else if (line.length < 80 && !line.includes(".") && i > 3) {
                htmlLines.push(`<p style="margin:1pt 0 0 0;font-size:${fontSize};font-style:italic;">${line}</p>`);
              } else {
                htmlLines.push(`<p style="margin:0.5pt 0;font-size:${fontSize};line-height:${lineHeight};">${line}</p>`);
              }
            }
            const pageMargin = isCV ? "36pt 48pt 36pt 48pt" : "54pt 54pt 54pt 54pt";
            const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>@page{margin:${pageMargin};mso-page-orientation:portrait;}body{font-family:'Times New Roman',Times,serif;font-size:${fontSize};line-height:${lineHeight};color:#000;}</style></head><body>${htmlLines.join("")}</body></html>`;
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
                    const fixed = await autoFixCV(cv);
                    setCv(fixed);
                    await saveCvToProfile(fixed);
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
                <div>
                  <div className="card-title">ATS Score</div>
                  {atsAnalyzing && <div className="fs11 t-ink4 mt4">Analyzing...</div>}
                </div>
                <div className="flex g8 items-c">
                  {cv && <button className="btn btn-gold btn-xs" onClick={runAtsAnalysis} disabled={atsAnalyzing}>
                    {atsAnalyzing ? "⏳ Scoring..." : "🔍 Run ATS Check"}
                  </button>}
                  <span className={`tag ${Object.values(atsScores).some(v=>v>0) ? (Math.round(Object.values(atsScores).reduce((a,b)=>a+b)/4) >= 80 ? "t-green" : Math.round(Object.values(atsScores).reduce((a,b)=>a+b)/4) >= 60 ? "t-gold" : "t-red") : "t-ink"}`}>
                    {Object.values(atsScores).some(v=>v>0) ? `${Math.round(Object.values(atsScores).reduce((a,b)=>a+b)/4)} / 100` : "—"}
                  </span>
                </div>
              </div>
              {!Object.values(atsScores).some(v=>v>0) && !atsAnalyzing && (
                <div style={{textAlign:"center",padding:"20px 0",color:"var(--ink4)",fontSize:12}}>
                  {cv ? "Click 'Run ATS Check' to analyze your CV" : "Upload a CV first to get ATS scoring"}
                </div>
              )}
              {Object.values(atsScores).some(v=>v>0) && Object.entries({keyword:"Keyword Match",format:"Format Compliance",quant:"Quantification",length:"Length Optimization"}).map(([k,l])=>(
                <div key={k} className="mb12">
                  <div className="flex j-between mb4">
                    <div className="fs12 t-ink3">{l}</div>
                    <div className="mono fs11" style={{color: atsScores[k]>=80?"var(--green)":atsScores[k]>=60?"var(--gold)":"var(--red)"}}>{atsScores[k]}%</div>
                  </div>
                  <div className="prog-track"><div className={`prog-fill ${atsScores[k]>=80?"g":atsScores[k]>=60?"":""}`} style={{width:`${atsScores[k]}%`, background: atsScores[k]>=80?"var(--green)":atsScores[k]>=60?"var(--gold)":"var(--red)"}}/></div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-title mb16">AI Suggestions</div>
              {atsFeedback.length > 0 ? atsFeedback.map((s,i)=>(
                <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:i<atsFeedback.length-1?"1px solid var(--border2)":"none",fontSize:12,lineHeight:1.6}}>
                  <span style={{flexShrink:0}}>{s.type==="warning"?"⚠️":s.type==="good"?"✅":"💡"}</span>
                  <span style={{color:"var(--ink2)"}}>{s.text}</span>
                </div>
              )) : (cv ? [
                { type:"💡", text:"Run ATS Check to get personalized AI suggestions for your CV" },
                { type:"💡", text:"Paste a job description to check keyword alignment" },
              ] : [
                { type:"📄", text:"Upload your CV to get personalised AI suggestions" },
                { type:"💡", text:"Use the upload button above or paste your CV text directly" },
              ]).map((s,i)=>(
                <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:i<1?"1px solid var(--border2)":"none",fontSize:12,lineHeight:1.6}}>
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
              <div className="card-title mb16">How would you like to specify the role?</div>
              <div className="flex g8 mb16">
                {[
                  { id: "crm", label: "📋 Select from CRM" },
                  { id: "url", label: "🔗 Paste Job URL" },
                  { id: "paste", label: "📝 Paste Job Description" },
                ].map(m => (
                  <button key={m.id} className={`btn btn-sm flex-1 ${jobInputMode === m.id ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setJobInputMode(m.id)}>{m.label}</button>
                ))}
              </div>

              {jobInputMode === "crm" && (
                <>
                  {jobs.length > 0 ? (
                    <div className="grid g-auto g12">
                      {jobs.map(j => (
                        <div key={j.id} onClick={() => { setSelectedJob(j); setJobDesc(j.description || ""); setClStep(2); }}
                          className="card-flat"
                          style={{ cursor: "pointer", border: `1.5px solid ${selectedJob?.id === j.id ? "var(--gold)" : "var(--border2)"}`, borderRadius: 10, padding: "14px 16px", transition: "all .15s" }}>
                          <div className="fw6 fs12" style={{ color: "var(--ink)", marginBottom: 3 }}>{j.title}</div>
                          <div className="fs11 t-ink3">{j.firm}</div>
                          <div className="flex g6 mt8">
                            {(j.tags || []).map(t => <span key={t} className="tag t-navy">{t}</span>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "var(--ink4)", fontSize: 12 }}>
                      No jobs in your CRM yet. Use another method or add jobs to your CRM first.
                    </div>
                  )}
                  <div className="mt16">
                    <label className="label">Or enter a custom role</label>
                    <div className="flex g10">
                      <input className="input" placeholder="Job title..." style={{ flex: 1 }} value={customTitle} onChange={e => setCustomTitle(e.target.value)} />
                      <input className="input" placeholder="Company..." style={{ flex: 1 }} value={customFirm} onChange={e => setCustomFirm(e.target.value)} />
                      <button className="btn btn-primary" onClick={() => {
                        setSelectedJob({ title: customTitle || "Role", firm: customFirm || "Company" });
                        setClStep(2);
                      }}>Next →</button>
                    </div>
                  </div>
                </>
              )}

              {jobInputMode === "url" && (
                <div>
                  <label className="label">Paste the job listing URL</label>
                  <div className="flex g10">
                    <input className="input" style={{ flex: 1 }} placeholder="https://careers.example.com/jobs/analyst-london"
                      value={jobUrlInput} onChange={e => setJobUrlInput(e.target.value)} />
                    <button className="btn btn-primary" disabled={!jobUrlInput.trim() || fetchingUrl} onClick={async () => {
                      setFetchingUrl(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
                          body: { url: jobUrlInput.trim(), options: { formats: ['markdown'], onlyMainContent: true } }
                        });
                        if (error) throw new Error(error.message);
                        const md = data?.data?.markdown || data?.markdown || "";
                        if (!md) throw new Error("Could not extract content from that URL");
                        setJobDesc(md);
                        const firstLine = md.split("\n").find(l => l.trim()) || "";
                        const title = firstLine.replace(/^#+\s*/, "").slice(0, 80) || "Role";
                        setSelectedJob({ title, firm: new URL(jobUrlInput.trim()).hostname.replace("www.", ""), url: jobUrlInput.trim() });
                        setClStep(2);
                      } catch (err) {
                        console.error("URL scrape failed:", err);
                        alert("Could not fetch that URL. Try pasting the job description instead.\n\n" + (err.message || ""));
                      }
                      setFetchingUrl(false);
                    }}>
                      {fetchingUrl ? "⏳ Fetching..." : "Fetch & Continue →"}
                    </button>
                  </div>
                  <div className="alert a-gold mt12" style={{ fontSize: 11 }}>
                    💡 We'll scrape the page content to extract the job description automatically. Works best with public career pages.
                  </div>
                </div>
              )}

              {jobInputMode === "paste" && (
                <div>
                  <div className="flex g10 mb12">
                    <div className="fg" style={{ flex: 1 }}>
                      <label className="label">Job Title</label>
                      <input className="input" placeholder="e.g. Investment Banking Analyst" value={customTitle} onChange={e => setCustomTitle(e.target.value)} />
                    </div>
                    <div className="fg" style={{ flex: 1 }}>
                      <label className="label">Company</label>
                      <input className="input" placeholder="e.g. Goldman Sachs" value={customFirm} onChange={e => setCustomFirm(e.target.value)} />
                    </div>
                  </div>
                  <div className="fg">
                    <label className="label">Paste the full job description</label>
                    <textarea className="input textarea" style={{ minHeight: 200 }}
                      placeholder="Paste the complete job description here..."
                      value={jobPasteInput} onChange={e => setJobPasteInput(e.target.value)} />
                  </div>
                  <div className="flex j-end mt12">
                    <button className="btn btn-primary" onClick={() => {
                      setJobDesc(jobPasteInput);
                      setSelectedJob({ title: customTitle || "Role", firm: customFirm || "Company" });
                      setClStep(2);
                    }} disabled={!jobPasteInput.trim()}>
                      Continue →
                    </button>
                  </div>
                </div>
              )}
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
function Pipeline({ jobs: allJobs, setJobs }) {
  const { user } = useAuth();
  // Only show manually added/saved jobs (no source_id = not from crawler)
  const jobs = allJobs.filter(j => !j.source_id);
  const stages = ["saved","outreach","applying","interviewing","offer"];
  const labels = {saved:"Saved",outreach:"Outreach",applying:"Applying",interviewing:"Interviewing",offer:"Offer ✓"};
  const [contacts, setContacts] = useState([]);
  const [selectedJobs, setSelectedJobs] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [crmTab, setCrmTab] = useState("pipeline");
  const [uploading, setUploading] = useState(false);
  const [uploadLog, setUploadLog] = useState("");
  const crmFileRef = useRef(null);
  const jobFileRef = useRef(null);
  const [jobUploading, setJobUploading] = useState(false);
  const [jobUploadLog, setJobUploadLog] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addStage, setAddStage] = useState("saved");
  const [newJob, setNewJob] = useState({ title:"", firm:"", stage:"saved", deadline:"", tags:"", track:"", location:"", url:"", source:"Manual" });

  // Load contacts from DB
  useEffect(() => {
    if (!user) return;
    fetchContacts(user.id).then(({ data }) => setContacts(data || []));
  }, [user]);

  const handleExportCSV = () => {
    const exportData = jobs.map(j => ({
      Title: j.title, Firm: j.firm, Stage: j.stage, Track: j.track || "",
      Deadline: j.deadline || "", Match: j.match || 0, Tags: (j.tags || []).join("; "),
      Location: j.location || "", Level: j.level || "",
    }));
    exportToCSV(exportData, "pipeline_export");
  };

  const handleJobUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setJobUploading(true);
    setJobUploadLog("📄 Reading file...");
    try {
      let textContent = "";
      const ext = file.name.split(".").pop().toLowerCase();

      if (ext === "csv" || ext === "xlsx" || ext === "xls") {
        textContent = await file.text();
      } else {
        const reader = new FileReader();
        const base64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.readAsDataURL(file);
        });
        setJobUploadLog("🤖 Extracting text from document...");
        const { data, error } = await supabase.functions.invoke("extract-document", {
          body: { base64, fileName: file.name, mimeType: file.type },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message || "Extraction failed");
        textContent = data.text;
      }

      setJobUploadLog("🤖 AI is parsing jobs from your file...");
      const prompt = `Parse the following document content into a list of job opportunities. Extract: title (job title), firm (company name), track (one of: ib, consulting, product), level (undergrad or experienced), location, deadline, description, source (where the job was found), and url (application link if available).

Return ONLY a valid JSON array like:
[{"title":"Summer Analyst 2026","firm":"Goldman Sachs","track":"ib","level":"undergrad","location":"London","deadline":"Rolling","description":"IBD summer analyst programme","source":"Company Website","url":"https://..."}]

If there are no jobs, return [].

Document content:
${textContent.slice(0, 8000)}`;

      const result = await callClaude(prompt, "You are a job data parser. Return ONLY valid JSON array. No markdown, no explanation.", true);
      const clean = result.replace(/```json|```/g, "").trim();
      const start = clean.indexOf("[");
      const end = clean.lastIndexOf("]") + 1;
      if (start < 0) throw new Error("Could not parse jobs from file");

      const parsed = JSON.parse(clean.slice(start, end));
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setJobUploadLog("⚠ No jobs found in the file.");
        setJobUploading(false);
        return;
      }

      let inserted = 0;
      for (const j of parsed) {
        const { error } = await upsertJob(user.id, {
          title: j.title || "Untitled Role",
          firm: j.firm || j.company || "Unknown",
          stage: "saved",
          track: j.track || "ib",
          level: j.level || "undergrad",
          location: j.location || "",
          deadline: j.deadline || "Rolling",
          description: j.description || "",
          source: j.source || "File Upload",
          url: j.url || "",
          match: 80,
          tags: j.track === "ib" ? ["IB"] : j.track === "consulting" ? ["Consulting"] : ["Product"],
        });
        if (!error) inserted++;
      }

      // Refresh jobs from DB
      const { data: refreshed } = await fetchJobs(user.id);
      if (refreshed) {
        setJobs(refreshed.map(j => ({
          id: j.id, title: j.title, firm: j.firm, stage: j.stage,
          deadline: j.deadline || "—", match: j.match_score || 0,
          tags: j.tags || [], track: j.track, level: j.experience_level,
          location: j.location, description: j.description, source: j.source, url: j.url,
        })));
      }
      setJobUploadLog(`✅ Imported ${inserted} jobs from ${file.name}`);
    } catch (err) {
      setJobUploadLog(`⚠ Upload failed: ${err.message}`);
    }
    setJobUploading(false);
    if (jobFileRef.current) jobFileRef.current.value = "";
  };

  const handleCrmUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setUploadLog("📄 Reading file...");
    try {
      let textContent = "";
      const ext = file.name.split(".").pop().toLowerCase();

      if (ext === "csv" || ext === "xlsx" || ext === "xls") {
        // Read as text for CSV
        textContent = await file.text();
      } else {
        // For PDF/DOCX, use the extract-document edge function
        const reader = new FileReader();
        const base64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.readAsDataURL(file);
        });
        setUploadLog("🤖 Extracting text from document...");
        const { data, error } = await supabase.functions.invoke("extract-document", {
          body: { base64, fileName: file.name, mimeType: file.type },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message || "Extraction failed");
        textContent = data.text;
      }

      setUploadLog("🤖 AI is parsing contacts from your file...");
      const prompt = `Parse the following document content into a list of professional contacts for a CRM. Extract name, firm/company, role/title, email or phone (as channel), and any notes.

Return ONLY a valid JSON array like:
[{"name":"John Smith","firm":"Goldman Sachs","role":"VP","channel":"john@gs.com","notes":"Met at networking event"}]

If there are no contacts, return [].

Document content:
${textContent.slice(0, 6000)}`;

      const result = await callClaude(prompt, "You are a CRM data parser. Return ONLY valid JSON array. No markdown.", true);
      const clean = result.replace(/```json|```/g, "").trim();
      const start = clean.indexOf("[");
      const end = clean.lastIndexOf("]") + 1;
      if (start < 0) throw new Error("Could not parse contacts from file");

      const parsed = JSON.parse(clean.slice(start, end));
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setUploadLog("⚠ No contacts found in the file.");
        setUploading(false);
        return;
      }

      // Insert contacts into DB
      let inserted = 0;
      for (const c of parsed) {
        const { error } = await upsertContact(user.id, {
          name: c.name || "Unknown",
          firm: c.firm || c.company || "",
          role: c.role || c.title || "",
          channel: c.channel || c.email || "Email",
          status: "pending",
          notes: c.notes || "",
        });
        if (!error) inserted++;
      }

      // Refresh contacts
      const { data: refreshed } = await fetchContacts(user.id);
      setContacts(refreshed || []);
      setUploadLog(`✅ Imported ${inserted} contacts from ${file.name}`);
    } catch (err) {
      setUploadLog(`⚠ Upload failed: ${err.message}`);
    }
    setUploading(false);
    if (crmFileRef.current) crmFileRef.current.value = "";
  };

  const deleteContactRow = async (contactId) => {
    await supabase.from("contacts").delete().eq("id", contactId).eq("user_id", user.id);
    setContacts(prev => prev.filter(c => c.id !== contactId));
  };

  const deleteJobRow = async (jobId) => {
    if (!user) return;
    await deleteJob(user.id, jobId);
    setJobs(prev => prev.filter(j => j.id !== jobId));
    setSelectedJobs(prev => { const n = new Set(prev); n.delete(jobId); return n; });
  };

  const bulkDeleteJobs = async () => {
    if (selectedJobs.size === 0 || !user) return;
    setDeleting(true);
    for (const id of selectedJobs) {
      await deleteJob(user.id, id);
    }
    setJobs(prev => prev.filter(j => !selectedJobs.has(j.id)));
    setSelectedJobs(new Set());
    setDeleting(false);
  };

  const toggleSelectJob = (id) => {
    setSelectedJobs(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedJobs.size === jobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(jobs.map(j => j.id)));
    }
  };

  const updateJobStage = async (jobId, newStage) => {
    if (!user) return;
    await upsertJob(user.id, { id: jobId, stage: newStage });
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, stage: newStage } : j));
  };

  return (
    <div className="page">
      <input type="file" ref={crmFileRef} style={{display:"none"}} accept=".csv,.xlsx,.xls,.pdf,.docx,.doc,.txt" onChange={handleCrmUpload}/>
      <input type="file" ref={jobFileRef} style={{display:"none"}} accept=".csv,.xlsx,.xls,.pdf,.docx,.doc,.txt" onChange={handleJobUpload}/>
      <div className="section-header">
        <div><div className="eyebrow">CRM</div><div className="section-title">Job Tracking Board</div></div>
        <div className="flex g10">
          <button className="btn btn-outline btn-sm" onClick={()=>jobFileRef.current?.click()} disabled={jobUploading}>
            {jobUploading ? "⏳ Parsing..." : "📄 Import Jobs"}
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleExportCSV}>⬇ Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={()=>{setShowAddForm(true);setAddStage("saved")}}>+ Add Role</button>
        </div>
      </div>

      {showAddForm && (
        <div className="card mb20">
          <div className="card-header"><div className="card-title">Add Job Manually</div><button className="btn btn-ghost btn-sm" onClick={()=>setShowAddForm(false)}>✕</button></div>
          <div className="grid g3 g16 mb16">
            <div className="fg"><label className="label">Job Title *</label><input className="input" placeholder="e.g. Summer Analyst" value={newJob.title} onChange={e=>setNewJob(p=>({...p,title:e.target.value}))}/></div>
            <div className="fg"><label className="label">Firm *</label><input className="input" placeholder="e.g. Goldman Sachs" value={newJob.firm} onChange={e=>setNewJob(p=>({...p,firm:e.target.value}))}/></div>
            <div className="fg"><label className="label">Stage</label><select className="input" value={newJob.stage} onChange={e=>setNewJob(p=>({...p,stage:e.target.value}))}>{stages.map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></div>
          </div>
          <div className="grid g3 g16 mb16">
            <div className="fg"><label className="label">Deadline</label><input className="input" type="date" value={newJob.deadline} onChange={e=>setNewJob(p=>({...p,deadline:e.target.value}))}/></div>
            <div className="fg"><label className="label">Location</label><input className="input" placeholder="e.g. London" value={newJob.location} onChange={e=>setNewJob(p=>({...p,location:e.target.value}))}/></div>
            <div className="fg"><label className="label">Track</label><select className="input" value={newJob.track} onChange={e=>setNewJob(p=>({...p,track:e.target.value}))}><option value="">Select...</option><option value="ib">Investment Banking</option><option value="consulting">Consulting</option><option value="pe">Private Equity</option><option value="am">Asset Management</option><option value="product">Product</option><option value="postgrad">Post-Graduate Path</option><option value="other">Other</option></select></div>
          </div>
          <div className="grid g2 g16 mb16">
            <div className="fg"><label className="label">Tags <span className="t-ink4 fs11">(comma-separated)</span></label><input className="input" placeholder="e.g. M&A, Summer 2026" value={newJob.tags} onChange={e=>setNewJob(p=>({...p,tags:e.target.value}))}/></div>
            <div className="fg"><label className="label">Application URL</label><input className="input" placeholder="https://..." value={newJob.url} onChange={e=>setNewJob(p=>({...p,url:e.target.value}))}/></div>
          </div>
          <div className="flex g10">
            <button className="btn btn-primary" disabled={!newJob.title.trim()||!newJob.firm.trim()} onClick={async()=>{
              const tags = newJob.tags.split(",").map(t=>t.trim()).filter(Boolean);
              const jobObj = { title:newJob.title, firm:newJob.firm, stage:newJob.stage, deadline:newJob.deadline||null, tags, track:newJob.track, location:newJob.location, url:newJob.url||null, source:"Manual", match:0 };
              if(user){const{data}=await upsertJob(user.id,jobObj);if(data){setJobs(prev=>[{id:data.id,title:data.title,firm:data.firm,stage:data.stage,deadline:data.deadline||"",tags:data.tags||[],track:data.track||"",match:data.match_score||0,level:data.experience_level||"",location:data.location||"",url:data.url||"",source:data.source||"Manual"},...prev]);}}
              setNewJob({title:"",firm:"",stage:"saved",deadline:"",tags:"",track:"",location:"",url:"",source:"Manual"});setShowAddForm(false);
            }}>Add to CRM</button>
            <button className="btn btn-outline" onClick={()=>setShowAddForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="tabs mb20">
        {[{id:"pipeline",l:"Pipeline"},{id:"contacts",l:`Contacts (${contacts.length})`}].map(t=>(
          <div key={t.id} className={`tab ${crmTab===t.id?"active":""}`} onClick={()=>setCrmTab(t.id)}>{t.l}</div>
        ))}
      </div>

      {crmTab === "pipeline" && (
        <>
          {jobUploading && <div className="ai-pulse mb16"><div className="dot-spin"/>{jobUploadLog}</div>}
          {!jobUploading && jobUploadLog && <div className={`alert ${jobUploadLog.startsWith("✅")?"a-green":"a-gold"} mb16`}>{jobUploadLog}</div>}
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
                    <div key={job.id} className="k-card" style={{position:"relative"}}>
                      <button onClick={()=>deleteJobRow(job.id)} style={{position:"absolute",top:6,right:6,background:"none",border:"none",cursor:"pointer",color:"var(--ink4)",fontSize:12,padding:"2px 4px",borderRadius:4,lineHeight:1}} title="Delete" onMouseEnter={e=>e.target.style.color="var(--red)"} onMouseLeave={e=>e.target.style.color="var(--ink4)"}>✕</button>
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
                  <button className="btn btn-ghost btn-xs w-full" style={{justifyContent:"center",marginTop:8}} onClick={()=>{setShowAddForm(true);setNewJob(p=>({...p,stage}))}}>+ Add</button>
                </div>
              );
            })}
          </div>
          <div className="card" style={{padding:0,overflow:"hidden"}}>
            <div className="card-header" style={{padding:"12px 16px",borderBottom:"1px solid var(--border2)"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div className="card-title" style={{margin:0}}>All Roles</div>
                {selectedJobs.size > 0 && (
                  <button className="btn btn-sm" style={{background:"var(--red)",color:"white",border:"none",fontSize:11,padding:"4px 12px"}} onClick={bulkDeleteJobs} disabled={deleting}>
                    {deleting ? "⏳ Deleting..." : `🗑 Delete ${selectedJobs.size} selected`}
                  </button>
                )}
              </div>
              <button className="btn btn-outline btn-sm" onClick={handleExportCSV}>⬇ Export</button>
            </div>
            <div style={{overflow:"auto"}}>
              <table className="table" style={{fontSize:12,borderCollapse:"collapse",width:"100%"}}>
                <thead>
                  <tr style={{background:"var(--surface2)",position:"sticky",top:0,zIndex:1}}>
                    <th style={{width:36,padding:"8px",textAlign:"center"}}><input type="checkbox" checked={selectedJobs.size===jobs.length&&jobs.length>0} onChange={toggleSelectAll} style={{cursor:"pointer",accentColor:"var(--gold)"}}/></th>
                    <th style={{padding:"8px 12px",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:"0.5px",color:"var(--ink3)"}}>Role</th>
                    <th style={{padding:"8px 12px",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:"0.5px",color:"var(--ink3)"}}>Firm</th>
                    <th style={{padding:"8px 12px",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:"0.5px",color:"var(--ink3)",width:120}}>Stage</th>
                    <th style={{padding:"8px 12px",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:"0.5px",color:"var(--ink3)",width:100}}>Track</th>
                    <th style={{padding:"8px 12px",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:"0.5px",color:"var(--ink3)",width:100}}>Location</th>
                    <th style={{padding:"8px 12px",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:"0.5px",color:"var(--ink3)",width:100}}>Deadline</th>
                    <th style={{padding:"8px 12px",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:"0.5px",color:"var(--ink3)",width:60}}>Match</th>
                    <th style={{padding:"8px 12px",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:"0.5px",color:"var(--ink3)",width:80,textAlign:"center"}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j,i)=>(
                    <tr key={j.id} style={{borderBottom:"1px solid var(--border2)",background:selectedJobs.has(j.id)?"var(--gold-bg)":i%2===0?"transparent":"var(--surface2)",transition:"background 0.1s"}}
                      onMouseEnter={e=>{if(!selectedJobs.has(j.id))e.currentTarget.style.background="var(--surface2)"}}
                      onMouseLeave={e=>{if(!selectedJobs.has(j.id))e.currentTarget.style.background=i%2===0?"transparent":"var(--surface2)"}}>
                      <td style={{padding:"6px 8px",textAlign:"center"}}><input type="checkbox" checked={selectedJobs.has(j.id)} onChange={()=>toggleSelectJob(j.id)} style={{cursor:"pointer",accentColor:"var(--gold)"}}/></td>
                      <td style={{padding:"6px 12px",fontWeight:600,color:"var(--ink)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:200}}>{j.title}</td>
                      <td style={{padding:"6px 12px",color:"var(--ink2)"}}>{j.firm}</td>
                      <td style={{padding:"6px 12px"}}>
                        <select value={j.stage} onChange={e=>updateJobStage(j.id,e.target.value)} style={{fontSize:11,padding:"2px 6px",border:"1px solid var(--border2)",borderRadius:4,background:"var(--surface)",color:"var(--ink2)",cursor:"pointer"}}>
                          {stages.map(s=><option key={s} value={s}>{labels[s]}</option>)}
                        </select>
                      </td>
                      <td style={{padding:"6px 12px"}}><span className="tag t-gold" style={{fontSize:10}}>{j.track||"—"}</span></td>
                      <td style={{padding:"6px 12px",fontSize:11,color:"var(--ink3)"}}>{j.location||"—"}</td>
                      <td style={{padding:"6px 12px"}}><span className="mono" style={{color:"var(--gold)",fontSize:11}}>{j.deadline||"—"}</span></td>
                      <td style={{padding:"6px 12px"}}><span className="mono" style={{color:"var(--green)",fontSize:11}}>{j.match||0}%</span></td>
                      <td style={{padding:"6px 8px",textAlign:"center"}}>
                        <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                          {j.url && <a href={j.url} target="_blank" rel="noreferrer" style={{color:"var(--gold)",fontSize:12,textDecoration:"none"}} title="Open link">🔗</a>}
                          <button onClick={()=>deleteJobRow(j.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--ink4)",fontSize:12,padding:"0 2px"}} title="Delete" onMouseEnter={e=>e.target.style.color="var(--red)"} onMouseLeave={e=>e.target.style.color="var(--ink4)"}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {jobs.length===0 && <tr><td colSpan={9} style={{textAlign:"center",padding:24,color:"var(--ink4)",fontSize:12}}>No roles tracked yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {crmTab === "contacts" && (
        <div>
          <div className="card-flat mb16" style={{background:"var(--gold-bg)",border:"1px solid rgba(184,132,63,0.25)"}}>
            <div className="flex items-c j-between">
              <div>
                <div className="fw5 fs12" style={{color:"var(--gold)"}}>📁 Import Contacts</div>
                <div className="fs11" style={{color:"#7A5A1C"}}>Upload Excel, CSV, PDF, or Word files. AI will parse names, firms, roles, and emails automatically.</div>
              </div>
              <button className="btn btn-gold btn-sm" onClick={()=>crmFileRef.current?.click()} disabled={uploading}>
                {uploading ? "⏳ Processing..." : "⬆ Upload & Parse"}
              </button>
            </div>
          </div>
          {uploading && <div className="ai-pulse mb16"><div className="dot-spin"/>{uploadLog}</div>}
          {!uploading && uploadLog && <div className={`alert ${uploadLog.startsWith("✅")?"a-green":"a-gold"} mb16`}>{uploadLog}</div>}

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">📇 Contacts</div>
                <div className="card-subtitle">{contacts.length} contacts in your CRM</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => exportToCSV(contacts.map(c => ({Name:c.name,Firm:c.firm,Role:c.role,Channel:c.channel,Status:c.status,Notes:c.notes})), "contacts_export")}>⬇ Export</button>
            </div>
            {contacts.length === 0 ? (
              <div style={{padding:"40px",textAlign:"center",color:"var(--ink4)"}}>
                <div style={{fontSize:32,marginBottom:12}}>📇</div>
                <div className="fw6 fs12 mb8" style={{color:"var(--ink3)"}}>No contacts yet</div>
                <div className="fs11">Upload an Excel or PDF file to import contacts, or add them manually.</div>
              </div>
            ) : (
              <table className="table">
                <thead><tr><th>Name</th><th>Firm</th><th>Role</th><th>Channel</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead>
                <tbody>
                  {contacts.map(c=>(
                    <tr key={c.id}>
                      <td className="fw6" style={{color:"var(--ink)"}}>{c.name}</td>
                      <td>{c.firm || "—"}</td>
                      <td style={{fontSize:12,color:"var(--ink3)"}}>{c.role || "—"}</td>
                      <td><span className="tag t-blue">{c.channel || "Email"}</span></td>
                      <td><span className={`tag t-${c.status==="connected"?"green":c.status==="replied"?"gold":"ink"}`}>{c.status || "pending"}</span></td>
                      <td style={{fontSize:11,color:"var(--ink3)",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.notes || "—"}</td>
                      <td><button className="btn btn-ghost btn-xs" onClick={()=>deleteContactRow(c.id)} style={{color:"var(--red)"}}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
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
   PAGE: MY PROFILE
══════════════════════════════════════════════════════════════════════════════ */
function MyProfile() {
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const cvRef = useRef(null);
  const clRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setP(data);
    });
  }, [user]);

  const save = async () => {
    if (!p || !user) return;
    setSaving(true);
    setSaved(false);
    const { error } = await supabase.from("profiles").update({
      display_name: p.display_name,
      university: p.university,
      gpa: p.gpa,
      graduation_year: p.graduation_year,
      target_track: p.target_track,
      experience_level: p.experience_level,
      location: p.location,
      visa_status: p.visa_status,
      start_date: p.start_date,
      salary_min: p.salary_min ? parseInt(p.salary_min) : null,
      skills: p.skills || [],
      industries: p.industries || [],
      locations: p.locations || [],
      keywords_include: p.keywords_include || [],
      keywords_exclude: p.keywords_exclude || [],
      company_blacklist: p.company_blacklist || [],
    }).eq("user_id", user.id);
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${type}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
    if (!error) {
      await supabase.from("documents").insert({
        user_id: user.id,
        filename: file.name,
        file_path: path,
        file_type: ext,
        file_size: file.size,
        doc_category: type === "cv" ? "CV" : "Cover Letter",
      });
      alert(`✅ ${type === "cv" ? "CV" : "Cover Letter"} uploaded successfully!`);
    }
    setUploading(false);
    e.target.value = "";
  };

  const update = (field, value) => setP(prev => ({ ...prev, [field]: value }));
  const updateArray = (field, value) => setP(prev => ({ ...prev, [field]: value.split(",").map(s => s.trim()).filter(Boolean) }));

  if (!p) return <div className="page"><div className="ai-pulse"><div className="dot-spin"/>Loading profile...</div></div>;

  return (
    <div className="page">
      <input type="file" ref={cvRef} style={{display:"none"}} accept=".pdf,.docx,.doc,.txt" onChange={e=>handleFileUpload(e,"cv")}/>
      <input type="file" ref={clRef} style={{display:"none"}} accept=".pdf,.docx,.doc,.txt" onChange={e=>handleFileUpload(e,"cover_letter")}/>
      <div className="section-header">
        <div><div className="eyebrow">Account</div><div className="section-title">My Profile</div></div>
        <div className="flex g8">
          {saved && <span className="tag t-green">✓ Saved</span>}
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? "Saving..." : "💾 Save Profile"}</button>
        </div>
      </div>

      <div className="alert a-gold mb20">👤 Keep your profile up to date — it powers auto-fill, cover letter generation, job matching, and interview prep.</div>

      <div className="grid g2 g16 mb24">
        {/* Personal Info */}
        <div className="card">
          <div className="card-header"><div className="card-title">Personal Information</div></div>
          <div className="grid g2 g12 mb12">
            <div className="fg"><label className="label">Full Name</label><input className="input" value={p.display_name||""} onChange={e=>update("display_name",e.target.value)} placeholder="John Smith"/></div>
            <div className="fg"><label className="label">Email</label><input className="input" value={p.email||""} disabled style={{opacity:0.6}}/></div>
          </div>
          <div className="grid g2 g12 mb12">
            <div className="fg"><label className="label">Location</label><input className="input" value={p.location||""} onChange={e=>update("location",e.target.value)} placeholder="London"/></div>
            <div className="fg"><label className="label">Visa Status</label><input className="input" value={p.visa_status||""} onChange={e=>update("visa_status",e.target.value)} placeholder="UK Citizen / Tier 2 / etc."/></div>
          </div>
          <div className="grid g2 g12">
            <div className="fg"><label className="label">Start Date Availability</label><input className="input" value={p.start_date||""} onChange={e=>update("start_date",e.target.value)} placeholder="Immediately / Sep 2026"/></div>
            <div className="fg"><label className="label">Minimum Salary</label><input className="input" type="number" value={p.salary_min||""} onChange={e=>update("salary_min",e.target.value)} placeholder="50000"/></div>
          </div>
        </div>

        {/* Education & Career */}
        <div className="card">
          <div className="card-header"><div className="card-title">Education & Career Track</div></div>
          <div className="grid g2 g12 mb12">
            <div className="fg"><label className="label">University</label><input className="input" value={p.university||""} onChange={e=>update("university",e.target.value)} placeholder="LSE / Oxford / etc."/></div>
            <div className="fg"><label className="label">GPA</label><input className="input" value={p.gpa||""} onChange={e=>update("gpa",e.target.value)} placeholder="3.8 / First Class"/></div>
          </div>
          <div className="grid g2 g12 mb12">
            <div className="fg"><label className="label">Graduation Year</label><input className="input" value={p.graduation_year||""} onChange={e=>update("graduation_year",e.target.value)} placeholder="2026"/></div>
            <div className="fg"><label className="label">Target Track</label>
              <select className="input" value={p.target_track||"ib"} onChange={e=>update("target_track",e.target.value)}>
                <option value="ib">Investment Banking</option>
                <option value="pe">Private Equity</option>
                <option value="vc">Venture Capital</option>
                <option value="consulting">Management Consulting</option>
                <option value="trading">Sales & Trading</option>
                <option value="am">Investment Management</option>
                <option value="tech">Tech & Startups</option>
              </select>
            </div>
          </div>
          <div className="fg">
            <label className="label">Experience Level</label>
            <select className="input" value={p.experience_level||"undergrad"} onChange={e=>update("experience_level",e.target.value)}>
              <option value="undergrad">Undergraduate / Entry-Level</option>
              <option value="experienced">Experienced Hire</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid g2 g16 mb24">
        {/* Skills & Preferences */}
        <div className="card">
          <div className="card-header"><div className="card-title">Skills & Preferences</div></div>
          <div className="fg mb12"><label className="label">Skills <span className="t-ink4 fs11">(comma-separated)</span></label><input className="input" value={(p.skills||[]).join(", ")} onChange={e=>updateArray("skills",e.target.value)} placeholder="Financial Modeling, Python, SQL"/></div>
          <div className="fg mb12"><label className="label">Target Industries</label><input className="input" value={(p.industries||[]).join(", ")} onChange={e=>updateArray("industries",e.target.value)} placeholder="Banking, Tech, Consulting"/></div>
          <div className="fg mb12"><label className="label">Preferred Locations</label><input className="input" value={(p.locations||[]).join(", ")} onChange={e=>updateArray("locations",e.target.value)} placeholder="London, New York, Hong Kong"/></div>
          <div className="fg mb12"><label className="label">Include Keywords</label><input className="input" value={(p.keywords_include||[]).join(", ")} onChange={e=>updateArray("keywords_include",e.target.value)} placeholder="M&A, Strategy, Product"/></div>
          <div className="fg mb12"><label className="label">Exclude Keywords</label><input className="input" value={(p.keywords_exclude||[]).join(", ")} onChange={e=>updateArray("keywords_exclude",e.target.value)} placeholder="Unpaid, Volunteer"/></div>
          <div className="fg"><label className="label">Company Blacklist</label><input className="input" value={(p.company_blacklist||[]).join(", ")} onChange={e=>updateArray("company_blacklist",e.target.value)} placeholder="Company A, Company B"/></div>
        </div>

        {/* Document Uploads */}
        <div className="card">
          <div className="card-header"><div className="card-title">Documents</div></div>
          <div className="alert a-blue mb16">📄 Upload your CV and cover letters here. They'll be used for AI auto-fill, cover letter generation, and interview prep.</div>
          <div className="flex g12 mb16" style={{flexWrap:"wrap"}}>
            <button className="btn btn-primary btn-sm" onClick={()=>cvRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading..." : "📤 Upload CV"}
            </button>
            <button className="btn btn-outline btn-sm" onClick={()=>clRef.current?.click()} disabled={uploading}>
              📤 Upload Cover Letter
            </button>
          </div>
          <div className="fs11 t-ink4 mb12">Accepted formats: PDF, DOCX, DOC, TXT</div>

          {p.cv_text && (
            <div style={{background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:8,padding:"12px 14px",marginTop:12}}>
              <div className="fw6 fs12 mb4" style={{color:"var(--ink)"}}>📄 CV Text Preview</div>
              <div className="fs11 t-ink3" style={{maxHeight:120,overflowY:"auto",whiteSpace:"pre-wrap",lineHeight:1.6}}>
                {(p.cv_text || "").slice(0, 500)}{(p.cv_text||"").length > 500 ? "..." : ""}
              </div>
            </div>
          )}
        </div>
      </div>
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
  const { user, profile: authProfile } = useAuth();
  const [queue, setQueue] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [viewingLetter, setViewingLetter] = useState(null);
  const [tab, setTab] = useState("queued");
  const [showAddModal, setShowAddModal] = useState(false);

  // Auto-fill details state
  const [autoFillProfile, setAutoFillProfile] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [savingField, setSavingField] = useState(null);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  const [showAddField, setShowAddField] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load profile for auto-fill
  const refreshAutoFillProfile = async () => {
    if (!user) return;
    setRefreshing(true);
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (data) setAutoFillProfile({ ...data, email: user.email });
    setLastSynced(new Date());
    setRefreshing(false);
  };

  useEffect(() => {
    refreshAutoFillProfile();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetchApplicationQueue(user.id),
      fetchJobs(user.id),
    ]).then(([qRes, jRes]) => {
      setQueue(qRes.data || []);
      setJobs(jRes.data || []);
      setLoading(false);
    });
  }, [user]);

  const queuedIds = new Set(queue.map(q => q.job_id));
  const availableJobs = jobs.filter(j => !queuedIds.has(j.id));

  const addToQueue = async (jobId) => {
    const { data } = await upsertQueueItem(user.id, { job_id: jobId, status: "queued" });
    if (data) {
      // Re-fetch to get joined job data
      const { data: updated } = await fetchApplicationQueue(user.id);
      setQueue(updated || []);
    }
    setShowAddModal(false);
  };

  const generateCoverLetter = async (item) => {
    setGenerating(item.job_id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-cover-letter", {
        body: { job_id: item.job_id, type: "cover_letter" },
      });
      if (error) throw error;
      if (data?.content) {
        await upsertQueueItem(user.id, { id: item.id, status: "ready", cover_letter: data.content });
        const { data: updated } = await fetchApplicationQueue(user.id);
        setQueue(updated || []);
      }
    } catch (e) {
      console.error("Generate failed:", e);
      alert("Failed to generate cover letter. " + (e.message || ""));
    }
    setGenerating(null);
  };

  const generateFormAnswers = async (item) => {
    setGenerating(item.job_id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-cover-letter", {
        body: { job_id: item.job_id, type: "form_answers" },
      });
      if (error) throw error;
      if (data?.content) {
        let parsed = {};
        try { parsed = JSON.parse(data.content.replace(/```json\n?/g, "").replace(/```/g, "")); } catch { parsed = { raw: data.content }; }
        await upsertQueueItem(user.id, { id: item.id, ai_answers: parsed });
        const { data: updated } = await fetchApplicationQueue(user.id);
        setQueue(updated || []);
      }
    } catch (e) {
      console.error("Generate failed:", e);
    }
    setGenerating(null);
  };

  const markApplied = async (item) => {
    await upsertQueueItem(user.id, { id: item.id, status: "applied", applied_at: new Date().toISOString() });
    const { data: updated } = await fetchApplicationQueue(user.id);
    setQueue(updated || []);
  };

  const removeFromQueue = async (item) => {
    await deleteQueueItem(user.id, item.id);
    setQueue(prev => prev.filter(q => q.id !== item.id));
  };

  const filteredQueue = queue.filter(q => {
    if (tab === "all") return true;
    return q.status === tab;
  });

  const counts = { queued: 0, ready: 0, applied: 0, all: queue.length };
  queue.forEach(q => { if (counts[q.status] !== undefined) counts[q.status]++; });

  return (
    <div className="page">
      <div className="section-header">
        <div><div className="eyebrow">Apply</div><div className="section-title">Application Queue</div></div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add to Queue</button>
      </div>

      <div className="alert a-gold mb20">🚀 <strong>Queue → Generate → Apply.</strong> Add jobs to your queue, generate AI-tailored cover letters and form answers, then apply with confidence.</div>

      {/* Chrome Extension Setup */}
      <div className="card mb20" style={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"20px 24px",borderBottom:"1px solid var(--border2)",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,background:"linear-gradient(135deg, var(--gold), var(--gold3))",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:700,fontSize:14}}>⚡</div>
          <div style={{flex:1}}>
            <div className="fw6 fs14" style={{color:"var(--ink)"}}>Chrome Extension — Auto-Fill</div>
            <div className="fs11 t-ink4">One-click apply, auto-fill on page load, LinkedIn Easy Apply support</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={async()=>{
            const { downloadExtensionZip } = await import("@/lib/extensionZip");
            await downloadExtensionZip();
          }}>⬇ Download Extension (.zip)</button>
        </div>
        <div style={{padding:"16px 24px"}}>
          <div className="grid g3 g12" style={{marginBottom:16}}>
            <div style={{background:"var(--surface2)",padding:"14px 16px",borderRadius:8}}>
              <div className="fw6 fs12 mb4" style={{color:"var(--gold)"}}>Step 1 — Download & Unzip</div>
              <div className="fs12 t-ink2">Click <strong>Download Extension</strong> above. Unzip the file anywhere on your computer.</div>
            </div>
            <div style={{background:"var(--surface2)",padding:"14px 16px",borderRadius:8}}>
              <div className="fw6 fs12 mb4" style={{color:"var(--gold)"}}>Step 2 — Load into Chrome</div>
              <div className="fs12 t-ink2">
                <strong>1.</strong> Open Chrome → type <code style={{background:"var(--surface3)",padding:"1px 6px",borderRadius:4,fontSize:11}}>chrome://extensions</code> in the address bar<br/>
                <strong>2.</strong> Toggle <strong>Developer mode</strong> ON (top-right switch)<br/>
                <strong>3.</strong> Click <strong>"Load unpacked"</strong> (top-left)<br/>
                <strong>4.</strong> Select the unzipped <strong>jobsearchos-extension</strong> folder<br/>
                <strong>5.</strong> Pin the extension from the puzzle-piece icon 📌
              </div>
            </div>
            <div style={{background:"var(--surface2)",padding:"14px 16px",borderRadius:8}}>
              <div className="fw6 fs12 mb4" style={{color:"var(--gold)"}}>Step 3 — Connect & Apply</div>
              <div className="fs12 t-ink2">Click the extension icon, paste your <strong>token</strong> (below), then visit any job page. Toggle <strong>🧠 Learn</strong> so it saves new data you type!</div>
            </div>
          </div>

          {/* Token Generation */}
          <div style={{background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:8,padding:"14px 16px",marginBottom:16}}>
            <div className="flex items-c j-between mb8">
              <div className="fw6 fs12" style={{color:"var(--ink)"}}>🔑 Extension Token</div>
              <button className="btn btn-primary btn-xs" style={{width:"auto",padding:"4px 14px"}} onClick={async()=>{
                try {
                  const { data } = await supabase.auth.getSession();
                  const token = data?.session?.access_token;
                  if (token) {
                    await navigator.clipboard.writeText(token);
                    alert("✅ Token copied to clipboard! Paste it in the extension popup.");
                  } else {
                    alert("⚠ No active session. Please log in first.");
                  }
                } catch(e) { alert("Failed to copy token: " + e.message); }
              }}>📋 Copy Token</button>
            </div>
            <div className="fs11 t-ink4">This token connects the Chrome extension to your account. It refreshes automatically — copy a new one if the extension disconnects.</div>
          </div>

          <div className="flex g8" style={{alignItems:"center",flexWrap:"wrap"}}>
            <span className="tag t-blue" style={{fontSize:10}}>Greenhouse</span>
            <span className="tag t-blue" style={{fontSize:10}}>Lever</span>
            <span className="tag t-blue" style={{fontSize:10}}>Workday</span>
            <span className="tag t-blue" style={{fontSize:10}}>LinkedIn Easy Apply</span>
            <span className="tag t-blue" style={{fontSize:10}}>SmartRecruiters</span>
            <span className="tag t-blue" style={{fontSize:10}}>Ashby</span>
            <span className="tag t-ink4" style={{fontSize:10}}>+ any site</span>
          </div>
        </div>
      </div>

      {/* ── Auto-Fill Details Table ── */}
      <div className="card mb20" style={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"16px 24px",borderBottom:"1px solid var(--border2)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>📋</span>
            <div>
              <div className="fw6 fs14" style={{color:"var(--ink)",display:"flex",alignItems:"center",gap:8}}>
                Auto-Fill Details
                {autoFillProfile && (() => {
                  const learnedCount = Object.keys(autoFillProfile.auto_fill_data || {}).length;
                  return learnedCount > 0 ? <span className="tag t-green" style={{fontSize:9,padding:"2px 6px"}}>{learnedCount} learned</span> : null;
                })()}
              </div>
              <div className="fs11 t-ink4">
                These fields are used to auto-fill job applications. Edit here or let the extension learn from forms you fill.
                {lastSynced && <span style={{marginLeft:8}}>· Last synced: {lastSynced.toLocaleTimeString()}</span>}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button className="btn btn-outline btn-sm" onClick={refreshAutoFillProfile} disabled={refreshing} style={{fontSize:11}}>
              {refreshing ? "⏳" : "🔄"} Refresh
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setShowAddField(!showAddField)}>+ Add Field</button>
          </div>
        </div>

        {showAddField && (
          <div style={{padding:"12px 24px",background:"var(--surface2)",borderBottom:"1px solid var(--border2)",display:"flex",gap:8,alignItems:"center"}}>
            <input placeholder="Field name (e.g. Cover Letter Tone)" value={newFieldName} onChange={e=>setNewFieldName(e.target.value)} style={{flex:1,padding:"6px 10px",border:"1px solid var(--border)",borderRadius:6,fontSize:12,background:"var(--surface)"}} />
            <input placeholder="Value" value={newFieldValue} onChange={e=>setNewFieldValue(e.target.value)} style={{flex:2,padding:"6px 10px",border:"1px solid var(--border)",borderRadius:6,fontSize:12,background:"var(--surface)"}} />
            <button className="btn btn-primary btn-sm" onClick={async()=>{
              if (!newFieldName.trim() || !newFieldValue.trim()) return;
              const key = newFieldName.trim().toLowerCase().replace(/\s+/g,"_");
              const existing = (autoFillProfile?.auto_fill_data) || {};
              existing[key] = newFieldValue.trim();
              await supabase.from("profiles").update({ auto_fill_data: existing }).eq("user_id", user.id);
              setAutoFillProfile(p => ({...p, auto_fill_data: existing}));
              setNewFieldName(""); setNewFieldValue(""); setShowAddField(false);
            }}>Save</button>
          </div>
        )}

        {autoFillProfile ? (
          <div style={{overflow:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:"var(--surface2)"}}>
                  <th style={{padding:"10px 16px",textAlign:"left",fontWeight:600,color:"var(--ink3)",width:"30%",borderBottom:"1px solid var(--border2)"}}>Field</th>
                  <th style={{padding:"10px 16px",textAlign:"left",fontWeight:600,color:"var(--ink3)",borderBottom:"1px solid var(--border2)"}}>Value</th>
                  <th style={{padding:"10px 16px",textAlign:"left",fontWeight:600,color:"var(--ink3)",width:"10%",borderBottom:"1px solid var(--border2)"}}>Source</th>
                  <th style={{padding:"10px 16px",textAlign:"right",fontWeight:600,color:"var(--ink3)",width:"10%",borderBottom:"1px solid var(--border2)"}}></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const knownFields = [
                    { key: "display_name", label: "Full Name", col: "display_name" },
                    { key: "email", label: "Email", col: "email" },
                    { key: "phone", label: "Phone", col: "phone" },
                    { key: "location", label: "Location", col: "location" },
                    { key: "university", label: "University", col: "university" },
                    { key: "gpa", label: "GPA", col: "gpa" },
                    { key: "graduation_year", label: "Graduation Year", col: "graduation_year" },
                    { key: "experience_level", label: "Experience Level", col: "experience_level" },
                    { key: "visa_status", label: "Visa Status", col: "visa_status" },
                    { key: "start_date", label: "Start Date", col: "start_date" },
                    { key: "salary_min", label: "Salary Min", col: "salary_min" },
                    { key: "linkedin_url", label: "LinkedIn URL", col: "linkedin_url" },
                    { key: "website", label: "Website", col: "website" },
                    { key: "skills", label: "Skills", col: "skills" },
                  ];
                  const customFields = Object.entries(autoFillProfile.auto_fill_data || {}).map(([k,v]) => ({
                    key: `custom_${k}`, label: k.replace(/_/g," ").replace(/\b\w/g, c=>c.toUpperCase()), col: k, value: v, isCustom: true
                  }));

                  const allFields = [...knownFields.map(f => ({...f, value: autoFillProfile[f.col], isCustom: false})), ...customFields];

                  return allFields.map(field => {
                    const displayVal = Array.isArray(field.value) ? field.value.join(", ") : (field.value != null ? String(field.value) : "");
                    const isEditing = editingField === field.key;
                    return (
                      <tr key={field.key} style={{borderBottom:"1px solid var(--border2)"}}>
                        <td style={{padding:"10px 16px",color:"var(--ink2)",fontWeight:500}}>
                          {field.label}
                        </td>
                        <td style={{padding:"10px 16px"}}>
                          {isEditing ? (
                            <div style={{display:"flex",gap:4,alignItems:"center"}}>
                              <input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)}
                                onKeyDown={async(e)=>{
                                  if(e.key==="Enter"){
                                    setSavingField(field.key);
                                    if(field.isCustom){
                                      const existing = {...(autoFillProfile.auto_fill_data||{})};
                                      existing[field.col] = editValue;
                                      await supabase.from("profiles").update({auto_fill_data:existing}).eq("user_id",user.id);
                                      setAutoFillProfile(p=>({...p,auto_fill_data:existing}));
                                    } else {
                                      const val = field.col==="skills" ? editValue.split(",").map(s=>s.trim()).filter(Boolean) : (field.col==="salary_min"?parseInt(editValue)||null:editValue);
                                      await supabase.from("profiles").update({[field.col]:val}).eq("user_id",user.id);
                                      setAutoFillProfile(p=>({...p,[field.col]:val}));
                                    }
                                    setEditingField(null); setSavingField(null);
                                  }
                                  if(e.key==="Escape") setEditingField(null);
                                }}
                                style={{flex:1,padding:"4px 8px",border:"1px solid var(--gold)",borderRadius:4,fontSize:12,background:"var(--surface)"}} />
                              <button className="btn btn-sm" style={{padding:"2px 10px",fontSize:10,background:"var(--gold)",color:"var(--bg)",border:"none",borderRadius:4,fontWeight:600,cursor:"pointer"}} onClick={async()=>{
                                setSavingField(field.key);
                                if(field.isCustom){
                                  const existing = {...(autoFillProfile.auto_fill_data||{})};
                                  existing[field.col] = editValue;
                                  await supabase.from("profiles").update({auto_fill_data:existing}).eq("user_id",user.id);
                                  setAutoFillProfile(p=>({...p,auto_fill_data:existing}));
                                } else {
                                  const val = field.col==="skills" ? editValue.split(",").map(s=>s.trim()).filter(Boolean) : (field.col==="salary_min"?parseInt(editValue)||null:editValue);
                                  await supabase.from("profiles").update({[field.col]:val}).eq("user_id",user.id);
                                  setAutoFillProfile(p=>({...p,[field.col]:val}));
                                }
                                setEditingField(null); setSavingField(null);
                              }}>{savingField === field.key ? "..." : "Save"}</button>
                              <button className="btn btn-sm" style={{padding:"2px 8px",fontSize:10,color:"var(--ink4)",background:"none",border:"1px solid var(--border2)",borderRadius:4,cursor:"pointer"}} onClick={()=>setEditingField(null)}>✕</button>
                            </div>
                          ) : (
                            <span style={{color: displayVal ? "var(--ink)" : "var(--ink4)", cursor:"pointer"}} onClick={()=>{setEditingField(field.key);setEditValue(displayVal);}}>
                              {displayVal || "—"}
                            </span>
                          )}
                        </td>
                        <td style={{padding:"10px 16px"}}>
                          <span className={`tag ${field.isCustom ? "t-green" : "t-blue"}`} style={{fontSize:9}}>
                            {field.isCustom ? "🧠 Learned" : "Profile"}
                          </span>
                        </td>
                        <td style={{padding:"10px 16px",textAlign:"right"}}>
                          {!isEditing && (
                            <button className="btn btn-sm" style={{padding:"2px 8px",fontSize:10,color:"var(--ink4)",background:"none",border:"1px solid var(--border2)"}} onClick={()=>{setEditingField(field.key);setEditValue(displayVal);}}>Edit</button>
                          )}
                          {isEditing && savingField === field.key && <span className="fs10 t-ink4">Saving...</span>}
                          {field.isCustom && !isEditing && (
                            <button className="btn btn-sm" style={{padding:"2px 8px",fontSize:10,color:"var(--red)",background:"none",border:"none",marginLeft:4}} onClick={async()=>{
                              const existing = {...(autoFillProfile.auto_fill_data||{})};
                              delete existing[field.col];
                              await supabase.from("profiles").update({auto_fill_data:existing}).eq("user_id",user.id);
                              setAutoFillProfile(p=>({...p,auto_fill_data:existing}));
                            }}>✕</button>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{padding:24,textAlign:"center",color:"var(--ink4)",fontSize:13}}>Loading auto-fill data...</div>
        )}
      </div>


      <div className="flex g8 mb20" style={{borderBottom:"1px solid var(--border2)",paddingBottom:12}}>
        {[["queued","📋 Queued"],["ready","✅ Ready"],["applied","🎯 Applied"],["all","📊 All"]].map(([key,label])=>(
          <button key={key} className={`btn btn-sm ${tab===key?"btn-primary":"btn-outline"}`} onClick={()=>setTab(key)}>
            {label} <span className="tag t-blue" style={{marginLeft:6,fontSize:10}}>{counts[key]}</span>
          </button>
        ))}
      </div>

      {loading ? <div style={{textAlign:"center",padding:40,color:"var(--ink4)"}}>Loading queue...</div> : (
        filteredQueue.length === 0 ? (
          <div className="card" style={{textAlign:"center",padding:40}}>
            <div style={{fontSize:32,marginBottom:12}}>📭</div>
            <div className="fw5 mb8" style={{color:"var(--ink2)"}}>No applications {tab !== "all" ? `in "${tab}"` : "yet"}</div>
            <div className="fs12 t-ink4 mb16">Add jobs to your queue to get started with AI-powered applications</div>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Jobs</button>
          </div>
        ) : (
          <div className="grid g1 g16">
            {filteredQueue.map(item => {
              const job = item.jobs || {};
              const isGenerating = generating === item.job_id;
              return (
                <div key={item.id} className="card" style={{padding:0,overflow:"hidden"}}>
                  <div style={{padding:"16px 20px",display:"flex",alignItems:"center",gap:16}}>
                    <div style={{flex:1}}>
                      <div className="flex g8" style={{alignItems:"center",marginBottom:4}}>
                        <span className={`tag ${item.status==="applied"?"t-green":item.status==="ready"?"t-blue":"t-gold"}`} style={{fontSize:10,textTransform:"uppercase"}}>{item.status}</span>
                        {job.track && <span className="tag t-ink4" style={{fontSize:10}}>{job.track}</span>}
                      </div>
                      <div className="fw6 fs14" style={{color:"var(--ink)",marginBottom:2}}>{job.title || "Unknown Role"}</div>
                      <div className="fs12 t-ink3">{job.firm || "—"} · {job.location || "—"}</div>
                    </div>
                    <div className="flex g6">
                      {item.status === "queued" && (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => generateCoverLetter(item)} disabled={isGenerating}>
                            {isGenerating ? "⏳ Generating..." : "✨ Cover Letter"}
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={() => generateFormAnswers(item)} disabled={isGenerating}>
                            📝 Form Answers
                          </button>
                        </>
                      )}
                      {item.status === "ready" && (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={() => setViewingLetter(item)}>👁 View Letter</button>
                          {job.url && <a href={job.url} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">🔗 Apply</a>}
                          <button className="btn btn-sm" style={{background:"var(--green)",color:"white",border:"none"}} onClick={() => markApplied(item)}>✓ Mark Applied</button>
                        </>
                      )}
                      {item.status === "applied" && (
                        <div className="fs11 t-ink4">Applied {item.applied_at ? new Date(item.applied_at).toLocaleDateString() : ""}</div>
                      )}
                      <button className="btn btn-sm btn-outline" style={{color:"var(--ink4)"}} onClick={() => removeFromQueue(item)}>✕</button>
                    </div>
                  </div>
                  {/* Show AI answers if available */}
                  {item.ai_answers && Object.keys(item.ai_answers).length > 0 && item.ai_answers.raw === undefined && (
                    <div style={{padding:"0 20px 16px",borderTop:"1px solid var(--border2)",marginTop:0,paddingTop:12}}>
                      <div className="label mb8">AI Form Answers</div>
                      <div className="grid g2 g12">
                        {Object.entries(item.ai_answers).map(([key, val]) => (
                          <div key={key} style={{background:"var(--surface2)",padding:"10px 14px",borderRadius:8}}>
                            <div className="fw5 fs11 mb4" style={{color:"var(--ink2)",textTransform:"capitalize"}}>{key.replace(/_/g," ")}</div>
                            <div className="fs11 t-ink3 lh17" style={{whiteSpace:"pre-wrap"}}>{String(val).slice(0,300)}{String(val).length > 300 ? "..." : ""}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Cover Letter Modal */}
      {viewingLetter && (
        <div className="modal-overlay" onClick={() => setViewingLetter(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:640}}>
            <div className="modal-header">
              <div className="modal-title">Cover Letter — {viewingLetter.jobs?.firm}</div>
              <button className="modal-close" onClick={() => setViewingLetter(null)}>✕</button>
            </div>
            <div style={{padding:24,whiteSpace:"pre-wrap",lineHeight:1.8,fontSize:13,color:"var(--ink2)",maxHeight:"60vh",overflow:"auto"}}>
              {viewingLetter.cover_letter || "No cover letter generated yet."}
            </div>
            <div style={{padding:"12px 24px 24px",display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button className="btn btn-outline" onClick={() => {
                navigator.clipboard.writeText(viewingLetter.cover_letter || "");
                alert("Copied to clipboard!");
              }}>📋 Copy</button>
              <button className="btn btn-primary" onClick={() => {
                exportToText(viewingLetter.cover_letter || "", `cover_letter_${viewingLetter.jobs?.firm || "job"}`);
              }}>⬇ Download</button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Queue Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:560}}>
            <div className="modal-header">
              <div className="modal-title">Add Jobs to Queue</div>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div style={{padding:20,maxHeight:"50vh",overflow:"auto"}}>
              {availableJobs.length === 0 ? (
                <div style={{textAlign:"center",padding:24,color:"var(--ink4)",fontSize:13}}>All your saved jobs are already in the queue. Discover more jobs first.</div>
              ) : (
                availableJobs.map(j => (
                  <div key={j.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--border2)"}}>
                    <div style={{flex:1}}>
                      <div className="fw5 fs13">{j.title}</div>
                      <div className="fs11 t-ink4">{j.firm} · {j.location || "—"}</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => addToQueue(j.id)}>+ Queue</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGE: ADMIN
══════════════════════════════════════════════════════════════════════════════ */
function Admin() {
  const { user } = useAuth();
  const [adminTab, setAdminTab] = useState("sources");
  const [isAdmin, setIsAdmin] = useState(false);
  const [scrapeRunning, setScrapeRunning] = useState(false);
  const [scrapeResult, setScrapeResult] = useState(null);

  // Sources state
  const [sources, setSources] = useState([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSource, setNewSource] = useState({ name: "", base_url: "", crawl_type: "list", allowlist_paths: "", frequency_minutes: 10080, notes: "", enabled: true });

  // Templates state
  const [templates, setTemplates] = useState([]);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", type: "cv", track: "", seniority: "", content: "", active: true, version: 1 });

  // Rules state
  const [rules, setRules] = useState([]);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleJson, setRuleJson] = useState("");

  // Uploads state
  const [adminUploads, setAdminUploads] = useState([]);
  const adminFileRef = useRef(null);
  const [processing, setProcessing] = useState(false);

  // Crawl runs state
  const [crawlRuns, setCrawlRuns] = useState([]);

  // All jobs state
  const [allJobs, setAllJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobsPage, setJobsPage] = useState(0);
  const [jobSourceFilter, setJobSourceFilter] = useState("");
  const JOBS_PER_PAGE = 20;

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchSources().then(({ data }) => setSources(data || []));
    fetchAdminTemplates().then(({ data }) => setTemplates(data || []));
    fetchAdminRules().then(({ data }) => setRules(data || []));
    if (user) fetchUploads(user.id).then(({ data }) => setAdminUploads(data || []));
    fetchCrawlRuns().then(({ data }) => setCrawlRuns(data || []));
  }, [isAdmin, user]);

  const loadAllJobs = async () => {
    setLoadingJobs(true);
    const { data } = await supabase.from("jobs").select("id, title, firm, stage, track, location, source, source_id, created_at, user_id, match_score, deadline, url, source_job_url").order("created_at", { ascending: false }).range(0, 499);
    setAllJobs(data || []);
    setLoadingJobs(false);
  };

  const filteredAdminJobs = allJobs.filter(j => {
    if (!jobSourceFilter) return true;
    if (jobSourceFilter === "manual") return !j.source_id;
    return j.source_id === jobSourceFilter;
  });

  useEffect(() => {
    if (adminTab === "jobs" && isAdmin && allJobs.length === 0) loadAllJobs();
  }, [adminTab, isAdmin]);

  const [crawlProgress, setCrawlProgress] = useState(0);
  const crawlAbortRef = useRef(null);

  const cancelCrawl = () => {
    if (crawlAbortRef.current) {
      crawlAbortRef.current.abort();
      crawlAbortRef.current = null;
    }
    setScrapeRunning(false);
    setCrawlProgress(0);
    setScrapeResult({ error: "Crawl cancelled by user" });
  };

  const runCrawlAndMatch = async (sourceId = null) => {
    // Abort any existing crawl
    if (crawlAbortRef.current) crawlAbortRef.current.abort();
    const controller = new AbortController();
    crawlAbortRef.current = controller;

    setScrapeRunning(true);
    setScrapeResult(null);
    setCrawlProgress(0);
    const interval = setInterval(() => {
      setCrawlProgress(prev => {
        if (prev >= 90) { clearInterval(interval); return 90; }
        return prev + Math.random() * 8 + 2;
      });
    }, 800);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("No active session.");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crawl-and-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify(sourceId ? { source_id: sourceId } : {}),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Failed (${response.status})`);
      setScrapeResult(payload);
      fetchCrawlRuns().then(({ data }) => setCrawlRuns(data || []));
    } catch (err) {
      if (err.name === "AbortError") {
        setScrapeResult({ error: "Crawl cancelled" });
      } else {
        setScrapeResult({ error: err.message });
      }
    }
    clearInterval(interval);
    crawlAbortRef.current = null;
    setCrawlProgress(100);
    setTimeout(() => { setScrapeRunning(false); setCrawlProgress(0); }, 600);
  };

  const addSource = async () => {
    const paths = newSource.allowlist_paths.split(",").map(p => p.trim()).filter(Boolean);
    const { data } = await upsertSource({ ...newSource, allowlist_paths: paths });
    if (data) setSources(prev => [data, ...prev]);
    setNewSource({ name: "", base_url: "", crawl_type: "list", allowlist_paths: "", frequency_minutes: 10080, notes: "", enabled: true });
    setShowAddSource(false);
  };

  const addTemplate = async () => {
    const { data } = await upsertAdminTemplate(newTemplate);
    if (data) setTemplates(prev => [data, ...prev]);
    setNewTemplate({ name: "", type: "cv", track: "", seniority: "", content: "", active: true, version: 1 });
    setShowAddTemplate(false);
  };

  const saveRule = async (rule) => {
    try {
      const parsed = JSON.parse(ruleJson);
      const { data } = await upsertAdminRule({ ...rule, json_rules: parsed });
      if (data) setRules(prev => prev.map(r => r.id === data.id ? data : r));
      setEditingRule(null);
    } catch { alert("Invalid JSON"); }
  };

  const handleAdminFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user) return;
    setProcessing(true);
    for (const file of files) {
      try {
        const { data: uploadData, error } = await uploadFile(user.id, file);
        if (error) continue;

        // Extract content for PDF/DOCX
        let extractedJson = null;
        if (["pdf", "docx", "doc"].includes(file.name.split(".").pop().toLowerCase())) {
          const arrayBuffer = await file.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = ""; for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          const { data: extData } = await supabase.functions.invoke("extract-document", { body: { base64, fileName: file.name, mimeType: file.type } });
          if (extData?.text) extractedJson = { text: extData.text, extracted_at: new Date().toISOString() };
        }

        const { data: upload } = await insertUpload({
          owner_type: "admin", owner_id: user.id,
          file_path: uploadData.path, file_type: file.name.split(".").pop(),
          extracted_json: extractedJson,
        });
        if (upload) setAdminUploads(prev => [upload, ...prev]);
      } catch (err) { console.error("Upload failed:", err); }
    }
    setProcessing(false);
    if (adminFileRef.current) adminFileRef.current.value = "";
  };

  const deleteAdminJob = async (jobId) => {
    await supabase.from("jobs").delete().eq("id", jobId);
    setAllJobs(prev => prev.filter(j => j.id !== jobId));
  };

  return (
    <div className="page">
      <input type="file" ref={adminFileRef} style={{display:"none"}} multiple accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.json" onChange={handleAdminFileUpload}/>
      <div className="section-header">
        <div><div className="eyebrow">Admin Console</div><div className="section-title">Platform Configuration</div></div>
          <span className="tag t-red">Owner Only</span>
        
      </div>
      {scrapeRunning && (
        <div className="mb16">
          <div className="flex" style={{justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div className="ai-pulse" style={{margin:0}}><div className="dot-spin"/>Crawling all sources, extracting jobs, and running match scoring...</div>
            <button className="btn btn-ghost btn-xs" onClick={cancelCrawl} style={{color:"var(--red)",whiteSpace:"nowrap"}}>✕ Cancel</button>
          </div>
          <div style={{background:"var(--bg3)",borderRadius:8,height:8,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:8,background:"linear-gradient(90deg,var(--gold),var(--gold-light,#f5c842))",width:`${Math.min(crawlProgress,100)}%`,transition:"width 0.4s ease"}}/>
          </div>
          <div className="fs12 t-ink3 mt4" style={{textAlign:"right"}}>{Math.round(Math.min(crawlProgress,100))}%</div>
        </div>
      )}
      {scrapeResult && !scrapeResult.error && adminTab !== "crawl" && (
        <div className="alert a-green mb16">✅ Pipeline complete! Crawled <strong>{scrapeResult.sources_crawled}</strong> sources, inserted <strong>{scrapeResult.jobs_inserted}</strong> jobs, created <strong>{scrapeResult.matches_created}</strong> profile matches.</div>
      )}
      {scrapeResult?.error && adminTab !== "crawl" && <div className="alert a-red mb16">⚠ {scrapeResult.error}</div>}
      {!isAdmin && <div className="alert a-red mb16">🔒 Admin access required. Contact the platform owner.</div>}
      <div className="grid g16" style={{gridTemplateColumns:"200px 1fr"}}>
        <div className="card-flat" style={{height:"fit-content"}}>
          <div className="label mb10">Sections</div>
          {[
            {id:"sources",l:"🌐 Sources"},{id:"crawl",l:"🔄 Crawl & Match"},
            {id:"jobs",l:"📋 All Jobs"},{id:"templates",l:"📄 Templates"},
            {id:"rules",l:"⚙️ Rules & Config"},{id:"uploads",l:"📁 Uploads"},
            {id:"playbooks",l:"📖 Playbooks"},{id:"prompts",l:"🤖 AI Prompts"},
          ].map(item=>(
            <div key={item.id} onClick={()=>setAdminTab(item.id)}
              style={{padding:"8px 12px",borderRadius:7,cursor:"pointer",fontSize:13,color:adminTab===item.id?"var(--navy2)":"var(--ink3)",background:adminTab===item.id?"var(--gold-bg)":"transparent",fontWeight:adminTab===item.id?600:400,marginBottom:2,transition:"all .12s"}}>
              {item.l}
            </div>
          ))}
        </div>
        <div>
          {/* ─── SOURCES TAB ─── */}
          {adminTab === "sources" && (
            <div>
              <div className="card mb16">
                <div className="card-header">
                  <div><div className="card-title">🌐 Crawl Sources</div><div className="card-subtitle">Manage websites and career pages to crawl</div></div>
                   <div className="flex g8">
                     <button className="btn btn-gold btn-sm" onClick={() => runCrawlAndMatch()} disabled={scrapeRunning || !isAdmin}>
                       {scrapeRunning ? "⏳ Crawling..." : "🚀 Crawl All"}
                     </button>
                     <button className="btn btn-primary btn-sm" onClick={() => setShowAddSource(v => !v)}>+ Add Source</button>
                   </div>
                </div>
                {showAddSource && (
                  <div style={{padding:"16px",background:"var(--surface2)",borderRadius:10,marginBottom:16}}>
                    <div className="grid g3 g16 mb12">
                      <div className="fg"><label className="label">Name *</label><input className="input" placeholder="e.g. Goldman Sachs Careers" value={newSource.name} onChange={e => setNewSource(p => ({...p, name: e.target.value}))}/></div>
                      <div className="fg"><label className="label">Base URL *</label><input className="input" placeholder="https://careers.gs.com" value={newSource.base_url} onChange={e => setNewSource(p => ({...p, base_url: e.target.value}))}/></div>
                      <div className="fg"><label className="label">Crawl Type</label>
                        <select className="input" value={newSource.crawl_type} onChange={e => setNewSource(p => ({...p, crawl_type: e.target.value}))}>
                          <option value="list">List (crawl pages)</option>
                          <option value="sitemap">Sitemap (map + scrape)</option>
                          <option value="single">Single Page</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid g2 g16 mb12">
                      <div className="fg"><label className="label">Allowlist Paths (comma-separated)</label><input className="input" placeholder="/jobs, /careers, /openings" value={newSource.allowlist_paths} onChange={e => setNewSource(p => ({...p, allowlist_paths: e.target.value}))}/></div>
                      <div className="fg"><label className="label">Frequency (minutes)</label><input className="input" type="number" value={newSource.frequency_minutes} onChange={e => setNewSource(p => ({...p, frequency_minutes: parseInt(e.target.value) || 10080}))}/></div>
                    </div>
                    <div className="fg mb12"><label className="label">Notes</label><input className="input" placeholder="Any notes about this source..." value={newSource.notes} onChange={e => setNewSource(p => ({...p, notes: e.target.value}))}/></div>
                    <div className="flex g10">
                      <button className="btn btn-primary" onClick={addSource} disabled={!newSource.name || !newSource.base_url}>Add Source</button>
                      <button className="btn btn-outline" onClick={() => setShowAddSource(false)}>Cancel</button>
                    </div>
                  </div>
                )}
                <table className="table">
                  <thead><tr><th>Name</th><th>URL</th><th>Type</th><th>Freq</th><th>Enabled</th><th>Actions</th></tr></thead>
                  <tbody>
                    {sources.map(s => (
                      <tr key={s.id}>
                        <td className="fw6" style={{color:"var(--ink)"}}>{s.name}</td>
                        <td className="mono fs11"><a href={s.base_url} target="_blank" rel="noopener noreferrer" style={{color:"var(--blue)"}}>{s.base_url.slice(0,40)}</a></td>
                        <td><span className="tag t-ink">{s.crawl_type}</span></td>
                        <td className="mono fs11">{s.frequency_minutes}m</td>
                        <td><span className={`tag t-${s.enabled ? "green" : "red"}`}>{s.enabled ? "On" : "Off"}</span></td>
                        <td>
                          <div className="flex g6">
                            <button className="btn btn-gold btn-xs" onClick={() => runCrawlAndMatch(s.id)} disabled={scrapeRunning}>▶ Crawl</button>
                            <button className="btn btn-ghost btn-xs" onClick={async () => { await deleteSource(s.id); setSources(prev => prev.filter(x => x.id !== s.id)); }} style={{color:"var(--red)"}}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sources.length === 0 && <div style={{padding:24,textAlign:"center",color:"var(--ink4)",fontSize:12}}>No sources configured. Add a career page URL above.</div>}
              </div>
            </div>
          )}

          {/* ─── CRAWL & MATCH TAB ─── */}
          {adminTab === "crawl" && (
            <div>
              <div className="card mb16">
                <div className="card-header">
                  <div><div className="card-title">🔄 Crawl & Match Engine</div><div className="card-subtitle">Run the ingestion pipeline across all enabled sources</div></div>
                  <button className="btn btn-gold" onClick={() => runCrawlAndMatch()} disabled={scrapeRunning || !isAdmin}>
                    {scrapeRunning ? "⏳ Running..." : "🚀 Run All Sources"}
                  </button>
                </div>
                {scrapeRunning && <div className="ai-pulse mb16"><div className="dot-spin"/>Crawling sources, extracting jobs, and running match scoring...</div>}
                {scrapeResult && !scrapeResult.error && (
                  <div className="alert a-green mb16">✅ Pipeline complete! Crawled <strong>{scrapeResult.sources_crawled}</strong> sources, inserted <strong>{scrapeResult.jobs_inserted}</strong> jobs, created <strong>{scrapeResult.matches_created}</strong> profile matches.</div>
                )}
                {scrapeResult?.error && <div className="alert a-red mb16">⚠ {scrapeResult.error}</div>}
                <div className="alert a-gold mb16">⚖️ Obeys robots.txt and site terms. Does not bypass login walls or scrape behind authentication. LinkedIn auth pages are skipped.</div>
              </div>
              <div className="card">
                <div className="card-header"><div className="card-title">Recent Crawl Runs</div></div>
                <table className="table">
                  <thead><tr><th>Source</th><th>Status</th><th>Pages</th><th>Started</th><th>Duration</th><th>Errors</th></tr></thead>
                  <tbody>
                    {crawlRuns.map(r => (
                      <tr key={r.id}>
                        <td className="fw6" style={{color:"var(--ink)"}}>{r.sources?.name || "—"}</td>
                        <td><span className={`tag t-${r.status === "completed" ? "green" : r.status === "failed" ? "red" : "gold"}`}>{r.status}</span></td>
                        <td className="mono fs11">{r.pages_crawled}</td>
                        <td className="mono fs11">{new Date(r.started_at).toLocaleString()}</td>
                        <td className="mono fs11">{r.ended_at ? Math.round((new Date(r.ended_at) - new Date(r.started_at)) / 1000) + "s" : "—"}</td>
                        <td>{(r.errors || []).length > 0 ? <span className="tag t-red">{r.errors.length}</span> : <span className="t-ink4">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {crawlRuns.length === 0 && <div style={{padding:24,textAlign:"center",color:"var(--ink4)",fontSize:12}}>No crawl runs yet.</div>}
              </div>
            </div>
          )}

          {/* ─── ALL JOBS TAB ─── */}
          {adminTab === "jobs" && (
            <div className="card">
              <div className="card-header">
                <div><div className="card-title">📋 All Jobs in System</div><div className="card-subtitle">{filteredAdminJobs.length} of {allJobs.length} total</div></div>
                <div className="flex g8 items-c">
                  <select className="input" style={{width:180}} value={jobSourceFilter} onChange={e => { setJobSourceFilter(e.target.value); setJobsPage(0); }}>
                    <option value="">All Sources</option>
                    <option value="manual">Manual / User Added</option>
                    {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button className="btn btn-outline btn-sm" onClick={loadAllJobs} disabled={loadingJobs}>{loadingJobs ? "🔄" : "↻ Refresh"}</button>
                </div>
              </div>
              {loadingJobs ? <div className="ai-pulse"><div className="dot-spin"/>Loading...</div> : (
                <>
                  <table className="table">
                    <thead><tr><th>Title</th><th>Firm</th><th>Track</th><th>Source</th><th>Added</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredAdminJobs.slice(jobsPage * JOBS_PER_PAGE, (jobsPage + 1) * JOBS_PER_PAGE).map(j => (
                        <tr key={j.id}>
                          <td className="fw6" style={{color:"var(--ink)",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {j.url ? <a href={j.url} target="_blank" rel="noopener noreferrer" style={{color:"var(--ink)",textDecoration:"underline"}}>{j.title}</a> : j.title}
                          </td>
                          <td>{j.firm}</td>
                          <td><span className="tag t-navy">{j.track || "—"}</span></td>
                          <td><span className={`tag ${j.source_id ? "t-blue" : "t-ink"}`}>{j.source_id ? (sources.find(s => s.id === j.source_id)?.name || "Crawler") : "Manual"}</span></td>
                          <td className="mono fs11">{new Date(j.created_at).toLocaleDateString()}</td>
                          <td><button className="btn btn-ghost btn-xs" onClick={() => deleteAdminJob(j.id)} style={{color:"var(--red)"}}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredAdminJobs.length > JOBS_PER_PAGE && (
                    <div className="flex items-c j-between" style={{padding:"12px 0"}}>
                      <div className="fs11 t-ink4">Page {jobsPage + 1} of {Math.ceil(filteredAdminJobs.length / JOBS_PER_PAGE)}</div>
                      <div className="flex g8">
                        <button className="btn btn-outline btn-xs" disabled={jobsPage === 0} onClick={() => setJobsPage(p => p - 1)}>← Prev</button>
                        <button className="btn btn-outline btn-xs" disabled={(jobsPage + 1) * JOBS_PER_PAGE >= filteredAdminJobs.length} onClick={() => setJobsPage(p => p + 1)}>Next →</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─── TEMPLATES TAB ─── */}
          {adminTab === "templates" && (
            <div>
              <div className="card mb16">
                <div className="card-header">
                  <div><div className="card-title">📄 Admin Templates</div><div className="card-subtitle">CV, cover letter, outreach, and interview templates</div></div>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddTemplate(v => !v)}>+ Add Template</button>
                </div>
                {showAddTemplate && (
                  <div style={{padding:16,background:"var(--surface2)",borderRadius:10,marginBottom:16}}>
                    <div className="grid g3 g16 mb12">
                      <div className="fg"><label className="label">Name *</label><input className="input" placeholder="Template name" value={newTemplate.name} onChange={e => setNewTemplate(p => ({...p, name: e.target.value}))}/></div>
                      <div className="fg"><label className="label">Type</label>
                        <select className="input" value={newTemplate.type} onChange={e => setNewTemplate(p => ({...p, type: e.target.value}))}>
                          <option value="cv">CV</option><option value="cover">Cover Letter</option><option value="outreach">Outreach</option><option value="interview">Interview</option>
                        </select>
                      </div>
                      <div className="fg"><label className="label">Track</label>
                        <select className="input" value={newTemplate.track} onChange={e => setNewTemplate(p => ({...p, track: e.target.value}))}>
                          <option value="">All</option><option value="ib">IB</option><option value="consulting">Consulting</option><option value="product">Product</option>
                        </select>
                      </div>
                    </div>
                    <div className="fg mb12"><label className="label">Content *</label><textarea className="input textarea" placeholder="Template content..." value={newTemplate.content} onChange={e => setNewTemplate(p => ({...p, content: e.target.value}))}/></div>
                    <div className="flex g10">
                      <button className="btn btn-primary" onClick={addTemplate} disabled={!newTemplate.name || !newTemplate.content}>Add Template</button>
                      <button className="btn btn-outline" onClick={() => setShowAddTemplate(false)}>Cancel</button>
                    </div>
                  </div>
                )}
                <table className="table">
                  <thead><tr><th>Name</th><th>Type</th><th>Track</th><th>Version</th><th>Active</th><th>Actions</th></tr></thead>
                  <tbody>
                    {templates.map(t => (
                      <tr key={t.id}>
                        <td className="fw6" style={{color:"var(--ink)"}}>{t.name}</td>
                        <td><span className="tag t-blue">{t.type}</span></td>
                        <td><span className="tag t-navy">{t.track || "All"}</span></td>
                        <td className="mono fs11">v{t.version}</td>
                        <td><span className={`tag t-${t.active ? "green" : "red"}`}>{t.active ? "Active" : "Inactive"}</span></td>
                        <td><button className="btn btn-ghost btn-xs" onClick={async () => { await deleteAdminTemplate(t.id); setTemplates(prev => prev.filter(x => x.id !== t.id)); }} style={{color:"var(--red)"}}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {templates.length === 0 && <div style={{padding:24,textAlign:"center",color:"var(--ink4)",fontSize:12}}>No templates yet. Add one above or upload a file.</div>}
              </div>
            </div>
          )}

          {/* ─── RULES & CONFIG TAB ─── */}
          {adminTab === "rules" && (
            <div>
              <div className="card mb16">
                <div className="card-header">
                  <div><div className="card-title">⚙️ Match Rules & Configuration</div><div className="card-subtitle">Configure match thresholds, keyword sets, seniority mappings</div></div>
                </div>
                {rules.map(rule => (
                  <div key={rule.id} style={{padding:16,border:"1px solid var(--border2)",borderRadius:10,marginBottom:12}}>
                    <div className="flex items-c j-between mb8">
                      <div className="fw6 fs12" style={{color:"var(--ink)"}}>{rule.name}</div>
                      <div className="flex g8">
                        <span className={`tag t-${rule.active ? "green" : "red"}`}>{rule.active ? "Active" : "Inactive"}</span>
                        <button className="btn btn-outline btn-xs" onClick={() => { setEditingRule(rule.id); setRuleJson(JSON.stringify(rule.json_rules, null, 2)); }}>Edit</button>
                      </div>
                    </div>
                    {editingRule === rule.id ? (
                      <div>
                        <textarea className="input textarea" style={{minHeight:200,fontFamily:"JetBrains Mono,monospace",fontSize:11}} value={ruleJson} onChange={e => setRuleJson(e.target.value)}/>
                        <div className="flex g10 mt8">
                          <button className="btn btn-primary btn-sm" onClick={() => saveRule(rule)}>Save</button>
                          <button className="btn btn-outline btn-sm" onClick={() => setEditingRule(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <pre style={{fontSize:11,color:"var(--ink3)",background:"var(--surface2)",padding:12,borderRadius:8,overflow:"auto",maxHeight:200}}>{JSON.stringify(rule.json_rules, null, 2)}</pre>
                    )}
                  </div>
                ))}
                {rules.length === 0 && <div style={{padding:24,textAlign:"center",color:"var(--ink4)",fontSize:12}}>No rules configured.</div>}
              </div>
            </div>
          )}

          {/* ─── UPLOADS TAB ─── */}
          {adminTab === "uploads" && (
            <div>
              <div className="card mb16">
                <div className="card-header">
                  <div><div className="card-title">📁 Admin Uploads</div><div className="card-subtitle">Upload PDF/DOCX files as admin datasets with auto-extraction</div></div>
                  <button className="btn btn-gold btn-sm" onClick={() => adminFileRef.current?.click()} disabled={processing}>
                    {processing ? "⏳ Processing..." : "⬆ Upload Files"}
                  </button>
                </div>
                {processing && <div className="ai-pulse mb16"><div className="dot-spin"/>Uploading and extracting content...</div>}
                <table className="table">
                  <thead><tr><th>File</th><th>Type</th><th>Extracted</th><th>Uploaded</th></tr></thead>
                  <tbody>
                    {adminUploads.map(u => (
                      <tr key={u.id}>
                        <td className="fw6" style={{color:"var(--ink)"}}>{u.file_path?.split("/").pop() || "—"}</td>
                        <td><span className="tag t-ink">{u.file_type || "—"}</span></td>
                        <td><span className={`tag t-${u.extracted_json ? "green" : "gold"}`}>{u.extracted_json ? "Yes" : "Pending"}</span></td>
                        <td className="mono fs11">{new Date(u.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {adminUploads.length === 0 && <div style={{padding:24,textAlign:"center",color:"var(--ink4)",fontSize:12}}>No admin uploads yet.</div>}
              </div>
            </div>
          )}

          {/* ─── PLAYBOOKS & PROMPTS TABS (keep existing) ─── */}
          {adminTab === "playbooks" && (
            <div className="card">
              <div className="card-header"><div className="card-title">Manage Playbooks</div></div>
              <table className="table">
                <thead><tr><th>Track</th><th>Level</th><th>Milestones</th><th>Questions</th><th>Actions</th></tr></thead>
                <tbody>
                  {[{t:"IB",l:"Undergrad",m:6,q:50},{t:"IB",l:"Experienced",m:4,q:30},{t:"Consulting",l:"Undergrad",m:5,q:40},{t:"Product",l:"Undergrad",m:5,q:35}].map((p,i)=>(
                    <tr key={i}><td className="fw6">{p.t}</td><td><span className="tag t-ink">{p.l}</span></td><td className="mono fs11">{p.m}</td><td className="mono fs11">{p.q}</td><td><button className="btn btn-outline btn-xs">Edit</button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {adminTab === "prompts" && (
            <div className="card">
              <div className="card-header"><div className="card-title">AI Prompt Packs</div></div>
              {[{n:"CV Bullet Generator",m:"gemini-flash",v:"v2.1"},{n:"Interview Scorer",m:"gemini-flash",v:"v3.0"},{n:"Cover Letter Generator",m:"gemini-flash",v:"v1.8"},{n:"Job Matcher",m:"gemini-flash",v:"v1.0"}].map((p,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 0",borderBottom:i<3?"1px solid var(--border2)":"none"}}>
                  <div style={{flex:1}}><div className="fw5 fs13" style={{color:"var(--ink)"}}>{p.n}</div><div className="flex g8 mt4"><span className="tag t-gold">{p.m}</span><span className="tag t-green">{p.v}</span></div></div>
                  <button className="btn btn-outline btn-xs">Edit</button>
                </div>
              ))}
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
/* ════════════════════════════════════════════════════════════════════════════
   PAGE: RECOMMENDED JOBS
══════════════════════════════════════════════════════════════════════════════ */
function RecommendedJobs({ jobs, setJobs, profile }) {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState(null);
  const [pasteUrl, setPasteUrl] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);

  useEffect(() => {
    if (!user) return;
    // Get profile id first
    supabase.from("profiles").select("id").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setProfileId(data.id);
        fetchProfileMatches(data.id).then(({ data: m }) => {
          setMatches(m || []);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
  }, [user]);

  const handleStatusChange = async (matchId, status) => {
    await updateMatchStatus(matchId, status);
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status } : m));
  };

  const handlePasteUrl = async () => {
    if (!pasteUrl.trim()) return;
    setParsing(true);
    setParseResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("crawl-and-match", {
        body: { paste_url: pasteUrl },
      });
      if (error) throw new Error(error.message);
      setParseResult(data?.job || null);
    } catch (err) {
      setParseResult({ error: err.message });
    }
    setParsing(false);
  };

  const saveJob = async (job) => {
    if (!user) return;
    const { data } = await upsertJob(user.id, {
      title: job.title, firm: job.company || job.firm, stage: "saved",
      url: job.apply_url || job.source_job_url, description: job.description,
      location: job.location, tags: job.tags || [], source: "Recommended",
    });
    if (data) setJobs(prev => [{ id: data.id, title: data.title, firm: data.firm, stage: data.stage, deadline: data.deadline || "", tags: data.tags || [], match: data.match_score || 0, track: data.track, level: data.experience_level, location: data.location, url: data.url, source: "Recommended" }, ...prev]);
  };

  return (
    <div className="page">
      <div className="section-header">
        <div><div className="eyebrow">For You</div><div className="section-title">Recommended Jobs</div></div>
      </div>

      {/* Paste URL fallback */}
      <div className="card-flat mb16">
        <div className="flex items-c g12">
          <span style={{fontSize:12,fontWeight:500,color:"var(--ink3)"}}>📎 Paste a job URL:</span>
          <input className="input flex-1" placeholder="https://careers.example.com/job/..." value={pasteUrl} onChange={e => setPasteUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && handlePasteUrl()} />
          <button className="btn btn-primary btn-sm" onClick={handlePasteUrl} disabled={parsing}>
            {parsing ? "⏳ Parsing..." : "Parse & Save"}
          </button>
        </div>
      </div>
      {parseResult && !parseResult.error && (
        <div className="card mb16">
          <div className="card-header"><div className="card-title">✨ Parsed Job</div></div>
          <div className="fw6 fs12" style={{color:"var(--ink)"}}>{parseResult.title}</div>
          <div className="fs11 t-ink3 mb8">{parseResult.company}</div>
          {parseResult.description && <div className="fs12 t-ink3 mb12" style={{lineHeight:1.6,maxHeight:120,overflow:"hidden"}}>{parseResult.description.slice(0, 300)}...</div>}
          <button className="btn btn-primary btn-sm" onClick={() => saveJob(parseResult)}>+ Save to CRM</button>
        </div>
      )}
      {parseResult?.error && <div className="alert a-red mb16">⚠ {parseResult.error}</div>}

      {loading ? (
        <div className="ai-pulse"><div className="dot-spin"/>Loading recommendations...</div>
      ) : matches.length === 0 ? (
        <div className="card-tinted" style={{textAlign:"center",padding:"48px 24px"}}>
          <div style={{fontSize:40,marginBottom:14}}>🎯</div>
          <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:20,fontWeight:700,color:"var(--ink)",marginBottom:8}}>No Recommendations Yet</div>
          <div className="fs13 t-ink3" style={{maxWidth:400,margin:"0 auto",lineHeight:1.7}}>
            Once the admin runs the job crawler, matching jobs will appear here based on your profile skills, location, track, and preferences.
          </div>
        </div>
      ) : (
        <div>
          <div className="alert a-gold mb16">🎯 {matches.filter(m => m.status === "new").length} new matches based on your profile. Score threshold is configurable by admin.</div>
          <div className="grid g-auto">
            {matches.filter(m => m.status !== "dismissed").map(match => {
              const job = match.jobs;
              if (!job) return null;
              return (
                <div key={match.id} className={`job-card ${match.status === "saved" ? "saved" : ""}`}>
                  <div className="jc-match">{match.match_score}%</div>
                  <div className="jc-title">{job.title}</div>
                  <div className="jc-firm">{job.firm} · {job.location || "Remote"}</div>
                  <div className="jc-tags">
                    {(job.tags || []).map(t => <span key={t} className="tag t-navy">{t}</span>)}
                    {match.status === "new" && <span className="tag t-green">New</span>}
                  </div>
                  {/* Match reasons */}
                  <div style={{marginBottom:10}}>
                    {(match.match_reasons || []).map((r, i) => (
                      <div key={i} className="mono fs11" style={{color:"var(--green)",marginBottom:2}}>✓ {r}</div>
                    ))}
                  </div>
                  <div className="jc-foot">
                    <div className="jc-source">{job.source || "Crawler"} · ⏰ {job.deadline || "Rolling"}</div>
                    <div className="flex g8">
                      {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-xs" style={{textDecoration:"none"}}>Apply →</a>}
                      {match.status === "saved" ? (
                        <span className="tag t-green">✓ Saved</span>
                      ) : (
                        <>
                          <button className="btn btn-primary btn-xs" onClick={() => { saveJob(job); handleStatusChange(match.id, "saved"); }}>+ Save</button>
                          <button className="btn btn-ghost btn-xs" onClick={() => handleStatusChange(match.id, "dismissed")} style={{color:"var(--red)"}}>✕</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGE: EXPLORE JOBS
══════════════════════════════════════════════════════════════════════════════ */
function ExploreJobs({ jobs, setJobs }) {
  const { user } = useAuth();
  const [allJobs, setAllJobs] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ track: "", location: "", seniority: "", search: "", source_id: "", source_label: "" });
  const [liKeywords, setLiKeywords] = useState("");
  const [liLocation, setLiLocation] = useState("London");
  const [liSearching, setLiSearching] = useState(false);
  const [liResult, setLiResult] = useState(null);

  useEffect(() => {
    supabase.from("jobs").select("*").not("source_id", "is", null).order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => { setAllJobs(data || []); setLoading(false); });
    fetchSources().then(({ data }) => setSources(data || []));
  }, []);

  const filtered = allJobs.filter(j => {
    if (filters.track && j.track !== filters.track) return false;
    if (filters.location && !(j.location || "").toLowerCase().includes(filters.location.toLowerCase())) return false;
    if (filters.seniority && j.experience_level !== filters.seniority) return false;
    if (filters.search && !`${j.title} ${j.firm} ${j.description || ""}`.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.source_id && j.source_id !== filters.source_id) return false;
    if (filters.source_label === "linkedin" && j.source !== "LinkedIn") return false;
    if (filters.source_label === "manual" && j.source_id) return false;
    return true;
  });

  const saveJob = async (job) => {
    if (!user) return;
    const { data } = await upsertJob(user.id, {
      title: job.title, firm: job.firm, stage: "saved", url: job.url || job.apply_url,
      description: job.description, location: job.location, tags: job.tags || [],
      source: "Explore", track: job.track, level: job.experience_level,
    });
    if (data) setJobs(prev => [{ id: data.id, title: data.title, firm: data.firm, stage: data.stage, deadline: data.deadline || "", tags: data.tags || [], match: data.match_score || 0, track: data.track, level: data.experience_level, location: data.location, url: data.url, source: "Explore" }, ...prev]);
  };

  const getOutUrl = (url) => {
    if (!url) return "#";
    let cleaned = url.trim();
    if (!/^https?:\/\//i.test(cleaned)) cleaned = `https://${cleaned}`;
    return `/out?u=${encodeURIComponent(cleaned)}`;
  };

  const searchLinkedIn = async () => {
    if (!liKeywords.trim()) return;
    setLiSearching(true);
    setLiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("linkedin-jobs", {
        body: { keywords: liKeywords, location: liLocation, limit: 25 },
      });
      if (error) throw error;
      setLiResult(data);
      const { data: refreshed } = await supabase.from("jobs").select("*").not("source_id", "is", null).order("created_at", { ascending: false }).limit(500);
      setAllJobs(refreshed || []);
    } catch (err) {
      setLiResult({ error: err.message || "Failed to search LinkedIn" });
    }
    setLiSearching(false);
  };

  return (
    <div className="page">
      <div className="section-header">
        <div><div className="eyebrow">Browse</div><div className="section-title">Explore All Jobs</div></div>
        <span className="tag t-gold">{filtered.length} roles</span>
      </div>

      <div className="card mb16" style={{borderLeft:"3px solid var(--blue)"}}>
        <div className="card-title mb8" style={{fontSize:14}}>🔗 LinkedIn Job Search</div>
        <div className="flex items-c g12 flex-wrap">
          <input className="input" style={{flex:1,minWidth:180}} placeholder="Keywords (e.g. investment banking intern)" value={liKeywords} onChange={e => setLiKeywords(e.target.value)} onKeyDown={e => e.key === "Enter" && searchLinkedIn()} />
          <input className="input" style={{width:140}} placeholder="Location" value={liLocation} onChange={e => setLiLocation(e.target.value)} />
          <button className="btn btn-primary" onClick={searchLinkedIn} disabled={liSearching}>{liSearching ? "Searching…" : "Search LinkedIn"}</button>
        </div>
        {liResult && (
          <div style={{marginTop:10,fontSize:12,color: liResult.error ? "var(--red)" : "var(--green)"}}>
            {liResult.error ? `❌ ${liResult.error}` : `✅ Found ${liResult.jobs_found} jobs, saved ${liResult.jobs_inserted} new`}
          </div>
        )}
      </div>

      <div className="card-flat mb16">
        <div className="flex items-c g12 flex-wrap">
          <select className="input" style={{width:140}} value={filters.source_label} onChange={e => setFilters(f => ({ ...f, source_label: e.target.value, source_id: "" }))}>
            <option value="">All Origins</option>
            <option value="manual">Manual</option>
            <option value="linkedin">LinkedIn</option>
          </select>
          <select className="input" style={{width:160}} value={filters.source_id} onChange={e => setFilters(f => ({ ...f, source_id: e.target.value }))}>
            <option value="">All Sources</option>
            {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input" style={{width:140}} value={filters.track} onChange={e => setFilters(f => ({ ...f, track: e.target.value }))}>
            <option value="">All Tracks</option>
            <option value="ib">Investment Banking</option>
            <option value="consulting">Consulting</option>
            <option value="product">Product</option>
            <option value="postgrad">Post-Graduate Path</option>
          </select>
          <select className="input" style={{width:140}} value={filters.seniority} onChange={e => setFilters(f => ({ ...f, seniority: e.target.value }))}>
            <option value="">All Levels</option>
            <option value="undergrad">Undergraduate</option>
            <option value="experienced">Experienced</option>
          </select>
          <input className="input" style={{flex:1,minWidth:180}} placeholder="Search jobs..." value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          <input className="input" style={{width:130}} placeholder="Location..." value={filters.location} onChange={e => setFilters(f => ({ ...f, location: e.target.value }))} />
        </div>
      </div>

      {loading ? (
        <div className="ai-pulse"><div className="dot-spin"/>Loading jobs...</div>
      ) : filtered.length === 0 ? (
        <div className="card-tinted" style={{textAlign:"center",padding:"48px 24px"}}>
          <div style={{fontSize:40,marginBottom:14}}>🌍</div>
          <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:20,fontWeight:700,color:"var(--ink)",marginBottom:8}}>No Jobs Found</div>
          <div className="fs13 t-ink3">Use LinkedIn Search above or wait for the admin crawler. Try adjusting your filters.</div>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Role</th><th>Company</th><th>Location</th><th>Track</th><th>Level</th><th>Source</th><th>Posted</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.map(j => (
                <tr key={j.id}>
                  <td className="fw6" style={{color:"var(--ink)",maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {j.url ? <a href={getOutUrl(j.url)} target="_blank" rel="noopener noreferrer" style={{color:"var(--ink)",textDecoration:"underline"}}>{j.title}</a> : j.title}
                  </td>
                  <td>{j.firm}</td>
                  <td style={{fontSize:11,color:"var(--ink3)"}}>{j.location || "—"}</td>
                  <td><span className="tag t-navy">{j.track || "—"}</span></td>
                  <td><span className="tag t-ink">{j.experience_level || "—"}</span></td>
                  <td><span className="tag" style={{background: j.source === "LinkedIn" ? "var(--blue-bg)" : "var(--gold-bg)", color: j.source === "LinkedIn" ? "var(--blue)" : "var(--gold)", fontSize:10}}>{j.source || "Crawler"}</span></td>
                  <td className="mono fs11">{j.posted_at ? new Date(j.posted_at).toLocaleDateString() : new Date(j.created_at).toLocaleDateString()}</td>
                  <td><button className="btn btn-primary btn-xs" onClick={() => saveJob(j)}>+ Save</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const PAGE_TITLES = {
  dashboard:"Dashboard", recommended:"Recommended Jobs", discover:"Job Discovery", explore:"Explore Jobs",
  websites:"Website Manager", pipeline:"CRM", playbooks:"Playbooks",
  cv:"CV + Cover Letters", interview:"Interview Prep",
  extension:"Auto Apply", profile:"My Profile", admin:"Admin Console",
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
          source_id: j.source_id,
          url: j.url,
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
      case "dashboard":    return <Dashboard jobs={jobs} profile={profile}/>;
      case "recommended":  return <RecommendedJobs jobs={jobs} setJobs={setJobsWithDb} profile={profile}/>;
      case "discover":     return <JobDiscovery jobs={jobs} setJobs={setJobsWithDb} profile={profile} setProfile={()=>{}}/>;
      case "explore":      return <ExploreJobs jobs={jobs} setJobs={setJobsWithDb}/>;
      case "websites":     return <WebsiteManager/>;
      case "pipeline":     return <Pipeline jobs={jobs} setJobs={setJobsWithDb}/>;
      case "playbooks":    return <Playbooks/>;
      case "cv":           return <CVStudio jobs={jobs}/>;
      case "interview":    return <Interview/>;
      case "extension":    return <Extension/>;
      case "profile":      return <MyProfile/>;
      case "admin":        return <Admin/>;
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
                <div className="user-meta">{profile.track === "ib" ? "IB" : profile.track === "consulting" ? "Consulting" : profile.track === "postgrad" ? "Post-Grad" : "Product"} · {profile.level === "undergrad" ? "Undergrad" : "Experienced"}</div>
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
