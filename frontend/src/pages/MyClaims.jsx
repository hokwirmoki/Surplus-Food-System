import { useEffect, useState } from "react";
import API from "../services/api";
import { toast } from "react-toastify";

import { FaBoxOpen, FaMapMarkerAlt, FaClock } from "react-icons/fa";
import "../styles/myClaims.css";

function MyClaims() {
  const [claims, setClaims] = useState([]);

  const fetchClaims = async () => {
    try {
      const res = await API.get("/recipient/claims");

      setClaims(res.data);

    } catch {
      console.error("Error fetching claims");
    }
  };

  const confirmPickup = async (food_id) => {
    try {
      await API.post("/recipient/confirm-pickup", { food_id });

      toast.success("Pickup confirmed!");
      fetchClaims(); // Refresh

    } catch {
      toast.error("Failed to confirm pickup");
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(fetchClaims, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="claims-page">

      <h2 className="title">My Claims</h2>

      {claims.length === 0 && (
        <p className="empty">No claims yet</p>
      )}

      <div className="claims-grid">

        {claims.map((c, i) => (
          <div className="claim-card" key={i}>

            <div className="claim-header">
              <FaBoxOpen className="icon" />
              <h3>{c.food_type}</h3>
            </div>

            <p className="meta">
              <strong>Quantity claimed:</strong> {c.quantity}
            </p>

            <p className="meta location">
              <FaMapMarkerAlt className="icon small" />
              {c.location}
            </p>

            <p className="meta time">
              <FaClock className="icon small" />

              <strong>Claimed:</strong>{" "}
              {c.claimed_at
                ? new Date(c.claimed_at).toLocaleString()
                : "Not available"}
            </p>

            <p className="meta">
              <strong>Status:</strong> {c.status}
            </p>

            {c.status === 'claimed' && (
              <button onClick={() => confirmPickup(c.food_id)}>
                Confirm Pickup
              </button>
            )}

          </div>
        ))}

      </div>

    </div>
  );
}

export default MyClaims;
