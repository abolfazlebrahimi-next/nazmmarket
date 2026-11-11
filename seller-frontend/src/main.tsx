import React from "react";
import ReactDOM from "react-dom/client";
import SellerApp from "./SellerApp";
/* Same bundled Vazirmatn as the customer app, seller panel and courier panel. */
import "@fontsource-variable/vazirmatn";
import "./style.css";
import "../../shared/formValidation";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SellerApp />
  </React.StrictMode>,
);
