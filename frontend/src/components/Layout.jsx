import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  Coins,
  SearchCheck,
  TrendingDown,
  Briefcase,
  Inbox,
  Compass,
  FileSpreadsheet,
  Sliders,
  ShieldCheck,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import PolicyLensLogo from './PolicyLensLogo.jsx';

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 720 : false
  );
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const notifRef = useRef(null);

  // Sync mobile viewport state on resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 720;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleToggleSidebar = () => {
    if (isMobile) {
      setMobileOpen(prev => !prev);
    } else {
      setCollapsed(prev => !prev);
    }
  };

  // Fetch unread count & notifications
  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      if (res.data?.count !== undefined) {
        setUnreadCount(res.data.count);
      }
    } catch {
      // Ignore background notification error
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const openNotificationDropdown = async () => {
    const nextState = !showNotifications;
    setShowNotifications(nextState);
    if (nextState) {
      try {
        const res = await api.get('/notifications/', { per_page: 5 });
        if (res.data) {
          setNotifications(res.data);
        }
      } catch {
        // Fallback
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {
      // Handle silently
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter' && globalSearch.trim()) {
      navigate(`/financial-records?q=${encodeURIComponent(globalSearch.trim())}`);
    }
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
    { to: '/financial-records', label: 'Financial Data', icon: Coins },
    { to: '/anomaly-detection', label: 'Anomaly Detection', icon: SearchCheck },
    { to: '/risk-insights', label: 'Risk Insights', icon: TrendingDown },
    { to: '/cases', label: 'Cases', icon: Briefcase },
    { to: '/complaints', label: 'Complaints', icon: Inbox },
    { to: '/regional', label: 'Regional Analysis', icon: Compass },
    { to: '/reports', label: 'Reports', icon: FileSpreadsheet },
    { to: '/settings', label: 'Settings', icon: Sliders },
  ];

  if (hasRole('Admin')) {
    navItems.push({ to: '/admin', label: 'Administration', icon: ShieldCheck });
  }

  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'PL';

  return (
    <div className="app">
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`side ${collapsed && !isMobile ? 'collapsed' : ''} ${mobileOpen ? 'show' : ''}`}>
        <div className="brand">
          {collapsed && !isMobile ? (
            <PolicyLensLogo variant="mark" size="md" />
          ) : (
            <PolicyLensLogo variant="full" size="md" />
          )}
          <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav>
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'on' : '')}
                title={collapsed && !isMobile ? item.label : undefined}
                onClick={() => {
                  if (isMobile) {
                    setMobileOpen(false);
                  }
                }}
              >
                <button type="button">
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              </NavLink>
            );
          })}
        </nav>

        <em>
          <i /> <span>Analysis service available</span>
        </em>
      </aside>

      {/* Main Content Area */}
      <main>
        <header>
          <button
            onClick={handleToggleSidebar}
            aria-label={collapsed && !isMobile ? "Expand sidebar" : "Toggle menu"}
            className="sidebar-toggle-btn"
            title={collapsed && !isMobile ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu size={18} />
          </button>

          <div className="mobile-header-logo">
            <PolicyLensLogo variant="mark" size="sm" />
          </div>

          <label className="search">
            <Search size={15} />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onKeyDown={handleSearchSubmit}
              placeholder="Search records, cases, or regions..."
            />
          </label>

          {/* Notifications Popover */}
          <div style={{ position: 'relative', marginLeft: 'auto' }} ref={notifRef}>
            <button
              onClick={openNotificationDropdown}
              aria-label="Notifications"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                padding: '6px',
                color: unreadCount > 0 ? 'var(--primary)' : 'var(--text-secondary)',
              }}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '1px',
                    right: '1px',
                    background: 'var(--danger)',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 4px',
                    lineHeight: '12px',
                    minWidth: '14px',
                    textAlign: 'center',
                  }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '6px',
                  width: '300px',
                  background: 'var(--surface)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                  border: '1px solid var(--border)',
                  zIndex: 100,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border-light)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <strong style={{ fontSize: '12px', color: 'var(--text)' }}>
                    Notifications ({unreadCount} new)
                  </strong>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      style={{
                        fontSize: '11px',
                        color: 'var(--primary)',
                        fontWeight: 600,
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--border-light)',
                          background: n.is_read ? 'var(--surface)' : 'var(--primary-soft)',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
                          {n.title}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.message}</div>
                        <small style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '3px', display: 'block' }}>
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </small>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile & Role Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '6px' }}>
            <div
              className="avatar"
              title={`${user?.name} (${user?.role})`}
            >
              {userInitials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', lineHeight: '1.25' }}>
                {user?.name || 'Admin User'}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                {user?.role || 'ADMIN'}
              </span>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                color: 'var(--text-secondary)',
                borderRadius: '6px',
                marginLeft: '4px',
                cursor: 'pointer',
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = 'var(--danger)';
                e.currentTarget.style.background = 'var(--danger-soft)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <article>
          <Outlet />
        </article>
      </main>
    </div>
  );
}
