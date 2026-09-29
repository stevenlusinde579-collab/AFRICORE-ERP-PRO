import React, {
    useEffect,
    useState,
} from "react";

import { supabase } from "../services/supabase";
import api from "../services/api";

const AuthTest = () => {
    const [loading, setLoading] =
        useState(true);

    const [session, setSession] =
        useState(null);

    const [authResponse, setAuthResponse] =
        useState(null);

    const [profileResponse, setProfileResponse] =
        useState(null);

    const [authError, setAuthError] =
        useState(null);

    const [profileError, setProfileError] =
        useState(null);

    useEffect(() => {
        const testAuthentication =
            async () => {
                try {
                    setLoading(true);

                    setAuthError(null);
                    setProfileError(null);

                    setAuthResponse(null);
                    setProfileResponse(null);

                    // ==================================================
                    // 1. GET CURRENT SUPABASE SESSION
                    // ==================================================

                    const {
                        data: sessionData,
                        error: sessionError,
                    } =
                        await supabase.auth.getSession();

                    if (sessionError) {
                        throw sessionError;
                    }

                    const currentSession =
                        sessionData?.session ||
                        null;

                    setSession(
                        currentSession
                    );

                    // ==================================================
                    // STOP IF NO SESSION
                    // ==================================================

                    if (!currentSession) {
                        setAuthResponse({
                            success: false,
                            message:
                                "No active Supabase session found.",
                        });

                        return;
                    }

                    // ==================================================
                    // 2. TEST BACKEND /api/auth/me
                    // ==================================================

                    try {
                        const response =
                            await api.get(
                                "/auth/me"
                            );

                        setAuthResponse(
                            response?.data ||
                                null
                        );
                    } catch (err) {
                        console.error(
                            "AUTH /ME ERROR:",
                            err
                        );

                        setAuthError(
                            err?.response
                                ?.data ||
                                err?.message ||
                                "Backend authentication test failed."
                        );
                    }

                    // ==================================================
                    // 3. TEST AFRICORE PROFILE
                    // ==================================================

                    try {
                        const profileResponseData =
                            await api.get(
                                "/auth/profile"
                            );

                        setProfileResponse(
                            profileResponseData?.data ||
                                null
                        );
                    } catch (err) {
                        console.error(
                            "AUTH PROFILE ERROR:",
                            err
                        );

                        setProfileError(
                            err?.response
                                ?.data ||
                                err?.message ||
                                "AfriCore profile test failed."
                        );
                    }
                } catch (err) {
                    console.error(
                        "AUTH TEST ERROR:",
                        err
                    );

                    setAuthError(
                        err?.response
                            ?.data ||
                            err?.message ||
                            "Authentication test failed."
                    );
                } finally {
                    setLoading(false);
                }
            };

        testAuthentication();
    }, []);

    // ==============================================================
    // SAFE DATA HELPERS
    // ==============================================================

    const roles =
        Array.isArray(
            profileResponse?.roles
        )
            ? profileResponse.roles
            : [];

    const permissions =
        Array.isArray(
            profileResponse?.permissions
        )
            ? profileResponse.permissions
            : [];

    const scopes =
        Array.isArray(
            profileResponse?.scopes
        )
            ? profileResponse.scopes
            : [];

    const profile =
        profileResponse?.profile ||
        null;

    const authUser =
        profileResponse?.auth_user ||
        null;

    const isSuperAdmin =
        profileResponse?.isSuperAdmin ===
        true;

    return (
        <div
            style={{
                minHeight: "100vh",
                padding: "40px",
                background:
                    "#f5f7fb",
                fontFamily:
                    "Arial, sans-serif",
            }}
        >
            <div
                style={{
                    maxWidth:
                        "1100px",
                    margin:
                        "0 auto",
                    background:
                        "#ffffff",
                    borderRadius:
                        "16px",
                    padding:
                        "30px",
                    boxShadow:
                        "0 10px 30px rgba(0,0,0,0.08)",
                }}
            >
                {/* =====================================================
                    PAGE HEADER
                ====================================================== */}

                <div
                    style={{
                        marginBottom:
                            "30px",
                    }}
                >
                    <h1
                        style={{
                            marginBottom:
                                "8px",
                        }}
                    >
                        AfriCore Authentication
                        & Access Test
                    </h1>

                    <p
                        style={{
                            margin:
                                0,
                            color:
                                "#64748b",
                        }}
                    >
                        Testing Supabase
                        authentication,
                        AfriCore profile,
                        roles,
                        permissions and
                        data scopes.
                    </p>
                </div>

                {/* =====================================================
                    LOADING
                ====================================================== */}

                {loading && (
                    <div
                        style={{
                            padding:
                                "20px",
                            background:
                                "#eff6ff",
                            borderRadius:
                                "10px",
                            color:
                                "#1d4ed8",
                            marginBottom:
                                "20px",
                        }}
                    >
                        Testing
                        authentication and
                        AfriCore access...
                    </div>
                )}

                {!loading && (
                    <>
                        {/* =================================================
                            SECTION 1
                        ================================================== */}

                        <hr />

                        <h2
                            style={{
                                marginTop:
                                    "25px",
                            }}
                        >
                            1. Supabase Session
                        </h2>

                        {session ? (
                            <div
                                style={{
                                    padding:
                                        "18px",
                                    background:
                                        "#ecfdf5",
                                    border:
                                        "1px solid #bbf7d0",
                                    borderRadius:
                                        "10px",
                                }}
                            >
                                <div
                                    style={{
                                        fontWeight:
                                            "bold",
                                        color:
                                            "#166534",
                                        marginBottom:
                                            "10px",
                                    }}
                                >
                                    ✓ Session Found
                                </div>

                                <pre
                                    style={{
                                        whiteSpace:
                                            "pre-wrap",
                                        wordBreak:
                                            "break-word",
                                        margin:
                                            0,
                                    }}
                                >
                                    {JSON.stringify(
                                        {
                                            userId:
                                                session
                                                    ?.user
                                                    ?.id,
                                            email:
                                                session
                                                    ?.user
                                                    ?.email,
                                            expiresAt:
                                                session
                                                    ?.expires_at,
                                            accessTokenFound:
                                                Boolean(
                                                    session
                                                        ?.access_token
                                                ),
                                        },
                                        null,
                                        2
                                    )}
                                </pre>
                            </div>
                        ) : (
                            <div
                                style={{
                                    padding:
                                        "18px",
                                    background:
                                        "#fef2f2",
                                    border:
                                        "1px solid #fecaca",
                                    color:
                                        "#991b1b",
                                    borderRadius:
                                        "10px",
                                }}
                            >
                                No active
                                Supabase session.
                                Please login first.
                            </div>
                        )}

                        {/* =================================================
                            SECTION 2
                        ================================================== */}

                        <hr
                            style={{
                                marginTop:
                                    "30px",
                            }}
                        />

                        <h2
                            style={{
                                marginTop:
                                    "25px",
                            }}
                        >
                            2. Backend /api/auth/me
                        </h2>

                        {authResponse && (
                            <div
                                style={{
                                    padding:
                                        "18px",
                                    background:
                                        authResponse.success
                                            ? "#eff6ff"
                                            : "#fef2f2",
                                    border:
                                        authResponse.success
                                            ? "1px solid #bfdbfe"
                                            : "1px solid #fecaca",
                                    borderRadius:
                                        "10px",
                                }}
                            >
                                <div
                                    style={{
                                        fontWeight:
                                            "bold",
                                        marginBottom:
                                            "10px",
                                        color:
                                            authResponse.success
                                                ? "#1d4ed8"
                                                : "#991b1b",
                                    }}
                                >
                                    {authResponse.success
                                        ? "✓ Backend Authentication Successful"
                                        : "✗ Backend Authentication Failed"}
                                </div>

                                <pre
                                    style={{
                                        whiteSpace:
                                            "pre-wrap",
                                        wordBreak:
                                            "break-word",
                                        margin:
                                            0,
                                    }}
                                >
                                    {JSON.stringify(
                                        authResponse,
                                        null,
                                        2
                                    )}
                                </pre>
                            </div>
                        )}

                        {authError && (
                            <div
                                style={{
                                    marginTop:
                                        "15px",
                                    padding:
                                        "18px",
                                    background:
                                        "#fef2f2",
                                    border:
                                        "1px solid #fecaca",
                                    color:
                                        "#991b1b",
                                    borderRadius:
                                        "10px",
                                }}
                            >
                                <strong>
                                    Backend Authentication
                                    Error
                                </strong>

                                <pre
                                    style={{
                                        whiteSpace:
                                            "pre-wrap",
                                        wordBreak:
                                            "break-word",
                                    }}
                                >
                                    {JSON.stringify(
                                        authError,
                                        null,
                                        2
                                    )}
                                </pre>
                            </div>
                        )}

                        {/* =================================================
                            SECTION 3
                        ================================================== */}

                        <hr
                            style={{
                                marginTop:
                                    "30px",
                            }}
                        />

                        <h2
                            style={{
                                marginTop:
                                    "25px",
                            }}
                        >
                            3. AfriCore Profile
                        </h2>

                        {profileResponse && (
                            <>
                                {/* SUCCESS HEADER */}

                                <div
                                    style={{
                                        padding:
                                            "18px",
                                        background:
                                            profileResponse.success
                                                ? "#ecfdf5"
                                                : "#fef2f2",
                                        border:
                                            profileResponse.success
                                                ? "1px solid #bbf7d0"
                                                : "1px solid #fecaca",
                                        borderRadius:
                                            "10px",
                                        marginBottom:
                                            "20px",
                                    }}
                                >
                                    <strong
                                        style={{
                                            color:
                                                profileResponse.success
                                                    ? "#166534"
                                                    : "#991b1b",
                                        }}
                                    >
                                        {profileResponse.success
                                            ? "✓ AfriCore Profile Loaded Successfully"
                                            : "✗ AfriCore Profile Failed"}
                                    </strong>

                                    <pre
                                        style={{
                                            whiteSpace:
                                                "pre-wrap",
                                            wordBreak:
                                                "break-word",
                                            marginTop:
                                                "15px",
                                        }}
                                    >
                                        {JSON.stringify(
                                            profileResponse,
                                            null,
                                            2
                                        )}
                                    </pre>
                                </div>

                                {profileResponse.success &&
                                    profile && (
                                        <>
                                            {/* =====================================
                                                ACCESS SUMMARY
                                            ====================================== */}

                                            <div
                                                style={{
                                                    display:
                                                        "grid",
                                                    gridTemplateColumns:
                                                        "repeat(auto-fit, minmax(200px, 1fr))",
                                                    gap:
                                                        "15px",
                                                    marginBottom:
                                                        "25px",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        padding:
                                                            "18px",
                                                        background:
                                                            "#f8fafc",
                                                        borderRadius:
                                                            "12px",
                                                        border:
                                                            "1px solid #e2e8f0",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            color:
                                                                "#64748b",
                                                            fontSize:
                                                                "13px",
                                                            marginBottom:
                                                                "5px",
                                                        }}
                                                    >
                                                        Profile
                                                    </div>

                                                    <strong>
                                                        {profile.full_name ||
                                                            "N/A"}
                                                    </strong>
                                                </div>

                                                <div
                                                    style={{
                                                        padding:
                                                            "18px",
                                                        background:
                                                            "#f8fafc",
                                                        borderRadius:
                                                            "12px",
                                                        border:
                                                            "1px solid #e2e8f0",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            color:
                                                                "#64748b",
                                                            fontSize:
                                                                "13px",
                                                            marginBottom:
                                                                "5px",
                                                        }}
                                                    >
                                                        Roles
                                                    </div>

                                                    <strong>
                                                        {
                                                            roles.length
                                                        }
                                                    </strong>
                                                </div>

                                                <div
                                                    style={{
                                                        padding:
                                                            "18px",
                                                        background:
                                                            "#f8fafc",
                                                        borderRadius:
                                                            "12px",
                                                        border:
                                                            "1px solid #e2e8f0",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            color:
                                                                "#64748b",
                                                            fontSize:
                                                                "13px",
                                                            marginBottom:
                                                                "5px",
                                                        }}
                                                    >
                                                        Permissions
                                                    </div>

                                                    <strong>
                                                        {
                                                            permissions.length
                                                        }
                                                    </strong>
                                                </div>

                                                <div
                                                    style={{
                                                        padding:
                                                            "18px",
                                                        background:
                                                            "#f8fafc",
                                                        borderRadius:
                                                            "12px",
                                                        border:
                                                            "1px solid #e2e8f0",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            color:
                                                                "#64748b",
                                                            fontSize:
                                                                "13px",
                                                            marginBottom:
                                                                "5px",
                                                        }}
                                                    >
                                                        Scopes
                                                    </div>

                                                    <strong>
                                                        {
                                                            scopes.length
                                                        }
                                                    </strong>
                                                </div>

                                                <div
                                                    style={{
                                                        padding:
                                                            "18px",
                                                        background:
                                                            isSuperAdmin
                                                                ? "#ecfdf5"
                                                                : "#f8fafc",
                                                        borderRadius:
                                                            "12px",
                                                        border:
                                                            isSuperAdmin
                                                                ? "1px solid #bbf7d0"
                                                                : "1px solid #e2e8f0",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            color:
                                                                "#64748b",
                                                            fontSize:
                                                                "13px",
                                                            marginBottom:
                                                                "5px",
                                                        }}
                                                    >
                                                        Super Admin
                                                    </div>

                                                    <strong
                                                        style={{
                                                            color:
                                                                isSuperAdmin
                                                                    ? "#166534"
                                                                    : "#475569",
                                                        }}
                                                    >
                                                        {isSuperAdmin
                                                            ? "YES"
                                                            : "NO"}
                                                    </strong>
                                                </div>
                                            </div>

                                            {/* =====================================
                                                AUTH USER
                                            ====================================== */}

                                            <div
                                                style={{
                                                    marginBottom:
                                                        "20px",
                                                }}
                                            >
                                                <h3>
                                                    Authenticated
                                                    User
                                                </h3>

                                                <div
                                                    style={{
                                                        padding:
                                                            "15px",
                                                        background:
                                                            "#f8fafc",
                                                        borderRadius:
                                                            "10px",
                                                    }}
                                                >
                                                    <pre
                                                        style={{
                                                            whiteSpace:
                                                                "pre-wrap",
                                                            wordBreak:
                                                                "break-word",
                                                            margin:
                                                                0,
                                                        }}
                                                    >
                                                        {JSON.stringify(
                                                            authUser,
                                                            null,
                                                            2
                                                        )}
                                                    </pre>
                                                </div>
                                            </div>

                                            {/* =====================================
                                                PROFILE
                                            ====================================== */}

                                            <div
                                                style={{
                                                    marginBottom:
                                                        "20px",
                                                }}
                                            >
                                                <h3>
                                                    AfriCore
                                                    Profile
                                                </h3>

                                                <div
                                                    style={{
                                                        padding:
                                                            "15px",
                                                        background:
                                                            "#f8fafc",
                                                        borderRadius:
                                                            "10px",
                                                    }}
                                                >
                                                    <pre
                                                        style={{
                                                            whiteSpace:
                                                                "pre-wrap",
                                                            wordBreak:
                                                                "break-word",
                                                            margin:
                                                                0,
                                                        }}
                                                    >
                                                        {JSON.stringify(
                                                            profile,
                                                            null,
                                                            2
                                                        )}
                                                    </pre>
                                                </div>
                                            </div>

                                            {/* =====================================
                                                ROLES
                                            ====================================== */}

                                            <div
                                                style={{
                                                    marginBottom:
                                                        "20px",
                                                }}
                                            >
                                                <h3>
                                                    Roles
                                                </h3>

                                                {roles.length ===
                                                0 ? (
                                                    <div
                                                        style={{
                                                            padding:
                                                                "15px",
                                                            background:
                                                                "#fff7ed",
                                                            color:
                                                                "#9a3412",
                                                            borderRadius:
                                                                "10px",
                                                        }}
                                                    >
                                                        No active
                                                        roles found.
                                                    </div>
                                                ) : (
                                                    <div
                                                        style={{
                                                            display:
                                                                "grid",
                                                            gap:
                                                                "10px",
                                                        }}
                                                    >
                                                        {roles.map(
                                                            (
                                                                role
                                                            ) => (
                                                                <div
                                                                    key={
                                                                        role.id
                                                                    }
                                                                    style={{
                                                                        padding:
                                                                            "15px",
                                                                        background:
                                                                            "#f8fafc",
                                                                        border:
                                                                            "1px solid #e2e8f0",
                                                                        borderRadius:
                                                                            "10px",
                                                                    }}
                                                                >
                                                                    <strong>
                                                                        {
                                                                            role.role_name
                                                                        }
                                                                    </strong>

                                                                    {role.description && (
                                                                        <div
                                                                            style={{
                                                                                marginTop:
                                                                                    "5px",
                                                                                color:
                                                                                    "#64748b",
                                                                            }}
                                                                        >
                                                                            {
                                                                                role.description
                                                                            }
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* =====================================
                                                PERMISSIONS
                                            ====================================== */}

                                            <div
                                                style={{
                                                    marginBottom:
                                                        "20px",
                                                }}
                                            >
                                                <h3>
                                                    Permissions
                                                </h3>

                                                {permissions.length ===
                                                0 ? (
                                                    <div
                                                        style={{
                                                            padding:
                                                                "15px",
                                                            background:
                                                                "#fff7ed",
                                                            color:
                                                                "#9a3412",
                                                            borderRadius:
                                                                "10px",
                                                        }}
                                                    >
                                                        No permissions
                                                        found.
                                                    </div>
                                                ) : (
                                                    <div
                                                        style={{
                                                            overflowX:
                                                                "auto",
                                                        }}
                                                    >
                                                        <table
                                                            style={{
                                                                width:
                                                                    "100%",
                                                                borderCollapse:
                                                                    "collapse",
                                                            }}
                                                        >
                                                            <thead>
                                                                <tr>
                                                                    <th
                                                                        style={{
                                                                            textAlign:
                                                                                "left",
                                                                            padding:
                                                                                "10px",
                                                                            borderBottom:
                                                                                "1px solid #e2e8f0",
                                                                        }}
                                                                    >
                                                                        ID
                                                                    </th>

                                                                    <th
                                                                        style={{
                                                                            textAlign:
                                                                                "left",
                                                                            padding:
                                                                                "10px",
                                                                            borderBottom:
                                                                                "1px solid #e2e8f0",
                                                                        }}
                                                                    >
                                                                        Permission
                                                                    </th>

                                                                    <th
                                                                        style={{
                                                                            textAlign:
                                                                                "left",
                                                                            padding:
                                                                                "10px",
                                                                            borderBottom:
                                                                                "1px solid #e2e8f0",
                                                                        }}
                                                                    >
                                                                        Module
                                                                    </th>
                                                                </tr>
                                                            </thead>

                                                            <tbody>
                                                                {permissions.map(
                                                                    (
                                                                        permission
                                                                    ) => (
                                                                        <tr
                                                                            key={
                                                                                permission.id
                                                                            }
                                                                        >
                                                                            <td
                                                                                style={{
                                                                                    padding:
                                                                                        "10px",
                                                                                    borderBottom:
                                                                                        "1px solid #f1f5f9",
                                                                                }}
                                                                            >
                                                                                {
                                                                                    permission.id
                                                                                }
                                                                            </td>

                                                                            <td
                                                                                style={{
                                                                                    padding:
                                                                                        "10px",
                                                                                    borderBottom:
                                                                                        "1px solid #f1f5f9",
                                                                                    fontWeight:
                                                                                        "600",
                                                                                }}
                                                                            >
                                                                                {
                                                                                    permission.permission_name
                                                                                }
                                                                            </td>

                                                                            <td
                                                                                style={{
                                                                                    padding:
                                                                                        "10px",
                                                                                    borderBottom:
                                                                                        "1px solid #f1f5f9",
                                                                                }}
                                                                            >
                                                                                {
                                                                                    permission.module
                                                                                }
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>

                                            {/* =====================================
                                                DATA SCOPES
                                            ====================================== */}

                                            <div
                                                style={{
                                                    marginBottom:
                                                        "20px",
                                                }}
                                            >
                                                <h3>
                                                    Data
                                                    Scopes
                                                </h3>

                                                {scopes.length ===
                                                0 ? (
                                                    <div
                                                        style={{
                                                            padding:
                                                                "15px",
                                                            background:
                                                                "#fff7ed",
                                                            color:
                                                                "#9a3412",
                                                            borderRadius:
                                                                "10px",
                                                        }}
                                                    >
                                                        No active
                                                        data scopes
                                                        found.
                                                    </div>
                                                ) : (
                                                    <div
                                                        style={{
                                                            overflowX:
                                                                "auto",
                                                        }}
                                                    >
                                                        <table
                                                            style={{
                                                                width:
                                                                    "100%",
                                                                borderCollapse:
                                                                    "collapse",
                                                            }}
                                                        >
                                                            <thead>
                                                                <tr>
                                                                    <th
                                                                        style={{
                                                                            textAlign:
                                                                                "left",
                                                                            padding:
                                                                                "10px",
                                                                            borderBottom:
                                                                                "1px solid #e2e8f0",
                                                                        }}
                                                                    >
                                                                        ID
                                                                    </th>

                                                                    <th
                                                                        style={{
                                                                            textAlign:
                                                                                "left",
                                                                            padding:
                                                                                "10px",
                                                                            borderBottom:
                                                                                "1px solid #e2e8f0",
                                                                        }}
                                                                    >
                                                                        Role
                                                                        Permission
                                                                        ID
                                                                    </th>

                                                                    <th
                                                                        style={{
                                                                            textAlign:
                                                                                "left",
                                                                            padding:
                                                                                "10px",
                                                                            borderBottom:
                                                                                "1px solid #e2e8f0",
                                                                        }}
                                                                    >
                                                                        Scope
                                                                    </th>

                                                                    <th
                                                                        style={{
                                                                            textAlign:
                                                                                "left",
                                                                            padding:
                                                                                "10px",
                                                                            borderBottom:
                                                                                "1px solid #e2e8f0",
                                                                        }}
                                                                    >
                                                                        Active
                                                                    </th>
                                                                </tr>
                                                            </thead>

                                                            <tbody>
                                                                {scopes.map(
                                                                    (
                                                                        scope
                                                                    ) => (
                                                                        <tr
                                                                            key={
                                                                                scope.id
                                                                            }
                                                                        >
                                                                            <td
                                                                                style={{
                                                                                    padding:
                                                                                        "10px",
                                                                                    borderBottom:
                                                                                        "1px solid #f1f5f9",
                                                                                }}
                                                                            >
                                                                                {
                                                                                    scope.id
                                                                                }
                                                                            </td>

                                                                            <td
                                                                                style={{
                                                                                    padding:
                                                                                        "10px",
                                                                                    borderBottom:
                                                                                        "1px solid #f1f5f9",
                                                                                }}
                                                                            >
                                                                                {
                                                                                    scope.role_permission_id
                                                                                }
                                                                            </td>

                                                                            <td
                                                                                style={{
                                                                                    padding:
                                                                                        "10px",
                                                                                    borderBottom:
                                                                                        "1px solid #f1f5f9",
                                                                                    fontWeight:
                                                                                        "600",
                                                                                }}
                                                                            >
                                                                                {
                                                                                    scope.scope_type
                                                                                }
                                                                            </td>

                                                                            <td
                                                                                style={{
                                                                                    padding:
                                                                                        "10px",
                                                                                    borderBottom:
                                                                                        "1px solid #f1f5f9",
                                                                                }}
                                                                            >
                                                                                {scope.is_active
                                                                                    ? "YES"
                                                                                    : "NO"}
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                            </>
                        )}

                        {profileError && (
                            <div
                                style={{
                                    marginTop:
                                        "15px",
                                    padding:
                                        "18px",
                                    background:
                                        "#fef2f2",
                                    border:
                                        "1px solid #fecaca",
                                    color:
                                        "#991b1b",
                                    borderRadius:
                                        "10px",
                                }}
                            >
                                <strong>
                                    AfriCore Profile
                                    Error
                                </strong>

                                <pre
                                    style={{
                                        whiteSpace:
                                            "pre-wrap",
                                        wordBreak:
                                            "break-word",
                                    }}
                                >
                                    {JSON.stringify(
                                        profileError,
                                        null,
                                        2
                                    )}
                                </pre>
                            </div>
                        )}

                        {/* =================================================
                            FINAL STATUS
                        ================================================== */}

                        <hr
                            style={{
                                marginTop:
                                    "30px",
                            }}
                        />

                        <div
                            style={{
                                marginTop:
                                    "25px",
                                padding:
                                    "20px",
                                background:
                                    profileResponse?.success &&
                                    isSuperAdmin
                                        ? "#ecfdf5"
                                        : "#f8fafc",
                                borderRadius:
                                    "12px",
                                border:
                                    profileResponse?.success &&
                                    isSuperAdmin
                                        ? "1px solid #bbf7d0"
                                        : "1px solid #e2e8f0",
                            }}
                        >
                            <h3
                                style={{
                                    marginTop:
                                        0,
                                }}
                            >
                                Access Engine Status
                            </h3>

                            <div>
                                Supabase Session:{" "}
                                <strong>
                                    {session
                                        ? "PASS"
                                        : "FAIL"}
                                </strong>
                            </div>

                            <div>
                                Backend Authentication:{" "}
                                <strong>
                                    {authResponse
                                        ?.success
                                        ? "PASS"
                                        : "FAIL"}
                                </strong>
                            </div>

                            <div>
                                AfriCore Profile:{" "}
                                <strong>
                                    {profileResponse
                                        ?.success
                                        ? "PASS"
                                        : "FAIL"}
                                </strong>
                            </div>

                            <div>
                                Super Admin:{" "}
                                <strong>
                                    {isSuperAdmin
                                        ? "YES"
                                        : "NO"}
                                </strong>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AuthTest;