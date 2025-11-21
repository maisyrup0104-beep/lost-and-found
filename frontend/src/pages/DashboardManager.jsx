// src/pages/DashboardManager.jsx
import React, { useEffect, useState } from 'react';
import { api } from '../api/apiClient';
import { useAuth } from '../contexts/AuthContext';

/**
 * Helper: compute API origin from apiClient env var which often contains "/api"
 * e.g. import.meta.env.VITE_API_BASE may be "http://localhost:4000/api"
 * we want "http://localhost:4000"
 */
const API_ORIGIN = (import.meta.env.VITE_API_BASE || 'http://localhost:4000/api').replace(/\/api\/?$/, '');

function resolveUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  // path likely starts with '/uploads/...' or 'uploads/...'
  if (pathOrUrl.startsWith('/')) return `${API_ORIGIN}${pathOrUrl}`;
  return `${API_ORIGIN}/${pathOrUrl}`;
}

export default function DashboardManager() {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'claims'
  const [inboxItems, setInboxItems] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [err, setErr] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadInbox();
    loadClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInbox() {
    setErr(null);
    setLoadingInbox(true);
    try {
      const res = await api.managerInbox();
      // api.managerInbox returns { items } or an array; normalize:
      const arr = Array.isArray(res) ? res : (res.items || res);
      setInboxItems(arr);
    } catch (e) {
      console.error('managerInbox', e);
      setErr(e?.message || 'Failed to load manager inbox');
      if (e?.status === 401) {
        try { await logout(); } catch (_) {}
      }
    } finally {
      setLoadingInbox(false);
    }
  }

  async function loadClaims() {
    setErr(null);
    setLoadingClaims(true);
    try {
      const res = await api.managerPendingClaims();
      // expect { claims: [...] } or array
      const arr = Array.isArray(res) ? res : (res.claims || res);
      setClaims(arr);
    } catch (e) {
      console.error('managerPendingClaims', e);
      setErr(e?.message || 'Failed to load pending claims');
      if (e?.status === 401) {
        try { await logout(); } catch (_) {}
      }
    } finally {
      setLoadingClaims(false);
    }
  }

  // Manager actions for found items
  async function handleVerify(itemId) {
    if (!confirm('Mark this item as verified? You can publish it to public afterward.')) return;
    setActionLoading(true);
    try {
      await api.verifyFound(itemId);
      await loadInbox();
      await loadClaims();
      alert('Item marked as pending verification.');
    } catch (e) {
      console.error('verifyFound', e);
      setErr(e?.message || 'Failed to verify item');
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePublish(itemId) {
    if (!confirm('Publish this item to public listing?')) return;
    setActionLoading(true);
    try {
      await api.publishFound(itemId);
      await loadInbox();
      alert('Item published to public listing.');
    } catch (e) {
      console.error('publishFound', e);
      setErr(e?.message || 'Failed to publish item');
    } finally {
      setActionLoading(false);
    }
  }

  // Manager actions for claims
  async function handleApprove(claimId) {
    const note = window.prompt('Optional manager note (e.g. ask for ID at pickup):', 'Approved — ask for ID at pickup');
    if (!confirm('Approve this claim?')) return;
    setActionLoading(true);
    try {
      await api.approveClaim(claimId, { manager_note: note || '' });
      await loadClaims();
      await loadInbox(); // item status changes might affect inbox
      alert('Claim approved. Item status set to ready_for_pickup.');
    } catch (e) {
      console.error('approveClaim', e);
      setErr(e?.message || 'Failed to approve claim');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(claimId) {
    const note = window.prompt('Optional manager note for rejection:', 'Rejected - insufficient proof');
    if (!confirm('Reject this claim?')) return;
    setActionLoading(true);
    try {
      await api.rejectClaim(claimId, { manager_note: note || '' });
      await loadClaims();
      await loadInbox(); // item might have status updated back to public_unclaimed
      alert('Claim rejected.');
    } catch (e) {
      console.error('rejectClaim', e);
      setErr(e?.message || 'Failed to reject claim');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <h1>Lost and Found Staff</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button
          onClick={() => setActiveTab('inbox')}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: activeTab === 'inbox' ? '2px solid #0366d6' : '1px solid #eee',
            color: 'black',
            background: activeTab === 'inbox' ? '#f0f8ff' : '#fff'
          }}
        >
          Inbox {loadingInbox ? '…' : `(${inboxItems.length})`}
        </button>

        <button
          onClick={() => setActiveTab('claims')}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            color: 'black',
            border: activeTab === 'claims' ? '2px solid #0366d6' : '1px solid #eee',
            background: activeTab === 'claims' ? '#f0f8ff' : '#fff'
          }}
        >
          Pending claims {loadingClaims ? '…' : `(${claims.length})`}
        </button>
      </div>

      {err && <div style={{ color: 'red', marginBottom: 12 }}>{err}</div>}

      {activeTab === 'inbox' && (
        <section>
          <h2>Inbox — items assigned to your unit</h2>
          {loadingInbox ? (
            <div>Loading inbox…</div>
          ) : inboxItems.length === 0 ? (
            <div style={{ color: '#666', padding: 12, border: '1px dashed #eee' }}>No items in your inbox.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {inboxItems.map(item => {
                const photoUrl = resolveUrl(item.photo_url || item.photo || '');
                return (
                  <div key={item._id || item.id} style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, display: 'flex', gap: 12 }}>
                    <div style={{ width: 120, height: 80, background: '#f6f6f6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {photoUrl ? (
                        // clickable thumbnail opens full image in new tab
                        <img
                          src={photoUrl}
                          alt={item.item_name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                          onClick={() => window.open(photoUrl, '_blank')}
                        />
                      ) : (
                        <div style={{ color: '#888' }}>{item.category || 'Item'}</div>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{item.item_name}</div>
                      <div style={{ color: '#666' }}>{item.description}</div>
                      <div style={{ marginTop: 8, fontSize: 13, color: '#555' }}>
                        Status: <strong>{item.status}</strong>
                        {item.found_location_general && item.found_location_general.name ? ` • Location: ${item.found_location_general.name}` : ''}
                      </div>
                      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                        {['to_be_retrieved','secured_unclaimed'].includes(item.status) && (
                          <button disabled={actionLoading} onClick={() => handleVerify(item._id || item.id)}>
                            Verify
                          </button>
                        )}

                        {item.status === 'pending_verification' && (
                          <>
                            <button disabled={actionLoading} onClick={() => handlePublish(item._id || item.id)}>
                              Publish to public
                            </button>
                            <button disabled={actionLoading} onClick={() => handleVerify(item._id || item.id)}>
                              (Re-)Verify
                            </button>
                          </>
                        )}

                        <button disabled={actionLoading} onClick={() => {
                          // quick inspect: open item detail or show claims in future
                          alert('Open item detail/claims in future. For now, check Pending claims tab.');
                        }}>
                          Inspect
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeTab === 'claims' && (
        <section>
          <h2>Pending claims for your unit</h2>
          {loadingClaims ? (
            <div>Loading claims…</div>
          ) : claims.length === 0 ? (
            <div style={{ color: '#666', padding: 12, border: '1px dashed #eee' }}>No pending claims.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {claims.map(c => {
                const photo = c.found_item_id && (c.found_item_id.photo_url || c.found_item_id.photo);
                const photoUrl = resolveUrl(photo || '');
                return (
                  <div key={c._id || c.id} style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ width: 88, height: 64, background: '#f6f6f6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={c.found_item_id ? c.found_item_id.item_name : 'Item'}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                              onClick={() => window.open(photoUrl, '_blank')}
                            />
                          ) : (
                            <div style={{ color: '#888' }}>{c.found_item_id ? c.found_item_id.category : 'Item'}</div>
                          )}
                        </div>

                        <div>
                          <div style={{ fontWeight: 700 }}>{c.claimant_name} {c.claimant_phone ? `• ${c.claimant_phone}` : ''}</div>
                          <div style={{ color: '#555' }}>{c.note || '(no note provided)'}</div>

                          {c.found_item_id ? (
                            <div style={{ marginTop: 8 }}>
                              Claiming item: <strong>{c.found_item_id.item_name}</strong> — <span style={{ color: '#666' }}>{c.found_item_id.category}</span>
                              <div style={{ fontSize: 13, color: '#777' }}>Found item status: {c.found_item_id.status}</div>
                            </div>
                          ) : (
                            <div style={{ marginTop: 8, color: '#777' }}>Found item details not available</div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
                        <button disabled={actionLoading} onClick={() => handleApprove(c._id || c.id)}>Approve</button>
                        <button disabled={actionLoading} onClick={() => handleReject(c._id || c.id)}>Reject</button>
                        <button disabled={actionLoading} onClick={() => {
                          const history = (c.status_log || []).map(s => {
                            const t = s.timestamp ? new Date(s.timestamp).toLocaleString() : '';
                            return `${t}: ${s.previous_status || '-'} → ${s.current_status || '-'}`.trim();
                          }).join('\n') || 'No log';
                          alert(`Claim history:\n${history}`);
                        }}>History</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}