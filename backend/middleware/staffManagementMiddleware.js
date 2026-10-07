import { supabase } from "../config/supabase.js";

/**
 * ============================================================
 * AFRICORE ERP
 * STAFF & NON-STAFF MANAGEMENT SCHOOL SCOPE
 * ============================================================
 *
 * Purpose:
 * - Protect Staff & Non-Staff management by school.
 * - Headmaster can manage members belonging to his school only.
 * - Super Admin can manage across schools.
 * - Prevent changing a staff member to another school.
 *
 * IMPORTANT:
 * Permission checking is handled by requirePermission().
 * This middleware handles SCHOOL SCOPE only.
 * ============================================================
 */

export const requireStaffManagementSchoolScope = async (
    req,
    res,
    next
) => {

    try {

        // ----------------------------------------------------
        // 1. AUTHENTICATION CHECK
        // ----------------------------------------------------

        if (!req.user?.id) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required."

            });

        }


        // ----------------------------------------------------
        // 2. SUPER ADMIN BYPASS
        // ----------------------------------------------------
        //
        // getUserPermission() returns:
        //
        // isSuperAdmin: true
        //
        // for Super Admin.
        //
        // Super Admin therefore does not need school restriction.
        // ----------------------------------------------------

        if (
            req.permission?.isSuperAdmin === true
        ) {

            return next();

        }


        // ----------------------------------------------------
        // 3. LOAD CURRENT USER PROFILE
        // ----------------------------------------------------

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .select(`
                id,
                school_id,
                role_id
            `)
            .eq(
                "id",
                req.user.id
            )
            .maybeSingle();


        if (profileError) {

            console.error(
                "STAFF MANAGEMENT PROFILE ERROR:",
                profileError
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to verify your school access."

            });

        }


        // ----------------------------------------------------
        // 4. PROFILE MUST EXIST
        // ----------------------------------------------------

        if (!profile) {

            return res.status(403).json({

                success: false,

                message:
                    "Your system profile could not be found."

            });

        }


        // ----------------------------------------------------
        // 5. USER MUST BELONG TO A SCHOOL
        // ----------------------------------------------------

        if (
            profile.school_id === null ||
            profile.school_id === undefined ||
            profile.school_id === ""
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Your account is not assigned to a school."

            });

        }


        const userSchoolId =
            Number(profile.school_id);


        // ----------------------------------------------------
        // 6. CREATE STAFF / NON-STAFF
        // ----------------------------------------------------
        //
        // createTeacher() receives school_id directly:
        //
        // req.body.school_id
        //
        // Headmaster must only create inside own school.
        // ----------------------------------------------------

        if (
            String(req.method).toUpperCase() ===
            "POST"
        ) {

            const requestedSchoolId =
                req.body?.school_id;


            if (
                requestedSchoolId === undefined ||
                requestedSchoolId === null ||
                requestedSchoolId === ""
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "School ID is required when creating Staff & Non-Staff."

                });

            }


            if (
                Number(requestedSchoolId) !==
                userSchoolId
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You can only create Staff & Non-Staff members in your own school."

                });

            }


            // Store verified school ID on request.
            req.staffManagementSchoolId =
                userSchoolId;


            return next();

        }


        // ----------------------------------------------------
        // 7. UPDATE / DELETE TARGET MEMBER
        // ----------------------------------------------------

        if (
            String(req.method).toUpperCase() ===
                "PUT" ||
            String(req.method).toUpperCase() ===
                "DELETE"
        ) {

            const teacherId =
                Number(req.params.id);


            // ------------------------------------------------
            // VALIDATE ID
            // ------------------------------------------------

            if (
                !Number.isInteger(
                    teacherId
                ) ||
                teacherId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid Staff & Non-Staff member ID."

                });

            }


            // ------------------------------------------------
            // LOAD TARGET STAFF MEMBER
            // ------------------------------------------------

            const {
                data: teacher,
                error: teacherError
            } = await supabase
                .from("teachers")
                .select(`
                    id,
                    school_id,
                    user_id,
                    status
                `)
                .eq(
                    "id",
                    teacherId
                )
                .maybeSingle();


            if (teacherError) {

                console.error(
                    "STAFF MANAGEMENT TARGET ERROR:",
                    teacherError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to verify the Staff & Non-Staff member."

                });

            }


            // ------------------------------------------------
            // MEMBER NOT FOUND
            // ------------------------------------------------

            if (!teacher) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Staff & Non-Staff member not found."

                });

            }


            // ------------------------------------------------
            // SCHOOL SECURITY
            // ----------------------------------------------------

            if (
                Number(teacher.school_id) !==
                userSchoolId
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You can only manage Staff & Non-Staff members belonging to your own school."

                });

            }


            // ------------------------------------------------
            // UPDATE SCHOOL PROTECTION
            // ------------------------------------------------
            //
            // updateTeacher() receives:
            //
            // req.body.teacher
            //
            // Never allow Headmaster to move the member
            // to another school.
            // ------------------------------------------------

            if (
                String(req.method).toUpperCase() ===
                "PUT"
            ) {

                const requestedSchoolId =
                    req.body?.teacher?.school_id;


                if (
                    requestedSchoolId !== undefined &&
                    requestedSchoolId !== null &&
                    requestedSchoolId !== "" &&
                    Number(requestedSchoolId) !==
                        userSchoolId
                ) {

                    return res.status(403).json({

                        success: false,

                        message:
                            "You cannot move a Staff & Non-Staff member to another school."

                    });

                }


                // Force verified school.
                if (
                    req.body?.teacher &&
                    typeof req.body.teacher ===
                        "object"
                ) {

                    req.body.teacher.school_id =
                        userSchoolId;

                }

            }


            // ------------------------------------------------
            // ATTACH VERIFIED DATA
            // ------------------------------------------------

            req.staffManagementSchoolId =
                userSchoolId;

            req.staffManagementTeacher =
                teacher;


            return next();

        }


        // ----------------------------------------------------
        // FALLBACK
        // ----------------------------------------------------

        return next();

    } catch (error) {

        console.error(
            "========================================"
        );

        console.error(
            "STAFF MANAGEMENT SCHOOL SCOPE ERROR"
        );

        console.error(
            "========================================"
        );

        console.error(error);


        return res.status(500).json({

            success: false,

            message:
                "Unable to verify Staff & Non-Staff management access."

        });

    }

};