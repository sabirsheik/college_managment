import { NavLink } from 'react-router-dom';
import { resourceConfig } from '../constants/resources.js';
import { permissions, resourcePermission } from '../constants/permissions.js';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from './Icon.jsx';

const resourceIcons = {
  US: 'users',
  ST: 'graduation',
  FC: 'briefcase',
  DP: 'building',
  AS: 'calendar',
  PG: 'bookOpen',
  CR: 'book',
  EN: 'clipboard',
  SC: 'calendar',
  CA: 'coins',
  TT: 'clock',
  EX: 'clipboard',
  GP: 'chart',
  FE: 'wallet',
  FS: 'wallet',
  PY: 'coins',
  SD: 'calendar',
  FW: 'file',
  AR: 'file',
  AT: 'activity',
  IN: 'clipboard'
};

export default function Sidebar() {
  const { user, can } = useAuth();
  const links = [
    { to: '/dashboard', label: 'Overview', icon: 'grid', permission: permissions.dashboardRead },
    ...Object.entries(resourceConfig).map(([to, item]) => ({
      to: `/${to}`,
      label: item.label,
      icon: resourceIcons[item.icon] || 'file',
      permission: item.navigationPermission || resourcePermission(item.permission, 'read'),
      permissions: item.navigationPermissions
    })),
    { to: '/settings', label: 'College settings', icon: 'settings', permission: permissions.collegeSettingsRead },
    { to: '/library', label: 'Library', icon: 'bookOpen', permission: permissions.libraryBooksRead },
    { to: '/announcements', label: 'Announcements', icon: 'mail', permission: permissions.announcementsRead },
    { to: '/search', label: 'Search', icon: 'search', permission: permissions.searchRead },
    { to: '/data-exchange', label: 'Data exchange', icon: 'arrowDownUp', permissions: [permissions.importsRun, permissions.exportsRun] },
    { to: '/notifications', label: 'Notifications', icon: 'bell', permission: permissions.notificationsRead },
    { to: '/audit-logs', label: 'Audit log', icon: 'activity', permission: permissions.auditLogsRead }
  ].filter((link) => link.permissions ? link.permissions.some(can) : can(link.permission));

  return (
    <aside className="sidebar">
      <NavLink className="brand" to="/dashboard">
        <div className="brand-mark"><Icon name="graduation" size={22} /></div>
        <div><strong>Campus</strong><span>COLLEGE MANAGEMENT</span></div>
      </NavLink>
      <p className="nav-caption">WORKSPACE</p>
      <nav aria-label="Main navigation">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.to === '/dashboard'} title={link.label}>
            <span className="nav-icon"><Icon name={link.icon} size={19} /></span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="avatar">{user?.first_name?.[0]}{user?.last_name?.[0]}</span>
        <div><strong>{user?.first_name} {user?.last_name}</strong><small>{user?.role?.replaceAll('_', ' ')}</small></div>
      </div>
    </aside>
  );
}
