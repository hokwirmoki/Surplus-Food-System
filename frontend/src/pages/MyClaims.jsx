import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

import { FaBoxOpen, FaMapMarkerAlt, FaClock } from "react-icons/fa";
import "../styles/myClaims.css";

function MyClaims() {
  const token = localStorage.getItem("token");
  const [claims, setClaims] = useState([]);

  const fetchClaims = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/recipient/claims",
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setClaims(res.data);

    } catch (err) {
      console.error("Error fetching claims:", err);
    }
  };

  const confirmPickup = async (food_id) => {
    try {
      await axios.post(
        "http://localhost:5000/api/recipient/confirm-pickup",
        { food_id },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      toast.success("Pickup confirmed!");
      fetchClaims(); // Refresh

    } catch (err) {
      toast.error("Failed to confirm pickup");
    }
  };

  useEffect(() => {
    fetchClaims();
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