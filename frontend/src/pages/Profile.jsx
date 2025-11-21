// src/pages/Profile.jsx
import React, { useEffect, useState } from 'react';
import { api } from '../api/apiClient';
import { useAuth } from '../contexts/AuthContext';

export default function Profile() {
  const { user, setUser, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // editable profile fields
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [role, setRole] = useState(user?.role || '');

  // change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await api.getMe();
        // normalize possible response shapes
        const u = res?.user || res;
        if (!mounted) return;
        if (u) {
          setUser && setUser(u);
          setName(u.name || '');
          setPhone(u.phone || '');
          setRole(u.role || '');
        }
      } catch (e) {
        // keep context user if any; surface a gentle message
        console.warn('profile load', e);
        // no hard error — user might not have /auth/me endpoint
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setUser]);

  async function handleUpdateProfile(e) {
    e.preventDefault();
    setErr(null);
    if (!name || !phone) {
      setErr('Name and phone are required.');
      return;
    }
    setUpdating(true);
    try {
      const res = await api.updateProfile({ name: name.trim(), phone: phone.trim() });
      const u = res?.user || res;
      if (u) {
        setUser && setUser(u);
        setName(u.name || '');
        setPhone(u.phone || '');
        setRole(u.role || '');
      }
      alert('Profile updated');
    } catch (e) {
      console.error('updateProfile', e);
      setErr(e?.data?.error || e?.message || 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setErr(null);
    if (!currentPassword || !newPassword) {
      setErr('Please fill both current and new password.');
      return;
    }
    setChangingPwd(true);
    try {
      await api.changePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
      alert('Password changed. You will be logged out and must sign in with your new password.');
      try { await logout(); } catch (e) { console.warn('logout after pwd change', e); }
    } catch (e) {
      console.error('changePassword', e);
      setErr(e?.data?.error || e?.message || 'Failed to change password');
    } finally {
      setChangingPwd(false);
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Loading profile...</div>;

  return (
    <div style={{ maxWidth: 800, margin: '20px auto', padding: 16 }}>
      <h1>My Profile</h1>

      {err && <div style={{ color: 'red', marginBottom: 12 }}>{err}</div>}

      <section style={{ padding: 12, border: '1px solid #eee', borderRadius: 8, marginBottom: 16 }}>
        <h3>Account information</h3>
        <form onSubmit={handleUpdateProfile} style={{ display: 'grid', gap: 10 }}>
          <label>
            Name
            <input value={name} onChange={e => setName(e.target.value)} />
          </label>

          <label>
            Phone
            <input value={phone} onChange={e => setPhone(e.target.value)} />
          </label>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="submit" disabled={updating}>{updating ? 'Saving...' : 'Save changes'}</button>
            <div style={{ marginLeft: 'auto', fontSize: 13, color: '#555' }}>
              <div><strong>Role:</strong> {role || 'user'}</div>
            </div>
          </div>
        </form>
      </section>

      <section style={{ padding: 12, border: '1px solid #eee', borderRadius: 8, marginBottom: 16 }}>
        <h3>Change password</h3>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
          For security we do not show your current password. Use the form below to change it.
        </div>

        <form onSubmit={handleChangePassword} style={{ display: 'grid', gap: 8 }}>
          <label>
            Current password
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
          </label>

          <label>
            New password
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </label>

          <div>
            <button type="submit" disabled={changingPwd}>
              {changingPwd ? 'Changing...' : 'Change password'}
            </button>
          </div>
        </form>
      </section>

      <section style={{ fontSize: 13, color: '#666' }}>
        <div><strong>Phone:</strong> {phone || '-'}</div>
        <div style={{ marginTop: 8 }}>
          <strong>Note:</strong> Passwords are stored securely (hashed) and cannot be displayed in plaintext.
        </div>
      </section>
    </div>
  );
}