// A stand-in for the Django API, for looking at the Console without a backend.
// Every response here is shaped from the backend serializer named beside it.
// Paths with no fixture answer an empty page and are logged to unhandled.log,
// which doubles as a record of what each screen actually calls.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOG = path.join(HERE, 'unhandled.log');
const PORT = 8011;

const ref = (id, name, node_type) => ({ id, name, node_type });
const NODES = [
  // hierarchy.serializers.HierarchyNodeSerializer
  ['n0', 'RCCG Nigeria', 'national', '0001', null, false],
  ['r63', 'Region 63', 'region', '00010001', 'n0', true],
  ['p69', 'Lagos Province 69', 'province', '000100010001', 'r63', true],
  ['z1', 'Ikeja Zone', 'zone', '0001000100010001', 'p69', true],
  ['a2', 'Ikeja Area 2', 'area', '00010001000100010001', 'z1', true],
  ['pr1', 'RCCG Rehoboth Parish', 'parish', '000100010001000100010001', 'a2', true],
  ['pr2', 'RCCG Victory House', 'parish', '000100010001000100010002', 'a2', true],
  ['z2', 'Agege Zone', 'zone', '0001000100010002', 'p69', true],
].map(([id, name, node_type, p, parent_id, selectable]) => ({
  id, name, node_type, code: '', slug: name.toLowerCase().replace(/\W+/g, '-'),
  is_active: true, path: p, depth: p.length / 4, parent_id, selectable,
}));

const PERMISSIONS = [
  'users.view', 'users.manage', 'profiles.view', 'profiles.manage',
  'memberships.view', 'memberships.manage', 'roles.view', 'roles.assign',
  'hierarchy.view', 'content.view', 'content.publish', 'content.manage',
  'media.manage', 'events.view', 'events.manage', 'events.checkin',
  'payments.view',
];

const USER = { id: 'u-tunde', username: 'tunde', display_name: 'Tunde Adeyemi', email: 'tunde.adeyemi@gmail.com', is_active: true };

// identity.serializers.MeSerializer
const ME = {
  id: USER.id, username: USER.username, email: USER.email,
  first_name: 'Tunde', last_name: 'Adeyemi', is_superuser: false,
  profile: { id: 'pf1', display_name: 'Tunde Adeyemi', phone: '+2348030000000' },
  memberships: [{
    id: 'm1', user: USER.id, user_detail: USER, organization_node: 'pr1',
    organization_node_detail: ref('pr1', 'RCCG Rehoboth Parish', 'parish'),
    is_primary: true, is_active: true, joined_at: '2024-01-14',
  }],
  role_assignments: [{
    id: 'ra1', user: USER.id, user_detail: USER, role: 'role-rc',
    role_detail: { id: 'role-rc', code: 'regional_coordinator', label: 'Regional Coordinator', description: '', allowed_node_types: ['region'], permissions: PERMISSIONS },
    node: 'r63', node_detail: ref('r63', 'Region 63', 'region'),
    start_date: '2025-03-03', end_date: null, is_active: true,
    appointed_by: null, appointed_by_detail: null, created_at: '2025-03-03T09:00:00Z',
  }],
  permissions: PERMISSIONS,
};

const ROUTES = {
  // Any email and password signs in as the fixture user (users AuthResponse).
  'POST /auth/login/': {
    access: 'fixture', refresh: 'fixture',
    user: { id: USER.id, username: USER.username, email: USER.email, first_name: 'Tunde', last_name: 'Adeyemi', role: 'admin' },
  },
  'GET /identity/me/': ME,
  'GET /hierarchy/nodes/': { count: NODES.length, results: NODES },
};

// Per-screen fixtures live in ./fixtures/*.json as { "GET /path/": body }.
// Read on every request, so editing one needs no restart.
const dir = path.join(HERE, 'fixtures');
function routes() {
  const all = { ...ROUTES };
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      // Editors leave swap and backup files here; only fixtures are JSON.
      if (!f.endsWith('.json')) continue;
      Object.assign(all, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    }
  }
  // `echo teacher > persona` signs the Console in as personas/teacher.json:
  // a different `/identity/me/` and whatever else that person would be sent.
  const persona = path.join(HERE, 'persona');
  if (fs.existsSync(persona)) {
    const name = fs.readFileSync(persona, 'utf8').trim();
    const file = path.join(HERE, 'personas', `${name}.json`);
    if (fs.existsSync(file)) Object.assign(all, JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  return all;
}

fs.writeFileSync(LOG, '');
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const route = url.pathname.replace(/^\/api\/v1/, '');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const key = `${req.method} ${route}`;
  let body = routes()[key];
  if (body === undefined) {
    fs.appendFileSync(LOG, `${key}${url.search}\n`);
    body = { count: 0, next: null, previous: null, results: [] };
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}).listen(PORT, () => console.log(`mock api on ${PORT}`));
