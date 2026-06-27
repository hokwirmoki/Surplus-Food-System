import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import { toast } from "react-toastify";
import SelectMenu from "../components/SelectMenu";
import { FOOD_CATEGORIES } from "../constants/foodCategories";
import "../styles/register.css";

import { FiUserPlus, FiUsers, FiRefreshCw } from "react-icons/fi";
import logo from "../assets/sfsLogo.jpg";

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "donor",
    location: "",
    latitude: null,
    longitude: null,
    preferred_food_types: [],
    food_notifications_enabled: true
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const toggleFoodPreference = (foodType) => {
    setForm((current) => {
      const selected = current.preferred_food_types.includes(foodType);

      return {
        ...current,
        preferred_food_types: selected
          ? current.preferred_food_types.filter((item) => item !== foodType)
          : [...current.preferred_food_types, foodType]
      };
    });
  };

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
      },
      () => {},
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 10 * 60 * 1000 }
    );
  }, []);

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(\+[1-9][0-9]{7,14}|0[0-9]{8,9})$/;

    if (!form.name.trim() || !form.email.trim() || !form.password.trim() || !form.phone.trim() || !form.location.trim()) {
      toast.error("Please complete all fields before registering.");
      return false;
    }

    if (!emailRegex.test(form.email.trim())) {
      toast.error("Please enter a valid email address.");
      return false;
    }

    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return false;
    }

    if (!phoneRegex.test(form.phone.trim())) {
      toast.error("Use a WhatsApp number like +256700000000 or 0700000000.");
      return false;
    }

    return true;
  };

  const register = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      const res = await API.post("/auth/register", form);

      localStorage.setItem("pendingUserId", res.data.userId);

      if (res.data.otpSent === false) {
        toast.warn(res.data.message || "Account created, but OTP could not be sent.");
      } else {
        toast.success("OTP sent to WhatsApp!");
      }

      navigate("/verify-otp");

    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">

      {/* LEFT BRAND PANEL */}
      <div className="register-left">

        <img src={logo} alt="SFS Logo" className="register-logo" />

        <h1>Join Surplus Food System</h1>

        <p>
          Be part of a movement reducing food waste and feeding communities across Uganda.
        </p>

        <div className="register-mission">

          <div className="mission-item">
            <FiUsers className="mission-icon" />
            <span>Connect communities</span>
          </div>

          <div className="mission-item">
            <FiRefreshCw className="mission-icon" />
            <span>Reduce food waste</span>
          </div>

          <div className="mission-item">
            <FiUserPlus className="mission-icon" />
            <span>Make an impact</span>
          </div>

        </div>

      </div>

      {/* RIGHT FORM */}
      <div className="register-right">
        <div className="register-card">

          <h2>Create Account</h2>
          <p className="subtitle">Join and help reduce food waste</p>

          <input name="name" value={form.name} placeholder="Full Name" onChange={handleChange} />
          <input name="email" type="email" value={form.email} placeholder="Email" onChange={handleChange} />
          <input name="password" type="password" value={form.password} placeholder="Password" onChange={handleChange} />
          <input name="phone" value={form.phone} placeholder="WhatsApp Number (e.g., +256700000000 or 0700000000)" onChange={handleChange} />
          <input name="location" value={form.location} placeholder="Location (e.g., Kampala, Uganda)" onChange={handleChange} />

          <SelectMenu
            value={form.role}
            onChange={(role) => setForm({ ...form, role })}
            options={[
              { value: "donor", label: "Donor" },
              { value: "recipient", label: "Recipient" }
            ]}
          />

          {form.role === "recipient" && (
            <div className="preference-panel">
              <p className="form-label">Food preferences</p>
              <div className="preference-grid">
                {FOOD_CATEGORIES.map((option) => (
                  <label key={option.value} className="preference-check">
                    <input
                      type="checkbox"
                      checked={form.preferred_food_types.includes(option.value)}
                      onChange={() => toggleFoodPreference(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <label className="preference-toggle">
                <input
                  type="checkbox"
                  checked={form.food_notifications_enabled}
                  onChange={(event) => setForm({ ...form, food_notifications_enabled: event.target.checked })}
                />
                <span>Receive notifications when matching food is posted</span>
              </label>
            </div>
          )}

          <button onClick={register} disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </button>

          <p>
            Already have an account? <Link to="/">Login</Link>
          </p>

        </div>
      </div>

    </div>
  );
}

export default Register;
