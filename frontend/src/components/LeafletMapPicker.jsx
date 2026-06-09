import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap
} from "react-leaflet";
import { useState, useEffect } from "react";
import L from "leaflet";

// fix leaflet default icons
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

// 🔥 Fix blank map inside modal
function ResizeMap() {
  const map = useMap();

  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [map]);

  return null;
}

// 📍 click handler
function MapClickHandler({ setPosition, setAddress }) {
  useMapEvents({
    click(e) {
      updateLocation(e.latlng);
    }
  });

  const updateLocation = async (latlng) => {
    setPosition(latlng);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`
      );

      const data = await res.json();

      const name =
        data.display_name?.split(",").slice(0, 2).join(" - ") ||
        `${latlng.lat}, ${latlng.lng}`;

      setAddress(name);
    } catch {
      setAddress(`${latlng.lat}, ${latlng.lng}`);
    }
  };

  return null;
}

export default function LeafletLocationPicker({ onSelect }) {
  const [position, setPosition] = useState({
    lat: 0.3476, // Kampala
    lng: 32.5825
  });

  const [address, setAddress] = useState("");

  // send to parent
  useEffect(() => {
    onSelect({
      lat: position.lat,
      lng: position.lng,
      location: address
    });
  }, [position, address]);

  return (
    <div>
      <MapContainer
        center={position}
        zoom={13}
        style={{ height: "400px", width: "100%" }}
      >
        <ResizeMap />

        {/* ✅ FIXED TILE SERVER (Carto CDN) */}
        <TileLayer
          attribution="&copy; OpenStreetMap & Carto"
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        <MapClickHandler
          setPosition={setPosition}
          setAddress={setAddress}
        />

        {/* 📍 draggable marker */}
        <Marker
          position={position}
          draggable={true}
          eventHandlers={{
            dragend: async (e) => {
              const latlng = e.target.getLatLng();
              setPosition(latlng);

              try {
                const res = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`
                );

                const data = await res.json();

                const name =
                  data.display_name?.split(",").slice(0, 2).join(" - ") ||
                  `${latlng.lat}, ${latlng.lng}`;

                setAddress(name);
              } catch {
                setAddress(`${latlng.lat}, ${latlng.lng}`);
              }
            }
          }}
        />
      </MapContainer>

      <p style={{ marginTop: 10 }}>
        📍 Selected: {address || "Click or drag pin"}
      </p>
    </div>
  );
}