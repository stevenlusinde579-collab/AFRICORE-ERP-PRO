import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import "./index.css";
import App from "./App.jsx";

import { AuthProvider } from "./context/AuthContext";
import { SchoolProvider } from "./context/SchoolContext";
import { RoleProvider } from "./context/RoleContext";

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <RoleProvider>
                    <SchoolProvider>
                        <App />
                        <Toaster position="top-right" />
                    </SchoolProvider>
                </RoleProvider>
            </AuthProvider>
        </BrowserRouter>
    </StrictMode>
);