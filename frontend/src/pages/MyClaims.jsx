import { useEffect, useState } from "react";
import API from "../services/api";
import { toast } from "react-toastify";
import { getDietaryLabel } from "../constants/dietaryOptions";

import {
  FaCheckCircle,
  FaInfoCircle
} from "react-icons/fa";
import "../styles/myClaims.css";

function MyClaims() {
  const [claims, setClaims] = useState([]);
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  const renderClaimStatus = (status) => {
    const normalizedStatus = status?.toLowerCase() || "other";

    if (normalizedStatus === "claimed") {
      return (
        <span className="status claimed">
          <FaCheckCircle className="status-icon status-icon--claimed" />
          Claimed
        </span>
      );
    }

    if (normalizedStatus === "picked_up") {
      return (
        <span className="status picked_up">
          <FaCheckCircle className="status-icon status-icon--picked-up" />
          Picked up
        </span>
      );
    }

    return (
      <span className="status other">
        <FaInfoCircle className="status-icon status-icon--other" />
        {status || "Unknown"}
      </span>
    );
  };

  const fetchClaims = async () => {
    try {
      const res = await API.get("/recipient/claims");

      setClaims(res.data);
      setPage(1);

    } catch {
      console.error("Error fetching claims");
    }
  };

  const confirmPickup = async (food_id) => {
    try {
      await API.post("/recipient/confirm-pickup", { food_id });

      toast.success("Pickup confirmed!");
      setClaims((current) =>
        current.map((claim) =>
          claim.food_id === food_id ? { ...claim, status: "picked_up" } : claim
        )
      );
      await fetchClaims();

    } catch {
      toast.error("Failed to confirm pickup");
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(fetchClaims, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const pageCount = Math.max(1, Math.ceil(claims.length / rowsPerPage));
  const displayedClaims = claims.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  return (
    <div className="claims-page">

      <h2 className="title">My Claims</h2>

      {claims.length === 0 && (
        <p className="empty">No claims yet</p>
      )}

      {claims.length > 0 && (
        <>
          <div className="claims-table-card">
            <div className="claims-table-wrap">
              <table className="claims-table">
                <thead>
                  <tr>
                    <th>Food</th>
                    <th>Donor</th>
                    <th>Description</th>
                    <th>Dietary</th>
                    <th>Pork</th>
                    <th>Quantity</th>
                    <th>Location</th>
                    <th>Claimed At</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedClaims.map((c, i) => (
                    <tr key={`${c.food_id}-${c.claimed_at || i}`}>
                      <td>{c.food_type}</td>
                      <td>{c.donor_name || "Unknown donor"}</td>
                      <td>{c.food_description || "Not specified"}</td>
                      <td>{getDietaryLabel(c.dietary_tags)}</td>
                      <td>{c.contains_pork ? "Yes" : "No"}</td>
                      <td>{c.quantity}</td>
                      <td>{c.location}</td>
                      <td>
                        {c.claimed_at
                          ? new Date(c.claimed_at).toLocaleString()
                          : "Not available"}
                      </td>
                      <td>{renderClaimStatus(c.status)}</td>
                      <td>
                        {c.status === "claimed" ? (
                          <button className="confirm-pickup-btn table-action" onClick={() => confirmPickup(c.food_id)}>
                            Confirm Pickup
                          </button>
                        ) : (
                          <span className="no-action">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="claims-pagination">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span>Page {page} of {pageCount}</span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={page === pageCount}
            >
              Next
            </button>
          </div>
        </>
      )}

    </div>
  );
}

export default MyClaims;
