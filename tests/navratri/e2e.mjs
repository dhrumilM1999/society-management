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
    if (u.includes('fonts.googleapis.com') || u.includes('fonts.gstatic.com')) return r.fulfill({ contentType: 'text/css', body: '' });
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
  await seg(a, 'houses'); await a.click(`[data-house-edit="${n}"]`); await a.fill('#householdMemberCount', String(m)); await a.click('#householdForm button[type=submit]'); await settle(a);
  if (pay) { await seg(a, 'houses'); await a.click(`[data-house-edit="${n}"]`); await a.fill('#contributionAmount', pay); await a.click('#contributionForm button[type=submit]'); await settle(a); }
}
await seg(a, 'houses');
const kpi = await a.locator('.festival-kpis .metric strong').allInnerTexts();
ok(kpi[0].includes('4,000') && kpi[1].includes('500'), 'pending is per-house (overpay at 36 does not hide 37 owing): ' + kpi.join(' | '));
ok((await a.locator('[data-house-edit="31"] .house-payment-state').innerText()).includes('Not participating'), 'house with 0 members shows Not participating');
ok((await a.locator('[data-house-edit="36"] .house-payment-state').innerText()).includes('Overpaid'), 'house 36 shows Overpaid with amount');

// Overpayment refund: house 36 overpaid -> record refund -> back to Paid
await seg(a, 'houses'); await a.click('[data-house-edit="36"]'); await a.waitForTimeout(150);
ok(await a.locator('#refundBox').isVisible(), 'overpaid house shows the refund box');
const refundAmt = await a.inputValue('#refundAmount');
await a.click('#refundForm button[type=submit]'); await settle(a);
const refunds = (await db(a, 'navratri_contributions')).filter(x => x.entry_type === 'refund');
ok(refunds.length === 1 && refunds[0].amount_paise === Number(refundAmt) * 100, 'refund recorded for exactly the overpaid amount (₹' + refundAmt + ')');
ok((await a.locator('[data-house-edit="36"] .house-payment-state').innerText()).includes('Paid'), 'house 36 shows Paid after refund');
await a.click('[data-house-edit="36"]'); await a.waitForTimeout(150);
ok(!(await a.locator('#refundBox').isVisible()), 'refund box hidden once nothing is overpaid');
await a.keyboard.press('Escape');

await seg(a, 'tokens'); await a.click('[data-quick-token="35"]');
// Payment gate: house 37 owes money, so no tokens until it pays.
await a.click('[data-quick-token="37"]'); await a.waitForTimeout(200);
ok(await a.locator('#tokenStatus').isVisible() && (await text(a, '#tokenStatus')).includes('37'), 'unpaid house shows its payment status in the token form');
ok(await a.locator('#tokenForm button[type=submit]').isDisabled(), 'assign token is blocked for an unpaid house');
ok(await a.locator('[data-household-tokens-received="37"]').count() === 0, 'unpaid house has no Mark received button');
ok((await a.locator('[data-quick-token="37"] .token-dot.amber').count()) === 1, 'unpaid house shows the amber dot');
await a.click('[data-quick-token="35"]'); await a.waitForTimeout(200);
ok(!(await a.locator('#tokenForm button[type=submit]').isDisabled()), 'paid house can be issued tokens'); await a.waitForTimeout(200);
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
// Collect payment (with call / message links), then token day chips, edit and undo
const s2 = await open('?role=admin&seed=1');
ok(await s2.locator('.pay-due-panel [data-mark-paid="33"]').count() === 1, 'unpaid house 33 appears in Payments to collect');
const wa = await s2.locator('.pay-due-panel a[href^="https://wa.me/919876543210"]').getAttribute('href');
ok(!!wa && decodeURIComponent(wa).includes('house 33'), 'WhatsApp link carries a payment reminder message');
ok(await s2.locator('.pay-due-panel a[href="tel:+919876543210"]').count() === 1, 'Call link is present');
await s2.click('.pay-due-panel [data-mark-paid="33"]'); await settle(s2);
ok((await s2.locator('[data-house-edit="33"] .house-payment-state').innerText()).includes('Paid'), 'Mark paid records the balance and house 33 shows Paid');
ok(await s2.locator('.pay-due-panel [data-mark-paid="33"]').count() === 0, 'paid house leaves Payments to collect');
await seg(s2, 'tokens');
const chips = await s2.locator('[data-pane="tokens"] .day-chip').count();
ok(chips === 9, 'token desk shows a chip for each festival day (' + chips + ')');
await s2.click('[data-pane="tokens"] .day-chip:nth-child(2)'); await settle(s2);
ok(await s2.inputValue('#tokenDayPicker') === '2026-10-18', 'tapping a day chip selects that date');
ok((await s2.locator('h3.subhead').allInnerTexts()).some(x => x.includes('18 Oct 2026')), 'list header shows the selected date');
await s2.click('[data-quick-token="33"]'); await s2.fill('#tokenForm [name=token_count]', '3'); await s2.click('#tokenForm button[type=submit]'); await settle(s2);
let tk = (await db(s2, 'navratri_tokens')).filter(x => x.token_date === '2026-10-18' && x.house_number === 33);
ok(tk.length === 1 && tk[0].token_count === 3, 'token assigned on the selected date');
await s2.click('[data-token-edit]'); await s2.waitForTimeout(150);
await s2.fill('#tokenEditForm [name=token_count]', '1'); await s2.click('#tokenEditForm button[type=submit]'); await settle(s2);
tk = (await db(s2, 'navratri_tokens')).filter(x => x.token_date === '2026-10-18' && x.house_number === 33);
ok(tk[0].token_count === 1, 'token given by mistake can be edited (3 -> 1)');
await s2.click('[data-token-received]'); await settle(s2);
ok((await db(s2, 'navratri_tokens')).find(x => x.token_date === '2026-10-18').status === 'received', 'token marked received');
await s2.click('[data-token-unreceive]'); await settle(s2);
ok((await db(s2, 'navratri_tokens')).find(x => x.token_date === '2026-10-18').status !== 'received', 'received can be undone');
// Expenses: same day chips, quick entry
await seg(s2, 'expenses');
ok(await s2.locator('[data-pane="expenses"] .day-chip.active').innerText().then(x => x.includes('18 Oct')), 'expense tab shows the same selected day (18 Oct)');
ok(await s2.inputValue('#expenseDate') === '2026-10-18', 'expense date defaults to the selected day');
await s2.click('[data-amt="100"]'); await s2.click('[data-amt="50"]');
ok(await s2.inputValue('#expenseAmount') === '150', 'quick amount buttons add up (100 + 50)');
await s2.click('#expenseForm [data-val="drinks"]'); await s2.click('#expenseForm [data-val="main_society_fund"]');
await s2.click('#expenseForm button[type=submit]'); await settle(s2);
const ex = (await db(s2, 'navratri_expenses')).find(x => x.spent_on === '2026-10-18');
ok(ex && ex.amount_paise === 15000 && ex.category === 'drinks' && ex.paid_from === 'main_society_fund' && ex.description === 'Drinks', 'expense saved from chips with no typing (details default to the category)');
ok((await s2.locator('[data-pane="expenses"] .list .item').allInnerTexts()).some(x => x.includes('Drinks') && x.includes('150')), 'expense appears in the selected day list');
await s2.screenshot({ path: out + '/phone-expenses.png', fullPage: true });
await s2.click('[data-pane="expenses"] .day-chip:nth-child(1)'); await settle(s2);
ok((await s2.locator('[data-pane="expenses"]').innerText()).includes('No expenses recorded on this day.'), 'another day shows its own (empty) expense list');
// an unpaid house is chased with the payment message, not the token one
await seg(s2, 'tokens'); await s2.click('[data-quick-token="31"]'); await s2.waitForTimeout(100);
ok(!(await s2.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal overflow on the token desk');
await s2.screenshot({ path: out + '/phone-tokens.png', fullPage: true });
// Manage houses: list first, edit in a sheet
const mh = await open('?role=admin&seed=1');
let saved = null;
await mh.route('**/functions/v1/manage-house-resident', r => { saved = JSON.parse(r.request().postData()); return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, login_id: saved.house_number, message: 'Saved.' }) }); });
await mh.click('#moreBtn'); await mh.click('#moreSheet [data-view="houses"]'); await settle(mh);
ok(await mh.locator('.hd-card').count() === 19, 'Manage houses lists all 19 houses');
ok((await mh.locator('.hd-card').nth(2).innerText()).includes('House 33') && (await mh.locator('.hd-card').nth(2).innerText()).includes('9876543210'), 'house 33 card shows its name and phone');
ok(await mh.locator('.hd-card .hd-call').count() === 1, 'a Call button appears only for houses with a phone');
ok((await mh.locator('.house-summary').innerText()).includes('1 / 19'), 'summary counts residents and phones');
await mh.screenshot({ path: out + '/phone-houses.png', fullPage: true });
await mh.click('[data-edit-house="31"]'); await mh.waitForTimeout(150);
ok(await mh.locator('#houseSheet').isVisible() && (await text(mh, '#hsTitle')) === 'House 31', 'tapping a house opens its sheet');
await mh.click('#houseForm button[type=submit]'); await mh.waitForTimeout(150);
ok((await text(mh, '#houseFormMsg')).includes('resident name') && saved === null, 'empty name is rejected before saving');
await mh.fill('#hsName', 'Ramesh Patel'); await mh.fill('#hsPhone', '12345');
await mh.click('#houseForm button[type=submit]'); await mh.waitForTimeout(150);
ok((await text(mh, '#houseFormMsg')).includes('10-digit') && saved === null, 'short phone number is rejected');
await mh.fill('#hsPhone', '98765 43211'); await mh.click('#houseForm [data-val="en"]');
await mh.click('#hsPassToggle'); ok(await mh.getAttribute('#hsPass', 'type') === 'text', 'password can be shown');
await mh.click('#houseForm button[type=submit]'); await settle(mh);
ok(saved && saved.house_number === 31 && saved.display_name === 'Ramesh Patel' && saved.contact_phone === '98765 43211' && saved.preferred_language === 'en' && saved.is_active === true, 'saved payload is correct: ' + JSON.stringify(saved));
ok(!(await mh.locator('#houseSheet').isVisible()), 'sheet closes after saving');
ok(!(await mh.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal overflow on Manage houses');
const d = await open('?role=admin&seed=1', 1280);
ok(await d.locator('.sidebar').isVisible() && !(await d.locator('.tabbar').isVisible()), 'desktop shows the left sidebar, not the tab bar');
await d.screenshot({ path: out + '/desktop-navratri.png', fullPage: true });
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
