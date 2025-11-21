// src/pages/ReportFound.jsx
import React, { useEffect, useState } from 'react';
import { api } from '../api/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

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

export default function ReportFound() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [categoryOther, setCategoryOther] = useState('');
  const [description, setDescription] = useState('');
  const [foundLocation, setFoundLocation] = useState(''); // unit id
  const [foundLocationDetails, setFoundLocationDetails] = useState('');
  const [dateFound, setDateFound] = useState('');
  const [custody, setCustody] = useState('B'); // A | B | C
  const [finderName, setFinderName] = useState('');
  const [finderPhone, setFinderPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState(''); // optional external URL

  // File upload
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);

  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  // Redirect to login if not signed in
  useEffect(() => {
    if (user === null) {
      nav('/login', { state: { from: '/report-found' } });
    }
  }, [user, nav]);

  useEffect(() => {
    // prefill finder info from logged-in user if available
    if (user) {
      if (user.name) setFinderName(user.name);
      if (user.phone) setFinderPhone(user.phone);
    }
    loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    // create preview URL for file and revoke on cleanup / change
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
      const arr = Array.isArray(res) ? res : res.units || res || [];
      setUnits(arr);
      // set default foundLocation only if not already set
      if (arr.length && !foundLocation) {
        setFoundLocation(arr[0]._id || arr[0].id);
      }
    } catch (e) {
      console.error('loadUnits', e);
      setErr(e?.message || 'Failed to load units');
    } finally {
      setLoadingUnits(false);
    }
  }

  function validate() {
    if (!itemName || !itemName.trim()) { setErr('Item name is required'); return false; }
    const finalCategory = category === 'other' ? (categoryOther || '').trim() : category;
    if (!finalCategory) { setErr('Category is required'); return false; }
    if (!description || !description.trim()) { setErr('Description is required'); return false; }
    if (!foundLocation) { setErr('Found location (unit) is required'); return false; }

    // optional file validation (size < 5MB, image)
    if (photoFile) {
      const maxBytes = 5 * 1024 * 1024;
      if (photoFile.size > maxBytes) { setErr('Photo must be under 5MB'); return false; }
      if (!photoFile.type.startsWith('image/')) { setErr('Photo must be an image file'); return false; }
    }

    return true;
  }

  function onFileChange(e) {
    setErr(null);
    const f = e.target.files && e.target.files[0];
    if (!f) {
      setPhotoFile(null);
      return;
    }
    setPhotoFile(f);
    // if user selected file, clear external URL (to avoid confusion)
    if (photoUrl) setPhotoUrl('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null);
    if (!validate()) return;

    const finalCategory = category === 'other' ? categoryOther.trim() : category;

    setSubmitting(true);
    try {
      // Build FormData — prefer file upload if provided, otherwise allow photo_url field
      const fd = new FormData();
      fd.append('item_name', (itemName || '').trim());
      fd.append('category', finalCategory);
      fd.append('description', (description || '').trim());
      fd.append('found_location_general', foundLocation);
      if (foundLocationDetails) fd.append('found_location_details', foundLocationDetails.trim());
      if (dateFound) fd.append('date_found', dateFound);
      fd.append('custody', custody);
      if (finderName) fd.append('finder_name', finderName.trim());
      if (finderPhone) fd.append('finder_phone', finderPhone.trim());

      if (photoFile) {
        fd.append('photo', photoFile); // backend expects field 'photo'
      } else if (photoUrl && photoUrl.trim()) {
        fd.append('photo_url', photoUrl.trim()); // fallback to external URL
      }

      // Use multipart endpoint
      await api.createFoundForm(fd);

      alert('Found item submitted. It will appear in manager inbox for verification.');
      nav('/found');
    } catch (e) {
      console.error('createFound', e);
      setErr(e?.data?.error || e?.message || 'Failed to submit found item');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="form-container">
      <h2>Report Found Item</h2>

      {err && <div className="error">{err}</div>}

      <form onSubmit={handleSubmit} className="form">
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
          <legend>Where & when</legend>

          <div className="form-row">
            <div className="col">
              <label>
                Found location (unit) *
                <select value={foundLocation} onChange={e => setFoundLocation(e.target.value)} disabled={loadingUnits}>
                  <option value="">{loadingUnits ? '-- loading units --' : '-- choose unit --'}</option>
                  {units.map(u => (
                    <option key={u._id || u.id} value={u._id || u.id}>
                      {u.name}{u.code ? ` (${u.code})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="col">
              <label>
                Date found
                <input type="date" value={dateFound} onChange={e => setDateFound(e.target.value)} />
              </label>
            </div>
          </div>

          <label>
            Details (floor, bench, etc.)
            <input type="text" value={foundLocationDetails} onChange={e => setFoundLocationDetails(e.target.value)} placeholder="e.g. near gate" />
          </label>
        </fieldset>

        <fieldset className="form-section">
          <legend>Finder (you)</legend>

          <label>
            Your name
            <input type="text" value={finderName} onChange={e => setFinderName(e.target.value)} />
          </label>

          <label>
            Your phone
            <input type="tel" value={finderPhone} onChange={e => setFinderPhone(e.target.value)} placeholder="0917..." />
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

          <label>
            Custody
            <select value={custody} onChange={e => setCustody(e.target.value)}>
              <option value="A">A - Finder still has it</option>
              <option value="B">B - Turned in</option>
              <option value="C">C - Logged by manager</option>
            </select>
          </label>
        </fieldset>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting || loadingUnits}>
            {submitting ? 'Submitting...' : 'Submit found item'}
          </button>
        </div>
      </form>
    </div>
  );
}
