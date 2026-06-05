/* App shell: fixed sidebar nav + topbar. Mirrors ris/ui/src/AppShell.tsx,
   restyled to the red/white identity. */
const { useState: useStateShell } = React;

const NAV_MAIN = [
  { to: 'dashboard',  label: 'Dashboard',  icon: 'layout-dashboard' },
  { to: 'reception',  label: 'Reception',  icon: 'clipboard-list' },
  { to: 'worklist',   label: 'Worklist',   icon: 'list-checks', count: 4 },
  { to: 'billing',    label: 'Day Book',   icon: 'receipt' },
  { to: 'commission', label: 'Commission', icon: 'percent' },
];
const NAV_ADMIN = [
  { to: 'settings',   label: 'Settings & Network', icon: 'network' },
];

const ROUTE_TITLES = {
  dashboard:  { title: 'Dashboard',  crumb: 'Operational overview' },
  reception:  { title: 'Reception',  crumb: 'Registration · visits · payment' },
  worklist:   { title: 'Worklist',   crumb: 'Doctor & collection console' },
  billing:    { title: 'Day Book',   crumb: 'Collections & payments' },
  commission: { title: 'Commission', crumb: 'Referring-doctor payouts' },
  settings:   { title: 'Settings & Network', crumb: 'LAN · DICOM · ecosystem' },
};

function Sidebar({ route, onNav, user, can }) {
  const ok = can || (() => true);
  const Link = ({ item }) => (
    <button className={`nav-link ${route === item.to ? 'active' : ''}`} onClick={() => onNav(item.to)}>
      <Icon name={item.icon} size={17} />
      <span>{item.label}</span>
      {item.count != null && <span className="count">{item.count}</span>}
    </button>
  );
  const main = NAV_MAIN.filter((i) => ok(i.to));
  const admin = NAV_ADMIN.filter((i) => ok(i.to));
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="name">One Clickz RIS</div>
        <div className="sub">Radiology Information System</div>
      </div>
      <nav className="sidebar-nav">
        {main.map((i) => <Link key={i.to} item={i} />)}
        {admin.length > 0 && <div className="nav-section">Administration</div>}
        {admin.map((i) => <Link key={i.to} item={i} />)}
      </nav>
      <div className="sidebar-foot">
        <div className="userbox">
          <span className="avatar">{(user.name || 'U').split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
          <div style={{ minWidth: 0 }}>
            <div className="uname">{user.name}</div>
            <div className="urole">{user.role.replace('_', ' ')}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ route, onLogout, onToggleTheme, theme }) {
  const meta = ROUTE_TITLES[route] || { title: '', crumb: '' };
  return (
    <header className="topbar">
      <div>
        <div className="title">{meta.title}</div>
      </div>
      <div className="crumb">{meta.crumb}</div>
      <div className="spacer" />
      <div className="search">
        <Icon name="search" size={15} />
        <input placeholder="Search patient, MRN, accession…" />
      </div>
      <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} bordered onClick={onToggleTheme} title="Toggle theme" />
      <IconButton icon="bell" bordered title="Alerts" />
      <IconButton icon="log-out" bordered onClick={onLogout} title="Sign out" />
    </header>
  );
}

window.Sidebar = Sidebar;
window.Topbar = Topbar;
