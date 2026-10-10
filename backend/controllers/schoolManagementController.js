import { supabase } from "../config/supabase.js";
import { getUserAccess } from "../services/permissionService.js";

const HEADMASTER_ROLE_ID = 2;

export const createSchoolHeadmaster = async (req, res) => {
    let createdAuthUserId = null;
    let profileCreated = false;

    try {
        if (!req.user?.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const access = await getUserAccess(req.user.id);
        if (access?.isSuperAdmin !== true) {
            return res.status(403).json({
                success: false,
                message: "Only Super Admin can create a Headmaster account.",
            });
        }

        const schoolId = Number(req.body?.school_id);
        const fullName = String(req.body?.full_name || "").trim();
        const email = String(req.body?.email || "").trim().toLowerCase();
        const phone = String(req.body?.phone || "").trim();
        const password = String(req.body?.password || "");

        if (!Number.isSafeInteger(schoolId) || schoolId <= 0) {
            return res.status(400).json({ success: false, message: "Valid School ID is required." });
        }
        if (fullName.length < 2 || fullName.length > 180) {
            return res.status(400).json({ success: false, message: "Enter the Headmaster's full name." });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
            return res.status(400).json({ success: false, message: "Enter a valid email address." });
        }
        if (password.length < 8 || password.length > 128) {
            return res.status(400).json({ success: false, message: "Password must contain at least 8 characters." });
        }

        const { data: school, error: schoolError } = await supabase
            .from("schools")
            .select("id, school_name, is_active")
            .eq("id", schoolId)
            .maybeSingle();

        if (schoolError) {
            console.error("HEADMASTER SCHOOL LOOKUP ERROR:", schoolError);
            return res.status(500).json({ success: false, message: "Unable to verify the selected school." });
        }
        if (!school || school.is_active !== true) {
            return res.status(404).json({ success: false, message: "The selected school is not active or does not exist." });
        }

        const { data: authResult, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
                school_id: schoolId,
                account_type: "headmaster",
            },
        });

        if (authError || !authResult?.user?.id) {
            return res.status(400).json({
                success: false,
                message: authError?.message || "Supabase Auth account was not created.",
            });
        }

        createdAuthUserId = authResult.user.id;

        const { error: profileError } = await supabase
            .from("profiles")
            .insert({
                id: createdAuthUserId,
                full_name: fullName,
                phone: phone || null,
                role_id: HEADMASTER_ROLE_ID,
                school_id: schoolId,
            });

        if (profileError) {
            console.error("HEADMASTER PROFILE INSERT ERROR:", profileError);
            await supabase.auth.admin.deleteUser(createdAuthUserId);
            createdAuthUserId = null;
            return res.status(500).json({
                success: false,
                message: "Auth account was rolled back because the school profile could not be created.",
            });
        }
        profileCreated = true;

        const { error: profileRoleError } = await supabase
            .from("profile_roles")
            .insert({
                profile_id: createdAuthUserId,
                role_id: HEADMASTER_ROLE_ID,
                school_id: schoolId,
                is_primary: true,
                is_active: true,
            });

        if (profileRoleError) {
            console.error("HEADMASTER PROFILE ROLE INSERT ERROR:", profileRoleError);
            await supabase.from("profiles").delete().eq("id", createdAuthUserId);
            profileCreated = false;
            await supabase.auth.admin.deleteUser(createdAuthUserId);
            createdAuthUserId = null;
            return res.status(500).json({
                success: false,
                message: "Account setup was rolled back because the Headmaster role could not be assigned.",
            });
        }

        return res.status(201).json({
            success: true,
            message: "Headmaster account created and linked to the selected school.",
            headmaster: {
                id: createdAuthUserId,
                full_name: fullName,
                email,
                phone: phone || null,
                role_id: HEADMASTER_ROLE_ID,
                school_id: schoolId,
                school_name: school.school_name,
            },
        });
    } catch (error) {
        console.error("CREATE SCHOOL HEADMASTER ERROR:", error);

        if (createdAuthUserId) {
            if (profileCreated) {
                await supabase.from("profile_roles").delete().eq("profile_id", createdAuthUserId);
                await supabase.from("profiles").delete().eq("id", createdAuthUserId);
            }
            await supabase.auth.admin.deleteUser(createdAuthUserId);
        }

        return res.status(500).json({
            success: false,
            message: "Unable to create the Headmaster account. No account credentials are returned.",
        });
    }
};
