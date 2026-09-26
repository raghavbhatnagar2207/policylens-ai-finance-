import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, ArrowRight, X, TrendingDown, Info } from 'lucide-react';
import Title from '../components/Title.jsx';
import { Badge } from '../components/Badge.jsx';
import api from '../services/api.js';

export default function RiskInsights() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [filterDept, setFilterDept] = useState('');

  useEffect(() => {
    async function loadRiskData() {
      setLoading(true);
      try {
        const res = await api.get('/financial-records/', { per_page: 50, sort: 'delay_days', order: 'desc' });
        if (res.data) {
          setRecords(res.data);
        }
      } catch (err) {
        console.error('Failed to load risk insights:', err);
      } finally {
        setLoading(false);
      }
    }
    loadRiskData();
  }, []);

  const filtered = records.filter(r => (!filterDept || r.department === filterDept));
  // Sort high risk first
  const sorted = [...filtered].sort((a, b) => {
    const scoreA = a.latest_anomaly?.risk_score || 0;
    const scoreB = b.latest_anomaly?.risk_score || 0;
    return scoreB - scoreA;
  });

  const departments = [...new Set(records.map(r => r.department))].filter(Boolean);

  return (
    <>
      <Title
        title="Multi-Layer Risk Intelligence"
        text="Explainable hybrid risk scoring combining unsupervised ML detection with domain business logic."
        action={
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            style={{ padding: '8px 12px', minWidth: '180px' }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        }
      />

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #DDDCD6)', borderRadius: 'var(--radius, 8px)', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text, #20282D)' }}>
            <ShieldAlert size={18} style={{ color: 'var(--danger, #B34F4A)' }} />
            <h4 style={{ margin: 0, fontSize: '14px' }}>Algorithmic Outlier Signal</h4>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-secondary, #69737A)', lineHeight: 1.5 }}>
            Isolates records that deviate significantly from empirical multidimensional clusters in fund utilization and delay.
          </p>
        </div>

        <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #DDDCD6)', borderRadius: 'var(--radius, 8px)', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text, #20282D)' }}>
            <AlertTriangle size={18} style={{ color: 'var(--warning, #A66A2B)' }} />
            <h4 style={{ margin: 0, fontSize: '14px' }}>Policy Rule Thresholds</h4>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-secondary, #69737A)', lineHeight: 1.5 }}>
            Flags administrative redlines: Processing delay &gt; 25 days or Fund Absorption &lt; 40% within late quarters.
          </p>
        </div>

        <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #DDDCD6)', borderRadius: 'var(--radius, 8px)', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text, #20282D)' }}>
            <TrendingDown size={18} style={{ color: 'var(--primary, #2F6B62)' }} />
            <h4 style={{ margin: 0, fontSize: '14px' }}>Peer Group Deviation</h4>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-secondary, #69737A)', lineHeight: 1.5 }}>
            Evaluates regional expenditure against historical moving averages to detect localized disbursement stagnation.
          </p>
        </div>
      </section>

      {/* Risk Grid */}
      <section className="riskgrid">
        {loading ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#64748b' }}>
            Loading risk matrices...
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#64748b' }}>
            No records match the selected department.
          </div>
        ) : (
          sorted.map((r) => {
            const anom = r.latest_anomaly || null;
            const riskLevel = anom?.risk_level || null;
            const score = anom?.risk_score != null ? anom.risk_score.toFixed(3) : 'N/A';

            return (
              <div className="riskcard" key={r.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Badge risk={riskLevel} />
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>{r.department}</span>
                </div>

                <h3>
                  {r.region} <small style={{ color: 'var(--primary)' }}>{r.record_id}</small>
                </h3>
                <p style={{ minHeight: '36px' }}>
                  {anom?.explanation?.summary ||
                    `Allocation ₹${r.allocation}K, ${r.utilization_rate}% utilized with ${r.delay_days} days processing lag.`}
                </p>

                <label>
                  Utilization: <b>{r.utilization_rate}%</b>
                  <i style={{ width: `${Math.min(r.utilization_rate, 100)}%`, background: r.utilization_rate < 40 ? '#dc2626' : '#16a34a' }} />
                </label>

                <label>
                  Processing Delay: <b>{r.delay_days} days</b>
                  <i style={{ width: `${Math.min(r.delay_days * 2.5, 100)}%`, background: r.delay_days > 20 ? '#dc2626' : '#d97706' }} />
                </label>

                <footer>
                  <span>
                    Composite Score: <b style={{ color: riskLevel === 'High' ? 'var(--danger, #B34F4A)' : (riskLevel === 'Medium' ? 'var(--warning, #A66A2B)' : 'var(--text, #20282D)') }}>{score}</b>
                  </span>
                  <button onClick={() => setSelectedRecord(r)}>Why flagged?</button>
                </footer>
              </div>
            );
          })
        )}
      </section>

      {/* Explainability Drawer */}
      {selectedRecord && (
        <div className="overlay" onClick={() => setSelectedRecord(null)}>
          <section className="detail" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedRecord(null)}>
              <X size={20} />
            </button>
            <Badge risk={selectedRecord.latest_anomaly?.risk_level || null} />
            <h2>{selectedRecord.region}</h2>
            <p>
              {selectedRecord.record_id} · {selectedRecord.department}
            </p>

            <div className="stats">
              <div>
                Allocation<b>₹{selectedRecord.allocation}K</b>
              </div>
              <div>
                Utilization<b>{selectedRecord.utilization_rate}%</b>
              </div>
              <div>
                Delay<b>{selectedRecord.delay_days} days</b>
              </div>
            </div>

            <h3 style={{ marginTop: '20px' }}>Transparent Flagging Rationale</h3>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
              {selectedRecord.latest_anomaly?.explanation?.summary ||
                `Record deviates from the normal peer group. The delay of ${selectedRecord.delay_days} days is elevated compared to the cohort average.`}
            </p>

            <div style={{ background: 'var(--bg, #F7F6F2)', border: '1px solid var(--border-light, #ECEAE4)', padding: '14px', borderRadius: '6px', marginTop: '16px', fontSize: '13px' }}>
              <div style={{ fontWeight: 600, color: 'var(--text, #20282D)', marginBottom: '8px' }}>
                Rule Engine Evaluated Triggers:
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#475569', display: 'grid', gap: '6px' }}>
                <li>
                  Utilization status:{' '}
                  <b>
                    {selectedRecord.utilization_rate < 40 ? 'Depressed absorption (<40%)' : 'Normal range'}
                  </b>
                </li>
                <li>
                  Delay status:{' '}
                  <b>
                    {selectedRecord.delay_days > 25
                      ? 'Severe processing backlog (>25 days)'
                      : selectedRecord.delay_days > 15
                      ? 'Moderate latency'
                      : 'Acceptable velocity'}
                  </b>
                </li>
                <li>
                  Historical baseline comparison:{' '}
                  <b>
                    Deviation of{' '}
                    {Math.abs(selectedRecord.utilization - (selectedRecord.historical_average || selectedRecord.utilization))}K
                    from regional norms.
                  </b>
                </li>
              </ul>
            </div>

            <button
              className="primary"
              style={{ marginTop: '24px' }}
              onClick={() => setSelectedRecord(null)}
            >
              Close Rationale
            </button>
          </section>
        </div>
      )}
    </>
  );
}
