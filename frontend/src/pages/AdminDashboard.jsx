import { useNavigate } from "react-router-dom";
import "../styles/donorDashboard.css";

function AdminDashboard() {
  const user = JSON.parse(localStorage.getItem("user"));
  const navigate = useNavigate();

  return (
    <div className="dashboard-container">

      <div className="dashboard-card">

        <h2 className="dashboard-title">Admin Dashboard</h2>

        <p className="welcome-text">
          Hi <span>{user?.name}</span>
        </p>

        <p className="subtitle">
          Manage the system and oversee operations.
        </p>

        <hr />

        {/* ACTION BUTTONS */}
        <div className="dashboard-actions">

          <button
            className="btn-primary"
            onClick={() => navigate("/admin/impact")}
          >
            View Impact
          </button>

          <button
            className="btn-secondary"
            onClick={() => navigate("/admin/verify")}
          >
            Verify Users
          </button>

          <button
            className="btn-secondary"
            onClick={() => navigate("/admin/financials")}
          >
            View Financials
          </button>

        </div>

      </div>

    </div>
  );
}

export default AdminDashboard;