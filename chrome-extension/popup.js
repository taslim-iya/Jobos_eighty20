// JobSearchOS Extension - Popup Controller
const SUPABASE_URL = 'https://ujtloxbdecirhicqfjka.supabase.co';

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
chrome.storage.local.get(['supabase_token', 'user_profile'], (result) => {
  if (result.supabase_token && result.user_profile) {
    showConnected(result.user_profile);
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

  if (!token) {
    errEl.textContent = 'Please enter your API token';
    errEl.style.display = 'block';
    return;
  }

  try {
    showView('loading');
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/extension-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdGxveGJkZWNpcmhpY3FmamthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjgyNzgsImV4cCI6MjA4NzkwNDI3OH0.AihC-gF0rD0BUWatMzqy8cwlHDr5pMY0c8hWKodemFc',
      },
      body: JSON.stringify({ action: 'getProfile' }),
    });

    if (!resp.ok) throw new Error('Authentication failed');
    const data = await resp.json();

    chrome.storage.local.set({
      supabase_token: token,
      user_profile: data.profile,
    });

    showConnected(data.profile);
  } catch (e) {
    showView('login');
    errEl.textContent = e.message || 'Connection failed';
    errEl.style.display = 'block';
  }
});

function showConnected(profile) {
  showView('connected');
  document.getElementById('user-name').textContent = profile?.display_name || profile?.email || 'User';

  // Load stats
  chrome.storage.local.get(['apps_today', 'apps_today_date'], (r) => {
    const today = new Date().toDateString();
    const count = r.apps_today_date === today ? (r.apps_today || 0) : 0;
    document.getElementById('apps-today').textContent = count;
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
    }
  } catch { /* content script not loaded */ }
}

// Auto-fill button
document.getElementById('autofill-btn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.storage.local.get(['user_profile'], (r) => {
    chrome.tabs.sendMessage(tab.id, { type: 'AUTOFILL', profile: r.user_profile });
  });
  // Increment counter
  const today = new Date().toDateString();
  chrome.storage.local.get(['apps_today', 'apps_today_date'], (r) => {
    const count = r.apps_today_date === today ? (r.apps_today || 0) + 1 : 1;
    chrome.storage.local.set({ apps_today: count, apps_today_date: today });
    document.getElementById('apps-today').textContent = count;
  });
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase_token}`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdGxveGJkZWNpcmhpY3FmamthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjgyNzgsImV4cCI6MjA4NzkwNDI3OH0.AihC-gF0rD0BUWatMzqy8cwlHDr5pMY0c8hWKodemFc',
      },
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase_token}`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdGxveGJkZWNpcmhpY3FmamthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjgyNzgsImV4cCI6MjA4NzkwNDI3OH0.AihC-gF0rD0BUWatMzqy8cwlHDr5pMY0c8hWKodemFc',
      },
      body: JSON.stringify({ action: 'getProfile' }),
    });
    const data = await resp.json();
    if (data.profile) {
      chrome.storage.local.set({ user_profile: data.profile });
      showConnected(data.profile);
    }
  } catch {}
});

// Disconnect
document.getElementById('disconnect-btn').addEventListener('click', () => {
  chrome.storage.local.remove(['supabase_token', 'user_profile', 'apps_today', 'apps_today_date']);
  showView('login');
});
