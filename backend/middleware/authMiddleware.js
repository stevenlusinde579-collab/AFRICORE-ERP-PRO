import { supabase } from "../config/supabase.js";
import { getUserAccess } from "../services/permissionService.js";

// =====================================================
// AFRICORE ERP
// AUTHENTICATION MIDDLEWARE
//
// 1. Verify Supabase access token.
// 2. Verify ERP user profile.
// 3. Block users from inactive schools.
// 4. Allow Super Admin (role_id = 1) to manage schools.
// =====================================================

export const authenticateUser = async (req, res, next) => {
    try {
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

        // STEP 1: VERIFY SUPABASE TOKEN
        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data?.user) {
            if (error) {
                console.error("SUPABASE AUTH ERROR:", error);
            }

            return res.status(401).json({
                success: false,
                message: "Invalid or expired authentication token."
            });
        }

        // STEP 2: RESOLVE THE CANONICAL ERP PROFILE AND EFFECTIVE ROLES.
        // profile_roles is authoritative; profiles.role_id is legacy fallback only.
        const access = await getUserAccess(data.user.id);
        const profile = access?.profile;

        if (!profile?.id) {
            return res.status(403).json({
                success: false,
                message: "User profile was not found. Access denied."
            });
        }

        // STEP 3: CHECK SCHOOL STATUS.
        // Only an effective Super Admin role can access/manage inactive schools.
        if (access.isSuperAdmin !== true) {
            if (profile.school_id == null) {
                return res.status(403).json({
                    success: false,
                    message: "User is not assigned to a school."
                });
            }

            const {
                data: school,
                error: schoolError
            } = await supabase
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

        // STEP 4: STORE AUTHENTICATED USER AND PROFILE
        req.user = data.user;
        req.profile = profile;
        req.access = access;

        // STEP 5: CONTINUE REQUEST
        return next();

    } catch (error) {
        console.error(
            "AUTHENTICATION MIDDLEWARE ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Authentication service error."
        });
    }
};