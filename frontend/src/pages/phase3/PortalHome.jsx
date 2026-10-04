import { useAuth } from '../../context/AuthContext.jsx';
import AccountantDashboard from './AccountantDashboard.jsx';
import FacultyDashboard from './FacultyDashboard.jsx';
import LibrarianDashboard from './LibrarianDashboard.jsx';
import StudentDashboard from './StudentDashboard.jsx';
import DashboardPage from '../DashboardPage.jsx';
import './phase3.css';

const dashboards = {
  STUDENT: StudentDashboard,
  FACULTY: FacultyDashboard,
  ACCOUNTANT: AccountantDashboard,
  LIBRARIAN: LibrarianDashboard
};

export default function PortalHome() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-content p3-dashboard"><p className="p3-state" role="status">Loading your portal…</p></div>;
  const Dashboard = dashboards[user?.role];
  if (Dashboard) return <Dashboard user={user} />;
  if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') return <DashboardPage />;

  if (!Dashboard) {
    return (
      <div className="page-content p3-dashboard">
        <section className="panel p3-panel" role="status">
          <div className="panel-heading p3-panel-heading"><div><span className="eyebrow">CAMPUS PORTAL</span><h2>Dashboard unavailable</h2></div></div>
          <p className="p3-empty">This dashboard is not configured for your account role.</p>
        </section>
      </div>
    );
  }
}
