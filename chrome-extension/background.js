// JobSearchOS Extension - Background Service Worker
const SUPABASE_URL = 'https://ujtloxbdecirhicqfjka.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdGxveGJkZWNpcmhpY3FmamthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjgyNzgsImV4cCI6MjA4NzkwNDI3OH0.AihC-gF0rD0BUWatMzqy8cwlHDr5pMY0c8hWKodemFc';

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'API_REQUEST') {
    handleApiRequest(msg).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true; // async
  }
});

async function handleApiRequest({ action, payload }) {
  const { supabase_token } = await chrome.storage.local.get('supabase_token');
  if (!supabase_token) throw new Error('Not authenticated');

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/extension-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabase_token}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

// Badge update on tab change
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_INFO' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.hasForm) {
        chrome.action.setBadgeText({ text: '●', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#00579B', tabId });
      } else {
        chrome.action.setBadgeText({ text: '', tabId });
      }
    });
  }
});
