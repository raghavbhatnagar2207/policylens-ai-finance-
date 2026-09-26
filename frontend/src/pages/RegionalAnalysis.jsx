import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import { ArrowRight, ShieldAlert, TrendingUp, Clock, Coins, BarChart2, RotateCcw, Filter, MapPin } from 'lucide-react';
import Title from '../components/Title.jsx';
import { Badge } from '../components/Badge.jsx';
import api from '../services/api.js';
import 'leaflet/dist/leaflet.css';
import '../map.css';

const DEFAULT_COORDS = {
  Moradabad: [28.8386, 78.7733],
  Rampur: [28.8154, 79.0250],
  Sambhal: [28.5852, 78.5732],
  Amroha: [28.9031, 78.4698],
  Bijnor: [29.3724, 78.1362],
  Meerut: [28.9845, 77.7064],
  Bareilly: [28.3670, 79.4304],
  Lucknow: [26.8467, 80.9462],
  Agra: [27.1767, 78.0081],
  Varanasi: [25.3176, 82.9739],
};

const RISK_COLORS = {
  Critical: '#dc2626', // Scarlet Red
  High: '#ea580c',     // Rich Orange
  Medium: '#d97706',   // High-Contrast Amber
  Low: '#16a34a',      // Emerald Green
};

const RISK_BG_LIGHT = {
  Critical: '#fef2f2',
  High: '#fff7ed',
  Medium: '#fffbeb',
  Low: '#f0fdf4',
};

const FALLBACK_REGIONS = [
  {
    region: 'Moradabad',
    allocation: 1660.0,
    utilization: 788.0,
    utilization_rate: 47.5,
    avg_delay: 28.0,
    anomaly_count: 5,
    anomalies: 5,
    dominant_risk: 'Critical',
    open_cases: 2,
    record_count: 3,
    has_data: true,
    coordinates: [28.8386, 78.7733],
    risk_distribution: { Critical: 10, Low: 5 }
  },
  {
    region: 'Agra',
    allocation: 900.0,
    utilization: 618.0,
    utilization_rate: 68.7,
    avg_delay: 23.5,
    anomaly_count: 5,
    anomalies: 5,
    dominant_risk: 'Critical',
    open_cases: 1,
    record_count: 2,
    has_data: true,
    coordinates: [27.1767, 78.0081],
    risk_distribution: { Critical: 5, Low: 5 }
  },
  {
    region: 'Bareilly',
    allocation: 1590.0,
    utilization: 1083.0,
    utilization_rate: 68.1,
    avg_delay: 14.3,
    anomaly_count: 0,
    anomalies: 0,
    dominant_risk: 'Critical',
    open_cases: 1,
    record_count: 3,
    has_data: true,
    coordinates: [28.3670, 79.4304],
    risk_distribution: { Critical: 5, Low: 10 }
  },
  {
    region: 'Meerut',
    allocation: 2170.0,
    utilization: 1186.0,
    utilization_rate: 54.7,
    avg_delay: 14.7,
    anomaly_count: 0,
    anomalies: 0,
    dominant_risk: 'High',
    open_cases: 1,
    record_count: 3,
    has_data: true,
    coordinates: [28.9845, 77.7064],
    risk_distribution: { High: 5, Low: 10 }
  },
  {
    region: 'Bijnor',
    allocation: 1370.0,
    utilization: 886.0,
    utilization_rate: 64.7,
    avg_delay: 13.7,
    anomaly_count: 0,
    anomalies: 0,
    dominant_risk: 'High',
    open_cases: 1,
    record_count: 3,
    has_data: true,
    coordinates: [29.3724, 78.1362],
    risk_distribution: { High: 5, Low: 10 }
  },
  {
    region: 'Lucknow',
    allocation: 2150.0,
    utilization: 1630.0,
    utilization_rate: 75.8,
    avg_delay: 13.5,
    anomaly_count: 5,
    anomalies: 5,
    dominant_risk: 'Medium',
    open_cases: 0,
    record_count: 2,
    has_data: true,
    coordinates: [26.8467, 80.9462],
    risk_distribution: { Medium: 10 }
  },
  {
    region: 'Sambhal',
    allocation: 920.0,
    utilization: 681.0,
    utilization_rate: 74.0,
    avg_delay: 13.5,
    anomaly_count: 0,
    anomalies: 0,
    dominant_risk: 'Medium',
    open_cases: 0,
    record_count: 2,
    has_data: true,
    coordinates: [28.5852, 78.5732],
    risk_distribution: { Low: 5, Medium: 5 }
  },
  {
    region: 'Varanasi',
    allocation: 1360.0,
    utilization: 1160.0,
    utilization_rate: 85.3,
    avg_delay: 9.0,
    anomaly_count: 0,
    anomalies: 0,
    dominant_risk: 'Medium',
    open_cases: 0,
    record_count: 2,
    has_data: true,
    coordinates: [25.3176, 82.9739],
    risk_distribution: { Low: 5, Medium: 5 }
  },
  {
    region: 'Rampur',
    allocation: 1280.0,
    utilization: 1040.0,
    utilization_rate: 81.2,
    avg_delay: 9.7,
    anomaly_count: 0,
    anomalies: 0,
    dominant_risk: 'Low',
    open_cases: 0,
    record_count: 3,
    has_data: true,
    coordinates: [28.8154, 79.0250],
    risk_distribution: { Low: 15 }
  },
  {
    region: 'Amroha',
    allocation: 1370.0,
    utilization: 1299.0,
    utilization_rate: 94.8,
    avg_delay: 5.5,
    anomaly_count: 0,
    anomalies: 0,
    dominant_risk: 'Low',
    open_cases: 0,
    record_count: 2,
    has_data: true,
    coordinates: [28.9031, 78.4698],
    risk_distribution: { Low: 10 }
  }
];

// Handles safe, non-looping recenter & resize without breaking leaflet tile or marker rendering
function MapController({ targetCoord, resetCount }) {
  const map = useMap();
  const isInitialMount = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (targetCoord && Array.isArray(targetCoord) && targetCoord.length === 2) {
      map.flyTo(targetCoord, 8, { duration: 0.7 });
    }
  }, [targetCoord, map]);

  useEffect(() => {
    if (resetCount > 0) {
      map.flyTo([28.0, 79.5], 7, { duration: 0.7 });
    }
  }, [resetCount, map]);

  return null;
}

export default function RegionalAnalysis() {
  const navigate = useNavigate();
  const [regions, setRegions] = useState(FALLBACK_REGIONS);
  const [activeRegion, setActiveRegion] = useState(FALLBACK_REGIONS[0]);
  const [filterRisk, setFilterRisk] = useState('All');
  const [resetCount, setResetCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function loadRegions() {
      try {
        const res = await api.get('/regions/');
        if (isMounted && res.data && Array.isArray(res.data) && res.data.length > 0) {
          setRegions(res.data);
          // Preserve current active region selection or default to first
          setActiveRegion((prev) => {
            const found = res.data.find((r) => r.region === prev?.region);
            return found || res.data[0];
          });
        }
      } catch (err) {
        console.warn('Using baseline regional dataset:', err.message || err);
      }
    }
    loadRegions();
    return () => {
      isMounted = false;
    };
  }, []);

  const money = (n) => '₹' + Number(n).toLocaleString() + 'K';

  // Compute risk counts for quick filter
  const riskCounts = {
    All: regions.length,
    Critical: regions.filter((r) => r.dominant_risk === 'Critical').length,
    High: regions.filter((r) => r.dominant_risk === 'High').length,
    Medium: regions.filter((r) => r.dominant_risk === 'Medium').length,
    Low: regions.filter((r) => r.dominant_risk === 'Low').length,
  };

  const displayedRegions = filterRisk === 'All'
    ? regions
    : regions.filter((r) => r.dominant_risk === filterRisk);

  return (
    <>
      <Title
        title="Geospatial Risk Intelligence"
        text="Spatial clustering of fund allocation, project delay, and anomaly occurrence across regional administrative units."
      />

      {/* 1. Upper Part: Full Width Map with Visible Risk Markers, Labels, and Legend */}
      <section
        className="card map-shell"
        style={{
          padding: 0,
          overflow: 'hidden',
          height: '500px',
          position: 'relative',
          marginBottom: '20px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Floating Top Controls: Risk Filter Bar & Center Reset */}
        <div
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(6px)',
            border: '1px solid #D5D3CB',
            padding: '5px 8px',
            borderRadius: '7px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '4px', letterSpacing: '0.4px' }}>
              Filter:
            </span>
            {['All', 'Critical', 'High', 'Medium', 'Low'].map((risk) => {
              const isSelected = filterRisk === risk;
              const count = riskCounts[risk] || 0;
              const riskColor = RISK_COLORS[risk] || 'var(--text)';
              return (
                <button
                  key={risk}
                  type="button"
                  onClick={() => setFilterRisk(risk)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    border: isSelected ? `1px solid ${riskColor}` : '1px solid transparent',
                    background: isSelected ? (risk === 'All' ? '#F3F4F6' : RISK_BG_LIGHT[risk] || '#F9FAFB') : 'transparent',
                    color: isSelected ? (risk === 'All' ? '#111827' : riskColor) : '#4B5563',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {risk !== 'All' && (
                    <i style={{ width: '6px', height: '6px', borderRadius: '50%', background: riskColor, display: 'inline-block' }} />
                  )}
                  <span>{risk}</span>
                  <span style={{ fontSize: '10px', opacity: 0.75 }}>({count})</span>
                </button>
              );
            })}
          </div>

          <div style={{ width: '1px', height: '18px', background: '#D5D3CB', margin: '0 2px' }} />

          <button
            type="button"
            onClick={() => setResetCount((c) => c + 1)}
            title="Reset Map to State Overview"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              background: '#FFFFFF',
              border: '1px solid #D1D5DB',
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={12} />
            <span>Reset View</span>
          </button>
        </div>

        {/* Floating Top-Left Selected District Pill */}
        {activeRegion && (
          <div
            style={{
              position: 'absolute',
              top: '14px',
              left: '14px',
              zIndex: 1000,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(6px)',
              border: '1px solid #D5D3CB',
              padding: '6px 12px',
              borderRadius: '7px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
            }}
          >
            <MapPin size={14} style={{ color: RISK_COLORS[activeRegion.dominant_risk] || 'var(--primary)' }} />
            <span>
              District: <b>{activeRegion.region}</b>
            </span>
            <span
              style={{
                display: 'inline-block',
                padding: '1px 6px',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                background: RISK_COLORS[activeRegion.dominant_risk] || '#4B5563',
                color: '#FFFFFF',
              }}
            >
              {activeRegion.dominant_risk || 'No Risk'}
            </span>
          </div>
        )}

        {/* Leaflet Map Container */}
        <MapContainer
          center={[28.0, 79.5]}
          zoom={7}
          scrollWheelZoom
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapController
            targetCoord={activeRegion ? (activeRegion.coordinates || DEFAULT_COORDS[activeRegion.region]) : null}
            resetCount={resetCount}
          />

          {displayedRegions.map((r) => {
            const coords = r.coordinates || DEFAULT_COORDS[r.region] || [28.8, 78.8];
            const hasData = r.has_data !== false && r.record_count > 0;
            const risk = hasData ? (r.dominant_risk || 'Low') : 'No Data';
            const color = hasData ? (RISK_COLORS[risk] || '#16a34a') : '#9CA3AF';
            const isSelected = activeRegion?.region === r.region;
            const outlierCount = r.anomaly_count ?? r.anomalies ?? 0;

            return (
              <CircleMarker
                key={r.region}
                center={coords}
                radius={isSelected ? 18 : (hasData && (risk === 'Critical' || risk === 'High') ? 14 : 10)}
                pathOptions={{
                  color: isSelected ? '#0F172A' : '#FFFFFF',
                  fillColor: color,
                  fillOpacity: hasData ? (isSelected ? 1.0 : 0.88) : 0.45,
                  weight: isSelected ? 3.5 : 2.5,
                }}
                eventHandlers={{
                  click: () => setActiveRegion(r),
                }}
              >
                {/* Permanent Risk Label Directly on the Map */}
                <Tooltip permanent direction="top" offset={[0, -12]} opacity={0.96} className="risk-map-tooltip">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600 }}>
                    <span style={{ color: '#111827' }}>{r.region}</span>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '1.5px 5px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                        background: color,
                        color: '#FFFFFF',
                        lineHeight: 1.2,
                      }}
                    >
                      {risk}
                    </span>
                    {hasData && outlierCount > 0 && (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '1.5px 4px',
                          borderRadius: '3px',
                          fontSize: '9px',
                          fontWeight: 700,
                          background: '#1F2937',
                          color: '#F9FAFB',
                          lineHeight: 1.2,
                        }}
                        title={`${outlierCount} algorithmic outliers flagged`}
                      >
                        {outlierCount}⚠️
                      </span>
                    )}
                  </div>
                </Tooltip>

                {/* Clickable Popup with Detailed District Metrics */}
                <Popup>
                  <div style={{ fontFamily: "var(--font, 'Inter', sans-serif)", minWidth: '190px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '15px', color: '#111827' }}>{r.region}</strong>
                      <span
                        style={{
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          background: color,
                          color: '#FFFFFF',
                          textTransform: 'uppercase',
                        }}
                      >
                        {risk}
                      </span>
                    </div>

                    {hasData ? (
                      <div style={{ fontSize: '12px', color: '#4B5563', lineHeight: 1.6 }}>
                        <div>Allocated: <b style={{ color: '#111827' }}>{money(r.allocation)}</b></div>
                        <div>Utilized: <b style={{ color: '#111827' }}>{money(r.utilization)}</b> ({r.utilization_rate}%)</div>
                        <div>Avg Delay: <b style={{ color: r.avg_delay > 20 ? '#dc2626' : '#111827' }}>{r.avg_delay} days</b></div>
                        <div>Outliers: <b style={{ color: outlierCount > 0 ? '#dc2626' : '#16a34a' }}>{outlierCount} flagged</b></div>
                        <div>Open Risk Cases: <b style={{ color: '#111827' }}>{r.open_cases || 0}</b></div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                        No recorded transactions for this district.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setActiveRegion(r);
                        navigate(`/financial-records?region=${encodeURIComponent(r.region)}`);
                      }}
                      style={{
                        marginTop: '10px',
                        width: '100%',
                        padding: '6px 10px',
                        background: '#24584C',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>Inspect Records</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Bottom-Left Map Risk Legend */}
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(4px)',
            border: '1px solid #D5D3CB',
            padding: '7px 14px',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
            fontSize: '11.5px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            zIndex: 1000,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <i style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
            Critical Risk
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <i style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
            High Risk
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <i style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
            Medium Risk
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <i style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
            Low Risk
          </span>
        </div>
      </section>

      {/* 2. Lower Part: District Detection & Inspection Panel (Under the Map) */}
      <section className="card region-detection-card" style={{ padding: '24px 28px', marginBottom: '24px' }}>
        {/* District Switcher Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '14px',
            borderBottom: '1px solid var(--border-light)',
            marginBottom: '20px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              whiteSpace: 'nowrap',
              marginRight: '6px',
            }}
          >
            Select District:
          </span>
          {regions.map((r) => {
            const isSel = activeRegion?.region === r.region;
            const riskColor = RISK_COLORS[r.dominant_risk] || '#16a34a';
            return (
              <button
                key={r.region}
                type="button"
                onClick={() => setActiveRegion(r)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: isSel ? 600 : 500,
                  border: `1px solid ${isSel ? 'var(--primary)' : 'var(--border)'}`,
                  background: isSel ? 'var(--primary-soft)' : 'var(--surface)',
                  color: isSel ? 'var(--primary)' : 'var(--text)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <i style={{ width: '8px', height: '8px', borderRadius: '50%', background: riskColor, display: 'inline-block' }} />
                <span>{r.region}</span>
                {r.dominant_risk === 'Critical' && (
                  <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700 }}>• Critical</span>
                )}
              </button>
            );
          })}
        </div>

        {activeRegion ? (
          activeRegion.has_data === false || activeRegion.record_count === 0 ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <small style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  SELECTED DISTRICT UNIT
                </small>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', background: '#F1F0EB', color: 'var(--text-muted)' }}>
                  No Data
                </span>
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600, margin: '0 0 16px', color: 'var(--text)' }}>
                {activeRegion.region}
              </h2>
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--text)' }}>No Recorded Data</p>
                <small style={{ display: 'block', lineHeight: 1.5 }}>
                  No financial allocations or transactions are currently recorded in the database for this district.
                </small>
              </div>
            </div>
          ) : (
            <div>
              {/* District Title & Action Row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '16px',
                  marginBottom: '20px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <small style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                      Selected District Unit
                    </small>
                    <Badge risk={activeRegion.dominant_risk || 'Low'} />
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600, margin: '2px 0 0', color: 'var(--text)', letterSpacing: '-0.2px' }}>
                    {activeRegion.region} District
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Geographic fund allocation, expenditure compliance, and anomaly surveillance
                  </p>
                </div>

                <button
                  className="primary"
                  onClick={() => navigate(`/financial-records?region=${encodeURIComponent(activeRegion.region)}`)}
                  style={{ padding: '9px 16px' }}
                >
                  Inspect District Records ({activeRegion.record_count}) <ArrowRight size={15} />
                </button>
              </div>

              {/* 4 Financial Metrics Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '14px',
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{
                    padding: '16px 18px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <small style={{ color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: 500 }}>Total Allocated</small>
                    <Coins size={16} style={{ color: 'var(--primary)' }} />
                  </div>
                  <b style={{ display: 'block', fontSize: '20px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
                    {money(activeRegion.allocation)}
                  </b>
                  <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Approved budget</small>
                </div>

                <div
                  style={{
                    padding: '16px 18px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <small style={{ color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: 500 }}>Total Utilized</small>
                    <TrendingUp size={16} style={{ color: 'var(--success)' }} />
                  </div>
                  <b style={{ display: 'block', fontSize: '20px', fontWeight: 700, color: 'var(--success)', letterSpacing: '-0.3px' }}>
                    {money(activeRegion.utilization)}
                  </b>
                  <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Disbursed expenditure</small>
                </div>

                <div
                  style={{
                    padding: '16px 18px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <small style={{ color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: 500 }}>Utilization Rate</small>
                    <BarChart2 size={16} style={{ color: 'var(--primary)' }} />
                  </div>
                  <b style={{ display: 'block', fontSize: '20px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.3px' }}>
                    {activeRegion.utilization_rate}%
                  </b>
                  <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Disbursement efficiency</small>
                </div>

                <div
                  style={{
                    padding: '16px 18px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <small style={{ color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: 500 }}>Average Lag</small>
                    <Clock size={16} style={{ color: activeRegion.avg_delay > 20 ? 'var(--danger)' : 'var(--warning)' }} />
                  </div>
                  <b
                    style={{
                      display: 'block',
                      fontSize: '20px',
                      fontWeight: 700,
                      color: activeRegion.avg_delay > 20 ? 'var(--danger)' : 'var(--warning)',
                      letterSpacing: '-0.3px',
                    }}
                  >
                    {activeRegion.avg_delay} days
                  </b>
                  <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Processing latency</small>
                </div>
              </div>

              {/* Risk & Anomaly Density Banner */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: 'var(--radius)',
                  background: (activeRegion.anomaly_count || activeRegion.anomalies) > 0 ? 'var(--danger-soft)' : 'var(--success-soft)',
                  border: `1px solid ${(activeRegion.anomaly_count || activeRegion.anomalies) > 0 ? '#E0BFBE' : '#C8DFD1'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <ShieldAlert
                    size={24}
                    style={{
                      color: (activeRegion.anomaly_count || activeRegion.anomalies) > 0 ? 'var(--danger)' : 'var(--success)',
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <b
                      style={{
                        fontSize: '14px',
                        color: (activeRegion.anomaly_count || activeRegion.anomalies) > 0 ? 'var(--danger)' : 'var(--success)',
                      }}
                    >
                      {activeRegion.anomaly_count ?? activeRegion.anomalies ?? 0} Algorithmic Outliers Flagged in {activeRegion.region}
                    </b>
                    <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      {(activeRegion.anomaly_count || activeRegion.anomalies) > 0
                        ? `Surveillance algorithms detected statistical anomalies across ${activeRegion.record_count} audited transactions requiring forensic supervisor review.`
                        : `All ${activeRegion.record_count} audited financial transactions fall within acceptable regional expenditure thresholds.`}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  {Object.entries(activeRegion.risk_distribution || {}).map(([riskLvl, cnt]) => (
                    cnt > 0 && (
                      <span
                        key={riskLvl}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: RISK_COLORS[riskLvl] || 'var(--text)',
                        }}
                      >
                        {riskLvl}: <b>{cnt}</b>
                      </span>
                    )
                  ))}
                </div>
              </div>
            </div>
          )
        ) : (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Select a district on the map or from the tabs above.
          </div>
        )}
      </section>
    </>
  );
}
