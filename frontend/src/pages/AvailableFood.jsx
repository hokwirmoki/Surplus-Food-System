import { useEffect, useState, useRef } from "react";
import API from "../services/api";
import { toast } from "react-toastify";
import { formatUGX } from "../utils/formatMoney";
import SelectMenu from "../components/SelectMenu";

import {
  FaClock,
  FaMapMarkerAlt,
  FaBoxOpen,
  FaCheckCircle,
  FaUser
} from "react-icons/fa";

import "../styles/availableFood.css";

function AvailableFood() {
  const [foods, setFoods] = useState([]);
  const [claimQuantities, setClaimQuantities] = useState({});
  const [selectedFood, setSelectedFood] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState("MTN");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const previousIds = useRef([]);

  const fetchFood = async () => {
    try {
      const res = await API.get("/recipient/available");

      const now = new Date();

      const validFoods = res.data.filter((f) => {
        if (!f.expiry_time) return true;
        return new Date(f.expiry_time) > now;
      });

      const newIds = validFoods.map((f) => f.id);

      const added = validFoods.filter(
        (f) => !previousIds.current.includes(f.id)
      );

      if (previousIds.current.length > 0 && added.length > 0) {
        added.forEach((food) => {
          toast.info(`New food available: ${food.food_type}`);
        });
      }

      previousIds.current = newIds;
      setFoods(validFoods);
    } catch {
      toast.error("Failed to load food");
    }
  };

  const handleQuantityChange = (foodId, value) => {
    setClaimQuantities((prev) => ({
      ...prev,
      [foodId]: value,
    }));
  };

  const openPaymentModal = (food) => {
    setSelectedFood(food);
    setShowPaymentModal(true);
    setPaymentProvider("MTN");
    setPaymentNumber("");
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedFood(null);
    setPaymentProvider("MTN");
    setPaymentNumber("");
    setPaymentLoading(false);
  };

  const claimFood = async (food, paymentProvider, paymentNumber, paymentReference) => {
    try {
      const requestedQuantity = parseInt(claimQuantities[food.id] || "", 10);

      if (!requestedQuantity || requestedQuantity <= 0) {
        toast.error("Please enter a valid quantity to claim");
        return;
      }

      if (!paymentNumber.trim()) {
        toast.error("Please enter your payment number");
        return;
      }

      await API.post(
        "/recipient/claim",
        {
          food_id: food.id,
          quantity: requestedQuantity,
          paymentProvider,
          paymentNumber,
          paymentReference,
        }
      );

      toast.success("Payment received and food claimed!");
      setClaimQuantities((prev) => ({
        ...prev,
        [food.id]: "",
      }));
      closePaymentModal();
      fetchFood();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to claim food");
    }
  };

  const confirmPayment = async () => {
    if (!selectedFood) return;
    const requestedQuantity = parseInt(claimQuantities[selectedFood.id] || "", 10);

    if (!requestedQuantity || requestedQuantity <= 0) {
      toast.error("Please enter a valid quantity to claim");
      return;
    }

    if (!paymentNumber.trim()) {
      toast.error("Please enter your payment number");
      return;
    }

    const amount = selectedFood.is_discounted
      ? Number(selectedFood.discount_price || 0) * requestedQuantity
      : 1000;

    try {
      setPaymentLoading(true);
      const paymentRes = await API.post("/payments/sandbox", {
        provider: paymentProvider,
        phone: paymentNumber,
        amount,
        purpose: "claim",
        foodId: selectedFood.id,
        metadata: {
          foodType: selectedFood.food_type,
          quantity: requestedQuantity,
        },
      });

      toast.success(`${paymentProvider} sandbox payment successful`);
      await claimFood(
        selectedFood,
        paymentProvider,
        paymentNumber,
        paymentRes.data.payment.reference
      );
    } catch (err) {
      toast.error(err.response?.data?.message || "Payment failed");
    } finally {
      setPaymentLoading(false);
    }
  };

  const getTimeLeft = (expiry) => {
    if (!expiry) return "No expiry";

    const diff = new Date(expiry) - new Date();

    if (diff <= 0) return "Expired";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(
      (diff % (1000 * 60 * 60)) / (1000 * 60)
    );

    return `${hours}h ${minutes}m left`;
  };

  const openMap = (lat, lng, location) => {
    if (lat && lng) {
      window.open(
        `https://www.google.com/maps?q=${lat},${lng}`,
        "_blank"
      );
    } else {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`,
        "_blank"
      );
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(fetchFood, 0);
    const interval = setInterval(fetchFood, 30000);
    return () => {
      window.clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="available-page">

      <h2 className="page-title">
        Available Food
      </h2>

      {foods.length === 0 && (
        <p className="empty-text">No available food at the moment</p>
      )}

      <div className="food-grid">

        {foods.map((f) => (
          <div className="food-card" key={f.id}>

            <div className="food-header">
              <FaBoxOpen className="icon" />
              <h3>{f.food_type}</h3>
            </div>

            {f.donor_verified && (
              <span className="verified-badge">
                <FaCheckCircle /> Verified donor
              </span>
            )}

            <p className="meta donor-name">
              <FaUser className="icon small" />
              <strong>Donor:</strong> {f.donor_name || "Unknown donor"}
            </p>

            <p className="meta">
              <strong>Quantity:</strong> {f.quantity}
            </p>

            <p className="meta location">
              <FaMapMarkerAlt className="icon small" />
              {f.location}
            </p>

            <p className="meta expiry">
              <strong>Expiry:</strong>{" "}
              {f.expiry_time
                ? new Date(f.expiry_time).toLocaleString()
                : "Not specified"}
            </p>

            <p className="time-left">
              <FaClock className="icon small" />
              {getTimeLeft(f.expiry_time)}
            </p>

            <div className="claim-details">
              <label>Payment</label>
              <div className="payment-summary">
                {f.is_discounted
                  ? `Pay & Buy - ${formatUGX(f.discount_price || 0)} per unit`
                  : `Reservation fee - ${formatUGX(1000)}`}
              </div>
            </div>

            <div className="claim-input-group">
              <input
                type="number"
                min="1"
                value={claimQuantities[f.id] || ""}
                onChange={(e) => handleQuantityChange(f.id, e.target.value)}
                placeholder={`Qty (available ${f.quantity})`}
              />
            </div>

            <div className="actions">
              <button
                className="map-btn"
                onClick={() => openMap(f.latitude, f.longitude, f.location)}
              >
                <FaMapMarkerAlt />
                Open Map
              </button>

              <button
                className="claim-btn"
                onClick={() => openPaymentModal(f)}
              >
                <FaCheckCircle />
                {f.is_discounted ? "Pay & Buy" : "Claim Food"}
              </button>
            </div>

          </div>
        ))}

      </div>

      {showPaymentModal && selectedFood && (
        <div className="payment-modal">
          <div className="payment-modal-card">
            <div className="payment-modal-header">
              <h3>{selectedFood.is_discounted ? "Pay & Buy" : "Claim Food"}</h3>
              <p>
                {selectedFood.is_discounted
                  ? `Enter your payment details to complete the purchase of ${selectedFood.food_type}.`
                  : `Enter your payment details to complete the reservation fee for ${selectedFood.food_type}.`}
              </p>
            </div>

            <div className="payment-modal-body">
              <div className="payment-modal-field">
                <label>Payment Provider</label>
                <SelectMenu
                  value={paymentProvider}
                  onChange={setPaymentProvider}
                  options={[
                    { value: "MTN", label: "MTN", className: "payment-option-mtn" },
                    { value: "Airtel", label: "Airtel", className: "payment-option-airtel" }
                  ]}
                />
              </div>

              <div className="payment-modal-field">
                <label>Payment Number</label>
                <input
                  className="payment-modal-input"
                  value={paymentNumber}
                  onChange={(e) => setPaymentNumber(e.target.value)}
                  placeholder="Enter mobile money number"
                />
              </div>

              <div className="payment-modal-field">
                <label>Amount</label>
                <div className="payment-summary modal-value">
                  {selectedFood.is_discounted
                    ? formatUGX((selectedFood.discount_price || 0) * (parseInt(claimQuantities[selectedFood.id] || "1", 10) || 1))
                    : formatUGX(1000)}
                </div>
              </div>
            </div>

            <div className="payment-modal-actions">
              <button className="map-btn" onClick={closePaymentModal}>
                Cancel
              </button>
              <button className="claim-btn" onClick={confirmPayment} disabled={paymentLoading}>
                {paymentLoading ? "Processing..." : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default AvailableFood;
