import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  BarChart2,
  Coins,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Briefcase,
  Activity,
} from 'lucide-react';
import Title from '../components/Title.jsx';
import { Badge } from '../components/Badge.jsx';
import api from '../services/api.js';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [data, setData] = useState(null);
  const [recentAnomalies, setRecentAnomalies] = useState([]);
  const [toast, setToast] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [sumRes, anomRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/anomalies/latest'),
      ]);
      if (sumRes.data) {
        setData(sumRes.data);
      }
      if (anomRes.data) {
        setRecentAnomalies(anomRes.data.filter(a => a.is_anomaly).slice(0, 5));
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    setToast('');
    try {
      const res = await api.post('/anomalies/analyze');
      setToast(res.message || 'Analysis complete. Risk indicators refreshed.');
      await fetchDashboardData();
    } catch (err) {
      setToast('Analysis failed: ' + (err.message || 'Server error'));
    } finally {
      setAnalyzing(false);
      setTimeout(() => setToast(''), 4000);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} className="spinner" style={{ margin: '0 auto 10px', color: 'var(--primary)' }} />
          <p style={{ fontSize: '13px', fontWeight: 500 }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const fin = data?.financial || {};
  const risk = data?.risk || {};
  const riskDist = risk.risk_distribution || {};

  const kpis = [
    {
      title: 'Total allocation',
      val: `₹${(fin.total_allocated / 1000).toFixed(2)}M`,
      sub: `${fin.record_count || 0} financial records`,
      icon: Coins,
    },
    {
      title: 'Total utilization',
      val: `₹${(fin.total_utilized / 1000).toFixed(2)}M`,
      sub: `${fin.utilization_pct || 0}% overall utilization`,
      icon: TrendingUp,
    },
    {
      title: 'Detected anomalies',
      val: `${risk.anomaly_count || 0}`,
      sub: 'Outliers requiring review',
      icon: ShieldAlert,
    },
    {
      title: 'Open cases',
      val: `${risk.open_cases || 0}`,
      sub: 'Under investigation',
      icon: Briefcase,
    },
    {
      title: 'Average delay',
      val: `${fin.avg_delay || 0} days`,
      sub: 'Processing lag',
      icon: Clock,
    },
  ];

  const pieData = [
    { name: 'Low', value: riskDist.Low || 0, color: '#2E6D5D' },
    { name: 'Medium', value: riskDist.Medium || 0, color: '#A8682C' },
    { name: 'High', value: riskDist.High || 0, color: '#B84848' },
    { name: 'Critical', value: riskDist.Critical || 0, color: '#6E2828' },
  ].filter(d => d.value > 0);

  const regionalBars = (data?.regions || []).map(r => ({
    region: r.region,
    allocation: r.allocation,
    utilization: r.utilization,
    rate: r.utilization_rate,
  }));

  const trendData = (data?.trends || []).map(t => ({
    month: t.month,
    Allocated: t.allocation,
    Utilized: t.utilization,
  }));

  return (
    <>
      <Title
        title="Financial overview"
        text="Monitor allocation, utilization, anomalies, and open review cases."
        action={
          <button
            className="primary"
            onClick={handleRunAnalysis}
            disabled={analyzing}
            style={{ opacity: analyzing ? 0.7 : 1 }}
          >
            <BarChart2 size={15} className={analyzing ? 'spinner' : ''} />
            {analyzing ? 'Running analysis...' : 'Run analysis'}
          </button>
        }
      />

      {toast && (
        <div
          style={{
            marginBottom: '14px',
            padding: '10px 16px',
            borderRadius: '6px',
            background: toast.includes('failed') ? 'var(--danger-soft)' : 'var(--success-soft)',
            color: toast.includes('failed') ? 'var(--danger)' : 'var(--success)',
            border: `1px solid ${toast.includes('failed') ? '#E0BFBE' : '#C8DFD1'}`,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {toast.includes('failed') ? <AlertTriangle size={15} /> : <CheckCircle size={15} />}
          <span>{toast}</span>
        </div>
      )}

      {/* Unified KPI Strip (Matching screenshot) */}
      <section className="kpis-strip">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div className="kpi-cell" key={k.title}>
              <Icon size={24} className="kpi-icon" strokeWidth={1.75} />
              <div className="kpi-body">
                <small>{k.title}</small>
                <h2>{k.val}</h2>
                <p>{k.sub}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Grid 1: Bar Chart & Pie Chart */}
      <div className="grid">
        <section className="card chart">
          <div className="chart-header-row">
            <div>
              <h3>Regional allocation vs utilization</h3>
              <p>Budget distribution compared to expenditure (₹ thousands)</p>
            </div>
            <div className="chart-legend-top">
              <span className="legend-item">
                <span className="legend-dot allocation" /> Allocation
              </span>
              <span className="legend-item">
                <span className="legend-dot utilization" /> Utilization
              </span>
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={regionalBars} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EBE8E0" />
                <XAxis
                  dataKey="region"
                  tick={{ fontSize: 11, fill: '#707A80' }}
                  axisLine={{ stroke: '#DDDCD6' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#707A80' }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 2200]}
                  ticks={[0, 550, 1100, 1650, 2200]}
                />
                <Tooltip
                  formatter={(value) => `₹${value}K`}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E3E0D8',
                    borderRadius: '6px',
                    fontSize: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                />
                <Bar dataKey="allocation" name="Allocation" fill="#BFB2A2" radius={[2, 2, 0, 0]} maxBarSize={22} />
                <Bar dataKey="utilization" name="Utilization" fill="#28594D" radius={[2, 2, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card chart">
          <div className="card-header">
            <h3>Risk distribution</h3>
            <p>Records classified by anomaly and risk score levels</p>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={3}
                  stroke="none"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E3E0D8',
                    borderRadius: '6px',
                    fontSize: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-legend">
              <span className="legend-item"><span className="legend-dot low" /> Low</span>
              <span className="legend-item"><span className="legend-dot medium" /> Medium</span>
              <span className="legend-item"><span className="legend-dot high" /> High</span>
              <span className="legend-item"><span className="legend-dot critical" /> Critical</span>
            </div>
          </div>
        </section>
      </div>

      {/* Grid 2: Monthly Trends & Recent Alerts */}
      <div className="grid">
        <section className="card chart">
          <div className="card-header">
            <h3>Expenditure trend</h3>
            <p>Monthly disbursement and absorption</p>
          </div>
          <div className="chart-container">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendData} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EBE8E0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#707A80' }} axisLine={{ stroke: '#DDDCD6' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#707A80' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => `₹${v}K`}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E3E0D8',
                      borderRadius: '6px',
                      fontSize: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="Allocated" stroke="#BFB2A2" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Utilized" stroke="#24584C" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
                No historical trend data available.
              </div>
            )}
          </div>
        </section>

        <section className="card alerts">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Flagged records</h3>
              <p>Top outliers requiring review</p>
            </div>
            <button className="link" onClick={() => navigate('/anomaly-detection')}>
              All anomalies <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ marginTop: '10px' }}>
            {recentAnomalies.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No active anomalies detected.
              </div>
            ) : (
              recentAnomalies.map((a) => (
                <div className="alert" key={a.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <ShieldAlert size={16} style={{ color: a.risk_level === 'High' ? 'var(--danger)' : 'var(--warning)', marginTop: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b style={{ fontSize: '13px', margin: 0 }}>
                        {a.financial_record?.region || 'Region'} · {a.financial_record?.record_id || `ID-${a.id}`}
                      </b>
                      <Badge risk={a.risk_level} />
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {a.explanation?.summary || `Anomaly score: ${a.risk_score}`}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Summary Banner */}
      <section className="insight">
        <Activity size={20} style={{ flexShrink: 0 }} />
        <div>
          <b>Analysis summary</b>
          <p>
            {fin.record_count || 0} financial records evaluated across 10 regions.
            {risk.anomaly_count || 0} anomalies flagged.
            {risk.open_cases || 0} cases currently under investigation.
          </p>
        </div>
        <button onClick={() => navigate('/cases')}>
          Open cases
        </button>
      </section>
    </>
  );
}
