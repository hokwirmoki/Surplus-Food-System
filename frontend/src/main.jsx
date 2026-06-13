import React from "react";
import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./App.css";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { registerServiceWorker } from "./registerServiceWorker";

registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  // ❌ REMOVE StrictMode (this is the root cause)
  <BrowserRouter>
    <App />

    <ToastContainer
      position="top-right"
      autoClose={2000}
      limit={1}              // ✅ only one toast at a time
      newestOnTop
      closeOnClick
      pauseOnHover
    />
  </BrowserRouter>
);
