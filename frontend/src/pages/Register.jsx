import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import { toast } from "react-toastify";
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
    longitude: null
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9]{9,15}$/;

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
      toast.error("Please enter a valid phone number.");
      return false;
    }

    return true;
  };

  const register = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      const res = await API.post("/auth/register", form);

      toast.success("OTP sent to WhatsApp!");

      localStorage.setItem("pendingUserId", res.data.userId);

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
          <input name="phone" value={form.phone} placeholder="Phone Number" onChange={handleChange} />
          <input name="location" value={form.location} placeholder="Location (e.g., Kampala, Uganda)" onChange={handleChange} />

          <select name="role" value={form.role} onChange={handleChange}>
            <option value="donor">Donor</option>
            <option value="recipient">Recipient</option>
          </select>

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