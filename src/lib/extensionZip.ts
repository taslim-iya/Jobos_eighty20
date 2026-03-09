import JSZip from "jszip";

// Dynamically fetch extension files from the codebase at build time isn't possible,
// so we embed them. These match the files in chrome-extension/

const MANIFEST = `{
  "manifest_version": 3,
  "name": "JobSearchOS Auto Apply",
  "version": "1.0.0",
  "description": "Auto-fill job applications with your JobSearchOS profile data",
  "permissions": ["activeTab", "storage", "scripting"],
  "host_permissions": [
    "https://*.greenhouse.io/*", "https://*.lever.co/*", "https://*.workday.com/*",
    "https://*.myworkdayjobs.com/*", "https://*.smartrecruiters.com/*", "https://*.icims.com/*",
    "https://*.taleo.net/*", "https://*.brassring.com/*", "https://*.jobvite.com/*",
    "https://*.ashbyhq.com/*", "https://*.linkedin.com/*", "https://*/*"
  ],
  "action": { "default_popup": "popup.html" },
  "content_scripts": [{ "matches": ["<all_urls>"], "js": ["content.js"], "css": ["content.css"], "run_at": "document_idle" }],
  "background": { "service_worker": "background.js" }
}`;

const CONTENT_CSS = `.jsos-filled{box-shadow:0 0 0 2px rgba(0,87,155,.3)!important;border-color:#00579B!important;transition:box-shadow .3s ease,border-color .3s ease}`;

export async function downloadExtensionZip() {
  // Dynamically import the file contents from the repo
  const [contentJs, popupHtml, popupJs, backgroundJs] = await Promise.all([
    fetch(new URL('../../chrome-extension/content.js', import.meta.url).href).then(r => r.text()).catch(() => ''),
    fetch(new URL('../../chrome-extension/popup.html', import.meta.url).href).then(r => r.text()).catch(() => ''),
    fetch(new URL('../../chrome-extension/popup.js', import.meta.url).href).then(r => r.text()).catch(() => ''),
    fetch(new URL('../../chrome-extension/background.js', import.meta.url).href).then(r => r.text()).catch(() => ''),
  ]);

  const zip = new JSZip();
  const folder = zip.folder("jobsearchos-extension")!;

  folder.file("manifest.json", MANIFEST);
  folder.file("content.js", contentJs || '// Content script - see chrome-extension/content.js');
  folder.file("popup.html", popupHtml || '<!-- See chrome-extension/popup.html -->');
  folder.file("popup.js", popupJs || '// See chrome-extension/popup.js');
  folder.file("background.js", backgroundJs || '// See chrome-extension/background.js');
  folder.file("content.css", CONTENT_CSS);

  // Generate icons
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="16" fill="#00579B"/><text x="64" y="80" font-family="Arial,sans-serif" font-size="56" font-weight="bold" fill="white" text-anchor="middle">JS</text></svg>`;
  const svgBlob = new Blob([iconSvg], { type: "image/svg+xml" });

  for (const size of [16, 48, 128]) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const img = new Image();
      const url = URL.createObjectURL(svgBlob);
      await new Promise<void>((resolve) => {
        img.onload = () => { ctx.drawImage(img, 0, 0, size, size); URL.revokeObjectURL(url); resolve(); };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        img.src = url;
      });
      const pngData = canvas.toDataURL("image/png").split(",")[1];
      folder.file(`icons/icon${size}.png`, pngData, { base64: true });
    } catch { /* skip icon */ }
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
