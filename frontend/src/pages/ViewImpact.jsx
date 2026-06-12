import { useState, useEffect } from "react";
import API from "../services/api";
import { toast } from "react-toastify";
import "../styles/donorAnalytics.css"; // Reuse styling

function ViewImpact() {
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      const res = await API.get("/admin/impact");
      setMetrics(res.data);
    } catch {
      toast.error("Failed to load impact metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(fetchMetrics, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading) return <div className="loading-state">Loading impact metrics...</div>;

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <div>
          <h2>System Impact Metrics</h2>
          <p className="analytics-subtitle">
            A summary of claimed plates, redistributed food, and carbon savings using the 2 plates = 1 kg rule.
          </p>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="metric-card">
          <h3>Total Users</h3>
          <p>{metrics.totalUsers || 0}</p>
        </div>

        <div className="metric-card">
          <h3>Active Food Listings</h3>
          <p>{metrics.activeFoodListings || 0}</p>
        </div>

        <div className="metric-card">
          <h3>Food Redistributed (kg)</h3>
          <p>{metrics.totalFoodDonatedKg || 0}</p>
        </div>

        <div className="metric-card">
          <h3>Total Plates Claimed</h3>
          <p>{metrics.totalFoodClaimedPlates || 0}</p>
        </div>

        <div className="metric-card">
          <h3>Total People Helped</h3>
          <p>{metrics.totalPeopleHelped || metrics.totalPeopleHealed || 0}</p>
        </div>

        <div className="metric-card">
          <h3>Verified Donors</h3>
          <p>{metrics.verifiedDonors || 0}</p>
        </div>

        <div className="metric-card">
          <h3>CO2 Saved (kg)</h3>
          <p>{metrics.co2Saved || 0}</p>
        </div>
      </div>
    </div>
  );
}

export default ViewImpact;
