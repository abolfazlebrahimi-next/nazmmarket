import React from "react";
import ReactDOM from "react-dom/client";
import SellerApp from "./SellerApp";
import "./style.css";
import "../../shared/formValidation";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SellerApp />
  </React.StrictMode>,
);
