// Runs supabase/functions/manage-admins/index.ts (the real code) against an in-memory fake Supabase.
//   node tests/roles/edge-test.mjs      (Node 22.18+ / 24, which runs TypeScript directly)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

// ----- fake Supabase -----
const SUPER = '00000000-0000-4000-8000-0000000000a1', ADMIN2 = '00000000-0000-4000-8000-0000000000a2', RES33 = '00000000-0000-4000-8000-000000000033', SUPER2 = '00000000-0000-4000-8000-0000000000a3', GHOST = '00000000-0000-4000-8000-0000000000ff';
let state;
const reset = () => {
  state = {
    profiles: [
      { id: SUPER, role: 'admin', is_super: true, is_active: true, display_name: 'Society Administrator' },
      { id: ADMIN2, role: 'admin', is_super: false, is_active: true, display_name: 'Second Admin' },
      { id: SUPER2, role: 'admin', is_super: true, is_active: true, display_name: 'Other Super' },
      { id: RES33, role: 'resident', is_super: false, is_active: true, display_name: 'R33', house_number: 33 },
    ],
    audit: [], users: new Map(), failProfileInsert: false, failBan: false, calls: [],
    tokens: { 'tok-super': SUPER, 'tok-admin': ADMIN2, 'tok-res': RES33, 'tok-inactive': 'inactive-user' },
  };
  state.profiles.push({ id: 'inactive-user', role: 'admin', is_super: true, is_active: false, display_name: 'Gone' });
};
reset();
class Q {
  constructor(table) { this.table = table; this.filters = []; this.op = 'select'; }
  select() { return this; }
  eq(c, v) { this.filters.push([c, v]); return this; }
  update(p) { this.op = 'update'; this.payload = p; return this; }
  insert(p) { this.op = 'insert'; this.payload = p; return this; }
  maybeSingle() { this.single = true; return this; }
  then(res, rej) { return Promise.resolve(this.run()).then(res, rej); }
  run() {
    const rows = this.table === 'profiles' ? state.profiles : state.audit;
    const match = r => this.filters.every(([c, v]) => r[c] === v);
    if (this.op === 'insert') {
      if (this.table === 'profiles') { if (state.failProfileInsert) return { error: { message: 'boom' } }; state.profiles.push({ ...this.payload }); }
      else state.audit.push({ ...this.payload });
      return { error: null };
    }
    if (this.op === 'update') { rows.filter(match).forEach(r => Object.assign(r, this.payload)); return { error: null }; }
    const found = rows.filter(match);
    return { data: this.single ? (found[0] ?? null) : found, error: null };
  }
}
globalThis.__createClient = (url, key, opts) => {
  const bearer = opts?.global?.headers?.Authorization;
  if (bearer) return { auth: { getUser: async () => { const id = state.tokens[bearer.replace('Bearer ', '')]; return id ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { message: 'bad' } }; } } };
  return {
    from: t => new Q(t),
    auth: { admin: {
      createUser: async ({ email, password }) => { if ([...state.users.values()].some(u => u.email === email)) return { data: null, error: { message: 'exists' } }; const id = '00000000-0000-4000-8000-' + String(state.users.size + 1).padStart(12, '1'); state.users.set(id, { id, email, password }); state.calls.push('createUser'); return { data: { user: { id } }, error: null }; },
      deleteUser: async id => { state.users.delete(id); state.calls.push('deleteUser'); return { error: null }; },
      updateUserById: async (id, attrs) => { state.calls.push(['update', id, attrs]); if (attrs.ban_duration && attrs.ban_duration !== 'none' && state.failBan) return { error: { message: 'ban failed' } }; return { error: null }; },
    } },
  };
};
globalThis.Deno = { env: { get: k => ({ SUPABASE_URL: 'http://x', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' })[k] }, serve: h => { globalThis.__handler = h; } };

// ----- load the real function -----
const src = fs.readFileSync(new URL('../../supabase/functions/manage-admins/index.ts', import.meta.url), 'utf8')
  .replace(/import \{ createClient \} from "https:\/\/esm\.sh[^"]+";/, 'const createClient = (globalThis as any).__createClient;');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-'));
const file = path.join(dir, 'index.ts'); fs.writeFileSync(file, src);
await import(pathToFileURL(file).href);
const call = async (token, body, method = 'POST') => {
  const headers = token ? { Authorization: 'Bearer ' + token } : {};
  const res = await globalThis.__handler(new Request('http://x/fn', { method, headers, body: method === 'POST' ? JSON.stringify(body) : undefined }));
  return { status: res.status, body: await res.json().catch(() => null) };
};

// ----- who may call -----
ok((await call(null, { action: 'create_admin' })).status === 401, 'no sign-in is refused (401)');
ok((await call('nope', { action: 'create_admin' })).status === 401, 'an invalid session is refused (401)');
ok((await call('tok-res', { action: 'create_admin' })).status === 403, 'a resident is refused (403)');
ok((await call('tok-admin', { action: 'create_admin', email: 'a@b.co', display_name: 'X Y', password: 'longenough1' })).status === 403, 'a normal admin is refused (403)');
ok((await call('tok-inactive', { action: 'set_active', user_id: ADMIN2, active: false })).status === 403, 'a deactivated super admin is refused (403)');
ok((await call('tok-super', {}, 'GET')).status === 405, 'only POST is allowed');
ok((await globalThis.__handler(new Request('http://x/fn', { method: 'OPTIONS' }))).status === 200, 'CORS preflight works');
ok(state.users.size === 0 && state.audit.length === 0, 'refused calls changed nothing');

// ----- create_admin -----
const good = { action: 'create_admin', email: ' New.Admin@Example.com ', display_name: 'New Admin', password: 'Str0ngPass!', contact_phone: '9876543210', preferred_language: 'en' };
ok((await call('tok-super', { ...good, email: 'not-an-email' })).body.error.includes('valid email'), 'bad email is rejected');
ok((await call('tok-super', { ...good, display_name: 'A' })).body.error.includes('name'), 'too-short name is rejected');
ok((await call('tok-super', { ...good, password: 'short' })).body.error.includes('Password'), 'short password is rejected');
ok((await call('tok-super', { ...good, contact_phone: '9'.repeat(31) })).body.error.includes('Phone'), 'long phone is rejected');
ok(state.users.size === 0, 'invalid input never creates a login');
const created = await call('tok-super', good);
const np = state.profiles.find(p => p.id === created.body.user_id);
ok(created.status === 200 && created.body.ok && np && np.role === 'admin' && np.is_super === false && np.is_active === true && np.house_number === null && np.preferred_language === 'en', 'super admin creates a normal admin (not super, no house)');
ok([...state.users.values()][0].email === 'new.admin@example.com', 'email is trimmed and lower-cased');
ok(state.audit.some(a => a.action === 'admin_created' && a.actor_id === SUPER), 'creation is written to the audit log (actor = super admin)');
ok(!JSON.stringify(state.audit).includes('Str0ngPass'), 'the password never reaches the audit log');
ok((await call('tok-super', good)).status === 400, 'the same email cannot be added twice');
state.failProfileInsert = true;
const before = state.users.size;
const failed = await call('tok-super', { ...good, email: 'other@example.com' });
ok(failed.status === 500 && state.users.size === before && state.calls.includes('deleteUser'), 'if the profile cannot be saved, the new login is removed again (no half-created admin)');
state.failProfileInsert = false;

// ----- set_active -----
ok((await call('tok-super', { action: 'set_active', user_id: SUPER, active: false })).body.error.includes('own'), 'cannot deactivate yourself');
ok((await call('tok-super', { action: 'set_active', user_id: RES33, active: false })).body.error.includes('Manage houses'), 'house logins are not managed here');
ok((await call('tok-super', { action: 'set_active', user_id: SUPER2, active: false })).body.error.includes('super-admin status first'), 'a super admin must be demoted before being deactivated');
ok((await call('tok-super', { action: 'set_active', user_id: GHOST, active: false })).status === 404, 'unknown account is 404');
ok((await call('tok-super', { action: 'set_active', user_id: 'not-a-uuid', active: false })).status === 400, 'malformed id is rejected');
const off = await call('tok-super', { action: 'set_active', user_id: ADMIN2, active: false });
ok(off.body.ok && state.profiles.find(p => p.id === ADMIN2).is_active === false && state.calls.some(c => Array.isArray(c) && c[1] === ADMIN2 && c[2].ban_duration === '876000h'), 'deactivate = remove admin power AND block sign-in');
ok(state.audit.some(a => a.action === 'admin_deactivated'), 'deactivation is audited');
const on = await call('tok-super', { action: 'set_active', user_id: ADMIN2, active: true });
ok(on.body.ok && state.profiles.find(p => p.id === ADMIN2).is_active === true && state.calls.some(c => Array.isArray(c) && c[2].ban_duration === 'none'), 'reactivate = unblock sign-in AND restore admin power');
state.failBan = true;
const half = await call('tok-super', { action: 'set_active', user_id: ADMIN2, active: false });
ok(half.status === 500 && state.profiles.find(p => p.id === ADMIN2).is_active === false, 'if blocking sign-in fails, the admin still loses their power (fails safe)');
state.failBan = false;
await call('tok-super', { action: 'set_active', user_id: ADMIN2, active: true });

// ----- set_super -----
ok((await call('tok-super', { action: 'set_super', user_id: SUPER, is_super: false })).body.error.includes('own'), 'cannot change your own super status');
ok((await call('tok-super', { action: 'set_super', user_id: RES33, is_super: true })).status === 400, 'a resident cannot become super admin');
ok((await call('tok-super', { action: 'set_super', user_id: ADMIN2, is_super: true })).body.ok && state.profiles.find(p => p.id === ADMIN2).is_super === true, 'super admin can promote an admin');
ok((await call('tok-super', { action: 'set_super', user_id: ADMIN2, is_super: false })).body.ok && state.profiles.find(p => p.id === ADMIN2).is_super === false, 'and demote them again');
state.profiles.find(p => p.id === ADMIN2).is_active = false;
ok((await call('tok-super', { action: 'set_super', user_id: ADMIN2, is_super: true })).status === 400, 'an inactive admin cannot be promoted');
state.profiles.find(p => p.id === ADMIN2).is_active = true;

// ----- reset_password -----
ok((await call('tok-super', { action: 'reset_password', user_id: ADMIN2, password: 'short' })).status === 400, 'reset needs a strong enough password');
ok((await call('tok-super', { action: 'reset_password', user_id: SUPER2, password: 'LongEnough99' })).body.error.includes('My account'), 'another super admin resets their own password');
ok((await call('tok-super', { action: 'reset_password', user_id: ADMIN2, password: 'LongEnough99' })).body.ok && state.calls.some(c => Array.isArray(c) && c[1] === ADMIN2 && c[2].password === 'LongEnough99'), 'super admin resets an admin password');
ok((await call('tok-super', { action: 'reset_password', user_id: RES33, password: 'LongEnough99' })).body.ok, 'and a resident password');
ok(!JSON.stringify(state.audit).includes('LongEnough99') && state.audit.some(a => a.action === 'password_reset'), 'resets are audited without the password');
ok((await call('tok-super', { action: 'launch_missiles', user_id: ADMIN2 })).status === 400, 'unknown actions are rejected');
ok((await call('tok-admin', { action: 'reset_password', user_id: SUPER, password: 'LongEnough99' })).status === 403, 'a normal admin can never reset passwords');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
