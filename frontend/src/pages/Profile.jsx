import { useState, useEffect } from "react";
import API from "../services/api";
import { toast } from "react-toastify";
import { FaCheckCircle } from "react-icons/fa";
import SelectMenu from "../components/SelectMenu";
import { FOOD_CATEGORIES } from "../constants/foodCategories";
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
    latitude: storedUser.latitude || null,
    longitude: storedUser.longitude || null,
    notification_mode: storedUser.notification_mode || "whatsapp",
    preferred_food_types: storedUser.preferred_food_types || [],
    food_notifications_enabled: storedUser.food_notifications_enabled !== false
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
          latitude: currentUser.latitude || null,
          longitude: currentUser.longitude || null,
          notification_mode: currentUser.notification_mode || "whatsapp",
          preferred_food_types: currentUser.preferred_food_types || [],
          food_notifications_enabled: currentUser.food_notifications_enabled !== false
        });
        localStorage.setItem("user", JSON.stringify(currentUser));
      } catch (err) {
        console.error("Failed to load profile", err);
      }
    };

    fetchUser();
  }, [token]);

  const handleChange = (e) => {
    if (e.target.name === "location") {
      setForm({
        ...form,
        location: e.target.value,
        latitude: null,
        longitude: null
      });
      return;
    }

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

  const geocodeLocation = async (location) => {
    const query = location.trim();
    if (!query) return null;

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
    );

    if (!res.ok) return null;

    const results = await res.json();
    const match = results[0];

    if (!match) return null;

    return {
      latitude: Number(match.lat),
      longitude: Number(match.lon)
    };
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

      if (user?.role === "recipient") {
        payload.preferred_food_types = form.preferred_food_types;
        payload.food_notifications_enabled = form.food_notifications_enabled;
      }

      if (user?.role !== "admin") {
        const nextLocation = form.location.trim();
        payload.location = nextLocation || undefined;

        if (nextLocation) {
          const locationChanged = nextLocation !== (user?.location || "");
          const needsCoordinates = !form.latitude || !form.longitude || locationChanged;
          const coordinates = needsCoordinates
            ? await geocodeLocation(nextLocation)
            : { latitude: form.latitude, longitude: form.longitude };

          if (!coordinates || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) {
            toast.error("Could not find coordinates for that location. Please enter a more specific place.");
            return;
          }

          payload.latitude = coordinates.latitude;
          payload.longitude = coordinates.longitude;
        }
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
          {user?.role !== "admin" && (
            <p><span>Notifications:</span> {user?.notification_mode || "whatsapp"}</p>
          )}
          {user?.role === "recipient" && (
            <p><span>Food alerts:</span> {user?.food_notifications_enabled === false ? "Off" : "On"}</p>
          )}
          {user?.role === "recipient" && (
            <p><span>Food preferences:</span> {(user?.preferred_food_types || []).join(", ") || "All food"}</p>
          )}
          {user?.role === "donor" && user?.verification_status === "verified" && (
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

          {user?.role !== "admin" && (
            <SelectMenu
              value={form.notification_mode}
              onChange={(notification_mode) => setForm({ ...form, notification_mode })}
              options={[
                { value: "whatsapp", label: "WhatsApp" },
                { value: "sms", label: "SMS" }
              ]}
            />
          )}

          {user?.role === "recipient" && (
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
