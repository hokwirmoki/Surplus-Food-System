import { useState } from "react";
import { Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import DonorDashboard from "./pages/DonorDashboard.jsx";
import RecipientDashboard from "./pages/RecipientDashboard.jsx";
import DonatePage from "./pages/DonatePage.jsx";
import DonorAnalytics from "./pages/DonorAnalytics.jsx";
import AvailableFood from "./pages/AvailableFood.jsx";
import MyClaims from "./pages/MyClaims.jsx";
import Profile from "./pages/Profile.jsx";
import OtpVerify from "./pages/OtpVerify.jsx";
import DonorVerification from "./pages/DonorVerification.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import ViewImpact from "./pages/ViewImpact.jsx";
import VerifyUsers from "./pages/VerifyUsers.jsx";
import ViewFinancials from "./pages/ViewFinancials.jsx";
import HomeRedirect from "./pages/HomeRedirect.jsx";
import "./styles/system.css";

function App() {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  return (
  <div className="app-layout">

    {user && <Navbar user={user} setUser={setUser} />}

    <main className="app-content">
      <Routes>
        <Route path="/" element={<Login setUser={setUser} />} />
        <Route path="/login" element={<Login setUser={setUser} />} />

        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<OtpVerify />} />

        <Route path="/home" element={<ProtectedRoute><HomeRedirect /></ProtectedRoute>} />
        <Route path="/donor" element={<ProtectedRoute><DonorDashboard /></ProtectedRoute>} />
        <Route path="/recipient" element={<ProtectedRoute><RecipientDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/impact" element={<ProtectedRoute requiredRole="admin"><ViewImpact /></ProtectedRoute>} />
        <Route path="/admin/verify" element={<ProtectedRoute requiredRole="admin"><VerifyUsers /></ProtectedRoute>} />
        <Route path="/admin/financials" element={<ProtectedRoute requiredRole="admin"><ViewFinancials /></ProtectedRoute>} />

        <Route path="/donor/donate" element={<ProtectedRoute><DonatePage /></ProtectedRoute>} />
        <Route path="/donor/analytics" element={<ProtectedRoute><DonorAnalytics /></ProtectedRoute>} />
        <Route path="/donor/verify-application" element={<ProtectedRoute><DonorVerification /></ProtectedRoute>} />

        <Route path="/recipient/available" element={<ProtectedRoute><AvailableFood /></ProtectedRoute>} />
        <Route path="/recipient/claims" element={<ProtectedRoute><MyClaims /></ProtectedRoute>} />

        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      </Routes>
    </main>

  </div>
);
}

export default App;
