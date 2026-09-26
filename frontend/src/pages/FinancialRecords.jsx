import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  Download,
  Upload,
  ArrowRight,
  X,
  Plus,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import Title from '../components/Title.jsx';
import { Badge, StatusBadge } from '../components/Badge.jsx';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function FinancialRecords() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole } = useAuth();

  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState({ page: 1, per_page: 25, total_pages: 1, total_items: 0 });
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [regionFilter, setRegionFilter] = useState(searchParams.get('region') || '');
  const [riskFilter, setRiskFilter] = useState(searchParams.get('risk') || '');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  // Import Modal state
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  // Create Case Modal state
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [caseTitle, setCaseTitle] = useState('');
  const [casePriority, setCasePriority] = useState('High');
  const [caseDescription, setCaseDescription] = useState('');
  const [caseLoading, setCaseLoading] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        per_page: 15,
        q: search,
        region: regionFilter,
        risk: riskFilter,
        sort: sortBy,
        order: sortDir,
      };
      const res = await api.get('/financial-records/', params);
      if (res.data) {
        setRecords(res.data);
        if (res.meta) setMeta(res.meta);
      }
    } catch (err) {
      console.error('Error fetching records:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, regionFilter, riskFilter, sortBy, sortDir]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Open Record Details
  const handleOpenDetail = async (rec) => {
    setSelectedRecord(rec);
    setDetailLoading(true);
    try {
      const res = await api.get(`/financial-records/${rec.id}`);
      if (res.data) {
        setSelectedRecord(res.data);
      }
    } catch {
      // Keep basic data
    } finally {
      setDetailLoading(false);
    }
  };

  // CSV Export
  const handleExport = async () => {
    try {
      const res = await api.get('/financial-records/export', {
        region: regionFilter,
        risk: riskFilter,
      });
      if (res.blob) {
        const url = window.URL.createObjectURL(res.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename || 'financial_records.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Financial records exported successfully.');
      }
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    }
  };

  // CSV Upload & Preview
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportError('');
    setImportLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.upload('/imports/upload', fd);
      if (res.data) {
        setImportPreview(res.data);
      }
    } catch (err) {
      setImportError(err.message || 'CSV upload failed.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview?.import_id) return;
    setImportLoading(true);
    try {
      const res = await api.post(`/imports/${importPreview.import_id}/confirm`);
      setImportSuccess(res.message || 'Records imported successfully.');
      setTimeout(() => {
        setShowImport(false);
        setImportPreview(null);
        setImportFile(null);
        setImportSuccess('');
        fetchRecords();
      }, 1500);
    } catch (err) {
      setImportError(err.message || 'Failed to confirm import.');
    } finally {
      setImportLoading(false);
    }
  };

  // Create Case for selected record
  const handleCreateCase = async () => {
    if (!selectedRecord) return;
    setCaseLoading(true);
    try {
      await api.post('/cases/', {
        record_id: selectedRecord.id,
        title: caseTitle || `Investigation: ${selectedRecord.region} (${selectedRecord.record_id})`,
        priority: casePriority,
        description: caseDescription || `Flagged for review due to abnormal financial metrics: Allocation ₹${selectedRecord.allocation}K, Utilization ${selectedRecord.utilization_rate}%, Delay ${selectedRecord.delay_days} days.`,
      });
      setShowCaseModal(false);
      toast.success('Risk investigation case created successfully.');
      fetchRecords();
    } catch (err) {
      toast.error('Failed to create case: ' + err.message);
    } finally {
      setCaseLoading(false);
    }
  };

  const money = (n) => '₹' + Number(n).toLocaleString() + 'K';

  return (
    <>
      <Title
        title="Financial Records Database"
        text="Audited public fund allocations, expenditure velocity, and contextual anomaly flags."
        action={
          <div style={{ display: 'flex', gap: '10px' }}>
            {hasRole('Admin', 'Manager') && (
              <button
                className="primary"
                onClick={() => setShowImport(true)}
                style={{ background: 'var(--secondary, #8A7251)' }}
              >
                <Upload size={16} /> Import CSV
              </button>
            )}
            <button className="primary" onClick={handleExport}>
              <Download size={16} /> Export CSV
            </button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <section
        className="card"
        style={{
          marginBottom: '16px',
          padding: '16px 20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
          <Search size={16} style={{ color: '#64748b' }} />
          <input
            type="text"
            placeholder="Filter by ID, region, department..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ width: '100%', padding: '8px 10px' }}
          />
        </div>

        <select
          value={regionFilter}
          onChange={(e) => {
            setRegionFilter(e.target.value);
            setPage(1);
          }}
          style={{ minWidth: '140px' }}
        >
          <option value="">All Regions</option>
          {['Moradabad', 'Rampur', 'Sambhal', 'Amroha', 'Bijnor', 'Meerut', 'Bareilly', 'Lucknow', 'Agra', 'Varanasi'].map(
            (r) => (
              <option key={r} value={r}>
                {r}
              </option>
            )
          )}
        </select>

        <select
          value={riskFilter}
          onChange={(e) => {
            setRiskFilter(e.target.value);
            setPage(1);
          }}
          style={{ minWidth: '120px' }}
        >
          <option value="">All Risk Levels</option>
          <option value="Low">Low Risk</option>
          <option value="Medium">Medium Risk</option>
          <option value="High">High Risk</option>
          <option value="Critical">Critical Risk</option>
        </select>

        <select
          value={`${sortBy}:${sortDir}`}
          onChange={(e) => {
            const [b, d] = e.target.value.split(':');
            setSortBy(b);
            setSortDir(d);
            setPage(1);
          }}
          style={{ minWidth: '150px' }}
        >
          <option value="date:desc">Newest First</option>
          <option value="date:asc">Oldest First</option>
          <option value="allocation:desc">Allocation (High → Low)</option>
          <option value="utilization_rate:asc">Utilization % (Low → High)</option>
          <option value="delay_days:desc">Delay (High → Low)</option>
        </select>
      </section>

      {/* Main Table */}
      <section className="card table">
        <table>
          <thead>
            <tr>
              <th>Record ID</th>
              <th>Region</th>
              <th>Department / Scheme</th>
              <th>Allocation</th>
              <th>Utilization Rate</th>
              <th>Delay</th>
              <th>Risk Level</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  Loading database records...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  No financial records match the current filters.
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const latestAnomaly = r.latest_anomaly;
                const riskLevel = latestAnomaly?.risk_level || 'Low';
                return (
                  <tr key={r.id}>
                    <td>
                      <b style={{ color: 'var(--primary)' }}>{r.record_id}</b>
                    </td>
                    <td>{r.region}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.department}</div>
                      <small style={{ color: '#64748b', fontSize: '11px' }}>{r.category}</small>
                    </td>
                    <td>{money(r.allocation)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{r.utilization_rate}%</span>
                        <div
                          style={{
                            width: '45px',
                            height: '5px',
                            background: '#e2e8f0',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(r.utilization_rate, 100)}%`,
                              height: '100%',
                              background: r.utilization_rate < 50 ? '#dc2626' : '#16a34a',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>{r.delay_days} days</td>
                    <td>
                      <Badge risk={riskLevel} />
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="link" onClick={() => handleOpenDetail(r)}>
                        Inspect <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #edf1f5',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
            color: '#64748b',
          }}
        >
          <div>
            Showing records {(meta.page - 1) * meta.per_page + 1} to{' '}
            {Math.min(meta.page * meta.per_page, meta.total_items)} of {meta.total_items}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #d9e3ef',
                background: page <= 1 ? '#f8fafc' : '#fff',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {meta.page} of {meta.total_pages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
              disabled={page >= meta.total_pages}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #d9e3ef',
                background: page >= meta.total_pages ? '#f8fafc' : '#fff',
                cursor: page >= meta.total_pages ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Record Detail Drawer Overlay */}
      {selectedRecord && (
        <div className="overlay" onClick={() => setSelectedRecord(null)}>
          <section className="detail" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedRecord(null)}>
              <X size={20} />
            </button>

            <Badge risk={selectedRecord.latest_anomaly?.risk_level || 'Low'} />
            <h2>{selectedRecord.region}</h2>
            <p>
              {selectedRecord.record_id} · {selectedRecord.department} ({selectedRecord.category})
            </p>

            <div className="stats">
              <div>
                Allocation<b>{money(selectedRecord.allocation)}</b>
              </div>
              <div>
                Utilization<b>{selectedRecord.utilization_rate}%</b>
              </div>
              <div>
                Delay<b>{selectedRecord.delay_days} days</b>
              </div>
            </div>

            <h3 style={{ marginTop: '20px' }}>Statistical Breakdown</h3>
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Fiscal Period:</span>
                <b>
                  {selectedRecord.fiscal_year} ({selectedRecord.quarter})
                </b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Historical Regional Avg:</span>
                <b>₹{selectedRecord.historical_average || 0}K</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Transaction Count:</span>
                <b>{selectedRecord.transaction_count} txns</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Record Date:</span>
                <b>{selectedRecord.date || 'N/A'}</b>
              </div>
            </div>

            {selectedRecord.latest_anomaly ? (
              <>
                <h3 style={{ marginTop: '20px' }}>Model Diagnostics &amp; Explainability</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary, #69737A)', lineHeight: 1.5 }}>
                  {selectedRecord.latest_anomaly.explanation?.summary ||
                    'Analyzed using Isolation Forest model against multi-dimensional baseline metrics.'}
                </p>
                <pre style={{ fontSize: '12px', background: 'var(--bg, #F7F6F2)', color: 'var(--text, #20282D)', border: '1px solid var(--border, #DDDCD6)', borderRadius: '6px', padding: '12px' }}>
                  Model: {selectedRecord.latest_anomaly.model_version || 'Production-v1'}
                  {'\n'}
                  Isolation Forest Score:{' '}
                  {selectedRecord.latest_anomaly.isolation_forest_score ??
                    selectedRecord.latest_anomaly.risk_score}
                  {'\n'}
                  Risk Level: {selectedRecord.latest_anomaly.risk_level}
                </pre>
              </>
            ) : (
              <p style={{ marginTop: '20px', fontSize: '13px', color: '#64748b' }}>
                No active anomaly flags for this record.
              </p>
            )}

            <div style={{ marginTop: '24px', display: 'flex', gap: '10px' }}>
              <button
                className="primary"
                onClick={() => {
                  setCaseTitle(`Investigation: ${selectedRecord.region} - ${selectedRecord.record_id}`);
                  setShowCaseModal(true);
                }}
              >
                <ShieldAlert size={16} /> Open Risk Case
              </button>
            </div>
          </section>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImport && (
        <div className="overlay" onClick={() => setShowImport(false)}>
          <div
            style={{
              width: '90%',
              maxWidth: '600px',
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
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Import Financial CSV Dataset</h2>
              <button onClick={() => setShowImport(false)}>
                <X size={20} />
              </button>
            </div>

            {importError && (
              <div
                style={{
                  background: '#fee2e2',
                  color: '#991b1b',
                  padding: '10px',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  fontSize: '13px',
                }}
              >
                {importError}
              </div>
            )}
            {importSuccess && (
              <div
                style={{
                  background: '#ecfdf5',
                  color: '#065f46',
                  padding: '10px',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  fontSize: '13px',
                }}
              >
                {importSuccess}
              </div>
            )}

            {!importPreview ? (
              <div
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: '#f8fafc',
                }}
              >
                <FileSpreadsheet size={40} style={{ color: '#64748b', margin: '0 auto 12px' }} />
                <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#334155', fontWeight: 600 }}>
                  Select or drag a CSV file with financial records
                </p>
                <small style={{ display: 'block', color: '#64748b', marginBottom: '16px' }}>
                  Required columns: record_id, region, allocation, utilization
                </small>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  id="csv-file-input"
                />
                <label
                  htmlFor="csv-file-input"
                  className="primary"
                  style={{ cursor: 'pointer', display: 'inline-flex' }}
                >
                  {importLoading ? 'Reading CSV...' : 'Browse Computer'}
                </label>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    background: '#f1f5f9',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    marginBottom: '16px',
                  }}
                >
                  <b>File Validated:</b> {importPreview.filename}
                  <div style={{ color: '#475569', marginTop: '4px' }}>
                    Total Rows: <b>{importPreview.total_rows}</b> | Valid Records:{' '}
                    <b style={{ color: '#16a34a' }}>{importPreview.valid_rows}</b>
                  </div>
                </div>

                <h4>Preview (First 3 Rows):</h4>
                <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '20px' }}>
                  <table style={{ fontSize: '12px', width: '100%' }}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Region</th>
                        <th>Alloc</th>
                        <th>Util</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(importPreview.preview_rows || []).slice(0, 3).map((r, i) => (
                        <tr key={i}>
                          <td>{r.record_id}</td>
                          <td>{r.region}</td>
                          <td>{r.allocation}</td>
                          <td>{r.utilization}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    onClick={() => {
                      setImportPreview(null);
                      setImportFile(null);
                    }}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    Cancel
                  </button>
                  <button className="primary" onClick={handleConfirmImport} disabled={importLoading}>
                    {importLoading ? 'Importing...' : 'Commit to Database'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Case Modal */}
      {showCaseModal && (
        <div className="overlay" onClick={() => setShowCaseModal(false)}>
          <div
            style={{
              width: '90%',
              maxWidth: '520px',
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
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Create Risk Case</h2>
              <button onClick={() => setShowCaseModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Case Title
                </label>
                <input
                  type="text"
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Investigation Priority
                </label>
                <select
                  value={casePriority}
                  onChange={(e) => setCasePriority(e.target.value)}
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
                  Investigation Brief / Hypothesis
                </label>
                <textarea
                  value={caseDescription}
                  onChange={(e) => setCaseDescription(e.target.value)}
                  rows={4}
                  style={{ width: '100%', resize: 'vertical' }}
                  placeholder="Outline the reasons for opening an investigation..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCaseModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={handleCreateCase}
                  disabled={caseLoading}
                >
                  {caseLoading ? 'Creating...' : 'Open Case'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
