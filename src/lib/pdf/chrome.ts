import fs from "fs";
import type { LaunchOptions } from "puppeteer-core";

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

let vercelLaunchOptions: Promise<LaunchOptions> | undefined;

export function getBrowserLaunchOptions(): Promise<LaunchOptions> | LaunchOptions {
  if (process.env.VERCEL !== "1" && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return {
      executablePath: resolveChromeExecutable(),
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--font-render-hinting=none"],
    };
  }

  if (process.env.CHROME_EXECUTABLE_PATH) {
    return {
      executablePath: process.env.CHROME_EXECUTABLE_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--font-render-hinting=none"],
    };
  }

  vercelLaunchOptions ??= import("@sparticuz/chromium").then<LaunchOptions>(async (mod: any) => {
    const chromium = mod.default || mod;
    return {
      executablePath: await chromium.executablePath(),
      headless: "shell" as const,
      args: chromium.args,
    };
  }).catch((error: unknown) => {
    vercelLaunchOptions = undefined;
    throw error;
  });

  return vercelLaunchOptions;
}
