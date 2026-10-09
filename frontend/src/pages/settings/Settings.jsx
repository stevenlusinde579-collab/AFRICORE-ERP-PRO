import React, { useEffect, useState } from "react";
import {
    Building2,
    FileText,
    Save,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Settings as SettingsIcon,
    MapPin,
    Phone,
    Mail,
    Hash,
    Image as ImageIcon,
    CalendarDays,
    Users,
    ArrowRight,
    UserRound,
    ShieldCheck,
    LogOut,
    Eye,
    EyeOff,
    KeyRound,
    Smartphone,
    MailCheck,
} from "lucide-react";

import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";


const PromotionMetric = ({ label, value }) => (
    <div className="rounded-xl border border-emerald-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
        </p>
        <p className="mt-1 text-2xl font-black text-slate-800">
            {Number(value) || 0}
        </p>
    </div>
);


function Settings() {
    const {
        refreshSchool,
        academicYears,
        activeAcademicYear,
        refreshAcademicYear,
    } = useSchool();

    // =====================================================
    // USER / PROFILE
    // =====================================================

    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);

    // =====================================================
    // PERSONAL ACCOUNT
    // =====================================================

    const [profileForm, setProfileForm] = useState({
        full_name: "",
        phone: "",
    });

    const [passwordForm, setPasswordForm] = useState({
        current_password: "",
        new_password: "",
        confirm_password: "",
    });

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    // =====================================================
    // SCHOOL
    // =====================================================

    const [school, setSchool] = useState(null);

    const [schoolForm, setSchoolForm] = useState({
        school_name: "",
        registration_number: "",
        address: "",
        phone: "",
        email: "",
        logo: "",
    });

    // =====================================================
    // DOCUMENT SETTINGS
    // =====================================================

    const [documentSettings, setDocumentSettings] = useState({
        show_school_name: true,
        show_logo: true,
        show_registration_number: true,
        show_address: true,
        show_phone: true,
        show_email: true,
    });

    // =====================================================
    // ACADEMIC YEAR SETTINGS
    // =====================================================

    const nextCalendarYear = new Date().getFullYear() + 1;

    const [academicYearForm, setAcademicYearForm] = useState({
        year_name: String(nextCalendarYear),
        term: "ANNUAL",
        start_date: `${nextCalendarYear}-01-01`,
        end_date: `${nextCalendarYear}-12-31`,
    });

    const [savingAcademicYear, setSavingAcademicYear] = useState(false);
    const [promotionResult, setPromotionResult] = useState(null);

    // =====================================================
    // UI STATES
    // =====================================================

    const [loading, setLoading] = useState(true);
    const [savingSchool, setSavingSchool] = useState(false);
    const [savingDocuments, setSavingDocuments] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // =====================================================
    // SETTINGS ACCESS POLICY
    // =====================================================
    // Role 1: Super Admin
    // Role 2: Headmaster
    // Role 3: Deputy Headmaster
    // Role 4: Academic Master
    //
    // Other roles may access personal settings only.
    // =====================================================

    const SCHOOL_SETTINGS_ROLE_IDS = [1, 2, 3, 4];

    const currentRoleId = Number(profile?.role_id);

    const canManageSchoolSettings =
        SCHOOL_SETTINGS_ROLE_IDS.includes(currentRoleId);

    const roleDisplayName = {
        1: "Super Admin",
        2: "Headmaster",
        3: "Deputy Headmaster",
        4: "Academic Master",
    }[currentRoleId] || (
        profile?.role_id
            ? `Role #${profile.role_id}`
            : "No role assigned"
    );

    // =====================================================
    // LOAD SETTINGS
    // =====================================================

    useEffect(() => {
        loadSettings();
    }, []);

    // =====================================================
    // LOAD CURRENT USER AND PROFILE
    // =====================================================

    const loadSettings = async () => {
        try {
            setLoading(true);
            setError("");
            setMessage("");

            const {
                data: { user: currentUser },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                throw userError;
            }

            if (!currentUser) {
                throw new Error("You are not logged in.");
            }

            setUser(currentUser);

            const {
                data: profileData,
                error: profileError,
            } = await supabase
                .from("profiles")
                .select(`
                    id,
                    full_name,
                    phone,
                    school_id,
                    role_id
                `)
                .eq("id", currentUser.id)
                .maybeSingle();

            if (profileError) {
                throw profileError;
            }

            setProfile(profileData);

            setProfileForm({
                full_name: profileData?.full_name || "",
                phone: profileData?.phone || "",
            });

            const schoolId = profileData?.school_id || null;

            if (schoolId) {
                await loadSchool(schoolId);
            } else {
                setSchool(null);

                setSchoolForm({
                    school_name: "",
                    registration_number: "",
                    address: "",
                    phone: "",
                    email: "",
                    logo: "",
                });
            }
        } catch (err) {
            console.error("LOAD SETTINGS ERROR:", err);

            setError(
                err?.message ||
                "Failed to load system settings."
            );
        } finally {
            setLoading(false);
        }
    };

    // =====================================================
    // LOAD SCHOOL
    // =====================================================

    const loadSchool = async (schoolId) => {
        const {
            data,
            error: schoolError,
        } = await supabase
            .from("schools")
            .select(`
                id,
                school_name,
                registration_number,
                address,
                phone,
                email,
                logo,
                show_school_name,
                show_logo,
                show_registration_number,
                show_address,
                show_phone,
                show_email
            `)
            .eq("id", schoolId)
            .maybeSingle();

        if (schoolError) {
            throw schoolError;
        }

        if (!data) {
            setSchool(null);
            return;
        }

        setSchool(data);

        setSchoolForm({
            school_name: data.school_name || "",
            registration_number: data.registration_number || "",
            address: data.address || "",
            phone: data.phone || "",
            email: data.email || "",
            logo: data.logo || "",
        });

        setDocumentSettings({
            show_school_name: data.show_school_name ?? true,
            show_logo: data.show_logo ?? true,
            show_registration_number:
                data.show_registration_number ?? true,
            show_address: data.show_address ?? true,
            show_phone: data.show_phone ?? true,
            show_email: data.show_email ?? true,
        });
    };

    // =====================================================
    // LOAD ACADEMIC YEAR SETTINGS
    // =====================================================

    const loadAcademicYearSettings = async (schoolId) => {
        if (!schoolId) {
            return [];
        }

        try {
            const {
                data,
                error: academicYearError,
            } = await supabase
                .from("academic_years")
                .select(`
                    id,
                    school_id,
                    year_name,
                    term,
                    start_date,
                    end_date,
                    is_active,
                    created_at
                `)
                .eq("school_id", schoolId)
                .order("id", {
                    ascending: false,
                });

            if (academicYearError) {
                throw academicYearError;
            }

            return data || [];
        } catch (err) {
            console.error("LOAD ACADEMIC YEARS ERROR:", err);
            throw err;
        }
    };

    // =====================================================
    // ACADEMIC YEAR FORM CHANGE
    // =====================================================

    const handleAcademicYearChange = (event) => {
        const { name, value } = event.target;

        setAcademicYearForm((previous) => ({
            ...previous,
            [name]: value,
        }));

        setPromotionResult(null);
        setError("");
        setMessage("");
    };

    // =====================================================
    // CREATE / ACTIVATE ACADEMIC YEAR
    // =====================================================

    const saveAcademicYear = async (event) => {
        event.preventDefault();

        // UI-level authorization check.
        // Database/RPC permissions must also enforce this policy.
        if (!canManageSchoolSettings) {
            setError(
                "Only Super Admin, Headmaster, Deputy Headmaster and Academic Master can activate an academic year."
            );
            return;
        }

        try {
            setSavingAcademicYear(true);
            setError("");
            setMessage("");
            setPromotionResult(null);

            if (!school?.id) {
                throw new Error(
                    "Please complete School Setup first."
                );
            }

            // Confirm that the current role is one of the four
            // explicitly authorized management roles.
            const {
                data: activationRoles,
                error: activationRolesError,
            } = await supabase
                .from("roles")
                .select("id, role_name");

            if (activationRolesError) {
                throw activationRolesError;
            }

            const allowedActivationRoles = new Set([
                "super admin",
                "headmaster",
                "deputy headmaster",
                "academic master",
            ]);

            const currentRole = (activationRoles || []).find(
                (role) =>
                    Number(role.id) === Number(profile?.role_id)
            );

            const normalizedRoleName = String(
                currentRole?.role_name || ""
            )
                .trim()
                .toLowerCase();

            if (
                !allowedActivationRoles.has(normalizedRoleName)
            ) {
                throw new Error(
                    "Only Super Admin, Headmaster, Deputy Headmaster and Academic Master can activate an academic year."
                );
            }

            const yearName = String(
                academicYearForm.year_name || ""
            ).trim();

            if (!/^\d{4}$/.test(yearName)) {
                throw new Error(
                    "Academic year must be a 4-digit year, for example 2027."
                );
            }

            if (!academicYearForm.start_date) {
                throw new Error(
                    "Academic year start date is required."
                );
            }

            if (!academicYearForm.end_date) {
                throw new Error(
                    "Academic year end date is required."
                );
            }

            if (
                new Date(academicYearForm.end_date) <
                new Date(academicYearForm.start_date)
            ) {
                throw new Error(
                    "Academic year end date cannot be earlier than start date."
                );
            }

            let {
                data: existingYear,
                error: existingYearError,
            } = await supabase
                .from("academic_years")
                .select(`
                    id,
                    school_id,
                    year_name,
                    term,
                    start_date,
                    end_date,
                    is_active
                `)
                .eq("school_id", school.id)
                .eq("year_name", yearName)
                .maybeSingle();

            if (existingYearError) {
                throw existingYearError;
            }

            if (existingYear) {
                const {
                    data: updatedYear,
                    error: updateYearError,
                } = await supabase
                    .from("academic_years")
                    .update({
                        term: "ANNUAL",
                        start_date: academicYearForm.start_date,
                        end_date: academicYearForm.end_date,
                    })
                    .eq("id", existingYear.id)
                    .select(`
                        id,
                        school_id,
                        year_name,
                        term,
                        start_date,
                        end_date,
                        is_active
                    `)
                    .single();

                if (updateYearError) {
                    throw updateYearError;
                }

                existingYear = updatedYear;
            } else {
                const {
                    data: insertedYear,
                    error: insertYearError,
                } = await supabase
                    .from("academic_years")
                    .insert({
                        school_id: school.id,
                        year_name: yearName,
                        term: "ANNUAL",
                        start_date: academicYearForm.start_date,
                        end_date: academicYearForm.end_date,
                        is_active: false,
                    })
                    .select(`
                        id,
                        school_id,
                        year_name,
                        term,
                        start_date,
                        end_date,
                        is_active
                    `)
                    .single();

                if (insertYearError) {
                    throw insertYearError;
                }

                existingYear = insertedYear;
            }

            const {
                data: promotionData,
                error: promotionError,
            } = await supabase.rpc(
                "activate_academic_year",
                {
                    p_school_id: Number(school.id),
                    p_academic_year_id: Number(existingYear.id),
                }
            );

            if (promotionError) {
                throw promotionError;
            }

            setPromotionResult(promotionData || null);

            await refreshAcademicYear();

            const promoted = Number(
                promotionData?.promoted_students || 0
            );

            const manual = Number(
                promotionData?.terminal_or_manual_students || 0
            );

            const restored = Number(
                promotionData?.restored_students || 0
            );

            const reactivated = Number(
                promotionData?.reactivated_students || 0
            );

            if (promotionData?.operation === "rollback") {
                setMessage(
                    `Academic Year ${yearName} restored successfully. ${restored} historical student record(s) restored and ${reactivated} student(s) reactivated for this year.`
                );
            } else {
                setMessage(
                    `Academic Year ${yearName} activated successfully. ${promoted} continuing student(s) promoted automatically${manual ? `; ${manual} student(s) need manual review.` : "."}`
                );
            }
        } catch (err) {
            console.error("SAVE ACADEMIC YEAR ERROR:", err);

            setError(
                err?.message ||
                "Failed to activate academic year."
            );
        } finally {
            setSavingAcademicYear(false);
        }
    };

    // =====================================================
    // PERSONAL PROFILE FORM CHANGE
    // =====================================================

    const handleProfileChange = (event) => {
        const { name, value } = event.target;

        setProfileForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    // =====================================================
    // PASSWORD FORM CHANGE
    // =====================================================

    const handlePasswordChange = (event) => {
        const { name, value } = event.target;

        setPasswordForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    // =====================================================
    // SAVE PERSONAL PROFILE
    // =====================================================

    const saveProfile = async (event) => {
        event.preventDefault();

        try {
            setSavingProfile(true);
            setError("");
            setMessage("");

            if (!user?.id) {
                throw new Error("You are not logged in.");
            }

            const fullName = profileForm.full_name.trim();

            if (!fullName) {
                setError("Full name is required.");
                return;
            }

            const {
                data,
                error: profileUpdateError,
            } = await supabase
                .from("profiles")
                .update({
                    full_name: fullName,
                    phone: profileForm.phone.trim() || null,
                })
                .eq("id", user.id)
                .select("id, full_name, phone, school_id, role_id")
                .single();

            if (profileUpdateError) {
                throw profileUpdateError;
            }

            setProfile(data);

            setProfileForm({
                full_name: data?.full_name || "",
                phone: data?.phone || "",
            });

            setMessage(
                "Your personal profile was updated successfully."
            );
        } catch (err) {
            console.error("SAVE PROFILE ERROR:", err);

            setError(
                err?.message ||
                "Failed to update your personal profile."
            );
        } finally {
            setSavingProfile(false);
        }
    };

    // =====================================================
    // CHANGE PASSWORD
    // =====================================================

    const changePassword = async (event) => {
        event.preventDefault();

        try {
            setChangingPassword(true);
            setError("");
            setMessage("");

            const currentPassword =
                passwordForm.current_password;

            const newPassword =
                passwordForm.new_password;

            const confirmPassword =
                passwordForm.confirm_password;

            const email = user?.email || "";

            if (!email) {
                throw new Error(
                    "Your account does not have an email address available for password verification."
                );
            }

            if (
                !currentPassword ||
                !newPassword ||
                !confirmPassword
            ) {
                throw new Error(
                    "Please complete all password fields."
                );
            }

            if (newPassword.length < 6) {
                throw new Error(
                    "New password must be at least 6 characters long."
                );
            }

            if (newPassword !== confirmPassword) {
                throw new Error(
                    "New password and confirmation password do not match."
                );
            }

            if (currentPassword === newPassword) {
                throw new Error(
                    "New password must be different from the current password."
                );
            }

            // Verify the current password first.
            const { error: verifyError } =
                await supabase.auth.signInWithPassword({
                    email,
                    password: currentPassword,
                });

            if (verifyError) {
                throw new Error(
                    "Current password is incorrect."
                );
            }

            // Update the authenticated user's password.
            const { error: updatePasswordError } =
                await supabase.auth.updateUser({
                    password: newPassword,
                });

            if (updatePasswordError) {
                throw updatePasswordError;
            }

            setPasswordForm({
                current_password: "",
                new_password: "",
                confirm_password: "",
            });

            setMessage("Password changed successfully.");
        } catch (err) {
            console.error("CHANGE PASSWORD ERROR:", err);

            setError(
                err?.message ||
                "Failed to change your password."
            );
        } finally {
            setChangingPassword(false);
        }
    };

    // =====================================================
    // LOG OUT
    // =====================================================

    const logout = async () => {
        try {
            setLoggingOut(true);
            setError("");
            setMessage("");

            const { error: signOutError } =
                await supabase.auth.signOut({
                    scope: "local",
                });

            if (signOutError) {
                throw signOutError;
            }

            window.location.href = "/login";
        } catch (err) {
            console.error("LOGOUT ERROR:", err);

            setError(
                err?.message ||
                "Failed to log out. Please try again."
            );

            setLoggingOut(false);
        }
    };

    // =====================================================
    // SCHOOL FORM CHANGE
    // =====================================================

    const handleSchoolChange = (event) => {
        const { name, value } = event.target;

        setSchoolForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    // =====================================================
    // DOCUMENT SETTING CHANGE
    // =====================================================

    const handleDocumentSettingChange = (name) => {
        setDocumentSettings((previous) => ({
            ...previous,
            [name]: !previous[name],
        }));
    };

    // =====================================================
    // SAVE SCHOOL
    // =====================================================

    const saveSchool = async (event) => {
        event.preventDefault();

        if (!canManageSchoolSettings) {
            setError(
                "School Settings are available only to Super Admin, Headmaster, Deputy Headmaster and Academic Master."
            );
            return;
        }

        try {
            setSavingSchool(true);
            setError("");
            setMessage("");

            const schoolName =
                schoolForm.school_name.trim();

            if (!schoolName) {
                setError("School name is required.");
                return;
            }

            // Update an existing school.
            if (school?.id) {
                const {
                    data,
                    error: updateError,
                } = await supabase
                    .from("schools")
                    .update({
                        school_name: schoolName,
                        registration_number:
                            schoolForm.registration_number.trim() || null,
                        address:
                            schoolForm.address.trim() || null,
                        phone:
                            schoolForm.phone.trim() || null,
                        email:
                            schoolForm.email.trim() || null,
                        logo:
                            schoolForm.logo.trim() || null,
                    })
                    .eq("id", school.id)
                    .select()
                    .single();

                if (updateError) {
                    throw updateError;
                }

                setSchool(data);

                await refreshSchool();

                setMessage(
                    "School information updated successfully."
                );
            } else {
                // Create the initial school.
                const {
                    data: { user: currentUser },
                    error: currentUserError,
                } = await supabase.auth.getUser();

                if (currentUserError) {
                    throw currentUserError;
                }

                if (!currentUser) {
                    throw new Error("You are not logged in.");
                }

                const {
                    data,
                    error: insertError,
                } = await supabase
                    .from("schools")
                    .insert({
                        school_name: schoolName,
                        registration_number:
                            schoolForm.registration_number.trim() || null,
                        address:
                            schoolForm.address.trim() || null,
                        phone:
                            schoolForm.phone.trim() || null,
                        email:
                            schoolForm.email.trim() || null,
                        logo:
                            schoolForm.logo.trim() || null,
                        show_school_name: true,
                        show_logo: true,
                        show_registration_number: true,
                        show_address: true,
                        show_phone: true,
                        show_email: true,
                    })
                    .select()
                    .single();

                if (insertError) {
                    throw insertError;
                }

                if (!data?.id) {
                    throw new Error(
                        "School was created but the school ID was not returned."
                    );
                }

                const {
                    error: profileUpdateError,
                } = await supabase
                    .from("profiles")
                    .update({
                        school_id: data.id,
                    })
                    .eq("id", currentUser.id);

                if (profileUpdateError) {
                    throw profileUpdateError;
                }

                setSchool(data);

                setProfile((previous) => ({
                    ...previous,
                    school_id: data.id,
                }));

                setDocumentSettings({
                    show_school_name: true,
                    show_logo: true,
                    show_registration_number: true,
                    show_address: true,
                    show_phone: true,
                    show_email: true,
                });

                await refreshSchool();

                setMessage(
                    "School setup completed successfully."
                );
            }
        } catch (err) {
            console.error("SAVE SCHOOL ERROR:", err);

            setError(
                err?.message ||
                "Failed to save school information."
            );
        } finally {
            setSavingSchool(false);
        }
    };

    // =====================================================
    // SAVE DOCUMENT SETTINGS
    // =====================================================

    const saveDocumentSettings = async () => {
        if (!canManageSchoolSettings) {
            setError(
                "Document Settings are available only to Super Admin, Headmaster, Deputy Headmaster and Academic Master."
            );
            return;
        }

        try {
            setSavingDocuments(true);
            setError("");
            setMessage("");

            if (!school?.id) {
                setError(
                    "Please complete School Setup first."
                );
                return;
            }

            const {
                data,
                error: updateError,
            } = await supabase
                .from("schools")
                .update({
                    show_school_name:
                        documentSettings.show_school_name,
                    show_logo:
                        documentSettings.show_logo,
                    show_registration_number:
                        documentSettings.show_registration_number,
                    show_address:
                        documentSettings.show_address,
                    show_phone:
                        documentSettings.show_phone,
                    show_email:
                        documentSettings.show_email,
                })
                .eq("id", school.id)
                .select()
                .single();

            if (updateError) {
                throw updateError;
            }

            setSchool(data);

            await refreshSchool();

            setMessage(
                "Document settings saved successfully."
            );
        } catch (err) {
            console.error(
                "SAVE DOCUMENT SETTINGS ERROR:",
                err
            );

            setError(
                err?.message ||
                "Failed to save document settings."
            );
        } finally {
            setSavingDocuments(false);
        }
    };

    // =====================================================
    // LOADING SCREEN
    // =====================================================

    if (loading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="flex items-center gap-3 text-slate-600">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Loading system settings...</span>
                </div>
            </div>
        );
    }

    // =====================================================
    // MAIN UI
    // =====================================================

    return (
        <div className="space-y-8">

            {/* PAGE HEADER */}

            <div>
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow">
                        <SettingsIcon className="h-6 w-6" />
                    </div>

                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">
                            System Settings
                        </h1>

                        <p className="mt-1 text-gray-600">
                            Manage your personal AfriCore account,
                            security and authorized school settings.
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                                <UserRound className="h-3.5 w-3.5" />
                                {profile?.full_name ||
                                    user?.email ||
                                    "Current User"}
                            </span>

                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                                    canManageSchoolSettings
                                        ? "bg-purple-50 text-purple-700"
                                        : "bg-emerald-50 text-emerald-700"
                                }`}
                            >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {canManageSchoolSettings
                                    ? "School Settings Access"
                                    : "Personal Settings Access"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* SUCCESS MESSAGE */}

            {message && (
                <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    <p className="text-sm font-medium text-green-700">
                        {message}
                    </p>
                </div>
            )}

            {/* ERROR MESSAGE */}

            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <p className="text-sm font-medium text-red-700">
                        {error}
                    </p>
                </div>
            )}

            {/* PERSONAL ACCOUNT */}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

                {/* PERSONAL PROFILE */}

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                                <UserRound className="h-5 w-5" />
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-slate-800">
                                    My Profile
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Update your personal account information.
                                </p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={saveProfile} className="p-6">
                        <div className="space-y-5">

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-700">
                                    Full Name
                                </label>

                                <div className="relative">
                                    <UserRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                                    <input
                                        type="text"
                                        name="full_name"
                                        value={profileForm.full_name}
                                        onChange={handleProfileChange}
                                        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        placeholder="Your full name"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-700">
                                    Phone Number
                                </label>

                                <div className="relative">
                                    <Smartphone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                                    <input
                                        type="text"
                                        name="phone"
                                        value={profileForm.phone}
                                        onChange={handleProfileChange}
                                        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        placeholder="Your phone number"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <AccountInfo
                                    icon={<MailCheck className="h-4 w-4" />}
                                    label="Login Email"
                                    value={user?.email || "Not available"}
                                />

                                <AccountInfo
                                    icon={<ShieldCheck className="h-4 w-4" />}
                                    label="Current Role"
                                    value={roleDisplayName}
                                />
                            </div>

                            <div className="flex justify-end border-t border-slate-100 pt-5">
                                <button
                                    type="submit"
                                    disabled={savingProfile}
                                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {savingProfile ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <Save className="h-5 w-5" />
                                    )}

                                    {savingProfile
                                        ? "Saving..."
                                        : "Save Profile"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* SECURITY */}

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                                <KeyRound className="h-5 w-5" />
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-slate-800">
                                    Security
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Change your password and protect your account.
                                </p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={changePassword} className="p-6">
                        <div className="space-y-5">

                            <PasswordField
                                label="Current Password"
                                name="current_password"
                                value={passwordForm.current_password}
                                onChange={handlePasswordChange}
                                visible={showCurrentPassword}
                                onToggle={() =>
                                    setShowCurrentPassword((value) => !value)
                                }
                                placeholder="Enter current password"
                            />

                            <PasswordField
                                label="New Password"
                                name="new_password"
                                value={passwordForm.new_password}
                                onChange={handlePasswordChange}
                                visible={showNewPassword}
                                onToggle={() =>
                                    setShowNewPassword((value) => !value)
                                }
                                placeholder="At least 6 characters"
                            />

                            <PasswordField
                                label="Confirm New Password"
                                name="confirm_password"
                                value={passwordForm.confirm_password}
                                onChange={handlePasswordChange}
                                visible={showConfirmPassword}
                                onToggle={() =>
                                    setShowConfirmPassword((value) => !value)
                                }
                                placeholder="Repeat new password"
                            />

                            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

                                    <p className="text-xs leading-5 text-blue-800">
                                        Your current password is verified
                                        before the new password is saved.
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end border-t border-slate-100 pt-5">
                                <button
                                    type="submit"
                                    disabled={changingPassword}
                                    className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {changingPassword ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <KeyRound className="h-5 w-5" />
                                    )}

                                    {changingPassword
                                        ? "Updating..."
                                        : "Change Password"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {/* ACCOUNT SESSION */}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Account Session
                            </p>

                            <h2 className="mt-1 text-xl font-bold text-slate-900">
                                {profile?.full_name ||
                                    user?.email ||
                                    "Current User"}
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Use Logout to end the active AfriCore
                                session on this device.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={logout}
                            disabled={loggingOut}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loggingOut ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <LogOut className="h-5 w-5" />
                            )}

                            {loggingOut ? "Logging out..." : "Log Out"}
                        </button>
                    </div>
                </div>
            </div>

            {/* =====================================================
                ADMINISTRATIVE SETTINGS
                Visible only to role IDs 1, 2, 3 and 4.
            ===================================================== */}

            {canManageSchoolSettings && (
                <>
                    {/* SCHOOL SETUP */}

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                                    <Building2 className="h-5 w-5" />
                                </div>

                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">
                                        School Setup
                                    </h2>

                                    <p className="text-sm text-slate-500">
                                        Configure the main identity of your school.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={saveSchool} className="p-6">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

                                {/* SCHOOL NAME */}

                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        School Name
                                        <span className="ml-1 text-red-500">
                                            *
                                        </span>
                                    </label>

                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                                        <input
                                            type="text"
                                            name="school_name"
                                            value={schoolForm.school_name}
                                            onChange={handleSchoolChange}
                                            placeholder="Enter school name"
                                            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* REGISTRATION NUMBER */}

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Registration Number
                                    </label>

                                    <div className="relative">
                                        <Hash className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                                        <input
                                            type="text"
                                            name="registration_number"
                                            value={schoolForm.registration_number}
                                            onChange={handleSchoolChange}
                                            placeholder="School registration number"
                                            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                </div>

                                {/* PHONE */}

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Phone
                                    </label>

                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                                        <input
                                            type="text"
                                            name="phone"
                                            value={schoolForm.phone}
                                            onChange={handleSchoolChange}
                                            placeholder="School phone number"
                                            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                </div>

                                {/* ADDRESS */}

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Address
                                    </label>

                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-3 h-5 w-5 text-slate-400" />

                                        <textarea
                                            name="address"
                                            value={schoolForm.address}
                                            onChange={handleSchoolChange}
                                            placeholder="School address"
                                            rows="3"
                                            className="w-full resize-none rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                </div>

                                {/* EMAIL */}

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Email
                                    </label>

                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                                        <input
                                            type="email"
                                            name="email"
                                            value={schoolForm.email}
                                            onChange={handleSchoolChange}
                                            placeholder="school@example.com"
                                            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                </div>

                                {/* LOGO URL */}

                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        School Logo
                                    </label>

                                    <div className="relative">
                                        <ImageIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                                        <input
                                            type="text"
                                            name="logo"
                                            value={schoolForm.logo}
                                            onChange={handleSchoolChange}
                                            placeholder="Logo URL"
                                            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>

                                    <p className="mt-2 text-xs text-slate-500">
                                        Logo upload/storage will be connected
                                        to the AfriCore school branding system
                                        separately.
                                    </p>
                                </div>
                            </div>

                            {/* SAVE SCHOOL */}

                            <div className="mt-6 flex justify-end border-t border-slate-100 pt-6">
                                <button
                                    type="submit"
                                    disabled={savingSchool}
                                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {savingSchool ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-5 w-5" />
                                            Save School Information
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* DOCUMENT SETTINGS */}

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                                    <FileText className="h-5 w-5" />
                                </div>

                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">
                                        Document Settings
                                    </h2>

                                    <p className="text-sm text-slate-500">
                                        Decide which school information should
                                        appear on system documents.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            {!school ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />

                                        <div>
                                            <h3 className="font-semibold text-amber-800">
                                                School Setup Required
                                            </h3>

                                            <p className="mt-1 text-sm text-amber-700">
                                                Complete School Setup first.
                                                Document settings will become
                                                available after the school has
                                                been created.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <DocumentSetting
                                            icon={<Building2 className="h-5 w-5" />}
                                            title="Show School Name"
                                            description="ON: documents use your school name. OFF: documents use AfriCore ERP."
                                            value={documentSettings.show_school_name}
                                            onChange={() =>
                                                handleDocumentSettingChange(
                                                    "show_school_name"
                                                )
                                            }
                                        />

                                        <DocumentSetting
                                            icon={<ImageIcon className="h-5 w-5" />}
                                            title="Show School Logo"
                                            description="Display the school logo on documents."
                                            value={documentSettings.show_logo}
                                            onChange={() =>
                                                handleDocumentSettingChange(
                                                    "show_logo"
                                                )
                                            }
                                        />

                                        <DocumentSetting
                                            icon={<Hash className="h-5 w-5" />}
                                            title="Show Registration Number"
                                            description="Display the school registration number."
                                            value={documentSettings.show_registration_number}
                                            onChange={() =>
                                                handleDocumentSettingChange(
                                                    "show_registration_number"
                                                )
                                            }
                                        />

                                        <DocumentSetting
                                            icon={<MapPin className="h-5 w-5" />}
                                            title="Show Address"
                                            description="Display the school address."
                                            value={documentSettings.show_address}
                                            onChange={() =>
                                                handleDocumentSettingChange(
                                                    "show_address"
                                                )
                                            }
                                        />

                                        <DocumentSetting
                                            icon={<Phone className="h-5 w-5" />}
                                            title="Show Phone"
                                            description="Display the school phone number."
                                            value={documentSettings.show_phone}
                                            onChange={() =>
                                                handleDocumentSettingChange(
                                                    "show_phone"
                                                )
                                            }
                                        />

                                        <DocumentSetting
                                            icon={<Mail className="h-5 w-5" />}
                                            title="Show Email"
                                            description="Display the school email address."
                                            value={documentSettings.show_email}
                                            onChange={() =>
                                                handleDocumentSettingChange(
                                                    "show_email"
                                                )
                                            }
                                        />
                                    </div>

                                    {/* SAVE DOCUMENT SETTINGS */}

                                    <div className="mt-6 flex justify-end border-t border-slate-100 pt-6">
                                        <button
                                            type="button"
                                            onClick={saveDocumentSettings}
                                            disabled={savingDocuments}
                                            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {savingDocuments ? (
                                                <>
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="h-5 w-5" />
                                                    Save Document Settings
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ACADEMIC YEAR SETTINGS */}

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                                    <CalendarDays className="h-5 w-5" />
                                </div>

                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">
                                        Academic Year Settings
                                    </h2>

                                    <p className="text-sm text-slate-500">
                                        Activate a new academic year and
                                        automatically move continuing students
                                        to the next class.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            {!school ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />

                                        <div>
                                            <h3 className="font-semibold text-amber-800">
                                                School Setup Required
                                            </h3>

                                            <p className="mt-1 text-sm text-amber-700">
                                                Complete School Setup first
                                                before configuring the academic year.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                                                    <CalendarDays className="h-5 w-5" />
                                                </div>

                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        Current Academic Year
                                                    </p>

                                                    <p className="mt-1 text-xl font-bold text-slate-800">
                                                        {activeAcademicYear?.year_name || "Not set"}
                                                    </p>

                                                    <p className="text-sm text-slate-500">
                                                        {activeAcademicYear?.term || "-"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                                                    <Users className="h-5 w-5" />
                                                </div>

                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                                        Automatic Promotion
                                                    </p>

                                                    <p className="mt-1 text-sm font-semibold text-emerald-900">
                                                        Continuing students move automatically
                                                    </p>

                                                    <p className="text-xs text-emerald-700">
                                                        New admissions remain new records in the active year.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <form
                                        onSubmit={saveAcademicYear}
                                        className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white shadow-sm"
                                    >
                                        <div className="mb-5 flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
                                                <CalendarDays className="h-5 w-5" />
                                            </div>

                                            <div>
                                                <h3 className="font-bold">
                                                    Create / Switch Academic Year
                                                </h3>

                                                <p className="text-xs text-slate-400">
                                                    Example: enter a new year to promote students,
                                                    or enter an existing older year to restore that
                                                    year from Academic History.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                            <div>
                                                <label className="mb-2 block text-sm font-semibold text-slate-200">
                                                    Academic Year
                                                </label>

                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    name="year_name"
                                                    maxLength={4}
                                                    value={academicYearForm.year_name}
                                                    onChange={handleAcademicYearChange}
                                                    placeholder="2027"
                                                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                    required
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-sm font-semibold text-slate-200">
                                                    Start Date
                                                </label>

                                                <input
                                                    type="date"
                                                    name="start_date"
                                                    value={academicYearForm.start_date}
                                                    onChange={handleAcademicYearChange}
                                                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                    required
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-sm font-semibold text-slate-200">
                                                    End Date
                                                </label>

                                                <input
                                                    type="date"
                                                    name="end_date"
                                                    value={academicYearForm.end_date}
                                                    onChange={handleAcademicYearChange}
                                                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-4">
                                            <div className="flex items-start gap-3">
                                                <ArrowRight className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />

                                                <div className="text-sm text-slate-300">
                                                    <p className="font-semibold text-white">
                                                        What happens when you create or switch the year?
                                                    </p>

                                                    <p className="mt-1">
                                                        When moving forward, continuing students are
                                                        promoted automatically and final-class students
                                                        (Standard 7, Form 4 or Form 6) become Inactive.
                                                        When returning to an older year, the system
                                                        restores the student class/status from Academic
                                                        History so finalist students become Active again
                                                        in the year they actually studied.
                                                    </p>

                                                    <p className="mt-2">
                                                        Your existing student record is kept; the system
                                                        does not create a duplicate student. Only
                                                        genuinely new students need to be registered.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-5 flex justify-end">
                                            <button
                                                type="submit"
                                                disabled={savingAcademicYear}
                                                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {savingAcademicYear ? (
                                                    <>
                                                        <Loader2 className="h-5 w-5 animate-spin" />
                                                        Activating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="h-5 w-5" />
                                                        Save & Activate Academic Year
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </form>

                                    {promotionResult && (
                                        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                                            <div className="flex items-start gap-3">
                                                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />

                                                <div className="w-full">
                                                    <h3 className="font-bold text-emerald-900">
                                                        Academic Year Activated
                                                    </h3>

                                                    <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                                                        <PromotionMetric
                                                            label={
                                                                promotionResult.operation === "rollback"
                                                                    ? "Restored"
                                                                    : "Promoted"
                                                            }
                                                            value={
                                                                promotionResult.operation === "rollback"
                                                                    ? promotionResult.restored_students
                                                                    : promotionResult.promoted_students
                                                            }
                                                        />

                                                        <PromotionMetric
                                                            label={
                                                                promotionResult.operation === "rollback"
                                                                    ? "Reactivated"
                                                                    : "Terminal / Manual"
                                                            }
                                                            value={
                                                                promotionResult.operation === "rollback"
                                                                    ? promotionResult.reactivated_students
                                                                    : promotionResult.terminal_or_manual_students
                                                            }
                                                        />

                                                        <PromotionMetric
                                                            label={
                                                                promotionResult.operation === "rollback"
                                                                    ? "Inactive in Selected Year"
                                                                    : "Legacy Captured"
                                                            }
                                                            value={
                                                                promotionResult.operation === "rollback"
                                                                    ? promotionResult.rollback_inactive_students
                                                                    : promotionResult.legacy_students_snapshotted
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {academicYears.length > 0 && (
                                        <div className="mt-6">
                                            <div className="mb-3 flex items-center justify-between">
                                                <h3 className="text-sm font-bold text-slate-800">
                                                    Academic Year History
                                                </h3>

                                                <span className="text-xs text-slate-500">
                                                    {academicYears.length} year record(s)
                                                </span>
                                            </div>

                                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                                <table className="min-w-full text-sm">
                                                    <thead className="bg-slate-50">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left font-semibold text-slate-600">
                                                                Year
                                                            </th>
                                                            <th className="px-4 py-3 text-left font-semibold text-slate-600">
                                                                Term
                                                            </th>
                                                            <th className="px-4 py-3 text-left font-semibold text-slate-600">
                                                                Start
                                                            </th>
                                                            <th className="px-4 py-3 text-left font-semibold text-slate-600">
                                                                End
                                                            </th>
                                                            <th className="px-4 py-3 text-left font-semibold text-slate-600">
                                                                Status
                                                            </th>
                                                        </tr>
                                                    </thead>

                                                    <tbody>
                                                        {academicYears.map((year) => (
                                                            <tr
                                                                key={year.id}
                                                                className="border-t border-slate-100"
                                                            >
                                                                <td className="px-4 py-3 font-semibold text-slate-800">
                                                                    {year.year_name}

                                                                    {year.school_id === null && (
                                                                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                                                                            Global
                                                                        </span>
                                                                    )}
                                                                </td>

                                                                <td className="px-4 py-3 text-slate-600">
                                                                    {year.term || "-"}
                                                                </td>

                                                                <td className="px-4 py-3 text-slate-600">
                                                                    {year.start_date || "-"}
                                                                </td>

                                                                <td className="px-4 py-3 text-slate-600">
                                                                    {year.end_date || "-"}
                                                                </td>

                                                                <td className="px-4 py-3">
                                                                    {(
                                                                        Number(year.school_id) ===
                                                                            Number(school.id) &&
                                                                        year.is_active
                                                                    ) || (
                                                                        year.school_id === null &&
                                                                        year.is_active &&
                                                                        !activeAcademicYear?.school_id
                                                                    ) ? (
                                                                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                                                            Active
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs text-slate-400">
                                                                            Inactive
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* CURRENT SCHOOL PREVIEW */}

                    {school && (
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                                    <Building2 className="h-6 w-6" />
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                                        Current School
                                    </p>

                                    <h3 className="mt-1 text-xl font-bold text-slate-800">
                                        {school.school_name}
                                    </h3>

                                    {school.registration_number && (
                                        <p className="mt-1 text-sm text-slate-600">
                                            Registration:{" "}
                                            {school.registration_number}
                                        </p>
                                    )}

                                    <p className="mt-2 text-sm text-slate-600">
                                        This school identity will be used
                                        throughout the AfriCore ERP system.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}


// =============================================================
// ACCOUNT INFO COMPONENT
// =============================================================

function AccountInfo({ icon, label, value }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {icon}
                {label}
            </div>

            <p className="mt-2 break-words text-sm font-semibold text-slate-800">
                {value || "Not provided"}
            </p>
        </div>
    );
}


// =============================================================
// PASSWORD FIELD COMPONENT
// =============================================================

function PasswordField({
    label,
    name,
    value,
    onChange,
    visible,
    onToggle,
    placeholder,
}) {
    return (
        <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
                {label}
            </label>

            <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                <input
                    type={visible ? "text" : "password"}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    autoComplete={
                        name === "current_password"
                            ? "current-password"
                            : "new-password"
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-12 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                />

                <button
                    type="button"
                    onClick={onToggle}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={
                        visible
                            ? `Hide ${label}`
                            : `Show ${label}`
                    }
                >
                    {visible ? (
                        <EyeOff className="h-4 w-4" />
                    ) : (
                        <Eye className="h-4 w-4" />
                    )}
                </button>
            </div>
        </div>
    );
}


// =============================================================
// DOCUMENT SETTING COMPONENT
// =============================================================

function DocumentSetting({
    icon,
    title,
    description,
    value,
    onChange,
}) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    {icon}
                </div>

                <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                        {title}
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                        {description}
                    </p>
                </div>
            </div>

            {/* YES / NO SWITCH */}

            <button
                type="button"
                onClick={onChange}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
                    value
                        ? "bg-green-600"
                        : "bg-slate-300"
                }`}
                aria-label={title}
                aria-pressed={Boolean(value)}
            >
                <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        value
                            ? "translate-x-6"
                            : "translate-x-1"
                    }`}
                />
            </button>
        </div>
    );
}


export default Settings;