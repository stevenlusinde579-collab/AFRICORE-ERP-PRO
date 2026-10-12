import { supabase } from "../config/supabase.js";
import { getUserAccess } from "../services/permissionService.js";

// AfriCore authentication and school-status enforcement.
// Effective roles come from permissionService (profile_roles), not role_id alone.
export const authenticateUser = async (req, res, next) => {
    try {
        // A global API guard may already have authenticated this request.
        if (req.user?.id && req.profile?.id) {
            return next();
        }

        const authorization = req.headers.authorization;

        if (!authorization) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        if (!authorization.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization format."
            });
        }

        const token = authorization.substring(7).trim();

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Access token is missing."
            });
        }

        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data?.user) {
            if (error) console.error("SUPABASE AUTH ERROR:", error);
            return res.status(401).json({
                success: false,
                message: "Invalid or expired authentication token."
            });
        }

        // Resolve canonical active roles and ERP profile.
        const access = await getUserAccess(data.user.id);
        const profile = access?.profile;

        if (!profile?.id) {
            return res.status(403).json({
                success: false,
                message: "User profile was not found. Access denied."
            });
        }

        // Only the effective Super Admin role bypasses school status.
        if (access.isSuperAdmin !== true) {
            if (profile.school_id == null) {
                return res.status(403).json({
                    success: false,
                    message: "User is not assigned to a school."
                });
            }

            const { data: school, error: schoolError } = await supabase
                .from("schools")
                .select("id, is_active")
                .eq("id", profile.school_id)
                .maybeSingle();

            if (schoolError) {
                console.error("SCHOOL STATUS CHECK ERROR:", schoolError);
                return res.status(503).json({
                    success: false,
                    code: "SCHOOL_STATUS_UNAVAILABLE",
                    message: "Unable to verify school status. Access is temporarily blocked."
                });
            }

            if (!school || school.is_active !== true) {
                return res.status(403).json({
                    success: false,
                    code: "SCHOOL_INACTIVE",
                    message: "Your school is inactive. Please contact the system administrator."
                });
            }
        }

        req.user = data.user;
        req.profile = profile;
        req.access = access;

        return next();
    } catch (error) {
        console.error("AUTHENTICATION MIDDLEWARE ERROR:", error);
        return res.status(503).json({
            success: false,
            message: "Unable to verify authentication and school access."
        });
    }
};
