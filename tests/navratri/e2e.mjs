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
await a.click('#seasonForm button[type=submit]'); await settle(a);
ok((await db(a, 'navratri_seasons')).length === 0, 'end-before-start season is rejected client-side');
await a.fill('#seasonForm [name=starts_on]', '2026-10-17'); await a.fill('#seasonForm [name=ends_on]', '2026-10-25');
await a.dblclick('#seasonForm button[type=submit]'); await a.waitForTimeout(900);
ok((await db(a, 'navratri_seasons')).length === 1, 'double-tap creates exactly one season');
ok((await db(a, 'navratri_households')).length === 19, '19 households seeded');
ok(await a.inputValue('#tokenDayPicker') === '2026-10-17', 'token day clamps to season start when today is before the festival');
ok(await a.locator('#expenseForm').count() === 1, 'expense form is rendered');
ok((await a.locator('.records-details summary').innerText()).startsWith('All token records for'), 'token records section is rendered');

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
const refunds = await db(a, 'navratri_refunds');
ok(refunds.length === 1 && refunds[0].amount_paise === Number(refundAmt) * 100 && refunds[0].refund_method === 'cash' && refunds[0].refunded_by === 'admin-1', 'refund saved in navratri_refunds for exactly the overpaid amount (₹' + refundAmt + ')');
ok((await db(a, 'navratri_contributions')).every(x => x.entry_type === undefined), 'payments table is untouched by a refund');
ok((await a.locator('[data-house-edit="36"] .house-payment-state').innerText()).includes('Paid'), 'house 36 shows Paid after refund');
await a.click('[data-house-edit="36"]'); await a.waitForTimeout(150);
ok(!(await a.locator('#refundBox').isVisible()), 'refund box hidden once nothing is overpaid');
await a.keyboard.press('Escape');

await seg(a, 'tokens');
// Payment gate: house 37 owes money, so no tokens until it pays.
await a.click('[data-quick-token="37"]'); await a.waitForTimeout(200);
ok(await a.locator('#tsBlock').isVisible() && (await text(a, '#tsBlock')).includes('37'), 'unpaid house shows its payment status in its sheet');
ok(await a.locator('#tokenForm').count() === 0, 'no token form for an unpaid house');
ok(await a.locator('[data-household-tokens-received="37"]').count() === 0, 'unpaid house has no Received button');
ok((await a.locator('[data-quick-token="37"] .token-dot.amber').count()) === 1, 'unpaid house shows the amber dot');
await a.click('#tokenSheetBody [data-ts-close]');
await a.click('[data-quick-token="35"]'); await a.waitForTimeout(200);
ok(await a.locator('#tokenForm button[type=submit]').isEnabled(), 'paid house can be issued tokens');
ok(await a.inputValue('#tokenForm [name=house_number]') === '35', 'house sheet is for house 35');
ok(await a.inputValue('#tokenForm [name=token_count]') === '6', 'token count prefilled with remaining members');
await a.click('#tokenForm [data-tstep="-1"]'); await a.click('#tokenForm [data-tstep="-1"]');
ok(await a.inputValue('#tokenForm [name=token_count]') === '4', '– button lowers the token count (6 -> 4)');
await a.fill('#tokenForm [name=token_count]', '2'); await a.click('#tokenForm button[type=submit]'); await settle(a);
ok(await a.locator('#tokenSheet').isVisible(), 'house sheet stays open after assigning a token');
await a.click('#tokenSheet [data-ts-yes]'); await settle(a);
ok((await text(a, '#tokenSheet .ts-progress')).includes('6'), 'sheet shows 6 received after Yes');
await a.click('#tokenSheetBody [data-ts-close]');
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
await s2.screenshot({ path: out + '/phone-token-sheet.png' });
await s2.click('#tokenSheet [data-token-edit]'); await s2.waitForTimeout(150);
await s2.fill('#tokenEditForm [name=token_count]', '1'); await s2.click('#tokenEditForm button[type=submit]'); await settle(s2);
tk = (await db(s2, 'navratri_tokens')).filter(x => x.token_date === '2026-10-18' && x.house_number === 33);
ok(tk[0].token_count === 1, 'token given by mistake can be edited (3 -> 1)');
await s2.click('#tokenSheet [data-token-received]'); await settle(s2);
ok((await db(s2, 'navratri_tokens')).find(x => x.token_date === '2026-10-18').status === 'received', 'token marked received');
await s2.click('#tokenSheet [data-token-unreceive]'); await settle(s2);
ok((await db(s2, 'navratri_tokens')).find(x => x.token_date === '2026-10-18').status !== 'received', 'received can be undone');
// 'No' on the whole house, then remove the token from the sheet; the received house stays as a top button
await s2.click('#tokenSheetBody [data-ts-close]');
await s2.click('[data-quick-token="33"]'); await s2.waitForTimeout(150);
await s2.click('#tokenSheet [data-token-delete]'); await settle(s2);
ok((await db(s2, 'navratri_tokens')).filter(x => x.token_date === '2026-10-18' && x.house_number === 33).length === 0, 'token removed from the house sheet');
await s2.click('#tokenSheetBody [data-ts-close]');
// Calendar date picker on the token date
await seg(s2, 'tokens');
await s2.click('[data-pane="tokens"] .date-trigger'); await s2.waitForTimeout(150);
ok(await s2.locator('.dp-wrap').isVisible(), 'date field opens the calendar picker');
await s2.screenshot({ path: out + '/phone-calendar.png' });
ok(await s2.locator('.dp-day:not(:disabled)').count() === 9 && await s2.locator('.dp-day:disabled').count() === 22, 'calendar only allows the festival days (9 of 31 in October)');
await s2.click('.dp-day[data-date="2026-10-21"]'); await settle(s2);
ok(await s2.inputValue('#tokenDayPicker') === '2026-10-21' && !(await s2.locator('.dp-wrap').isVisible()), 'picking a day sets the date and closes the calendar');
ok((await s2.locator('[data-pane="tokens"] .date-trigger').innerText()).includes('21'), 'trigger shows the chosen date');
await s2.click('[data-pane="tokens"] .date-trigger'); await s2.waitForTimeout(150); await s2.click('.dp-day[data-date="2026-10-18"]'); await settle(s2);
// A house without a phone number must still get a full-width Received button (regression)
await s2.evaluate(() => { window.__db.profiles.find(p => p.house_number === 33).contact_phone = null; });
await s2.click('#refreshBtn'); await settle(s2);
await s2.click('[data-quick-token="33"]'); await s2.fill('#tokenForm [name=token_count]', '1'); await s2.click('#tokenForm button[type=submit]'); await settle(s2);
await s2.click('#tokenSheetBody [data-ts-close]');
const rcv = await s2.locator('[data-household-tokens-received="33"]').boundingBox();
ok(rcv && rcv.width > 150 && rcv.height > 40, 'Received button keeps its full size when no phone is saved (' + Math.round(rcv.width) + 'x' + Math.round(rcv.height) + ')');
ok((await s2.locator('.wait-row .contact-none').count()) >= 1, 'no-phone note is shown under the buttons');
await s2.screenshot({ path: out + '/phone-nophone.png', fullPage: true });
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
// Dashboard shortcuts and festival card
const ov = await open('?role=admin&seed=1');
await go(ov, 'overview'); await settle(ov);
ok(await ov.locator('.fest-card').isVisible() && (await ov.locator('.fest-card').innerText()).includes('TEST Navratri'), 'dashboard shows the festival card');
ok(await ov.locator('.shortcut').count() === 9, 'admin dashboard has 9 shortcuts');
await ov.screenshot({ path: out + '/phone-dashboard.png', fullPage: true });
await ov.click('.fest-card [data-seg="tokens"]'); await settle(ov);
ok(await ov.locator('[data-pane="tokens"]').isVisible() && (await text(ov, '#viewTitle')) === 'Navratri festival', 'festival card Tokens button jumps straight to the Tokens tab');
await go(ov, 'overview'); await settle(ov);
await ov.click('.shortcut[data-seg="expenses"]'); await settle(ov);
ok(await ov.locator('[data-pane="expenses"]').isVisible(), 'Add expense shortcut opens the Expenses tab');
const rv = await open('?role=resident&seed=1'); await go(rv, 'overview'); await settle(rv);
ok(await rv.locator('.shortcut').count() === 5, 'resident dashboard has 5 shortcuts');
// ---------- Programmes & expense sharing ----------
const pg = await open('?role=admin');
await pg.click('#moreBtn'); await pg.click('#moreSheet [data-view="programmes"]'); await settle(pg);
ok((await pg.locator('#viewContent').innerText()).includes('No programmes yet'), 'Programmes: empty state for admin');
await pg.click('[data-prog-new]'); await pg.waitForTimeout(150);
await pg.click('[data-prog-form="new"] button[type=submit]');
ok((await text(pg, '[data-prog-form="new"] .prog-form-msg')).includes('programme name'), 'programme needs a name');
await pg.fill('[data-prog-form="new"] [name=title_en]', 'Sharad Garba');
await pg.click('[data-prog-form="new"] [data-val="per_attendee"]');
ok((await text(pg, '[data-prog-form="new"] .prog-method-hint')).includes('proportion'), 'choosing a split method explains it');
await pg.click('[data-prog-form="new"] button[type=submit]'); await settle(pg);
ok(await pg.locator('[data-editor]').isVisible(), 'creating a programme opens its editor');
const prog = (await db(pg, 'prog_programmes'))[0];
ok(prog.status === 'draft' && prog.split_method === 'per_attendee' && prog.created_by === 'admin-1', 'programme saved as a draft by the admin');
ok(await pg.locator('[data-prog-finalize]').isDisabled(), 'finalize is disabled until there are expenses');
await pg.fill('[data-exp-form] [name=amount]', '60.01'); await pg.fill('[data-exp-form] [name=description]', 'Sound system');
await pg.click('[data-exp-form] button[type=submit]'); await settle(pg);
ok((await db(pg, 'prog_expenses')).length === 1 && (await db(pg, 'prog_expenses'))[0].amount_paise === 6001, 'expense saved in paise (6001)');
ok(await pg.locator('[data-prog-finalize]').isDisabled(), 'finalize still disabled until attendance is entered (per attendee)');
await pg.click('[data-att="31:1"]'); await pg.click('[data-att="32:1"]'); await pg.click('[data-att="32:1"]');
for (let i = 0; i < 3; i++) await pg.click('[data-att="40:1"]');
await pg.fill('[data-att-input="45"]', '9'); await pg.fill('[data-att-input="45"]', '0');
await pg.waitForTimeout(700);
const att = await db(pg, 'prog_attendance');
ok(att.find(x => x.house_number === 40).attendees === 3 && att.find(x => x.house_number === 32).attendees === 2 && att.find(x => x.house_number === 31).attendees === 1, 'attendance auto-saves (31:1, 32:2, 40:3)');
const prevText = await text(pg, '[data-preview]');
ok(prevText.includes('₹10.01') && prevText.includes('₹20.00') && prevText.includes('₹30.00') && prevText.includes('₹60.01'), 'live preview matches the SQL split (10.01 / 20.00 / 30.00 = 60.01)');
ok(await pg.locator('[data-prog-finalize]').isEnabled(), 'finalize enabled once the split is possible');
await pg.click('[data-prog-finalize]'); await settle(pg);
const shs = await db(pg, 'prog_shares');
ok(shs.length === 3 && shs.reduce((n, x) => n + x.share_paise, 0) === 6001, 'finalize saves shares that add up exactly to the total');
ok((await db(pg, 'prog_programmes'))[0].status === 'finalized', 'programme is finalized');
ok(await pg.locator('[data-exp-form]').count() === 0, 'expenses are locked after finalizing');
await pg.screenshot({ path: out + '/phone-programme-final.png', fullPage: true });
await pg.click('[data-share-pay^="' + prog.id + ':31:"]'); await settle(pg);
ok((await db(pg, 'prog_shares')).find(x => x.house_number === 31).paid_paise === 1001, 'Mark paid records the full pending share for a house');
ok((await pg.locator('.wait-row').first().innerText()).includes('Paid'), 'house shows Paid');
await pg.click('[data-prog-reopen]'); await settle(pg);
ok((await text(pg, '#appMsg')).includes('Payments are already recorded'), 'reopen is refused while payments exist');
await pg.click('[data-share-pay^="' + prog.id + ':31:-"]'); await settle(pg);
await pg.click('[data-prog-reopen]'); await settle(pg);
ok((await db(pg, 'prog_programmes'))[0].status === 'draft' && (await db(pg, 'prog_shares')).length === 0 && await pg.locator('[data-editor]').isVisible(), 'after undoing the payment, reopen returns to the editor with shares cleared');
ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal overflow on Programmes');
ok(pg.errors.length === 0, 'programmes: no console errors ' + JSON.stringify(pg.errors));
// resident view
const pr = await open('?role=resident&seed=1');
await pr.click('#moreBtn'); await pr.click('#moreSheet [data-view="programmes"]'); await settle(pr);
const rt = await pr.locator('#viewContent').innerText();
ok(rt.includes('Garba Night') && !rt.includes('Draft Event'), 'resident sees finalized programmes, not drafts');
ok(rt.toLowerCase().includes('your house share') && rt.includes('₹100.00') && rt.includes('Pending'), 'resident sees their own share and status');
ok(await pr.locator('[data-prog-new], [data-prog-open], [data-share-pay]').count() === 0, 'resident has no admin controls on Programmes');
ok(rt.includes('Sound system'), 'resident sees the expense list');
await pr.screenshot({ path: out + '/phone-programme-resident.png', fullPage: true });
// tables not created yet -> friendly setup message instead of an error
const pm = await open('?role=admin&progmissing=1');
await pm.click('#moreBtn'); await pm.click('#moreSheet [data-view="programmes"]'); await settle(pm);
ok((await pm.locator('#viewContent').innerText()).includes('One-time database setup needed') && (await pm.locator('#viewContent').innerText()).includes('2026-10-13-programmes.sql'), 'missing tables show a setup message with the SQL file name');
ok(pm.errors.every(e => !e.includes('TypeError')), 'setup message appears without script errors');
// ---------- My account (every user) ----------
const ac = await open('?role=resident&seed=1');
await ac.click('#moreBtn'); await ac.click('#moreSheet [data-view="account"]'); await settle(ac);
ok(await ac.inputValue('#acName') === 'House 33' && await ac.inputValue('#acPhone') === '9876543210', 'My account shows the current name and phone');
await ac.fill('#acName', 'R'); await ac.click('#accountForm button[type=submit]');
ok((await text(ac, '#accountMsg')).includes('Enter your name'), 'name is required');
await ac.fill('#acName', 'Ramesh Patel'); await ac.fill('#acPhone', '12345'); await ac.click('#accountForm button[type=submit]');
ok((await text(ac, '#accountMsg')).includes('10-digit'), 'short phone is rejected');
await ac.fill('#acPhone', '98765 43210'); await ac.click('#accountForm [data-val="gu"]'); await ac.click('#accountForm button[type=submit]'); await settle(ac);
const me = (await db(ac, 'profiles')).find(x => x.id === 'res-33');
ok(me.display_name === 'Ramesh Patel' && me.contact_phone === '98765 43210' && me.preferred_language === 'gu' && me.role === 'resident' && me.house_number === 33, 'details saved; role and house number untouched');
ok(await ac.evaluate(() => document.documentElement.lang) === 'gu', 'language switches to Gujarati right away');
await ac.fill('#acPw1', 'short'); await ac.fill('#acPw2', 'short'); await ac.click('#passwordForm button[type=submit]');
ok((await text(ac, '#passwordMsg')).length > 0, 'short password is refused');
await ac.fill('#acPw1', 'LongEnough1'); await ac.fill('#acPw2', 'Different22'); await ac.click('#passwordForm button[type=submit]');
ok((await ac.evaluate(() => window.__calls.filter(c => c === 'auth.updateUser').length)) === 0, 'mismatching passwords never reach the server');
await ac.fill('#acPw2', 'LongEnough1'); await ac.click('#passwordForm button[type=submit]'); await settle(ac);
ok(await ac.evaluate(() => window.__lastUpdateUser && window.__lastUpdateUser.password === 'LongEnough1'), 'matching password is sent to Supabase Auth');
ok(await ac.inputValue('#acPw1') === '', 'password fields are cleared after success');
ok(!(await ac.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal overflow on My account');
ok(ac.errors.length === 0, 'my account: no console errors ' + JSON.stringify(ac.errors));
await ac.screenshot({ path: out + '/phone-account.png', fullPage: true });
const d = await open('?role=admin&seed=1', 1280);
ok(await d.locator('.sidebar').isVisible() && !(await d.locator('.tabbar').isVisible()), 'desktop shows the left sidebar, not the tab bar');
await d.screenshot({ path: out + '/desktop-navratri.png', fullPage: true });
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
