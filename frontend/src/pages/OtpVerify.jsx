import { useState } from "react";
import API from "../services/api";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

import { FiShield, FiMessageCircle } from "react-icons/fi";
import logo from "../assets/sfsLogo.jpg";
import "../styles/otpVerify.css";

function OtpVerify() {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const userId = localStorage.getItem("pendingUserId");

  const handleOtpError = (err, fallbackMessage) => {
    const message = err.response?.data?.message || fallbackMessage;

    if (err.response?.status === 410) {
      localStorage.removeItem("pendingUserId");
      toast.error(message);
      navigate("/register");
      return;
    }

    toast.error(message);
  };

  const resendOtp = async () => {
    if (!userId) {
      toast.error("No pending account found. Please register again.");
      navigate("/register");
      return;
    }

    try {
      setLoading(true);
      const res = await API.post("/auth/resend-otp", { userId });
      toast.success(res.data.message || "OTP sent successfully.");
    } catch (err) {
      handleOtpError(err, "OTP could not be resent");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!userId) {
      toast.error("No pending account found. Please register again.");
      navigate("/register");
      return;
    }

    if (!otp) {
      toast.error("Enter OTP");
      return;
    }

    try {
      setLoading(true);

      const res = await API.post("/auth/verify-otp", {
        userId,
        otp
      });

      toast.success(res.data.message);

      localStorage.removeItem("pendingUserId");

      navigate("/login");

    } catch (err) {
      handleOtpError(err, "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="otp-page">

      {/* LEFT BRAND PANEL */}
      <div className="otp-left">

        <img src={logo} alt="SFS Logo" className="otp-logo" />

        <h1>Verify Your Account</h1>

        <p>
          We have sent a one-time password to your WhatsApp number.
          Enter it below to activate your account.
        </p>

        <div className="otp-mission">

          <div className="mission-item">
            <FiShield className="mission-icon" />
            <span>Secure verification</span>
          </div>

          <div className="mission-item">
            <FiMessageCircle className="mission-icon" />
            <span>WhatsApp OTP delivery</span>
          </div>

        </div>

      </div>

      {/* RIGHT PANEL */}
      <div className="otp-right">

        <div className="otp-card">

          <h2>Enter OTP</h2>

          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit code"
          />

          <button onClick={verifyOtp} disabled={loading}>
            {loading ? "Verifying..." : "Verify OTP"}
          </button>

          <button type="button" onClick={resendOtp} disabled={loading} className="secondary-otp-button">
            Resend OTP
          </button>

          <p className="hint">
            Check WhatsApp or try again later.
          </p>

        </div>

      </div>

    </div>
  );
}

export default OtpVerify;
