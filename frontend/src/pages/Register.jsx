// src/pages/Register.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const EDUC_LEVELS = ['elementary','jhs','shs','college','other'];
const USER_TYPES = ['student','teaching_staff','non_teaching_staff'];

export default function Register(){
  const { register } = useAuth();
  const [form, setForm] = useState({ name:'', user_type:'student', department:'', education_level:'', phone:'', password:'' });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  function setField(k,v){ setForm(prev=>({...prev,[k]:v})); }

  async function onSubmit(e){
    e.preventDefault(); setErr(null);
    if(!form.name || !form.user_type || !form.phone || !form.password){ setErr('Fill required fields'); return; }
    if(form.user_type !== 'student' && form.education_level){ setErr('education_level applies only to students'); return; }
    setLoading(true);
    try {
      await register({
        name: form.name,
        user_type: form.user_type,
        department: form.department || undefined,
        education_level: form.user_type === 'student' ? (form.education_level || undefined) : undefined,
        phone: form.phone,
        password: form.password
      });
    } catch (e) { setErr(e.message || 'Register failed'); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={onSubmit} style={{maxWidth:520, margin:'20px auto', display:'flex', flexDirection:'column', gap:12}}>
      <h2>Register</h2>
      {err && <div style={{color:'red'}}>{err}</div>}
      <label>Name<input value={form.name} onChange={e=>setField('name', e.target.value)} /></label>
      <label>User Type
        <select value={form.user_type} onChange={e=>setField('user_type', e.target.value)}>
          {USER_TYPES.map(t=> <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      {form.user_type === 'student' && (
        <label>Education level
          <select value={form.education_level} onChange={e=>setField('education_level', e.target.value)}>
            <option value="">-- optional --</option>
            {EDUC_LEVELS.map(l=> <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      )}
      <label>Department<input value={form.department} onChange={e=>setField('department', e.target.value)} /></label>
      <label>Phone<input value={form.phone} onChange={e=>setField('phone', e.target.value)} /></label>
      <label>Password<input type="password" value={form.password} onChange={e=>setField('password', e.target.value)} /></label>
      <button type="submit" disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
    </form>
  );
}
