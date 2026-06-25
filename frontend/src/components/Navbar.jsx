import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiUser, FiLogOut } from "react-icons/fi";

import logo from "../assets/sfsLogo.jpg";
import profileImg from "../assets/profile.jpg";
import { clearSession } from "../utils/session";
import "../styles/navbar.css";

function Navbar({ user, setUser }) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const currentUser = user || JSON.parse(localStorage.getItem("user"));
  const homePath =
    currentUser?.role === "donor"
      ? "/donor"
      : currentUser?.role === "recipient"
      ? "/recipient"
      : currentUser?.role === "admin"
      ? "/admin"
      : "/";
  const showHelpLine = ["donor", "recipient"].includes(currentUser?.role);

  const logout = () => {
    clearSession();
    setUser(null);
    window.location.replace("/");
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="navbar">
      
      {/* LOGO */}
      <div className="navbar-logo">
        <img src={logo} alt="SFS Logo" className="logo-img" />
        <h3>Surplus Food System</h3>
      </div>

      {/* HAMBURGER */}
      <div className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
        ☰
      </div>

      {/* RIGHT SIDE */}
      <div className={`navbar-right ${menuOpen ? "active" : ""}`}>

{/* HOME LINK */}
        <p onClick={() => navigate(homePath)}>
          Home
        </p>

        {/* ROLE LINKS */}
        {user?.role === "donor" && (
          <>
            <p onClick={() => navigate("/donor/donate")}>Donate</p>
            <p onClick={() => navigate("/donor/analytics")}>Analytics</p>
          </>
        )}

        {user?.role === "recipient" && (
          <>
            <p onClick={() => navigate("/recipient/available")}> 
              Available Food
            </p>
            <p onClick={() => navigate("/recipient/claims")}> 
              My Claims
            </p>
          </>
        )}

        {showHelpLine && (
          <div className="navbar-helpline" aria-label="Help line">
            <span>Help Line</span>
            <strong>+256 700 000 000</strong>
          </div>
        )}

        {user?.role === "admin" && (
          <>
            <p onClick={() => navigate("/admin/impact")}>View Impact</p>
            <p onClick={() => navigate("/admin/verify")}>Verify Users</p>
            <p onClick={() => navigate("/admin/financials")}>View Financials</p>
          </>
        )}

        {/* PROFILE */}
        <div className="profile-container" ref={dropdownRef}>
          <img
            src={profileImg}
            alt="profile"
            className="profile-img"
            onClick={() => setOpen(!open)}
          />

          {open && (
            <div className="dropdown">
              
              <p
                onClick={() => {
                  setOpen(false);
                  navigate("/profile");
                }}
              >
                <FiUser className="icon" />
                My Profile
              </p>

              <p className="logout" onClick={logout}>
                <FiLogOut className="icon" />
                Logout
              </p>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default Navbar;
