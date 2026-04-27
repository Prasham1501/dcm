// Mediview API client — talks to PHP backend OR localStorage mock.
// Flip MODE to 'live' once your engineer deploys the PHP backend.
//
// Backend contract (each endpoint accepts/returns JSON):
//   POST /api/auth/signup       { name,email,password,role }              -> { token, user }
//   POST /api/auth/login        { email,password }                        -> { token, user }
//   POST /api/auth/google       { id_token }                              -> { token, user }
//   GET  /api/me                                                          -> { user }
//   GET  /api/devices                                                     -> [device]
//   POST /api/devices/{id}/deactivate                                     -> ok
//   GET  /api/wallet            ?type=print|ai                            -> { balance, txns }
//   POST /api/wallet/topup      { type, credits }                         -> { order_id, rzp_key }
//   POST /api/wallet/verify     { order_id, payment_id, signature }       -> { invoice_id, balance }
//   POST /api/wallet/auto       { type, auto_recharge, threshold }        -> ok
//   GET  /api/licenses                                                    -> [license]
//   POST /api/licenses/order    { plan }                                  -> { order_id, rzp_key }
//   POST /api/licenses/verify   { order_id, payment_id, signature, plan } -> { license_key, invoice }
//   GET  /api/tickets                                                     -> [ticket]
//   POST /api/tickets           { category, subject, body, attachments }  -> ticket
//   POST /api/tickets/{id}/reply{ body, attachments }                     -> message
//   POST /api/tickets/{id}/close                                          -> ok
//   GET  /api/invoices          ?page=1                                   -> { data, total }
//   GET  /api/invoices/{id}/pdf                                           -> application/pdf
//   GET  /api/team                                                        -> { members, invites }
//   POST /api/team/invite       { email, role }                           -> ok
//   POST /api/team/accept       { token }                                 -> ok
//   DELETE /api/team/{id}                                                 -> ok
//   PATCH /api/team/{id}/role   { role }                                  -> ok
//   GET  /api/analytics         ?range=30d                                -> analytics
//   GET  /api/audit                                                       -> [event]
//   GET  /api/api-keys                                                    -> [key]
//   POST /api/api-keys          { label }                                 -> { key, plain }
//   DELETE /api/api-keys/{id}                                             -> ok
//   GET  /api/referrals                                                   -> { code, signups, credits }
//   POST /api/chat              { messages }                              -> { reply }
//   POST /api/contact           { name, email, subject, message }         -> ok
//   GET  /api/public/config                                               -> { brand_name, rzp_key_id, google_client_id }
//
//   -- EXE only (no JWT) --
//   POST /api/license/activate  { license_key, fingerprint, machine_name } -> ok
//   POST /api/license/validate  { license_key, fingerprint }               -> { valid, reason }
//   POST /api/license/heartbeat { license_key, fingerprint }               -> ok
//   POST /api/license/deactivate{ license_key, fingerprint }               -> ok
//   POST /api/wallet/spend      { license_key, fingerprint, type, credits } -> { balance }

const API_MODE = (window.MEDIVIEW_API_MODE || localStorage.getItem('mv:mode') || 'live'); // 'mock' | 'live'
const API_BASE = window.MEDIVIEW_API_BASE || '/api';

const tokenKey = 'mv:token';
const userKey  = 'mv:user';

const getToken = () => localStorage.getItem(tokenKey);
const setToken = (t) => t ? localStorage.setItem(tokenKey, t) : localStorage.removeItem(tokenKey);

// ===== LIVE MODE — fetch wrapper =====================================================
const liveFetch = async (path, opts = {}) => {
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
  });
  // Handle refreshed token header
  const refreshed = res.headers.get('X-Refreshed-Token');
  if (refreshed) setToken(refreshed);

  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw Object.assign(new Error(data?.error || res.statusText), { status: res.status, data });
  return data;
};

// ===== MOCK MODE — localStorage-backed =================================================
const mockDB = (() => {
  const KEY = 'mv:db';
  const seed = () => ({
    users: [
      { id: 'u1', name: 'Demo Doctor', email: 'demo@mediview.in', password: 'demo1234', role: 'radiologist', created: Date.now() - 86400000 * 30, verified: true },
    ],
    devices: [
      { id: 'd1', account_id: 'acc1', machine_name: 'Reception-PC-01', fingerprint: 'AB:CD:EF:01:23:45', activated_at: Date.now() - 86400000 * 12, last_heartbeat_at: Date.now() - 60000, status: 'active', os: 'Windows 11 Pro', key_code: 'MV-ABCD-EFGH-IJKL-MNOP', plan: 'annual', seats: 3, seats_used: 2 },
      { id: 'd2', account_id: 'acc1', machine_name: 'Reading-Room-02', fingerprint: 'AB:CD:EF:67:89:0A', activated_at: Date.now() - 86400000 * 5, last_heartbeat_at: Date.now() - 86400000 * 2, status: 'active', os: 'Windows 10 Pro', key_code: 'MV-ABCD-EFGH-IJKL-MNOP', plan: 'annual', seats: 3, seats_used: 2 },
    ],
    licenses: [
      { id: 'lic1', key_code: 'MV-ABCD-EFGH-IJKL-MNOP', plan: 'annual', seats: 3, status: 'active', starts_at: Date.now() - 86400000 * 30, expires_at: Date.now() + 86400000 * 335, seats_used: 2 },
    ],
    wallets: {
      print: { balance: 1247, threshold: 200, auto_recharge: false, auto_amount: 1000 },
      ai: { balance: 340, threshold: 100, auto_recharge: false, auto_amount: 500 },
    },
    txns: [
      { id: 't1', wallet_type: 'print', kind: 'topup', credits_delta: 1000, balance_after: 1247, created_at: Date.now() - 86400000 * 7, payment_id: 'order_DemoXYZ', invoice_id: 'inv_001' },
      { id: 't2', wallet_type: 'print', kind: 'spend', credits_delta: -3, balance_after: 247, created_at: Date.now() - 3600000 * 2, meta: 'A4 B&W · Patient #4421' },
      { id: 't3', wallet_type: 'ai', kind: 'topup', credits_delta: 500, balance_after: 340, created_at: Date.now() - 86400000 * 4, payment_id: 'order_DemoABC', invoice_id: 'inv_002' },
      { id: 't4', wallet_type: 'ai', kind: 'spend', credits_delta: -1, balance_after: 339, created_at: Date.now() - 3600000, meta: 'CT Lung Nodule · CT-22-091' },
    ],
    tickets: [
      { id: 'tk1', category: 'how-to', subject: 'How do I sync the print wallet across two PCs?', status: 'open', created_at: Date.now() - 86400000 * 2, message_count: 2, messages: [
        { id: 'm1', sender_role: 'user', body: 'I have two reception PCs and want a single shared wallet — is that possible?', created_at: Date.now() - 86400000 * 2 },
        { id: 'm2', sender_role: 'admin', body: 'Yes — on Annual+ plans the wallet is account-level, shared across all your activated machines automatically.', created_at: Date.now() - 86400000 * 1.5 },
      ]},
    ],
    bugs: [],
    invoices: [
      { id: 'inv_001', number: 'MV-2025-0001', subtotal_inr: 1000, gst_inr: 0, total_inr: 1000, status: 'paid', created_at: Date.now() - 86400000 * 7 },
      { id: 'inv_002', number: 'MV-2025-0002', subtotal_inr: 500, gst_inr: 0, total_inr: 500, status: 'paid', created_at: Date.now() - 86400000 * 4 },
    ],
    team: {
      members: [{ id: 'u1', name: 'Demo Doctor', email: 'demo@mediview.in', role: 'admin', created_at: Date.now() - 86400000 * 30, last_login_at: Date.now() - 60000 }],
      invites: [],
    },
    audit: [
      { id: 'a1', actor_name: 'Demo Doctor', action: 'login', target: '-', created_at: Date.now() - 60000, ip: '49.207.x.x' },
      { id: 'a2', actor_name: 'Demo Doctor', action: 'wallet.topup', target: 'print:1000', created_at: Date.now() - 86400000 * 7, ip: '49.207.x.x' },
      { id: 'a3', actor_name: 'Demo Doctor', action: 'device.activate', target: 'Reading-Room-02', created_at: Date.now() - 86400000 * 5, ip: '49.207.x.x' },
    ],
    api_keys: [
      { id: 'k1', label: 'Hospital HIS Bridge', prefix: 'mv_live_a3f2', last_used_at: Date.now() - 86400000, created_at: Date.now() - 86400000 * 20 },
    ],
    referrals: { code: 'DEMO-DOC', signups: 3, credits_earned: 1500 },
    analytics: {
      studies_30d: 1247, ai_calls_30d: 89, pages_printed_30d: 412,
      by_modality: [
        { name: 'CT', value: 412 }, { name: 'X-Ray', value: 387 }, { name: 'MRI', value: 198 },
        { name: 'USG', value: 156 }, { name: 'Mammo', value: 64 }, { name: 'DEXA', value: 30 },
      ],
      daily: Array.from({ length: 30 }, (_, i) => ({ d: i, v: 20 + Math.round(40 * Math.sin(i / 4) + Math.random() * 25) })),
    },
  });
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY) || ''); } catch { db = null; }
  if (!db || !db.users) { db = seed(); localStorage.setItem(KEY, JSON.stringify(db)); }
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  return { get: () => db, save, reset: () => { db = seed(); save(); } };
})();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const uid   = () => Math.random().toString(36).slice(2, 10);
const now   = () => Date.now();

const mockHandlers = {
  'POST /auth/signup': async ({ body }) => {
    await sleep(500);
    const db = mockDB.get();
    if (db.users.find(u => u.email === body.email)) throw new Error('Email already registered');
    const user = { id: 'u' + uid(), name: body.name, email: body.email, password: body.password, role: body.role || 'radiologist', created_at: now(), verified: false };
    db.users.push(user); mockDB.save();
    const token = 'mock_' + uid() + uid();
    setToken(token); localStorage.setItem(userKey, JSON.stringify(user));
    return { token, user };
  },
  'POST /auth/login': async ({ body }) => {
    await sleep(400);
    const db = mockDB.get();
    const user = db.users.find(u => u.email === body.email && u.password === body.password);
    if (!user) throw new Error('Invalid email or password');
    const token = 'mock_' + uid() + uid();
    setToken(token); localStorage.setItem(userKey, JSON.stringify(user));
    return { token, user };
  },
  'POST /auth/google': async ({ body }) => {
    await sleep(500);
    const db = mockDB.get();
    const email = body.email || 'demo@mediview.in';
    let user = db.users.find(u => u.email === email);
    if (!user) {
      user = { id: 'u' + uid(), name: body.name || 'Google User', email, role: 'radiologist', created_at: now(), verified: true };
      db.users.push(user); mockDB.save();
    }
    const token = 'mock_' + uid() + uid();
    setToken(token); localStorage.setItem(userKey, JSON.stringify(user));
    return { token, user };
  },
  'POST /auth/logout': async () => { setToken(null); localStorage.removeItem(userKey); return { ok: true }; },
  'GET /me': async () => { const u = localStorage.getItem(userKey); if (!u) throw new Error('Not authenticated'); return { user: JSON.parse(u) }; },
  'POST /auth/forgot': async () => { await sleep(600); return { ok: true }; },
  'POST /auth/reset': async ({ body }) => { await sleep(600); return { ok: true }; },
  'POST /auth/verify-email': async () => { await sleep(400); return { ok: true }; },
  'POST /auth/resend-verify': async () => { await sleep(400); return { ok: true }; },

  'GET /devices': async () => { await sleep(150); return mockDB.get().devices; },
  'POST /devices/deactivate': async ({ body }) => {
    const db = mockDB.get();
    const d = db.devices.find(x => x.id === body.id);
    if (d) { d.status = 'deactivated'; mockDB.save(); }
    return { ok: true };
  },

  'GET /licenses': async () => { await sleep(150); return mockDB.get().licenses; },
  'POST /licenses/order': async ({ body }) => {
    await sleep(400);
    return { order_id: 'order_mock_' + uid(), rzp_key: 'rzp_test_DEMO', amount: body.plan === 'annual' ? 100000 : 8000, plan: body.plan };
  },
  'POST /licenses/verify': async ({ body }) => {
    await sleep(700);
    const db = mockDB.get();
    const key = 'MV-' + uid().toUpperCase().slice(0,4) + '-' + uid().toUpperCase().slice(0,4) + '-' + uid().toUpperCase().slice(0,4) + '-' + uid().toUpperCase().slice(0,4);
    const lic = { id: 'lic' + uid(), key_code: key, plan: body.plan, seats: body.seats || 1, status: 'active', starts_at: now(), expires_at: now() + (body.plan === 'annual' ? 365 : 30) * 86400000, seats_used: 0 };
    db.licenses.push(lic); mockDB.save();
    return { license_key: key, invoice_id: 'inv_' + uid() };
  },

  'GET /wallet': async ({ query }) => {
    await sleep(150);
    const db = mockDB.get(); const type = query.type || 'print';
    return { ...db.wallets[type], txns: db.txns.filter(t => t.wallet_type === type).sort((a, b) => b.created_at - a.created_at) };
  },
  'POST /wallet/topup': async ({ body }) => {
    await sleep(400);
    return { order_id: 'order_mock_' + uid(), rzp_key: 'rzp_test_DEMO', amount: body.credits, credits: body.credits, type: body.type };
  },
  'POST /wallet/verify': async ({ body }) => {
    await sleep(700);
    const db = mockDB.get(); const type = body.type || 'print'; const credits = body.credits || 1000;
    db.wallets[type].balance += credits;
    const inv = { id: 'inv_' + uid(), number: 'MV-2025-' + String(db.invoices.length + 1).padStart(4,'0'), subtotal_inr: credits, gst_inr: 0, total_inr: credits, status: 'paid', created_at: now() };
    db.invoices.unshift(inv);
    db.txns.unshift({ id: 't' + uid(), wallet_type: type, kind: 'topup', credits_delta: credits, balance_after: db.wallets[type].balance, created_at: now(), invoice_id: inv.id });
    mockDB.save();
    return { balance: db.wallets[type].balance, invoice_id: inv.id, invoice: inv };
  },
  'POST /wallet/auto': async ({ body }) => {
    const db = mockDB.get(); const w = db.wallets[body.type];
    if (body.auto_recharge != null) w.auto_recharge = body.auto_recharge;
    if (body.threshold != null) w.threshold = body.threshold;
    if (body.auto_amount != null) w.auto_amount = body.auto_amount;
    mockDB.save(); return { ok: true };
  },

  'GET /tickets': async () => { await sleep(150); return mockDB.get().tickets; },
  'POST /tickets': async ({ body }) => {
    const db = mockDB.get();
    const t = { id: 'tk' + uid(), category: body.category, subject: body.subject, status: 'open', created_at: now(), message_count: 1,
      messages: [{ id: 'm' + uid(), sender_role: 'user', body: body.body, created_at: now() }] };
    db.tickets.unshift(t); mockDB.save(); return t;
  },
  'POST /tickets/reply': async ({ body }) => {
    const db = mockDB.get(); const t = db.tickets.find(x => x.id === body.id);
    if (!t) throw new Error('Ticket not found');
    const msg = { id: 'm' + uid(), sender_role: 'user', body: body.body, created_at: now() };
    t.messages.push(msg); t.message_count++; mockDB.save();
    return { message_id: msg.id };
  },
  'POST /tickets/close': async ({ body }) => {
    const db = mockDB.get(); const t = db.tickets.find(x => x.id === body.id);
    if (t) { t.status = 'closed'; mockDB.save(); }
    return { ok: true };
  },

  'GET /bugs': async () => mockDB.get().bugs,
  'POST /bugs': async ({ body }) => {
    const db = mockDB.get();
    const b = { id: 'bg' + uid(), title: body.title, description: body.description, severity: body.severity, status: 'open', created_at: now() };
    db.bugs.unshift(b); mockDB.save(); return b;
  },

  'GET /invoices': async () => { await sleep(150); const db = mockDB.get(); return { data: db.invoices, total: db.invoices.length, page: 1, per_page: 20 }; },

  'GET /team': async () => { await sleep(150); return mockDB.get().team; },
  'POST /team/invite': async ({ body }) => {
    const db = mockDB.get();
    db.team.invites.push({ id: 'inv' + uid(), email: body.email, role: body.role, created_at: now(), expires_at: now() + 7 * 86400000 });
    mockDB.save(); return { ok: true, message: 'Invite sent' };
  },
  'POST /team/accept': async ({ body }) => { await sleep(400); return { ok: true }; },
  'DELETE /team': async ({ body }) => {
    const db = mockDB.get();
    db.team.members = db.team.members.filter(m => m.id !== body.id); mockDB.save(); return { ok: true };
  },
  'PATCH /team/role': async ({ body }) => {
    const db = mockDB.get(); const m = db.team.members.find(x => x.id === body.id);
    if (m) { m.role = body.role; mockDB.save(); } return { ok: true };
  },

  'GET /analytics': async () => { await sleep(150); return mockDB.get().analytics; },
  'GET /audit': async () => mockDB.get().audit.slice(0, 100),

  'GET /api-keys': async () => mockDB.get().api_keys,
  'POST /api-keys': async ({ body }) => {
    const db = mockDB.get();
    const plain = 'mv_live_' + uid() + uid() + uid();
    const k = { id: 'k' + uid(), label: body.label, prefix: plain.slice(0, 12), last_used_at: null, created_at: now() };
    db.api_keys.push(k); mockDB.save();
    return { ...k, plain };
  },
  'DELETE /api-keys': async ({ body }) => {
    const db = mockDB.get();
    db.api_keys = db.api_keys.filter(k => k.id !== body.id); mockDB.save(); return { ok: true };
  },

  'GET /referrals': async () => mockDB.get().referrals,

  'POST /chat': async ({ body }) => {
    await sleep(800);
    return { reply: 'This is a mock AI response. In production, Gemini 1.5 Flash will answer here.' };
  },

  'POST /contact': async ({ body }) => { await sleep(600); return { ok: true }; },

  'GET /public/config': async () => ({
    brand_name: 'Mediview', rzp_key_id: 'rzp_test_DEMO',
    google_client_id: '', support_email: 'support@mediview.in',
  }),
};

const mockFetch = async (method, path, body, query) => {
  const cleanKey = `${method} ${path}`;
  const handler = mockHandlers[cleanKey];
  if (!handler) {
    console.warn('[mock] no handler for', method, path);
    throw new Error(`No mock handler for ${method} ${path}`);
  }
  return handler({ body: body || {}, query: query || {} });
};

// ===== UNIFIED API ====================================================================
const api = {
  // Auth
  signup:        (data) => API_MODE === 'live' ? liveFetch('/auth/signup', { method: 'POST', body: data }) : mockFetch('POST', '/auth/signup', data),
  login:         (data) => API_MODE === 'live' ? liveFetch('/auth/login',  { method: 'POST', body: data }) : mockFetch('POST', '/auth/login',  data),
  google:        (data) => API_MODE === 'live' ? liveFetch('/auth/google', { method: 'POST', body: data }) : mockFetch('POST', '/auth/google', data),
  logout:        ()     => API_MODE === 'live' ? liveFetch('/auth/logout', { method: 'POST' })             : mockFetch('POST', '/auth/logout'),
  me:            ()     => API_MODE === 'live' ? liveFetch('/me')                                          : mockFetch('GET',  '/me'),
  forgot:        (data) => API_MODE === 'live' ? liveFetch('/auth/forgot', { method: 'POST', body: data }) : mockFetch('POST', '/auth/forgot', data),
  resetPassword: (data) => API_MODE === 'live' ? liveFetch('/auth/reset',  { method: 'POST', body: data }) : mockFetch('POST', '/auth/reset',  data),
  verifyEmail:   (data) => API_MODE === 'live' ? liveFetch('/auth/verify-email', { method: 'POST', body: data }) : mockFetch('POST', '/auth/verify-email', data),
  resendVerify:  ()     => API_MODE === 'live' ? liveFetch('/auth/resend-verify', { method: 'POST' })      : mockFetch('POST', '/auth/resend-verify'),

  // Devices
  devices:        ()   => API_MODE === 'live' ? liveFetch('/devices')                                              : mockFetch('GET',  '/devices'),
  deactivateDevice: (id) => API_MODE === 'live' ? liveFetch(`/devices/${id}/deactivate`, { method: 'POST' })      : mockFetch('POST', '/devices/deactivate', { id }),

  // Licenses
  licenses:      ()     => API_MODE === 'live' ? liveFetch('/licenses')                                                                : mockFetch('GET',  '/licenses'),
  orderLicense:  (data) => API_MODE === 'live' ? liveFetch('/licenses/order',  { method: 'POST', body: data })                        : mockFetch('POST', '/licenses/order',  data),
  verifyLicense: (data) => API_MODE === 'live' ? liveFetch('/licenses/verify', { method: 'POST', body: data })                        : mockFetch('POST', '/licenses/verify', data),

  // Wallet
  wallet:        (type) => API_MODE === 'live' ? liveFetch(`/wallet?type=${type}`)                             : mockFetch('GET',  '/wallet', null, { type }),
  topup:         (data) => API_MODE === 'live' ? liveFetch('/wallet/topup',  { method: 'POST', body: data })  : mockFetch('POST', '/wallet/topup',  data),
  verifyPayment: (data) => API_MODE === 'live' ? liveFetch('/wallet/verify', { method: 'POST', body: data })  : mockFetch('POST', '/wallet/verify', data),
  setAutoRecharge:(data)=> API_MODE === 'live' ? liveFetch('/wallet/auto',   { method: 'POST', body: data })  : mockFetch('POST', '/wallet/auto',   data),

  // Tickets
  tickets:      ()        => API_MODE === 'live' ? liveFetch('/tickets')                                                        : mockFetch('GET',  '/tickets'),
  createTicket: (data)    => API_MODE === 'live' ? liveFetch('/tickets', { method: 'POST', body: data })                        : mockFetch('POST', '/tickets', data),
  replyTicket:  (id, data)=> API_MODE === 'live' ? liveFetch(`/tickets/${id}/reply`, { method: 'POST', body: data })            : mockFetch('POST', '/tickets/reply', { ...data, id }),
  closeTicket:  (id)      => API_MODE === 'live' ? liveFetch(`/tickets/${id}/close`, { method: 'POST' })                        : mockFetch('POST', '/tickets/close', { id }),

  // Bugs
  bugs:       ()     => API_MODE === 'live' ? liveFetch('/bugs')                               : mockFetch('GET',  '/bugs'),
  createBug:  (data) => API_MODE === 'live' ? liveFetch('/bugs', { method: 'POST', body: data }) : mockFetch('POST', '/bugs', data),

  // Invoices
  invoices:   (page = 1) => API_MODE === 'live' ? liveFetch(`/invoices?page=${page}`) : mockFetch('GET', '/invoices'),
  invoicePdf: (id)       => `${API_BASE}/invoices/${id}/pdf`, // returns URL for <a href>

  // Team
  team:        ()     => API_MODE === 'live' ? liveFetch('/team')                                                 : mockFetch('GET',  '/team'),
  inviteTeam:  (data) => API_MODE === 'live' ? liveFetch('/team/invite', { method: 'POST', body: data })          : mockFetch('POST', '/team/invite', data),
  acceptInvite:(data) => API_MODE === 'live' ? liveFetch('/team/accept', { method: 'POST', body: data })          : mockFetch('POST', '/team/accept', data),
  removeMember:(id)   => API_MODE === 'live' ? liveFetch(`/team/${id}`,  { method: 'DELETE' })                    : mockFetch('DELETE', '/team', { id }),
  updateRole:  (id, role) => API_MODE === 'live' ? liveFetch(`/team/${id}/role`, { method: 'PATCH', body: { role } }) : mockFetch('PATCH', '/team/role', { id, role }),

  // Analytics + Audit
  analytics: () => API_MODE === 'live' ? liveFetch('/analytics') : mockFetch('GET', '/analytics'),
  audit:     () => API_MODE === 'live' ? liveFetch('/audit')     : mockFetch('GET', '/audit'),

  // API keys
  apiKeys:      ()     => API_MODE === 'live' ? liveFetch('/api-keys')                                               : mockFetch('GET',    '/api-keys'),
  createApiKey: (data) => API_MODE === 'live' ? liveFetch('/api-keys', { method: 'POST', body: data })              : mockFetch('POST',   '/api-keys', data),
  deleteApiKey: (id)   => API_MODE === 'live' ? liveFetch(`/api-keys/${id}`, { method: 'DELETE' })                  : mockFetch('DELETE', '/api-keys', { id }),

  // Referrals
  referrals: () => API_MODE === 'live' ? liveFetch('/referrals') : mockFetch('GET', '/referrals'),

  // Chat
  chat: (data) => API_MODE === 'live' ? liveFetch('/chat', { method: 'POST', body: data }) : mockFetch('POST', '/chat', data),

  // Contact
  contact: (data) => API_MODE === 'live' ? liveFetch('/contact', { method: 'POST', body: data }) : mockFetch('POST', '/contact', data),

  // Public config (no auth)
  publicConfig: () => API_MODE === 'live' ? liveFetch('/public/config') : mockFetch('GET', '/public/config'),

  // Admin (super_admin only)
  adminOverview:     ()     => liveFetch('/admin/overview'),
  adminAccounts:     (p=1)  => liveFetch(`/admin/accounts?page=${p}`),
  adminLicenses:     (p=1)  => liveFetch(`/admin/licenses?page=${p}`),
  adminPayments:     (p=1)  => liveFetch(`/admin/payments?page=${p}`),
  adminTickets:      (p=1)  => liveFetch(`/admin/tickets?page=${p}`),
  adminAudit:        (p=1)  => liveFetch(`/admin/audit?page=${p}`),
  adminInvoices:     (p=1)  => liveFetch(`/admin/invoices?page=${p}`),
  adminSettings:     ()     => liveFetch('/admin/settings'),
  saveAdminSettings: (data) => liveFetch('/admin/settings', { method: 'POST', body: data }),
  testSmtp:          (data) => liveFetch('/admin/test-smtp', { method: 'POST', body: data }),
  testRazorpay:      ()     => liveFetch('/admin/test-razorpay', { method: 'POST', body: {} }),
  testGemini:        ()     => liveFetch('/admin/test-gemini', { method: 'POST', body: {} }),
  impersonate:       (id)   => liveFetch(`/admin/impersonate/${id}`, { method: 'POST' }),
  revokeAdminLicense:(id)   => liveFetch(`/admin/licenses/${id}/revoke`, { method: 'POST' }),
  markInvoicePaid:   (id)   => liveFetch(`/admin/invoices/${id}/mark-paid`, { method: 'POST' }),
  adminReplyTicket:  (id, data) => liveFetch(`/admin/tickets/${id}/reply`, { method: 'POST', body: data }),

  // Utils
  getMode:       () => API_MODE,
  resetMockData: () => mockDB.reset(),
};

window.mvApi = api;
