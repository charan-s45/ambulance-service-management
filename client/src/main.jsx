import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { FlashProvider } from "./context/FlashContext.jsx";
import "./styles/app.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <FlashProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </FlashProvider>
    </BrowserRouter>
  </StrictMode>,
);
