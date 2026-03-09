// JobSearchOS Auto-Fill Content Script — Enhanced with Learning
(() => {
  'use strict';

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

  const SUPABASE_URL = 'https://ujtloxbdecirhicqfjka.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdGxveGJkZWNpcmhpY3FmamthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjgyNzgsImV4cCI6MjA4NzkwNDI3OH0.AihC-gF0rD0BUWatMzqy8cwlHDr5pMY0c8hWKodemFc';

  // ── Platform Detection ──
  function detectPlatform() {
    const url = window.location.href;
    if (/linkedin\.com/.test(url) && /jobs|apply/.test(url)) return 'linkedin';
    if (/greenhouse/.test(url)) return 'greenhouse';
    if (/lever\.co/.test(url)) return 'lever';
    if (/workday|myworkdayjobs/.test(url)) return 'workday';
    if (/smartrecruiters/.test(url)) return 'smartrecruiters';
    if (/icims/.test(url)) return 'icims';
    if (/ashbyhq/.test(url)) return 'ashby';
    return 'generic';
  }

  function detectApplicationForm() {
    const inputs = document.querySelectorAll('input, textarea, select');
    const pageText = document.title + ' ' + (document.querySelector('h1')?.textContent || '');
    const applyIndicators = [/apply/i, /application/i, /candidate/i, /submit.*resume/i, /upload.*cv/i, /job.*application/i];
    const platform = detectPlatform();
    const isApplyPage = applyIndicators.some(r => r.test(pageText)) || inputs.length > 3 || platform !== 'generic';
    return { isApplyPage, platform };
  }

  function extractJobTitle() {
    const selectors = [
      'h1.job-title', 'h1.posting-headline', '.job-title', '[data-automation-id="jobPostingHeader"]',
      '.jobs-unified-top-card__job-title', '.top-card-layout__title', 'h1', '.posting-headline h2',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim().slice(0, 100);
    }
    return document.title.slice(0, 100);
  }

  function identifyField(el) {
    const attrs = [
      el.name, el.id, el.placeholder,
      el.getAttribute('aria-label'), el.getAttribute('data-automation-id'),
      el.getAttribute('autocomplete'),
    ].filter(Boolean).join(' ');
    let labelText = '';
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) labelText = label.textContent;
    }
    const wrapper = el.closest('.field, .form-group, [data-automation-id], .fb-form-element, .jobs-easy-apply-form-element');
    if (wrapper) {
      const lbl = wrapper.querySelector('label, .label, legend, .fb-form-element-label');
      if (lbl) labelText = lbl.textContent;
    }
    const searchText = `${attrs} ${labelText}`.toLowerCase();
    for (const [field, patterns] of Object.entries(FIELD_MAP)) {
      if (patterns.some(p => p.test(searchText))) return field;
    }
    return null;
  }

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

  function fillField(el, value) {
    if (!value || el.disabled || el.readOnly) return false;
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
    const nativeSetter = Object.getOwnPropertyDescriptor(
      el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
    )?.set;
    if (nativeSetter) nativeSetter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    highlightField(el);
    return true;
  }

  function highlightField(el) {
    el.classList.add('jsos-filled');
    el.style.transition = 'box-shadow 0.3s, border-color 0.3s';
    el.style.boxShadow = '0 0 0 2px rgba(0,87,155,0.3)';
    el.style.borderColor = '#00579B';
    setTimeout(() => { el.style.boxShadow = ''; el.style.borderColor = ''; }, 3000);
  }

  function autofillPage(profile) {
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]), textarea, select');
    let filledCount = 0;
    inputs.forEach(el => {
      if (el.value && el.value.trim()) return;
      const fieldType = identifyField(el);
      if (!fieldType) return;
      const value = getProfileValue(fieldType, profile);
      if (fillField(el, value)) filledCount++;
    });
    showFillBadge(filledCount);
    return filledCount;
  }

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
        <span>${count > 0 ? 'fields auto-filled by JobSearchOS' : 'No matching fields found'}</span>
      </div>`;
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 4000);
  }

  function insertCoverLetter(text) {
    const textareas = document.querySelectorAll('textarea');
    let target = null;
    for (const ta of textareas) {
      const context = [ta.name, ta.id, ta.placeholder, ta.getAttribute('aria-label')].join(' ').toLowerCase();
      if (/cover|letter|message|why|motivation|additional/i.test(context)) { target = ta; break; }
    }
    if (!target) {
      target = Array.from(textareas).filter(t => t.offsetParent !== null)
        .sort((a, b) => (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight))[0];
    }
    if (target) { fillField(target, text); return true; }
    return false;
  }

  // ══════════════════════════════════════════════
  // LEARNING: Detect manual field entries and sync to profile
  // ══════════════════════════════════════════════
  const learnedFields = new Set();

  async function learnField(fieldType, value) {
    if (!fieldType || !value || learnedFields.has(fieldType)) return;
    
    const { supabase_token, learn_enabled } = await chrome.storage.local.get(['supabase_token', 'learn_enabled']);
    if (!learn_enabled || !supabase_token) return;

    if (fieldType === 'email') return;

    learnedFields.add(fieldType);
    
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/extension-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase_token}`,
          'apikey': ANON,
        },
        body: JSON.stringify({ action: 'learnField', fieldType, value }),
      });
      showLearnBadge(fieldType);
    } catch (e) {
      console.log('[JSOS] Learn failed:', e);
    }
  }

  function showLearnBadge(fieldType) {
    const existing = document.getElementById('jsos-learn-badge');
    if (existing) existing.remove();
    const badge = document.createElement('div');
    badge.id = 'jsos-learn-badge';
    badge.innerHTML = `
      <div style="position:fixed;bottom:80px;right:20px;background:#1A7F5A;color:#fff;
        padding:10px 16px;border-radius:6px;font-family:Inter,sans-serif;font-size:12px;
        z-index:999999;display:flex;align-items:center;gap:6px;box-shadow:0 4px 15px rgba(0,0,0,0.2);
        animation:jsos-slide-in 0.3s ease-out;">
        <span>🧠</span>
        <span>Learned: ${fieldType.replace(/_/g, ' ')}</span>
      </div>`;
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 2500);
  }

  function setupFieldLearning() {
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]):not([type="password"]), textarea, select');
    
    inputs.forEach(el => {
      if (el.dataset.jsosLearning) return;
      el.dataset.jsosLearning = 'true';
      
      let initialValue = el.value;
      
      el.addEventListener('blur', () => {
        const newValue = el.value?.trim();
        if (newValue && newValue !== initialValue && !el.classList.contains('jsos-filled')) {
          const fieldType = identifyField(el);
          if (fieldType) {
            learnField(fieldType, newValue);
          }
        }
        initialValue = newValue;
      });
    });
  }

  // ══════════════════════════════════════════════
  // LINKEDIN EASY APPLY
  // ══════════════════════════════════════════════
  function isLinkedInEasyApply() {
    return !!document.querySelector('.jobs-easy-apply-modal, .jobs-easy-apply-content, [data-test-modal-id="easy-apply-modal"]');
  }

  function linkedInFillCurrentStep(profile) {
    const modal = document.querySelector('.jobs-easy-apply-modal, .jobs-easy-apply-content, [data-test-modal-id="easy-apply-modal"]');
    if (!modal) return 0;
    const inputs = modal.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]), textarea, select');
    let filled = 0;
    inputs.forEach(el => {
      if (el.value && el.value.trim()) return;
      const fieldType = identifyField(el);
      if (!fieldType) return;
      const value = getProfileValue(fieldType, profile);
      if (fillField(el, value)) filled++;
    });
    return filled;
  }

  function linkedInClickNext() {
    const buttons = document.querySelectorAll('.jobs-easy-apply-modal button, .jobs-easy-apply-content button, [data-test-modal-id="easy-apply-modal"] button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim().toLowerCase() || '';
      if (/^next$|^continue$|^review$/.test(text)) {
        btn.click();
        return 'next';
      }
    }
    for (const btn of buttons) {
      const text = btn.textContent?.trim().toLowerCase() || '';
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (/submit application|submit/i.test(text) || /submit/i.test(ariaLabel)) {
        return 'submit_ready';
      }
    }
    return 'unknown';
  }

  async function linkedInAutoApply(profile, autoSubmit = false) {
    let totalFilled = 0;
    let steps = 0;
    const maxSteps = 10;

    while (steps < maxSteps) {
      steps++;
      await sleep(800);
      const filled = linkedInFillCurrentStep(profile);
      totalFilled += filled;

      const action = linkedInClickNext();
      if (action === 'submit_ready') {
        if (autoSubmit) {
          const submitBtn = Array.from(document.querySelectorAll('.jobs-easy-apply-modal button, .jobs-easy-apply-content button'))
            .find(b => /submit application|submit/i.test(b.textContent?.trim() || ''));
          if (submitBtn) {
            submitBtn.click();
            showFillBadge(totalFilled);
            return { filled: totalFilled, submitted: true };
          }
        }
        showFillBadge(totalFilled);
        return { filled: totalFilled, submitted: false, message: 'Ready to submit — review and click Submit' };
      }
      if (action === 'unknown') break;
    }

    showFillBadge(totalFilled);
    return { filled: totalFilled, submitted: false };
  }

  // ══════════════════════════════════════════════
  // ONE-CLICK APPLY
  // ══════════════════════════════════════════════
  function clickSubmitButton() {
    const selectors = ['button[type="submit"]', 'input[type="submit"]', 'button[data-automation-id="submit"]', '.btn-submit'];
    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn && btn.offsetParent !== null) { btn.click(); return true; }
    }
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim().toLowerCase();
      if (/^submit|^apply now|^send application|^complete/i.test(text) && btn.offsetParent !== null) {
        btn.click(); return true;
      }
    }
    return false;
  }

  // ══════════════════════════════════════════════
  // AUTO-FILL ON PAGE LOAD
  // ══════════════════════════════════════════════
  function tryAutoFillOnLoad() {
    chrome.storage.local.get(['user_profile', 'auto_fill_enabled', 'learn_enabled'], (result) => {
      if (!result.auto_fill_enabled || !result.user_profile) return;
      const { isApplyPage, platform } = detectApplicationForm();
      if (!isApplyPage) return;

      setTimeout(() => {
        if (platform === 'linkedin' && isLinkedInEasyApply()) {
          linkedInFillCurrentStep(result.user_profile);
        } else {
          autofillPage(result.user_profile);
        }
        if (result.learn_enabled) setTimeout(setupFieldLearning, 500);
      }, 1500);
    });
  }

  if (document.readyState === 'complete') {
    tryAutoFillOnLoad();
  } else {
    window.addEventListener('load', () => setTimeout(tryAutoFillOnLoad, 1000));
  }

  chrome.storage.local.get(['learn_enabled'], (result) => {
    if (result.learn_enabled) {
      const { isApplyPage } = detectApplicationForm();
      if (isApplyPage) setTimeout(setupFieldLearning, 2000);
    }
  });

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1 && (node.classList?.contains('jobs-easy-apply-modal') || node.querySelector?.('.jobs-easy-apply-modal'))) {
          chrome.storage.local.get(['user_profile', 'auto_fill_enabled', 'learn_enabled'], (result) => {
            if (result.auto_fill_enabled && result.user_profile) {
              setTimeout(() => linkedInFillCurrentStep(result.user_profile), 800);
            }
            if (result.learn_enabled) setTimeout(setupFieldLearning, 1500);
          });
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_PAGE_INFO') {
      const { isApplyPage, platform } = detectApplicationForm();
      sendResponse({ hasForm: isApplyPage, jobTitle: extractJobTitle(), platform, isLinkedInEasyApply: platform === 'linkedin' && isLinkedInEasyApply() });
    } else if (msg.type === 'AUTOFILL') {
      const count = autofillPage(msg.profile);
      sendResponse({ filled: count });
    } else if (msg.type === 'INSERT_COVER_LETTER') {
      const success = insertCoverLetter(msg.text);
      sendResponse({ success });
    } else if (msg.type === 'LINKEDIN_AUTO_APPLY') {
      linkedInAutoApply(msg.profile, msg.autoSubmit).then(sendResponse);
      return true;
    } else if (msg.type === 'ONE_CLICK_APPLY') {
      (async () => {
        const filled = autofillPage(msg.profile);
        if (msg.coverLetter) insertCoverLetter(msg.coverLetter);
        await sleep(500);
        const submitted = msg.autoSubmit ? clickSubmitButton() : false;
        sendResponse({ filled, submitted });
      })();
      return true;
    } else if (msg.type === 'SET_AUTO_FILL') {
      chrome.storage.local.set({ auto_fill_enabled: msg.enabled });
      sendResponse({ ok: true });
    } else if (msg.type === 'SET_LEARN_ENABLED') {
      chrome.storage.local.set({ learn_enabled: msg.enabled });
      if (msg.enabled) setupFieldLearning();
      sendResponse({ ok: true });
    }
    return true;
  });

  const style = document.createElement('style');
  style.textContent = `@keyframes jsos-slide-in { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`;
  document.head.appendChild(style);
})();
