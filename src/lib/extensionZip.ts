import JSZip from "jszip";

// All extension files embedded as strings for client-side ZIP generation
const FILES: Record<string, string> = {
  "manifest.json": `{
  "manifest_version": 3,
  "name": "JobSearchOS Auto Apply",
  "version": "1.0.0",
  "description": "Auto-fill job applications with your JobSearchOS profile data",
  "permissions": ["activeTab", "storage", "scripting"],
  "host_permissions": [
    "https://*.greenhouse.io/*",
    "https://*.lever.co/*",
    "https://*.workday.com/*",
    "https://*.myworkdayjobs.com/*",
    "https://*.smartrecruiters.com/*",
    "https://*.icims.com/*",
    "https://*.taleo.net/*",
    "https://*.brassring.com/*",
    "https://*.jobvite.com/*",
    "https://*.ashbyhq.com/*",
    "https://*.linkedin.com/*",
    "https://*/*"
  ],
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "background.js"
  }
}`,

  "popup.html": `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 340px; font-family: 'Inter', -apple-system, sans-serif; background: #F5F4F0; color: #0A0A0A; font-size: 13px; }
    .header { background: #0A0A0A; color: #fff; padding: 16px 20px; display: flex; align-items: center; gap: 10px; }
    .header .logo { width: 28px; height: 28px; background: linear-gradient(135deg, #00579B, #3399D6); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; color: #fff; }
    .header h1 { font-size: 14px; font-weight: 600; }
    .header .version { font-size: 10px; opacity: 0.5; margin-left: auto; }
    .content { padding: 16px 20px; }
    .status-card { background: #fff; border: 1px solid #E0DFDA; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
    .status-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot-green { background: #1A7F5A; }
    .dot-red { background: #C0392B; }
    .status-text { font-size: 12px; font-weight: 500; }
    .section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #999; margin-bottom: 8px; font-weight: 600; }
    .btn { width: 100%; padding: 10px; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.15s; }
    .btn-primary { background: #00579B; color: #fff; }
    .btn-primary:hover { background: #004480; }
    .btn-secondary { background: #fff; color: #0A0A0A; border: 1px solid #E0DFDA; }
    .btn-secondary:hover { background: #F0EFEB; }
    .btn-danger { background: #C0392B; color: #fff; }
    .btn + .btn { margin-top: 8px; }
    .input-group { margin-bottom: 12px; }
    .input-group label { display: block; font-size: 11px; font-weight: 500; color: #666; margin-bottom: 4px; }
    .input-group input { width: 100%; padding: 8px 10px; border: 1px solid #E0DFDA; border-radius: 6px; font-size: 12px; background: #fff; outline: none; }
    .input-group input:focus { border-color: #00579B; }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
    .stat-box { background: #fff; border: 1px solid #E0DFDA; border-radius: 6px; padding: 10px; text-align: center; }
    .stat-num { font-size: 20px; font-weight: 700; color: #00579B; }
    .stat-label { font-size: 10px; color: #999; margin-top: 2px; }
    .page-info { background: rgba(0,87,155,0.06); border-radius: 6px; padding: 10px; margin-bottom: 12px; font-size: 11px; color: #333; }
    .page-info strong { color: #00579B; }
    #login-view, #connected-view, #loading-view { display: none; }
    .active-view { display: block !important; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">JS</div>
    <h1>JobSearchOS</h1>
    <span class="version">v1.0</span>
  </div>
  <div id="loading-view" class="content active-view">
    <div class="status-card" style="text-align:center; padding: 24px;">
      <div style="font-size: 12px; color: #999;">Connecting...</div>
    </div>
  </div>
  <div id="login-view" class="content">
    <div class="section-label">Connect your account</div>
    <div class="input-group">
      <label>API Token</label>
      <input type="password" id="api-token" placeholder="Paste your extension token" />
    </div>
    <button class="btn btn-primary" id="connect-btn">Connect Account</button>
    <div id="login-error" style="color: #C0392B; font-size: 11px; margin-top: 8px; display: none;"></div>
  </div>
  <div id="connected-view" class="content">
    <div class="status-card">
      <div class="status-row">
        <div class="status-dot dot-green"></div>
        <span class="status-text">Connected as <strong id="user-name"></strong></span>
      </div>
    </div>
    <div id="page-detection" class="page-info" style="display:none;">
      <strong>📋 Application form detected</strong><br>
      <span id="detected-job-title"></span>
    </div>
    <div class="stats">
      <div class="stat-box"><div class="stat-num" id="fields-filled">0</div><div class="stat-label">Fields Filled</div></div>
      <div class="stat-box"><div class="stat-num" id="apps-today">0</div><div class="stat-label">Apps Today</div></div>
    </div>
    <button class="btn btn-primary" id="autofill-btn">⚡ Auto-Fill This Page</button>
    <button class="btn btn-secondary" id="generate-cl-btn">📝 Generate Cover Letter</button>
    <button class="btn btn-secondary" id="refresh-btn">🔄 Refresh Profile</button>
    <button class="btn btn-danger" id="disconnect-btn" style="margin-top: 16px;">Disconnect</button>
  </div>
  <script src="popup.js"></script>
</body>
</html>`,

  "popup.js": `const SUPABASE_URL='https://ujtloxbdecirhicqfjka.supabase.co';const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdGxveGJkZWNpcmhpY3FmamthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjgyNzgsImV4cCI6MjA4NzkwNDI3OH0.AihC-gF0rD0BUWatMzqy8cwlHDr5pMY0c8hWKodemFc';
const views={loading:document.getElementById('loading-view'),login:document.getElementById('login-view'),connected:document.getElementById('connected-view')};
function showView(n){Object.values(views).forEach(v=>v.classList.remove('active-view'));views[n].classList.add('active-view');}
chrome.storage.local.get(['supabase_token','user_profile'],r=>{if(r.supabase_token&&r.user_profile){showConnected(r.user_profile);checkCurrentPage();}else{showView('login');}});
document.getElementById('connect-btn').addEventListener('click',async()=>{const token=document.getElementById('api-token').value.trim();const err=document.getElementById('login-error');err.style.display='none';if(!token){err.textContent='Please enter your API token';err.style.display='block';return;}try{showView('loading');const r=await fetch(SUPABASE_URL+'/functions/v1/extension-api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,apikey:ANON},body:JSON.stringify({action:'getProfile'})});if(!r.ok)throw new Error('Auth failed');const d=await r.json();chrome.storage.local.set({supabase_token:token,user_profile:d.profile});showConnected(d.profile);}catch(e){showView('login');err.textContent=e.message;err.style.display='block';}});
function showConnected(p){showView('connected');document.getElementById('user-name').textContent=p?.display_name||p?.email||'User';chrome.storage.local.get(['apps_today','apps_today_date'],r=>{const t=new Date().toDateString();document.getElementById('apps-today').textContent=r.apps_today_date===t?(r.apps_today||0):0;});}
async function checkCurrentPage(){try{const[t]=await chrome.tabs.query({active:true,currentWindow:true});if(!t?.id)return;const r=await chrome.tabs.sendMessage(t.id,{type:'GET_PAGE_INFO'});if(r?.hasForm){document.getElementById('page-detection').style.display='block';document.getElementById('detected-job-title').textContent=r.jobTitle||'Unknown';}}catch{}}
document.getElementById('autofill-btn').addEventListener('click',async()=>{const[t]=await chrome.tabs.query({active:true,currentWindow:true});if(!t?.id)return;chrome.storage.local.get(['user_profile'],r=>{chrome.tabs.sendMessage(t.id,{type:'AUTOFILL',profile:r.user_profile});});const today=new Date().toDateString();chrome.storage.local.get(['apps_today','apps_today_date'],r=>{const c=r.apps_today_date===today?(r.apps_today||0)+1:1;chrome.storage.local.set({apps_today:c,apps_today_date:today});document.getElementById('apps-today').textContent=c;});});
document.getElementById('generate-cl-btn').addEventListener('click',async()=>{const btn=document.getElementById('generate-cl-btn');btn.textContent='⏳ Generating...';btn.disabled=true;try{const[t]=await chrome.tabs.query({active:true,currentWindow:true});let jc='';try{const i=await chrome.tabs.sendMessage(t.id,{type:'GET_PAGE_INFO'});jc=i?.jobTitle||'';}catch{}const{supabase_token}=await chrome.storage.local.get('supabase_token');const r=await fetch(SUPABASE_URL+'/functions/v1/extension-api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+supabase_token,apikey:ANON},body:JSON.stringify({action:'generateCoverLetter',jobContext:jc})});const d=await r.json();if(d.coverLetter)await chrome.tabs.sendMessage(t.id,{type:'INSERT_COVER_LETTER',text:d.coverLetter});}catch(e){console.error(e);}finally{btn.textContent='📝 Generate Cover Letter';btn.disabled=false;}});
document.getElementById('refresh-btn').addEventListener('click',async()=>{const{supabase_token}=await chrome.storage.local.get('supabase_token');try{const r=await fetch(SUPABASE_URL+'/functions/v1/extension-api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+supabase_token,apikey:ANON},body:JSON.stringify({action:'getProfile'})});const d=await r.json();if(d.profile){chrome.storage.local.set({user_profile:d.profile});showConnected(d.profile);}}catch{}});
document.getElementById('disconnect-btn').addEventListener('click',()=>{chrome.storage.local.remove(['supabase_token','user_profile','apps_today','apps_today_date']);showView('login');});`,

  "content.js": `(()=>{'use strict';const F={first_name:[/first.?name/i,/given.?name/i,/fname/i],last_name:[/last.?name/i,/family.?name/i,/surname/i,/lname/i],email:[/e?.?mail/i],phone:[/phone/i,/mobile/i,/tel/i,/cell/i],linkedin:[/linkedin/i],location:[/location/i,/city/i,/address/i],university:[/university/i,/school/i,/college/i,/education/i],gpa:[/gpa/i,/grade/i],graduation:[/graduat/i,/grad.?year/i],website:[/website/i,/portfolio/i,/url/i,/github/i],salary:[/salary/i,/compensation/i],visa:[/visa/i,/work.?auth/i,/sponsor/i],start_date:[/start.?date/i,/avail/i],experience:[/years?.?of?.?experience/i],skills:[/skills/i,/competenc/i]};
function detect(){const i=document.querySelectorAll('input,textarea,select');const p=document.title+' '+(document.querySelector('h1')?.textContent||'');const a=[/apply/i,/application/i,/candidate/i];const u=window.location.href;return{isApplyPage:a.some(r=>r.test(p))||i.length>3||/greenhouse|lever|workday|myworkdayjobs|smartrecruiters|icims|taleo|brassring|jobvite|ashbyhq/.test(u)||(/linkedin\\.com/.test(u)&&/jobs|apply/.test(u))};}
function title(){for(const s of['h1.job-title','h1.posting-headline','.job-title','[data-automation-id="jobPostingHeader"]','.jobs-unified-top-card__job-title','h1']){const e=document.querySelector(s);if(e?.textContent?.trim())return e.textContent.trim().slice(0,100);}return document.title.slice(0,100);}
function id(el){const a=[el.name,el.id,el.placeholder,el.getAttribute('aria-label'),el.getAttribute('data-automation-id'),el.getAttribute('autocomplete')].filter(Boolean).join(' ');let l='';if(el.id){const lb=document.querySelector('label[for="'+el.id+'"]');if(lb)l=lb.textContent;}const w=el.closest('.field,.form-group,[data-automation-id]');if(w){const lb=w.querySelector('label,.label,legend');if(lb)l=lb.textContent;}const s=(a+' '+l).toLowerCase();for(const[f,ps]of Object.entries(F)){if(ps.some(p=>p.test(s)))return f;}return null;}
function val(t,p){if(!p)return null;const n=p.display_name||'';const ps=n.split(' ');const m={first_name:ps[0]||'',last_name:ps.slice(1).join(' ')||'',email:p.email||'',phone:p.phone||'',linkedin:p.linkedin_url||'',location:p.location||'',university:p.university||'',gpa:p.gpa||'',graduation:p.graduation_year||'',website:p.website||'',salary:p.salary_min?String(p.salary_min):'',visa:p.visa_status||'',start_date:p.start_date||'',experience:p.experience_level||'',skills:Array.isArray(p.skills)?p.skills.join(', '):(p.skills||'')};return m[t]||null;}
function fill(el,v){if(!v||el.disabled||el.readOnly)return false;if(el.tagName==='SELECT'){const o=Array.from(el.options).find(o=>o.text.toLowerCase().includes(v.toLowerCase())||o.value.toLowerCase().includes(v.toLowerCase()));if(o){el.value=o.value;el.dispatchEvent(new Event('change',{bubbles:true}));hl(el);return true;}return false;}const s=Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')?.set;if(s)s.call(el,v);else el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));el.dispatchEvent(new Event('blur',{bubbles:true}));hl(el);return true;}
function hl(el){el.style.transition='box-shadow .3s,border-color .3s';el.style.boxShadow='0 0 0 2px rgba(0,87,155,.3)';el.style.borderColor='#00579B';setTimeout(()=>{el.style.boxShadow='';el.style.borderColor='';},3000);}
function af(p){const els=document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]),textarea,select');let c=0;els.forEach(el=>{if(el.value?.trim())return;const t=id(el);if(!t)return;const v2=val(t,p);if(fill(el,v2))c++;});badge(c);return c;}
function badge(c){const x=document.getElementById('jsos-fill-badge');if(x)x.remove();const d=document.createElement('div');d.id='jsos-fill-badge';d.innerHTML='<div style="position:fixed;bottom:20px;right:20px;background:#0A0A0A;color:#fff;padding:12px 20px;border-radius:8px;font-family:Inter,sans-serif;font-size:13px;z-index:999999;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,.3);animation:jsos-si .3s ease-out"><span style="background:#00579B;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px">'+c+'</span><span>'+(c>0?'fields auto-filled by JobSearchOS':'No matching fields found')+'</span></div>';document.body.appendChild(d);setTimeout(()=>d.remove(),4000);}
function icl(t){const tas=document.querySelectorAll('textarea');let tgt=null;for(const ta of tas){const c=[ta.name,ta.id,ta.placeholder,ta.getAttribute('aria-label')].join(' ').toLowerCase();if(/cover|letter|message|why|motivation|additional/i.test(c)){tgt=ta;break;}}if(!tgt)tgt=Array.from(tas).filter(t=>t.offsetParent!==null).sort((a,b)=>(b.offsetWidth*b.offsetHeight)-(a.offsetWidth*a.offsetHeight))[0];if(tgt){fill(tgt,t);return true;}return false;}
chrome.runtime.onMessage.addListener((m,s,r)=>{if(m.type==='GET_PAGE_INFO'){const{isApplyPage}=detect();r({hasForm:isApplyPage,jobTitle:title()});}else if(m.type==='AUTOFILL'){r({filled:af(m.profile)});}else if(m.type==='INSERT_COVER_LETTER'){r({success:icl(m.text)});}return true;});
const st=document.createElement('style');st.textContent='@keyframes jsos-si{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}';document.head.appendChild(st);})();`,

  "background.js": `const SUPABASE_URL='https://ujtloxbdecirhicqfjka.supabase.co';const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdGxveGJkZWNpcmhpY3FmamthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjgyNzgsImV4cCI6MjA4NzkwNDI3OH0.AihC-gF0rD0BUWatMzqy8cwlHDr5pMY0c8hWKodemFc';
chrome.runtime.onMessage.addListener((m,s,r)=>{if(m.type==='API_REQUEST'){(async()=>{const{supabase_token}=await chrome.storage.local.get('supabase_token');if(!supabase_token)throw new Error('Not authenticated');const resp=await fetch(SUPABASE_URL+'/functions/v1/extension-api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+supabase_token,apikey:ANON},body:JSON.stringify({action:m.action,...m.payload})});if(!resp.ok)throw new Error('API error: '+resp.status);return resp.json();})().then(r).catch(e=>r({error:e.message}));return true;}});
chrome.tabs.onUpdated.addListener((id,ci)=>{if(ci.status==='complete'){chrome.tabs.sendMessage(id,{type:'GET_PAGE_INFO'},r=>{if(chrome.runtime.lastError)return;if(r?.hasForm){chrome.action.setBadgeText({text:'●',tabId:id});chrome.action.setBadgeBackgroundColor({color:'#00579B',tabId:id});}else{chrome.action.setBadgeText({text:'',tabId:id});}});}});`,

  "content.css": `.jsos-filled{box-shadow:0 0 0 2px rgba(0,87,155,.3)!important;border-color:#00579B!important;transition:box-shadow .3s ease,border-color .3s ease}`,
};

export async function downloadExtensionZip() {
  const zip = new JSZip();
  const folder = zip.folder("jobsearchos-extension")!;

  for (const [name, content] of Object.entries(FILES)) {
    folder.file(name, content);
  }

  // Generate a simple 16x16 icon as SVG→PNG placeholder
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="16" fill="#00579B"/><text x="64" y="80" font-family="Arial,sans-serif" font-size="56" font-weight="bold" fill="white" text-anchor="middle">JS</text></svg>`;
  const svgBlob = new Blob([iconSvg], { type: "image/svg+xml" });

  // Create canvas to render icon at different sizes
  for (const size of [16, 48, 128]) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const img = new Image();
      const url = URL.createObjectURL(svgBlob);
      await new Promise<void>((resolve) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, size, size);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        img.src = url;
      });
      const pngData = canvas.toDataURL("image/png").split(",")[1];
      folder.file(`icons/icon${size}.png`, pngData, { base64: true });
    } catch {
      // Fallback: skip icon
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "jobsearchos-chrome-extension.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
