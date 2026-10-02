/**
 * SmartPark - application shell: sidebar navigation + top bar.
 */

import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../services/auth.jsx';
import {
  IconDashboard,
  IconSearch,
  IconMap,
  IconNavigation,
  IconHistory,
  IconCamera,
  IconLogout,
  IconMenu,
  IconRadar,
} from '../data/icons.jsx';
import { useParking } from '../services/parking.jsx';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: IconDashboard, group: 'Operations' },
  { to: '/search', label: 'Vehicle Search', icon: IconSearch, group: 'Operations' },
  { to: '/history', label: 'Vehicle History', icon: IconHistory, group: 'Operations' },
  { to: '/map', label: 'Parking Map', icon: IconMap, group: 'Parking' },
  { to: '/camera', label: 'ANPR Camera', icon: IconCamera, group: 'Parking' },
  { to: '/navigate', label: 'Navigation', icon: IconNavigation, group: 'Parking' },
];

const TITLES = {
  '/dashboard': ['Dashboard', 'Live occupancy across all four blocks'],
  '/search': ['Vehicle Search', 'Look up a vehicle by number, slot, block or owner'],
  '/history': ['Vehicle History', 'Entry and exit log with time-range filters'],
  '/map': ['Parking Map', 'Every bay in the campus, live status'],
  '/camera': ['ANPR Camera', 'Entrance camera, OCR and slot allocation console'],
  '/navigate': ['Navigation', 'Route from the watchman room to a parking bay'],
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const { totals, loading } = useParking();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const [title, subtitle] = TITLES[location.pathname] || ['SmartPark', 'Apartment parking management'];

  const groups = [...new Set(NAV.map((n) => n.group))];

  return (
    <div className="app">
      {open ? <div className="scrim" onClick={() => setOpen(false)} /> : null}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">
            <IconRadar size={22} />
          </span>
          <div>
            <div className="brand-name">SmartPark</div>
            <div className="brand-sub">ANPR Control</div>
          </div>
        </div>

        <nav className="nav">
          {groups.map((group) => (
            <div key={group}>
              <div className="nav-label">{group}</div>
              {NAV.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <span className="nav-ico">
                      <Icon size={17} />
                    </span>
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="user-chip">
            <span className="avatar">{(user?.name || 'W').slice(0, 1).toUpperCase()}</span>
            <div style={{ minWidth: 0 }}>
              <div className="user-name truncate">{user?.name || 'Watchman'}</div>
              <div className="user-role">{user?.role || 'watchman'}</div>
            </div>
          </div>
          <button className="btn btn-sm btn-block" onClick={logout}>
            <IconLogout size={15} /> Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            <IconMenu size={19} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 className="truncate">{title}</h1>
            <div className="topbar-sub truncate">{subtitle}</div>
          </div>
          <div className="topbar-spacer" />
          <span className="badge badge-brand nowrap">
            {loading ? 'Syncing' : `${totals.empty} free / ${totals.slots}`}
          </span>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
