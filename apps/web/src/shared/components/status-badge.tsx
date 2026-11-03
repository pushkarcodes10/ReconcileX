import React from 'react';

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.2rem 0.5rem',
        fontSize: '0.8rem',
        border: '1px solid #ccc',
        borderRadius: '3px',
        backgroundColor: '#fafafa',
        fontWeight: 'bold',
      }}
    >
      {status}
    </span>
  );
};
