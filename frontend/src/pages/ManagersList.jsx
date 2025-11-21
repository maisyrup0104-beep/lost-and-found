// src/pages/ManagersList.jsx
import React, { useEffect, useState } from "react";
import { api } from "../api/apiClient";
import { useAuth } from "../contexts/AuthContext";

/**
 * ManagersList
 *
 * Props:
 *  - unitsMap: optional object { unitId: unit } to avoid fetching units again
 *  - compact: boolean, render compact rows (no table headers)
 *  - showActions: boolean, show Actions column
 *  - onRemove: function(managerId) optional callback (UI will call it when Remove clicked)
 */
export default function ManagersList({ unitsMap: propUnitsMap = null, compact = false, showActions = false, onRemove = null }) {
  const { logout } = useAuth();
  const [managers, setManagers] = useState([]);
  const [unitsMap, setUnitsMap] = useState(propUnitsMap || {});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [removing, setRemoving] = useState(null); // managerId being removed

  useEffect(() => {
    // if parent provided a unitsMap, keep it and only load managers
    loadManagersAndUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadManagersAndUnits() {
    setLoading(true);
    setErr(null);
    try {
      // 1. load managers (via admin users endpoint filtered by role=manager)
      const mgrResp = await fetch(
        `${import.meta.env.VITE_API_BASE || "http://localhost:4000/api"}/admin/users?role=manager`,
        { credentials: "include" }
      );
      if (!mgrResp.ok) {
        if (mgrResp.status === 401) throw mgrResp;
        const txt = await mgrResp.text();
        throw new Error(txt || "Failed to load managers");
      }
      const mgrJson = await mgrResp.json();
      const users = mgrJson.users || [];

      // 2. load units only if parent didn't provide unitsMap
      let unitMap = propUnitsMap || {};
      if (!propUnitsMap) {
        try {
          const unitsRes = await api.listUnits();
          const unitArray = Array.isArray(unitsRes) ? unitsRes : unitsRes.units || [];
          unitArray.forEach((u) => {
            unitMap[u._id] = u;
          });
        } catch (ue) {
          // non-fatal; we'll still show managers with "Not assigned"
          console.warn("Failed to load units for manager list", ue);
        }
      }

      setManagers(users);
      setUnitsMap(unitMap);
    } catch (e) {
      console.error("loadManagers error", e);
      if (e instanceof Response && e.status === 401) {
        setErr("Session expired. Please log in again.");
        try { await logout(); } catch (_) { /* ignore */ }
      } else if (e.status === 401) {
        setErr("Session expired. Please log in again.");
        try { await logout(); } catch (_) { /* ignore */ }
      } else {
        setErr(e.message || "Failed to load managers.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveClick(managerId) {
    if (!onRemove) {
      // if no callback provided, show confirmation and call backend demote (safe fallback)
      if (!confirm("Convert this manager back to a normal user?")) return;
      setRemoving(managerId);
      try {
        await api.demoteUser({ user_id: managerId });
        // reload
        await loadManagersAndUnits();
      } catch (e) {
        console.error("demote error", e);
        setErr(e?.message || "Failed to convert manager");
      } finally {
        setRemoving(null);
      }
      return;
    }

    // if parent provided onRemove, call it
    try {
      if (!confirm("Convert this manager back to a normal user?")) return;
      setRemoving(managerId);
      await onRemove(managerId);
      // parent may refresh; but we'll optimistically remove from list
      setManagers((prev) => prev.filter((m) => String(m._id || m.id) !== String(managerId)));
    } catch (e) {
      console.error("onRemove callback error", e);
      setErr(e?.message || "Failed to remove manager");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Managers</h2>
      {err && <div style={{ color: "red", marginBottom: 12 }}>{err}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          {managers.length === 0 ? (
            <div style={{ padding: 10, color: "#666" }}>No managers found.</div>
          ) : compact ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {managers.map((m) => {
                const unit = typeof m.unit_id === "object" ? m.unit_id : unitsMap[m.unit_id];
                return (
                  <div key={m._id || m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 8, border: "1px solid #f4f4f4", borderRadius: 6 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{m.name}</div>
                      <div style={{ fontSize: 13, color: "#444" }}>{m.phone || "-"}</div>
                      <div style={{ fontSize: 13, color: "#666" }}>{unit ? unit.name : "Not assigned"}</div>
                    </div>
                    {showActions && (
                      <div>
                        <button
                          onClick={() => handleRemoveClick(m._id || m.id)}
                          disabled={Boolean(removing)}
                          style={{
                            background: "#d32f2f",
                            color: "white",
                            border: "none",
                            padding: "6px 10px",
                            borderRadius: 6,
                            cursor: "pointer"
                          }}
                        >
                          {removing === (m._id || m.id) ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                  <th style={{ padding: 8 }}>Name</th>
                  <th style={{ padding: 8 }}>Phone</th>
                  <th style={{ padding: 8 }}>Assigned Unit</th>
                  {showActions && <th style={{ padding: 8 }}>Actions</th>}
                </tr>
              </thead>

              <tbody>
                {managers.map((m) => {
                  const unit = typeof m.unit_id === "object" ? m.unit_id : unitsMap[m.unit_id];
                  return (
                    <tr key={m._id || m.id} style={{ borderBottom: "1px solid #f4f4f4" }}>
                      <td style={{ padding: 8 }}>{m.name}</td>
                      <td style={{ padding: 8 }}>{m.phone}</td>
                      <td style={{ padding: 8 }}>{unit ? unit.name : "Not assigned"}</td>
                      {showActions && (
                        <td style={{ padding: 8 }}>
                          <button
                            onClick={() => handleRemoveClick(m._id || m.id)}
                            disabled={Boolean(removing)}
                            style={{
                              background: "#d32f2f",
                              color: "white",
                              border: "none",
                              padding: "6px 10px",
                              borderRadius: 6,
                              cursor: "pointer"
                            }}
                          >
                            {removing === (m._id || m.id) ? "Removing..." : "Remove"}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}