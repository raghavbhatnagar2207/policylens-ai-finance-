import React, { useState, useEffect } from 'react';
import { User, Lock, Sliders, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import Title from '../components/Title.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api, { setTokens } from '../services/api.js';

export default function Settings() {
  const { user, hasRole } = useAuth();

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState({ text: '', isError: false });

  // Settings state (Admin only)
  const [settings, setSettings] = useState({
    anomaly_contamination: '0.10',
    risk_threshold_high: '0.40',
    delay_threshold_days: '20',
    utilization_low_threshold: '40',
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState({ text: '', isError: false });

  useEffect(() => {
    if (hasRole('Admin')) {
      async function loadSettings() {
        try {
          const res = await api.get('/admin/settings');
          if (res.data?.settings) {
            setSettings((prev) => ({ ...prev, ...res.data.settings }));
          }
        } catch (err) {
          console.error('Failed to load settings:', err);
        }
      }
      loadSettings();
    }
  }, [hasRole]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwMsg({ text: 'New passwords do not match.', isError: true });
      return;
    }
    if (newPassword.length < 8) {
      setPwMsg({ text: 'Password must be at least 8 characters.', isError: true });
      return;
    }
    setPwLoading(true);
    setPwMsg({ text: '', isError: false });

    try {
      const res = await api.patch('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      if (res.data?.access_token) {
        setTokens(res.data.access_token, localStorage.getItem('pl_refresh_token'));
      }
      setPwMsg({ text: 'Password updated successfully.', isError: false });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwMsg({ text: err.message || 'Failed to update password.', isError: true });
    } finally {
      setPwLoading(false);
    }
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsMsg({ text: '', isError: false });

    try {
      await api.patch('/admin/settings', { settings });
      setSettingsMsg({ text: 'System thresholds updated successfully.', isError: false });
    } catch (err) {
      setSettingsMsg({ text: err.message || 'Failed to update settings.', isError: true });
    } finally {
      setSettingsLoading(false);
    }
  };

  return (
    <>
      <Title
        title="Settings & System Configuration"
        text="Manage your authenticated credentials, role permissions, and machine learning thresholds."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
        {/* User Profile Card */}
        <section className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <User size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0 }}>User Profile Information</h3>
          </div>

          <div style={{ display: 'grid', gap: '12px', fontSize: '13px' }}>
            <div style={{ padding: '10px 12px', background: 'var(--bg, #F7F6F2)', border: '1px solid var(--border-light, #ECEAE4)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-secondary, #69737A)', display: 'block', fontSize: '11px' }}>Full Name</span>
              <b style={{ color: 'var(--text, #20282D)' }}>{user?.name || 'Authorized Operator'}</b>
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--bg, #F7F6F2)', border: '1px solid var(--border-light, #ECEAE4)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-secondary, #69737A)', display: 'block', fontSize: '11px' }}>Email Address</span>
              <b style={{ color: 'var(--text, #20282D)' }}>{user?.email || 'N/A'}</b>
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--bg, #F7F6F2)', border: '1px solid var(--border-light, #ECEAE4)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-secondary, #69737A)', display: 'block', fontSize: '11px' }}>Assigned RBAC Role</span>
              <b style={{ color: 'var(--primary, #2F6B62)' }}>{user?.role || 'Analyst'}</b>
            </div>
          </div>
        </section>

        {/* Change Password Card */}
        <section className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Lock size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0 }}>Security & Credentials</h3>
          </div>

          {pwMsg.text && (
            <div
              style={{
                marginBottom: '12px',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                background: pwMsg.isError ? '#fee2e2' : '#ecfdf5',
                color: pwMsg.isError ? '#991b1b' : '#065f46',
              }}
            >
              {pwMsg.text}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                New Password (min 8 chars)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>

            <button type="submit" className="primary" disabled={pwLoading} style={{ marginTop: '6px' }}>
              {pwLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </section>

        {/* System Thresholds Card (Admin/Manager Only) */}
        {hasRole('Admin', 'Manager') && (
          <section className="card" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Sliders size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0 }}>Model Sensitivity & Policy Engine Parameters</h3>
            </div>

            {settingsMsg.text && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  background: settingsMsg.isError ? '#fee2e2' : '#ecfdf5',
                  color: settingsMsg.isError ? '#991b1b' : '#065f46',
                }}
              >
                {settingsMsg.text}
              </div>
            )}

            <form
              onSubmit={handleSettingsSubmit}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                  Isolation Forest Contamination
                </label>
                <input
                  type="text"
                  value={settings.anomaly_contamination || '0.10'}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, anomaly_contamination: e.target.value }))
                  }
                  style={{ width: '100%' }}
                />
                <small style={{ color: '#64748b' }}>Expected proportion of outliers in records</small>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                  Risk Score High Threshold
                </label>
                <input
                  type="text"
                  value={settings.risk_threshold_high || '0.40'}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, risk_threshold_high: e.target.value }))
                  }
                  style={{ width: '100%' }}
                />
                <small style={{ color: '#64748b' }}>Normalized score triggering high priority</small>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                  Processing Delay Alert (Days)
                </label>
                <input
                  type="text"
                  value={settings.delay_threshold_days || '20'}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, delay_threshold_days: e.target.value }))
                  }
                  style={{ width: '100%' }}
                />
                <small style={{ color: '#64748b' }}>Maximum allowable processing delay</small>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                  Utilization Floor (%)
                </label>
                <input
                  type="text"
                  value={settings.utilization_low_threshold || '40'}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, utilization_low_threshold: e.target.value }))
                  }
                  style={{ width: '100%' }}
                />
                <small style={{ color: '#64748b' }}>Minimum absorption rate before flag</small>
              </div>

              <div style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
                <button type="submit" className="primary" disabled={settingsLoading}>
                  {settingsLoading ? 'Saving...' : 'Save Configuration Parameters'}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </>
  );
}
