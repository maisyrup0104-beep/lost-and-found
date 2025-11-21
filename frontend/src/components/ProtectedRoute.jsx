// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  // If your AuthContext sets user to `undefined` while checking (loading),
  // render nothing (or a spinner). Returning null prevents flashing.
  if (user === undefined) {
    return null;
  }

  // Not authenticated -> redirect to login and preserve full attempted URL.
  if (!user) {
    // avoid redirect loop: if the user is already on login/register, don't set that as `from`
    const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
    const from = isAuthPage ? '/dashboard' : (location.pathname + location.search + location.hash);

    return <Navigate to="/login" replace state={{ from }} />;
  }

  // Authenticated — allow access
  return children;
}