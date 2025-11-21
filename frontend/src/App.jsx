// src/App.jsx
import React from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';

import DashboardUser from './pages/DashboardUser';
import MyClaims from './pages/MyClaims';
import FoundPublic from './pages/FoundPublic';
import ReportLost from './pages/ReportLost';
import ReportFound from './pages/ReportFound';

import DashboardIT from './pages/DashboardIT';
import ManagersList from './pages/ManagersList';
import DashboardManager from './pages/DashboardManager';

import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import HomeHero from './components/HomeHero';

import ClaimItem from './pages/ClaimItem';

import { useAuth } from './contexts/AuthContext';

export default function App() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Navigate to the correct dashboard depending on role
  function goToDashboardByRole() {
    if (!user) {
      navigate('/', { replace: true });
      return;
    }
    if (user.role === 'manager') navigate('/dashboard/manager', { replace: true });
    else if (user.role === 'it_admin') navigate('/dashboard/it', { replace: true });
    else navigate('/dashboard', { replace: true });
  }

  // Component used for /dashboard route so we can redirect managers/it-admins away from the generic dashboard
  function DashboardEntry() {
    if (!user) {
      // not logged in -> login will handle redirect
      return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />;
    }
    if (user.role === 'manager') {
      return <Navigate to="/dashboard/manager" replace />;
    }
    if (user.role === 'it_admin') {
      return <Navigate to="/dashboard/it" replace />;
    }
    return <DashboardUser />;
  }

  return (
    <div>
      {/* HEADER */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 12,
          borderBottom: '1px solid #eee'
        }}
      >
        <div>
          {user ? (
            <button
              onClick={goToDashboardByRole}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                margin: 0,
                fontSize: 'inherit',
                cursor: 'pointer',
                color: '#0077cc',
                textDecoration: 'underline'
              }}
            >
              Lost & Found
            </button>
          ) : (
            <Link to="/">Lost & Found</Link>
          )}
        </div>

        <nav>
          {!user ? (
            // always show Login / Register when not logged-in
            <>
              <Link to="/login" style={{ marginRight: 12 }}>Login</Link>
              <Link to="/register">Register</Link>
            </>
          ) : (
            <>
              <span style={{ marginRight: 12 }}>Hello, {user.name}</span>
              <Link to="/profile" style={{ marginRight: 12 }}>Profile</Link>
              <button onClick={logout}>Logout</button>
            </>
          )}
        </nav>
      </header>

      {/* ROUTES */}
      <main style={{ padding: 16 }}>
        <Routes>

          {/* HOME */}
          <Route
            path="/"
            element={
              <div style={{ padding: 24 }}>
                <HomeHero />
              </div>
            }
          />

          {/* PUBLIC */}
          <Route path="/found" element={<FoundPublic />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* USER DASHBOARD ENTRY - will redirect managers/it to their dashboards */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardEntry />
              </ProtectedRoute>
            }
          />

          {/* MANAGER DASHBOARD */}
          <Route
            path="/dashboard/manager"
            element={
              <RoleRoute roles="manager">
                <ProtectedRoute>
                  <DashboardManager />
                </ProtectedRoute>
              </RoleRoute>
            }
          />

          {/* REPORT LOST */}
          <Route
            path="/report-lost"
            element={
              <ProtectedRoute>
                <ReportLost />
              </ProtectedRoute>
            }
          />

          {/* REPORT FOUND */}
          <Route
            path="/report-found"
            element={
              <ProtectedRoute>
                <ReportFound />
              </ProtectedRoute>
            }
          />

          {/* MY CLAIMS */}
          <Route
            path="/my-claims"
            element={
              <ProtectedRoute>
                <MyClaims />
              </ProtectedRoute>
            }
          />

          {/* CLAIM FLOW */}
          <Route
            path="/claim/:id"
            element={
              <ProtectedRoute>
                <ClaimItem />
              </ProtectedRoute>
            }
          />

          {/* PROFILE */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* IT DASHBOARD */}
          <Route
            path="/dashboard/it"
            element={
              <RoleRoute roles="it_admin">
                <ProtectedRoute>
                  <DashboardIT />
                </ProtectedRoute>
              </RoleRoute>
            }
          />

          {/* IT — MANAGERS */}
          <Route
            path="/dashboard/it/managers"
            element={
              <RoleRoute roles="it_admin">
                <ProtectedRoute>
                  <ManagersList />
                </ProtectedRoute>
              </RoleRoute>
            }
          />

        </Routes>
      </main>
    </div>
  );
}