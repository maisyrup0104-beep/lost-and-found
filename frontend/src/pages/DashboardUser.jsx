// src/pages/DashboardUser.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardUser() {
  const nav = useNavigate();
  const { user } = useAuth();

  return (
    <div style={{ maxWidth: 1100, margin: '28px auto', padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>User Dashboard</h1>

      <div style={{ marginBottom: 12, color: '#333' }}>
        {user ? `Welcome, ${user.name}` : 'Welcome'}
      </div>

      {/* BUTTON GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginTop: 18
        }}
      >
        {/* REPORT LOST */}
        <button
          onClick={() => nav('/report-lost')}
          style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid #e6eef8',
            background: '#fff',
            cursor: 'pointer',
            fontSize: 16,
            color: '#000'
          }}
        >
          Report Lost
        </button>

        {/* REPORT FOUND */}
        <button
          onClick={() => nav('/report-found')}
          style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid #e6eef8',
            background: '#fff',
            cursor: 'pointer',
            fontSize: 16,
            color: '#000'
          }}
        >
          Report Found
        </button>

        {/* CHECK FOUND ITEMS */}
        <button
          onClick={() => nav('/found')}
          style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid #e6eef8',
            background: '#fff',
            cursor: 'pointer',
            fontSize: 16,
            color: '#000'
          }}
        >
          Check Found Items
        </button>

        {/* MY CLAIMS */}
        <button
          onClick={() => nav('/my-claims')}
          style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid #e6eef8',
            background: '#fff',
            cursor: 'pointer',
            fontSize: 16,
            color: '#000'
          }}
        >
          My Claims
        </button>
      </div>

      <div style={{ marginTop: 20, color: '#666', fontSize: 13 }}>
        Use this dashboard to report lost items, report found items, browse found items, or check your claim history.
      </div>
    </div>
  );
}
