import { useState, useEffect } from "react";
import API from "../services/api";
import { toast } from "react-toastify";
import { formatMoney } from "../utils/formatMoney";
import "../styles/donorAnalytics.css"; 

function ViewFinancials() {
  const [financials, setFinancials] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchFinancials = async () => {
    try {
      const res = await API.get("/admin/financials");
      setFinancials(res.data);
    } catch {
      toast.error("Failed to load financials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(fetchFinancials, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading) return <div>Loading...</div>;

  const summaryData = [
    { label: "Reservation Fees", value: financials.reservationFees || 0 },
    { label: "Verification Fees", value: financials.verificationFees || 0 },
    { label: "Discounted Food Sales", value: financials.discountedFoodSales || 0 },
    { label: "Commissions", value: financials.commissions || 0 }
  ];

  return (
    <div className="analytics-container">
      <h2>Financial Overview</h2>

      <div className="analytics-grid">
        {summaryData.map((item) => (
          <div key={item.label} className="metric-card">
            <h3>{item.label} (UGX)</h3>
            <p>{formatMoney(item.value)}</p>
          </div>
        ))}
      </div>

      <div className="table-container">
        <h3>Financial Summary</h3>
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Amount (UGX)</th>
            </tr>
          </thead>
          <tbody>
            {summaryData.map((item) => (
              <tr key={item.label}>
                <td>{item.label}</td>
                <td>{formatMoney(item.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ViewFinancials;
