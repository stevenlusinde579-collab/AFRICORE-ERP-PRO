import { supabase } from "../config/supabase.js";


/**
 * ============================================================
 * AFRICORE ERP
 * TEACHER CONTROLLER
 * ============================================================
 *
 * Handles:
 *
 * - Teacher / Staff account provisioning
 * - Supabase Auth account creation
 * - teachers.user_id linking
 * - profiles creation
 * - Multiple profile_roles
 * - Primary role
 * - Teacher subject/class assignments
 * - Teacher editing
 * - Staff Type classification
 *
 * STAFF TYPE:
 *
 * Staff      = Teaching Staff / Teacher
 * Non-Staff  = Non-Teaching Staff
 *
 * Frontend sends:
 *
 * role_ids
 * primary_role_id
 * staff_type
 *
 * Legacy role_id is also supported.
 *
 * ============================================================
 */


/**
 * ============================================================
 * NORMALIZE TANZANIA PHONE NUMBER
 * ============================================================
 */

const normalizeTanzaniaPhone = (phone) => {

    if (typeof phone !== "string") {
        return null;
    }

    let value = phone.trim();

    if (!value) {
        return null;
    }

    value = value.replace(/[\s\-().]/g, "");


    /**
     * +255712345678
     */

    if (value.startsWith("+255")) {

        const localPart = value.slice(4);

        if (
            /^7\d{8}$/.test(localPart) ||
            /^6\d{8}$/.test(localPart) ||
            /^8\d{8}$/.test(localPart)
        ) {
            return value;
        }

        return null;
    }


    /**
     * 255712345678
     */

    if (value.startsWith("255")) {

        const localPart = value.slice(3);

        if (
            /^7\d{8}$/.test(localPart) ||
            /^6\d{8}$/.test(localPart) ||
            /^8\d{8}$/.test(localPart)
        ) {
            return `+${value}`;
        }

        return null;
    }


    /**
     * 0712345678
     */

    if (/^0[678]\d{8}$/.test(value)) {

        return `+255${value.slice(1)}`;
    }


    /**
     * 712345678
     */

    if (/^[678]\d{8}$/.test(value)) {

        return `+255${value}`;
    }


    return null;
};


/**
 * ============================================================
 * NORMALIZE STAFF TYPE
 * ============================================================
 */

const normalizeStaffType = (staffType) => {

    if (typeof staffType !== "string") {
        return null;
    }

    const value = staffType.trim();

    if (value === "Staff") {
        return "Staff";
    }

    if (value === "Non-Staff") {
        return "Non-Staff";
    }

    return null;
};


/**
 * ============================================================
 * NORMALIZE ASSIGNMENTS
 * ============================================================
 */

const normalizeAssignments = (assignments) => {

    if (!Array.isArray(assignments)) {
        return [];
    }

    const normalized = [];

    for (const assignment of assignments) {

        const subjectId =
            Number(assignment?.subject_id);

        const classId =
            Number(assignment?.class_id);

        if (
            !Number.isInteger(subjectId) ||
            subjectId <= 0 ||
            !Number.isInteger(classId) ||
            classId <= 0
        ) {
            continue;
        }

        normalized.push({
            subject_id: subjectId,
            class_id: classId
        });
    }


    /**
     * Remove duplicate Subject + Class pairs.
     */

    const unique = normalized.filter(
        (assignment, index, array) =>
            index ===
            array.findIndex(
                item =>
                    Number(item.subject_id) ===
                        Number(assignment.subject_id) &&
                    Number(item.class_id) ===
                        Number(assignment.class_id)
            )
    );

    return unique;
};


/**
 * ============================================================
 * NORMALIZE ROLE IDS
 * ============================================================
 */

const normalizeRoleIds = ({
    role_ids,
    role_id
}) => {

    let source = [];

    if (Array.isArray(role_ids)) {

        source = role_ids;

    } else if (
        role_ids !== undefined &&
        role_ids !== null &&
        role_ids !== ""
    ) {

        source = [role_ids];

    } else if (
        role_id !== undefined &&
        role_id !== null &&
        role_id !== ""
    ) {

        source = [role_id];
    }


    const numericIds =
        source
            .map(value => Number(value))
            .filter(
                value =>
                    Number.isInteger(value) &&
                    value > 0
            );


    /**
     * Remove duplicate role IDs.
     */

    return [
        ...new Set(numericIds)
    ];
};


/**
 * ============================================================
 * VALIDATE ROLES
 * ============================================================
 */

const validateRoles = async (roleIds) => {

    if (!Array.isArray(roleIds) || roleIds.length === 0) {

        return {
            roles: [],
            error: "At least one system role is required."
        };
    }


    const {
        data,
        error
    } = await supabase
        .from("roles")
        .select(`
            id,
            role_name,
            description
        `)
        .in("id", roleIds);


    if (error) {

        return {
            roles: [],
            error:
                `Unable to verify system roles: ${error.message}`
        };
    }


    const roles = data || [];


    const foundIds =
        new Set(
            roles.map(
                role => Number(role.id)
            )
        );


    const missingIds =
        roleIds.filter(
            id => !foundIds.has(Number(id))
        );


    if (missingIds.length > 0) {

        return {
            roles,
            error:
                `Selected system role(s) do not exist: ${missingIds.join(", ")}`
        };
    }


    /**
     * Keep roles in the same order as roleIds.
     */

    const orderedRoles =
        roleIds.map(
            id =>
                roles.find(
                    role =>
                        Number(role.id) ===
                        Number(id)
                )
        );


    return {
        roles: orderedRoles,
        error: null
    };
};


/**
 * ============================================================
 * CREATE PROFILE ROLES
 * ============================================================
 */

const createProfileRoles = async ({
    profileId,
    roleIds,
    primaryRoleId,
    schoolId
}) => {

    const rows =
        roleIds.map(
            roleId => ({

                profile_id:
                    profileId,

                role_id:
                    Number(roleId),

                school_id:
                    schoolId === undefined
                        ? null
                        : schoolId,

                is_primary:
                    Number(roleId) ===
                    Number(primaryRoleId),

                is_active:
                    true
            })
        );


    const {
        data,
        error
    } = await supabase
        .from("profile_roles")
        .insert(rows)
        .select("*");


    return {
        data: data || [],
        error
    };
};


/**
 * ============================================================
 * CREATE TEACHER / STAFF
 *
 * POST /api/teachers
 * ============================================================
 */

export const createTeacher = async (
    req,
    res
) => {

    let createdAuthUserId = null;

    let createdTeacherId = null;


    try {

        const {
            school_id,
            employee_number,
            first_name,
            middle_name,
            last_name,
            gender,
            phone,
            email,
            employment_date,
            qualification,
            specialization,
            status,
            photo_url,

            /**
             * STAFF TYPE
             */
            staff_type,

            /**
             * NEW MULTI-ROLE SYSTEM
             */
            role_ids,
            primary_role_id,

            /**
             * LEGACY SUPPORT
             */
            role_id,

            assignments
        } = req.body;


        console.log(
            "========================================"
        );

        console.log(
            "AFRICORE CREATE STAFF / TEACHER"
        );

        console.log(
            "EMPLOYEE:",
            employee_number
        );

        console.log(
            "STAFF TYPE RECEIVED:",
            staff_type
        );

        console.log(
            "ROLE IDS:",
            role_ids
        );

        console.log(
            "PRIMARY ROLE ID:",
            primary_role_id
        );

        console.log(
            "LEGACY ROLE ID:",
            role_id
        );

        console.log(
            "========================================"
        );


        /**
         * --------------------------------------------------------
         * BASIC VALIDATION
         * --------------------------------------------------------
         */

        if (
            !employee_number ||
            !first_name ||
            !last_name
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Employee number, first name and last name are required."

            });
        }


        /**
         * --------------------------------------------------------
         * NORMALIZE STAFF TYPE
         * --------------------------------------------------------
         */

        const normalizedStaffType =
            normalizeStaffType(
                staff_type
            );


        if (!normalizedStaffType) {

            return res.status(400).json({

                success: false,

                message:
                    "Staff Type must be either Staff or Non-Staff."

            });
        }


        /**
         * --------------------------------------------------------
         * NORMALIZE ROLE IDS
         * --------------------------------------------------------
         */

        const normalizedRoleIds =
            normalizeRoleIds({
                role_ids,
                role_id
            });


        if (normalizedRoleIds.length === 0) {

            return res.status(400).json({

                success: false,

                message:
                    "At least one system role is required."

            });
        }


        /**
         * --------------------------------------------------------
         * PRIMARY ROLE
         * --------------------------------------------------------
         */

        let numericPrimaryRoleId =
            Number(primary_role_id);


        if (
            !Number.isInteger(
                numericPrimaryRoleId
            ) ||
            numericPrimaryRoleId <= 0
        ) {

            numericPrimaryRoleId =
                normalizedRoleIds[0];
        }


        if (
            !normalizedRoleIds.includes(
                numericPrimaryRoleId
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "The selected primary role must also be included in the selected roles."

            });
        }


        /**
         * --------------------------------------------------------
         * VERIFY ROLES
         * --------------------------------------------------------
         */

        const {
            roles,
            error: rolesValidationError
        } = await validateRoles(
            normalizedRoleIds
        );


        if (rolesValidationError) {

            return res.status(400).json({

                success: false,

                message:
                    rolesValidationError

            });
        }


        const primaryRole =
            roles.find(
                role =>
                    Number(role.id) ===
                    Number(numericPrimaryRoleId)
            );


        if (!primaryRole) {

            return res.status(400).json({

                success: false,

                message:
                    "Primary system role could not be found."

            });
        }


        /**
         * --------------------------------------------------------
         * NORMALIZE ASSIGNMENTS
         * --------------------------------------------------------
         */

        const normalizedAssignments =
            normalizeAssignments(
                assignments
            );


        /**
         * --------------------------------------------------------
         * CHECK DUPLICATE EMPLOYEE NUMBER
         * --------------------------------------------------------
         */

        const {
            data: existingEmployee,
            error: employeeCheckError
        } = await supabase
            .from("teachers")
            .select(`
                id,
                user_id,
                employee_number
            `)
            .eq(
                "employee_number",
                employee_number
            )
            .maybeSingle();


        if (employeeCheckError) {

            return res.status(500).json({

                success: false,

                message:
                    `Unable to verify employee number: ${employeeCheckError.message}`

            });
        }


        if (existingEmployee) {

            return res.status(409).json({

                success: false,

                message:
                    "A teacher or staff member with this employee number already exists."

            });
        }


        /**
         * --------------------------------------------------------
         * NORMALIZE EMAIL
         * --------------------------------------------------------
         */

        const normalizedEmail =
            typeof email === "string" &&
            email.trim()
                ? email.trim().toLowerCase()
                : null;


        /**
         * --------------------------------------------------------
         * NORMALIZE PHONE
         * --------------------------------------------------------
         */

        let normalizedPhone = null;


        if (
            typeof phone === "string" &&
            phone.trim()
        ) {

            normalizedPhone =
                normalizeTanzaniaPhone(
                    phone
                );


            if (!normalizedPhone) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid Tanzania phone number. Use a valid number such as 0712345678 or +255712345678."

                });
            }
        }


        /**
         * --------------------------------------------------------
         * AUTH ACCOUNT REQUIREMENT
         * --------------------------------------------------------
         */

        if (
            !normalizedEmail &&
            !normalizedPhone
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Teacher or staff email or phone number is required to create a login account."

            });
        }


        /**
         * --------------------------------------------------------
         * GENERATE TEMPORARY PASSWORD
         * --------------------------------------------------------
         */

        const temporaryPassword =
            `AfriCore@${Date.now()
                .toString()
                .slice(-6)}!`;


        /**
         * --------------------------------------------------------
         * CREATE TEACHER / STAFF RECORD
         * --------------------------------------------------------
         */

        const teacherPayload = {

            school_id:
                school_id === undefined
                    ? null
                    : school_id,

            employee_number,

            first_name,

            middle_name:
                middle_name || null,

            last_name,

            gender:
                gender || null,

            phone:
                normalizedPhone,

            email:
                normalizedEmail,

            employment_date:
                employment_date || null,

            qualification:
                qualification || null,

            specialization:
                specialization || null,

            status:
                status || "Active",

            photo_url:
                photo_url || null,

            staff_type:
                normalizedStaffType
        };


        console.log(
            "TEACHER DATABASE PAYLOAD:",
            teacherPayload
        );


        const {
            data: createdTeacher,
            error: teacherError
        } = await supabase
            .from("teachers")
            .insert(
                [teacherPayload]
            )
            .select("*")
            .single();


        if (teacherError) {

            return res.status(500).json({

                success: false,

                message:
                    `Unable to create teacher/staff: ${teacherError.message}`

            });
        }


        createdTeacherId =
            createdTeacher.id;


        /**
         * --------------------------------------------------------
         * CREATE SUPABASE AUTH USER
         * --------------------------------------------------------
         */

        const authPayload = {

            password:
                temporaryPassword,

            email_confirm:
                Boolean(
                    normalizedEmail
                ),

            phone_confirm:
                Boolean(
                    normalizedPhone
                ),

            user_metadata: {

                full_name:
                    [
                        first_name,
                        middle_name,
                        last_name
                    ]
                        .filter(Boolean)
                        .join(" "),

                employee_number:
                    employee_number,

                teacher_id:
                    createdTeacher.id,

                staff_type:
                    normalizedStaffType,

                role_id:
                    numericPrimaryRoleId,

                primary_role_id:
                    numericPrimaryRoleId,

                role_ids:
                    normalizedRoleIds
            }
        };


        if (normalizedEmail) {

            authPayload.email =
                normalizedEmail;
        }


        if (normalizedPhone) {

            authPayload.phone =
                normalizedPhone;
        }


        const {
            data: authResult,
            error: authError
        } =
            await supabase.auth.admin
                .createUser(
                    authPayload
                );


        if (authError) {

            await supabase
                .from("teachers")
                .delete()
                .eq(
                    "id",
                    createdTeacher.id
                );


            createdTeacherId =
                null;


            return res.status(500).json({

                success: false,

                message:
                    `Unable to create teacher/staff login account: ${authError.message}`

            });
        }


        if (!authResult?.user?.id) {

            await supabase
                .from("teachers")
                .delete()
                .eq(
                    "id",
                    createdTeacher.id
                );


            createdTeacherId =
                null;


            return res.status(500).json({

                success: false,

                message:
                    "Supabase Auth account was not created."

            });
        }


        createdAuthUserId =
            authResult.user.id;


        /**
         * --------------------------------------------------------
         * LINK TEACHER TO AUTH USER
         * --------------------------------------------------------
         */

        const {
            data: linkedTeacher,
            error: linkError
        } = await supabase
            .from("teachers")
            .update({

                user_id:
                    createdAuthUserId

            })
            .eq(
                "id",
                createdTeacher.id
            )
            .select("*")
            .single();


        if (linkError) {

            await supabase.auth.admin
                .deleteUser(
                    createdAuthUserId
                );


            await supabase
                .from("teachers")
                .delete()
                .eq(
                    "id",
                    createdTeacher.id
                );


            createdAuthUserId =
                null;

            createdTeacherId =
                null;


            return res.status(500).json({

                success: false,

                message:
                    `Unable to link teacher/staff to Auth account: ${linkError.message}`

            });
        }


        /**
         * --------------------------------------------------------
         * CREATE PROFILE
         * --------------------------------------------------------
         */

        const fullName =
            [
                first_name,
                middle_name,
                last_name
            ]
                .filter(Boolean)
                .join(" ");


        const profilePayload = {

            id:
                createdAuthUserId,

            full_name:
                fullName,

            phone:
                normalizedPhone,

            role_id:
                numericPrimaryRoleId,

            school_id:
                school_id === undefined
                    ? null
                    : school_id,

            teacher_id:
                createdTeacher.id
        };


        const {
            data: createdProfile,
            error: profileError
        } = await supabase
            .from("profiles")
            .insert(
                [profilePayload]
            )
            .select("*")
            .single();


        if (profileError) {

            await supabase.auth.admin
                .deleteUser(
                    createdAuthUserId
                );


            await supabase
                .from("teachers")
                .delete()
                .eq(
                    "id",
                    createdTeacher.id
                );


            createdAuthUserId =
                null;

            createdTeacherId =
                null;


            return res.status(500).json({

                success: false,

                message:
                    `Unable to create AfriCore profile: ${profileError.message}`

            });
        }


        /**
         * --------------------------------------------------------
         * CREATE ALL PROFILE ROLES
         * --------------------------------------------------------
         */

        const {
            data: createdProfileRoles,
            error: profileRolesError
        } =
            await createProfileRoles({

                profileId:
                    createdAuthUserId,

                roleIds:
                    normalizedRoleIds,

                primaryRoleId:
                    numericPrimaryRoleId,

                schoolId:
                    school_id

            });


        if (profileRolesError) {

            await supabase.auth.admin
                .deleteUser(
                    createdAuthUserId
                );


            await supabase
                .from("profiles")
                .delete()
                .eq(
                    "id",
                    createdAuthUserId
                );


            await supabase
                .from("teachers")
                .delete()
                .eq(
                    "id",
                    createdTeacher.id
                );


            createdAuthUserId =
                null;

            createdTeacherId =
                null;


            return res.status(500).json({

                success: false,

                message:
                    `Unable to create teacher/staff role assignments: ${profileRolesError.message}`

            });
        }


        /**
         * --------------------------------------------------------
         * CREATE TEACHER ASSIGNMENTS
         * --------------------------------------------------------
         */

        let createdAssignments = [];


        if (
            normalizedAssignments.length > 0
        ) {

            const assignmentPayload =
                normalizedAssignments.map(
                    assignment => ({

                        school_id:
                            school_id === undefined
                                ? null
                                : school_id,

                        teacher_id:
                            createdTeacher.id,

                        subject_id:
                            assignment.subject_id,

                        class_id:
                            assignment.class_id

                    })
                );


            const {
                data: assignmentData,
                error: assignmentError
            } = await supabase
                .from("teacher_assignments")
                .insert(
                    assignmentPayload
                )
                .select("*");


            if (assignmentError) {

                console.error(
                    "TEACHER ASSIGNMENT ERROR:",
                    assignmentError
                );


                await supabase.auth.admin
                    .deleteUser(
                        createdAuthUserId
                    );


                await supabase
                    .from("profile_roles")
                    .delete()
                    .eq(
                        "profile_id",
                        createdAuthUserId
                    );


                await supabase
                    .from("profiles")
                    .delete()
                    .eq(
                        "id",
                        createdAuthUserId
                    );


                await supabase
                    .from("teachers")
                    .delete()
                    .eq(
                        "id",
                        createdTeacher.id
                    );


                createdAuthUserId =
                    null;

                createdTeacherId =
                    null;


                return res.status(500).json({

                    success: false,

                    message:
                        `Unable to save teacher assignments: ${assignmentError.message}`

                });
            }


            createdAssignments =
                assignmentData || [];
        }


        /**
         * --------------------------------------------------------
         * SUCCESS
         * --------------------------------------------------------
         */

        return res.status(201).json({

            success: true,

            message:
                "Teacher / Staff, login account, roles and assignments created successfully.",

            teacher:
                linkedTeacher,

            auth_user: {

                id:
                    createdAuthUserId,

                email:
                    authResult.user.email ||
                    null,

                phone:
                    authResult.user.phone ||
                    null
            },

            profile:
                createdProfile,

            roles:
                roles,

            primary_role:
                primaryRole,

            role:
                primaryRole,

            profile_roles:
                createdProfileRoles,

            assignments:
                createdAssignments,

            staff_type:
                linkedTeacher?.staff_type ||
                normalizedStaffType,

            login_credentials: {

                login_email:
                    normalizedEmail,

                login_phone:
                    normalizedPhone,

                temporary_password:
                    temporaryPassword
            }

        });

    } catch (error) {

        console.error(
            "========================================"
        );

        console.error(
            "CREATE TEACHER / STAFF ERROR:"
        );

        console.error(
            error
        );

        console.error(
            "========================================"
        );


        /**
         * --------------------------------------------------------
         * CLEANUP
         * --------------------------------------------------------
         */

        if (createdAuthUserId) {

            try {

                await supabase
                    .from("teacher_assignments")
                    .delete()
                    .eq(
                        "teacher_id",
                        createdTeacherId
                    );

            } catch (cleanupError) {

                console.error(
                    "ASSIGNMENT CLEANUP ERROR:",
                    cleanupError
                );
            }


            try {

                await supabase
                    .from("profile_roles")
                    .delete()
                    .eq(
                        "profile_id",
                        createdAuthUserId
                    );

            } catch (cleanupError) {

                console.error(
                    "PROFILE ROLE CLEANUP ERROR:",
                    cleanupError
                );
            }


            try {

                await supabase
                    .from("profiles")
                    .delete()
                    .eq(
                        "id",
                        createdAuthUserId
                    );

            } catch (cleanupError) {

                console.error(
                    "PROFILE CLEANUP ERROR:",
                    cleanupError
                );
            }


            try {

                await supabase.auth.admin
                    .deleteUser(
                        createdAuthUserId
                    );

            } catch (cleanupError) {

                console.error(
                    "AUTH CLEANUP ERROR:",
                    cleanupError
                );
            }
        }


        if (createdTeacherId) {

            try {

                await supabase
                    .from("teachers")
                    .delete()
                    .eq(
                        "id",
                        createdTeacherId
                    );

            } catch (cleanupError) {

                console.error(
                    "TEACHER CLEANUP ERROR:",
                    cleanupError
                );
            }
        }


        return res.status(500).json({

            success: false,

            message:
                error?.message ||
                "Unable to create teacher/staff."

        });
    }
};


/**
 * ============================================================
 * UPDATE TEACHER
 *
 * PUT /api/teachers/:id
 * ============================================================
 *
 * IMPORTANT STATUS LOGIC
 *
 * Active:
 *   - Auth account is unbanned
 *   - teachers.status = Active
 *   - teachers.user_id remains linked
 *   - profile_roles.is_active = true
 *
 * Inactive:
 *   - Auth account is banned
 *   - teachers.status = Inactive
 *   - teachers.user_id remains linked
 *   - profile_roles.is_active = false
 *
 * Existing old records:
 *   If teachers.user_id is NULL, recover the Auth ID from
 *   profiles.teacher_id.
 *
 * ============================================================
 */

export const updateTeacher = async (
    req,
    res
) => {

    const teacherId =
        Number(
            req.params.id
        );


    if (
        !Number.isInteger(teacherId) ||
        teacherId <= 0
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Invalid teacher ID."

        });
    }


    try {

        const {
            teacher,

            /**
             * NEW MULTI-ROLE
             */
            role_ids,
            primary_role_id,

            /**
             * LEGACY
             */
            role_id,

            assignments
        } = req.body;


        /**
         * --------------------------------------------------------
         * BASIC VALIDATION
         * --------------------------------------------------------
         */

        if (
            !teacher ||
            typeof teacher !== "object"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Teacher information is required."

            });
        }


        if (
            !teacher.employee_number ||
            !teacher.first_name ||
            !teacher.last_name
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Employee number, first name and last name are required."

            });
        }


        /**
         * --------------------------------------------------------
         * NORMALIZE STAFF TYPE
         * --------------------------------------------------------
         */

        let normalizedStaffType =
            normalizeStaffType(
                teacher.staff_type
            );


        if (!normalizedStaffType) {

            normalizedStaffType = null;
        }


        /**
         * --------------------------------------------------------
         * NORMALIZE ROLES
         * --------------------------------------------------------
         */

        const normalizedRoleIds =
            normalizeRoleIds({
                role_ids,
                role_id
            });


        if (normalizedRoleIds.length === 0) {

            return res.status(400).json({

                success: false,

                message:
                    "At least one system role is required."

            });
        }


        let numericPrimaryRoleId =
            Number(primary_role_id);


        if (
            !Number.isInteger(
                numericPrimaryRoleId
            ) ||
            numericPrimaryRoleId <= 0
        ) {

            numericPrimaryRoleId =
                normalizedRoleIds[0];
        }


        if (
            !normalizedRoleIds.includes(
                numericPrimaryRoleId
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "The selected primary role must also be included in the selected roles."

            });
        }


        /**
         * --------------------------------------------------------
         * VERIFY ROLES
         * --------------------------------------------------------
         */

        const {
            roles,
            error: rolesValidationError
        } = await validateRoles(
            normalizedRoleIds
        );


        if (rolesValidationError) {

            return res.status(400).json({

                success: false,

                message:
                    rolesValidationError

            });
        }


        const primaryRole =
            roles.find(
                role =>
                    Number(role.id) ===
                    Number(numericPrimaryRoleId)
            );


        if (!primaryRole) {

            return res.status(400).json({

                success: false,

                message:
                    "Primary system role could not be found."

            });
        }


        /**
         * --------------------------------------------------------
         * NORMALIZE ASSIGNMENTS
         * --------------------------------------------------------
         */

        const normalizedAssignments =
            normalizeAssignments(
                assignments
            );


        /**
         * --------------------------------------------------------
         * GET EXISTING TEACHER
         * --------------------------------------------------------
         */

        const {
            data: existingTeacher,
            error: existingTeacherError
        } = await supabase
            .from("teachers")
            .select("*")
            .eq(
                "id",
                teacherId
            )
            .maybeSingle();


        if (existingTeacherError) {

            return res.status(500).json({

                success: false,

                message:
                    `Unable to load teacher: ${existingTeacherError.message}`

            });
        }


        if (!existingTeacher) {

            return res.status(404).json({

                success: false,

                message:
                    "Teacher not found."

            });
        }


        /**
         * --------------------------------------------------------
         * PRESERVE EXISTING STAFF TYPE
         * --------------------------------------------------------
         */

        if (!normalizedStaffType) {

            normalizedStaffType =
                normalizeStaffType(
                    existingTeacher.staff_type
                );


            if (!normalizedStaffType) {

                normalizedStaffType =
                    "Staff";
            }
        }


        /**
         * --------------------------------------------------------
         * CHECK DUPLICATE EMPLOYEE NUMBER
         * --------------------------------------------------------
         */

        const {
            data: duplicateEmployee,
            error: duplicateEmployeeError
        } = await supabase
            .from("teachers")
            .select(`
                id,
                employee_number
            `)
            .eq(
                "employee_number",
                teacher.employee_number
            )
            .neq(
                "id",
                teacherId
            )
            .maybeSingle();


        if (duplicateEmployeeError) {

            return res.status(500).json({

                success: false,

                message:
                    `Unable to verify employee number: ${duplicateEmployeeError.message}`

            });
        }


        if (duplicateEmployee) {

            return res.status(409).json({

                success: false,

                message:
                    "Another teacher or staff member already uses this employee number."

            });
        }


        /**
         * --------------------------------------------------------
         * NORMALIZE EMAIL
         * --------------------------------------------------------
         */

        const normalizedEmail =
            typeof teacher.email === "string" &&
            teacher.email.trim()
                ? teacher.email.trim().toLowerCase()
                : null;


        /**
         * --------------------------------------------------------
         * NORMALIZE PHONE
         * --------------------------------------------------------
         */

        let normalizedPhone = null;


        if (
            typeof teacher.phone === "string" &&
            teacher.phone.trim()
        ) {

            normalizedPhone =
                normalizeTanzaniaPhone(
                    teacher.phone
                );


            if (!normalizedPhone) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid Tanzania phone number. Use a valid number such as 0712345678 or +255712345678."

                });
            }
        }


        /**
         * ========================================================
         * RECOVER AUTH USER
         * ========================================================
         *
         * NORMAL CASE:
         *
         * teachers.user_id already contains Auth ID.
         *
         * OLD DEACTIVATED RECORD:
         *
         * teachers.user_id may be NULL because the previous
         * deactivate implementation removed it.
         *
         * In that situation we recover the original Auth ID from:
         *
         * profiles.teacher_id
         *
         * This is especially important for old inactive staff
         * such as Benjamin.
         *
         * ========================================================
         */

        let authUserId =
            existingTeacher.user_id ||
            null;


        let recoveredProfile =
            null;


        if (!authUserId) {

            console.log(
                "========================================"
            );

            console.log(
                "AFRICORE AUTH LINK RECOVERY"
            );

            console.log(
                "Teacher ID:",
                teacherId
            );

            console.log(
                "teachers.user_id is NULL"
            );

            console.log(
                "Searching profiles.teacher_id..."
            );

            console.log(
                "========================================"
            );


            const {
                data: profile,
                error: profileLookupError
            } = await supabase
                .from("profiles")
                .select(`
                    id,
                    teacher_id,
                    role_id,
                    school_id
                `)
                .eq(
                    "teacher_id",
                    teacherId
                )
                .maybeSingle();


            if (profileLookupError) {

                console.error(
                    "AUTH LINK RECOVERY PROFILE ERROR:",
                    profileLookupError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        `Unable to recover the original login account: ${profileLookupError.message}`

                });
            }


            recoveredProfile =
                profile || null;


            if (recoveredProfile?.id) {

                authUserId =
                    recoveredProfile.id;

                console.log(
                    "AUTH LINK RECOVERED:",
                    authUserId
                );

            }

        }


        /**
         * --------------------------------------------------------
         * AUTH ACCOUNT MUST EXIST
         * --------------------------------------------------------
         *
         * We do NOT create a new Auth user during editing.
         *
         * If the original account cannot be recovered, stop safely.
         * --------------------------------------------------------
         */

        if (!authUserId) {

            return res.status(400).json({

                success: false,

                message:
                    "This teacher is not linked to a recoverable login account. No new login account was created."

            });
        }


        /**
         * --------------------------------------------------------
         * PREVENT SELF DEACTIVATION
         * --------------------------------------------------------
         */

        const requestedStatus =
            String(
                teacher.status ||
                existingTeacher.status ||
                "Active"
            )
                .trim();


        const normalizedStatus =
            requestedStatus.toLowerCase() ===
            "inactive"
                ? "Inactive"
                : "Active";


        if (
            normalizedStatus === "Inactive" &&
            String(
                authUserId
            ) ===
            String(
                req.user.id
            )
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "You cannot deactivate your own Staff & Non-Staff account."

            });
        }


        /**
         * ========================================================
         * VERIFY ORIGINAL AUTH USER
         * ========================================================
         *
         * We use the recovered/original Auth ID.
         *
         * We NEVER create a new login account here.
         * ========================================================
         */

        const {
            data: existingAuthResult,
            error: existingAuthError
        } =
            await supabase
                .auth
                .admin
                .getUserById(
                    authUserId
                );


        if (existingAuthError) {

            console.error(
                "EXISTING AUTH USER LOOKUP ERROR:",
                existingAuthError
            );

            return res.status(500).json({

                success: false,

                message:
                    `Unable to verify the original login account: ${existingAuthError.message}`

            });
        }


        if (!existingAuthResult?.user?.id) {

            return res.status(400).json({

                success: false,

                message:
                    "The original Supabase Auth account could not be found. No new login account was created."

            });
        }


        /**
         * --------------------------------------------------------
         * EXISTING EMAIL / PHONE
         * --------------------------------------------------------
         */

        const existingEmail =
            typeof existingTeacher.email === "string"
                ? existingTeacher.email.trim().toLowerCase()
                : null;


        const existingPhone =
            existingTeacher.phone || null;


        /**
         * --------------------------------------------------------
         * AUTH UPDATE PAYLOAD
         * --------------------------------------------------------
         */

        const authUpdatePayload = {

            user_metadata: {

                full_name:
                    [
                        teacher.first_name,
                        teacher.middle_name,
                        teacher.last_name
                    ]
                        .filter(Boolean)
                        .join(" "),

                employee_number:
                    teacher.employee_number,

                teacher_id:
                    teacherId,

                staff_type:
                    normalizedStaffType,

                role_id:
                    numericPrimaryRoleId,

                primary_role_id:
                    numericPrimaryRoleId,

                role_ids:
                    normalizedRoleIds
            }
        };


        const emailChanged =
            normalizedEmail !== existingEmail;


        const phoneChanged =
            normalizedPhone !== existingPhone;


        if (emailChanged) {

            if (normalizedEmail) {

                authUpdatePayload.email =
                    normalizedEmail;

                authUpdatePayload.email_confirm =
                    true;

            } else {

                authUpdatePayload.email =
                    null;
            }
        }


        if (phoneChanged) {

            if (normalizedPhone) {

                authUpdatePayload.phone =
                    normalizedPhone;

                authUpdatePayload.phone_confirm =
                    true;

            } else {

                authUpdatePayload.phone =
                    null;
            }
        }


        /**
         * ========================================================
         * AUTH LOGIN STATUS
         * ========================================================
         *
         * ACTIVE:
         *
         * ban_duration = "none"
         *
         * INACTIVE:
         *
         * ban_duration = "876000h"
         *
         * ========================================================
         */

        authUpdatePayload.ban_duration =
            normalizedStatus === "Active"
                ? "none"
                : "876000h";


        console.log(
            "========================================"
        );

        console.log(
            "AFRICORE STAFF AUTH UPDATE"
        );

        console.log(
            "Teacher ID:",
            teacherId
        );

        console.log(
            "Auth User ID:",
            authUserId
        );

        console.log(
            "Status:",
            normalizedStatus
        );

        console.log(
            "Auth Login:",
            normalizedStatus === "Active"
                ? "ENABLED / UNBANNED"
                : "DISABLED / BANNED"
        );

        console.log(
            "Ban Duration:",
            authUpdatePayload.ban_duration
        );

        console.log(
            "========================================"
        );


        /**
         * --------------------------------------------------------
         * UPDATE SUPABASE AUTH
         * --------------------------------------------------------
         */

        const {
            data: updatedAuthResult,
            error: authUpdateError
        } =
            await supabase.auth.admin
                .updateUserById(
                    authUserId,
                    authUpdatePayload
                );


        if (authUpdateError) {

            console.error(
                "UPDATE STAFF AUTH ERROR:",
                authUpdateError
            );

            return res.status(500).json({

                success: false,

                message:
                    `Unable to ${normalizedStatus === "Active" ? "restore" : "disable"} the teacher login account: ${authUpdateError.message}`

            });
        }


        /**
         * --------------------------------------------------------
         * UPDATE TEACHER
         * --------------------------------------------------------
         *
         * IMPORTANT:
         *
         * user_id is deliberately preserved/recovered.
         *
         * NEVER set it to NULL.
         * --------------------------------------------------------
         */

        const teacherPayload = {

            school_id:
                teacher.school_id === undefined
                    ? existingTeacher.school_id
                    : teacher.school_id,

            employee_number:
                teacher.employee_number,

            first_name:
                teacher.first_name,

            middle_name:
                teacher.middle_name || null,

            last_name:
                teacher.last_name,

            gender:
                teacher.gender || null,

            phone:
                normalizedPhone,

            email:
                normalizedEmail,

            employment_date:
                teacher.employment_date || null,

            qualification:
                teacher.qualification || null,

            specialization:
                teacher.specialization || null,

            status:
                normalizedStatus,

            photo_url:
                teacher.photo_url || null,

            staff_type:
                normalizedStaffType,

            /**
             * CRITICAL:
             *
             * Preserve/reconnect original Auth account.
             */
            user_id:
                authUserId
        };


        console.log(
            "UPDATE TEACHER DATABASE PAYLOAD:",
            teacherPayload
        );


        const {
            data: updatedTeacher,
            error: teacherUpdateError
        } = await supabase
            .from("teachers")
            .update(
                teacherPayload
            )
            .eq(
                "id",
                teacherId
            )
            .select("*")
            .single();


        if (teacherUpdateError) {

            return res.status(500).json({

                success: false,

                message:
                    `Unable to update teacher: ${teacherUpdateError.message}`

            });
        }


        /**
         * ========================================================
         * UPDATE PROFILE
         * ========================================================
         *
         * For old inactive records, the profile already exists.
         *
         * We update it using the recovered Auth ID.
         * ========================================================
         */

        const fullName =
            [
                teacher.first_name,
                teacher.middle_name,
                teacher.last_name
            ]
                .filter(Boolean)
                .join(" ");


        let updatedProfile = null;


        const {
            data: existingProfile,
            error: profileExistsError
        } =
            await supabase
                .from("profiles")
                .select("*")
                .eq(
                    "id",
                    authUserId
                )
                .maybeSingle();


        if (profileExistsError) {

            return res.status(500).json({

                success: false,

                message:
                    `Unable to verify teacher profile: ${profileExistsError.message}`

            });
        }


        const profilePayload = {

            full_name:
                fullName,

            phone:
                normalizedPhone,

            role_id:
                numericPrimaryRoleId,

            school_id:
                teacherPayload.school_id,

            teacher_id:
                teacherId

        };


        if (existingProfile) {

            const {
                data,
                error
            } = await supabase
                .from("profiles")
                .update(
                    profilePayload
                )
                .eq(
                    "id",
                    authUserId
                )
                .select("*")
                .single();


            if (error) {

                return res.status(500).json({

                    success: false,

                    message:
                        `Unable to update teacher profile: ${error.message}`

                });
            }


            updatedProfile =
                data;

        } else {

            /**
             * ----------------------------------------------------
             * RECOVER MISSING PROFILE SAFELY
             * ----------------------------------------------------
             *
             * We do NOT create a new Auth user.
             * We only recreate the missing profile row for the
             * already-existing Auth user.
             * ----------------------------------------------------
             */

            const {
                data,
                error
            } = await supabase
                .from("profiles")
                .insert({

                    id:
                        authUserId,

                    full_name:
                        fullName,

                    phone:
                        normalizedPhone,

                    role_id:
                        numericPrimaryRoleId,

                    school_id:
                        teacherPayload.school_id,

                    teacher_id:
                        teacherId

                })
                .select("*")
                .single();


            if (error) {

                return res.status(500).json({

                    success: false,

                    message:
                        `Unable to restore teacher profile: ${error.message}`

                });
            }


            updatedProfile =
                data;
        }


        /**
         * ========================================================
         * REPLACE PROFILE ROLES
         * ========================================================
         */

        const {
            error: deleteProfileRolesError
        } = await supabase
            .from("profile_roles")
            .delete()
            .eq(
                "profile_id",
                authUserId
            );


        if (deleteProfileRolesError) {

            return res.status(500).json({

                success: false,

                message:
                    `Unable to clear existing teacher roles: ${deleteProfileRolesError.message}`

            });
        }


        const {
            data: updatedProfileRoles,
            error: insertProfileRolesError
        } =
            await createProfileRoles({

                profileId:
                    authUserId,

                roleIds:
                    normalizedRoleIds,

                primaryRoleId:
                    numericPrimaryRoleId,

                schoolId:
                    teacherPayload.school_id

            });


        if (insertProfileRolesError) {

            return res.status(500).json({

                success: false,

                message:
                    `Unable to save teacher roles: ${insertProfileRolesError.message}`

            });
        }


        /**
         * ========================================================
         * ACTIVATE / DEACTIVATE PROFILE ROLES
         * ========================================================
         */

        const {
            error: roleStatusError
        } =
            await supabase
                .from("profile_roles")
                .update({

                    is_active:
                        normalizedStatus === "Active"

                })
                .eq(
                    "profile_id",
                    authUserId
                );


        if (roleStatusError) {

            return res.status(500).json({

                success: false,

                message:
                    `Unable to update teacher role access: ${roleStatusError.message}`

            });
        }


        /**
         * ========================================================
         * SYNCHRONIZE TEACHER ASSIGNMENTS
         * ========================================================
         */

        const {
            error: deleteAssignmentsError
        } = await supabase
            .from("teacher_assignments")
            .delete()
            .eq(
                "teacher_id",
                teacherId
            );


        if (deleteAssignmentsError) {

            return res.status(500).json({

                success: false,

                message:
                    `Unable to clear existing teacher assignments: ${deleteAssignmentsError.message}`

            });
        }


        let updatedAssignments = [];


        /**
         * --------------------------------------------------------
         * Only active teachers receive active assignments.
         * --------------------------------------------------------
         */

        if (
            normalizedStatus === "Active" &&
            normalizedAssignments.length > 0
        ) {

            const assignmentPayload =
                normalizedAssignments.map(
                    assignment => ({

                        school_id:
                            teacherPayload.school_id,

                        teacher_id:
                            teacherId,

                        subject_id:
                            assignment.subject_id,

                        class_id:
                            assignment.class_id

                    })
                );


            const {
                data,
                error
            } = await supabase
                .from("teacher_assignments")
                .insert(
                    assignmentPayload
                )
                .select("*");


            if (error) {

                return res.status(500).json({

                    success: false,

                    message:
                        `Unable to save teacher assignments: ${error.message}`

                });
            }


            updatedAssignments =
                data || [];
        }


        /**
         * ========================================================
         * SUCCESS
         * ========================================================
         */

        console.log(
            "========================================"
        );

        console.log(
            "AFRICORE STAFF UPDATE SUCCESS"
        );

        console.log(
            "Teacher ID:",
            teacherId
        );

        console.log(
            "Auth User ID:",
            authUserId
        );

        console.log(
            "Status:",
            normalizedStatus
        );

        console.log(
            "Login:",
            normalizedStatus === "Active"
                ? "ENABLED"
                : "DISABLED"
        );

        console.log(
            "teachers.user_id PRESERVED:",
            true
        );

        console.log(
            "Historical records preserved:",
            true
        );

        console.log(
            "========================================"
        );


        return res.status(200).json({

            success: true,

            message:
                normalizedStatus === "Active"
                    ? "Teacher / Staff has been restored successfully. The original login account is active again."
                    : "Teacher / Staff has been deactivated successfully. The original login account is disabled and historical records have been preserved.",

            teacher:
                updatedTeacher,

            auth_user: {

                id:
                    updatedAuthResult?.user?.id ||
                    authUserId,

                email:
                    updatedAuthResult?.user?.email ||
                    normalizedEmail,

                phone:
                    updatedAuthResult?.user?.phone ||
                    normalizedPhone
            },

            profile:
                updatedProfile,

            roles:
                roles,

            primary_role:
                primaryRole,

            role:
                primaryRole,

            profile_roles:
                updatedProfileRoles,

            assignments:
                updatedAssignments,

            staff_type:
                updatedTeacher?.staff_type ||
                normalizedStaffType,

            status:
                normalizedStatus,

            login_enabled:
                normalizedStatus === "Active",

            historical_record_preserved:
                true

        });

    } catch (error) {

        console.error(
            "========================================"
        );

        console.error(
            "UPDATE TEACHER ERROR:"
        );

        console.error(
            error
        );

        console.error(
            "========================================"
        );


        return res.status(500).json({

            success: false,

            message:
                error?.message ||
                "Unable to update teacher."

        });
    }
};


/**
 * ============================================================
 * DELETE / DEACTIVATE TEACHER / STAFF
 * ============================================================
 *
 * DELETE /api/teachers/:id
 *
 * IMPORTANT:
 *
 * We DO NOT physically delete:
 *
 * - teachers
 * - profiles
 * - messages
 * - historical ERP records
 * - auth.users
 *
 * Instead:
 *
 * 1. Ban the Supabase Auth account
 * 2. Keep teachers.user_id linked
 * 3. Set teachers.status = Inactive
 * 4. Disable profile_roles
 * 5. Preserve all historical records
 *
 * IMPORTANT:
 *
 * teachers.user_id MUST NOT be set to NULL.
 *
 * This allows the same account to be restored later.
 *
 * ============================================================
 */

export const deleteTeacher = async (
    req,
    res
) => {

    const teacherId =
        Number(
            req.params.id
        );


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


    try {

        /**
         * ====================================================
         * LOAD TARGET STAFF MEMBER
         * ====================================================
         */

        const {
            data: teacher,
            error: teacherError
        } = await supabase
            .from("teachers")
            .select(`
                id,
                school_id,
                user_id,
                employee_number,
                first_name,
                middle_name,
                last_name,
                status,
                staff_type,
                photo_url
            `)
            .eq(
                "id",
                teacherId
            )
            .maybeSingle();


        if (teacherError) {

            console.error(
                "DELETE TEACHER LOAD ERROR:",
                teacherError
            );

            return res.status(500).json({

                success: false,

                message:
                    `Unable to load Staff & Non-Staff member: ${teacherError.message}`

            });

        }


        if (!teacher) {

            return res.status(404).json({

                success: false,

                message:
                    "Staff & Non-Staff member not found."

            });

        }


        /**
         * ====================================================
         * GET AUTH USER ID
         * ====================================================
         *
         * Normally it is already in teachers.user_id.
         *
         * For old records where a previous version set user_id
         * to NULL, recover it through profiles.teacher_id.
         *
         * ====================================================
         */

        let authUserId =
            teacher.user_id ||
            null;


        if (!authUserId) {

            const {
                data: profile,
                error: profileLookupError
            } = await supabase
                .from("profiles")
                .select(`
                    id,
                    teacher_id
                `)
                .eq(
                    "teacher_id",
                    teacherId
                )
                .maybeSingle();


            if (profileLookupError) {

                console.error(
                    "DELETE TEACHER AUTH RECOVERY ERROR:",
                    profileLookupError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        `Unable to recover Staff & Non-Staff login account: ${profileLookupError.message}`

                });
            }


            if (profile?.id) {

                authUserId =
                    profile.id;

            }

        }


        /**
         * ====================================================
         * PREVENT SELF DEACTIVATION
         * ====================================================
         */

        if (
            authUserId &&
            String(
                authUserId
            ) ===
            String(
                req.user.id
            )
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "You cannot deactivate your own Staff & Non-Staff account."

            });

        }


        /**
         * ====================================================
         * DISABLE SUPABASE AUTH LOGIN
         * ====================================================
         *
         * We BAN instead of deleting.
         *
         * This protects historical relationships.
         *
         * ====================================================
         */

        if (authUserId) {

            console.log(
                "========================================"
            );

            console.log(
                "AFRICORE STAFF AUTH BAN"
            );

            console.log(
                "Teacher ID:",
                teacherId
            );

            console.log(
                "Auth User ID:",
                authUserId
            );

            console.log(
                "Ban Duration:",
                "876000h"
            );

            console.log(
                "========================================"
            );


            const {
                data: bannedUser,
                error: authBanError
            } =
                await supabase
                    .auth
                    .admin
                    .updateUserById(
                        authUserId,
                        {
                            ban_duration:
                                "876000h"
                        }
                    );


            if (
                authBanError
            ) {

                console.error(
                    "DISABLE STAFF AUTH ERROR:",
                    authBanError
                );

                console.error(
                    "AUTH ERROR MESSAGE:",
                    authBanError?.message
                );

                console.error(
                    "AUTH ERROR STATUS:",
                    authBanError?.status
                );

                console.error(
                    "AUTH ERROR CODE:",
                    authBanError?.code
                );


                return res.status(500).json({

                    success: false,

                    message:
                        `Unable to disable the Staff & Non-Staff login account: ${authBanError?.message || "Supabase Auth account could not be disabled."}`

                });

            }


            if (
                !bannedUser?.user
            ) {

                console.warn(
                    "AUTH BAN COMPLETED WITHOUT USER OBJECT:",
                    bannedUser
                );

            }

        }


        /**
         * ====================================================
         * DEACTIVATE TEACHER
         * ====================================================
         *
         * CRITICAL CHANGE:
         *
         * DO NOT set user_id = null.
         *
         * The original Auth ID remains connected so the account
         * can be restored later.
         *
         * ====================================================
         */

        const teacherUpdatePayload = {

            status:
                "Inactive"

        };


        if (authUserId) {

            teacherUpdatePayload.user_id =
                authUserId;

        }


        const {
            data:
                deactivatedTeacher,
            error:
                deactivateError
        } =
            await supabase
                .from("teachers")
                .update(
                    teacherUpdatePayload
                )
                .eq(
                    "id",
                    teacherId
                )
                .select("*")
                .single();


        if (
            deactivateError
        ) {

            console.error(
                "DEACTIVATE TEACHER ERROR:",
                deactivateError
            );

            return res.status(500).json({

                success: false,

                auth_disabled:
                    Boolean(
                        authUserId
                    ),

                message:
                    `Login was disabled, but the Staff & Non-Staff record could not be marked Inactive: ${deactivateError.message}`

            });

        }


        /**
         * ====================================================
         * DISABLE ALL PROFILE ROLES
         * ====================================================
         */

        if (
            authUserId
        ) {

            const {
                error:
                    profileRolesError
            } =
                await supabase
                    .from("profile_roles")
                    .update({

                        is_active:
                            false

                    })
                    .eq(
                        "profile_id",
                        authUserId
                    );


            if (
                profileRolesError
            ) {

                console.warn(
                    "PROFILE ROLE DEACTIVATION WARNING:",
                    profileRolesError
                );

            }

        }


        /**
         * ====================================================
         * FINAL LOG
         * ====================================================
         */

        console.log(
            "========================================"
        );

        console.log(
            "AFRICORE STAFF DEACTIVATED"
        );

        console.log(
            "Teacher ID:",
            teacherId
        );

        console.log(
            "Auth User ID preserved:",
            authUserId
        );

        console.log(
            "Auth account banned:",
            Boolean(
                authUserId
            )
        );

        console.log(
            "teachers.user_id preserved:",
            true
        );

        console.log(
            "Teacher record preserved:",
            true
        );

        console.log(
            "Historical records preserved:",
            true
        );

        console.log(
            "========================================"
        );


        /**
         * ====================================================
         * RESPONSE
         * ====================================================
         */

        return res.status(200).json({

            success: true,

            deleted: true,

            inactive_only: true,

            auth_disabled:
                Boolean(
                    authUserId
                ),

            auth_banned:
                Boolean(
                    authUserId
                ),

            auth_user_id:
                authUserId,

            user_id_preserved:
                true,

            historical_record_preserved:
                true,

            message:
                "Staff & Non-Staff member has been removed from active management and the original login account has been disabled. The account can be restored later and historical records have been preserved.",

            teacher:
                deactivatedTeacher

        });


    } catch (error) {

        console.error(
            "========================================"
        );

        console.error(
            "DELETE / DEACTIVATE TEACHER ERROR"
        );

        console.error(
            "========================================"
        );

        console.error(
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error?.message ||
                "Unable to remove Staff & Non-Staff member."

        });

    }

};