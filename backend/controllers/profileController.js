/**
 * ============================================================
 * GET CURRENT AFRICORE PROFILE
 *
 * GET /api/auth/profile
 *
 * Requires:
 * authenticateUser
 * ============================================================
 */
export const getCurrentProfile = async (
    req,
    res
) => {

    try {

        // ----------------------------------------------------
        // AUTH USER CHECK
        // ----------------------------------------------------

        if (!req.user?.id) {

            return res.status(401).json({

                success: false,

                message:
                    "Authenticated user was not found."

            });

        }


        // ----------------------------------------------------
        // RESOLVE PROFILE + ROLES + PERMISSIONS + SCOPES
        // ----------------------------------------------------

        // authenticateUser already resolved this user's effective access
        // and stored it on the request. Reuse it to avoid repeating several
        // sequential Supabase queries during the first login.
        const access = req.access;

        if (!access) {
            return res.status(503).json({
                success: false,
                message: "User access could not be verified. Please try again."
            });
        }


        // ----------------------------------------------------
        // PROFILE DOES NOT EXIST
        // ----------------------------------------------------

        if (!access.profile) {

            return res.status(404).json({

                success: false,

                message:
                    "AfriCore profile was not found for this authenticated user.",

                auth_user_id:
                    req.user.id

            });

        }


        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        return res.json({

            success: true,

            message:
                "AfriCore profile and access information retrieved successfully.",

            auth_user: {

                id:
                    req.user.id,

                email:
                    req.user.email || null,

                phone:
                    req.user.phone || null

            },

            profile:
                access.profile,

            roles:
                access.roles,

            permissions:
                access.permissions,

            scopes:
                access.scopes,

            isSuperAdmin:
                access.isSuperAdmin

        });

    } catch (error) {

        console.error(
            "GET CURRENT PROFILE ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error?.message ||
                "Unable to retrieve AfriCore profile."

        });

    }

};