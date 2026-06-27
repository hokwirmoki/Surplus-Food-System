import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle
} from "react-icons/fa";

import "../styles/donorAnalytics.css";

function isVerifiedDonor(user) {
  return (
    user?.verification_status === "verified" &&
    user?.verification_expires_at &&
    new Date(user.verification_expires_at).getTime() > Date.now()
  );
}

function DonorAnalytics() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    totalDonated: 0,
    totalClaimed: 0,
    peopleHelped: 0,
    history: [],
    predictive: { bestPostingWindow: "11:00 - 14:00" }
  });


  const [page, setPage] = useState(1);
  const pageSize = 5;

  const fetchAnalytics = async () => {
    try {
      const res = await API.get("/analytics/donor");

      setData(res.data || {
        totalDonated: 0,
        totalClaimed: 0,
        peopleHelped: 0,
        history: [],
        predictive: { bestPostingWindow: "11:00 - 14:00" }
      });

      // RESET PAGE AFTER FETCH
      setPage(1);

    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    const verifyDonorAccess = async () => {
      try {
        const res = await API.get("/user/me");
        const currentUser = res.data.user;
        localStorage.setItem("user", JSON.stringify(currentUser));

        if (!isVerifiedDonor(currentUser)) {
          navigate("/donor", { replace: true });
        }
      } catch {
        navigate("/donor", { replace: true });
      }
    };

    verifyDonorAccess();
    const timer = window.setTimeout(fetchAnalytics, 0);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  const formatDate = (date) => {
    if (!date) return "Not available";
    return new Date(date).toLocaleString();
  };

  const safeHistory = data.history || [];

  const startIndex = (page - 1) * pageSize;

  const paginatedHistory = safeHistory.slice(
    startIndex,
    startIndex + pageSize
  );

  const totalPages = Math.ceil(safeHistory.length / pageSize);
  const bestPostingWindow = data?.predictive?.bestPostingWindow || "11:00 - 14:00";

  return (
    <div className="analytics-container">

      <h2 className="title">Donor Analytics</h2>

      {/* STATS */}
      <div className="stats-grid">

        <div className="stat-card">
          <h3>Total Donated Plates</h3>
          <h2>{data.totalDonated}</h2>
        </div>

        <div className="stat-card">
          <h3>Total Plates Claimed</h3>
          <h2>{data.totalClaimed}</h2>
        </div>

        <div className="stat-card">
          <h3>People Helped</h3>
          <h2>{data.peopleHelped}</h2>
        </div>

      </div>

      {/* PREDICTIVE ANALYTICS */}
      <div className="predictive-section">
        <h3>Best Posting Time</h3>
        <div className="predictive-best-window">
          <strong>{bestPostingWindow}</strong>
        </div>
      </div>

      {/* TABLE */}
      <div className="table-container">

        <h3>Donation History</h3>

        <table className="analytics-table">
          <thead>
            <tr>
              <th>Food Type</th>
              <th>Quantity</th>
              <th>Status</th>
              <th>Date Posted</th>
              <th>Date Claimed</th>
            </tr>
          </thead>

          <tbody>
            {paginatedHistory.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: "center" }}>
                  No donation history found for this donor.
                </td>
              </tr>
            ) : paginatedHistory.map((item, index) => {
              const status = item.status?.toLowerCase();

              return (
                <tr key={index}>
                  <td>{item.food_type}</td>
                  <td>{item.quantity}</td>

                  {/* STATUS */}
                  <td>
                    <span className={`status ${status}`}>

                      {status === "claimed" && (
                        <FaCheckCircle className="status-icon status-icon--claimed" />
                      )}

                      {status === "expired" && (
                        <FaTimesCircle className="status-icon status-icon--expired" />
                      )}

                      {status === "available" && (
                        <FaInfoCircle className="status-icon status-icon--available" />
                      )}

                      <span style={{ marginLeft: "6px" }}>
                        {item.status}
                      </span>

                    </span>
                  </td>

                  <td>{formatDate(item.created_at)}</td>

                  <td>
                    {item.claimed_at
                      ? formatDate(item.claimed_at)
                      : "Not claimed"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="pagination">

          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
          >
            Prev
          </button>

          <span>
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() =>
              setPage((p) => Math.min(p + 1, totalPages))
            }
            disabled={page === totalPages}
          >
            Next
          </button>

        </div>
      )}

    </div>
  );
}

export default DonorAnalytics;
