import { useState, useEffect } from "react";
import API from "../services/api";
import { toast } from "react-toastify";
import "../styles/donorAnalytics.css"; // Reuse styling

function ViewImpact() {
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const res = await API.get("/admin/impact");
      setMetrics(res.data);
    } catch (err) {
      toast.error("Failed to load impact metrics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-state">Loading impact metrics…</div>;

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <div>
          <h2>System Impact Metrics</h2>
          <p className="analytics-subtitle">
            A minimal dashboard showing the platform’s donations, claims, and verified donor reach.
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
          <h3>Meals Saved</h3>
          <p>{metrics.mealsSaved || 0}</p>
        </div>

        <div className="metric-card">
          <h3>Total Food Donated (kg)</h3>
          <p>{metrics.totalFoodDonated || 0}</p>
        </div>

        <div className="metric-card">
          <h3>Total Food Claimed (kg)</h3>
          <p>{metrics.totalFoodClaimed || 0}</p>
        </div>

        <div className="metric-card">
          <h3>Total People Helped</h3>
          <p>{metrics.totalPeopleHealed || 0}</p>
        </div>

        <div className="metric-card">
          <h3>Verified Donors</h3>
          <p>{metrics.verifiedDonors || 0}</p>
        </div>

        <div className="metric-card">
          <h3>CO₂ Saved (kg)</h3>
          <p>{metrics.co2Saved || 0}</p>
        </div>
      </div>

      <div className="chart-wrapper">
        <h3>Impact by Category</h3>
        <div className="impact-chart">
          {[
            { label: "Meals", value: metrics.mealsSaved },
            { label: "Food Donated", value: metrics.totalFoodDonated },
            { label: "Food Claimed", value: metrics.totalFoodClaimed },
            { label: "CO₂ Saved", value: metrics.co2Saved }
          ].map((item) => {
            const max = Math.max(
              metrics.mealsSaved || 0,
              metrics.totalFoodDonated || 0,
              metrics.totalFoodClaimed || 0,
              metrics.co2Saved || 0,
              1
            );
            const width = max ? Math.min((item.value / max) * 100, 100) : 0;
            return (
              <div key={item.label} className="bar-row">
                <span>{item.label}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${width}%` }} />
                </div>
                <strong>{item.value || 0}</strong>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ViewImpact;