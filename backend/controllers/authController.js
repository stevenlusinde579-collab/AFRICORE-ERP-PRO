// =====================================================
// AFRICORE ERP
// AUTH CONTROLLER
// =====================================================

export const getCurrentUser = async (
    req,
    res
) => {

    try {

        if (!req.user) {

            return res.status(401).json({

                success: false,

                message:
                    "Authenticated user was not found."

            });

        }


        return res.json({

            success: true,

            message:
                "Authenticated user retrieved successfully.",

            user: {

                id:
                    req.user.id,

                email:
                    req.user.email,

                phone:
                    req.user.phone || null,

                role:
                    req.user.role || null,

                created_at:
                    req.user.created_at || null,

                last_sign_in_at:
                    req.user.last_sign_in_at || null

            }

        });

    }

    catch (error) {

        console.error(
            "GET CURRENT USER ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to retrieve authenticated user."

        });

    }

};
