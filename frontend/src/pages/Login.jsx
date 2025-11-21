// src/pages/Login.jsx
import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // support return-to: could be a string path or a location-like object
  const rawFrom = location.state?.from;
  const from = typeof rawFrom === 'string' ? rawFrom : (rawFrom?.pathname || null);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const phoneRef = useRef();
  const passRef = useRef();

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null);

    const p = (phone || '').trim();
    const pw = password || '';

    if (!p) {
      setErr('Phone is required');
      phoneRef.current?.focus();
      return;
    }
    if (!pw) {
      setErr('Password is required');
      passRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      // login returns the user object (AuthContext sets user too)
      const u = await login({ phone: p, password: pw });

      // If a "from" path was provided (e.g., user tried to access a protected page),
      // prefer that — but avoid redirecting back to /login or /register.
      if (from && from !== '/login' && from !== '/register') {
        // If 'from' is a manager or IT page but user role doesn't match, fall through to role routing below.
        // Basic safety check: if from contains '/dashboard/manager' only allow managers, etc.
        if (from.startsWith('/dashboard/manager') && u?.role !== 'manager') {
          // not allowed -> fall through
        } else if (from.startsWith('/dashboard/it') && u?.role !== 'it_admin') {
          // not allowed -> fall through
        } else {
          navigate(from, { replace: true });
          return;
        }
      }

      // Role-based fallback routing
      if (u && u.role === 'manager') {
        navigate('/dashboard/manager', { replace: true });
      } else if (u && u.role === 'it_admin') {
        navigate('/dashboard/it', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (e) {
      console.error('login error', e);
      const msg = e?.message || e?.data?.error || 'Login failed';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 16, position: 'relative' }}>
      <h2>Login</h2>

      {/* Main error area */}
      {err && (
        <div role="alert" style={{ color: 'red', marginBottom: 12 }}>
          {err}
        </div>
      )}

      {/* Popup-like suggestion when there's a login error */}
      {err && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: '#fff7f7',
            border: '1px solid #ffcccc',
            padding: '10px 12px',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            maxWidth: 260,
            zIndex: 20
          }}
        >
          <div style={{ fontSize: 13, color: '#b00000', marginBottom: 8 }}>
            No account yet?
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link to="/register" style={{ fontSize: 13, color: '#0077cc', textDecoration: 'underline' }}>
              Register
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 8 }}>
        <label>
          Phone
          <input
            ref={phoneRef}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
            autoComplete="tel"
            inputMode="tel"
          />
        </label>

        <label>
          Password
          <input
            ref={passRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="current-password"
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <button type="submit" disabled={loading} style={{ minWidth: 120 }}>
            {loading ? 'Logging in…' : 'Login'}
          </button>

          {/* Small register link at bottom-right of the form */}
          <div style={{ marginLeft: 'auto', fontSize: 14 }}>
            <Link to="/register" style={{ color: '#0077cc', textDecoration: 'underline' }}>
              Register
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
