// src/pages/ClaimItem.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/apiClient';
import { useAuth } from '../contexts/AuthContext';

function formatDate(d) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

export default function ClaimItem() {
  const { id: foundIdParam } = useParams(); // expects /claim/:id
  const nav = useNavigate();
  const { user } = useAuth();

  // item preview state
  const [foundItem, setFoundItem] = useState(null);
  const [loadingItem, setLoadingItem] = useState(false);

  // form state
  const [claimant_name, setClaimantName] = useState(user?.name || '');
  const [claimant_phone, setClaimantPhone] = useState(user?.phone || '');
  const [note, setNote] = useState('');
  const [proof_url, setProofUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  // file upload state
  const [proofFile, setProofFile] = useState(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState(null);

  // redirect to public list if no id
  useEffect(() => {
    if (!foundIdParam) {
      nav('/found', { replace: true });
    }
  }, [foundIdParam, nav]);

  // preview file object URL
  useEffect(() => {
    if (proofFile) {
      const u = URL.createObjectURL(proofFile);
      setProofPreviewUrl(u);
      return () => URL.revokeObjectURL(u);
    } else {
      setProofPreviewUrl(null);
    }
  }, [proofFile]);

  // load preview and prefill from user when available
  useEffect(() => {
    if (!foundIdParam) return;
    loadItemPreview(foundIdParam);
    if (user) {
      if (!claimant_name && user.name) setClaimantName(user.name);
      if (!claimant_phone && user.phone) setClaimantPhone(user.phone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foundIdParam, user]);

  async function loadItemPreview(id) {
    setLoadingItem(true);
    setErr(null);
    try {
      // Prefer endpoint to fetch single found item if available
      if (api.getFoundById) {
        try {
          const single = await api.getFoundById(id);
          if (single && (single._id || single.id)) {
            setFoundItem(single);
            return;
          }
        } catch (e) {
          // ignore and fallback to public list
        }
      }

      // Fallback: fetch public list and find the item
      const data = await api.listPublicFound();
      const arr = Array.isArray(data) ? data : (data.items || data);
      const match = Array.isArray(arr) ? arr.find(it => String(it._id || it.id) === String(id)) : null;
      if (match) setFoundItem(match);
      else setFoundItem(null);
    } catch (e) {
      console.warn('Could not load found item preview', e);
      setFoundItem(null);
      setErr('Failed to load item preview');
    } finally {
      setLoadingItem(false);
    }
  }

  function onFileChange(e) {
    setErr(null);
    const f = e.target.files && e.target.files[0];
    if (!f) {
      setProofFile(null);
      return;
    }
    // quick client-side checks
    const maxBytes = 5 * 1024 * 1024; // 5 MB
    if (f.size > maxBytes) {
      setErr('Proof file must be under 5MB');
      return;
    }
    if (!f.type.startsWith('image/') && !f.type.startsWith('application/')) {
      // allow images and common document types (optional)
      setErr('Proof file must be an image or document');
      return;
    }
    setProofFile(f);
    // if user selects file, clear proof_url input to avoid confusion
    if (proof_url) setProofUrl('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null);

    if (!foundIdParam) { setErr('Missing found item id'); return; }
    if (!claimant_name || !claimant_name.trim()) { setErr('Name is required'); return; }

    // Helpful client-side pre-check: if item exists but not public_unclaimed, warn user
    if (foundItem && foundItem.status && foundItem.status !== 'public_unclaimed') {
      const ok = window.confirm(
        `This item is currently "${foundItem.status}" and may not be claimable yet. ` +
        `Proceed to submit the claim anyway?`
      );
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      // If proofFile is present, submit multipart/form-data using api.createClaimForm if available
      if (proofFile && api.createClaimForm) {
        const fd = new FormData();
        fd.append('found_item_id', foundIdParam);
        fd.append('claimant_name', claimant_name.trim());
        if (claimant_phone) fd.append('claimant_phone', claimant_phone);
        if (note) fd.append('note', note);
        fd.append('proof', proofFile); // backend expects field name "proof"
        // allow backend to read proof_url if provided alongside file (not typical)
        if (proof_url) fd.append('proof_url', proof_url);

        await api.createClaimForm(fd);
      } else if (proofFile && !api.createClaimForm) {
        // fallback: try to upload to a generic endpoint if available (not guaranteed)
        // Attempt to use a generic form POST to '/claims' (many backends accept multipart)
        const url = (import.meta.env.VITE_API_BASE || 'http://localhost:4000/api') + '/claims';
        const fd = new FormData();
        fd.append('found_item_id', foundIdParam);
        fd.append('claimant_name', claimant_name.trim());
        if (claimant_phone) fd.append('claimant_phone', claimant_phone);
        if (note) fd.append('note', note);
        fd.append('proof', proofFile);

        const res = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          body: fd
        });
        if (!res.ok) {
          const txt = await res.text();
          let data = null;
          try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
          const errMsg = data?.error || data?.message || `Server error (${res.status})`;
          throw new Error(errMsg);
        }
        // assume success
      } else {
        // No file: use JSON endpoint
        const payload = {
          found_item_id: foundIdParam,
          claimant_name: claimant_name.trim(),
          claimant_phone: claimant_phone || null,
          note: note || null,
          proof_url: proof_url || null
        };
        await api.createClaim(payload);
      }

      alert('Claim submitted — it is now pending review.');
      nav('/my-claims');
    } catch (e) {
      console.error('createClaim', e);
      const message = e?.data?.error || e?.message || 'Failed to submit claim';
      setErr(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="form-container">
      <h1>Submit Claim</h1>

      {err && <div className="error">{err}</div>}

      {loadingItem ? (
        <div>Loading item preview…</div>
      ) : foundItem ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <strong>Claiming:</strong>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <div style={{ width: 120, height: 80, background: '#f6f6f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {foundItem.photo_url ? (
                <img src={foundItem.photo_url} alt={foundItem.item_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ color: '#888' }}>{foundItem.category || 'Item'}</div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{foundItem.item_name}</div>
              <div style={{ fontSize: 13, color: '#666' }}>{foundItem.description}</div>
              <div style={{ fontSize: 12, color: '#777', marginTop: 8 }}>Found: {formatDate(foundItem.date_found)}</div>
              {foundItem.status && (
                <div style={{ fontSize: 12, color: foundItem.status === 'public_unclaimed' ? '#2a7f4b' : '#b04', marginTop: 6 }}>
                  Status: {foundItem.status}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ marginBottom: 12, borderStyle: 'dashed' }}>
          No public preview available for this item. The manager will still review your claim.
        </div>
      )}

      <form onSubmit={handleSubmit} className="form">
        <fieldset className="form-section">
          <legend>Your contact</legend>

          <label>
            Name *
            <input type="text" value={claimant_name} onChange={e => setClaimantName(e.target.value)} />
          </label>

          <label>
            Phone
            <input type="tel" value={claimant_phone} onChange={e => setClaimantPhone(e.target.value)} placeholder="0917..." />
          </label>
        </fieldset>

        <label>
          Note (why you claim this item)
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={4} />
        </label>

        <label>
          Proof (upload) — optional
          <input type="file" accept="image/*,application/pdf" onChange={onFileChange} />
          {proofPreviewUrl && (
            <div className="file-preview">
              <img src={proofPreviewUrl} alt="proof preview" />
              <div>
                <div className="muted">Selected: {proofFile?.name} — {(proofFile?.size / 1024 / 1024).toFixed(2)} MB</div>
                <div className="form-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => { setProofFile(null); setProofUrl(''); }}>Remove file</button>
                </div>
              </div>
            </div>
          )}
        </label>

        <label>
          — or provide Proof URL (optional)
          <input type="text" value={proof_url} onChange={e => { setProofUrl(e.target.value); if (e.target.value) setProofFile(null); }} placeholder="https://..." />
          <div className="helper">Upload a file or provide a URL. If you upload a file, it will be sent to the server.</div>
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Claim'}</button>{' '}
          <button type="button" className="btn btn-secondary" onClick={() => nav(-1)} style={{ marginLeft: 8 }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
