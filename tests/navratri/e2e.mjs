import { chromium } from 'playwright';
import fs from 'node:fs';
const file = process.argv[2] || new URL('../../index.html', import.meta.url).pathname, out = process.argv[3] || '/tmp';
const mock = fs.readFileSync(new URL('./mock-supabase.js', import.meta.url), 'utf8');
const browser = await chromium.launch();
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// Phones use the bottom tab bar; wide screens use the left sidebar.
const go = (p, view, width = 390) => p.click((width < 900 ? '.tabbar' : '#nav') + ` [data-view="${view}"]`);
const seg = (p, name) => p.click(`[data-seg="${name}"]`);
async function open(qs, width = 390) {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  await page.clock.setFixedTime(new Date('2026-10-12T10:00:00+05:30'));
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.route('**/*', r => { const u = r.request().url();
    if (u.startsWith('http://app.test/')) return r.fulfill({ contentType: 'text/html', body: fs.readFileSync(file, 'utf8') });
    if (u.includes('esm.sh/@supabase')) return r.fulfill({ contentType: 'application/javascript', body: mock });
    return r.fulfill({ status: 404, body: '' }); });
  await page.goto('http://app.test/' + qs); await page.waitForTimeout(400);
  await go(page, 'navratri', width); await page.waitForTimeout(600);
  return page;
}
const settle = p => p.waitForTimeout(500);
const db = (p, t) => p.evaluate(t => window.__db[t], t);
const text = (p, s) => p.locator(s).first().innerText();

// ---------- Admin ----------
const a = await open('?role=admin');
await a.fill('#seasonForm [name=starts_on]', '2026-10-25'); await a.fill('#seasonForm [name=ends_on]', '2026-10-17');
await a.click('#seasonForm button'); await settle(a);
ok((await db(a, 'navratri_seasons')).length === 0, 'end-before-start season is rejected client-side');
await a.fill('#seasonForm [name=starts_on]', '2026-10-17'); await a.fill('#seasonForm [name=ends_on]', '2026-10-25');
await a.dblclick('#seasonForm button'); await a.waitForTimeout(900);
ok((await db(a, 'navratri_seasons')).length === 1, 'double-tap creates exactly one season');
ok((await db(a, 'navratri_households')).length === 19, '19 households seeded');
ok(await a.inputValue('#tokenDayPicker') === '2026-10-17', 'token day clamps to season start when today is before the festival');
ok(await a.locator('#expenseForm').count() === 1, 'expense form is rendered');
ok((await a.locator('h3.subhead').allInnerTexts()).some(x => x.startsWith('Token records for')), 'token records section is rendered');

await a.click('[data-house-edit="35"]'); await a.waitForTimeout(150);
ok(await a.locator('#householdModal').isVisible(), 'tapping house 35 opens the sheet');
await a.fill('#householdMemberCount', '6');
ok((await text(a, '#householdDuePreview')).includes('3,000'), 'due preview updates live (6 × ₹500)');
await a.click('#householdForm button[type=submit]'); await settle(a);
ok((await db(a, 'navratri_households')).find(h => h.house_number === 35).participant_count === 6, 'member count saved');
await a.click('[data-house-edit="35"]'); await a.waitForTimeout(150);
ok(await a.inputValue('#contributionAmount') === '3000', 'payment amount prefilled with outstanding');
await a.dblclick('#contributionForm button[type=submit]'); await a.waitForTimeout(800);
ok((await db(a, 'navratri_contributions')).length === 1, 'double-tap records exactly one payment');
await a.keyboard.press('Escape');

for (const [n, m, pay] of [[36, 1, '1000'], [37, 1, null]]) {
  await a.click(`[data-house-edit="${n}"]`); await a.fill('#householdMemberCount', String(m)); await a.click('#householdForm button[type=submit]'); await settle(a);
  if (pay) { await a.click(`[data-house-edit="${n}"]`); await a.fill('#contributionAmount', pay); await a.click('#contributionForm button[type=submit]'); await settle(a); }
}
const kpi = await a.locator('.festival-kpis .metric strong').allInnerTexts();
ok(kpi[0].includes('4,000') && kpi[1].includes('500'), 'pending is per-house (overpay at 36 does not hide 37 owing): ' + kpi.join(' | '));
ok((await a.locator('[data-house-edit="31"] .house-payment-state').innerText()).includes('Not participating'), 'house with 0 members shows Not participating');
ok((await a.locator('[data-house-edit="36"] .house-payment-state').innerText()).includes('Overpaid'), 'house 36 shows Overpaid');

await seg(a, 'tokens'); await a.click('[data-quick-token="35"]'); await a.waitForTimeout(200);
ok(await a.inputValue('#tokenForm [name=house_number]') === '35', 'house selector preselects house 35');
ok((await text(a, '#tokenForm .mobile-select-trigger')).trim().startsWith('35'), 'custom picker label shows 35 too');
ok(await a.inputValue('#tokenForm [name=token_count]') === '6', 'token count prefilled with remaining members');
await a.fill('#tokenForm [name=token_count]', '2'); await a.click('#tokenForm button[type=submit]'); await settle(a);
await a.click('[data-household-tokens-received="35"]'); await settle(a);
const t35 = (await db(a, 'navratri_tokens')).filter(x => x.house_number === 35);
ok(t35.every(x => x.status === 'received') && t35.reduce((s, x) => s + x.token_count, 0) === 6, 'Mark all received completes pending rows without over-counting (total 6)');
ok(await a.locator('[data-household-tokens-received="35"]').count() === 0, 'house 35 leaves the waiting list');
ok(await a.locator('[data-quick-token="35"] .token-dot.green').count() === 1, 'house 35 dot turns green');

await a.fill('#tokenDayPicker', '2026-10-18'); await a.dispatchEvent('#tokenDayPicker', 'change'); await settle(a);
ok(await a.locator('[data-household-tokens-received="35"]').count() === 1, 'next day: house 35 is waiting again');

await seg(a, 'expenses'); await a.fill('#expenseForm [name=description]', 'Tea'); await a.fill('#expenseForm [name=amount]', '100');
await a.dblclick('#expenseForm button[type=submit]'); await a.waitForTimeout(800);
ok((await db(a, 'navratri_expenses')).length === 1, 'double-tap adds one expense');

await seg(a, 'houses'); await a.fill('#festivalRateForm [name=rate]', '600'); await a.click('#festivalRateForm button[type=submit]'); await settle(a);
const h35 = (await db(a, 'navratri_households')).find(h => h.house_number === 35);
ok(h35.contribution_per_person_paise === 60000 && h35.participant_count === 6, 'rate change keeps member count');
await a.screenshot({ path: out + '/admin-active.png', fullPage: true });
await a.click('[data-house-edit="35"]'); await a.waitForTimeout(150);
await a.screenshot({ path: out + '/admin-sheet.png' });
await a.keyboard.press('Escape');

await a.click('#closeSeasonBtn'); await settle(a);
ok(await a.locator('#seasonForm').count() === 1, 'after closing, admin can create a new season');
ok(await a.locator('#reopenSeasonBtn').count() === 1, 'closed season can be reopened');
ok(await a.locator('#tokenForm, #expenseForm, #festivalRateForm').count() === 0, 'closed season is read-only');
await go(a, 'overview'); await go(a, 'navratri'); await settle(a);
const overflow = await a.evaluate(() => document.documentElement.scrollWidth > innerWidth);
ok(!overflow, 'no horizontal overflow at 390px');
ok(a.errors.length === 0, 'admin: no console errors ' + JSON.stringify(a.errors));

// ---------- Resident ----------
const r = await open('?role=resident&seed=1');
const rk = await r.locator('.festival-kpis .metric strong').allInnerTexts();
ok(rk.length === 3 && rk[0].includes('1,000') && rk[1].includes('500') && rk[2].includes('500'), 'resident sees own due/paid/pending: ' + rk.join(' | '));
ok(await r.locator('#expenseForm, #tokenForm, .contributionForm, #contributionForm, [data-house-edit]').count() === 0, 'resident sees no admin controls');
ok(!(await r.locator('#viewContent').innerText()).includes('Festival expenses'), 'resident does not see misleading expense/balance KPI');
ok(r.errors.length === 0, 'resident: no console errors ' + JSON.stringify(r.errors));
await r.screenshot({ path: out + '/resident.png', fullPage: true });
const w = await open('?role=admin&seed=1', 320);
ok(!(await w.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal overflow at 320px');

// ---------- New layout checks ----------
const s1 = await open('?role=admin&seed=1');
ok(await s1.locator('.tabbar').isVisible() && !(await s1.locator('.sidebar').isVisible()), 'phone shows bottom tab bar, not the sidebar');
ok(await s1.locator('[data-pane="houses"]').isVisible() && !(await s1.locator('[data-pane="tokens"]').isVisible()), 'Navratri opens on the Houses tab only');
await s1.click('[data-house-edit="33"]'); await s1.waitForTimeout(150);
const before = Number(await s1.inputValue('#householdMemberCount'));
await s1.click('[data-step="1"]'); await s1.click('[data-step="1"]');
ok(Number(await s1.inputValue('#householdMemberCount')) === before + 2, '+ button adds members');
await s1.click('[data-step="-1"]');
ok(Number(await s1.inputValue('#householdMemberCount')) === before + 1, '– button removes a member');
await s1.keyboard.press('Escape');
await s1.click('#moreBtn'); await s1.waitForTimeout(150);
ok(await s1.locator('#moreSheet [data-view="houses"]').isVisible(), 'More sheet lists admin pages');
await s1.click('#moreSheet [data-view="funds"]'); await s1.waitForTimeout(400);
ok(!(await s1.locator('#moreSheet').isVisible()) && (await text(s1, '#viewTitle')) === 'Fund records', 'More sheet navigates and closes');
await s1.screenshot({ path: out + '/phone-funds.png' });
const d = await open('?role=admin&seed=1', 1280);
ok(await d.locator('.sidebar').isVisible() && !(await d.locator('.tabbar').isVisible()), 'desktop shows the left sidebar, not the tab bar');
await d.screenshot({ path: out + '/desktop-navratri.png', fullPage: true });
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
