import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../services/supabase";

function RoleAccessRoute({ allowedRoles = [] }) {
    const [loading, setLoading] = useState(true);
    const [roleId, setRoleId] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let mounted = true;

        const loadRole = async () => {
            try {
                const {
                    data: { user },
                    error: authError,
                } = await supabase.auth.getUser();

                if (authError) {
                    throw authError;
                }

                if (!user?.id) {
                    throw new Error("User session not found.");
                }

                const {
                    data,
                    error: profileError,
                } = await supabase
                    .from("profiles")
                    .select("role_id")
                    .eq("id", user.id)
                    .maybeSingle();

                if (profileError) {
                    throw profileError;
                }

                if (!mounted) {
                    return;
                }

                setRoleId(
                    Number(data?.role_id)
                );

            } catch (err) {

                console.error(
                    "ROLE ACCESS ERROR:",
                    err
                );

                if (!mounted) {
                    return;
                }

                setError(
                    err?.message ||
                    "Unable to verify your role."
                );

            } finally {

                if (mounted) {
                    setLoading(false);
                }

            }
        };

        loadRole();

        return () => {
            mounted = false;
        };

    }, []);

    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {
        return (
            <div className="min-h-[300px] flex items-center justify-center bg-slate-50">
                <div className="rounded-xl bg-white border border-slate-200 px-5 py-4 text-sm font-medium text-slate-600 shadow-sm">
                    Checking access...
                </div>
            </div>
        );
    }

    // =====================================================
    // ERROR
    // =====================================================

    if (error) {
        return (
            <Navigate
                to="/access-denied"
                replace
            />
        );
    }

    // =====================================================
    // FULL ACCESS ROLES
    // =====================================================
    //
    // ROLE 1 = SUPER ADMIN
    // ROLE 2 = HEADMASTER
    //
    // Hawa hawapaswi kuzuiwa na allowedRoles.
    // =====================================================

    if (
        Number(roleId) === 1 ||
        Number(roleId) === 2
    ) {
        return <Outlet />;
    }

    // =====================================================
    // NORMAL ROLE ACCESS
    // =====================================================
    //
    // Roles nyingine zinaendelea kufuata
    // allowedRoles kama ilivyokuwa awali.
    // =====================================================

    if (
        !allowedRoles.includes(
            Number(roleId)
        )
    ) {
        return (
            <Navigate
                to="/access-denied"
                replace
            />
        );
    }

    // =====================================================
    // ALLOWED
    // =====================================================

    return <Outlet />;
}

export default RoleAccessRoute;