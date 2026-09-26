import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  RefreshCcw,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Sliders,
  History,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import Title from '../components/Title.jsx';
import { Badge } from '../components/Badge.jsx';
import api from '../services/api.js';

export default function AnomalyDetection() {
  const navigate = useNavigate();
  const [anomalies, setAnomalies] = useState([]);
  const [models, setModels] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState('anomalies');
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [anomRes, modelsRes, runsRes] = await Promise.all([
        api.get('/anomalies/latest'),
        api.get('/anomalies/models'),
        api.get('/anomalies/runs'),
      ]);
      if (anomRes.data) setAnomalies(anomRes.data.filter(a => a.is_anomaly));
      if (modelsRes.data) setModels(modelsRes.data);
      if (runsRes.data) setRuns(runsRes.data);
    } catch (err) {
      console.error('Failed to load anomaly detection data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunAnalysis = async () => {
    setRunningAnalysis(true);
    setToast('');
    try {
      const res = await api.post('/anomalies/analyze');
      setToast(res.message || 'Anomaly scan completed successfully.');
      await fetchData();
    } catch (err) {
      setToast('Analysis failed: ' + (err.message || 'Server error'));
    } finally {
      setRunningAnalysis(false);
      setTimeout(() => setToast(''), 4000);
    }
  };

  const activeModel = models.find(m => m.is_active) || models[0];

  return (
    <>
      <Title
        title="Anomaly Detection"
        text="Isolation Forest algorithm detecting budget and disbursement outliers across financial records."
        action={
          <button
            className="primary"
            onClick={handleRunAnalysis}
            disabled={runningAnalysis}
            style={{ opacity: runningAnalysis ? 0.7 : 1 }}
          >
            <BarChart3 size={15} className={runningAnalysis ? 'spinner' : ''} />
            {runningAnalysis ? 'Running analysis...' : 'Run anomaly scan'}
          </button>
        }
      />

      {toast && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 18px',
            borderRadius: '8px',
            background: toast.includes('failed') ? '#fee2e2' : '#ecfdf5',
            color: toast.includes('failed') ? '#991b1b' : '#065f46',
            border: `1px solid ${toast.includes('failed') ? '#f87171' : '#a7f3d0'}`,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {toast.includes('failed') ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast}</span>
        </div>
      )}

       {/* Summary Banner */}
      <section className="card analysis-hero" style={{ marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <div style={{ background: 'var(--primary-soft)', padding: '10px', borderRadius: '8px', flexShrink: 0 }}>
          <BarChart3 size={24} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <span className="eyebrow">ISOLATION FOREST ANALYSIS</span>
          <h2>Outlier detection</h2>
          <p>
            The analysis engine uses partition trees across utilization rate, processing delay,
            allocation, and transaction velocity to isolate statistical outliers.
            Flagged records require manual review — they are not definitive fraud declarations.
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
            <button
              className="secondary"
              onClick={handleRunAnalysis}
              disabled={runningAnalysis}
              style={{ cursor: 'pointer' }}
            >
              {runningAnalysis ? 'Computing scores...' : 'Run analysis'}
            </button>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('anomalies')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            background: activeTab === 'anomalies' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'anomalies' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          Active Anomalies ({anomalies.length})
        </button>
        <button
          onClick={() => setActiveTab('models')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            background: activeTab === 'models' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'models' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          Model Artifacts & Governance ({models.length})
        </button>
        <button
          onClick={() => setActiveTab('runs')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            background: activeTab === 'runs' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'runs' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          Pipeline Execution Logs ({runs.length})
        </button>
      </div>

      {activeTab === 'anomalies' && (
        <section className="card table">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Region</th>
                <th>Anomaly Score</th>
                <th>Risk Priority</th>
                <th>Primary Outlier Driver</th>
                <th>Detection Time</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    Scanning database records...
                  </td>
                </tr>
              ) : anomalies.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    No anomalous records detected. Run an anomaly scan to evaluate active records.
                  </td>
                </tr>
              ) : (
                anomalies.map((a) => {
                  const rec = a.financial_record || {};
                  return (
                    <tr key={a.id}>
                      <td>
                        <b style={{ color: 'var(--primary)' }}>{rec.record_id || `REC-${a.financial_record_id}`}</b>
                      </td>
                      <td>{rec.region || 'N/A'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                            {a.risk_score?.toFixed(3) || a.isolation_forest_score?.toFixed(3)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <Badge risk={a.risk_level} />
                      </td>
                      <td style={{ maxWidth: '320px', fontSize: '12px', color: '#475569' }}>
                        {a.explanation?.summary || 'Multi-variate divergence in delay and utilization metrics.'}
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>
                        {new Date(a.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="link"
                          onClick={() => {
                            setSelectedAnomaly(a);
                          }}
                        >
                          Explain <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      )}

      {activeTab === 'models' && (
        <section className="card">
          <h3>Registered Model Registry</h3>
          <p>Trained Isolation Forest model versions and hyperparameter configurations</p>
          <div style={{ marginTop: '16px', display: 'grid', gap: '14px' }}>
            {models.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: m.is_active ? '#f0fdf4' : '#f8fafc',
                  border: `1px solid ${m.is_active ? '#86efac' : '#e2e8f0'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sliders size={18} style={{ color: m.is_active ? 'var(--primary)' : 'var(--text-muted)' }} />
                    <b style={{ fontSize: '15px' }}>{m.version}</b>
                    {m.is_active && (
                      <span
                        style={{
                          background: '#16a34a',
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        PRODUCTION ACTIVE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                    Algorithm: <b>{m.algorithm}</b> | Training Samples: <b>{m.sample_count}</b> | Contamination:{' '}
                    <b>{m.contamination}</b>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#94a3b8' }}>
                  Trained on: {new Date(m.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'runs' && (
        <section className="card table">
          <table>
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Model Version</th>
                <th>Records Evaluated</th>
                <th>Anomalies Detected</th>
                <th>Execution Time</th>
                <th>Triggered At</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b>RUN-{r.id}</b>
                  </td>
                  <td>{r.model_version_id || 'Active IF'}</td>
                  <td>{r.records_evaluated}</td>
                  <td>
                    <b style={{ color: r.anomalies_detected > 0 ? '#dc2626' : '#16a34a' }}>
                      {r.anomalies_detected}
                    </b>
                  </td>
                  <td>{r.execution_time_seconds ? `${r.execution_time_seconds.toFixed(2)}s` : '0.12s'}</td>
                  <td style={{ fontSize: '12px', color: '#64748b' }}>
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Anomaly Explainability Modal */}
      {selectedAnomaly && (
        <div className="overlay" onClick={() => setSelectedAnomaly(null)}>
          <section className="detail" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedAnomaly(null)}>✕</button>
            <Badge risk={selectedAnomaly.risk_level} />
            <h2>
              {selectedAnomaly.financial_record?.region} ({selectedAnomaly.financial_record?.record_id})
            </h2>
            <p>Isolation Forest Feature Attribution & Evidence</p>

            <div className="stats">
              <div>
                Score<b>{selectedAnomaly.risk_score?.toFixed(3)}</b>
              </div>
              <div>
                Utilization<b>{selectedAnomaly.financial_record?.utilization_rate}%</b>
              </div>
              <div>
                Delay<b>{selectedAnomaly.financial_record?.delay_days} days</b>
              </div>
            </div>

            <h3 style={{ marginTop: '20px' }}>Explainability Attribution</h3>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
              {selectedAnomaly.explanation?.summary ||
                'Observed metric vector isolates faster than peer distributions due to anomalous variance.'}
            </p>

            {selectedAnomaly.explanation?.features && (
              <div style={{ marginTop: '16px', display: 'grid', gap: '10px' }}>
                {Object.entries(selectedAnomaly.explanation.features).map(([feat, details]) => (
                  <div
                    key={feat}
                    style={{
                      background: '#f8fafc',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span style={{ textTransform: 'capitalize' }}>{feat.replace(/_/g, ' ')}</span>
                      <span style={{ color: details.deviant ? '#dc2626' : '#16a34a' }}>
                        {details.deviant ? 'High Divergence' : 'Normal'}
                      </span>
                    </div>
                    <div style={{ color: '#64748b', marginTop: '4px' }}>
                      Observed: <b>{details.observed}</b> | Baseline: <b>{details.baseline}</b>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              className="primary"
              style={{ marginTop: '24px' }}
              onClick={() => {
                navigate('/cases');
              }}
            >
              Go to Case Investigation <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}
    </>
  );
}
