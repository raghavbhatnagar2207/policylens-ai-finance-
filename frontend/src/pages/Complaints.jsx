import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  Filter,
} from 'lucide-react';
import Title from '../components/Title.jsx';
import { Badge, StatusBadge } from '../components/Badge.jsx';
import api from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Complaints() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('submit');
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);

  // Submit form state
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [submitError, setSubmitError] = useState('');

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await api.get('/complaints/');
      if (res.data) {
        setComplaints(res.data);
      }
    } catch (err) {
      console.error('Failed to load complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'review') {
      fetchComplaints();
    }
  }, [activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || text.trim().length < 10) {
      setSubmitError('Complaint text must be at least 10 characters long.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    setSubmissionResult(null);

    try {
      const res = await api.post('/complaints/', { text: text.trim() });
      if (res.data) {
        setSubmissionResult(res.data);
        setText('');
        toast.success('Complaint submitted and NLP risk triage complete.');
      }
    } catch (err) {
      setSubmitError(err.message || 'Submission failed.');
      toast.error('Submission failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (cid, newStatus) => {
    try {
      await api.patch(`/complaints/${cid}`, { status: newStatus });
      toast.success(`Complaint status changed to ${newStatus}.`);
      fetchComplaints();
    } catch (err) {
      toast.error('Failed to update complaint status: ' + err.message);
    }
  };

  return (
    <>
      <Title
        title="Whistleblower & Citizen Grievance Portal"
        text="Natural language signal extraction routing citizen grievances into early risk detection pipelines."
      />

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('submit')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            background: activeTab === 'submit' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'submit' ? '#fff' : '#64748b',
          }}
        >
          Submit Grievance
        </button>
        <button
          onClick={() => setActiveTab('review')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            background: activeTab === 'review' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'review' ? '#fff' : '#64748b',
          }}
        >
          Grievance Review Desk ({complaints.length})
        </button>
      </div>

      {activeTab === 'submit' ? (
        <section className="card complaint-card" style={{ maxWidth: '800px' }}>
          <div className="complaint-intro">
            <span>
              <MessageSquare size={24} />
            </span>
            <div>
              <h2>Submit a Financial Anomaly Concern</h2>
              <p>
                Describe discrepancies, unexplained construction halts, non-disbursed funds, or suspected
                misappropriation. Our Natural Language Processing pipeline classifies sentiment, language, and
                urgency indicators automatically.
              </p>
            </div>
          </div>

          {submitError && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: '8px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label>
              Concern Description & Evidence
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Example: Moradabad rural road project me ₹25 lakh pass hua tha lekin 6 mahine se kaam ruka hua hai aur contractor gayab hai..."
                style={{ width: '100%', minHeight: '120px' }}
              />
            </label>

            <div className="complaint-actions" style={{ marginTop: '12px' }}>
              <small>Supported: English · हिन्दी (Hindi) · Hinglish</small>
              <button
                type="submit"
                className="primary"
                disabled={submitting || !text.trim()}
              >
                <Send size={16} className={submitting ? 'spinner' : ''} />
                {submitting ? 'Analyzing & Filing...' : 'Submit Grievance'}
              </button>
            </div>
          </form>

          {/* Submission NLP Result Card */}
          {submissionResult && (
            <div
              style={{
                marginTop: '20px',
                padding: '16px',
                borderRadius: 'var(--radius, 8px)',
                background: 'var(--success-soft, #EEF6F1)',
                border: '1px solid #C8DFD1',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success, #3E7D5A)', marginBottom: '8px' }}>
                <CheckCircle2 size={18} />
                <h3 style={{ margin: 0, fontSize: '15px' }}>
                  Grievance Registered — Ref: {submissionResult.reference_id}
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary, #69737A)', margin: '0 0 14px' }}>
                Your grievance has been analyzed by our multilingual NLP engine and routed to the triage queue.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '10px',
                  background: 'var(--surface, #fff)',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-light, #ECEAE4)',
                }}
              >
                <div>
                  <small style={{ color: '#64748b' }}>Detected Language</small>
                  <b style={{ display: 'block', fontSize: '13px', textTransform: 'capitalize' }}>
                    {submissionResult.language || 'English'}
                  </b>
                </div>
                <div>
                  <small style={{ color: '#64748b' }}>Assigned Category</small>
                  <b style={{ display: 'block', fontSize: '13px' }}>
                    {submissionResult.category || 'General'}
                  </b>
                </div>
                <div>
                  <small style={{ color: '#64748b' }}>Urgency Level</small>
                  <b style={{ display: 'block', fontSize: '13px', color: submissionResult.urgency === 'High' ? 'var(--danger, #B34F4A)' : 'var(--primary, #2F6B62)' }}>
                    {submissionResult.urgency || 'Medium'}
                  </b>
                </div>
                <div>
                  <small style={{ color: '#64748b' }}>NLP Confidence</small>
                  <b style={{ display: 'block', fontSize: '13px' }}>
                    {submissionResult.confidence ? `${(submissionResult.confidence * 100).toFixed(0)}%` : '85%'}
                  </b>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="card table">
          <table>
            <thead>
              <tr>
                <th>Reference ID</th>
                <th>Content Excerpt</th>
                <th>Language</th>
                <th>NLP Category</th>
                <th>Urgency</th>
                <th>Status</th>
                <th>Date Received</th>
                <th style={{ textAlign: 'right' }}>Update Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    Loading submitted grievances...
                  </td>
                </tr>
              ) : complaints.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    No citizen complaints submitted yet.
                  </td>
                </tr>
              ) : (
                complaints.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b style={{ color: 'var(--primary)' }}>{c.reference_id}</b>
                    </td>
                    <td style={{ maxWidth: '300px' }}>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text, #20282D)' }}>
                        {c.user_text ? (c.user_text.length > 70 ? c.user_text.slice(0, 70) + '...' : c.user_text) : 'N/A'}
                      </p>
                    </td>
                    <td style={{ textTransform: 'capitalize', fontSize: '12px' }}>{c.language}</td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{c.category}</span>
                    </td>
                    <td>
                      <Badge risk={c.urgency || 'Low'} />
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <select
                        value={c.status}
                        onChange={(e) => handleUpdateStatus(c.id, e.target.value)}
                        style={{ fontSize: '11px', padding: '4px 6px' }}
                      >
                        <option value="Open">Open</option>
                        <option value="Under_Review">Under Review</option>
                        <option value="Investigating">Investigating</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
