import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './ui/Toast';
import { useActiveRide } from '../hooks/useActiveRide';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition-colors ${isActive ? 'text-green-600' : 'text-gray-500 hover:text-gray-700'}`;

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeRide } = useActiveRide();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      toast('Failed to log out', 'error');
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-green-600">
            ⚡ EV Bike
          </Link>

          <nav className="hidden items-center gap-3 sm:flex">
            <NavLink to="/" end className={navLinkClass}>
              🗺️ Map
            </NavLink>
            <NavLink to="/rides" className={navLinkClass}>
              🚲 My Rides
            </NavLink>
            <NavLink to="/settings/payments" className={navLinkClass}>
              💳 Payment
            </NavLink>
            {activeRide && (
              <NavLink to="/ride/active" className={navLinkClass}>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  Active Ride
                </span>
              </NavLink>
            )}
          </nav>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:inline">{user.name}</span>
            <button
              onClick={handleLogout}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              Log out
            </button>
          </div>
        )}
      </header>

      {/* Mobile nav */}
      <nav className="flex items-center justify-around border-b border-gray-100 bg-white py-2 sm:hidden">
        <NavLink to="/" end className={navLinkClass}>
          🗺️ Map
        </NavLink>
        <NavLink to="/rides" className={navLinkClass}>
          🚲 Rides
        </NavLink>
        <NavLink to="/settings/payments" className={navLinkClass}>
          💳 Pay
        </NavLink>
        {activeRide && (
          <NavLink to="/ride/active" className={navLinkClass}>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Ride
            </span>
          </NavLink>
        )}
      </nav>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
