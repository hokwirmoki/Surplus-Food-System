import { useState, useEffect } from "react";
import API from "../services/api";
import { toast } from "react-toastify";
import "../styles/donorAnalytics.css";

function VerifyUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await API.get("/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch (err) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (userId, status) => {
    try {
      const token = localStorage.getItem("token");
      await API.put(
        "/admin/verify",
        { userId, status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`User ${status}`);
      fetchUsers(); // Refresh
    } catch (err) {
      toast.error("Failed to update verification");
    }
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
                  <td>{user.verification_status}</td>
                  <td>
                    {user.verification_status === "pending" ? (
                      <div className="action-buttons">
                        <button onClick={() => handleVerify(user.id, "verified")}>Approve</button>
                        <button onClick={() => handleVerify(user.id, "rejected")}>Reject</button>
                      </div>
                    ) : (
                      <button onClick={() => handleVerify(user.id, "rejected")}>Disapprove</button>
                    )}
                  </td>
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