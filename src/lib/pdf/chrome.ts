import fs from "fs";

export function resolveChromeExecutable(): string {
  const configured = process.env.CHROME_EXECUTABLE_PATH;
  const candidates = configured ? [configured] : [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
  ];
  for (const candidate of candidates) {
    try { if (fs.statSync(candidate).isFile()) return candidate; } catch {}
  }
  throw new Error("Chrome executable unavailable. Configure CHROME_EXECUTABLE_PATH with an installed browser executable.");
}
