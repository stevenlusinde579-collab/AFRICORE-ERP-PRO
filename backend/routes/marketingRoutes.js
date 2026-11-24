import express from "express";
import { supabase } from "../config/supabase.js";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = express.Router();
const MARKETING_ROLE_IDS = new Set([1, 2, 7, 18]);
const ALLOWED_PLATFORMS = new Set(["facebook", "instagram", "whatsapp"]);

function requireMarketingRole(req, res, next) {
    const roleIds = (req.access?.roles || []).map((role) => Number(role.id));
    if (!roleIds.some((roleId) => MARKETING_ROLE_IDS.has(roleId))) {
        return res.status(403).json({
            success: false,
            message: "You do not have permission to access Digital Marketing & Publicity."
        });
    }
    return next();
}

function resolveSchoolId(req, suppliedSchoolId) {
    const roleIds = (req.access?.roles || []).map((role) => Number(role.id));
    const isSuperAdmin = req.access?.isSuperAdmin === true || roleIds.includes(1);
    const ownSchoolId = req.profile?.school_id;
    if (isSuperAdmin && suppliedSchoolId) return Number(suppliedSchoolId);
    return ownSchoolId == null ? null : Number(ownSchoolId);
}

async function validateSchoolId(schoolId) {
    if (!Number.isInteger(schoolId) || schoolId <= 0) return false;
    const { data, error } = await supabase
        .from("schools")
        .select("id")
        .eq("id", schoolId)
        .maybeSingle();
    if (error) throw error;
    return Boolean(data);
}

router.use(authenticateUser, requireMarketingRole);

router.get("/status", async (req, res) => {
    try {
        const schoolId = resolveSchoolId(req, req.query.school_id);
        if (!schoolId || !(await validateSchoolId(schoolId))) {
            return res.status(400).json({ success: false, message: "Select a valid school before managing digital platforms." });
        }
        const { data, error } = await supabase
            .from("school_social_accounts")
            .select("id, platform, external_account_id, account_name, token_expires_at, connection_status, updated_at")
            .eq("school_id", schoolId)
            .order("platform");
        if (error) throw error;
        const accounts = data || [];
        return res.json({
            success: true,
            school_id: schoolId,
            platforms: ["facebook", "instagram", "whatsapp"].map((platform) => ({
                platform,
                accounts: accounts.filter((account) => account.platform === platform)
            }))
        });
    } catch (error) {
        console.error("DIGITAL MARKETING STATUS ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to load social platform connections." });
    }
});

router.get("/audiences", async (req, res) => {
    try {
        const schoolId = resolveSchoolId(req, req.query.school_id);
        if (!schoolId || !(await validateSchoolId(schoolId))) {
            return res.status(400).json({ success: false, message: "Select a valid school before loading audiences." });
        }
        const { data, error } = await supabase
            .from("classes")
            .select("id, class_name, academic_level")
            .eq("school_id", schoolId)
            .eq("is_active", true)
            .order("class_name");
        if (error) throw error;
        return res.json({ success: true, classes: data || [] });
    } catch (error) {
        console.error("DIGITAL MARKETING AUDIENCES ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to load school audiences." });
    }
});

router.get("/campaigns", async (req, res) => {
    try {
        const schoolId = resolveSchoolId(req, req.query.school_id);
        if (!schoolId || !(await validateSchoolId(schoolId))) {
            return res.status(400).json({ success: false, message: "Select a valid school before loading campaigns." });
        }
        const { data, error } = await supabase
            .from("marketing_campaigns")
            .select("id, title, message, platforms, audience_type, target_class_id, status, scheduled_at, published_at, created_at")
            .eq("school_id", schoolId)
            .order("created_at", { ascending: false })
            .limit(100);
        if (error) throw error;
        return res.json({ success: true, campaigns: data || [] });
    } catch (error) {
        console.error("DIGITAL MARKETING CAMPAIGNS ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to load marketing campaigns." });
    }
});

router.post("/campaigns", async (req, res) => {
    try {
        const schoolId = resolveSchoolId(req, req.body?.school_id);
        if (!schoolId || !(await validateSchoolId(schoolId))) {
            return res.status(400).json({ success: false, message: "Select a valid school before creating a campaign." });
        }

        const title = String(req.body?.title || "").trim();
        const message = String(req.body?.message || "").trim();
        const platforms = [...new Set((Array.isArray(req.body?.platforms) ? req.body.platforms : []).map((item) => String(item).toLowerCase()))];
        const audienceType = req.body?.audience_type === "class" ? "class" : "all_school";
        const targetClassId = audienceType === "class" ? Number(req.body?.target_class_id) : null;
        const scheduledAt = req.body?.scheduled_at ? new Date(req.body.scheduled_at) : null;

        if (!title || !message || !platforms.length || platforms.some((item) => !ALLOWED_PLATFORMS.has(item))) {
            return res.status(400).json({ success: false, message: "Enter a campaign title, message and at least one valid platform." });
        }
        if (audienceType === "class" && (!Number.isInteger(targetClassId) || targetClassId <= 0)) {
            return res.status(400).json({ success: false, message: "Choose a valid class for this campaign." });
        }
        if (audienceType === "class") {
            const { data: targetClass, error: classError } = await supabase
                .from("classes")
                .select("id")
                .eq("id", targetClassId)
                .eq("school_id", schoolId)
                .maybeSingle();
            if (classError) throw classError;
            if (!targetClass) return res.status(400).json({ success: false, message: "The selected class does not belong to this school." });
        }
        if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
            return res.status(400).json({ success: false, message: "Enter a valid scheduled date and time." });
        }

        const { data, error } = await supabase
            .from("marketing_campaigns")
            .insert({
                school_id: schoolId,
                title,
                message,
                platforms,
                audience_type: audienceType,
                target_class_id: targetClassId,
                status: scheduledAt ? "scheduled" : "draft",
                scheduled_at: scheduledAt?.toISOString() || null,
                created_by: req.user.id
            })
            .select("id, title, message, platforms, audience_type, target_class_id, status, scheduled_at, created_at")
            .single();
        if (error) throw error;
        return res.status(201).json({ success: true, campaign: data });
    } catch (error) {
        console.error("DIGITAL MARKETING CREATE CAMPAIGN ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to save this campaign. Please try again." });
    }
});

export default router;
