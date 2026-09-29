import {
    getAccessDecision
} from "../services/accessScopeService.js";


/**
 * ============================================================
 * AFRICORE ERP
 * ACCESS TEST CONTROLLER
 * ============================================================
 *
 * Development / diagnostic endpoint.
 *
 * GET:
 *
 * /api/auth/access-test
 *
 * Optional:
 *
 * /api/auth/access-test?subjectId=21&classId=29
 *
 * Purpose:
 *
 * Test the central Permission + Data Scope Engine.
 *
 * Current permission:
 *
 *     EXAM_ENTER_MARKS
 *
 * Supported scope tests:
 *
 *     ALL_SCHOOL
 *     ASSIGNED_SUBJECT_CLASS
 *
 * ============================================================
 */


export const testAccessScope = async (
    req,
    res
) => {

    try {

        /**
         * ------------------------------------------------------
         * AUTHENTICATED USER
         * ------------------------------------------------------
         */

        if (!req.user?.id) {

            return res.status(401).json({

                success: false,

                message:
                    "Authenticated user was not found."

            });

        }


        const userId =
            req.user.id;


        /**
         * ------------------------------------------------------
         * PERMISSION TO TEST
         * ------------------------------------------------------
         */

        const permissionName =
            "EXAM_ENTER_MARKS";


        /**
         * ------------------------------------------------------
         * OPTIONAL SUBJECT / CLASS CONTEXT
         * ------------------------------------------------------
         *
         * These values are supplied only when testing a
         * subject/class-specific scope.
         *
         * Example:
         *
         * ?subjectId=21&classId=29
         *
         * We do NOT invent or modify database records here.
         * The Access Scope Engine will compare the supplied
         * values against the verified teacher_assignments table.
         * ------------------------------------------------------
         */

        const rawSubjectId =
            req.query?.subjectId;

        const rawClassId =
            req.query?.classId;


        const hasSubjectContext =
            rawSubjectId !==
                undefined &&
            rawSubjectId !==
                null &&
            rawSubjectId !==
                "";


        const hasClassContext =
            rawClassId !==
                undefined &&
            rawClassId !==
                null &&
            rawClassId !==
                "";


        /**
         * ------------------------------------------------------
         * VALIDATE CONTEXT
         * ------------------------------------------------------
         */

        if (
            hasSubjectContext !==
            hasClassContext
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Both subjectId and classId are required when testing a subject/class scope.",

                expected:
                    "?subjectId=21&classId=29"

            });

        }


        /**
         * ------------------------------------------------------
         * CONVERT IDs
         * ------------------------------------------------------
         *
         * We only convert them to numbers when the user has
         * supplied the subject/class context.
         * ------------------------------------------------------
         */

        let subjectId =
            null;

        let classId =
            null;


        if (
            hasSubjectContext &&
            hasClassContext
        ) {

            subjectId =
                Number(
                    rawSubjectId
                );

            classId =
                Number(
                    rawClassId
                );


            if (
                !Number.isInteger(
                    subjectId
                ) ||
                !Number.isInteger(
                    classId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "subjectId and classId must be valid numeric IDs.",

                    received: {
                        subjectId:
                            rawSubjectId,

                        classId:
                            rawClassId
                    }

                });

            }

        }


        /**
         * ------------------------------------------------------
         * ACCESS DECISION
         * ------------------------------------------------------
         *
         * The central engine decides:
         *
         * 1. Does the user have EXAM_ENTER_MARKS?
         *
         * 2. Does the permission have ALL_SCHOOL?
         *
         * 3. Does the permission have
         *    ASSIGNED_SUBJECT_CLASS?
         *
         * 4. If ASSIGNED_SUBJECT_CLASS:
         *    Does the user's profile.teacher_id exist?
         *
         * 5. Does teacher_assignments contain the requested
         *    subject + class combination?
         *
         * ------------------------------------------------------
         */

        const decision =
            await getAccessDecision(

                userId,

                permissionName,

                {
                    subjectId,
                    classId
                }

            );


        /**
         * ------------------------------------------------------
         * RESPONSE
         * ------------------------------------------------------
         */

        return res.json({

            success: true,

            message:
                "Access Scope Engine tested successfully.",


            authenticated_user: {

                id:
                    req.user.id,

                email:
                    req.user.email ||
                    null

            },


            test: {

                permission:
                    permissionName,

                context: {

                    subjectId,

                    classId,

                    subjectClassTest:
                        subjectId !==
                            null &&
                        classId !==
                            null

                },

                decision

            }

        });


    } catch (error) {

        console.error(
            "ACCESS SCOPE TEST ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error?.message ||
                "Unable to test Access Scope Engine."

        });

    }

};