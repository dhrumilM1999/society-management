// In-memory stand-in for @supabase/supabase-js, enough for the Navratri view.
const role = new URLSearchParams(location.search).get('role') || 'admin';
const today = new URLSearchParams(location.search).get('today');
const uid = role === 'admin' ? 'admin-1' : 'res-33';
const db = window.__db = {
  profiles: [
    { id: 'admin-1', display_name: 'Admin', role: 'admin', house_number: null, preferred_language: 'en', contact_phone: null },
    { id: 'res-33', display_name: 'House 33', role: 'resident', house_number: 33, preferred_language: 'en', contact_phone: '9876543210' },
  ],
  houses: Array.from({ length: 19 }, (_, i) => ({ house_number: 31 + i, is_active: true })),
  navratri_seasons: [], navratri_households: [], navratri_contributions: [], navratri_tokens: [], navratri_expenses: [],
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
  if (table === 'navratri_contributions') { const ids = db.navratri_households.filter(h => h.house_number === 33).map(h => h.id); return rows.filter(r => ids.includes(r.household_id)); }
  if (table === 'navratri_tokens') return rows.filter(r => r.house_number === 33);
  if (table === 'navratri_expenses') throw new Error('permission denied for navratri_expenses');
  return rows;
}
class Q {
  constructor(table) { this.table = table; this.op = 'select'; this.filters = []; this.sorts = []; this.lim = null; this.ret = false; this.one = false; }
  select() { if (this.op !== 'select') this.ret = true; return this; }
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
    rpc: async () => ({ data: null, error: null }),
    auth: {
      onAuthStateChange(cb) { setTimeout(() => cb('SIGNED_IN', session), 0); return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithPassword: async () => ({ error: null }), signOut: async () => ({}), getSession: async () => ({ data: { session } }),
    },
  };
}
if (new URLSearchParams(location.search).get('seed')) {
  db.navratri_seasons.push({ id: 's1', title: 'TEST Navratri', starts_on: '2026-10-17', ends_on: '2026-10-25', status: 'active' });
  for (let n = 31; n <= 49; n++) db.navratri_households.push({ id: 'h' + n, season_id: 's1', house_number: n, participant_count: n === 33 ? 2 : 0, contribution_per_person_paise: 50000 });
  db.navratri_contributions.push({ id: 'c1', household_id: 'h33', amount_paise: 50000, paid_on: '2026-10-12', payment_method: 'cash' });
  db.navratri_tokens.push({ id: 't1', season_id: 's1', token_date: '2026-10-17', house_number: 33, member_label: 'Member 1', token_count: 1, status: 'pending' });
  db.navratri_expenses.push({ id: 'e1', season_id: 's1', spent_on: '2026-10-12', category: 'snacks', description: 'Tea', amount_paise: 10000, paid_from: 'navratri_contributions' });
}
