// JobSearchOS Extension - Popup Controller — Enhanced
const SUPABASE_URL = 'https://ujtloxbdecirhicqfjka.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdGxveGJkZWNpcmhpY3FmamthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjgyNzgsImV4cCI6MjA4NzkwNDI3OH0.AihC-gF0rD0BUWatMzqy8cwlHDr5pMY0c8hWKodemFc';

const views = {
  loading: document.getElementById('loading-view'),
  login: document.getElementById('login-view'),
  connected: document.getElementById('connected-view'),
};

function showView(name) {
  Object.values(views).forEach(v => v.classList.remove('active-view'));
  views[name].classList.add('active-view');
}

// Check stored credentials on load
chrome.storage.local.get(['supabase_token', 'user_profile', 'auto_fill_enabled'], (result) => {
  if (result.supabase_token && result.user_profile) {
    showConnected(result.user_profile);
    document.getElementById('auto-fill-toggle').checked = !!result.auto_fill_enabled;
    checkCurrentPage();
  } else {
    showView('login');
  }
});

// Connect button
document.getElementById('connect-btn').addEventListener('click', async () => {
  const token = document.getElementById('api-token').value.trim();
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  if (!token) { errEl.textContent = 'Please enter your API token'; errEl.style.display = 'block'; return; }
  try {
    showView('loading');
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/extension-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': ANON },
      body: JSON.stringify({ action: 'getProfile' }),
    });
    if (!resp.ok) throw new Error('Authentication failed');
    const data = await resp.json();
    chrome.storage.local.set({ supabase_token: token, user_profile: data.profile });
    showConnected(data.profile);
    checkCurrentPage();
  } catch (e) {
    showView('login');
    errEl.textContent = e.message || 'Connection failed';
    errEl.style.display = 'block';
  }
});

function showConnected(profile) {
  showView('connected');
  document.getElementById('user-name').textContent = profile?.display_name || profile?.email || 'User';
  chrome.storage.local.get(['apps_today', 'apps_today_date'], (r) => {
    const today = new Date().toDateString();
    document.getElementById('apps-today').textContent = r.apps_today_date === today ? (r.apps_today || 0) : 0;
  });
}

async function checkCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const result = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' });
    if (result?.hasForm) {
      document.getElementById('page-detection').style.display = 'block';
      document.getElementById('detected-job-title').textContent = result.jobTitle || 'Unknown position';
      if (result.platform && result.platform !== 'generic') {
        const badge = document.getElementById('platform-badge');
        badge.textContent = result.platform.charAt(0).toUpperCase() + result.platform.slice(1);
        badge.style.display = 'inline-block';
      }
      // Show LinkedIn-specific actions
      if (result.isLinkedInEasyApply) {
        document.getElementById('linkedin-actions').style.display = 'block';
      }
    }
  } catch { /* content script not loaded */ }
}

// Auto-fill toggle
document.getElementById('auto-fill-toggle').addEventListener('change', (e) => {
  const enabled = e.target.checked;
  chrome.storage.local.set({ auto_fill_enabled: enabled });
  // Notify content script
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'SET_AUTO_FILL', enabled });
  });
});

// Auto-fill button
document.getElementById('autofill-btn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.storage.local.get(['user_profile'], (r) => {
    chrome.tabs.sendMessage(tab.id, { type: 'AUTOFILL', profile: r.user_profile });
  });
  incrementAppsCounter();
});

// One-Click Apply
document.getElementById('one-click-btn').addEventListener('click', async () => {
  const btn = document.getElementById('one-click-btn');
  btn.textContent = '⏳ Applying...';
  btn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Check if LinkedIn Easy Apply
    const pageInfo = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' });

    const { user_profile, supabase_token } = await chrome.storage.local.get(['user_profile', 'supabase_token']);

    if (pageInfo?.isLinkedInEasyApply) {
      // LinkedIn flow: fill all steps
      const result = await chrome.tabs.sendMessage(tab.id, {
        type: 'LINKEDIN_AUTO_APPLY', profile: user_profile, autoSubmit: false
      });
      document.getElementById('fields-filled').textContent = result?.filled || 0;
    } else {
      // Generic flow: generate cover letter → fill → submit
      let coverLetter = '';
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/extension-api`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabase_token}`, 'apikey': ANON },
          body: JSON.stringify({ action: 'generateCoverLetter', jobContext: pageInfo?.jobTitle || '' }),
        });
        const data = await resp.json();
        coverLetter = data.coverLetter || '';
      } catch {}

      const result = await chrome.tabs.sendMessage(tab.id, {
        type: 'ONE_CLICK_APPLY', profile: user_profile, coverLetter, autoSubmit: false
      });
      document.getElementById('fields-filled').textContent = result?.filled || 0;
    }
    incrementAppsCounter();
  } catch (e) {
    console.error('One-click apply failed:', e);
  } finally {
    btn.textContent = '🚀 One-Click Apply';
    btn.disabled = false;
  }
});

// LinkedIn Easy Apply
document.getElementById('linkedin-fill-btn').addEventListener('click', async () => {
  const btn = document.getElementById('linkedin-fill-btn');
  btn.textContent = '⏳ Filling steps...';
  btn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const { user_profile } = await chrome.storage.local.get('user_profile');
    const result = await chrome.tabs.sendMessage(tab.id, {
      type: 'LINKEDIN_AUTO_APPLY', profile: user_profile, autoSubmit: false
    });
    document.getElementById('fields-filled').textContent = result?.filled || 0;
    incrementAppsCounter();
  } catch (e) {
    console.error('LinkedIn fill failed:', e);
  } finally {
    btn.textContent = '🔗 LinkedIn Easy Apply — Fill All Steps';
    btn.disabled = false;
  }
});

// Generate cover letter
document.getElementById('generate-cl-btn').addEventListener('click', async () => {
  const btn = document.getElementById('generate-cl-btn');
  btn.textContent = '⏳ Generating...';
  btn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let jobContext = '';
    try {
      const info = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' });
      jobContext = info?.jobTitle || '';
    } catch {}
    const { supabase_token } = await chrome.storage.local.get('supabase_token');
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/extension-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabase_token}`, 'apikey': ANON },
      body: JSON.stringify({ action: 'generateCoverLetter', jobContext }),
    });
    const data = await resp.json();
    if (data.coverLetter) {
      await chrome.tabs.sendMessage(tab.id, { type: 'INSERT_COVER_LETTER', text: data.coverLetter });
    }
  } catch (e) {
    console.error('CL generation failed:', e);
  } finally {
    btn.textContent = '📝 Generate Cover Letter';
    btn.disabled = false;
  }
});

// Refresh profile
document.getElementById('refresh-btn').addEventListener('click', async () => {
  const { supabase_token } = await chrome.storage.local.get('supabase_token');
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/extension-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabase_token}`, 'apikey': ANON },
      body: JSON.stringify({ action: 'getProfile' }),
    });
    const data = await resp.json();
    if (data.profile) { chrome.storage.local.set({ user_profile: data.profile }); showConnected(data.profile); }
  } catch {}
});

// Disconnect
document.getElementById('disconnect-btn').addEventListener('click', () => {
  chrome.storage.local.remove(['supabase_token', 'user_profile', 'apps_today', 'apps_today_date', 'auto_fill_enabled']);
  showView('login');
});

function incrementAppsCounter() {
  const today = new Date().toDateString();
  chrome.storage.local.get(['apps_today', 'apps_today_date'], (r) => {
    const count = r.apps_today_date === today ? (r.apps_today || 0) + 1 : 1;
    chrome.storage.local.set({ apps_today: count, apps_today_date: today });
    document.getElementById('apps-today').textContent = count;
  });
}
