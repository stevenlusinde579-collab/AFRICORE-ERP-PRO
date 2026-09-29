import React from "react";
import { useNavigate } from "react-router-dom";
import {
    FaArrowLeft,
    FaExclamationTriangle,
    FaHome,
    FaLock,
} from "react-icons/fa";

const AccessDenied = () => {
    const navigate = useNavigate();

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
                background:
                    "linear-gradient(135deg, #eff6ff 0%, #f8fafc 50%, #e0f2fe 100%)",
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: "620px",
                    background: "#ffffff",
                    borderRadius: "24px",
                    padding: "48px 40px",
                    textAlign: "center",
                    boxShadow:
                        "0 20px 60px rgba(15, 23, 42, 0.12)",
                    border: "1px solid #e2e8f0",
                }}
            >
                {/* ICON */}
                <div
                    style={{
                        width: "90px",
                        height: "90px",
                        margin: "0 auto 24px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#fef2f2",
                        color: "#dc2626",
                        fontSize: "38px",
                    }}
                >
                    <FaLock />
                </div>

                {/* TITLE */}
                <h1
                    style={{
                        margin: "0 0 12px",
                        color: "#0f172a",
                        fontSize: "32px",
                        fontWeight: 800,
                    }}
                >
                    Access Denied
                </h1>

                {/* DESCRIPTION */}
                <p
                    style={{
                        margin: "0 auto 12px",
                        maxWidth: "500px",
                        color: "#475569",
                        fontSize: "16px",
                        lineHeight: 1.7,
                    }}
                >
                    You do not have permission to access this
                    page or perform this action.
                </p>

                <p
                    style={{
                        margin: "0 auto 30px",
                        maxWidth: "500px",
                        color: "#64748b",
                        fontSize: "14px",
                        lineHeight: 1.6,
                    }}
                >
                    If you believe you should have access,
                    please contact your school administrator.
                </p>

                {/* WARNING */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        textAlign: "left",
                        padding: "14px 16px",
                        marginBottom: "28px",
                        borderRadius: "12px",
                        background: "#fffbeb",
                        border: "1px solid #fde68a",
                        color: "#92400e",
                        fontSize: "14px",
                    }}
                >
                    <FaExclamationTriangle
                        style={{
                            flexShrink: 0,
                            fontSize: "18px",
                        }}
                    />

                    <span>
                        Your account is authenticated, but
                        your current role does not have the
                        required permission.
                    </span>
                </div>

                {/* BUTTONS */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                    }}
                >
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            padding: "12px 20px",
                            borderRadius: "10px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            color: "#334155",
                            fontSize: "14px",
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        <FaArrowLeft />
                        Go Back
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate("/dashboard")}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            padding: "12px 20px",
                            borderRadius: "10px",
                            border: "none",
                            background: "#2563eb",
                            color: "#ffffff",
                            fontSize: "14px",
                            fontWeight: 700,
                            cursor: "pointer",
                            boxShadow:
                                "0 6px 18px rgba(37, 99, 235, 0.25)",
                        }}
                    >
                        <FaHome />
                        Go to Dashboard
                    </button>
                </div>

                {/* FOOTER */}
                <div
                    style={{
                        marginTop: "32px",
                        paddingTop: "20px",
                        borderTop: "1px solid #e2e8f0",
                        color: "#94a3b8",
                        fontSize: "12px",
                        fontWeight: 600,
                    }}
                >
                    AfriCore ERP • Secure Access Control
                </div>
            </div>
        </div>
    );
};

export default AccessDenied;