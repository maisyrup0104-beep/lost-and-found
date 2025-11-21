// src/components/RoleRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RoleRoute({ roles, children }) {
  const { user } = useAuth();

  // still initializing user (if you ever use undefined loading state)
  if (user === undefined) {
    return null; // or spinner
  }

  // Not authenticated -> send to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Normalize allowed roles
  const allowed = Array.isArray(roles) ? roles : [roles];

  // If user has correct role -> allow access
  if (allowed.includes(user.role)) {
    return children;
  }

  /**
   * User is authenticated but DOES NOT have the required role.
   * We redirect based on their actual role:
   * - manager → /dashboard/manager
   * - it_admin → /dashboard/it
   * - user (general) → /dashboard
   */
  if (user.role === 'manager') {
    return <Navigate to="/dashboard/manager" replace />;
  }

  if (user.role === 'it_admin') {
    return <Navigate to="/dashboard/it" replace />;
  }

  // default for normal users
  return <Navigate to="/dashboard" replace />;
}