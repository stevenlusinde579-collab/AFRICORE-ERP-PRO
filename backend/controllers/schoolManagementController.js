import { supabase } from "../config/supabase.js";

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
 * POST /api/schools
 * Creates a school without deleting or changing existing school data.
 */
export const createSchool = async (req, res) => {
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

        const { data, error } = await supabase
            .from("schools")
            .insert(payload)
            .select(SCHOOL_COLUMNS)
            .single();

        if (error) {
            console.error("SCHOOL MANAGEMENT - CREATE ERROR:", error);
            return res.status(400).json({
                success: false,
                message: "School could not be created.",
                error: error.message
            });
        }

        return res.status(201).json({
            success: true,
            message: "School created successfully.",
            school: data
        });
    } catch (error) {
        console.error("SCHOOL MANAGEMENT - CREATE EXCEPTION:", error);
        return res.status(500).json({
            success: false,
            message: "Unexpected error while creating the school."
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

        const { data: roleRows, error: roleRowsError } = await supabase
            .from("profile_roles")
            .select("profile_id,school_id")
            .eq("role_id", role.id)
            .eq("is_active", true);

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

        const headmasters = (profiles || []).map((profile) => {
            const roleRow = (roleRows || []).find(
                (row) => row.profile_id === profile.id
            );

            return {
                id: profile.id,
                full_name: profile.full_name || "Headmaster",
                phone: profile.phone || null,
                school_id: roleRow?.school_id ?? profile.school_id ?? null
            };
        });

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
