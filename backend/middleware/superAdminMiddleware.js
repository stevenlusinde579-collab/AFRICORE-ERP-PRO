import {
    getUserAccess
} from "../services/permissionService.js";


/**
 * ============================================================
 * AFRICORE ERP
 * SUPER ADMIN MIDDLEWARE
 * ============================================================
 *
 * Allows only users whose effective roles include:
 *
 *     Super Admin
 *
 * This is currently used for sensitive administrative
 * operations such as creating system login accounts.
 * ============================================================
 */

export const requireSuperAdmin = async (
    req,
    res,
    next
) => {

    try {

        if (!req.user?.id) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required."

            });

        }


        const access =
            await getUserAccess(
                req.user.id
            );


        if (
            access.isSuperAdmin !== true
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Super Admin access is required for this operation."

            });

        }


        req.access =
            access;


        return next();

    } catch (error) {

        console.error(
            "SUPER ADMIN MIDDLEWARE ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to verify Super Admin access."

        });

    }

};