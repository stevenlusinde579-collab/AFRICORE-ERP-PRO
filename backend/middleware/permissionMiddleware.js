import {
    getUserPermission
} from "../services/permissionService.js";


/**
 * ============================================================
 * REQUIRE PERMISSION
 *
 * Usage:
 *
 * router.get(
 *     "/something",
 *     authenticateUser,
 *     requirePermission("EXAM_VIEW"),
 *     controller
 * );
 *
 * ============================================================
 */
export const requirePermission = (
    permissionName
) => {

    return async (
        req,
        res,
        next
    ) => {

        try {

            // ------------------------------------------------
            // AUTHENTICATION CHECK
            // ------------------------------------------------

            if (!req.user?.id) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Authentication required."

                });

            }


            // ------------------------------------------------
            // PERMISSION NAME CHECK
            // ------------------------------------------------

            if (!permissionName) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Permission name was not provided."

                });

            }


            // ------------------------------------------------
            // RESOLVE PERMISSION
            // ------------------------------------------------

            const permission =
                await getUserPermission(
                    req.user.id,
                    permissionName
                );


            // ------------------------------------------------
            // PERMISSION DENIED
            // ------------------------------------------------

            if (!permission) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You do not have permission to perform this action.",

                    permission:
                        permissionName

                });

            }


            // ------------------------------------------------
            // ATTACH PERMISSION TO REQUEST
            // ------------------------------------------------

            req.permission =
                permission;


            // ------------------------------------------------
            // CONTINUE
            // ------------------------------------------------

            return next();

        } catch (error) {

            console.error(
                "PERMISSION MIDDLEWARE ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to verify user permission."

            });

        }

    };

};