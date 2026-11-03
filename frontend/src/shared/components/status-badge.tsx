import React from 'react';

export interface StatusBadgeProps {
  status?: string | null;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  if (!status) return null;

  const normalized = status.toUpperCase();

  let bg = '#F1F3F0';
  let color = '#444A42';
  let dot = '#8E948B';

  if (
    normalized === 'MATCHED' ||
    normalized === 'COMPLETED' ||
    normalized === 'RESOLVED' ||
    normalized === 'SUCCESS' ||
    normalized === 'ACTIVE' ||
    normalized === 'CONFIRMED'
  ) {
    bg = '#EAF7EE';
    color = '#15803D';
    dot = '#22C55E';
  } else if (
    normalized === 'POTENTIAL_MATCH' ||
    normalized === 'POTENTIAL' ||
    normalized === 'PENDING' ||
    normalized === 'UNDER_REVIEW' ||
    normalized === 'PROCESSING' ||
    normalized === 'RUNNING' ||
    normalized === 'QUEUED'
  ) {
    bg = '#FEF9E6';
    color = '#A16207';
    dot = '#EAB308';
  } else if (
    normalized === 'FAILED' ||
    normalized === 'EXCEPTION' ||
    normalized === 'UNMATCHED' ||
    normalized === 'ESCALATED' ||
    normalized === 'REJECTED' ||
    normalized === 'ERROR'
  ) {
    bg = '#FEECEB';
    color = '#B91C1C';
    dot = '#EF4444';
  } else if (
    normalized === 'IMPORTED' ||
    normalized === 'VALIDATED' ||
    normalized === 'ASSIGNED' ||
    normalized === 'OPEN'
  ) {
    bg = '#EBF4FC';
    color = '#0369A1';
    dot = '#38BDF8';
  }

  // Display human readable label if desired or standard token
  const label = status.replace(/_/g, ' ');

  return (
    <span
      className={`rx-status-badge ${className}`}
      style={{
        backgroundColor: bg,
        color: color,
        border: `1px solid ${dot}25`,
      }}
    >
      <span
        className="rx-status-dot"
        style={{
          backgroundColor: dot,
          boxShadow: `0 0 0 2px ${bg}`,
        }}
      />
      {label}
    </span>
  );
};
