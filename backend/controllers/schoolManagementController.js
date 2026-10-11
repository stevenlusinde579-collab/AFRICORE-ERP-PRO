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
