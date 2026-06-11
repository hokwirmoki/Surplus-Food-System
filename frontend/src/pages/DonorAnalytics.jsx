import { useEffect, useState } from "react";
import axios from "axios";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle
} from "react-icons/fa";

import "../styles/donorAnalytics.css";

function DonorAnalytics() {
  const token = localStorage.getItem("token");

  const [data, setData] = useState({
    totalDonated: 0,
    totalClaimed: 0,
    peopleHelped: 0,
    history: [],
    predictive: { bestPostingWindow: "11:00 – 14:00" }
  });

  // FIX: use 1-based pagination (cleaner UI)
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/analytics/donor",
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setData(res.data || {
        totalDonated: 0,
        totalClaimed: 0,
        peopleHelped: 0,
        history: [],
        predictive: { bestPostingWindow: "11:00 – 14:00" }
      });

      // RESET PAGE AFTER FETCH (VERY IMPORTANT)
      setPage(1);

    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

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
  const bestPostingWindow = data?.predictive?.bestPostingWindow || "11:00 – 14:00";

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
                        <FaCheckCircle className="icon green" />
                      )}

                      {status === "expired" && (
                        <FaTimesCircle className="icon red" />
                      )}

                      {status === "available" && (
                        <FaInfoCircle className="icon blue" />
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