import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Logo } from './Logo';
import { useAuth } from '../lib/auth';

type NavItem = { to: string; label: string; end?: boolean; adminOnly?: boolean };

const allNavItems: NavItem[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/manage', label: 'Manage', adminOnly: true },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/analytics', label: 'Analytics', adminOnly: true },
];

export function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = !!user?.is_admin;
  const navItems = allNavItems.filter((i) => !i.adminOnly || isAdmin);
  const initials = user?.member?.full_name
    ? user.member.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : user?.phone.slice(-2) ?? '··';
  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-white border-b border-ink-200 sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center shrink-0">
            <Logo />
          </Link>
          <nav className="hidden md:flex items-center gap-1 flex-1 ml-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'text-federation-900 bg-ink-100'
                      : 'text-ink-700 hover:text-ink-900 hover:bg-ink-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <VentNavIcon />
          </nav>
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-ink-200 hover:bg-ink-50 transition"
                >
                  <span className="w-7 h-7 rounded-full bg-federation-800 text-white text-xs font-semibold flex items-center justify-center">
                    {initials}
                  </span>
                  <span className="text-xs text-ink-700">
                    {user.member?.full_name ?? `+91 ${user.phone.slice(0, 5)} ${user.phone.slice(5)}`}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                      isAdmin ? 'bg-saffron-100 text-saffron-800' : 'bg-azure-100 text-azure-700'
                    }`}
                  >
                    {isAdmin ? 'Admin' : 'Member'}
                  </span>
                  <svg className="w-3.5 h-3.5 text-ink-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-ink-200 z-20 overflow-hidden">
                      <div className="px-4 py-3 border-b border-ink-100">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-ink-500">Signed in as</div>
                          <span
                            className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                              isAdmin ? 'bg-saffron-100 text-saffron-800' : 'bg-azure-100 text-azure-700'
                            }`}
                          >
                            {isAdmin ? 'Admin' : 'Member'}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-ink-900 truncate">
                          {user.member?.full_name ?? user.society?.chairperson_name ?? 'Guest'}
                        </div>
                        <div className="text-xs text-ink-500">+91 {user.phone}</div>
                        {(user.member?.society_name || user.society?.name) && (
                          <div className="mt-1 text-xs text-ink-600">
                            {user.member?.society_name ?? user.society?.name}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => { setMenuOpen(false); logout(); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-ink-800 hover:bg-ink-50"
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link to="/login" className="btn-primary text-sm">
                Sign in
              </Link>
            )}
          </div>
        </div>
        <div className="md:hidden border-t border-ink-200 overflow-x-auto">
          <div className="flex gap-1 px-3 py-2 items-center">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium ${
                    isActive ? 'text-federation-900 bg-ink-100' : 'text-ink-700'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <VentNavIcon compact />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-ink-200 bg-white mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <Logo />
            <p className="mt-2 text-xs text-ink-500 max-w-xs">
              The Pimpri Chinchwad Co-Operative Housing Society Federation.
            </p>
          </div>
          <div className="text-xs text-ink-500">
            <div>Federation Office, Pimpri-Chinchwad, MH 411018</div>
            <div>contact@pcchsf.example.in · +91 20 0000 0000</div>
          </div>
        </div>
        <div className="border-t border-ink-100 py-3 text-center text-[11px] text-ink-500">
          © {new Date().getFullYear()} Pimpri Chinchwad Co-Operative Housing Society Federation — Prototype
        </div>
      </footer>
    </div>
  );
}

// ===== VENT nav icon — fiery VENT wordmark on black =====
function VentNavIcon({ compact = false }: { compact?: boolean }) {
  return (
    <NavLink
      to="/vent"
      aria-label="Open VENT"
      title="VENT — voice your grievances"
      className={({ isActive }) =>
        `relative inline-flex items-center rounded-lg bg-black transition shadow-md ${
          compact ? 'px-3 py-1.5' : 'px-4 py-2'
        } ${
          isActive
            ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-white'
            : 'hover:bg-ink-900'
        }`
      }
    >
      <span
        className={`font-black tracking-[0.18em] vent-fire-text ${compact ? 'text-xs' : 'text-sm'}`}
      >
        VENT
      </span>
    </NavLink>
  );
}
