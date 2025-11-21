// src/contexts/UnitsContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../api/apiClient';

const UnitsContext = createContext();

export function UnitsProvider({ children }) {
  const [units, setUnits] = useState([]);
  const [staffs, setStaffs] = useState([]); // backend "managers", frontend "staffs"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // loadUnits: try listUnitsWithManagers then fallback to listUnits + admin users
  const loadUnits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let unitsRes;
      try {
        unitsRes = await api.listUnitsWithManagers();
        unitsRes = unitsRes && unitsRes.units ? unitsRes.units : unitsRes;
      } catch (e) {
        const arr = await api.listUnits();
        unitsRes = Array.isArray(arr) ? arr : (arr.units || arr || []);
      }

      // try to fetch manager list (optional - requires auth)
      let managersArr = [];
      try {
        const base = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
        const r = await fetch(`${base}/admin/users?role=manager`, { credentials: 'include' });
        if (r.ok) {
          const json = await r.json();
          managersArr = Array.isArray(json) ? json : (json.users || json.managers || []);
        }
      } catch (e) {
        // silent fallback if admin endpoint not available
        managersArr = [];
      }

      // attach managers to units if units don't already include them
      let finalUnits = Array.isArray(unitsRes) ? unitsRes : (unitsRes.units || []);
      if (finalUnits && finalUnits.length && !(finalUnits[0].managers)) {
        const map = {};
        (managersArr || []).forEach(m => {
          const key = m.unit_id ? String(m.unit_id) : null;
          if (!key) return;
          map[key] = map[key] || [];
          map[key].push({ _id: m._id, name: m.name });
        });
        finalUnits = finalUnits.map(u => ({ ...u, managers: map[String(u._id)] || [] }));
      }

      setUnits(Array.isArray(finalUnits) ? finalUnits : []);
      setStaffs(Array.isArray(managersArr) ? managersArr : []);
      return { units: finalUnits, staffs: managersArr };
    } catch (err) {
      console.error('UnitsContext.loadUnits error', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <UnitsContext.Provider value={{ units, setUnits, staffs, setStaffs, loadUnits, loading, error }}>
      {children}
    </UnitsContext.Provider>
  );
}

export function useUnits() {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error('useUnits must be used inside UnitsProvider');
  return ctx;
}
