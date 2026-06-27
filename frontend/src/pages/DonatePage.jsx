import { useCallback, useEffect, useRef, useState } from "react";
import API from "../services/api";
import { toast } from "react-toastify";
import { formatUGX } from "../utils/formatMoney";
import {
  FaCheckCircle,
  FaInfoCircle,
  FaTimesCircle
} from "react-icons/fa";

import "../styles/donatePage.css";
import LeafletLocationPicker from "../components/LeafletMapPicker";
import DateTimePicker from "../components/DateTimePicker";
import SelectMenu from "../components/SelectMenu";
import { FOOD_CATEGORIES } from "../constants/foodCategories";

const MIN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const EXPIRY_ERROR_MESSAGE = "Expiry time must be more than 5 minutes from now.";

function hasSafeExpiryTime(value) {
  const expiry = new Date(value);

  return !Number.isNaN(expiry.getTime()) && expiry.getTime() > Date.now() + MIN_EXPIRY_BUFFER_MS;
}

async function reverseGeocodeLocation(latitude, longitude) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
    );

    if (!res.ok) throw new Error("Reverse geocoding failed");

    const data = await res.json();

    return (
      data.display_name?.split(",").slice(0, 3).join(" - ") ||
      `${latitude}, ${longitude}`
    );
  } catch {
    return `${latitude}, ${longitude}`;
  }
}

function DonatePage() {
  const urlParams = new URLSearchParams(window.location.search);
  const isDiscounted = urlParams.get('discounted') === 'true';
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  const savedLocation = storedUser.location || "";
  const savedLatitude = storedUser.latitude || "";
  const savedLongitude = storedUser.longitude || "";
  const currentLocationRequested = useRef(false);

  const [form, setForm] = useState({
    food_type: "",
    quantity: "",
    expiry_time: "",
    price: "",
    location: savedLocation,
    lat: savedLatitude,
    lng: savedLongitude
  });

  const [foods, setFoods] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const [locationSource, setLocationSource] = useState(savedLocation ? "saved" : "");

  // PAGINATION
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const handleChange = (e) => {
    if (e.target.name === "location") {
      setForm({
        ...form,
        location: e.target.value,
        lat: "",
        lng: ""
      });
      setLocationSource("manual");
      return;
    }

    setForm({ ...form, [e.target.name]: e.target.value });
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

  const validateFood = () => {
    if (!form.food_type.trim() || !form.quantity.trim() || !form.expiry_time) {
      toast.error("Please fill in food type, quantity and expiry time.");
      return false;
    }

    if (!hasSafeExpiryTime(form.expiry_time)) {
      toast.error(EXPIRY_ERROR_MESSAGE);
      return false;
    }

    if (!form.location.trim()) {
      toast.error("Please provide the food location.");
      return false;
    }

    if (isDiscounted && !form.price.trim()) {
      toast.error("Please enter a price for discounted food.");
      return false;
    }

    return true;
  };

  const useCurrentLocation = useCallback(({ silent = false } = {}) => {
    if (!navigator.geolocation) {
      if (!silent) {
        toast.error("Current location is not available in this browser.");
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const location = await reverseGeocodeLocation(latitude, longitude);

        setForm((prev) => ({
          ...prev,
          location,
          lat: latitude,
          lng: longitude
        }));
        setLocationSource("current");
        toast.success("Current location has been recorded and will be used for this food.");
      },
      () => {
        if (!silent) {
          toast.error("Could not get current location. Use your saved location or pick one on the map.");
        }
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  const useSavedLocation = useCallback(() => {
    if (!savedLocation.trim()) {
      toast.error("No saved registration location was found.");
      return;
    }

    setForm((prev) => ({
      ...prev,
      location: savedLocation,
      lat: savedLatitude,
      lng: savedLongitude
    }));
    setLocationSource("saved");
    toast.success("Saved registration location will be used for this food.");
  }, [savedLatitude, savedLocation, savedLongitude]);

  const handleMapSelect = useCallback((data) => {
    if (!data.location) return;

    setForm((prev) => ({
      ...prev,
      lat: data.lat,
      lng: data.lng,
      location: data.location
    }));
    setLocationSource("map");
  }, []);

  const handleExpiryChange = (expiry_time) => {
    if (!expiry_time) {
      setForm({ ...form, expiry_time });
      return;
    }

    if (!hasSafeExpiryTime(expiry_time)) {
      toast.error(EXPIRY_ERROR_MESSAGE);
      return;
    }

    setForm({ ...form, expiry_time });
  };

  const formatDate = (date) => {
    if (!date) return "No expiry";
    return new Date(date).toLocaleString();
  };

  const postFood = async () => {
    if (!validateFood()) return;

    try {
      const coordinates = form.lat && form.lng
        ? { latitude: Number(form.lat), longitude: Number(form.lng) }
        : await geocodeLocation(form.location);

      if (!coordinates || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) {
        toast.error("Could not find coordinates for that location. Please enter a more specific place or pick it on the map.");
        return;
      }

      const payload = {
        food_type: form.food_type,
        quantity: form.quantity,
        expiry_time: form.expiry_time,
        is_discounted: isDiscounted,
        price: isDiscounted ? form.price : null,
        location: form.location,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude
      };

      await API.post("/food/post", payload);

      toast.success("Food posted successfully");

      setForm({
        food_type: "",
        quantity: "",
        expiry_time: "",
        price: "",
        location: form.location,
        lat: form.lat,
        lng: form.lng
      });

      fetchFoods();
    } catch {
      toast.error("Failed to post food");
    }
  };

  const fetchFoods = useCallback(async () => {
    try {
      const res = await API.get("/food/posted");

      const filtered = res.data.filter((food) =>
        Boolean(food.is_discounted) === isDiscounted
      );

      setFoods(filtered);
      setCurrentPage(1);
    } catch {
      toast.error("Failed to load foods");
    }
  }, [isDiscounted]);

  useEffect(() => {
    const timer = window.setTimeout(fetchFoods, 0);
    return () => window.clearTimeout(timer);
  }, [fetchFoods]);

  useEffect(() => {
    if (currentLocationRequested.current) return;

    currentLocationRequested.current = true;
    useCurrentLocation({ silent: true });
  }, [useCurrentLocation]);

  /* PAGINATION LOGIC */
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentFoods = foods.slice(indexOfFirst, indexOfLast);

  const totalPages = Math.ceil(foods.length / itemsPerPage);

  return (
    <div className="donate-page">

      <div className="donate-grid">

        {/* FORM */}
        <div className="donate-card">
          <h2>{isDiscounted ? "Post Discounted Food" : "Donate Food"}</h2>

          <SelectMenu
            value={form.food_type}
            onChange={(food_type) => setForm({ ...form, food_type })}
            options={FOOD_CATEGORIES}
            placeholder="Food Category"
            className="donate-select"
          />

          <input
            name="quantity"
            value={form.quantity}
            placeholder="Quantity"
            onChange={handleChange}
          />

          {isDiscounted && (
            <input
              name="price"
              value={form.price}
              placeholder="Price (UGX)"
              onChange={handleChange}
            />
          )}

          <DateTimePicker
            value={form.expiry_time}
            onChange={handleExpiryChange}
          />

          <input
            name="location"
            value={form.location}
            placeholder="Location"
            onChange={handleChange}
          />

          <div className="location-actions">
            <button
              className={`secondary-btn ${locationSource === "current" ? "active" : ""}`}
              onClick={() => useCurrentLocation()}
            >
              Use Current Location
            </button>
            <button
              className={`secondary-btn ${locationSource === "saved" ? "active" : ""}`}
              onClick={useSavedLocation}
            >
              Use Saved Location
            </button>
            <button
              className={`secondary-btn ${locationSource === "map" ? "active" : ""}`}
              onClick={() => setShowMap(true)}
            >
              Pick Location on Map
            </button>
          </div>

          <div className="btn-group">
            <button className="post-btn" onClick={postFood}>
              Post Food
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="food-table">
          <h3>Posted Food</h3>

          <table>
            <thead>
              <tr>
                <th>Food</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Expiry</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {currentFoods.map((food) => (
                <tr key={food.id}>
                  <td>{food.food_type}</td>
                  <td>{food.quantity}</td>
                  <td>{food.discount_price ? formatUGX(food.discount_price) : 'Free'}</td>
                  <td>{formatDate(food.expiry_time)}</td>

                  <td>
                    <span className={`status ${food.status?.toLowerCase()}`}>

                      {food.status?.toLowerCase() === "available" && (
                        <>
                          <FaInfoCircle className="status-icon status-icon--available" />
                          Available
                        </>
                      )}

                      {food.status?.toLowerCase() === "claimed" && (
                        <>
                          <FaCheckCircle className="status-icon status-icon--claimed" />
                          Claimed
                        </>
                      )}

                      {food.status?.toLowerCase() === "expired" && (
                        <>
                          <FaTimesCircle className="status-icon status-icon--expired" />
                          Expired
                        </>
                      )}

                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* PAGINATION */}
          {totalPages > 1 && (
            <div className="pagination">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  className={currentPage === i + 1 ? "active" : ""}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}

        </div>

      </div>

      {/* MAP */}
      {showMap && (
        <div className="map-overlay">
          <div className="map-modal">
            <div className="map-modal-header">
              <div>
                <h3>Choose Pickup Location</h3>
                <p>Click the map or drag the pin to set the food pickup point.</p>
              </div>
              <button className="map-close-btn" onClick={() => setShowMap(false)}>
                Close
              </button>
            </div>
            <LeafletLocationPicker onSelect={handleMapSelect} />
          </div>
        </div>
      )}

    </div>
  );
}

export default DonatePage;
