// src/pages/FoundPublic.jsx
import React, { useEffect, useState } from 'react';
import { api } from '../api/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function formatDate(d) {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString();
  } catch {
    return d;
  }
}

export default function FoundPublic() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const data = await api.listPublicFound();
        // normalize: API may return array or object
        const arr = Array.isArray(data) ? data : (data.items || data.found || data);
        if (mounted) setItems(Array.isArray(arr) ? arr : []);
      } catch (e) {
        console.error('load public found', e);
        if (mounted) setErr(e?.message || 'Failed to load found items');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  function handleClaimClick(item) {
    const id = item._id || item.id;
    // If user not logged in -> go to login and return to claim after
    if (!user) {
      nav('/login', { state: { from: `/claim/${id}` } });
      return;
    }

    // If backend provides status and it's not public_unclaimed -> block
    if (item.status && item.status !== 'public_unclaimed') {
      // show a small alert; optionally you can show a nicer UI toast
      alert('This item is not claimable at the moment. It must be published by a manager first.');
      return;
    }

    // Otherwise navigate to claim flow
    nav(`/claim/${id}`);
  }

  return (
    <div className="container" style={{ paddingTop: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1>Found items (public)</h1>
      </header>

      {err && <div style={{ color: 'red', marginBottom: 12 }}>{err}</div>}

      {loading ? (
        <div>Loading...</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 24, color: '#666' }}>No public found items at the moment.</div>
      ) : (
        <div className="found-grid">
          {items.map(it => {
            const unit = it.assigned_unit_id;
            const isClaimable = !it.status || it.status === 'public_unclaimed';

            // Normalize photo URL: use absolute if external, otherwise prefix backend root
            const normalizeImage = (url) => {
              if (!url) return null;
              if (/^https?:\/\//i.test(url)) return url;
              const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
              const root = apiBase.replace(/\/api\/?$/i, '').replace(/\/$/, '');
              return root + (url.startsWith('/') ? url : `/${url}`);
            };

            const imageSrc = normalizeImage(it.photo_url);

            return (
              <article key={it._id || it.id} className="found-card">
                <div className="found-card-body">
                  <div className="found-image">
                    {imageSrc ? (
                      <img className="found-card-img" src={imageSrc} alt={it.item_name} loading="lazy" />
                    ) : (
                      <div className="found-card-noimg">{it.category || 'Item'}</div>
                    )}
                  </div>

                  <div className="found-content">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div className="found-title">{it.item_name}</div>
                      <div className="found-badge">{unit ? (unit.name || unit.code) : 'Central'} • {formatDate(it.date_found)}</div>
                    </div>

                    <div className="found-desc" style={{ marginTop: 8 }}>{it.description || '(no description)'}</div>

                    <div className="form-actions" style={{ marginTop: 12 }}>
                      <button onClick={() => handleClaimClick(it)} className="btn btn-primary" disabled={!isClaimable} title={!isClaimable ? 'Item not claimable yet' : 'Claim this item'}>
                        Claim Item
                      </button>
                      {!isClaimable && <div className="muted">Status: {it.status || 'not public'}</div>}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}