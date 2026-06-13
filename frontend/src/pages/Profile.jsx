import { useState, useEffect } from "react";
import API from "../services/api";
import { toast } from "react-toastify";
import { FaCheckCircle } from "react-icons/fa";
import SelectMenu from "../components/SelectMenu";
import "../styles/profile.css";

import profileImg from "../assets/profile.jpg";

function Profile() {
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  const token = localStorage.getItem("token");

  const [user, setUser] = useState(storedUser);
  const [form, setForm] = useState({
    name: storedUser.name || "",
    email: storedUser.email || "",
    phone: storedUser.phone || "",
    password: "",
    location: storedUser.location || "",
    notification_mode: storedUser.notification_mode || "whatsapp"
  });
  const [loading, setLoading] = useState(false);

  const formatDate = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString();
  };

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) return;

      try {
        const res = await API.get("/user/me");

        const currentUser = res.data.user;
        setUser(currentUser);
        setForm({
          name: currentUser.name || "",
          email: currentUser.email || "",
          phone: currentUser.phone || "",
          password: "",
          location: currentUser.location || "",
          notification_mode: currentUser.notification_mode || "whatsapp",
        });
        localStorage.setItem("user", JSON.stringify(currentUser));
      } catch (err) {
        console.error("Failed to load profile", err);
      }
    };

    fetchUser();
  }, [token]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleUpdate = async () => {
    const hasChanges =
      form.name.trim() ||
      form.email.trim() ||
      form.phone.trim() ||
      form.password.trim() ||
      form.notification_mode ||
      form.location.trim();

    if (!hasChanges) {
      toast.error("Please update at least one field");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        name: form.name.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password || undefined,
        notification_mode: form.notification_mode
      };

      if (user?.role !== "admin") {
        payload.location = form.location.trim() || undefined;
      }

      const res = await API.put("/user/update", payload);

      const updatedUser = { ...user, ...res.data.user };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      toast.success("Profile updated successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete your account?")) return;

    try {
      await API.delete("/auth/delete-account");

      localStorage.clear();
      window.location.href = "/";
    } catch {
      toast.error("Failed to delete account");
    }
  };

  return (
    <div className="profile-page">

      {/* LEFT INFO PANEL */}
      <div className="profile-left">

        <img src={profileImg} alt="profile" className="profile-image" />

        <div className="profile-heading">
          <h2>{user?.name}</h2>
          {user?.role === "donor" && user?.verification_status === "verified" && (
            <span className="profile-verified">
              <FaCheckCircle /> Verified donor
            </span>
          )}
        </div>

        <div className="profile-info">
          <p><span>Name:</span> {user?.name}</p>
          <p><span>Email:</span> {user?.email}</p>
          <p><span>Phone:</span> {user?.phone}</p>
          {user?.role !== "admin" && (
            <p><span>Location:</span> {user?.location || "Not set"}</p>
          )}
          <p><span>Notifications:</span> {user?.notification_mode || "whatsapp"}</p>
          {user?.verification_status === "verified" && (
            <>
              <p><span>Status:</span> Verified donor</p>
              <p><span>Badge expires:</span> {formatDate(user?.verification_expires_at) || "Not set"}</p>
            </>
          )}
        </div>

      </div>

      {/* RIGHT EDIT PANEL */}
      <div className="profile-right">

        <div className="profile-card">

          <h3>Edit Profile</h3>

          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Name"
          />

          <input
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Email"
          />

          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="Phone"
          />

          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="New Password"
          />

          {user?.role !== "admin" && (
            <input
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="Location"
            />
          )}

          <SelectMenu
            value={form.notification_mode}
            onChange={(notification_mode) => setForm({ ...form, notification_mode })}
            options={[
              { value: "whatsapp", label: "WhatsApp" },
              { value: "sms", label: "SMS" }
            ]}
          />

          <button
            className="btn-primary"
            onClick={handleUpdate}
            disabled={loading}
          >
            {loading ? "Updating..." : "Save Changes"}
          </button>

          <button
            className="btn-danger"
            onClick={handleDelete}
          >
            Delete Account
          </button>

        </div>

      </div>

    </div>
  );
}

export default Profile;
