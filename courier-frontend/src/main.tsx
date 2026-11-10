import React from "react";
import { createRoot } from "react-dom/client";
import CourierApp from "./CourierApp";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CourierApp />
  </React.StrictMode>,
);
