// src/pages/MyClaims.jsx
import React, { useEffect, useState } from "react";
import { api } from "../api/apiClient";
import { useAuth } from "../contexts/AuthContext";

function formatDate(d) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return d;
  }
}

export default function MyClaims() {
  const { user } = useAuth();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    loadClaims();
  }, []);

  async function loadClaims() {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.myClaims(); // backend returns { claims: [...] }
      const arr = Array.isArray(res) ? res : res.claims || [];
      setClaims(arr);
    } catch (e) {
      console.error("my claims", e);
      setErr(e.message || "Failed to load claims");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "20px auto", padding: 20 }}>
      <h1>My Claims</h1>

      {err && <div style={{ color: "red", marginBottom: 12 }}>{err}</div>}

      {loading ? (
        <div>Loading...</div>
      ) : claims.length === 0 ? (
        <div style={{ padding: 20, color: "#666" }}>
          You haven’t submitted any claims yet.
        </div>
      ) : (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {claims.map((c) => {
            // IMPORTANT FIX: backend uses found_item_id as populated field
            const found = c.found_item_id || {};

            return (
              <div
                key={c._id}
                style={{
                  border: "1px solid #eee",
                  padding: 16,
                  borderRadius: 8,
                  background: "#fff",
                }}
              >
                <h3 style={{ margin: "0 0 6px 0" }}>
                  {found.item_name || "Item"}
                </h3>

                <div style={{ fontSize: 14, color: "#555", marginBottom: 6 }}>
                  Status: <strong>{c.status}</strong>
                </div>

                <div style={{ fontSize: 13, color: "#777" }}>
                  Submitted: {formatDate(c.created_at)}
                </div>

                {found.category && (
                  <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                    Category: {found.category}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}