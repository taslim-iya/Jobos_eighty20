// JobSearchOS Auto-Fill Content Script
(() => {
  'use strict';

  // ── Field Mapping Patterns ──
  const FIELD_MAP = {
    first_name: [/first.?name/i, /given.?name/i, /fname/i, /prénom/i],
    last_name: [/last.?name/i, /family.?name/i, /surname/i, /lname/i],
    email: [/e?.?mail/i, /courriel/i],
    phone: [/phone/i, /mobile/i, /tel/i, /téléphone/i, /cell/i],
    linkedin: [/linkedin/i, /linked.?in/i],
    location: [/location/i, /city/i, /address/i, /where.?do.?you.?live/i],
    university: [/university/i, /school/i, /college/i, /education/i, /institution/i],
    gpa: [/gpa/i, /grade/i, /cgpa/i],
    graduation: [/graduat/i, /grad.?year/i, /expected.?grad/i, /completion/i],
    website: [/website/i, /portfolio/i, /personal.?site/i, /url/i, /github/i],
    salary: [/salary/i, /compensation/i, /pay/i, /wage/i],
    visa: [/visa/i, /work.?auth/i, /sponsor/i, /right.?to.?work/i, /eligible/i],
    start_date: [/start.?date/i, /avail/i, /when.?can.?you/i, /earliest/i],
    experience: [/years?.?of?.?experience/i, /experience.?level/i],
    skills: [/skills/i, /competenc/i, /technologies/i],
  };

  // ── Detect Application Forms ──
  function detectApplicationForm() {
    const forms = document.querySelectorAll('form');
    const inputs = document.querySelectorAll('input, textarea, select');
    const applyIndicators = [
      /apply/i, /application/i, /candidate/i, /submit.*resume/i,
      /upload.*cv/i, /job.*application/i,
    ];

    const pageText = document.title + ' ' + (document.querySelector('h1')?.textContent || '');
    const isApplyPage = applyIndicators.some(r => r.test(pageText)) || inputs.length > 3;

    // Detect ATS platform
    const url = window.location.href;
    const isATS = /greenhouse|lever|workday|myworkdayjobs|smartrecruiters|icims|taleo|brassring|jobvite|ashbyhq/.test(url);
    const isLinkedIn = /linkedin\.com/.test(url) && /jobs|apply/.test(url);

    return { isApplyPage: isApplyPage || isATS || isLinkedIn, isATS, isLinkedIn };
  }

  // ── Extract Job Title from Page ──
  function extractJobTitle() {
    const selectors = [
      'h1.job-title', 'h1.posting-headline', '.job-title', '[data-automation-id="jobPostingHeader"]',
      '.jobs-unified-top-card__job-title', 'h1', '.posting-headline h2',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim().slice(0, 100);
    }
    return document.title.slice(0, 100);
  }

  // ── Identify Field Type ──
  function identifyField(el) {
    const attrs = [
      el.name, el.id, el.placeholder,
      el.getAttribute('aria-label'), el.getAttribute('data-automation-id'),
      el.getAttribute('autocomplete'),
    ].filter(Boolean).join(' ');

    // Check label
    let labelText = '';
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) labelText = label.textContent;
    }
    const wrapper = el.closest('.field, .form-group, [data-automation-id]');
    if (wrapper) {
      const lbl = wrapper.querySelector('label, .label, legend');
      if (lbl) labelText = lbl.textContent;
    }

    const searchText = `${attrs} ${labelText}`.toLowerCase();

    for (const [field, patterns] of Object.entries(FIELD_MAP)) {
      if (patterns.some(p => p.test(searchText))) return field;
    }
    return null;
  }

  // ── Get Value from Profile ──
  function getProfileValue(fieldType, profile) {
    if (!profile) return null;
    const name = profile.display_name || '';
    const parts = name.split(' ');

    const map = {
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' ') || '',
      email: profile.email || '',
      phone: profile.phone || '',
      linkedin: profile.linkedin_url || '',
      location: profile.location || '',
      university: profile.university || '',
      gpa: profile.gpa || '',
      graduation: profile.graduation_year || '',
      website: profile.website || '',
      salary: profile.salary_min ? String(profile.salary_min) : '',
      visa: profile.visa_status || '',
      start_date: profile.start_date || '',
      experience: profile.experience_level || '',
      skills: Array.isArray(profile.skills) ? profile.skills.join(', ') : (profile.skills || ''),
    };

    return map[fieldType] || null;
  }

  // ── Fill a Single Field ──
  function fillField(el, value) {
    if (!value || el.disabled || el.readOnly) return false;

    // Handle select elements
    if (el.tagName === 'SELECT') {
      const options = Array.from(el.options);
      const match = options.find(o =>
        o.text.toLowerCase().includes(value.toLowerCase()) ||
        o.value.toLowerCase().includes(value.toLowerCase())
      );
      if (match) {
        el.value = match.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        highlightField(el);
        return true;
      }
      return false;
    }

    // Handle text inputs / textareas
    const nativeSetter = Object.getOwnPropertyDescriptor(
      el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    highlightField(el);
    return true;
  }

  // ── Visual Feedback ──
  function highlightField(el) {
    el.classList.add('jsos-filled');
    el.style.transition = 'box-shadow 0.3s, border-color 0.3s';
    el.style.boxShadow = '0 0 0 2px rgba(0,87,155,0.3)';
    el.style.borderColor = '#00579B';
    setTimeout(() => {
      el.style.boxShadow = '';
      el.style.borderColor = '';
    }, 3000);
  }

  // ── Auto-Fill All Fields ──
  function autofillPage(profile) {
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]), textarea, select');
    let filledCount = 0;

    inputs.forEach(el => {
      if (el.value && el.value.trim()) return; // Skip already filled
      const fieldType = identifyField(el);
      if (!fieldType) return;
      const value = getProfileValue(fieldType, profile);
      if (fillField(el, value)) filledCount++;
    });

    // Show badge
    showFillBadge(filledCount);
    return filledCount;
  }

  // ── Fill Badge ──
  function showFillBadge(count) {
    const existing = document.getElementById('jsos-fill-badge');
    if (existing) existing.remove();

    const badge = document.createElement('div');
    badge.id = 'jsos-fill-badge';
    badge.innerHTML = `
      <div style="position:fixed;bottom:20px;right:20px;background:#0A0A0A;color:#fff;
        padding:12px 20px;border-radius:8px;font-family:Inter,sans-serif;font-size:13px;
        z-index:999999;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);
        animation:jsos-slide-in 0.3s ease-out;">
        <span style="background:#00579B;color:#fff;width:24px;height:24px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;">
          ${count}
        </span>
        <span>${count > 0 ? `fields auto-filled by JobSearchOS` : 'No matching fields found'}</span>
      </div>
    `;
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 4000);
  }

  // ── Insert Cover Letter into Textarea ──
  function insertCoverLetter(text) {
    const textareas = document.querySelectorAll('textarea');
    // Try to find cover letter field
    let target = null;
    for (const ta of textareas) {
      const context = [ta.name, ta.id, ta.placeholder, ta.getAttribute('aria-label')].join(' ').toLowerCase();
      if (/cover|letter|message|why|motivation|additional/i.test(context)) {
        target = ta;
        break;
      }
    }
    // Fallback: largest visible textarea
    if (!target) {
      target = Array.from(textareas).filter(t => t.offsetParent !== null).sort((a, b) => {
        const aSize = a.offsetWidth * a.offsetHeight;
        const bSize = b.offsetWidth * b.offsetHeight;
        return bSize - aSize;
      })[0];
    }
    if (target) {
      fillField(target, text);
      return true;
    }
    return false;
  }

  // ── Message Handler ──
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_PAGE_INFO') {
      const { isApplyPage } = detectApplicationForm();
      sendResponse({ hasForm: isApplyPage, jobTitle: extractJobTitle() });
    } else if (msg.type === 'AUTOFILL') {
      const count = autofillPage(msg.profile);
      sendResponse({ filled: count });
    } else if (msg.type === 'INSERT_COVER_LETTER') {
      const success = insertCoverLetter(msg.text);
      sendResponse({ success });
    }
    return true;
  });

  // ── Add slide-in animation ──
  const style = document.createElement('style');
  style.textContent = `
    @keyframes jsos-slide-in {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
})();
