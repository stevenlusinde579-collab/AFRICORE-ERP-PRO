import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Activity,
    ArrowRight,
    Bell,
    CalendarDays,
    Check,
    CheckCircle2,
    CircleUserRound,
    Clock3,
    FileCheck2,
    FileText,
    Mail,
    MessageCircle,
    MessageSquare,
    Megaphone,
    RefreshCw,
    Radio,
    Send,
    ShieldCheck,
    Smartphone,
    Users,
    Video,
    X,
    BarChart3,
    UserCheck,
    Settings2,
    ClipboardList,
    Plus,
    Printer,
    Download,
    MapPin,
    CalendarCheck2,
    UserRoundCheck,
    Ban,
    Lightbulb,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import api from "../../services/api";
import { useSchool } from "../../context/SchoolContext";

const APPROVER_ROLE_IDS = [1, 2, 3, 4];
const TEACHER_ROLE_IDS = [5, 12, 13, 14, 15, 16, 17];

const getProfileAvatarUrl = (profileId) => {
    if (!profileId) return "";
    const { data } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(`${profileId}/avatar`);
    return data?.publicUrl ? `${data.publicUrl}?v=${Date.now()}` : "";
};

const Communication = () => {
    const navigate = useNavigate();
    const {
        schoolName,
        logo,
        registrationNumber,
        address,
        phone,
        email,
        showSchoolName,
        showLogo,
        showRegistrationNumber,
        showAddress,
        showPhone,
        showEmail,
    } = useSchool();

    const [currentUser, setCurrentUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [users, setUsers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [meetings, setMeetings] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [officeRequests, setOfficeRequests] = useState([]);
    const [requesterProfiles, setRequesterProfiles] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [activePanel, setActivePanel] = useState("");
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);
    const [officeSaving, setOfficeSaving] = useState(false);
    const [officeResult, setOfficeResult] = useState(null);
    const [approvalRequest, setApprovalRequest] = useState(null);
    const [approvalReason, setApprovalReason] = useState("");

    const [composer, setComposer] = useState({
        channel: "",
        recipient: "",
        parent_name: "",
        student_id: "",
        exam_id: "",
        subject: "",
        message: "",
    });

    const emptyPermissionForm = useMemo(() => ({
        permission_type: "Personal Permission",
        reason: "",
        start_date: "",
        start_time: "",
        end_date: "",
        end_time: "",
        destination: "",
        expected_return: "",
        parent_guardian_name: "",
        parent_guardian_phone: "",
    }), []);

    const [permissionForm, setPermissionForm] = useState(emptyPermissionForm);

    const roleName = profile?.roles?.role_name || "No role assigned";
    const isApprover = APPROVER_ROLE_IDS.includes(Number(profile?.role_id));
    const isStudent = Number(profile?.role_id) === 10;
    const isTeacher = Boolean(profile?.teacher_id) || TEACHER_ROLE_IDS.includes(Number(profile?.role_id));
    const requesterType = isStudent ? "student" : isTeacher ? "teacher" : "staff";

    const documentBrandName = showSchoolName && schoolName ? schoolName : "AfriCore ERP";

    const loadCurrentUser = useCallback(async () => {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = data?.user || null;
        setCurrentUser(user);
        if (!user?.id) {
            setProfile(null);
            return null;
        }
        const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select(`id, full_name, phone, role_id, school_id, teacher_id, employee_id, created_at, roles (id, role_name, description)`)
            .eq("id", user.id)
            .maybeSingle();
        if (profileError) throw profileError;
        const nextProfile = profileData ? { ...profileData, avatar_url: getProfileAvatarUrl(profileData.id) } : null;
        setProfile(nextProfile);
        return nextProfile;
    }, []);

    const loadUsers = useCallback(async (schoolId) => {
        let query = supabase
            .from("profiles")
            .select(`id, full_name, phone, role_id, school_id, teacher_id, employee_id, created_at, roles (id, role_name, description)`)
            .order("full_name", { ascending: true });
        if (schoolId !== null && schoolId !== undefined) query = query.eq("school_id", schoolId);
        const { data, error } = await query;
        if (error) throw error;
        setUsers((data || []).map((item) => ({ ...item, avatar_url: getProfileAvatarUrl(item.id) })));
    }, []);

    const loadMessages = useCallback(async (schoolId, userId) => {
        if (!userId) return setMessages([]);
        let query = supabase
            .from("messages")
            .select("id, school_id, sender_id, receiver_id, message_text, message_type, is_read, created_at")
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .order("created_at", { ascending: false })
            .limit(100);
        if (schoolId !== null && schoolId !== undefined) query = query.eq("school_id", schoolId);
        const { data, error } = await query;
        if (error) throw error;
        setMessages(data || []);
    }, []);

    const loadMeetings = useCallback(async (schoolId) => {
        let query = supabase
            .from("meetings")
            .select("id, school_id, title, description, meeting_date, start_time, end_time, meeting_link, platform, created_by, created_at")
            .order("meeting_date", { ascending: true })
            .order("start_time", { ascending: true })
            .limit(100);
        if (schoolId !== null && schoolId !== undefined) query = query.eq("school_id", schoolId);
        const { data, error } = await query;
        if (error) throw error;
        setMeetings(data || []);
    }, []);

    const loadNotifications = useCallback(async (schoolId, userId) => {
        if (!userId) return setNotifications([]);
        let query = supabase
            .from("notifications")
            .select("id, school_id, user_id, title, message, notification_type, is_read, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(100);
        if (schoolId !== null && schoolId !== undefined) query = query.eq("school_id", schoolId);
        const { data, error } = await query;
        if (error) throw error;
        setNotifications(data || []);
    }, []);

    const loadOfficeRequests = useCallback(async (schoolId, userId, canApprove) => {
        if (!schoolId || !userId) {
            setOfficeRequests([]);
            return;
        }
        let query = supabase
            .from("office_permission_requests")
            .select("*")
            .eq("school_id", schoolId)
            .order("created_at", { ascending: false })
            .limit(200);
        if (!canApprove) query = query.eq("requester_profile_id", userId);
        const { data, error } = await query;
        if (error) throw error;
        const requests = data || [];
        setOfficeRequests(requests);

        const ids = [...new Set(requests.map((item) => item.requester_profile_id).filter(Boolean))];
        if (ids.length) {
            const { data: pData, error: pError } = await supabase
                .from("profiles")
                .select("id, full_name, phone, role_id, school_id, teacher_id, employee_id, roles (id, role_name)")
                .in("id", ids);
            if (pError) throw pError;
            const mapped = {};
            (pData || []).forEach((item) => { mapped[item.id] = item; });
            setRequesterProfiles(mapped);
        } else {
            setRequesterProfiles({});
        }
    }, []);

    const loadCommunication = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true); else setLoading(true);
            setError("");
            const userProfile = await loadCurrentUser();
            const schoolId = userProfile?.school_id ?? null;
            const userId = userProfile?.id ?? null;
            const canApprove = APPROVER_ROLE_IDS.includes(Number(userProfile?.role_id));
            await Promise.all([
                loadUsers(schoolId),
                loadMessages(schoolId, userId),
                loadMeetings(schoolId),
                loadNotifications(schoolId, userId),
                loadOfficeRequests(schoolId, userId, canApprove),
            ]);
        } catch (err) {
            console.error("COMMUNICATION CENTER ERROR:", err);
            setError(err?.message || "Unable to load Communication Center.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [loadCurrentUser, loadUsers, loadMessages, loadMeetings, loadNotifications, loadOfficeRequests]);

    useEffect(() => { loadCommunication(); }, [loadCommunication]);

    const stats = useMemo(() => {
        const unreadMessages = messages.filter((m) => m.receiver_id === currentUser?.id && m.is_read === false).length;
        const unreadNotifications = notifications.filter((n) => n.is_read === false).length;
        const pendingPermissions = officeRequests.filter((r) => r.status === "pending").length;
        return { users: users.length, messages: messages.length, unreadMessages, meetings: meetings.length, notifications: notifications.length, unreadNotifications, pendingPermissions };
    }, [users, messages, meetings, notifications, officeRequests, currentUser]);

    const upcomingMeetings = useMemo(() => {
        const now = new Date();
        return meetings.filter((meeting) => {
            if (!meeting.meeting_date) return false;
            const meetingDate = new Date(`${meeting.meeting_date}T${meeting.start_time || "00:00:00"}`);
            return meetingDate >= now;
        }).slice(0, 5);
    }, [meetings]);

    const openComposer = (channel) => {
        setSendResult(null);
        setComposer({ channel, recipient: "", parent_name: "", student_id: "", exam_id: "", subject: channel === "email" ? "AfriCore ERP Communication" : "", message: "" });
        setActivePanel("composer");
    };

    const loadRegisteredParentContact = async () => {
        const studentId = String(composer.student_id || "").trim();
        if (!studentId) return;
        if (!profile?.school_id) {
            setSendResult({ type: "error", message: "Your account is not assigned to a school." });
            return;
        }

        try {
            const { data: student, error: lookupError } = await supabase
                .from("students")
                .select("id, school_id, parent_name, parent_phone, parent_email")
                .eq("id", studentId)
                .eq("school_id", profile.school_id)
                .maybeSingle();

            if (lookupError) throw lookupError;
            if (!student) {
                setComposer((previous) => ({ ...previous, recipient: "", parent_name: "" }));
                setSendResult({ type: "error", message: "Student not found in this school's Student Registration." });
                return;
            }

            const registeredRecipient = composer.channel === "email"
                ? String(student.parent_email || "").trim()
                : String(student.parent_phone || "").trim();

            setComposer((previous) => ({
                ...previous,
                recipient: registeredRecipient,
                parent_name: String(student.parent_name || "").trim(),
            }));

            if (!registeredRecipient) {
                setSendResult({
                    type: "error",
                    message: composer.channel === "email"
                        ? "No parent/guardian email is saved for this student. Update Student Registration first."
                        : "No parent/guardian phone number is saved for this student. Update Student Registration first.",
                });
            } else {
                setSendResult({
                    type: "success",
                    message: "Recipient loaded from this student's registered parent/guardian details.",
                });
            }
        } catch (lookupError) {
            console.error("REGISTERED PARENT CONTACT LOOKUP ERROR:", lookupError);
            setSendResult({ type: "error", message: lookupError?.message || "Could not load the registered parent/guardian contact." });
        }
    };

    const closePanel = () => {
        if (sending || officeSaving) return;
        setActivePanel("");
        setSendResult(null);
        setOfficeResult(null);
        setApprovalRequest(null);
        setApprovalReason("");
    };

    const openPermissionRequest = () => {
        setPermissionForm({ ...emptyPermissionForm });
        setOfficeResult(null);
        setActivePanel("office-request");
    };

    const openMyPermissions = () => setActivePanel("office-requests");
    const openApprovalDesk = () => setActivePanel("office-approval");

    const sendExternalCommunication = async (event) => {
        event.preventDefault();
        setSendResult(null);
        if (!composer.recipient.trim()) return setSendResult({ type: "error", message: composer.channel === "email" ? "Enter the recipient email address." : "Enter the recipient WhatsApp number." });
        if (!composer.message.trim()) return setSendResult({ type: "error", message: "Message is required." });
        if (composer.channel === "email" && !composer.subject.trim()) return setSendResult({ type: "error", message: "Email subject is required." });
        if (composer.channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(composer.recipient.trim())) return setSendResult({ type: "error", message: "Enter a valid email address." });

        // WhatsApp link mode: open WhatsApp with the message pre-filled.
        // The user confirms delivery by pressing Send in WhatsApp.
        if (composer.channel === "whatsapp") {
            let phoneNumber = composer.recipient.trim().replace(/[^\d]/g, "");
            if (phoneNumber.startsWith("00")) phoneNumber = phoneNumber.slice(2);
            if (phoneNumber.startsWith("0")) phoneNumber = "255" + phoneNumber.slice(1);
            else if (!phoneNumber.startsWith("255") && /^[67]\d{8}$/.test(phoneNumber)) phoneNumber = "255" + phoneNumber;

            if (!/^\d{8,15}$/.test(phoneNumber)) {
                return setSendResult({ type: "error", message: "Enter a valid WhatsApp number with country code, e.g. 0712345678 or 255712345678." });
            }

            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(composer.message.trim())}`;
            const whatsappWindow = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
            if (!whatsappWindow) {
                window.location.href = whatsappUrl;
            }
            setSendResult({ type: "success", message: "WhatsApp imefunguliwa na ujumbe umejazwa. Bonyeza Send ndani ya WhatsApp ili ujumbe utumwe." });
            return;
        }

        try {
            setSending(true);
            const response = await api.post("/communication/send", {
                recipient: composer.recipient.trim(),
                channel: composer.channel,
                subject: composer.subject.trim(),
                message: composer.message.trim(),
            });
            const data = response?.data || {};
            if (!data?.success) throw new Error(data?.error || data?.message || "Communication request failed.");
            setSendResult({ type: "success", message: data?.message || "Communication request accepted successfully.", provider: data?.provider || "", status: data?.status || "", history_id: data?.history_id || null });
            setComposer((previous) => ({ ...previous, recipient: "", message: "" }));
        } catch (err) {
            console.error("EXTERNAL COMMUNICATION ERROR:", err);
            setSendResult({ type: "error", message: err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to send communication." });
        } finally { setSending(false); }
    };

    const createOfficePermission = async (event) => {
        event.preventDefault();
        setOfficeResult(null);
        if (!profile?.id || !profile?.school_id) return setOfficeResult({ type: "error", message: "Your account is not assigned to a school." });
        if (!permissionForm.permission_type.trim() || !permissionForm.reason.trim() || !permissionForm.start_date) return setOfficeResult({ type: "error", message: "Permission type, reason and start date are required." });
        if (permissionForm.end_date && permissionForm.end_date < permissionForm.start_date) return setOfficeResult({ type: "error", message: "End date cannot be earlier than start date." });
        try {
            setOfficeSaving(true);
            const year = new Date().getFullYear();
            const random = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase() : Math.random().toString(36).slice(2, 10).toUpperCase();
            const referenceNumber = `PERM-${year}-${random}`;
            let studentId = null;
            let teacherId = profile.teacher_id || null;
            if (isStudent && currentUser?.email) {
                const { data: studentMatch } = await supabase.from("students").select("id").eq("school_id", profile.school_id).eq("email", currentUser.email).maybeSingle();
                studentId = studentMatch?.id || null;
            }
            const payload = {
                school_id: profile.school_id,
                requester_profile_id: profile.id,
                requester_type: requesterType,
                student_id: studentId,
                teacher_id: teacherId,
                permission_type: permissionForm.permission_type.trim(),
                reason: permissionForm.reason.trim(),
                start_date: permissionForm.start_date,
                start_time: permissionForm.start_time || null,
                end_date: permissionForm.end_date || null,
                end_time: permissionForm.end_time || null,
                destination: permissionForm.destination.trim() || null,
                expected_return: permissionForm.expected_return.trim() || null,
                parent_guardian_name: permissionForm.parent_guardian_name.trim() || null,
                parent_guardian_phone: permissionForm.parent_guardian_phone.trim() || null,
                status: "pending",
                reference_number: referenceNumber,
            };
            const { data, error } = await supabase.from("office_permission_requests").insert(payload).select("*").single();
            if (error) throw error;
            setOfficeRequests((previous) => [data, ...previous]);
            setRequesterProfiles((previous) => ({ ...previous, [profile.id]: profile }));
            setOfficeResult({ type: "success", message: `Permission request submitted successfully. Reference: ${referenceNumber}` });
            setPermissionForm({ ...emptyPermissionForm });
        } catch (err) {
            console.error("OFFICE PERMISSION CREATE ERROR:", err);
            setOfficeResult({ type: "error", message: err?.message || "Failed to submit permission request." });
        } finally { setOfficeSaving(false); }
    };

    const updateOfficePermission = async (request, status, rejectionReason = "") => {
        if (!request?.id || !isApprover) return;
        try {
            setOfficeSaving(true);
            const update = { status, approved_by: status === "approved" ? currentUser?.id : null, approved_at: status === "approved" ? new Date().toISOString() : null, rejection_reason: status === "rejected" ? rejectionReason.trim() || "No reason provided." : null };
            const { data, error } = await supabase.from("office_permission_requests").update(update).eq("id", request.id).select("*").single();
            if (error) throw error;
            setOfficeRequests((previous) => previous.map((item) => item.id === request.id ? data : item));
            const requesterId = request.requester_profile_id;
            if (requesterId && requesterId !== currentUser?.id) {
                const notification = {
                    school_id: request.school_id,
                    user_id: requesterId,
                    title: status === "approved" ? "Office Permission Approved" : "Office Permission Rejected",
                    message: status === "approved" ? `Your office permission ${request.reference_number} has been approved.` : `Your office permission ${request.reference_number} was rejected. Reason: ${rejectionReason.trim() || "No reason provided."}`,
                    notification_type: "office_permission",
                    is_read: false,
                };
                await supabase.from("notifications").insert(notification).catch(() => null);
            }
            setOfficeResult({ type: "success", message: status === "approved" ? "Permission approved successfully." : "Permission rejected successfully." });
            setApprovalRequest(null);
            setApprovalReason("");
        } catch (err) {
            console.error("OFFICE PERMISSION UPDATE ERROR:", err);
            setOfficeResult({ type: "error", message: err?.message || "Failed to update permission request." });
        } finally { setOfficeSaving(false); }
    };

    const printPermissionDocument = async (request) => {
        const requester = requesterProfiles[request.requester_profile_id] || (request.requester_profile_id === profile?.id ? profile : null);
        const personName = requester?.full_name || "Authorized Person";
        const role = requester?.roles?.role_name || roleName || request.requester_type;
        const approvedDate = request.approved_at ? new Date(request.approved_at).toLocaleString("en-GB") : "-";
        const start = `${formatDate(request.start_date)}${request.start_time ? ` ${formatTime(request.start_time)}` : ""}`;
        const end = request.end_date || request.end_time ? `${formatDate(request.end_date || request.start_date)}${request.end_time ? ` ${formatTime(request.end_time)}` : ""}` : (request.expected_return || "-");
        const popup = window.open("", "_blank", "width=900,height=900");
        if (!popup) return;
        const safe = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
        popup.document.write(`<!doctype html><html><head><title>${safe(documentBrandName)} - Permission ${safe(request.reference_number)}</title><style>body{font-family:Arial,sans-serif;color:#111827;padding:40px} .header{text-align:center;border-bottom:2px solid #1e3a8a;padding-bottom:18px}.logo{max-height:80px;max-width:140px}.school{font-size:24px;font-weight:800;color:#1e3a8a}.muted{color:#64748b}.title{margin-top:30px;text-align:center;font-size:22px;font-weight:800;text-transform:uppercase}.ref{text-align:center;margin:8px 0 25px;font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #cbd5e1}.cell{padding:12px;border-bottom:1px solid #e2e8f0}.label{font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700}.value{margin-top:4px;font-weight:600}.wide{grid-column:1/-1}.signature{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:70px}.line{border-top:1px solid #111827;padding-top:8px}.footer{margin-top:50px;font-size:11px;color:#64748b;text-align:center}@media print{body{padding:20px}}</style></head><body><div class="header">${showLogo && logo ? `<img class="logo" src="${safe(logo)}" />` : ""}<div class="school">${safe(documentBrandName)}</div>${showRegistrationNumber && registrationNumber ? `<div>${safe(registrationNumber)}</div>` : ""}${showAddress && address ? `<div class="muted">${safe(address)}</div>` : ""}${showPhone && phone ? `<div class="muted">${safe(phone)}</div>` : ""}${showEmail && email ? `<div class="muted">${safe(email)}</div>` : ""}</div><div class="title">Official Office Permission</div><div class="ref">Reference: ${safe(request.reference_number)}</div><div class="grid"><div class="cell"><div class="label">Name</div><div class="value">${safe(personName)}</div></div><div class="cell"><div class="label">Role</div><div class="value">${safe(role)}</div></div><div class="cell"><div class="label">Permission Type</div><div class="value">${safe(request.permission_type)}</div></div><div class="cell"><div class="label">Status</div><div class="value">${safe(String(request.status).toUpperCase())}</div></div><div class="cell"><div class="label">Start</div><div class="value">${safe(start)}</div></div><div class="cell"><div class="label">End / Return</div><div class="value">${safe(end || request.expected_return || "-")}</div></div><div class="cell wide"><div class="label">Destination</div><div class="value">${safe(request.destination || "-")}</div></div><div class="cell wide"><div class="label">Reason</div><div class="value">${safe(request.reason)}</div></div>${request.parent_guardian_name ? `<div class="cell"><div class="label">Parent / Guardian</div><div class="value">${safe(request.parent_guardian_name)}</div></div><div class="cell"><div class="label">Guardian Phone</div><div class="value">${safe(request.parent_guardian_phone || "-")}</div></div>` : ""}<div class="cell wide"><div class="label">Approved On</div><div class="value">${safe(approvedDate)}</div></div></div><div class="signature"><div class="line">Authorized Officer</div><div class="line">Requester / Holder</div></div><div class="footer">This document was generated from the AfriCore Office Permission workflow. Reference: ${safe(request.reference_number)}</div><script>window.onload=function(){window.print();}</script></body></html>`);
        popup.document.close();
        try { await supabase.from("office_permission_requests").update({ document_generated_at: new Date().toISOString() }).eq("id", request.id); } catch (_) {}
    };

    const modules = [
        { title: "Live Meetings", description: "Start or join live video conferences.", icon: Video, action: () => navigate("/communication/meetings"), badge: "Live" },
        { title: "Messages", description: "Chat with teachers, staff, parents and other system users.", icon: MessageSquare, action: () => navigate("/communication/chat") },
        { title: "Notifications", description: "View your personal system notifications and alerts.", icon: Bell, action: () => navigate("/communication/notifications") },
        { title: "Announcements", description: "Create and manage school announcements.", icon: Megaphone, action: () => navigate("/communication/announcements") },
        { title: "Suggestion Box", description: "Share ideas, suggestions and recommendations to improve the school.", icon: Lightbulb, action: () => navigate("/communication/suggestions") },
        { title: "Office Permission", description: "Request official school or office permission and receive an approval document.", icon: FileCheck2, action: openPermissionRequest, badge: "Official" },
        { title: isApprover ? "Permission Approval Desk" : "My Permissions", description: isApprover ? "Review, approve or reject office permission requests." : "Track your office permission requests and approved documents.", icon: ClipboardList, action: isApprover ? openApprovalDesk : openMyPermissions },
        { title: "Analytics", description: "View communication activity and performance information.", icon: Activity, action: () => setActivePanel("analytics") },
        { title: "System Access", description: "View your current communication access and role.", icon: ShieldCheck, action: () => setActivePanel("permissions") },
    ];

    if (loading) return <div className="min-h-screen bg-slate-50 p-6"><div className="flex min-h-[60vh] items-center justify-center"><div className="text-center"><RefreshCw className="mx-auto h-10 w-10 animate-spin text-indigo-600" /><p className="mt-4 text-sm font-semibold text-slate-700">Loading Communication Center...</p><p className="mt-1 text-xs text-slate-400">Connecting to AfriCore communication services.</p></div></div></div>;

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6">
            <div className="mx-auto max-w-7xl">
                <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Radio className="h-6 w-6" /></div><div><h1 className="text-2xl font-bold text-slate-900">Communication Center</h1><p className="mt-1 text-sm text-slate-500">Connect, communicate and collaborate across your school.</p></div></div>
                            <div className="mt-4 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Connected</span><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600"><CircleUserRound className="h-3.5 w-3.5" />{profile?.full_name || "Current User"}</span><span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700"><ShieldCheck className="h-3.5 w-3.5" />{roleName}</span></div>
                        </div>
                        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => loadCommunication(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Refresh</button><button type="button" onClick={() => navigate("/communication/meetings")} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"><Video className="h-4 w-4" />Start Meeting</button></div>
                    </div>
                </div>

                {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4"><p className="text-sm font-semibold text-red-800">Communication Center Error</p><p className="mt-1 text-xs text-red-700">{error}</p></div>}

                <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
                    <StatCard icon={Users} label="System Users" value={stats.users} description="Profiles available" onClick={() => setActivePanel("users")} />
                    <StatCard icon={MessageSquare} label="My Messages" value={stats.messages} description={`${stats.unreadMessages} unread`} onClick={() => navigate("/communication/chat")} />
                    <StatCard icon={Video} label="Meetings" value={stats.meetings} description="Scheduled meetings" onClick={() => navigate("/communication/meetings")} />
                    <StatCard icon={Bell} label="Notifications" value={stats.notifications} description={`${stats.unreadNotifications} unread`} onClick={() => navigate("/communication/notifications")} />
                    <StatCard icon={FileCheck2} label={isApprover ? "Pending Permissions" : "My Permissions"} value={stats.pendingPermissions} description={isApprover ? "Awaiting approval" : "Pending requests"} onClick={isApprover ? openApprovalDesk : openMyPermissions} />
                </div>

                <div className="mb-6 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">My Communication Account</p><h2 className="mt-2 text-xl font-bold text-slate-900">{profile?.full_name || "Current User"}</h2><p className="mt-1 text-sm text-slate-500">{roleName}</p></div><div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-indigo-50 text-indigo-600">{profile?.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name || "Profile"} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="flex h-full w-full items-center justify-center"><CircleUserRound className="h-6 w-6" /></div>}</div></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><InfoItem label="Phone" value={profile?.phone || "Not provided"} /><InfoItem label="School" value={profile?.school_id ? `School #${profile.school_id}` : "Not assigned"} /><InfoItem label="Role" value={roleName} /></div></div>
                    <div className="rounded-2xl bg-indigo-700 p-5 text-white shadow-sm"><div className="flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10"><FileCheck2 className="h-5 w-5" /></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">Office</span></div><p className="mt-6 text-xs text-indigo-200">PERMISSION WORKFLOW</p><h3 className="mt-1 text-xl font-bold">Official Permission</h3><p className="mt-2 text-sm leading-5 text-indigo-100">Submit an office or school permission request, follow its approval status and print the official document after approval.</p><button type="button" onClick={openPermissionRequest} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">Request Permission <ArrowRight className="h-4 w-4" /></button></div>
                </div>

                <div className="mb-6"><div className="mb-4"><h2 className="text-lg font-bold text-slate-900">Communication</h2><p className="mt-1 text-sm text-slate-500">Communication, live meetings and official school permission tools.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{modules.map((module) => { const Icon = module.icon; return <button key={module.title} type="button" onClick={module.action} className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md"><div className="mb-5 flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="h-5 w-5" /></div>{module.badge && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">{module.badge}</span>}</div><h3 className="font-semibold text-slate-900">{module.title}</h3><p className="mt-2 min-h-[40px] text-sm leading-5 text-slate-500">{module.description}</p><div className="mt-5 flex items-center gap-2 text-sm font-semibold text-indigo-600">Open <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></div></button>; })}</div></div>

                <div className="mb-6"><div className="mb-4"><h2 className="text-lg font-bold text-slate-900">External Communication</h2><p className="mt-1 text-sm text-slate-500">Send parent/guardian result communications through the configured gateway.</p></div><div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-4"><p className="text-sm font-semibold text-sky-900">NewHope SMS, WhatsApp and Email are available as external communication channels.</p><p className="mt-1 text-sm text-sky-800">SMS uses the active school's NewHope API credentials and approved Sender ID. WhatsApp and Email still require valid provider configuration to send successfully.</p></div><div className="grid gap-4 lg:grid-cols-3"><ChannelCard icon={Mail} title="Email" description="Compose and send result communication by email using the configured email provider." onClick={() => openComposer("email")} buttonText="Open Email Form" /><ChannelCard icon={MessageCircle} title="WhatsApp" description="Compose and send result communication through the configured WhatsApp provider." onClick={() => openComposer("whatsapp")} buttonText="Open WhatsApp Form" /><ChannelCard icon={Smartphone} title="SMS Center" description="Send NewHope SMS to selected staff members or parents/guardians, individually or as a group." onClick={() => setActivePanel("sms-center")} buttonText="Open SMS Center" /></div></div>

                <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5"><QuickAction icon={Video} title="Create / Join Meeting" description="Open the meeting workspace." onClick={() => navigate("/communication/meetings")} /><QuickAction icon={MessageSquare} title="Open Chat" description="Start an internal conversation." onClick={() => navigate("/communication/chat")} /><QuickAction icon={Megaphone} title="School Announcement" description="Create or manage announcements." onClick={() => navigate("/communication/announcements")} /><QuickAction icon={Bell} title="Notification Center" description="Review system notifications." onClick={() => navigate("/communication/notifications")} /><QuickAction icon={Lightbulb} title="Suggestion Box" description="Share ideas and recommendations to improve the school." onClick={() => navigate("/communication/suggestions")} /><QuickAction icon={FileCheck2} title="Office Permission" description="Request or track official permission." onClick={isApprover ? openApprovalDesk : openPermissionRequest} /></div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Upcoming Meetings</h2><p className="text-sm text-slate-500">Scheduled video conferences.</p></div><CalendarDays className="h-5 w-5 text-slate-400" /></div>{upcomingMeetings.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center"><Video className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-600">No upcoming meetings</p><p className="mt-1 text-xs text-slate-400">Create a meeting to start communicating live.</p><button type="button" onClick={() => navigate("/communication/meetings")} className="mt-4 rounded-lg bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-100">Create Meeting</button></div> : <div className="space-y-3">{upcomingMeetings.map((meeting) => <div key={meeting.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Video className="h-4 w-4" /></div><div><h3 className="font-semibold text-slate-900">{meeting.title || "Untitled Meeting"}</h3><p className="mt-1 text-sm text-slate-500">{meeting.description || "No description"}</p></div></div><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600"><CalendarDays className="h-3.5 w-3.5" />{formatDate(meeting.meeting_date)}</span><span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600"><Clock3 className="h-3.5 w-3.5" />{formatTime(meeting.start_time)}</span>{meeting.platform && <span className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">{meeting.platform}</span>}<button type="button" onClick={() => navigate(`/communication/meeting/${meeting.id}`)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">Open</button></div></div>)}</div>}</div>
            </div>

            {activePanel && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{activePanel === "composer" ? <Send className="h-5 w-5" /> : activePanel === "analytics" ? <BarChart3 className="h-5 w-5" /> : activePanel === "permissions" ? <ShieldCheck className="h-5 w-5" /> : activePanel === "users" ? <Users className="h-5 w-5" /> : <FileCheck2 className="h-5 w-5" />}</div><div><h2 className="text-lg font-bold text-slate-900">{panelTitle(activePanel, composer, isApprover)}</h2><p className="text-xs text-slate-500">{panelDescription(activePanel, isApprover)}</p></div></div><button type="button" onClick={closePanel} disabled={sending || officeSaving} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button></div>

                {activePanel === "office-request" && <PermissionRequestForm form={permissionForm} setForm={setPermissionForm} onSubmit={createOfficePermission} saving={officeSaving} result={officeResult} isStudent={isStudent} />}

                {activePanel === "office-requests" && <PermissionList requests={officeRequests} requesterProfiles={requesterProfiles} currentUserId={profile?.id} onPrint={printPermissionDocument} onRefresh={() => loadCommunication(true)} title="My Office Permission Requests" />}

                {activePanel === "office-approval" && <ApprovalDesk requests={officeRequests} requesterProfiles={requesterProfiles} onApprove={(request) => updateOfficePermission(request, "approved")} onReject={(request) => { setApprovalRequest(request); setApprovalReason(""); }} onPrint={printPermissionDocument} saving={officeSaving} result={officeResult} />}

                {activePanel === "composer" && <Composer composer={composer} setComposer={setComposer} sendResult={sendResult} sending={sending} onSubmit={sendExternalCommunication} onClose={closePanel} />}
                {activePanel === "sms-center" && <SmsCenter schoolId={profile?.school_id} />}
                {activePanel === "analytics" && <AnalyticsPanel users={users} messages={messages} meetings={meetings} notifications={notifications} stats={stats} />}
                {activePanel === "permissions" && <SystemAccessPanel profile={profile} roleName={roleName} />}
                {activePanel === "users" && <UsersPanel users={users} />}
            </div></div>}

            {approvalRequest && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-lg font-bold text-slate-900">Reject Permission Request</h3><p className="mt-1 text-sm text-slate-500">Reference: {approvalRequest.reference_number}</p></div><button type="button" onClick={() => setApprovalRequest(null)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><label className="mt-5 block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Reason</span><textarea value={approvalReason} onChange={(e) => setApprovalReason(e.target.value)} rows={5} className="form-input min-h-[120px] resize-y" placeholder="Enter rejection reason..." /></label><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setApprovalRequest(null)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">Cancel</button><button type="button" disabled={officeSaving} onClick={() => updateOfficePermission(approvalRequest, "rejected", approvalReason)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"><Ban className="h-4 w-4" />Reject</button></div></div></div>}
        </div>
    );
};

const SmsCenter = ({ schoolId }) => {
    const [audience, setAudience] = useState("staff");
    const [recipients, setRecipients] = useState([]);
    const [classes, setClasses] = useState([]);
    const [classFilter, setClassFilter] = useState("all");
    const [selected, setSelected] = useState([]);
    const [search, setSearch] = useState("");
    const [message, setMessage] = useState("");
    const [loadingRecipients, setLoadingRecipients] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [sendResult, setSendResult] = useState(null);

    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoadingRecipients(true); setError(""); setSelected([]); setSendResult(null);
            try {
                if (!schoolId) throw new Error("Akaunti yako haijaunganishwa na shule.");
                if (audience === "staff") {
                    const { data, error: queryError } = await supabase.from("profiles")
                        .select("id, full_name, phone, role_id, school_id, roles (role_name)")
                        .eq("school_id", schoolId).order("full_name", { ascending: true });
                    if (queryError) throw queryError;
                    const rows = (data || []).filter((row) => Number(row.role_id) !== 10).map((row) => ({
                        id: String(row.id), name: row.full_name || "Staff member",
                        detail: row.roles?.role_name || "Staff", phone: row.phone || "",
                    }));
                    if (active) setRecipients(rows);
                } else {
                    const [{ data: classRows, error: classError }, { data, error: queryError }] = await Promise.all([
                        supabase.from("classes").select("id, class_name, academic_level, academic_year_id, is_active")
                            .eq("school_id", schoolId).eq("is_active", true).order("class_name"),
                        supabase.from("students")
                            .select("id, first_name, middle_name, last_name, admission_number, current_class_id, class_name, parent_name, parent_phone, guardian_name, guardian_phone, school_id")
                            .eq("school_id", schoolId).order("first_name", { ascending: true }),
                    ]);
                    if (classError) throw classError;
                    if (queryError) throw queryError;
                    const classMap = new Map((classRows || []).map((item) => [String(item.id), item]));
                    const rows = (data || []).map((row) => {
                        const cls = classMap.get(String(row.current_class_id));
                        return {
                            id: String(row.id),
                            name: row.guardian_name || row.parent_name || "Parent / Guardian",
                            detail: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" ") +
                                (row.admission_number ? " • " + row.admission_number : "") +
                                (cls?.class_name || row.class_name ? " • " + (cls?.class_name || row.class_name) : ""),
                            studentName: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" "),
                            classId: String(row.current_class_id || ""),
                            className: cls?.class_name || row.class_name || "",
                            phone: row.guardian_phone || row.parent_phone || "",
                            contactSource: row.guardian_phone ? "Guardian" : row.parent_phone ? "Parent fallback" : "No phone",
                        };
                    });
                    if (active) { setClasses(classRows || []); setRecipients(rows); }
                }
            } catch (loadError) {
                if (active) setError(loadError?.message || "Imeshindikana kupakia wapokeaji.");
            } finally { if (active) setLoadingRecipients(false); }
        };
        load();
        return () => { active = false; };
    }, [audience, schoolId]);

    const classRecipients = audience === "parents" && classFilter !== "all"
        ? recipients.filter((row) => row.classId === String(classFilter))
        : recipients;
    const visibleRecipients = classRecipients.filter((row) => {
        const term = search.trim().toLowerCase();
        return !term || row.name.toLowerCase().includes(term) || row.detail.toLowerCase().includes(term) || row.phone.toLowerCase().includes(term);
    });
    const selectedRows = recipients.filter((row) => selected.includes(row.id));
    const selectedCount = selected.length;
    const validSelectedCount = selectedRows.filter((row) => row.phone.trim()).length;
    const missingPhoneCount = selectedRows.length - validSelectedCount;
    const toggleRecipient = (id) => {
        setSelected((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]);
        setSendResult(null);
    };
    const toggleVisible = () => {
        const visibleIds = visibleRecipients.map((row) => row.id);
        const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
        setSelected((previous) => allVisibleSelected
            ? previous.filter((id) => !visibleIds.includes(id))
            : [...new Set([...previous, ...visibleIds])]);
        setSendResult(null);
    };
    const sendBulkSms = async (event) => {
        event.preventDefault(); setError(""); setSendResult(null);
        if (!selected.length) return setError("Chagua angalau mwanafunzi/mpokeaji mmoja.");
        if (!message.trim()) return setError("Andika ujumbe wa SMS.");
        const estimated = selectedRows.filter((row) => row.phone.trim()).length;
        const confirmation = `Unakaribia kutuma SMS ${audience === "parents" ? "kwa kila mwanafunzi aliyechaguliwa" : "kwa staff"}: ${estimated} ujumbe unaowezekana, ${missingPhoneCount} hawana namba. Namba ya mlezi itapewa kipaumbele; namba ya mzazi itatumika ikiwa ya mlezi haipo. Ujumbe unaweza kuwa na gharama. Uendelee?`;
        if (!window.confirm(confirmation)) return;
        try {
            setSending(true);
            const aggregate = { success: true, sent_count: 0, failed_count: 0, skipped_count: 0, results: [], message: "" };
            for (let index = 0; index < selected.length; index += 100) {
                const batch = selected.slice(index, index + 100);
                const response = await api.post("/communication/bulk-sms", {
                    audience, recipient_ids: batch, class_id: audience === "parents" && classFilter !== "all" ? Number(classFilter) : null,
                    message: message.trim(),
                });
                const data = response?.data || {};
                aggregate.sent_count += Number(data.sent_count || 0);
                aggregate.failed_count += Number(data.failed_count || 0);
                aggregate.skipped_count += Number(data.skipped_count || 0);
                aggregate.results.push(...(Array.isArray(data.results) ? data.results : []));
                if (!data.success && !data.results) throw new Error(data.message || "SMS batch failed.");
            }
            aggregate.success = aggregate.sent_count > 0 && aggregate.failed_count === 0;
            aggregate.message = `NewHope: ${aggregate.sent_count} zimekubaliwa, ${aggregate.failed_count} zimeshindwa, ${aggregate.skipped_count} zimerukwa.`;
            setSendResult(aggregate);
            if (aggregate.failed_count === 0) { setSelected([]); setMessage(""); }
        } catch (sendError) {
            const data = sendError?.response?.data || {};
            setError(data.error || data.message || sendError?.message || "Imeshindikana kutuma SMS.");
            if (data.results) setSendResult(data);
        } finally { setSending(false); }
    };

    return (
        <form onSubmit={sendBulkSms} className="space-y-5 p-5">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <p className="font-bold text-indigo-900">NewHope SMS Broadcast</p>
                <p className="mt-1 text-sm text-indigo-800">Chagua staff, wazazi wote au darasa maalumu. Kwa wazazi, kila SMS ina taarifa za mwanafunzi husika. Namba ya mlezi ina kipaumbele; namba ya mzazi ni mbadala.</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setAudience("staff"); setClassFilter("all"); }} className={audience === "staff" ? "rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white" : "rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"}>SMS to Staff</button>
                <button type="button" onClick={() => { setAudience("parents"); setClassFilter("all"); }} className={audience === "parents" ? "rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white" : "rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"}>SMS to Parents</button>
            </div>
            {audience === "parents" && <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Parent group</span>
                    <select value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setSelected([]); setSendResult(null); }} className="form-input">
                        <option value="all">Wazazi wa shule nzima / All classes</option>
                        {classes.map((item) => <option key={item.id} value={String(item.id)}>{item.class_name}{item.academic_level ? " • " + item.academic_level : ""}</option>)}
                    </select>
                </label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 self-end">Unaweza kuchagua darasa moja au kutuma kwa shule nzima. Chagua madarasa mengine kwa kubadili darasa na kuongeza wapokeaji kwenye uchaguzi.</div>
            </div>}
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Search recipient</span><input value={search} onChange={(event) => setSearch(event.target.value)} className="form-input" placeholder={audience === "staff" ? "Search staff name or phone..." : "Search student or guardian name..."} /></label>
                <div className="text-sm font-semibold text-slate-700">Selected: {selectedCount} • With phone: {validSelectedCount}</div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div><p className="text-sm font-bold text-slate-800">{audience === "staff" ? "Staff members" : "Students / Parents / Guardians"}</p><p className="text-xs text-slate-500">{visibleRecipients.length} records shown • {missingPhoneCount} selected without a phone</p></div>
                    <button type="button" onClick={toggleVisible} disabled={!visibleRecipients.length || loadingRecipients} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Select / Clear visible</button>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {loadingRecipients ? <p className="p-8 text-center text-sm text-slate-500">Loading recipients...</p> : visibleRecipients.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No recipients found in this group.</p> : visibleRecipients.map((row) => (
                        <label key={row.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50">
                            <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleRecipient(row.id)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{row.name}</span><span className="block truncate text-xs text-slate-500">{row.detail}</span></span>
                            <span className="text-right"><span className={row.phone ? "block text-xs font-medium text-slate-600" : "block text-xs font-semibold text-red-600"}>{row.phone || "No phone"}</span><span className="block text-[10px] text-slate-400">{row.contactSource || ""}</span></span>
                        </label>
                    ))}
                </div>
            </div>
            <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">SMS Message</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} maxLength={1200} required className="form-input min-h-[120px] resize-y" placeholder="Andika ujumbe. Tumia {{student_name}}, {{class_name}}, {{admission_number}} kupata taarifa za kila mtoto..." /><span className="mt-1 block text-right text-xs text-slate-500">{message.length}/1200 characters</span></label>
            {audience === "parents" && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Viambishi vinavyoweza kutumika: <strong>{"{{student_name}}"}</strong>, <strong>{"{{class_name}}"}</strong>, <strong>{"{{admission_number}}"}</strong>. SMS moja itatumwa kwa kila mtoto; namba moja ya mlezi inaweza kupokea SMS nyingi ikiwa ana watoto wengi.</p>}
            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {sendResult && <div className="space-y-3 rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-slate-900">NewHope SMS results</p><p className="text-xs text-slate-600">Accepted: {sendResult.sent_count || 0} • Failed: {sendResult.failed_count || 0} • Duplicate skipped: {sendResult.skipped_count || 0}</p></div><p className="text-sm text-slate-700">{sendResult.message}</p>{Array.isArray(sendResult.results) && <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">{sendResult.results.map((row, index) => <div key={index} className="flex items-start justify-between gap-3 py-2 text-xs"><div className="min-w-0"><p className="font-semibold text-slate-800">{row.recipient_name || "Recipient"} {row.student_name ? "• " + row.student_name : ""}</p><p className="break-all text-slate-500">{row.phone || row.error || ""}</p></div><span className={row.status === "failed" ? "font-bold text-red-600" : row.status === "skipped" ? "font-bold text-amber-600" : "font-bold text-emerald-600"}>{row.status}</span></div>)}</div>}</div>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4"><p className="text-xs text-slate-500">Ujumbe hutumwa kwa batches za hadi 100. Kwa wazazi, namba inayojirudia kwa watoto tofauti haizuiwi.</p><button type="submit" disabled={sending || loadingRecipients || !selected.length || !message.trim()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{sending ? <><RefreshCw className="h-4 w-4 animate-spin" />Sending SMS...</> : <><Smartphone className="h-4 w-4" />Send SMS to {selectedCount} student(s)</>}</button></div>
        </form>
    );
};

const PermissionRequestForm = ({ form, setForm, onSubmit, saving, result, isStudent }) => {
    const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
    return <form onSubmit={onSubmit} className="space-y-5 p-5"><div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><div className="flex items-start gap-3"><FileCheck2 className="mt-0.5 h-5 w-5 text-indigo-600" /><div><p className="text-sm font-bold text-indigo-900">Official Office Permission Request</p><p className="mt-1 text-xs leading-5 text-indigo-700">Submit your request through the school office workflow. After approval, the official permission document can be printed.</p></div></div></div><div className="grid gap-4 md:grid-cols-2"><FormField label="Permission Type" required><select value={form.permission_type} onChange={(e) => update("permission_type", e.target.value)} className="form-input"><option>Personal Permission</option><option>Medical Permission</option><option>Family Matter</option><option>Official Duty</option><option>Emergency Permission</option><option>Leaving School</option><option>Other</option></select></FormField><FormField label="Destination"><input value={form.destination} onChange={(e) => update("destination", e.target.value)} className="form-input" placeholder="Where will you go?" /></FormField><FormField label="Start Date" required><input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} className="form-input" /></FormField><FormField label="Start Time"><input type="time" value={form.start_time} onChange={(e) => update("start_time", e.target.value)} className="form-input" /></FormField><FormField label="End / Return Date"><input type="date" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} className="form-input" /></FormField><FormField label="End / Return Time"><input type="time" value={form.end_time} onChange={(e) => update("end_time", e.target.value)} className="form-input" /></FormField></div><FormField label="Expected Return"><input value={form.expected_return} onChange={(e) => update("expected_return", e.target.value)} className="form-input" placeholder="e.g. Monday 07:30 AM" /></FormField><FormField label="Reason" required><textarea value={form.reason} onChange={(e) => update("reason", e.target.value)} rows={6} className="form-input min-h-[140px] resize-y" placeholder="Explain the reason for requesting permission..." /></FormField>{isStudent && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-amber-800">Student / Parent Information</p><div className="mt-4 grid gap-4 md:grid-cols-2"><FormField label="Parent / Guardian Name"><input value={form.parent_guardian_name} onChange={(e) => update("parent_guardian_name", e.target.value)} className="form-input" /></FormField><FormField label="Parent / Guardian Phone"><input value={form.parent_guardian_phone} onChange={(e) => update("parent_guardian_phone", e.target.value)} className="form-input" /></FormField></div></div>}{result && <ResultBox result={result} />}<div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end"><button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <><RefreshCw className="h-4 w-4 animate-spin" />Submitting...</> : <><Send className="h-4 w-4" />Submit Permission Request</>}</button></div></form>;
};

const PermissionList = ({ requests, requesterProfiles, currentUserId, onPrint, onRefresh, title }) => <div className="space-y-4 p-5"><div className="flex items-center justify-between"><div><h3 className="font-bold text-slate-900">{title}</h3><p className="text-sm text-slate-500">Track submitted requests and approved documents.</p></div><button type="button" onClick={onRefresh} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" />Refresh</button></div>{requests.filter((r) => !currentUserId || r.requester_profile_id === currentUserId).length === 0 ? <EmptyState icon={ClipboardList} title="No permission requests" text="You have not submitted an office permission request yet." /> : requests.filter((r) => !currentUserId || r.requester_profile_id === currentUserId).map((request) => <PermissionRequestCard key={request.id} request={request} requesterProfiles={requesterProfiles} onPrint={onPrint} />)}</div>;

const ApprovalDesk = ({ requests, requesterProfiles, onApprove, onReject, onPrint, saving, result }) => <div className="space-y-4 p-5"><div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><div className="flex items-start gap-3"><UserRoundCheck className="mt-0.5 h-5 w-5 text-indigo-600" /><div><p className="font-bold text-indigo-900">Permission Approval Desk</p><p className="mt-1 text-xs leading-5 text-indigo-700">Authorized school officers can approve or reject office permission requests. Approved requests can be issued as official documents.</p></div></div></div>{result && <ResultBox result={result} />}{requests.filter((r) => r.status === "pending").length === 0 ? <EmptyState icon={CheckCircle2} title="No pending requests" text="There are no office permission requests awaiting approval." /> : requests.filter((r) => r.status === "pending").map((request) => <PermissionRequestCard key={request.id} request={request} requesterProfiles={requesterProfiles} approval onApprove={onApprove} onReject={onReject} onPrint={onPrint} saving={saving} />)}<div className="pt-4"><h3 className="font-bold text-slate-900">Recent Decisions</h3><div className="mt-3 space-y-3">{requests.filter((r) => r.status !== "pending").slice(0, 10).map((request) => <PermissionRequestCard key={request.id} request={request} requesterProfiles={requesterProfiles} onPrint={onPrint} />)}</div></div></div>;

const PermissionRequestCard = ({ request, requesterProfiles, approval, onApprove, onReject, onPrint, saving }) => { const requester = requesterProfiles[request.requester_profile_id]; const statusClass = request.status === "approved" ? "bg-emerald-50 text-emerald-700" : request.status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"; return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">{request.permission_type}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}>{String(request.status).toUpperCase()}</span></div><p className="mt-1 text-xs font-semibold text-indigo-600">{request.reference_number}</p><p className="mt-3 text-sm font-semibold text-slate-800">{requester?.full_name || "Requester"}</p><p className="text-xs text-slate-500">{requester?.roles?.role_name || request.requester_type}</p></div><div className="flex flex-wrap gap-2">{approval && request.status === "pending" && <><button type="button" disabled={saving} onClick={() => onApprove(request)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Check className="h-4 w-4" />Approve</button><button type="button" disabled={saving} onClick={() => onReject(request)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"><Ban className="h-4 w-4" />Reject</button></>}{request.status === "approved" && <button type="button" onClick={() => onPrint(request)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700"><Printer className="h-4 w-4" />Print Document</button>}</div></div><div className="mt-4 grid gap-3 md:grid-cols-3"><InfoItem label="Date" value={`${formatDate(request.start_date)}${request.start_time ? ` ${formatTime(request.start_time)}` : ""}`} /><InfoItem label="Return" value={request.end_date || request.expected_return ? `${formatDate(request.end_date || request.start_date)}${request.end_time ? ` ${formatTime(request.end_time)}` : request.expected_return ? ` • ${request.expected_return}` : ""}` : "Not specified"} /><InfoItem label="Destination" value={request.destination || "Not specified"} /></div><div className="mt-3 rounded-xl bg-slate-50 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Reason</p><p className="mt-1 text-sm leading-6 text-slate-700">{request.reason}</p></div>{request.status === "rejected" && request.rejection_reason && <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-red-500">Rejection Reason</p><p className="mt-1 text-sm text-red-700">{request.rejection_reason}</p></div>}</div>; };

const Composer = ({ composer, setComposer, sendResult, sending, onSubmit }) => {
    const fieldClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100";
    return (
        <form onSubmit={onSubmit} className="space-y-5 p-5 text-slate-900">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <p className="text-sm font-bold text-indigo-900">{capitalize(composer.channel)} Communication</p>
                <p className="mt-1 text-xs leading-5 text-indigo-700">Enter a phone number or email address and your message. WhatsApp opens with your message ready; you press Send there.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <FormField label={composer.channel === "email" ? "Recipient Email" : "Recipient WhatsApp Number"} required>
                    <input type={composer.channel === "email" ? "email" : "tel"} value={composer.recipient} onChange={(e) => setComposer((p) => ({ ...p, recipient: e.target.value }))} required autoComplete="off" placeholder={composer.channel === "email" ? "parent@example.com" : "e.g. 0712345678 or 255712345678"} className={fieldClass} />
                    <p className="mt-1 text-xs text-slate-500">{composer.channel === "email" ? "Enter the recipient's email address." : "Tumia namba ya Tanzania (mf. 0712345678 au 255712345678). WhatsApp itafunguka; bonyeza Send kutuma."}</p>
                </FormField>
                {composer.channel === "email" && (
                    <FormField label="Email Subject" required>
                        <input value={composer.subject} onChange={(e) => setComposer((p) => ({ ...p, subject: e.target.value }))} className={fieldClass} required placeholder="Message subject" />
                    </FormField>
                )}
            </div>
            <FormField label="Message" required>
                <textarea value={composer.message} onChange={(e) => setComposer((p) => ({ ...p, message: e.target.value }))} rows={7} required className={`${fieldClass} min-h-[160px] resize-y`} placeholder="Type your message here..." />
            </FormField>
            {sendResult && <ResultBox result={sendResult} />}
            <div className="flex justify-end border-t border-slate-200 pt-5">
                <button type="submit" disabled={sending} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                    {sending ? <><RefreshCw className="h-4 w-4 animate-spin" />Sending...</> : <><Send className="h-4 w-4" />{composer.channel === "whatsapp" ? "Open WhatsApp" : "Send Communication"}</>}
                </button>
            </div>
        </form>
    );
};

const AnalyticsPanel = ({ users, messages, meetings, notifications, stats }) => <div className="space-y-5 p-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><AnalyticsCard label="System Users" value={users.length} icon={Users} /><AnalyticsCard label="Messages" value={messages.length} icon={MessageSquare} /><AnalyticsCard label="Meetings" value={meetings.length} icon={Video} /><AnalyticsCard label="Notifications" value={notifications.length} icon={Bell} /></div><div className="grid gap-4 md:grid-cols-2"><ActivityBox icon={MessageSquare} title="Message Activity"><ActivityRow label="Total Messages" value={messages.length} /><ActivityRow label="Unread Messages" value={stats.unreadMessages} /><ActivityRow label="Read Messages" value={Math.max(0, messages.length - stats.unreadMessages)} /></ActivityBox><ActivityBox icon={Bell} title="Notification Activity"><ActivityRow label="Total Notifications" value={notifications.length} /><ActivityRow label="Unread Notifications" value={stats.unreadNotifications} /><ActivityRow label="Read Notifications" value={Math.max(0, notifications.length - stats.unreadNotifications)} /></ActivityBox></div></div>;

const SystemAccessPanel = ({ profile, roleName }) => <div className="space-y-5 p-5"><div className="rounded-2xl border border-slate-200 p-5"><div className="flex items-start gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><UserCheck className="h-6 w-6" /></div><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Current Account</p><h3 className="mt-1 text-xl font-bold text-slate-900">{profile?.full_name || "Current User"}</h3><p className="mt-1 text-sm text-slate-500">{roleName}</p></div></div></div><div className="grid gap-4 md:grid-cols-2"><PermissionInfo icon={MessageSquare} title="Internal Chat" description="Internal messaging page is available through the Communication Center." status="Available" /><PermissionInfo icon={Video} title="Meetings" description="Meeting access uses the existing application routing and permission structure." status="Available" /><PermissionInfo icon={Bell} title="Notifications" description="Personal system notifications are available for the signed-in account." status="Available" /><PermissionInfo icon={Megaphone} title="Announcements" description="School announcement functionality is available through the Communication module." status="Available" /></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-3"><Settings2 className="mt-0.5 h-5 w-5 text-amber-600" /><div><h3 className="font-bold text-amber-900">System Permission Management</h3><p className="mt-1 text-sm leading-6 text-amber-800">This panel concerns AfriCore feature access. It is separate from the Office Permission workflow.</p></div></div></div></div>;

const UsersPanel = ({ users }) => <div className="p-5">{users.length === 0 ? <EmptyState icon={Users} title="No communication users found." text="No users are available in the current school scope." /> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Name</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Phone</th><th className="px-3 py-3">School</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50"><td className="px-3 py-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{user.full_name?.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U"}{user.avatar_url && <img src={user.avatar_url} alt={user.full_name || "Member"} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</div><span className="font-semibold text-slate-800">{user.full_name || "Unnamed User"}</span></div></td><td className="px-3 py-3 text-slate-600">{user.roles?.role_name || "No role"}</td><td className="px-3 py-3 text-slate-600">{user.phone || "Not provided"}</td><td className="px-3 py-3 text-slate-600">{user.school_id ? `School #${user.school_id}` : "-"}</td></tr>)}</tbody></table></div>}</div>;

const StatCard = ({ icon: Icon, label, value, description, onClick }) => <button type="button" onClick={onClick} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon className="h-5 w-5" /></div><span className="text-2xl font-bold text-slate-900">{value}</span></div><p className="mt-3 text-sm font-semibold text-slate-700">{label}</p><p className="mt-1 text-xs text-slate-400">{description}</p><div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-indigo-600">Open <ArrowRight className="h-3 w-3" /></div></button>;
const InfoItem = ({ label, value }) => <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 truncate text-sm font-semibold text-slate-700">{value}</p></div>;
const ChannelCard = ({ icon: Icon, title, description, onClick, buttonText }) => <button type="button" onClick={onClick} className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md"><div className="flex items-start justify-between gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="h-5 w-5" /></div><ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-500" /></div><h3 className="mt-5 font-semibold text-slate-900">{title}</h3><p className="mt-2 min-h-[40px] text-sm leading-5 text-slate-500">{description}</p><div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700"><Send className="h-3.5 w-3.5" />{buttonText || "Open Form"}</div></button>;
const QuickAction = ({ icon: Icon, title, description, onClick }) => <button type="button" onClick={onClick} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-200 hover:shadow-md"><div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="h-5 w-5" /></div><ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-500" /></div><h3 className="mt-4 text-sm font-bold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></button>;
const FormField = ({ label, required = false, children }) => <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">{label}{required && <span className="ml-1 text-red-500">*</span>}</span>{children}</label>;
const AnalyticsCard = ({ label, value, icon: Icon }) => <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm"><Icon className="h-5 w-5" /></div><span className="text-2xl font-bold text-slate-900">{value}</span></div><p className="mt-3 text-sm font-semibold text-slate-700">{label}</p></div>;
const ActivityBox = ({ icon: Icon, title, children }) => <div className="rounded-2xl border border-slate-200 p-5"><div className="flex items-center gap-3"><Icon className="h-5 w-5 text-indigo-600" /><h3 className="font-bold text-slate-900">{title}</h3></div><div className="mt-5 space-y-3">{children}</div></div>;
const ActivityRow = ({ label, value }) => <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span className="text-sm text-slate-600">{label}</span><span className="font-bold text-slate-900">{value}</span></div>;
const PermissionInfo = ({ icon: Icon, title, description, status }) => <div className="rounded-2xl border border-slate-200 p-5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="h-5 w-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{title}</h3><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{status}</span></div><p className="mt-2 text-sm leading-5 text-slate-500">{description}</p></div></div></div>;
const ResultBox = ({ result }) => <div className={result.type === "success" ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-4" : "rounded-2xl border border-red-200 bg-red-50 p-4"}><p className={result.type === "success" ? "text-sm font-bold text-emerald-800" : "text-sm font-bold text-red-800"}>{result.type === "success" ? "Success" : "Action failed"}</p><p className={result.type === "success" ? "mt-1 text-xs text-emerald-700" : "mt-1 text-xs text-red-700"}>{result.message}</p>{result.provider && <p className="mt-2 text-xs text-slate-600">Provider: <span className="font-semibold">{result.provider}</span>{result.status ? ` • Status: ${result.status}` : ""}</p>}</div>;
const EmptyState = ({ icon: Icon, title, text }) => <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center"><Icon className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-600">{title}</p><p className="mt-1 text-xs text-slate-400">{text}</p></div>;
const panelTitle = (panel, composer, approver) => ({ composer: `${capitalize(composer.channel)} Communication`, "sms-center": "SMS Center", analytics: "Communication Analytics", permissions: "System Access", users: "System Users", "office-request": "Request Office Permission", "office-requests": "My Office Permissions", "office-approval": approver ? "Permission Approval Desk" : "Office Permissions" }[panel] || "Communication");
const panelDescription = (panel, approver) => ({ composer: "Communication form connected to the AfriCore gateway.", "sms-center": "Send NewHope SMS to staff or parents/guardians in your school.", analytics: "Current activity summary from the Communication Center.", permissions: "Current AfriCore feature-access context.", users: "Users available in your school communication scope.", "office-request": "Submit an official office or school permission request.", "office-requests": "Track your requests and print approved permission documents.", "office-approval": approver ? "Review and process pending office permission requests." : "Office permission records." }[panel] || "");
const formatDate = (value) => { if (!value) return "Date not set"; try { return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)); } catch { return value; } };
const formatTime = (value) => value ? String(value).slice(0, 5) : "Time not set";
const capitalize = (value) => { const text = String(value || ""); return text ? text.charAt(0).toUpperCase() + text.slice(1) : ""; };

export default Communication;
