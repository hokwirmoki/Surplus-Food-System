import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import { toast } from "react-toastify";
import "../styles/login.css";

import { FiUsers, FiRefreshCw, FiGlobe } from "react-icons/fi";

import logo from "../assets/sfsLogo.jpg";

function Login({ setUser }) {
  const navigate = useNavigate();
  const toastId = useRef(null);

  const [form, setForm] = useState({
    email: "",
    password: ""
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const login = async () => {
    try {
      setLoading(true);

      const res = await API.post("/auth/login", form);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      setUser(res.data.user);

      if (!toast.isActive(toastId.current)) {
        toastId.current = toast.success("Login successful!", {
          autoClose: 2000
        });
      }

      if (res.data.user.role === "donor") {
        navigate("/donor", { replace: true });
      } else if (res.data.user.role === "recipient") {
        navigate("/recipient", { replace: true });
      } else if (res.data.user.role === "admin") {
        navigate("/admin", { replace: true });
      }

    } catch (err) {
      if (!toast.isActive(toastId.current)) {
        toastId.current = toast.error(
          err.response?.data?.message || "Login failed",
          { autoClose: 3000 }
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* LEFT BRAND PANEL */}
      <div className="login-left">

        <img src={logo} alt="SFS Logo" className="login-logo" />

        <h1>Surplus Food System</h1>

        <p>
          Reducing food waste.  
          Feeding communities.  
          Connecting donors to people in need.
        </p>

        {/* MISSION SECTION (SAFE ICONS) */}
        <div className="login-mission">

          <div className="mission-item">
            <FiGlobe className="mission-icon" />
            <span>Sustainable</span>
          </div>

          <div className="mission-item">
            <FiUsers className="mission-icon" />
            <span>Community-driven</span>
          </div>

          <div className="mission-item">
            <FiRefreshCw className="mission-icon" />
            <span>Food Redistribution</span>
          </div>

        </div>

      </div>

      {/* RIGHT LOGIN FORM */}
      <div className="login-right">
        <div className="login-card">

          <h2>Welcome Back</h2>

          <input
            name="email"
            value={form.email}
            placeholder="Email"
            onChange={handleChange}
          />

          <input
            name="password"
            type="password"
            value={form.password}
            placeholder="Password"
            onChange={handleChange}
          />

          <button onClick={login}>
            {loading ? "Logging in..." : "Login"}
          </button>

          <p>
            Don't have an account? <Link to="/register">Register</Link>
          </p>

        </div>
      </div>

    </div>
  );
}

export default Login;