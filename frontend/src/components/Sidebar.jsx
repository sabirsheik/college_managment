import { NavLink } from 'react-router-dom';
import { resourceConfig } from '../constants/resources.js';
import { permissions, resourcePermission } from '../constants/permissions.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Sidebar() {
  const { user, can } = useAuth();
  const links = [
    { to: '/dashboard', label: 'Overview', icon: 'OV', permission: permissions.dashboardRead },
    ...Object.entries(resourceConfig).map(([to, item]) => ({
      to: `/${to}`,
      label: item.label,
      icon: item.icon,
      permission: resourcePermission(item.permission, 'read')
    })),
    { to: '/settings', label: 'College settings', icon: 'CS', permission: permissions.collegeSettingsRead },
    { to: '/notifications', label: 'Notifications', icon: 'NT', permission: permissions.notificationsRead },
    { to: '/audit-logs', label: 'Audit log', icon: 'AL', permission: permissions.auditLogsRead }
  ].filter((link) => can(link.permission));

  return (
    <aside className="sidebar">
      <NavLink className="brand" to="/dashboard">
        <div className="brand-mark">C</div>
        <div><strong>Campus</strong><span>COLLEGE MANAGEMENT</span></div>
      </NavLink>
      <p className="nav-caption">WORKSPACE</p>
      <nav aria-label="Main navigation">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.to === '/dashboard'}>
            <span className="nav-icon">{link.icon}</span>
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
