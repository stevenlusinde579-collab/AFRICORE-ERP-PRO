import { supabase } from "../config/supabase.js";
import { randomInt } from "node:crypto";
import { sendSchoolSms } from "../utils/schoolSms.js";

const SCHOOL_COLUMNS = [
    "id",
    "school_name",
    "registration_number",
    "address",
    "phone",
    "email",
    "logo",
    "created_at",
    "is_active",
    "show_school_name",
    "show_logo",
    "show_registration_number",
    "show_address",
    "show_phone",
    "show_email"
].join(",");

/**
 * GET /api/schools
 * Super Admin only. Reads the school list for the management screen.
 */
export const getSchools = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("schools")
            .select(SCHOOL_COLUMNS)
            .order("id", { ascending: true });

        if (error) {
            console.error("SCHOOL MANAGEMENT - LIST ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to load schools.",
                error: error.message
            });
        }

        return res.json({
            success: true,
            schools: data || []
        });
    } catch (error) {
        console.error("SCHOOL MANAGEMENT - LIST EXCEPTION:", error);
        return res.status(500).json({
            success: false,
            message: "Unexpected error while loading schools."
        });
    }
};

/**
 * GET /api/schools/:id/overview
 * Super Admin only. Returns exact counts scoped to one school.
 */
export const getSchoolOverview = async (req, res) => {
    try {
        const schoolId = Number(req.params.id);
        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            return res.status(400).json({ success: false, message: "A valid school ID is required." });
        }

        const { data: school, error: schoolError } = await supabase
            .from("schools")
            .select("id,school_name,registration_number,address,phone,email,is_active")
            .eq("id", schoolId)
            .maybeSingle();
        if (schoolError) throw schoolError;
        if (!school) {
            return res.status(404).json({ success: false, message: "School was not found." });
        }

        const [studentsResult, staffResult, nonStaffResult] = await Promise.all([
            supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
            supabase.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("staff_type", "Staff"),
            supabase.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("staff_type", "Non-Staff")
        ]);
        const queryError = [studentsResult.error, staffResult.error, nonStaffResult.error].find(Boolean);
        if (queryError) throw queryError;

        const students = studentsResult.count || 0;
        const staff = staffResult.count || 0;
        const nonStaff = nonStaffResult.count || 0;
        return res.json({
            success: true,
            school,
            overview: { students, staff, nonStaff, totalUsers: students + staff + nonStaff }
        });
    } catch (error) {
        console.error("SCHOOL MANAGEMENT - SCHOOL OVERVIEW ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to load school usage overview." });
    }
};

/**
 * POST /api/schools
 * Creates a school without deleting or changing existing school data.
 */
export const createSchool = async (req, res) => {
    let createdSchoolId = null;
    let createdAcademicYearId = null;
    let createdClassIds = [];

    try {
        const schoolName =
            typeof req.body?.school_name === "string"
                ? req.body.school_name.trim()
                : "";

        if (!schoolName) {
            return res.status(400).json({
                success: false,
                message: "School name is required."
            });
        }

        const requestedYear = String(req.body?.academic_year || "").trim();
        if (!/^20\d{2}$/.test(requestedYear)) {
            return res.status(400).json({
                success: false,
                message: "Weka Academic Year sahihi (mfano 2027)."
            });
        }

        const optionalText = (value) => {
            if (typeof value !== "string") return null;
            const trimmed = value.trim();
            return trimmed || null;
        };

        const payload = {
            school_name: schoolName,
            registration_number: optionalText(req.body.registration_number),
            address: optionalText(req.body.address),
            phone: optionalText(req.body.phone),
            email: optionalText(req.body.email),
            is_active: typeof req.body.is_active === "boolean"
                ? req.body.is_active
                : true
        };

        const { data: school, error: schoolError } = await supabase
            .from("schools")
            .insert(payload)
            .select(SCHOOL_COLUMNS)
            .single();

        if (schoolError) {
            console.error("SCHOOL MANAGEMENT - CREATE ERROR:", schoolError);
            return res.status(400).json({
                success: false,
                message: "School could not be created.",
                error: schoolError.message
            });
        }

        createdSchoolId = school.id;

        // Create the active academic year selected in the Add School form.
        // Never leave a newly created school without an academic year.
        const { data: existingYear, error: existingYearError } = await supabase
            .from("academic_years")
            .select("id,year_name")
            .eq("school_id", createdSchoolId)
            .eq("year_name", requestedYear)
            .eq("term", "ANNUAL")
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingYearError) throw existingYearError;

        let academicYear;
        if (existingYear) {
            const { data: activatedYear, error: activateYearError } = await supabase
                .from("academic_years")
                .update({ is_active: true })
                .eq("id", existingYear.id)
                .select("id,year_name")
                .single();
            if (activateYearError) throw activateYearError;
            academicYear = activatedYear;
        } else {
            const { data: createdAcademicYear, error: createYearError } = await supabase
                .from("academic_years")
                .insert({
                    school_id: createdSchoolId,
                    year_name: requestedYear,
                    term: "ANNUAL",
                    start_date: `${requestedYear}-01-01`,
                    end_date: `${requestedYear}-12-31`,
                    is_active: true
                })
                .select("id,year_name")
                .single();
            if (createYearError) throw createYearError;
            academicYear = createdAcademicYear;
            createdAcademicYearId = createdAcademicYear.id;
        }

        // The academic_years trigger creates the default classes automatically.
        // Do not insert them again here: uq_classes_school_year_name prevents duplicates.
        const { data: classes, error: classesError } = await supabase
            .from("classes")
            .select("id,class_name,academic_level")
            .eq("school_id", createdSchoolId)
            .eq("academic_year_id", academicYear.id);

        if (classesError) throw classesError;

        const expectedDefaultClassCount = 17;
        if ((classes || []).length < expectedDefaultClassCount) {
            throw new Error(
                `Default class setup was incomplete: expected ${expectedDefaultClassCount} classes, found ${(classes || []).length}.`
            );
        }
        createdClassIds = (classes || []).map((item) => item.id);

        return res.status(201).json({
            success: true,
            message: "School created successfully with default classes.",
            school,
            setup: {
                academic_year: academicYear.year_name,
                classes_created: (classes || []).length
            }
        });
    } catch (error) {
        console.error("SCHOOL MANAGEMENT - CREATE/DEFAULT CLASSES ERROR:", error);

        if (createdClassIds.length > 0) {
            const { error: cleanupError } = await supabase
                .from("classes")
                .delete()
                .in("id", createdClassIds);

            if (cleanupError) {
                console.error("SCHOOL MANAGEMENT - CLASS CLEANUP ERROR:", cleanupError);
            }
        }

        if (createdAcademicYearId) {
            const { error: yearCleanupError } = await supabase
                .from("academic_years")
                .delete()
                .eq("id", createdAcademicYearId);
            if (yearCleanupError) {
                console.error("SCHOOL MANAGEMENT - ACADEMIC YEAR CLEANUP ERROR:", yearCleanupError);
            }
        }

        if (createdSchoolId) {
            const { error: schoolCleanupError } = await supabase
                .from("schools")
                .delete()
                .eq("id", createdSchoolId);
            if (schoolCleanupError) {
                console.error("SCHOOL MANAGEMENT - SCHOOL CLEANUP ERROR:", schoolCleanupError);
            }
        }

        return res.status(500).json({
            success: false,
            message: "School setup failed while creating its default classes.",
            error: error?.message || "Unknown setup error.",
            school_id: createdSchoolId
        });
    }
};

/**
 * PATCH /api/schools/:id
 * Updates editable school details or the active status.
 */
export const updateSchool = async (req, res) => {
    try {
        const schoolId = Number(req.params.id);

        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid school ID is required."
            });
        }

        const payload = {};
        const body = req.body || {};

        if (Object.prototype.hasOwnProperty.call(body, "school_name")) {
            const schoolName =
                typeof body.school_name === "string"
                    ? body.school_name.trim()
                    : "";

            if (!schoolName) {
                return res.status(400).json({
                    success: false,
                    message: "School name cannot be empty."
                });
            }

            payload.school_name = schoolName;
        }

        for (const field of [
            "registration_number",
            "address",
            "phone",
            "email"
        ]) {
            if (Object.prototype.hasOwnProperty.call(body, field)) {
                const value = body[field];
                payload[field] =
                    typeof value === "string" && value.trim()
                        ? value.trim()
                        : null;
            }
        }

        if (Object.prototype.hasOwnProperty.call(body, "is_active")) {
            if (typeof body.is_active !== "boolean") {
                return res.status(400).json({
                    success: false,
                    message: "School status must be true or false."
                });
            }

            payload.is_active = body.is_active;
        }

        if (Object.keys(payload).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid school changes were provided."
            });
        }

        const { data, error } = await supabase
            .from("schools")
            .update(payload)
            .eq("id", schoolId)
            .select(SCHOOL_COLUMNS)
            .maybeSingle();

        if (error) {
            console.error("SCHOOL MANAGEMENT - UPDATE ERROR:", error);
            return res.status(400).json({
                success: false,
                message: "School could not be updated.",
                error: error.message
            });
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "School was not found."
            });
        }

        return res.json({
            success: true,
            message: "School updated successfully.",
            school: data
        });
    } catch (error) {
        console.error("SCHOOL MANAGEMENT - UPDATE EXCEPTION:", error);
        return res.status(500).json({
            success: false,
            message: "Unexpected error while updating the school."
        });
    }
};


/**
 * POST /api/schools/:id/headmasters
 * Create a new Headmaster Auth account and assign it to the selected school.
 * This endpoint is mounted behind authenticateUser + requireSuperAdmin.
 */
export const createSchoolHeadmaster = async (req, res) => {
    let authUserId = null;
    let profileCreated = false;
    let profileRoleCreated = false;

    try {
        const schoolId = Number(req.params.id);
        const fullName = String(req.body?.full_name || "").trim().replace(/\s+/g, " ");
        const email = String(req.body?.email || "").trim().toLowerCase();
        const rawPhone = String(req.body?.phone || "").trim();
        let phone = rawPhone ? rawPhone.replace(/[\s().-]/g, "") : "";
        if (/^0[678]\d{8}$/.test(phone)) phone = `+255${phone.slice(1)}`;
        else if (/^255[678]\d{8}$/.test(phone)) phone = `+${phone}`;
        else if (/^[678]\d{8}$/.test(phone)) phone = `+255${phone}`;

        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            return res.status(400).json({ success: false, message: "Chagua shule sahihi." });
        }
        if (fullName.length < 3) {
            return res.status(400).json({ success: false, message: "Jina kamili la Headmaster linahitajika." });
        }
        if (!email || !phone) {
            return res.status(400).json({ success: false, message: "Email na namba ya simu vyote vinahitajika. Username ya login itakuwa email." });
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, message: "Email si sahihi." });
        }
        if (phone && !/^\+255[678]\d{8}$/.test(phone)) {
            return res.status(400).json({ success: false, message: "Namba ya simu si sahihi. Tumia mfano 0712345678 au +255712345678." });
        }

        const { data: school, error: schoolError } = await supabase
            .from("schools")
            .select("id,school_name,is_active")
            .eq("id", schoolId)
            .maybeSingle();
        if (schoolError) throw schoolError;
        if (!school) {
            return res.status(404).json({ success: false, message: "Shule haijapatikana." });
        }
        if (school.is_active !== true) {
            return res.status(403).json({ success: false, message: "Shule haija-activate. I-activate kabla ya kuongeza Headmaster." });
        }

        const { data: headmasterRole, error: roleError } = await supabase
            .from("roles")
            .select("id,role_name")
            .eq("role_name", "Headmaster")
            .maybeSingle();
        if (roleError) throw roleError;
        if (!headmasterRole) {
            return res.status(500).json({ success: false, message: "Role ya Headmaster haijapatikana kwenye mfumo." });
        }

        const { data: existingAssignments, error: assignmentLookupError } = await supabase
            .from("profile_roles")
            .select("profile_id")
            .eq("role_id", headmasterRole.id)
            .eq("school_id", schoolId)
            .eq("is_active", true)
            .limit(1);
        if (assignmentLookupError) throw assignmentLookupError;
        const { data: legacyHeadmaster, error: legacyHeadmasterError } = await supabase
            .from("profiles")
            .select("id")
            .eq("role_id", headmasterRole.id)
            .eq("school_id", schoolId)
            .limit(1)
            .maybeSingle();
        if (legacyHeadmasterError) throw legacyHeadmasterError;
        if (existingAssignments?.length || legacyHeadmaster) {
            return res.status(409).json({ success: false, message: "Shule hii tayari ina Headmaster aliyeunganishwa. Tumia sehemu ya kubadilisha/ku-assign Headmaster aliyepo." });
        }

        const temporaryPassword = `AfriCore@${randomInt(100000000, 1000000000)}!`;
        const authPayload = {
            password: temporaryPassword,
            email_confirm: Boolean(email),
            phone_confirm: Boolean(phone),
            user_metadata: { full_name: fullName, role_id: headmasterRole.id, primary_role_id: headmasterRole.id, role_ids: [headmasterRole.id], school_id: schoolId }
        };
        if (email) authPayload.email = email;
        if (phone) authPayload.phone = phone;

        const { data: authResult, error: authError } = await supabase.auth.admin.createUser(authPayload);
        if (authError || !authResult?.user?.id) {
            return res.status(400).json({ success: false, message: `Akaunti ya Headmaster haikuundwa: ${authError?.message || "Supabase Auth haikurudisha user."}` });
        }
        authUserId = authResult.user.id;

        const { error: profileError } = await supabase
            .from("profiles")
            .insert([{ id: authUserId, full_name: fullName, phone: phone || null, role_id: headmasterRole.id, school_id: schoolId }]);
        if (profileError) throw profileError;
        profileCreated = true;

        const { error: profileRoleError } = await supabase
            .from("profile_roles")
            .insert([{ profile_id: authUserId, role_id: headmasterRole.id, school_id: schoolId, is_primary: true, is_active: true }]);
        if (profileRoleError) throw profileRoleError;
        profileRoleCreated = true;

        let credentialSms = { status: "skipped", reason: "Namba ya simu haijawekwa." };
        if (phone) {
            const loginUsername = email || phone;
            const smsMessage = `AfriCore Login: User ${loginUsername} Pass ${temporaryPassword} https://africorepro.vercel.app`;
            try {
                const delivery = await sendSchoolSms({
                    schoolId,
                    recipient: phone,
                    message: smsMessage
                });
                credentialSms = { status: "sent", ...delivery };
            } catch (smsError) {
                console.error("HEADMASTER CREDENTIAL SMS ERROR:", smsError);
                credentialSms = { status: "failed", reason: smsError?.message || "SMS haikutumwa." };
            }
        }

        return res.status(201).json({
            success: true,
            message: `Akaunti ya Headmaster wa ${school.school_name} imeundwa kikamilifu.`,
            headmaster: { id: authUserId, full_name: fullName, email: email || null, phone: phone || null, school_id: schoolId, role_id: headmasterRole.id },
            login_credentials: { login_email: email || null, login_phone: phone || null, username: email || phone, temporary_password: temporaryPassword },
            credential_sms: credentialSms
        });
    } catch (error) {
        console.error("SCHOOL MANAGEMENT - CREATE HEADMASTER ERROR:", error);
        if (authUserId) {
            if (profileRoleCreated) await supabase.from("profile_roles").delete().eq("profile_id", authUserId);
            if (profileCreated) await supabase.from("profiles").delete().eq("id", authUserId);
            await supabase.auth.admin.deleteUser(authUserId);
        }
        return res.status(500).json({ success: false, message: error?.message || "Imeshindikana kuunda akaunti ya Headmaster." });
    }
};



/**
 * POST /api/schools/headmasters/:profileId/resend-credentials
 * Super Admin only (router guard). Resets the same account, then sends school SMS.
 */
export const resendHeadmasterCredentials = async (req, res) => {
    try {
        const profileId = String(req.params.profileId || "").trim();
        if (!profileId) return res.status(400).json({ success: false, message: "Headmaster ID inahitajika." });

        const { data: profile, error: profileError } = await supabase
            .from("profiles").select("id,full_name,phone,school_id,role_id")
            .eq("id", profileId).maybeSingle();
        if (profileError) throw profileError;
        if (!profile) return res.status(404).json({ success: false, message: "Headmaster hakupatikana." });

        const { data: role, error: roleError } = await supabase
            .from("roles").select("id").eq("role_name", "Headmaster").maybeSingle();
        if (roleError) throw roleError;
        if (!role || Number(profile.role_id) !== Number(role.id)) {
            const { data: activeRole, error: activeRoleError } = await supabase
                .from("profile_roles").select("profile_id")
                .eq("profile_id", profileId).eq("role_id", role?.id || -1)
                .eq("is_active", true).limit(1).maybeSingle();
            if (activeRoleError) throw activeRoleError;
            if (!activeRole) return res.status(403).json({ success: false, message: "Akaunti hii haina role ya Headmaster." });
        }

        const { data: authResult, error: authLookupError } = await supabase.auth.admin.getUserById(profileId);
        if (authLookupError) throw authLookupError;
        const username = String(authResult?.user?.email || "").trim().toLowerCase();
        if (!username || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) {
            return res.status(409).json({ success: false, message: "Email ya login haijawekwa. Rekebisha email ya Headmaster kwanza; username lazima iwe email." });
        }
        if (!profile.phone) return res.status(409).json({ success: false, message: "Namba ya simu ya Headmaster haijawekwa." });
        if (!profile.school_id) return res.status(409).json({ success: false, message: "Headmaster hajaunganishwa na shule." });

        const { data: school, error: schoolError } = await supabase
            .from("schools").select("id,is_active").eq("id", profile.school_id).maybeSingle();
        if (schoolError) throw schoolError;
        if (!school || school.is_active !== true) {
            return res.status(409).json({ success: false, message: "Shule haipo Active. I-activate kwanza." });
        }

        const temporaryPassword = `AfriCore@${randomInt(100000000, 1000000000)}!`;
        const { data: updatedAuth, error: passwordError } = await supabase.auth.admin.updateUserById(
            profileId, { password: temporaryPassword, email: username }
        );
        if (passwordError || !updatedAuth?.user) throw passwordError || new Error("Imeshindikana kubadilisha password.");

        try {
            const delivery = await sendSchoolSms({
                schoolId: Number(profile.school_id),
                recipient: profile.phone,
                message: `AfriCore Login: User ${username} Pass ${temporaryPassword} https://africorepro.vercel.app`
            });
            return res.json({ success: true, password_reset: true, username, sms: { status: "sent", ...delivery }, message: "Credentials mpya zimetumwa kwa SMS." });
        } catch (smsError) {
            console.error("RESEND HEADMASTER CREDENTIAL SMS ERROR:", smsError);
            return res.status(502).json({
                success: false, password_reset: true, username, sms: { status: "failed" },
                message: `Password imebadilishwa lakini SMS haikutumwa: ${smsError?.message || "Kagua NewHope settings."} Jaribu resend tena baada ya kurekebisha.`
            });
        }
    } catch (error) {
        console.error("RESEND HEADMASTER CREDENTIALS ERROR:", error);
        return res.status(500).json({ success: false, message: error?.message || "Imeshindikana kutuma credentials za Headmaster." });
    }
};


/**
 * GET /api/schools/headmasters
 * Lists active Headmaster accounts for school assignment.
 */
export const getHeadmasters = async (req, res) => {
    try {
        const { data: role, error: roleError } = await supabase
            .from("roles")
            .select("id,role_name")
            .eq("role_name", "Headmaster")
            .maybeSingle();

        if (roleError) throw roleError;

        if (!role) {
            return res.json({ success: true, headmasters: [] });
        }

        // Keep historical Headmaster assignments selectable for future reappointment.
        const { data: roleRows, error: roleRowsError } = await supabase
            .from("profile_roles")
            .select("profile_id,school_id,is_active")
            .eq("role_id", role.id);

        if (roleRowsError) throw roleRowsError;

        const { data: legacyProfiles, error: legacyError } = await supabase
            .from("profiles")
            .select("id,full_name,phone,school_id,role_id")
            .eq("role_id", role.id);

        if (legacyError) throw legacyError;

        const legacyIds = (legacyProfiles || []).map((profile) => profile.id);
        let legacyActiveRoleRows = [];

        if (legacyIds.length > 0) {
            const { data, error } = await supabase
                .from("profile_roles")
                .select("profile_id,role_id")
                .in("profile_id", legacyIds)
                .eq("is_active", true);

            if (error) throw error;
            legacyActiveRoleRows = data || [];
        }

        // profile_roles is canonical. Use profiles.role_id only for legacy
        // accounts that have no active profile_roles at all.
        const profilesWithActiveRoles = new Set(
            legacyActiveRoleRows.map((row) => row.profile_id)
        );
        const validLegacyProfiles = (legacyProfiles || []).filter(
            (profile) => !profilesWithActiveRoles.has(profile.id)
        );

        const ids = [
            ...new Set([
                ...(roleRows || []).map((row) => row.profile_id),
                ...validLegacyProfiles.map((profile) => profile.id)
            ].filter(Boolean))
        ];

        if (ids.length === 0) {
            return res.json({ success: true, headmasters: [] });
        }

        const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id,full_name,phone,school_id,role_id")
            .in("id", ids)
            .order("full_name", { ascending: true });

        if (profilesError) throw profilesError;

        const headmasters = await Promise.all((profiles || []).map(async (profile) => {
            const roleRow = (roleRows || []).find(
                (row) => row.profile_id === profile.id && row.is_active === true
            );
            const { data: authData } = await supabase.auth.admin.getUserById(profile.id);
            return {
                id: profile.id,
                full_name: profile.full_name || "Headmaster",
                email: authData?.user?.email || null,
                phone: profile.phone || null,
                school_id: roleRow?.school_id ?? profile.school_id ?? null
            };
        }));

        return res.json({ success: true, headmasters });
    } catch (error) {
        console.error("SCHOOL MANAGEMENT - HEADMASTER LIST ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load Headmaster accounts."
        });
    }
};

/**
 * PATCH /api/schools/headmasters/:profileId/school
 * Assigns an existing Headmaster account to a school.
 */
export const assignHeadmaster = async (req, res) => {
    try {
        const profileId = String(req.params.profileId || "").trim();
        const schoolId = Number(req.body?.school_id);

        if (!profileId) {
            return res.status(400).json({
                success: false,
                message: "Headmaster account is required."
            });
        }

        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid school ID is required."
            });
        }

        // The database function updates profiles and profile_roles in one transaction.
        const { data: headmaster, error: assignmentError } = await supabase
            .rpc("assign_headmaster_to_school", {
                p_profile_id: profileId,
                p_school_id: schoolId
            });

        if (assignmentError) {
            console.error(
                "SCHOOL MANAGEMENT - HEADMASTER ASSIGNMENT ERROR:",
                assignmentError
            );

            return res.status(400).json({
                success: false,
                message: assignmentError.message ||
                    "Unable to assign the Headmaster to this school."
            });
        }

        const { data: school, error: schoolError } = await supabase
            .from("schools")
            .select("id,school_name")
            .eq("id", schoolId)
            .maybeSingle();

        if (schoolError) {
            console.error(
                "SCHOOL MANAGEMENT - ASSIGNED SCHOOL LOOKUP ERROR:",
                schoolError
            );
            return res.status(500).json({
                success: false,
                message: "Headmaster was assigned, but school details could not be loaded."
            });
        }

        return res.json({
            success: true,
            message: "Headmaster assigned to school successfully.",
            headmaster,
            school
        });
    } catch (error) {
        console.error(
            "SCHOOL MANAGEMENT - HEADMASTER ASSIGNMENT EXCEPTION:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unexpected error while assigning the Headmaster."
        });
    }
};


/**
 * GET /api/schools/:id/sms-settings
 * Returns configuration metadata only. Secret values are never returned.
 */
export const getSchoolSmsSettings = async (req, res) => {
    try {
        const schoolId = Number(req.params.id);
        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            return res.status(400).json({ success: false, message: "A valid school ID is required." });
        }
        const { data, error } = await supabase
            .from("school_sms_settings")
            .select("school_id,sender_id,approval_status,approval_note,updated_at")
            .eq("school_id", schoolId)
            .maybeSingle();
        if (error) throw error;
        return res.json({
            success: true,
            configured: Boolean(data),
            settings: data ? {
                school_id: data.school_id,
                sender_id: data.sender_id,
                approval_status: data.approval_status,
                approval_note: data.approval_note,
                updated_at: data.updated_at,
                credentials_configured: true
            } : null
        });
    } catch (error) {
        console.error("SCHOOL SMS SETTINGS - READ ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to load school SMS settings." });
    }
};

/**
 * PUT /api/schools/:id/sms-settings
 * Super Admin only. Credentials are written to Supabase Vault through a
 * service-role-only RPC and are never returned to the browser.
 */
export const saveSchoolSmsSettings = async (req, res) => {
    try {
        const schoolId = Number(req.params.id);
        const senderId = String(req.body?.sender_id || "").trim();
        const apiKey = String(req.body?.api_key || "").trim();
        const secretKey = String(req.body?.secret_key || "").trim();
        const approvalStatus = String(req.body?.approval_status || "pending").trim().toLowerCase();
        const approvalNote = typeof req.body?.approval_note === "string" ? req.body.approval_note.trim() : null;

        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            return res.status(400).json({ success: false, message: "A valid school ID is required." });
        }
        if (!/^[A-Za-z0-9]{1,11}$/.test(senderId)) {
            return res.status(400).json({ success: false, message: "Sender ID lazima iwe herufi/namba 1 hadi 11 bila nafasi." });
        }
        if (Boolean(apiKey) !== Boolean(secretKey)) {
            return res.status(400).json({ success: false, message: "Weka API Key na Secret Key zote mbili, au acha zote wazi ili kubakiza zilizohifadhiwa." });
        }
        if ((apiKey && apiKey.length < 8) || (secretKey && secretKey.length < 8)) {
            return res.status(400).json({ success: false, message: "Kila key lazima iwe na angalau herufi 8." });
        }
        if (!["pending", "approved", "rejected"].includes(approvalStatus)) {
            return res.status(400).json({ success: false, message: "Hali ya idhini si sahihi." });
        }

        const { data: school, error: schoolError } = await supabase
            .from("schools")
            .select("id")
            .eq("id", schoolId)
            .maybeSingle();
        if (schoolError) throw schoolError;
        if (!school) return res.status(404).json({ success: false, message: "School was not found." });

        const { data: existingSettings, error: existingSettingsError } = await supabase
            .from("school_sms_settings")
            .select("school_id")
            .eq("school_id", schoolId)
            .maybeSingle();
        if (existingSettingsError) throw existingSettingsError;
        if (!existingSettings && (!apiKey || !secretKey)) {
            return res.status(400).json({ success: false, message: "Weka API Key na Secret Key kwa usanidi wa kwanza." });
        }

        const { data, error } = await supabase.rpc("set_school_sms_settings", {
            p_school_id: schoolId,
            p_sender_id: senderId,
            p_api_key: apiKey,
            p_secret_key: secretKey,
            p_approval_status: approvalStatus,
            p_approval_note: approvalNote
        });
        if (error) throw error;

        return res.json({
            success: true,
            message: "Mipangilio ya SMS imehifadhiwa kwa usalama.",
            school_id: schoolId,
            configured: true,
            approval_status: approvalStatus
        });
    } catch (error) {
        console.error("SCHOOL SMS SETTINGS - SAVE ERROR:", error);
        return res.status(500).json({ success: false, message: "Imeshindikana kuhifadhi mipangilio ya SMS. Tafadhali kagua taarifa na ujaribu tena." });
    }
};
