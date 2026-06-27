import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import API from "../services/api";
import { toast } from "react-toastify";
import "../styles/donorDashboard.css";

function isVerifiedDonor(user) {
  return (
    user?.verification_status === "verified" &&
    user?.verification_expires_at &&
    new Date(user.verification_expires_at).getTime() > Date.now()
  );
}

function DonorDashboard() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")) || {});
  const navigate = useNavigate();
  const verified = isVerifiedDonor(user);
  const status = user?.verification_status || "unverified";

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const res = await API.get("/user/me");
        const currentUser = res.data.user;
        localStorage.setItem("user", JSON.stringify(currentUser));
        setUser(currentUser);
      } catch {
        toast.error("Failed to refresh donor status");
      }
    };

    loadCurrentUser();
  }, []);

  const requireVerification = (path) => {
    if (!verified) {
      toast.error("Apply for donor verification and wait for admin approval before using this feature.");
      return;
    }

    navigate(path);
  };

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

        <p className={`verification-note ${verified ? "verified" : "locked"}`}>
          Donor status: {verified ? "Verified" : status}
        </p>

        <hr />

        {/* ACTION BUTTONS */}
        <div className="dashboard-actions">

          <button
            className="btn-primary"
            disabled={!verified}
            onClick={() => requireVerification("/donor/donate")}
          >
            Donate Food
          </button>

          <button
            className="btn-secondary"
            disabled={!verified}
            onClick={() => requireVerification("/donor/donate?discounted=true")}
          >
            Discounted Sales
          </button>

          <button
            className="btn-secondary"
            disabled={!verified}
            onClick={() => requireVerification("/donor/analytics")}
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
