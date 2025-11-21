// src/pages/DashboardIT.jsx
import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api/apiClient';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardIT() {
  const { logout } = useAuth();

  // core data
  const [units, setUnits] = useState([]);
  const [users, setUsers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [totals, setTotals] = useState({ users: null, found: null, reports: null, claims: null });

  // promote flows
  const [q, setQ] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [promoteUnitId, setPromoteUnitId] = useState('');
  const [promoting, setPromoting] = useState(false);

  // create manager
  const [mgrName, setMgrName] = useState('');
  const [mgrPhone, setMgrPhone] = useState('');
  const [mgrDepartment, setMgrDepartment] = useState('');
  const [mgrUnitId, setMgrUnitId] = useState('');
  const [creating, setCreating] = useState(false);

  // convert/demote
  const [converting, setConverting] = useState(false);

  // Units CRUD state (separate management area)
  const [unitForm, setUnitForm] = useState({ name: '', code: '', type: 'facility', aliases: '' });
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [unitSaving, setUnitSaving] = useState(false);
  const [unitDeleting, setUnitDeleting] = useState(false);

  async function handleInvalidToken() {
    setErr('Invalid session — please log in again.');
    try { await logout(); } catch (e) { console.warn(e); }
  }

  // load users, units, managers in one shot
  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      // try backend endpoint returning units with managers (optional)
      let unitsRes;
      try {
        unitsRes = await api.listUnitsWithManagers();
        unitsRes = unitsRes && unitsRes.units ? unitsRes.units : unitsRes;
      } catch (e) {
        // fallback to plain units
        const arr = await api.listUnits();
        unitsRes = Array.isArray(arr) ? arr : (arr.units || arr || []);
      }

      // users & managers
      const [usersRes, managersRes] = await Promise.all([
        api.listUsers().catch(e => { throw e; }),
        // admin endpoint for managers (server returns { users: [...] })
        fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:4000/api'}/admin/users?role=manager`, { credentials: 'include' })
          .then(async r => {
            if (!r.ok) {
              const text = await r.text();
              const err = new Error(`Failed fetching managers (${r.status})`);
              err.status = r.status;
              err.data = text;
              throw err;
            }
            return r.json();
          })
      ]);

      const usersArr = Array.isArray(usersRes) ? usersRes : (usersRes.users || []);
      setUsers(Array.isArray(usersArr) ? usersArr : []);

      const managersArr = Array.isArray(managersRes) ? managersRes : (managersRes.users || managersRes.managers || []);
      setManagers(Array.isArray(managersArr) ? managersArr : []);

      // attach managers client-side if backend didn't include them
      let finalUnits = Array.isArray(unitsRes) ? unitsRes : (unitsRes.units || []);
      if (finalUnits && finalUnits.length && !(finalUnits[0].managers)) {
        const map = {};
        (managersArr || []).forEach(m => {
          const key = m.unit_id ? String(m.unit_id) : null;
          if (!key) return;
          map[key] = map[key] || [];
          map[key].push({ _id: m._id, name: m.name }); // phone removed intentionally
        });
        finalUnits = finalUnits.map(u => ({ ...u, managers: map[String(u._1 || u._id || u.id)] || map[String(u._id)] || [] }));
      }

      setUnits(Array.isArray(finalUnits) ? finalUnits : []);
      // update totals after loading users/units
      try {
        const publicFound = await api.listPublicFound().catch(() => null);
        const foundCount = publicFound ? (Array.isArray(publicFound) ? publicFound.length : (publicFound.items ? publicFound.items.length : (publicFound.found ? publicFound.found.length : (publicFound.total || null)))) : null;
        const usersCount = Array.isArray(usersArr) ? usersArr.length : (usersArr ? (usersArr.users ? usersArr.users.length : null) : null);

        // attempt to fetch admin lost reports count (requires IT/admin credentials)
        let reportsCount = null;
        try {
          const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
          const r = await fetch(`${apiBase}/lost-reports`, { credentials: 'include' });
          if (r.ok) {
            const data = await r.json();
            const arr = Array.isArray(data) ? data : (data.reports || data.items || []);
            reportsCount = Array.isArray(arr) ? arr.length : null;
          } else {
            // Not accessible or not present — leave as null
            reportsCount = null;
          }
        } catch (e) {
          reportsCount = null;
        }

        // attempt to fetch admin claims count (requires IT/admin credentials)
        let claimsCount = null;
        try {
          const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
          const r2 = await fetch(`${apiBase}/claims`, { credentials: 'include' });
          if (r2.ok) {
            const data2 = await r2.json();
            const arr2 = Array.isArray(data2) ? data2 : (data2.claims || data2.items || []);
            claimsCount = Array.isArray(arr2) ? arr2.length : null;
          } else {
            claimsCount = null;
          }
        } catch (e) {
          claimsCount = null;
        }

        setTotals({ users: usersCount, found: foundCount, reports: reportsCount, claims: claimsCount });
      } catch (e) {
        console.warn('failed to load totals', e);
      }
    } catch (e) {
      console.error('loadAll error', e);
      if (e?.status === 401 || (e instanceof Response && e.status === 401)) {
        await handleInvalidToken();
      } else {
        setErr(e?.message || 'Failed to load data. Check console & network.');
      }
    } finally {
      setLoading(false);
    }
  }

  // set up initial load + socket.io realtime listeners
  useEffect(() => {
    loadAll();

    // derive socket URL from VITE_API_BASE (strip trailing /api)
    const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
    const socketUrl = apiBase.replace(/\/api\/?$/, '').replace(/\/$/, ''); // e.g. http://localhost:4000

    let socket;
    try {
      socket = io(socketUrl, { withCredentials: true });

      socket.on('connect', () => {
        // console.debug('DashboardIT socket connected', socket.id);
      });

      // When backend emits any of these events, refresh the IT dashboard snapshot
      const onUpdate = () => {
        // reload the data snapshot
        loadAll().catch(err => {
          console.warn('loadAll failed on realtime event', err);
        });
      };

      socket.on('units:changed', onUpdate);
      socket.on('staffs:changed', onUpdate);
      socket.on('users:changed', onUpdate);
      // additional possible event names
      socket.on('unit:created', onUpdate);
      socket.on('unit:updated', onUpdate);
      socket.on('unit:deleted', onUpdate);
      socket.on('user:promoted', onUpdate);
      socket.on('user:demoted', onUpdate);

      socket.on('disconnect', () => {
        // console.debug('DashboardIT socket disconnected');
      });
    } catch (socketErr) {
      console.warn('Socket init failed', socketErr);
    }

    return () => {
      try {
        if (socket && socket.disconnect) socket.disconnect();
      } catch (e) { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = users.filter(u => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (u.name || '').toLowerCase().includes(s) || (u.phone || '').toLowerCase().includes(s);
  });

  // promote user -> manager
  async function handlePromote(e) {
    e.preventDefault();
    setErr(null);
    if (!selectedUser) { setErr('Click a user from search results to select'); return; }
    if (!promoteUnitId) { setErr('Select a unit'); return; }
    setPromoting(true);
    try {
      await api.promoteUser({ user_id: selectedUser._id || selectedUser.id, unit_id: promoteUnitId });
      alert('User promoted to manager');
      await loadAll();
      setSelectedUser(null);
      setPromoteUnitId('');
    } catch (e) {
      console.error('promote error', e);
      if (e?.status === 401) await handleInvalidToken();
      else setErr(e?.message || 'Promote failed');
    } finally {
      setPromoting(false);
    }
  }

  // create manager account
  async function handleCreateManager(e) {
    e.preventDefault();
    setErr(null);
    if (!mgrName || !mgrPhone || !mgrUnitId) { setErr('Name, phone, and unit required'); return; }
    setCreating(true);
    try {
      const res = await api.createManager({ name: mgrName, phone: mgrPhone, department: mgrDepartment || undefined, unit_id: mgrUnitId });
      const temp = res?.temp_password || res?.tempPassword;
      if (temp) alert(`Manager created. Temporary password: ${temp}`);
      else alert('Manager created');
      await loadAll();
      setMgrName(''); setMgrPhone(''); setMgrDepartment(''); setMgrUnitId('');
    } catch (e) {
      console.error('create manager error', e);
      if (e?.status === 401) await handleInvalidToken();
      else setErr(e?.message || 'Create manager failed');
    } finally {
      setCreating(false);
    }
  }

  // demote manager (kept but UI doesn't show direct remove in the read-only table)
  async function handleRemoveManager(userId) {
    if (!confirm('Convert this manager back to a normal user?')) return;
    setErr(null);
    setConverting(true);
    try {
      await api.demoteUser({ user_id: userId });
      alert('Manager converted to user');
      await loadAll();
    } catch (e) {
      console.error('remove/convert error', e);
      if (e?.status === 401) await handleInvalidToken();
      else setErr(e?.message || 'Conversion failed');
    } finally {
      setConverting(false);
    }
  }

  // Units CRUD handlers (in the dedicated management section)
  function onUnitFormChange(key, value) {
    setUnitForm(prev => ({ ...prev, [key]: value }));
  }

  function startEditUnit(unit) {
    setEditingUnitId(unit._id || unit.id);
    setUnitForm({
      name: unit.name || '',
      code: unit.code || '',
      type: unit.type || 'facility',
      aliases: Array.isArray(unit.aliases) ? unit.aliases.join(', ') : (unit.aliases || '')
    });
  }

  function resetUnitForm() {
    setEditingUnitId(null);
    setUnitForm({ name: '', code: '', type: 'facility', aliases: '' });
    setUnitSaving(false);
  }

  async function handleSaveUnit(e) {
    e.preventDefault();
    setErr(null);
    if (!unitForm.name || !unitForm.name.trim()) { setErr('Unit name required'); return; }

    const payload = {
      name: unitForm.name.trim(),
      code: unitForm.code ? unitForm.code.trim() : null,
      type: unitForm.type || 'facility',
      aliases: unitForm.aliases ? unitForm.aliases.split(',').map(s => s.trim()).filter(Boolean) : []
    };

    setUnitSaving(true);
    try {
      if (editingUnitId) {
        await api.updateUnit(editingUnitId, payload);
        alert('Unit updated');
      } else {
        await api.createUnit(payload);
        alert('Unit created');
      }
      await loadAll();
      resetUnitForm();
    } catch (e) {
      console.error('save unit error', e);
      if (e?.status === 401) await handleInvalidToken();
      else setErr(e?.message || 'Failed to save unit');
    } finally {
      setUnitSaving(false);
    }
  }

  async function handleDeleteUnit(id) {
    if (!confirm('Delete this unit? Ensure there are no managers assigned before deleting.')) return;
    setUnitDeleting(true);
    setErr(null);
    try {
      await api.deleteUnit(id);
      alert('Unit deleted');
      await loadAll();
    } catch (e) {
      console.error('delete unit error', e);
      if (e?.status === 401) await handleInvalidToken();
      else setErr(e?.message || 'Failed to delete unit');
    } finally {
      setUnitDeleting(false);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <h1>IT Dashboard</h1>
      <div style={{ display: 'flex', gap: 12, margin: '10px 0 20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', padding: 12, border: '1px solid #eee', borderRadius: 8, textAlign: 'center' }}>
          <div className="muted">Users</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{totals.users ?? '—'}</div>
        </div>
        <div style={{ flex: '1 1 220px', padding: 12, border: '1px solid #eee', borderRadius: 8, textAlign: 'center' }}>
          <div className="muted">Found Items (public)</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{totals.found ?? '—'}</div>
        </div>
        <div style={{ flex: '1 1 220px', padding: 12, border: '1px solid #eee', borderRadius: 8, textAlign: 'center' }}>
          <div className="muted">Lost Reports</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{totals.reports ?? '—'}</div>
        </div>
        <div style={{ flex: '1 1 220px', padding: 12, border: '1px solid #eee', borderRadius: 8, textAlign: 'center' }}>
          <div className="muted">Claims</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{totals.claims ?? '—'}</div>
        </div>
      </div>
      {err && <div style={{ color: 'red', marginBottom: 12 }}>{err}</div>}
      {loading && <div>Loading...</div>}

      {/* Top area: Promote / Create Manager */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {/* Promote */}
        <div style={{ flex: 1, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
          <h3>Promote user to Staff</h3>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Search users
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="type name or phone" style={{ display: 'block', width: '100%', marginTop: 6 }} />
          </label>
          <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #f0f0f0', padding: 8, marginBottom: 8 }}>
            {filteredUsers.length === 0 ? (
              <div style={{ padding: 8, color: '#666' }}>No users found.</div>
            ) : filteredUsers.map(u => {
              const isSel = selectedUser && (selectedUser._id === u._id || selectedUser.id === u.id);
              return (
                <div key={u._id || u.id}
                  onClick={() => setSelectedUser(u)}
                  style={{
                    padding: 8,
                    marginBottom: 6,
                    background: isSel ? '#eef6ff' : '#fff',
                    border: '1px solid #eee',
                    cursor: 'pointer'
                  }}>
                  <div style={{ fontWeight: 600 }}>{u.name || '(no name)'}</div>
                  <div style={{ fontSize: 13, color: '#444' }}>{u.phone || '-'} • {u.role || '-'}</div>
                </div>
              );
            })}
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ marginBottom: 6 }}>Selected: <strong>{selectedUser ? `${selectedUser.name} — ${selectedUser.phone}` : 'None'}</strong></div>
            <label>
              Select unit
              <select value={promoteUnitId} onChange={e => setPromoteUnitId(e.target.value)} style={{ display: 'block', marginTop: 6 }}>
                <option value="">-- select unit --</option>
                {units.map(u => <option key={u._id} value={u._id}>{u.name} ({u.code || ''})</option>)}
              </select>
            </label>
          </div>

          <div>
            <button onClick={handlePromote} disabled={promoting}>{promoting ? 'Promoting...' : 'Promote'}</button>
          </div>
        </div>

        {/* Create Manager */}
        <div style={{ width: 420, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
          <h3>Create Staff</h3>
          <form onSubmit={handleCreateManager} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label>Name<input value={mgrName} onChange={e => setMgrName(e.target.value)} /></label>
            <label>Phone<input value={mgrPhone} onChange={e => setMgrPhone(e.target.value)} placeholder="0917..." /></label>
            <label>Department<input value={mgrDepartment} onChange={e => setMgrDepartment(e.target.value)} /></label>
            <label>Unit
              <select value={mgrUnitId} onChange={e => setMgrUnitId(e.target.value)}>
                <option value="">-- select unit --</option>
                {units.map(u => <option key={u._id} value={u._id}>{u.name} ({u.code || ''})</option>)}
              </select>
            </label>
            <button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Manager'}</button>
          </form>
        </div>
      </div>

      {/* Two-column: Units Management (left) + Units CRUD form (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 20, marginBottom: 24 }}>
        {/* Left: Units Management (CRUD) */}
        <div>
          <section style={{ padding: 12, border: '1px solid #eee', borderRadius: 8, marginBottom: 16 }}>
            <h2>Manage Units</h2>
            <div style={{ marginBottom: 12 }}>
              This is the dedicated area to add, edit or delete units.
            </div>

            <div style={{ overflowX: 'auto', marginBottom: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                    <th style={{ padding: 8 }}>Name</th>
                    <th style={{ padding: 8 }}>Code</th>
                    <th style={{ padding: 8 }}>Type</th>
                    <th style={{ padding: 8 }}>Aliases</th>
                    <th style={{ padding: 8 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {units.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 10, color: '#666' }}>No units yet.</td>
                    </tr>
                  )}
                  {units.map(u => (
                    <tr key={u._id || u.id} style={{ borderBottom: '1px solid #f6f6f6' }}>
                      <td style={{ padding: 8 }}>{u.name}</td>
                      <td style={{ padding: 8 }}>{u.code || '-'}</td>
                      <td style={{ padding: 8 }}>{u.type || '-'}</td>
                      <td style={{ padding: 8 }}>{Array.isArray(u.aliases) ? u.aliases.join(', ') : (u.aliases || '')}</td>
                      <td style={{ padding: 8 }}>
                        <button onClick={() => startEditUnit(u)} style={{ marginRight: 8 }}>Edit</button>
                        <button onClick={() => handleDeleteUnit(u._id)} disabled={unitDeleting} style={{ background: '#d32f2f', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 6 }}>
                          {unitDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right: Units CRUD form */}
        <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
          <h3>{editingUnitId ? 'Edit Unit' : 'Create Unit'}</h3>
          <form onSubmit={handleSaveUnit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label>
              Name *
              <input value={unitForm.name} onChange={e => onUnitFormChange('name', e.target.value)} />
            </label>
            <label>
              Code
              <input value={unitForm.code} onChange={e => onUnitFormChange('code', e.target.value)} placeholder="e.g. LIB" />
            </label>
            <label>
              Type
              <select value={unitForm.type} onChange={e => onUnitFormChange('type', e.target.value)}>
                <option value="facility">facility</option>
                <option value="academic">academic</option>
              </select>
            </label>
            <label>
              Aliases (comma separated)
              <input value={unitForm.aliases} onChange={e => onUnitFormChange('aliases', e.target.value)} placeholder="lib, library" />
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={unitSaving}>{unitSaving ? (editingUnitId ? 'Saving...' : 'Creating...') : (editingUnitId ? 'Save changes' : 'Create unit')}</button>
              {editingUnitId && <button type="button" onClick={resetUnitForm}>Cancel</button>}
            </div>

            <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
              Tip: To assign staff to a unit, promote a user and select the unit during promotion or create staff flows.
            </div>
          </form>
        </div>
      </div>

      {/* Read-only Units & Managers representation (grouped by type) */}
      <section style={{ padding: 12, border: '1px solid #eee', borderRadius: '8px', marginBottom: 16 }}>
        <h2>Units & Staffs</h2>
        <div style={{ marginBottom: 10, fontSize: 13, color: '#666' }}>
          This table is for representation only. Use the Units Manage area above to change units and use Promote/Create Manager to assign staffs.
        </div>

        {/* Group units by type */}
        {['academic', 'facility'].map(typeKey => {
          const group = units.filter(u => (u.type || 'facility') === typeKey);
          if (!group.length) return null;
          return (
            <div key={typeKey} style={{ marginBottom: 16 }}>
              <h4 style={{ textTransform: 'capitalize', marginBottom: 8 }}>{typeKey === 'academic' ? 'Academic' : 'Campus Facility'}</h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                      <th style={{ padding: 8 }}>Unit</th>
                      <th style={{ padding: 8 }}>Staff(s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map(u => (
                      <tr key={u._id || u.id} style={{ borderBottom: '1px solid #f6f6f6' }}>
                        <td style={{ padding: 8 }}>{u.name}</td>
                        <td style={{ padding: 8 }}>
                          {Array.isArray(u.managers) && u.managers.length ? (
                            u.managers.map(m => <div key={m._id || m.id}>{m.name}</div>)
                          ) : (
                            <span style={{ color: '#666' }}>No staff</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </section>

      {/* Compact Managers list with Demote action */}
      <section style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
        <h2>Staffs</h2>
        <div style={{ marginBottom: 10, fontSize: 13, color: '#666' }}>
          Quick list of staffs — demote a staff using the button if needed.
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>Name</th>
                <th style={{ padding: 8 }}>Unit</th>
                <th style={{ padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {managers.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: 10, color: '#666' }}>No managers found.</td>
                </tr>
              )}
              {managers.map(m => {
                const unit = (m.unit_id && typeof m.unit_id === 'object') ? m.unit_id : units.find(u => String(u._id) === String(m.unit_id));
                return (
                  <tr key={m._id || m.id} style={{ borderBottom: '1px solid #f6f6f6' }}>
                    <td style={{ padding: 8 }}>{m.name}</td>
                    <td style={{ padding: 8 }}>{unit ? unit.name : 'Not assigned'}</td>
                    <td style={{ padding: 8 }}>
                      <button
                        onClick={() => handleRemoveManager(m._id)}
                        disabled={converting}
                        style={{ background: '#d32f2f', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 6 }}
                      >
                        {converting ? 'Removing...' : 'Demote'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
