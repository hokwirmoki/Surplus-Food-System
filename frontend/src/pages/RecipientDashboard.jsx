import { useNavigate } from "react-router-dom";
import { FaUtensils, FaBoxOpen } from "react-icons/fa";
import "../styles/recipientDashboard.css";

function RecipientDashboard() {
  const user = JSON.parse(localStorage.getItem("user"));
  const navigate = useNavigate();

  return (
    <div className="recipient-dashboard">

      <div className="recipient-card">

        <h2 className="title">Recipient Dashboard</h2>

        <p className="welcome">
          Hi <span>{user?.name}</span>
        </p>

        <p className="subtitle">
          Find available food and track your claims in one place.
        </p>

        <hr />

        <div className="actions">

          <button
            className="btn-primary"
            onClick={() => navigate("/recipient/available")}
          >
            <FaUtensils className="btn-icon" />
            Available Food List
          </button>

          <button
            className="btn-secondary"
            onClick={() => navigate("/recipient/claims")}
          >
            <FaBoxOpen className="btn-icon" />
            My Claims
          </button>

        </div>

      </div>

    </div>
  );
}

export default RecipientDashboard;