import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, FilePlus2, History, FileText,
  User, Settings, HelpCircle, LogOut, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/client';
import { useToast } from './Toast';

const primaryLinks = [
  { to: '/dashboard',    label: 'Dashboard',    icon: LayoutGrid },
  { to: '/new-analysis', label: 'New Analysis', icon: FilePlus2 },
  { to: '/analyses',     label: 'My Analyses',  icon: History },
  { to: '/resumes',      label: 'Resumes',      icon: FileText },
  { to: '/profile',      label: 'Profile',      icon: User },
  { to: '/settings',     label: 'Settings',     icon: Settings },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch { /* ignore — tokens are cleared regardless */ }
    logout();
    navigate('/login');
    toast.info('Logged out successfully.');
  }

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col justify-between border-r border-border bg-surface px-4 py-6">
      <div>
        {/* Logo */}
        <NavLink to="/dashboard" className="flex items-center gap-2 px-2 pb-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white font-display font-bold text-sm shrink-0">
            C
          </div>
          <div>
            <p className="font-display font-semibold text-[15px] text-ink leading-none">CareerAI</p>
            <p className="text-[10px] text-ink-muted mt-0.5">AI Career Agent</p>
          </div>
        </NavLink>

        {/* Primary nav */}
        <nav className="flex flex-col gap-1" aria-label="Primary navigation">
          {primaryLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-ink-muted hover:bg-canvas hover:text-ink'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}

          {/* Admin link — only shown to admin users */}
          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors mt-2 ${
                  isActive
                    ? 'bg-violet/10 text-violet'
                    : 'text-ink-muted hover:bg-canvas hover:text-ink'
                }`
              }
            >
              <ShieldCheck size={17} />
              Admin Panel
            </NavLink>
          )}
        </nav>
      </div>

      {/* Bottom */}
      <div className="flex flex-col gap-1 border-t border-border pt-4">
        {user && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-ink truncate">{user.full_name || user.email}</p>
            <p className="text-xs text-ink-muted truncate">{user.full_name ? user.email : ''}</p>
          </div>
        )}
        <NavLink
          to="/contact"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-canvas hover:text-ink transition-colors"
        >
          <HelpCircle size={17} />
          Help
        </NavLink>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-canvas hover:text-ink transition-colors w-full text-left"
        >
          <LogOut size={17} />
          Log out
        </button>
      </div>
    </aside>
  );
}
