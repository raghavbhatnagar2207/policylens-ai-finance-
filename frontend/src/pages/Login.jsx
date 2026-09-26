import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import PolicyLensLogo from '../components/PolicyLensLogo.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminBypass = async () => {
    const adminEmail = 'admin@policylens.demo';
    const adminPass = 'Admin@1234';
    setEmail(adminEmail);
    setPassword(adminPass);
    setError('');
    setLoading(true);
    try {
      await login(adminEmail, adminPass);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Admin login bypass failed.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px 10px 38px',
    borderRadius: '6px',
    background: '#FFFFFF',
    border: '1px solid #DDDCD6',
    color: '#20282D',
    outline: 'none',
    fontSize: '13px',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: '#F7F6F2',
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px 20px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '400px',
            background: '#FFFFFF',
            border: '1px solid #DDDCD6',
            borderRadius: '8px',
            padding: '32px',
            boxShadow: '0 2px 8px rgba(32, 40, 45, 0.06)',
          }}
        >
          {/* Logo & Header */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <PolicyLensLogo size="lg" />
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px', color: '#20282D' }}>
              Sign in to PolicyLens
            </h1>
            <p style={{ color: '#69737A', fontSize: '13px', margin: 0 }}>
              Financial Risk Intelligence Platform
            </p>
          </div>

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#FDF0EF',
                border: '1px solid #E0BFBE',
                color: '#B34F4A',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#69737A', marginBottom: '5px' }}>
                Email address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: '11px', top: '11px', color: '#8E9399' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@policylens.demo"
                  required
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#69737A', marginBottom: '5px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: '11px', top: '11px', color: '#8E9399' }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={inputStyle}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '4px',
                background: '#2F6B62',
                color: '#fff',
                padding: '10px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '13px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
              <ArrowRight size={15} />
            </button>
          </form>

          {/* Admin Login Bypass */}
          <div style={{ marginTop: '20px', borderTop: '1px solid #ECEAE4', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={handleAdminBypass}
              disabled={loading}
              style={{
                width: '100%',
                background: '#F7F6F2',
                border: '1px solid #DDDCD6',
                borderRadius: '6px',
                padding: '9px 12px',
                color: '#20282D',
                fontSize: '12px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#EEF3F0'; e.currentTarget.style.borderColor = '#2F6B62'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#F7F6F2'; e.currentTarget.style.borderColor = '#DDDCD6'; }}
            >
              <KeyRound size={14} style={{ color: '#8A7251' }} />
              <span>Admin Login Bypass</span>
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#69737A' }}>
            Need an account?{' '}
            <Link to="/register" style={{ color: '#2F6B62', textDecoration: 'none', fontWeight: 600 }}>
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
