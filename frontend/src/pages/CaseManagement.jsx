import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck,
  AlertTriangle,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  User,
  MessageSquare,
  ArrowRight,
  X,
  Send,
  ShieldAlert,
} from 'lucide-react';
import Title from '../components/Title.jsx';
import { Badge, StatusBadge } from '../components/Badge.jsx';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function CaseManagement() {
  const toast = useToast();
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseDetailLoading, setCaseDetailLoading] = useState(false);
  const [resolutionText, setResolutionText] = useState('');

  // New Note state
  const [newNote, setNewNote] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  // Status update state
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // New Case Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [financialRecords, setFinancialRecords] = useState([]);
  const [newCaseRecordId, setNewCaseRecordId] = useState('');
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCasePriority, setNewCasePriority] = useState('High');
  const [newCaseDesc, setNewCaseDesc] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const res = await api.get('/cases/', params);
      if (res.data) {
        setCases(res.data);
      }
    } catch (err) {
      console.error('Error fetching cases:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Load Case Details with Events
  const handleSelectCase = async (c) => {
    setSelectedCase(c);
    setCaseDetailLoading(true);
    try {
      const res = await api.get(`/cases/${c.id}`);
      if (res.data) {
        setSelectedCase(res.data);
      }
    } catch (err) {
      console.error('Failed to load case detail:', err);
    } finally {
      setCaseDetailLoading(false);
    }
  };

  // Add Case Note / Timeline Event
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedCase) return;
    setNoteLoading(true);
    try {
      await api.post(`/cases/${selectedCase.id}/events`, {
        action: 'NOTE_ADDED',
        comment: newNote.trim(),
      });
      setNewNote('');
      // Reload case details
      const res = await api.get(`/cases/${selectedCase.id}`);
      if (res.data) setSelectedCase(res.data);
      toast.success('Note recorded on case timeline.');
    } catch (err) {
      toast.error('Failed to add note: ' + err.message);
    } finally {
      setNoteLoading(false);
    }
  };

  // Change Case Status
  const handleStatusChange = async (nextStatus) => {
    if (!selectedCase) return;
    if ((nextStatus === 'Resolved' || nextStatus === 'Closed') && !resolutionText.trim() && !selectedCase.resolution) {
      toast.warning('Resolution summary is required before transitioning to Resolved or Closed.');
      return;
    }

    setUpdatingStatus(true);
    try {
      const payload = { status: nextStatus };
      if (resolutionText.trim()) payload.resolution = resolutionText.trim();
      await api.patch(`/cases/${selectedCase.id}`, payload);
      const res = await api.get(`/cases/${selectedCase.id}`);
      if (res.data) setSelectedCase(res.data);
      toast.success(`Case transitioned to ${nextStatus}.`);
      setResolutionText('');
      fetchCases();
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Open Create Case Modal & Load Records
  const handleOpenCreateModal = async () => {
    setShowCreateModal(true);
    try {
      const res = await api.get('/financial-records/', { per_page: 50 });
      if (res.data) setFinancialRecords(res.data);
    } catch (err) {
      toast.error('Failed to load financial records: ' + err.message);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newCaseRecordId || !newCaseTitle.trim()) {
      toast.warning('Please select a record and provide a case title.');
      return;
    }
    setCreateLoading(true);
    try {
      await api.post('/cases/', {
        record_id: Number(newCaseRecordId),
        title: newCaseTitle.trim(),
        priority: newCasePriority,
        description: newCaseDesc.trim(),
      });
      setShowCreateModal(false);
      setNewCaseTitle('');
      setNewCaseDesc('');
      setNewCaseRecordId('');
      toast.success('Investigation case opened successfully.');
      fetchCases();
    } catch (err) {
      toast.error('Failed to create case: ' + err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <>
      <Title
        title="Human-in-the-Loop Case Management"
        text="Investigate, triage, document evidence, and track accountability for flagged financial anomalies."
        action={
          <button className="primary" onClick={handleOpenCreateModal}>
            <Plus size={16} /> New Case Investigation
          </button>
        }
      />

      {/* Filters Bar */}
      <section
        className="card"
        style={{
          marginBottom: '16px',
          padding: '14px 20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px' }}>
          <Filter size={16} />
          <span>Filters:</span>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ minWidth: '150px' }}
        >
          <option value="">All Statuses</option>
          <option value="New">New</option>
          <option value="Assigned">Assigned</option>
          <option value="Under Review">Under Review</option>
          <option value="Needs Information">Needs Information</option>
          <option value="Escalated">Escalated</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          style={{ minWidth: '140px' }}
        >
          <option value="">All Priorities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </section>

      {/* Cases List */}
      <section className="card table">
        <table>
          <thead>
            <tr>
              <th>Case Number</th>
              <th>Title / Scope</th>
              <th>Linked Record</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Opened Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  Loading active cases...
                </td>
              </tr>
            ) : cases.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  No risk cases match the current filter criteria.
                </td>
              </tr>
            ) : (
              cases.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b style={{ color: 'var(--primary)' }}>{c.case_number}</b>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text, #20282D)' }}>{c.title}</div>
                    <small style={{ color: '#64748b', fontSize: '11px' }}>
                      {c.description ? c.description.slice(0, 55) + '...' : 'No description'}
                    </small>
                  </td>
                  <td>
                    {c.financial_record ? (
                      <span>
                        <b>{c.financial_record.region}</b> ({c.financial_record.record_id})
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td>
                    <Badge risk={c.priority} />
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>{c.assignee?.name || 'Unassigned'}</td>
                  <td style={{ fontSize: '12px', color: '#64748b' }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="link" onClick={() => handleSelectCase(c)}>
                      Manage <ArrowRight size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Case Management Drawer / Modal */}
      {selectedCase && (
        <div className="overlay" onClick={() => setSelectedCase(null)}>
          <section
            className="detail"
            style={{ width: 'min(640px, 100%)', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setSelectedCase(null)}>
              <X size={20} />
            </button>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Badge risk={selectedCase.priority} />
              <StatusBadge status={selectedCase.status} />
            </div>

            <h2 style={{ margin: '12px 0 4px', fontSize: '20px' }}>{selectedCase.title}</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              Case Ref: <b>{selectedCase.case_number}</b> · Created by{' '}
              <b>{selectedCase.creator?.name || 'Automated Monitor'}</b> on{' '}
              {new Date(selectedCase.created_at).toLocaleString()}
            </p>

            {/* Workflow Status Selector */}
            <div
              style={{
                marginTop: '16px',
                padding: '14px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                Workflow Stage Transition:
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['New', 'Assigned', 'Under Review', 'Needs Information', 'Escalated', 'Resolved', 'Closed'].map((st) => (
                  <button
                    key={st}
                    disabled={updatingStatus || selectedCase.status === st}
                    onClick={() => handleStatusChange(st)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: selectedCase.status === st ? 'default' : 'pointer',
                      background: selectedCase.status === st ? 'var(--primary)' : '#fff',
                      color: selectedCase.status === st ? '#fff' : '#475569',
                      border: `1px solid ${selectedCase.status === st ? 'var(--primary)' : '#cbd5e1'}`,
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: '10px' }}>
                <input
                  type="text"
                  placeholder="Resolution notes (required if moving to Resolved or Closed)..."
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  style={{ width: '100%', fontSize: '12px', padding: '6px 10px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Linked Financial Record */}
            {selectedCase.financial_record && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '14px',
                  background: 'var(--primary-soft, #EEF3F0)',
                  border: '1px solid var(--border, #DDDCD6)',
                  borderRadius: '6px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary, #2F6B62)', marginBottom: '4px' }}>
                  Linked Financial Record: {selectedCase.financial_record.region} (
                  {selectedCase.financial_record.record_id})
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text, #20282D)' }}>
                  <span>
                    Alloc: <b>₹{selectedCase.financial_record.allocation}K</b>
                  </span>
                  <span>
                    Util: <b>{selectedCase.financial_record.utilization_rate}%</b>
                  </span>
                  <span>
                    Delay: <b>{selectedCase.financial_record.delay_days} days</b>
                  </span>
                </div>
              </div>
            )}

            {/* Case Hypotheses / Description */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Investigation Hypothesis & Brief:
              </div>
              <p style={{ fontSize: '13px', color: '#334155', background: '#f8fafc', padding: '12px', borderRadius: '8px', margin: 0 }}>
                {selectedCase.description || 'No initial hypothesis specified.'}
              </p>
            </div>

            {/* Timeline & Notes Log */}
            <div style={{ marginTop: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text, #20282D)', marginBottom: '10px' }}>
                Audit Log &amp; Investigator Notes
              </div>

              <div
                style={{
                  flex: 1,
                  maxHeight: '220px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-light, #ECEAE4)',
                  borderRadius: '6px',
                  padding: '12px',
                  background: '#fff',
                }}
              >
                {selectedCase.events && selectedCase.events.length > 0 ? (
                  selectedCase.events.map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        paddingBottom: '10px',
                        marginBottom: '10px',
                        borderBottom: '1px solid var(--border-light, #ECEAE4)',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                        <b>{ev.actor?.name || 'System Operator'}</b>
                        <small>{new Date(ev.created_at).toLocaleString()}</small>
                      </div>
                      <div style={{ color: 'var(--text, #20282D)', marginTop: '4px' }}>{ev.comment}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px', fontSize: '12px' }}>
                    No audit timeline events yet. Add a note below.
                  </div>
                )}
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Record an investigator note or action..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  className="primary"
                  disabled={noteLoading || !newNote.trim()}
                  style={{ padding: '0 16px' }}
                >
                  <Send size={15} /> Add Note
                </button>
              </form>
            </div>
          </section>
        </div>
      )}

      {/* Create Case Modal */}
      {showCreateModal && (
        <div className="overlay" onClick={() => setShowCreateModal(false)}>
          <div
            style={{
              width: '90%',
              maxWidth: '540px',
              background: '#fff',
              margin: 'auto',
              borderRadius: 'var(--radius-lg, 10px)',
              border: '1px solid var(--border, #DDDCD6)',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Initiate Risk Investigation Case</h2>
              <button onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Target Financial Record
                </label>
                <select
                  value={newCaseRecordId}
                  onChange={(e) => setNewCaseRecordId(e.target.value)}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">Select a record to investigate...</option>
                  {financialRecords.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.record_id} · {r.region} · {r.department} (₹{r.allocation}K)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Case Title
                </label>
                <input
                  type="text"
                  value={newCaseTitle}
                  onChange={(e) => setNewCaseTitle(e.target.value)}
                  placeholder="e.g. Audit Moradabad Bridge Repair Fund Divergence"
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Priority
                </label>
                <select
                  value={newCasePriority}
                  onChange={(e) => setNewCasePriority(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Investigation Brief & Evidence
                </label>
                <textarea
                  value={newCaseDesc}
                  onChange={(e) => setNewCaseDesc(e.target.value)}
                  placeholder="Summarize the core reason for opening this case..."
                  rows={4}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={createLoading}>
                  {createLoading ? 'Opening...' : 'Open Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
