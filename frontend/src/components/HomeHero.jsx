// src/components/HomeHero.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/apiClient';
import { io } from 'socket.io-client';

export default function HomeHero() {
  const nav = useNavigate();
  const { user } = useAuth();

  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false); // indicates received a realtime update
  const [err, setErr] = useState(null);

  function handleReportClick() {
    if (user) {
      nav('/report-lost');
    } else {
      nav('/login', { state: { from: '/report-lost' } });
    }
  }

  async function loadData() {
    setLoading(true);
    setErr(null);
    try {
      // try to prefer aggregated endpoint that returns units with attached staffs
      let unitsRes;
      try {
        const res = await api.listUnitsWithManagers();
        unitsRes = res && res.units ? res.units : res;
      } catch {
        const arr = await api.listUnits();
        unitsRes = Array.isArray(arr) ? arr : (arr.units || arr || []);
      }

      // Use units data only for the hero preview (omit staff details here)
      const finalUnits = Array.isArray(unitsRes) ? unitsRes : (unitsRes.units || []);
      setUnits(finalUnits);
    } catch (e) {
      console.error('HomeHero loadData error', e);
      setErr(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    // Setup Socket.IO for realtime updates
    // determine socket URL based on VITE_API_BASE (strip trailing /api)
    const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
    const socketUrl = apiBase.replace(/\/api\/?$/, '').replace(/\/$/, ''); // e.g. http://localhost:4000

    let socket;
    try {
      // Provide token to socket auth if available (helps servers that require auth for realtime updates)
      const token = (typeof window !== 'undefined') ? (window.localStorage.getItem('LAF__token') || window.localStorage.getItem('token') || window.localStorage.getItem('Lfa__token')) : null;
      socket = io(socketUrl, { withCredentials: true, auth: token ? { token } : undefined });

      // on connect
      socket.on('connect', () => {
        // console.debug('socket connected', socket.id);
      });

      // events that backend emits: 'staffs:changed', 'users:changed', 'units:changed'
      const onRealtime = (payload) => {
        // mark we've seen a live update and reload current snapshot
        setLive(true);
        // refresh data to keep UI consistent
        loadData();
        // reset the live indicator after a short delay
        setTimeout(() => setLive(false), 2500);
      };

      socket.on('staffs:changed', onRealtime);
      socket.on('users:changed', onRealtime);
      socket.on('units:changed', onRealtime);

      socket.on('connect_error', (err) => {
        // Connect errors could be authorization issues; don't show raw text to users
        console.warn('Socket connect_error', err && err.message ? err.message : err);
      });

      socket.on('disconnect', () => {
        // console.debug('socket disconnected');
      });
    } catch (socketErr) {
      console.warn('Socket init failed', socketErr);
    }

    return () => {
      try {
        if (socket) socket.disconnect();
      } catch (e) { /** ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // split units into academic and facility groups
  const academicUnits = units.filter(u => (u.type || 'facility') === 'academic');
  const facilityUnits = units.filter(u => (u.type || 'facility') === 'facility');

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <div className="hero-actions" style={{ justifyContent: 'center' }}>
        <button onClick={() => nav('/found')} className="btn btn-primary">Check Found Items</button>
        <button onClick={handleReportClick} className="btn btn-secondary">Report Lost & Found</button>
      </div>

      {/* Guidance text */}
      <div style={{ marginTop: 18, color: '#333', maxWidth: 880, marginLeft: 'auto', marginRight: 'auto' }}>
        <p style={{ margin: 6 }}>
          To submit a lost item, click Report Lost & Found. To claim an item, first
          check Check Found Items — if you see your item, go the to the unit listed below to arrange pickup.
        </p>
      </div>

      {/* Small live units & staffs preview */}
      <div style={{ marginTop: 20, display: 'grid', gap: 18, justifyContent: 'center' }}>
        {/* Academic */}
        <div style={{ textAlign: 'left', width: '100%', maxWidth: 920, margin: '0 auto' }}>
          <h4 style={{ marginBottom: 8 }}>Academic</h4>
          {loading ? (
            <div style={{ color: '#666' }}>Loading…</div>
          ) : academicUnits.length === 0 ? (
            <div style={{ color: '#666' }}>No academic units yet.</div>
          ) : (
            <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #eee', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                    <th style={{ padding: 8 }}>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {academicUnits.map(u => (
                    <tr key={u._id || u.id} style={{ borderBottom: '1px solid #fafafa' }}>
                      <td style={{ padding: 8 }}>{u.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Campus Facility */}
        <div style={{ textAlign: 'left', width: '100%', maxWidth: 920, margin: '0 auto' }}>
          <h4 style={{ marginBottom: 8 }}>Campus Facilities</h4>
          {loading ? (
            <div style={{ color: '#666' }}>Loading…</div>
          ) : facilityUnits.length === 0 ? (
            <div style={{ color: '#666' }}>No facilities yet.</div>
          ) : (
            <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #eee', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                    <th style={{ padding: 8 }}>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {facilityUnits.map(u => (
                    <tr key={u._id || u.id} style={{ borderBottom: '1px solid #fafafa' }}>
                      <td style={{ padding: 8 }}>{u.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Optional error */}
      {err && <div style={{ color: 'red', marginTop: 12 }}>{err}</div>}
    </div>
  );
}
