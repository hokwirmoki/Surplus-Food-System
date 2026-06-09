import { useNavigate } from "react-router-dom";
import "../styles/donorDashboard.css";

function DonorDashboard() {
  const user = JSON.parse(localStorage.getItem("user"));
  const navigate = useNavigate();

  return (
    <div className="dashboard-container">

      <div className="dashboard-card">

        <h2 className="dashboard-title">Donor Dashboard</h2>

        <p className="welcome-text">
          Hi <span>{user?.name}</span>
        </p>

        <p className="subtitle">
          Manage your donations and track your impact in the community.
        </p>

        <hr />

        {/* ACTION BUTTONS */}
        <div className="dashboard-actions">

          <button
            className="btn-primary"
            onClick={() => navigate("/donor/donate")}
          >
            Donate Food
          </button>

          <button
            className="btn-secondary"
            onClick={() => navigate("/donor/donate?discounted=true")}
          >
            Discounted Sales
          </button>

          <button
            className="btn-secondary"
            onClick={() => navigate("/donor/analytics")}
          >
            View Analytics
          </button>

          <button
            className="btn-secondary"
            onClick={() => navigate("/donor/verify-application")}
          >
            Apply For Verification
          </button>
        </div>

      </div>

    </div>
  );
}

export default DonorDashboard;