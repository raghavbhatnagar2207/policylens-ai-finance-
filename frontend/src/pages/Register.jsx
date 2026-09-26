import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, User, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../services/api.js';
import PolicyLensLogo from '../components/PolicyLensLogo.jsx';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', { name, email, password });
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Registration failed.');
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
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <PolicyLensLogo size="lg" />
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px', color: '#20282D' }}>
              Create an account
            </h1>
            <p style={{ color: '#69737A', fontSize: '13px', margin: 0 }}>
              Join PolicyLens — Financial Risk Intelligence
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

          {success ? (
            <div
              style={{
                textAlign: 'center',
                padding: '20px',
                background: '#EEF6F1',
                border: '1px solid #C8DFD1',
                borderRadius: '8px',
                color: '#3E7D5A',
              }}
            >
              <CheckCircle2 size={32} style={{ margin: '0 auto 10px', color: '#3E7D5A' }} />
              <h3 style={{ margin: '0 0 4px', color: '#20282D', fontSize: '15px' }}>Registration successful</h3>
              <p style={{ fontSize: '13px', margin: 0, color: '#69737A' }}>
                Redirecting you to sign in...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#69737A', marginBottom: '5px' }}>
                  Full name
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: '11px', top: '11px', color: '#8E9399' }} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Priya Singh"
                    required
                    style={inputStyle}
                  />
                </div>
              </div>

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
                    placeholder="priya@department.gov.in"
                    required
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#69737A', marginBottom: '5px' }}>
                  Password (min 8 characters)
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

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#69737A', marginBottom: '5px' }}>
                  Confirm password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: '11px', top: '11px', color: '#8E9399' }} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                {loading ? 'Creating account...' : 'Register'}
                <ArrowRight size={15} />
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#69737A' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#2F6B62', textDecoration: 'none', fontWeight: 600 }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
