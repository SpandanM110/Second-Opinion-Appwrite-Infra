// Starts Microsoft Edge headless on its own and attaches puppeteer to it. Used by the UI tests.
// (puppeteer's own launch flags are rejected by recent Edge builds; Edge itself starts fine.)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const EXE = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });

export async function launchEdge() {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'so-edge-'));
  const child = spawn(EXE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  let browser;
  for (let i = 0; i < 60 && !browser; i++) {
    try {
      browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null, protocolTimeout: 30000 });
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!browser) {
    child.kill();
    throw new Error('Edge did not start');
  }
  const close = browser.close.bind(browser);
  browser.close = async () => {
    await close().catch(() => {});
    child.kill();
    setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); } catch { /* a locked cache file is harmless */ } }, 1500).unref();
  };
  return browser;
}
