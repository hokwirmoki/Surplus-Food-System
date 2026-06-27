import { useState, useEffect } from "react";
import API from "../services/api";
import { toast } from "react-toastify";
import { FaCheckCircle, FaClock, FaTimesCircle } from "react-icons/fa";
import "../styles/donorAnalytics.css";

function VerifyUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const fetchUsers = async () => {
    try {
      const res = await API.get("/admin/users");
      setUsers(res.data);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(fetchUsers, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleVerify = async (userId, status) => {
    try {
      const res = await API.put(
        "/admin/verify",
        { userId, status }
      );
      const updatedUser = res.data;

      setUsers((current) =>
        current.map((user) =>
          user.id === userId ? { ...user, ...updatedUser } : user
        )
      );
      toast.success(`User ${status}`);
      await fetchUsers();
    } catch {
      toast.error("Failed to update verification");
    }
  };

  const renderVerificationStatus = (status) => {
    const normalizedStatus = status?.toLowerCase() || "unverified";

    if (normalizedStatus === "verified") {
      return (
        <span className="status verified">
          <FaCheckCircle className="status-icon status-icon--verified" />
          Verified
        </span>
      );
    }

    if (normalizedStatus === "pending") {
      return (
        <span className="status pending">
          <FaClock className="status-icon status-icon--pending" />
          Pending
        </span>
      );
    }

    return (
      <span className={`status ${normalizedStatus}`}>
        <FaTimesCircle className="status-icon status-icon--rejected" />
        {status || "Unverified"}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  const renderActions = (user) => {
    const status = user.verification_status?.toLowerCase() || "unverified";

    if (status === "pending") {
      return (
        <div className="action-buttons">
          <button onClick={() => handleVerify(user.id, "verified")}>Approve</button>
          <button className="danger-action" onClick={() => handleVerify(user.id, "rejected")}>
            Reject
          </button>
        </div>
      );
    }

    if (status === "verified") {
      return (
        <button className="danger-action" onClick={() => handleVerify(user.id, "rejected")}>
          Remove badge
        </button>
      );
    }

    return (
      <button onClick={() => handleVerify(user.id, "verified")}>
        Approve
      </button>
    );
  };

  if (loading) return <div>Loading...</div>;

  const totalPages = Math.ceil(users.length / pageSize);
  const currentUsers = users.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="analytics-container">
      <h2 className="title">Verify Users</h2>

      <div className="table-container">
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Vendor Type</th>
              <th>Document</th>
              <th>Payment Provider</th>
              <th>Payment Contact</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {currentUsers.map((user) => {
              const document = user.documents || {};
              const docInfo = document.document || {};

              return (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.phone || "-"}</td>
                  <td>{document.type || "-"}</td>
                  <td>
                    {docInfo.content ? (
                      <a
                        href={docInfo.content}
                        target="_blank"
                        rel="noreferrer"
                        className="doc-link"
                      >
                        {docInfo.name || "View Document"}
                      </a>
                    ) : (
                      "No document"
                    )}
                  </td>
                  <td>{document.paymentProvider || "-"}</td>
                  <td>{document.paymentContact || "-"}</td>
                  <td>{renderVerificationStatus(user.verification_status)}</td>
                  <td>{formatDate(user.verification_expires_at)}</td>
                  <td>{renderActions(user)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage(page - 1)} disabled={page === 1}>
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={page === i + 1 ? "active" : ""}
            >
              {i + 1}
            </button>
          ))}
          <button onClick={() => setPage(page + 1)} disabled={page === totalPages}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default VerifyUsers;
