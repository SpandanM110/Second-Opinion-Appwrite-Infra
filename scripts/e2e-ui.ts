// A brand-new person's journey through the real UI against the real backend, then cleanup.
//   node scripts/with-key.mjs npx tsx scripts/e2e-ui.ts http://localhost:4177
import path from 'node:path';
import type { Page } from 'puppeteer-core';
import { launchEdge } from './edge.mjs';
import { Client, Query, TablesDB, Users, Storage } from 'node-appwrite';

const base = process.argv[2] ?? 'http://localhost:4177';
const shotDir = process.argv[3];
const stamp = Date.now().toString(36);
const EMAIL = `e2e-ui-${stamp}@example.com`;
const PASSWORD = `pw-${stamp}-xyz-123`;
const SUFFIX = stamp.slice(-3).toUpperCase();
const NAME = `Testy ${SUFFIX}`;
const NAME2 = `Quinn ${SUFFIX}`;

const admin = new Client().setEndpoint(process.env.APPWRITE_ENDPOINT!).setProject(process.env.APPWRITE_PROJECT_ID!).setKey(process.env.APPWRITE_API_KEY!);
const db = new TablesDB(admin);
const users = new Users(admin);
const adminStorage = new Storage(admin);

const steps: string[] = [];
let failed = 0;
const errors: string[] = [];

const browser = await launchEdge();
// the tab Edge opened with is the foreground one; a tab opened later can start in the background, where animation frames pause
const page: Page = (await browser.pages())[0] ?? (await browser.newPage());
await page.bringToFront();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(30000);
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
page.on('console', (m) => m.type() === 'error' && !/status of (401|404)|ERR_INTERNET_DISCONNECTED/.test(m.text()) && errors.push(m.text().slice(0, 200)));

async function vitals(label: string) {
  if (!process.env.E2E_VITALS) return;
  const m = await Promise.race([page.metrics(), new Promise<null>((r) => setTimeout(() => r(null), 5000))]).catch(() => null);
  console.log(`   vitals after "${label.slice(0, 40)}": ${m ? `script ${m.ScriptDuration?.toFixed(1)}s, heap ${((m.JSHeapUsedSize ?? 0) / 1e6).toFixed(0)}MB, nodes ${m.Nodes}, listeners ${m.JSEventListeners}` : 'NO RESPONSE'}`);
}

/** When the page stops answering, ask the debugger where the main thread is stuck. */
async function diagnoseFreeze(): Promise<string> {
  try {
    const cdp = await page.createCDPSession();
    const paused = new Promise<any>((resolve) => cdp.once('Debugger.paused', resolve));
    await Promise.race([cdp.send('Debugger.enable'), new Promise((_, rej) => setTimeout(() => rej(new Error('debugger unreachable')), 4000))]);
    await cdp.send('Debugger.pause').catch(() => {});
    const ev = await Promise.race([paused, new Promise<null>((r) => setTimeout(() => r(null), 5000))]);
    if (!ev) return 'main thread did not pause: renderer is blocked outside JavaScript (or idle but not answering)';
    return 'JS stack: ' + ev.callFrames.slice(0, 8).map((f: any) => `${f.functionName || '(anon)'} @ ${String(f.url).split('/').slice(-2).join('/')}:${f.location.lineNumber + 1}`).join(' <- ');
  } catch (e: any) {
    return 'diagnosis failed: ' + String(e?.message ?? e).slice(0, 120);
  }
}

async function step(name: string, fn: () => Promise<string | void>) {
  try {
    const note = await Promise.race([fn(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('step timed out after 90 s')), 90000))]);
    steps.push(`✓ ${name}${note ? ` — ${note}` : ''}`);
    console.log(steps[steps.length - 1]);
    await vitals(name);
    await new Promise((r) => setTimeout(r, Number(process.env.E2E_PACE ?? 1200))); // a person pauses between actions
  } catch (e: any) {
    failed++;
    const responsive = await Promise.race([page.evaluate(() => 1).then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 4000))]).catch(() => false);
    const why = responsive ? '' : '  [PAGE FROZEN] ' + (await diagnoseFreeze());
    steps.push(`✗ ${name}: ${String(e?.message ?? e).slice(0, 300)}${why}`);
    console.log(steps[steps.length - 1]);
    if (shotDir) await page.screenshot({ path: path.join(shotDir, `fail-${name.replace(/\W+/g, '_').slice(0, 40)}.png`) }).catch(() => {});
  }
}
const text = () => page.evaluate(() => document.body.innerText);
const waitText = (t: string, timeout = 15000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout, polling: 100 }, t);
const waitGone = (t: string, timeout = 15000) => page.waitForFunction((t) => !document.body.innerText.includes(t), { timeout, polling: 100 }, t);
async function clickText(sel: string, t: string, within = 'body') {
  const ok = await page.evaluate(
    (sel, t, within) => {
      const root = document.querySelector(within) ?? document.body;
      const el = [...root.querySelectorAll(sel)].find((e) => (e.textContent ?? '').trim().includes(t) && (e as HTMLElement).getClientRects().length > 0) as HTMLElement | undefined;
      el?.click();
      return Boolean(el);
    },
    sel,
    t,
    within,
  );
  if (!ok) throw new Error(`no visible ${sel} with "${t}" in ${within}`);
}
const dialog = 'dialog[open]';
const typeInto = async (sel: string, value: string) => {
  await page.waitForSelector(sel, { visible: true });
  await page.click(sel, { clickCount: 3 });
  await page.type(sel, value);
};

try {
  await step('signed-out: the share button asks you to create an account first', async () => {
    await page.goto(`${base}/check`, { waitUntil: 'networkidle0' });
    await clickText('button', 'Share a price');
    await page.waitForSelector(dialog);
    await waitText('Create your account');
  });

  await step('account form validates in plain words', async () => {
    await clickText('button', 'Create account', dialog);
    await waitText('Add a name neighbours will see');
    await typeInto(`${dialog} input[autocomplete=name]`, NAME);
    await typeInto(`${dialog} input[type=email]`, 'not-an-email');
    await clickText('button', 'Create account', dialog);
    await waitText('Check your email address');
    await typeInto(`${dialog} input[type=email]`, EMAIL);
    await typeInto(`${dialog} input[autocomplete=new-password]`, 'short');
    await clickText('button', 'Create account', dialog);
    await waitText('at least 8 characters');
  });

  await step('sign up → straight into the share form (the action carries on)', async () => {
    await typeInto(`${dialog} input[autocomplete=new-password]`, PASSWORD);
    await page.select(`${dialog} select`, 'bhopal');
    await clickText('button', 'Create account', dialog);
    await waitText('What did you pay for?');
    await waitText(`Welcome, ${NAME.split(' ')[0]}`);
  });

  await step('an absurd price is caught before saving, with the unit', async () => {
    await page.select(`${dialog} select`, 'plumber-visit');
    await typeInto(`${dialog} input[inputmode=numeric]`, '90000');
    await waitText('highest price we’d expect');
    const disabled = await page.$eval(`${dialog} button[type=submit]`, (b) => (b as HTMLButtonElement).disabled);
    if (!disabled) throw new Error('Save was enabled for an absurd price');
  });

  await step('a real price saves, with a receipt photo', async () => {
    await typeInto(`${dialog} input[inputmode=numeric]`, '260');
    await clickText('button', 'I paid', dialog);
    const input = await page.$(`${dialog} input[type=file]`);
    // the fixture is renamed so cleanup can find the upload
    const fs = await import('node:fs');
    const tmp = path.join(process.env.TEMP ?? '.', `e2e-ui-${stamp}.png`);
    fs.copyFileSync(path.resolve('scripts/fixture-receipt.png'), tmp);
    await input!.uploadFile(tmp);
    await page.waitForSelector(`${dialog} img[alt="Your receipt"]`);
    await clickText('button', 'Save price', dialog);
    await waitText('Your price is in', 25000);
  });

  await step('the draft was cleared and the stats refresh started', async () => {
    const draft = await page.evaluate(() => localStorage.getItem('so.draft.log.v1'));
    if (draft && draft !== 'null') throw new Error('draft not cleared: ' + draft);
    await clickText('button', 'Done', dialog);
    await page.waitForFunction(() => !document.querySelector('dialog[open]'), { polling: 100 });
  });

  await step('my price shows on the card page under my name, with the receipt tag', async () => {
    await page.goto(`${base}/item/plumber-visit?c=bhopal`, { waitUntil: 'networkidle0' });
    await waitText(NAME);
    await waitText('receipt');
  });

  await step('confirm a neighbour’s price (one tap), and only once', async () => {
    await clickText('button', 'I paid about this too', 'main');
    await waitText('Thanks, you confirmed this price');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /You paid about this too/.test(b.textContent ?? '')), { polling: 100 });
  });

  await step('flag a price with a reason', async () => {
    await clickText('button', 'Flag', 'main');
    await page.waitForSelector(dialog);
    await waitText('What’s wrong with it?');
    await clickText('button', 'A tourist or newcomer price', dialog);
    await clickText('button', 'Flag this price', dialog);
    await waitText('Flagged.');
  });

  await step('my own price has no confirm or flag buttons', async () => {
    const own = await page.evaluate((name) => {
      const lis = [...document.querySelectorAll('main li')].filter((l) => l.textContent?.includes(name) && !l.querySelector('li'));
      return lis.map((li) => ({ text: (li as HTMLElement).innerText.replace(/s+/g, ' ').slice(0, 160), buttons: [...li.querySelectorAll('button')].map((b) => b.textContent?.trim()) }));
    }, NAME);
    if (!own.length) throw new Error('own row not found');
    const bad = own.filter((r) => r.buttons.some((t) => /paid about this|Flag/.test(t ?? '')));
    if (bad.length) throw new Error('buttons on own price: ' + JSON.stringify(bad));
  });

  await step('ask locals: shows the fair price and where the quote lands, then posts', async () => {
    await page.goto(`${base}/item/auto-station-to-centre?c=bhopal&l=bpl-rani-kamlapati-station`, { waitUntil: 'networkidle0' });
    await clickText('button', 'Ask locals', 'main');
    await page.waitForSelector(dialog);
    await waitText('Fair price now');
    await typeInto(`${dialog} input[inputmode=numeric]`, '300');
    await waitText('is 2.');
    await typeInto(`${dialog} textarea`, 'Quoted at the gate. Fair?');
    await clickText('button', 'Ask locals', `${dialog} form`);
    await page.waitForFunction(() => location.pathname.startsWith('/q/'), { timeout: 25000, polling: 100 });
    await page.waitForFunction(() => /^Is ₹ ?300 fair\?/.test((document.querySelector('h1')?.innerText ?? '').replace(/\s+/g, ' ')), { timeout: 15000 });
  });

  await step('answer someone else’s question; it appears live', async () => {
    await page.goto(`${base}/q/seed-qc-02`, { waitUntil: 'networkidle0' });
    await waitText('Live');
    await typeInto('textarea#reply', 'Paid ₹250 last month in the same lane.');
    await clickText('button', 'Post answer', 'main');
    await waitText('Paid ₹250 last month in the same lane.', 20000);
  });

  await step('Me: profile, journey progress and my prices', async () => {
    await page.goto(`${base}/me`, { waitUntil: 'networkidle0' });
    await waitText(NAME);
    await waitText('Your journey');
    await waitText('Your prices');
    const t = await text();
    if (!/Share your first price/.test(t)) throw new Error('journey missing');
    return /Next: ([^.]+)/.exec(t)?.[1];
  });

  await step('edit profile: change the name', async () => {
    await page.click('button[aria-label="Edit profile"]');
    await typeInto('main form input[maxlength="40"]', NAME2);
    await clickText('button', 'Save', 'main form');
    await waitText('Profile updated');
    await waitText(NAME2);
  });

  await step('sign out → signed-out Me; stays signed out after reload', async () => {
    await clickText('button', 'Sign out', 'main');
    await waitText('Become a trusted local');
    await page.reload({ waitUntil: 'networkidle0' });
    await waitText('Become a trusted local');
  });

  await step('sign in again with the same account', async () => {
    await clickText('button', 'Sign in or create an account', 'main');
    await page.waitForSelector(dialog);
    await clickText('button', 'Sign in', `${dialog} form`);
    await waitText('Welcome back');
    // forgot password: asks for the email, then says the same thing either way
    await clickText('button', 'Forgot password?', dialog);
    await waitText('Reset your password');
    await typeInto(`${dialog} input[type=email]`, EMAIL);
    await clickText('button', 'Send reset link', dialog);
    await waitText('Check your email');
    await clickText('button', 'Back to sign in', dialog);
    await waitText('Welcome back');
    await typeInto(`${dialog} input[type=email]`, EMAIL);
    await typeInto(`${dialog} input[autocomplete=current-password]`, 'wrong-password-1');
    await clickText('button', 'Sign in', `${dialog} form`);
    await waitText('don’t match');
    await typeInto(`${dialog} input[autocomplete=current-password]`, PASSWORD);
    await clickText('button', 'Sign in', `${dialog} form`);
    await waitText(NAME2);
  });

  await step('the reset page: incomplete link, mismatched passwords and an expired link are all explained', async () => {
    await page.goto(`${base}/reset`, { waitUntil: 'networkidle0' });
    await waitText('That link isn’t complete');
    await page.goto(`${base}/reset?userId=nobody&secret=expired`, { waitUntil: 'networkidle0' });
    await typeInto('input[autocomplete=new-password]', 'a-new-password-1');
    await page.type('label:nth-of-type(2) input', 'something-else-1');
    await clickText('button', 'Save new password', 'main');
    await waitText('don’t match');
    await page.click('label:nth-of-type(2) input', { clickCount: 3 });
    await page.type('label:nth-of-type(2) input', 'a-new-password-1');
    await clickText('button', 'Save new password', 'main');
    await waitText('expired or was already used');
  });

  await step('the public API works from its own page: Send returns 200 and a real price', async () => {
    await page.goto(`${base}/api`, { waitUntil: 'networkidle0' });
    await clickText('button', 'Send', 'main');
    await page.waitForFunction(() => /"status": "ok"/.test(document.body.innerText) && /"median"/.test(document.body.innerText), { timeout: 30000, polling: 100 });
    const t = await text();
    if (!/200/.test(t)) throw new Error('no 200 badge');
    return /"median": (d+)/.exec(t)?.[0];
  });

  await step('a link to something that does not exist says so (not "check your connection")', async () => {
    await page.goto(`${base}/q/does-not-exist`, { waitUntil: 'networkidle0' });
    await waitText('That question isn’t here');
    await page.goto(`${base}/u/does-not-exist`, { waitUntil: 'networkidle0' });
    await waitText('That profile isn’t here');
  });

  await step('offline: a price is kept on the phone and sent when the connection returns', async () => {
    await page.goto(`${base}/check`, { waitUntil: 'networkidle0' });
    await clickText('button', 'Share a price');
    await page.waitForSelector(dialog);
    await page.select(`${dialog} select`, 'chai');
    await typeInto(`${dialog} input[inputmode=numeric]`, '12');
    await page.setOfflineMode(true);
    await clickText('button', 'Save price', dialog);
    await waitText('Saved on this phone');
    await clickText('button', 'Done', dialog);
    await page.setOfflineMode(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await waitText('Your saved price was sent', 30000);
  });

  await step('the server holds exactly what this person did, as them', async () => {
    const list = await users.list({ queries: [Query.equal('email', EMAIL)] });
    const uid = list.users[0].$id;
    const logs = await db.listRows({ databaseId: 'main', tableId: 'price_logs', queries: [Query.equal('user_id', uid), Query.limit(50)] });
    const prices = logs.rows.map((r: any) => `${r.item_id}:${r.price}:${r.price_type}${r.proof_file_id ? ':receipt' : ''}`).sort();
    const expected = ['auto-station-to-centre:300:quoted', 'chai:12:paid', 'plumber-visit:260:paid:receipt'];
    if (JSON.stringify(prices) !== JSON.stringify(expected)) throw new Error(`got ${prices.join(', ')}`);
    const flags = await db.listRows({ databaseId: 'main', tableId: 'flags', queries: [Query.equal('user_id', uid)] });
    const confs = await db.listRows({ databaseId: 'main', tableId: 'confirmations', queries: [Query.equal('user_id', uid)] });
    if (flags.total !== 1 || confs.total !== 1) throw new Error(`flags ${flags.total}, confirmations ${confs.total}`);
    return `${prices.length} prices, 1 flag, 1 confirmation`;
  });
} finally {
  await browser.close();
  // cleanup everything this person created
  try {
    const list = await users.list({ queries: [Query.equal('email', EMAIL)] });
    for (const u of list.users) {
      for (const [table, field] of [['replies', 'user_id'], ['quote_checks', 'user_id'], ['confirmations', 'user_id'], ['flags', 'user_id'], ['price_logs', 'user_id']] as const) {
        for (;;) {
          const { rows } = await db.listRows({ databaseId: 'main', tableId: table, queries: [Query.equal(field, u.$id), Query.limit(100)] });
          if (!rows.length) break;
          await Promise.all(rows.map((r) => db.deleteRow({ databaseId: 'main', tableId: table, rowId: r.$id })));
        }
      }
      await db.deleteRow({ databaseId: 'main', tableId: 'users', rowId: u.$id }).catch(() => {});
      await users.delete({ userId: u.$id });
    }
    const files = await adminStorage.listFiles({ bucketId: 'receipts', queries: [Query.startsWith('name', `e2e-ui-${stamp}`), Query.limit(50)] });
    for (const f of files.files) await adminStorage.deleteFile({ bucketId: 'receipts', fileId: f.$id });
    // the confirmation/flag changed counters on seed rows; the next recompute puts them back
  } catch (e) {
    steps.push(`! cleanup problem: ${e}`);
  }
  console.log(steps.join('\n'));
  console.log(errors.length ? `\nCONSOLE ERRORS:\n${[...new Set(errors)].join('\n')}` : '\nno console errors');
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
}
