// src/pages/ReportLost.jsx
import React, { useEffect, useState } from 'react';
import { api } from '../api/apiClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const CATEGORIES = [
  'electronics',
  'clothing',
  'bags',
  'keys',
  'documents',
  'eyewear',
  'jewelry',
  'accessories',
  'footwear',
  'chargers',
  'books',
  'IDs / Cards',
  'other'
];

export default function ReportLost() {
  const { user } = useAuth();
  const nav = useNavigate();

  // reporter
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');

  // lost item
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [categoryOther, setCategoryOther] = useState('');
  const [description, setDescription] = useState('');

  // where/when
  const [lastSeenUnit, setLastSeenUnit] = useState('');
  const [lastSeenDetails, setLastSeenDetails] = useState('');
  const [dateLastSeen, setDateLastSeen] = useState('');

  // optional
  const [educationLevel, setEducationLevel] = useState('');
  const [department, setDepartment] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // file upload
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);

  // helpers
  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  const [matchesPreview, setMatchesPreview] = useState([]);

  useEffect(() => {
    // prefill reporter info if available in user token
    if (user) {
      if (user.name) setReporterName(user.name);
      if (user.phone) setReporterPhone(user.phone);
      if (user.email) setReporterEmail(user.email);
    }
    loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (photoFile) {
      const u = URL.createObjectURL(photoFile);
      setPhotoPreviewUrl(u);
      return () => URL.revokeObjectURL(u);
    } else {
      setPhotoPreviewUrl(null);
    }
  }, [photoFile]);

  async function loadUnits() {
    setLoadingUnits(true);
    try {
      const res = await api.listUnits();
      const arr = Array.isArray(res) ? res : (res.units || res) || [];
      setUnits(arr);
      // default to first unit if nothing selected yet
      if (arr.length && !lastSeenUnit) {
        setLastSeenUnit(arr[0]._id || arr[0].id);
      }
    } catch (e) {
      console.error('loadUnits', e);
    } finally {
      setLoadingUnits(false);
    }
  }

  function onFileChange(e) {
    setErr(null);
    const f = e.target.files && e.target.files[0];
    if (!f) {
      setPhotoFile(null);
      return;
    }
    setPhotoFile(f);
    // clear external URL if user chooses file
    if (photoUrl) setPhotoUrl('');
  }

  function validate() {
    if (!reporterName || !reporterPhone) {
      setErr('Reporter name & phone are required');
      return false;
    }
    const finalCategory = category === 'other' ? (categoryOther || '').trim() : category;
    if (!itemName || !finalCategory || !description) {
      setErr('Item name, category and description are required');
      return false;
    }
    if (!lastSeenUnit) {
      setErr('Please select the last seen unit');
      return false;
    }

    if (photoFile) {
      const maxBytes = 5 * 1024 * 1024; // 5MB
      if (photoFile.size > maxBytes) {
        setErr('Photo must be under 5MB');
        return false;
      }
      if (!photoFile.type.startsWith('image/')) {
        setErr('Photo must be an image file');
        return false;
      }
    }

    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null);
    if (!validate()) return;

    const finalCategory = category === 'other' ? categoryOther.trim() : category;

    setSubmitting(true);
    try {
      // Use FormData for file upload or photo_url fallback
      const fd = new FormData();
      fd.append('reporter_name', reporterName);
      fd.append('reporter_phone', reporterPhone);
      if (reporterEmail) fd.append('reporter_email', reporterEmail);
      fd.append('item_name', itemName);
      fd.append('category', finalCategory);
      fd.append('description', description);
      if (lastSeenUnit) fd.append('last_seen_unit', lastSeenUnit);
      if (lastSeenDetails) fd.append('last_seen_details', lastSeenDetails);
      if (dateLastSeen) fd.append('date_last_seen', dateLastSeen);
      if (educationLevel) fd.append('education_level', educationLevel);
      if (department) fd.append('department', department);

      if (photoFile) {
        fd.append('photo', photoFile); // backend expects 'photo'
      } else if (photoUrl && photoUrl.trim()) {
        fd.append('photo_url', photoUrl.trim());
      }

      // api.createLostReportForm should be implemented in apiClient to POST multipart/form-data
      const res = await api.createLostReportForm(fd);

      alert('Lost report submitted.');

      if (res && (res.matches_preview || res.report?.potential_matches)) {
        const mp = res.matches_preview || res.report?.potential_matches || [];
        if (mp.length) {
          setMatchesPreview(mp);
          // keep user on page to review matches
          return;
        }
      }

      // otherwise navigate back to dashboard or my reports
      nav('/dashboard');
    } catch (e) {
      console.error('createLostReport', e);
      setErr(e?.data?.error || e?.message || 'Failed to submit lost report');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="form-container">
      <h2>Report Lost Item</h2>
      {err && <div className="error">{err}</div>}

      <form onSubmit={handleSubmit} className="form">
        <fieldset className="form-section">
          <legend>Your contact</legend>
          <label>
            Name *
            <input type="text" value={reporterName} onChange={e => setReporterName(e.target.value)} />
          </label>

          <label>
            Phone *
            <input type="tel" value={reporterPhone} onChange={e => setReporterPhone(e.target.value)} placeholder="0917..." />
          </label>

          <label>
            Email (optional)
            <input type="email" value={reporterEmail} onChange={e => setReporterEmail(e.target.value)} />
          </label>
        </fieldset>

        <fieldset className="form-section">
          <legend>Item details</legend>
          <label>
            Item name *
            <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} />
          </label>

          <label>
            Category *
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">-- choose category --</option>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </label>

          {category === 'other' && (
            <label>
              Specify category
              <input type="text" value={categoryOther} onChange={e => setCategoryOther(e.target.value)} placeholder="e.g. musical instrument" />
            </label>
          )}

          <label>
            Description *
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} />
          </label>
        </fieldset>

        <fieldset className="form-section">
          <legend>Last seen</legend>

          <div className="form-row">
            <div className="col">
              <label>
                Unit *
                <select value={lastSeenUnit} onChange={e => setLastSeenUnit(e.target.value)} disabled={loadingUnits}>
                  <option value="">{loadingUnits ? '-- loading units --' : '-- choose unit --'}</option>
                  {units.map(u => <option key={u._id || u.id} value={u._id || u.id}>{u.name}{u.code ? ` (${u.code})` : ''}</option>)}
                </select>
              </label>
            </div>

            <div className="col">
              <label>
                Date last seen
                <input type="date" value={dateLastSeen} onChange={e => setDateLastSeen(e.target.value)} />
              </label>
            </div>
          </div>

          <label>
            Details (floor, room)
            <input type="text" value={lastSeenDetails} onChange={e => setLastSeenDetails(e.target.value)} placeholder="e.g. 2F near gate" />
          </label>
        </fieldset>

        <fieldset className="form-section">
          <legend>Optional</legend>
          <label>
            Education level
            <input type="text" value={educationLevel} onChange={e => setEducationLevel(e.target.value)} placeholder="e.g. college" />
          </label>

          <label>
            Department
            <input type="text" value={department} onChange={e => setDepartment(e.target.value)} />
          </label>

          <label>
            Photo (upload) — optional
            <input type="file" accept="image/*" onChange={onFileChange} />
            {photoPreviewUrl && (
              <div className="file-preview">
                <img src={photoPreviewUrl} alt="preview" />
                <div>
                  <div className="muted">Selected: {photoFile?.name} — {(photoFile?.size / 1024 / 1024).toFixed(2)} MB</div>
                  <div className="form-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => { setPhotoFile(null); setPhotoUrl(''); }}>Remove photo</button>
                  </div>
                </div>
              </div>
            )}
          </label>

          <label>
            — or provide Photo URL (optional)
            <input type="text" value={photoUrl} onChange={e => { setPhotoUrl(e.target.value); if (e.target.value) setPhotoFile(null); }} placeholder="https://..." />
            <div className="helper">If you choose a file it will be uploaded. Providing a URL is an alternative.</div>
          </label>
        </fieldset>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Report'}</button>
        </div>
      </form>

      {matchesPreview.length > 0 && (
        <section className="panel">
          <h3>Potential matches</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {matchesPreview.map(m => (
              <div key={typeof m === 'string' ? m : (m._id || JSON.stringify(m))} style={{ padding: 8, border: '1px solid rgba(15,23,32,0.03)', borderRadius: 6 }}>
                {typeof m === 'string' ? m : (m.item_name || m._id || JSON.stringify(m))}
              </div>
            ))}
          </div>
          <div className="helper">You will be notified if any of these are confirmed matches.</div>
        </section>
      )}
    </div>
  );
}
