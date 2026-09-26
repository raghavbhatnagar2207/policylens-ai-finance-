import React from 'react';

export function Badge({ risk, children }) {
  const level = (risk || children || 'unanalyzed').toString().toLowerCase();
  let badgeClass = 'badge neutral';
  if (level.includes('high') || level.includes('critical')) {
    badgeClass = 'badge high';
  } else if (level.includes('medium') || level.includes('moderate')) {
    badgeClass = 'badge medium';
  } else if (level.includes('low') || level.includes('normal')) {
    badgeClass = 'badge low';
  }

  const text = children || (risk ? `${risk.toUpperCase()} RISK` : 'UNANALYZED');

  return (
    <span className={badgeClass}>
      {text}
    </span>
  );
}

export function StatusBadge({ status }) {
  const s = (status || 'New').toLowerCase();
  let color = '#526B7A';
  let bg = '#EFF3F5';

  if (s === 'resolved' || s === 'closed' || s === 'active') {
    color = '#3E7D5A';
    bg = '#EEF6F1';
  } else if (s === 'escalated' || s === 'rejected') {
    color = '#B34F4A';
    bg = '#FDF0EF';
  } else if (s === 'under review' || s === 'under_investigation' || s === 'triaged' || s === 'needs information') {
    color = '#A66A2B';
    bg = '#FDF6EE';
  } else if (s === 'assigned') {
    color = '#526B7A';
    bg = '#EFF3F5';
  } else if (s === 'new') {
    color = '#2F6B62';
    bg = '#EEF3F0';
  }

  return (
    <span
      style={{
        padding: '3px 7px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        color,
        background: bg,
        display: 'inline-block',
      }}
    >
      {status || 'New'}
    </span>
  );
}
