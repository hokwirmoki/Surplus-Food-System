import { Suspense, lazy, useState } from "react";
import { Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import SessionTimeout from "./components/SessionTimeout.jsx";

const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const DonorDashboard = lazy(() => import("./pages/DonorDashboard.jsx"));
const RecipientDashboard = lazy(() => import("./pages/RecipientDashboard.jsx"));
const DonatePage = lazy(() => import("./pages/DonatePage.jsx"));
const DonorAnalytics = lazy(() => import("./pages/DonorAnalytics.jsx"));
const AvailableFood = lazy(() => import("./pages/AvailableFood.jsx"));
const MyClaims = lazy(() => import("./pages/MyClaims.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const OtpVerify = lazy(() => import("./pages/OtpVerify.jsx"));
const DonorVerification = lazy(() => import("./pages/DonorVerification.jsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.jsx"));
const ViewImpact = lazy(() => import("./pages/ViewImpact.jsx"));
const VerifyUsers = lazy(() => import("./pages/VerifyUsers.jsx"));
const ViewFinancials = lazy(() => import("./pages/ViewFinancials.jsx"));
const HomeRedirect = lazy(() => import("./pages/HomeRedirect.jsx"));

function App() {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  return (
  <div className="app-layout">

    <SessionTimeout user={user} setUser={setUser} />

    {user && <Navbar user={user} setUser={setUser} />}

    <main className="app-content">
      <Suspense fallback={<div className="page-loading">Loading...</div>}>
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
      </Suspense>
    </main>

  </div>
);
}

export default App;
