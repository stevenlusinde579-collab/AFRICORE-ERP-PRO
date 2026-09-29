import { supabase } from "../config/supabase.js";


// =====================================================
// AUTHENTICATION MIDDLEWARE
//
// Reads:
// Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
//
// Verifies the token through Supabase Auth.
//
// On success:
// req.user = authenticated Supabase user
//
// On failure:
// 401 Unauthorized
// =====================================================

export const authenticateUser = async (
    req,
    res,
    next
) => {

    try {

        const authorization =
            req.headers.authorization;


        if (!authorization) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required."

            });

        }


        if (
            !authorization.startsWith(
                "Bearer "
            )
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid authorization format."

            });

        }


        const token =
            authorization.substring(
                7
            ).trim();


        if (!token) {

            return res.status(401).json({

                success: false,

                message:
                    "Access token is missing."

            });

        }


        const {
            data,
            error
        } =
            await supabase.auth.getUser(
                token
            );


        if (error) {

            console.error(
                "SUPABASE AUTH ERROR:",
                error
            );

            return res.status(401).json({

                success: false,

                message:
                    "Invalid or expired authentication token."

            });

        }


        if (!data?.user) {

            return res.status(401).json({

                success: false,

                message:
                    "Authenticated user was not found."

            });

        }


        // =================================================
        // STORE AUTHENTICATED USER
        // =================================================

        req.user =
            data.user;


        // =================================================
        // CONTINUE REQUEST
        // =================================================

        return next();

    }

    catch (error) {

        console.error(
            "AUTHENTICATION MIDDLEWARE ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Authentication service error."

        });

    }

};