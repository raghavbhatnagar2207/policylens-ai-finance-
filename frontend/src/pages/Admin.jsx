import React, { useState, useEffect } from 'react';
import { Shield, Users, FileCheck, Activity, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import Title from '../components/Title.jsx';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Admin() {
  const toast = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('users');

  // Users state
  const [users, setUsers] = useState([]);
  const [userLoading, setUserLoading] = useState(false);

  // Audit Logs state
  const [logs, setLogs] = useState([]);
  const [logLoading, setLogLoading] = useState(false);

  // ML Training state
  const [models, setModels] = useState([]);
  const [retraining, setRetraining] = useState(false);
  const [trainMsg, setTrainMsg] = useState('');

  const fetchUsers = async () => {
    setUserLoading(true);
    try {
      const res = await api.get('/admin/users');
      if (res.data) setUsers(res.data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setUserLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLogLoading(true);
    try {
      const res = await api.get('/admin/audit-logs', { per_page: 50 });
      if (res.data) setLogs(res.data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLogLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await api.get('/anomalies/models');
      if (res.data) setModels(res.data);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'logs') fetchLogs();
    else if (activeTab === 'models') fetchModels();
  }, [activeTab]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.patch(`/admin/users/${userId}`, { role: newRole });
      toast.success(`Role changed to ${newRole}.`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to change role: ' + err.message);
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    try {
      await api.patch(`/admin/users/${userId}`, { is_active: !currentStatus });
      toast.success(`User status updated.`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  const handleRetrainModel = async () => {
    setRetraining(true);
    setTrainMsg('');
    try {
      const res = await api.post('/anomalies/train');
      const msg = res.message || 'Model successfully trained and deployed to production.';
      setTrainMsg(msg);
      toast.success(msg);
      fetchModels();
    } catch (err) {
      const errMsg = 'Training error: ' + (err.message || 'Server error');
      setTrainMsg(errMsg);
      toast.error(errMsg);
    } finally {
      setRetraining(false);
    }
  };

  return (
    <>
      <Title
        title="Administrative & Governance Console"
        text="Role-based access control, cryptographic audit logging, and machine learning lifecycle management."
      />

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            background: activeTab === 'users' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'users' ? '#fff' : '#64748b',
          }}
        >
          User & Role Access ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            background: activeTab === 'logs' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'logs' ? '#fff' : '#64748b',
          }}
        >
          System Audit Trail ({logs.length})
        </button>
        <button
          onClick={() => setActiveTab('models')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            background: activeTab === 'models' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'models' ? '#fff' : '#64748b',
          }}
        >
          ML Model Governance
        </button>
      </div>

      {activeTab === 'users' && (
        <section className="card table">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email Address</th>
                <th>RBAC Role</th>
                <th>Status</th>
                <th>Created Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {userLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    Loading user directory...
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <b style={{ color: 'var(--text, #20282D)' }}>{u.name}</b>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      >
                        {['Admin', 'Manager', 'Analyst', 'Reviewer', 'Auditor'].map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: u.is_active ? '#ecfdf5' : '#fee2e2',
                          color: u.is_active ? '#065f46' : '#991b1b',
                        }}
                      >
                        {u.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleStatusToggle(u.id, u.is_active)}
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: u.is_active ? '#dc2626' : '#16a34a',
                          background: 'none',
                        }}
                      >
                        {u.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      {activeTab === 'logs' && (
        <section className="card table">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target Type</th>
                <th>Target Identifier</th>
              </tr>
            </thead>
            <tbody>
              {logLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    Fetching immutable audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    No audit records recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td>
                      <b>{l.actor?.name || `UID-${l.actor_id || 'System'}`}</b>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          background: '#f1f5f9',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          color: '#0f172a',
                        }}
                      >
                        {l.action}
                      </span>
                    </td>
                    <td>{l.target_type || 'System'}</td>
                    <td>{l.target_id || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      {activeTab === 'models' && (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: 0 }}>Model Training & Lifecycle Management</h3>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
                Retrain the unsupervised Isolation Forest model over fresh financial records in the database.
              </p>
            </div>
            <button
              className="primary"
              onClick={handleRetrainModel}
              disabled={retraining}
            >
              <Activity size={16} className={retraining ? 'spinner' : ''} />
              {retraining ? 'Training Estimator...' : 'Retrain Production Model'}
            </button>
          </div>

          {trainMsg && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                background: trainMsg.includes('error') ? '#fee2e2' : '#ecfdf5',
                color: trainMsg.includes('error') ? '#991b1b' : '#065f46',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {trainMsg.includes('error') ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              <span>{trainMsg}</span>
            </div>
          )}

          <div style={{ display: 'grid', gap: '12px' }}>
            {models.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  background: m.is_active ? '#f0fdf4' : '#f8fafc',
                  border: `1px solid ${m.is_active ? '#86efac' : '#e2e8f0'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <b style={{ fontSize: '14px' }}>{m.version}</b>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Algorithm: <b>{m.algorithm}</b> | Training Samples: <b>{m.sample_count}</b> | Contamination:{' '}
                    <b>{m.contamination}</b>
                  </div>
                </div>
                <div>
                  {m.is_active ? (
                    <span
                      style={{
                        background: '#16a34a',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      ACTIVE PRODUCTION
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Archived</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
