import { getUserAccess } from "../services/permissionService.js";

/**
 * Resolve school ownership from the authenticated database profile.
 * Never trust a school_id supplied by a non-Super-Admin request.
 */
export const requireSchoolContext = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const access = await getUserAccess(req.user.id);
        const profile = access?.profile;

        if (!profile) {
            return res.status(403).json({
                success: false,
                message: "Your system profile could not be found."
            });
        }

        const isSuperAdmin = access.isSuperAdmin === true;
        const schoolId = profile.school_id == null
            ? null
            : Number(profile.school_id);

        if (!isSuperAdmin && (!Number.isInteger(schoolId) || schoolId <= 0)) {
            return res.status(403).json({
                success: false,
                message: "Your account is not assigned to a valid school."
            });
        }

        const requestedIds = [
            req.query?.school_id,
            req.body?.school_id
        ].filter(value => value !== undefined && value !== null && value !== "");

        if (!isSuperAdmin && requestedIds.some(value => Number(value) !== schoolId)) {
            return res.status(403).json({
                success: false,
                message: "You can only access data belonging to your own school."
            });
        }

        // Controllers must use this profile-derived value, not client metadata.
        req.user.school_id = isSuperAdmin ? null : schoolId;
        req.schoolContext = {
            schoolId,
            isSuperAdmin,
            profileId: profile.id
        };

        return next();
    } catch (error) {
        console.error("SCHOOL CONTEXT MIDDLEWARE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to verify your school access."
        });
    }
};
