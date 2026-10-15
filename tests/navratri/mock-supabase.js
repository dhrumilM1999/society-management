// In-memory stand-in for @supabase/supabase-js, enough for the Navratri view.
const qs = new URLSearchParams(location.search);
const role = new URLSearchParams(location.search).get('role') || 'admin';
const today = new URLSearchParams(location.search).get('today');
const uid = role === 'admin' ? 'admin-1' : 'res-33';
const db = window.__db = {
  profiles: [
    { id: 'admin-1', display_name: 'Admin', role: 'admin', is_super: new URLSearchParams(location.search).get('super') !== '0', is_active: true, house_number: null, preferred_language: 'en', contact_phone: null },
    { id: 'admin-2', display_name: 'Second Admin', role: 'admin', is_super: false, is_active: true, house_number: null, preferred_language: 'gu', contact_phone: '9811111111' },
    { id: 'res-33', display_name: 'House 33', role: 'resident', is_active: true, house_number: 33, preferred_language: 'en', contact_phone: '9876543210' },
  ],
  houses: Array.from({ length: 19 }, (_, i) => ({ house_number: 31 + i, is_active: true })),
  navratri_seasons: [], navratri_households: [], navratri_contributions: [], navratri_refunds: [], navratri_tokens: [], navratri_expenses: [],
  useful_contacts: [], prog_programmes: [], prog_expenses: [], prog_attendance: [], prog_shares: [],
  notices: [], meetings: [], payment_submissions: [], maintenance_charges: [], fund_ledger: [], programmes: [],
};
window.__calls = [];
let seq = 1;
const computed = (table, r) => table === 'navratri_households'
  ? { ...r, amount_due_paise: Number(r.participant_count) * Number(r.contribution_per_person_paise) } : { ...r };
// Simulate RLS: residents only read their own household rows.
function visible(table, rows) {
  if (role === 'admin') return rows;
  if (table === 'navratri_households') return rows.filter(r => r.house_number === 33);
  if (table === 'navratri_contributions' || table === 'navratri_refunds') { const ids = db.navratri_households.filter(h => h.house_number === 33).map(h => h.id); return rows.filter(r => ids.includes(r.household_id)); }
  if (table === 'navratri_tokens') return rows.filter(r => r.house_number === 33);
  if (table === 'navratri_expenses') throw new Error('permission denied for navratri_expenses');
  // Simulates the prog_* RLS policies: residents see finalized programmes and only their own house rows.
  const fin = id => db.prog_programmes.some(p => p.id === id && p.status === 'finalized');
  if (table === 'prog_programmes') return rows.filter(r => r.status === 'finalized');
  if (table === 'prog_expenses') return rows.filter(r => fin(r.programme_id));
  if (table === 'prog_attendance') return rows.filter(r => r.house_number === 33 && fin(r.programme_id));
  if (table === 'prog_shares') return rows.filter(r => r.house_number === 33);
  if (table === 'useful_contacts') return rows.filter(r => r.is_active !== false);
  return rows;
}
class Q {
  constructor(table) { this.table = table; this.op = 'select'; this.filters = []; this.sorts = []; this.lim = null; this.ret = false; this.one = false; }
  select(cols) { this.cols = cols; if (this.op !== 'select') this.ret = true; return this; }
  insert(v) { this.op = 'insert'; this.payload = v; return this; }
  upsert(v, o) { this.op = 'upsert'; this.payload = v; this.opts = o; return this; }
  update(v) { this.op = 'update'; this.payload = v; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.filters.push(r => String(r[c]) === String(v)); return this; }
  in(c, vs) { this.filters.push(r => vs.map(String).includes(String(r[c]))); return this; }
  gte(c, v) { this.filters.push(r => r[c] >= v); return this; }
  lte(c, v) { this.filters.push(r => r[c] <= v); return this; }
  order(c, o = {}) { this.sorts.push([c, o.ascending !== false]); return this; }
  limit(n) { this.lim = n; return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; return this; }
  then(res, rej) { return new Promise(r => setTimeout(r, 30)).then(() => this.run()).then(res, rej); }
  run() {
    const T = db[this.table]; window.__calls.push(this.op + ' ' + this.table);
    if (qs.get('nosuper') && this.table === 'profiles' && this.op === 'select' && /is_super|is_active/.test(this.cols || '')) return { data: null, error: { code: '42703', message: 'column profiles.is_super does not exist' } };
    if (qs.get('contactsmissing') && this.table === 'useful_contacts') return { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.useful_contacts' in the schema cache" } };
    if (new URLSearchParams(location.search).get('progmissing') && this.table.startsWith('prog_')) return { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public." + this.table + "' in the schema cache" } };
    if (role !== 'admin' && this.op !== 'select' && (this.table.startsWith('prog_') || this.table === 'useful_contacts')) return { data: null, error: { message: 'RLS: admin only' } };
    if (role !== 'admin' && this.op !== 'select' && this.table.startsWith('navratri')) return { data: null, error: { message: 'RLS: admin only' } };
    const match = r => this.filters.every(f => f(r));
    if (this.op === 'insert' || this.op === 'upsert') {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(r => ({ ...r }));
      const out = [];
      for (const r of rows) {
        if (this.table === 'navratri_seasons' && r.ends_on < r.starts_on) return { data: null, error: { message: 'check constraint violated' } };
        const key = this.opts?.onConflict?.split(',');
        const ex = key && T.find(x => key.every(k => String(x[k]) === String(r[k])));
        if (ex) { if (!this.opts.ignoreDuplicates) Object.assign(ex, r); out.push(ex); continue; }
        const row = { id: 'id' + (seq++), status: this.table === 'navratri_tokens' ? 'pending' : undefined, paid_on: new Date().toISOString().slice(0, 10), ...r };
        T.push(row); out.push(row);
      }
      const data = out.map(r => computed(this.table, r));
      return { data: this.one ? data[0] : (this.ret ? data : null), error: null };
    }
    if (this.op === 'update') { const rows = T.filter(match); rows.forEach(r => Object.assign(r, this.payload)); return { data: this.ret ? rows : null, error: null }; }
    if (this.op === 'delete') { const keep = T.filter(r => !match(r)); const n = T.length - keep.length; T.length = 0; T.push(...keep); return { data: null, error: null, count: n }; }
    let rows;
    try { rows = visible(this.table, T.filter(match)).map(r => computed(this.table, r)); } catch (e) { return { data: null, error: { message: e.message } }; }
    for (const [c, asc] of this.sorts.slice().reverse()) rows.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
    if (this.lim != null) rows = rows.slice(0, this.lim);
    return { data: this.one ? (rows[0] ?? null) : rows, error: null };
  }
}
const session = { user: { id: uid }, access_token: 'x' };
export function createClient() {
  return {
    from: t => new Q(t),
    // Mirrors the SQL functions in docs/migrations/2026-10-13-programmes.sql (the SQL itself is tested in tests/programmes).
    rpc: async (name, a) => {
      await new Promise(r => setTimeout(r, 30));
      window.__calls.push('rpc ' + name);
      const err = message => ({ data: null, error: { message } });
      if (name === 'set_my_member_count') {
        if (a.p_count == null || a.p_count < 0 || a.p_count > 100) return err('Enter a number of members from 0 to 100.');
        if (role !== 'resident') return err('Only a resident can update their own house members.');
        if (new URLSearchParams(location.search).get('norpc')) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.set_my_member_count in the schema cache' } };
        const season = db.navratri_seasons.find(x => x.status === 'active'); if (!season) return err('There is no active festival right now.');
        const hh = db.navratri_households.find(h => h.season_id === season.id && h.house_number === 33); if (!hh) return err('Your house is not part of this festival yet. Please ask the administrator.');
        if (db.navratri_contributions.some(c => c.household_id === hh.id) || db.navratri_refunds.some(r => r.household_id === hh.id)) return err('A payment is already recorded for your house. Please ask the administrator to change the members.');
        if (db.navratri_tokens.some(t => t.season_id === season.id && t.house_number === 33)) return err('Tokens have already been given to your house. Please ask the administrator to change the members.');
        hh.participant_count = a.p_count; return { data: { house_number: 33, participant_count: a.p_count }, error: null };
      }
      if (role !== 'admin') return err('Only an administrator can do that.');
      const prog = db.prog_programmes.find(p => p.id === a.p_programme_id);
      if (!prog) return err('Programme not found.');
      if (name === 'prog_finalize') {
        if (prog.status !== 'draft') return err('This programme is already finalized.');
        const total = db.prog_expenses.filter(e => e.programme_id === prog.id).reduce((n, e) => n + e.amount_paise, 0);
        if (total <= 0) return err('Add at least one expense before finalizing.');
        const att = new Map(db.prog_attendance.filter(x => x.programme_id === prog.id).map(x => [x.house_number, x.attendees]));
        const w = []; for (let n = 31; n <= 49; n++) { const wt = prog.split_method === 'equal_houses' ? 1 : prog.split_method === 'attending_houses' ? ((att.get(n) || 0) > 0 ? 1 : 0) : (att.get(n) || 0); if (wt > 0) w.push({ n, wt }); }
        const sum = w.reduce((x, y) => x + y.wt, 0); if (sum <= 0) return err('No house is marked as attending, so the cost cannot be shared.');
        const rows = w.map(x => ({ programme_id: prog.id, house_number: x.n, share_paise: Math.floor(total * x.wt / sum), paid_paise: 0 }));
        let left = total - rows.reduce((x, y) => x + y.share_paise, 0); for (const r of rows) { if (left <= 0) break; r.share_paise++; left--; }
        db.prog_shares = db.prog_shares.filter(x => x.programme_id !== prog.id); db.prog_shares.push(...rows);
        Object.assign(prog, { status: 'finalized', total_paise: total, finalized_at: new Date().toISOString() });
        return { data: { total_paise: total, houses: rows.length }, error: null };
      }
      if (name === 'prog_reopen') {
        if (prog.status !== 'finalized') return err('This programme is not finalized.');
        if (db.prog_shares.some(x => x.programme_id === prog.id && x.paid_paise > 0)) return err('Payments are already recorded against this programme. Reverse them before reopening.');
        db.prog_shares = db.prog_shares.filter(x => x.programme_id !== prog.id); Object.assign(prog, { status: 'draft', total_paise: null });
        return { data: null, error: null };
      }
      if (name === 'prog_record_payment') {
        const sh = db.prog_shares.find(x => x.programme_id === prog.id && x.house_number === a.p_house_number);
        if (!sh) return err('This house has no share in this programme.');
        if (sh.paid_paise + a.p_amount_paise > sh.share_paise) return err('That is more than the pending share.');
        if (sh.paid_paise + a.p_amount_paise < 0) return err('That is more than what was paid.');
        sh.paid_paise += a.p_amount_paise; return { data: sh.paid_paise, error: null };
      }
      return { data: null, error: null };
    },
    auth: {
      onAuthStateChange(cb) { setTimeout(() => cb('SIGNED_IN', session), 0); return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithPassword: async () => ({ error: null }), updateUser: async u => { window.__calls.push('auth.updateUser'); window.__lastUpdateUser = u; return u.password && u.password.length < 8 ? { error: { message: 'Password should be at least 8 characters.' } } : { data: { user: {} }, error: null }; }, signOut: async () => ({}), getSession: async () => ({ data: { session } }),
    },
  };
}
if (new URLSearchParams(location.search).get('seed')) {
  db.prog_programmes.push({ id: 'pg1', title_en: 'Garba Night', title_gu: null, details: 'Sound and lights', held_on: '2026-10-20', split_method: 'equal_houses', status: 'finalized', total_paise: 190000 },
    { id: 'pg2', title_en: 'Draft Event', held_on: '2026-10-22', split_method: 'equal_houses', status: 'draft' });
  db.prog_expenses.push({ id: 'pe1', programme_id: 'pg1', description: 'Sound system', amount_paise: 190000, paid_from: 'main_society_fund', spent_on: '2026-10-20' });
  for (let n = 31; n <= 49; n++) db.prog_shares.push({ programme_id: 'pg1', house_number: n, share_paise: 10000, paid_paise: n === 34 ? 10000 : 0 });
  db.navratri_seasons.push({ id: 's1', title: 'TEST Navratri', starts_on: '2026-10-17', ends_on: '2026-10-25', status: 'active' });
  for (let n = 31; n <= 49; n++) db.navratri_households.push({ id: 'h' + n, season_id: 's1', house_number: n, participant_count: n === 33 ? 2 : 0, contribution_per_person_paise: 50000 });
  db.useful_contacts.push({ id: 'uc1', category: 'plumber', name: 'Ramesh Plumber', phone: '98765 00001', note: 'After 5 pm', is_active: true, sort_order: 0 },
    { id: 'uc2', category: 'election', name: 'Ward Election Office', phone: '0281 2222222', note: null, is_active: true, sort_order: 0 },
    { id: 'uc3', category: 'mistri', name: 'Hidden Mistri', phone: '98765 00003', note: null, is_active: false, sort_order: 0 });
  if (!qs.get('nopay')) db.navratri_contributions.push({ id: 'c1', household_id: 'h33', amount_paise: 50000, paid_on: '2026-10-12', payment_method: 'cash' });
  if (!qs.get('nopay')) db.navratri_tokens.push({ id: 't1', season_id: 's1', token_date: '2026-10-17', house_number: 33, member_label: 'Member 1', token_count: 1, status: 'pending' });
  db.navratri_expenses.push({ id: 'e1', season_id: 's1', spent_on: '2026-10-12', category: 'snacks', description: 'Tea', amount_paise: 10000, paid_from: 'navratri_contributions' });
}
