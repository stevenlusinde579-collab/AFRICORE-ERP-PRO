import React, { useEffect, useMemo, useState } from "react";

import {
    FaUsers,
    FaCalendarAlt,
    FaMoneyBillWave,
    FaCreditCard,
    FaWallet,
    FaChartLine,
    FaHandHoldingHeart,
    FaPlus,
    FaArrowRight,
    FaUserCheck,
    FaSyncAlt,
    FaClipboardList,
    FaCog,
    FaChartPie,
    FaChevronRight,
    FaTimes,
    FaSave,
    FaEye,
    FaLock,
    FaBan,
    FaExchangeAlt,
    FaHospital,
    FaHeart,
    FaCross,
    FaExclamationTriangle,
    FaSearch,
    FaHistory,
    FaPrint,
    FaTrash,
    FaFileAlt,
    FaUser,
    FaUserPlus
} from "react-icons/fa";

import { supabase } from "../../services/supabase";

import Members from "./Members";
import Contributions from "./Contributions";
import WelfareRequests from "./WelfareRequests";


function SocialWelfareDashboard() {

    // =========================================================
    // PROFILE
    // =========================================================

    const [currentProfile, setCurrentProfile] = useState(null);

    // =========================================================
    // MAIN DATA
    // =========================================================

    const [members, setMembers] = useState([]);
    const [events, setEvents] = useState([]);
    const [contributions, setContributions] = useState([]);
    const [disbursements, setDisbursements] = useState([]);

    // =========================================================
    // FINANCIAL SUMMARY
    // =========================================================

    const [financialSummary, setFinancialSummary] = useState({
        totalContributions: 0,
        totalDisbursements: 0,
        availableBalance: 0,
        contributionTransactions: 0,
        disbursementTransactions: 0,
        activeEvents: 0,
        totalEvents: 0
    });

    // =========================================================
    // UI STATE
    // =========================================================

    const [loading, setLoading] = useState(true);
    const [financialLoading, setFinancialLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [lastUpdated, setLastUpdated] = useState(null);

    const [activeSection, setActiveSection] = useState("dashboard");

    // =========================================================
    // MODALS
    // =========================================================

    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [contributionModalOpen, setContributionModalOpen] = useState(false);
    const [disbursementModalOpen, setDisbursementModalOpen] = useState(false);

    const [selectedEvent, setSelectedEvent] = useState(null);

    // EVENT MEMBER ASSIGNMENT
    const [assignmentMemberId, setAssignmentMemberId] = useState("");
    const [assignmentExpectedAmount, setAssignmentExpectedAmount] = useState("");
    const [assignmentSaving, setAssignmentSaving] = useState(false);

    // Members assigned while creating a new event.
    // Each row stores the member and the amount expected for this event.
    const [eventAssignments, setEventAssignments] = useState([]);
    const [eventAssignmentMemberId, setEventAssignmentMemberId] = useState("");
    const [eventAssignmentExpectedAmount, setEventAssignmentExpectedAmount] = useState("");

    // =========================================================
    // STATEMENTS
    // =========================================================

    const [statementMemberId, setStatementMemberId] = useState("");
    const [statementEventId, setStatementEventId] = useState("");

    const [statementSearch, setStatementSearch] = useState("");

    // =========================================================
    // INITIAL BALANCE
    // =========================================================

    const [initialBalanceValue, setInitialBalanceValue] = useState("");
    const [initialBalanceSaving, setInitialBalanceSaving] = useState(false);
    const [initialBalanceMemberId, setInitialBalanceMemberId] = useState("");
    const [initialBalanceModalOpen, setInitialBalanceModalOpen] = useState(false);
    const [initialBalanceMemberAmount, setInitialBalanceMemberAmount] = useState("");

    // =========================================================
    // WELFARE EVENT OBLIGATIONS / DEBT
    // =========================================================

    const [welfareObligations, setWelfareObligations] = useState([]);
    const [obligationsLoading, setObligationsLoading] = useState(false);
    const [obligationsError, setObligationsError] = useState("");

    // =========================================================
    // EVENT SEARCH
    // =========================================================

    const [eventSearch, setEventSearch] = useState("");

    // =========================================================
    // EVENT FORM
    // =========================================================

    const emptyEventForm = {
        event_name: "",
        event_type: "Medical Support",
        description: "",
        target_amount: "",
        start_date: new Date().toISOString().slice(0, 10),
        end_date: ""
    };

    const [eventForm, setEventForm] = useState(emptyEventForm);

    // =========================================================
    // CONTRIBUTION FORM
    // =========================================================

    const emptyContributionForm = {
        member_id: "",
        event_id: "",
        amount: "",
        payment_method: "Cash",
        reference_number: "",
        contribution_date: new Date().toISOString().slice(0, 10)
    };

    const [contributionForm, setContributionForm] = useState(
        emptyContributionForm
    );

    // Members assigned to the selected event for the Contribution form.
    // This reads the assignment table directly so the dropdown does not
    // depend on the calculated balance view.
    const [contributionEventMembers, setContributionEventMembers] = useState([]);
    const [contributionEventMembersLoading, setContributionEventMembersLoading] = useState(false);

    // =========================================================
    // CONTRIBUTION EVENT MEMBERS
    // =========================================================

    useEffect(() => {
        let mounted = true;

        const loadContributionEventMembers = async () => {
            const eventId = contributionForm.event_id;

            if (!eventId) {
                if (mounted) setContributionEventMembers([]);
                return;
            }

            try {
                if (mounted) setContributionEventMembersLoading(true);

                const { data, error } = await supabase
                    .from("social_fund_event_members")
                    .select("member_id, expected_amount, status")
                    .eq("event_id", eventId);

                if (error) throw error;

                if (!mounted) return;

                const assigned = (Array.isArray(data) ? data : [])
                    .filter(row => String(row.status || "active").toLowerCase() !== "cancelled")
                    .map(row => {
                        const member = members.find(
                            item => String(item.id) === String(row.member_id)
                        );

                        return {
                            ...row,
                            member,
                            member_id: row.member_id
                        };
                    })
                    .filter(row => row.member);

                setContributionEventMembers(assigned);

                // If the selected member is no longer assigned to this event,
                // clear it so an invalid member cannot be posted.
                if (contributionForm.member_id && !assigned.some(
                    row => String(row.member_id) === String(contributionForm.member_id)
                )) {
                    setContributionForm(prev => ({
                        ...prev,
                        member_id: ""
                    }));
                }
            } catch (err) {
                console.error("Load contribution event members error:", err);
                if (mounted) {
                    setContributionEventMembers([]);
                    setError(err?.message || "Failed to load members assigned to this event.");
                }
            } finally {
                if (mounted) setContributionEventMembersLoading(false);
            }
        };

        loadContributionEventMembers();

        return () => {
            mounted = false;
        };
    }, [contributionForm.event_id, members]);

    // =========================================================
    // DISBURSEMENT FORM
    // =========================================================

    const emptyDisbursementForm = {
        event_id: "",
        member_id: "",
        beneficiary_name: "",
        amount: "",
        purpose: "",
        disbursement_date: new Date().toISOString().slice(0, 10),
        payment_method: "Cash",
        financial_account_id: "",
        reference_number: ""
    };

    const [disbursementForm, setDisbursementForm] = useState(
        emptyDisbursementForm
    );

    // =========================================================
    // INTERNAL NAVIGATION
    // =========================================================

    const sections = [
        {
            id: "dashboard",
            label: "Dashboard",
            icon: <FaChartPie />
        },
        {
            id: "members",
            label: "Members",
            icon: <FaUsers />
        },
        {
            id: "events",
            label: "Events / Causes",
            icon: <FaCalendarAlt />
        },
        {
            id: "contributions",
            label: "Contributions",
            icon: <FaMoneyBillWave />
        },
        {
            id: "requests",
            label: "Welfare Requests",
            icon: <FaClipboardList />
        },
        {
            id: "fund",
            label: "Welfare Fund",
            icon: <FaWallet />
        },
        {
            id: "statements",
            label: "Statements",
            icon: <FaFileAlt />
        },
        {
            id: "reports",
            label: "Reports & Analytics",
            icon: <FaChartLine />
        },
        {
            id: "settings",
            label: "Settings / Rules",
            icon: <FaCog />
        }
    ];

    // =========================================================
    // EVENT TYPES
    // =========================================================

    const eventTypes = [
        "Wedding",
        "Bereavement / Funeral",
        "Medical Support",
        "Emergency",
        "Custom",
        "Other"
    ];

    // =========================================================
    // PAYMENT METHODS
    // =========================================================

    const paymentMethods = [
        "Cash",
        "Bank",
        "Mobile Money",
        "Cheque",
        "Other"
    ];

    // =========================================================
    // GET PROFILE
    // =========================================================

    const fetchProfile = async () => {

        const {
            data: {
                user
            },
            error: userError
        } = await supabase.auth.getUser();

        if (userError) {
            throw userError;
        }

        if (!user) {
            throw new Error("User session not found.");
        }

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .select(`
                id,
                full_name,
                school_id,
                role_id
            `)
            .eq("id", user.id)
            .single();

        if (profileError) {
            throw profileError;
        }

        setCurrentProfile(profile);

        return profile;
    };

    // =========================================================
    // MEMBERS
    // =========================================================

    const fetchMembers = async (profileOverride = null) => {

        const profile =
            profileOverride ||
            currentProfile ||
            await fetchProfile();

        let query = supabase
            .from("social_fund_members")
            .select(`
                id,
                school_id,
                member_number,
                member_type,
                staff_id,
                full_name,
                phone,
                monthly_contribution,
                initial_balance,
                join_date,
                status,
                created_at
            `)
            .order("created_at", {
                ascending: false
            });

        if (Number(profile?.role_id) !== 1) {

            if (!profile?.school_id) {
                throw new Error(
                    "Your profile is not assigned to a school."
                );
            }

            query = query.eq(
                "school_id",
                profile.school_id
            );
        }

        const {
            data,
            error: membersError
        } = await query;

        if (membersError) {
            throw membersError;
        }

        setMembers(
            Array.isArray(data)
                ? data
                : []
        );

        return data || [];
    };

    // =========================================================
    // EVENTS
    // =========================================================

    const fetchEvents = async (profileOverride = null) => {

        const profile =
            profileOverride ||
            currentProfile ||
            await fetchProfile();

        let query = supabase
            .from("social_fund_events")
            .select(`
                id,
                school_id,
                event_name,
                event_type,
                description,
                target_amount,
                start_date,
                end_date,
                status,
                created_by,
                created_at,
                updated_at
            `)
            .order("start_date", {
                ascending: false
            });

        if (Number(profile?.role_id) !== 1) {

            if (!profile?.school_id) {
                throw new Error(
                    "Your profile is not assigned to a school."
                );
            }

            query = query.eq(
                "school_id",
                profile.school_id
            );
        }

        const {
            data,
            error: eventsError
        } = await query;

        if (eventsError) {
            throw eventsError;
        }

        const normalized = Array.isArray(data)
            ? data
            : [];

        setEvents(normalized);

        return normalized;
    };

    // =========================================================
    // WELFARE EVENT MEMBER OBLIGATIONS
    //
    // The balance view is read with select("*") so this dashboard
    // does not guess a fixed set of calculated column names.
    // Expected / paid / outstanding values are normalized below.
    // =========================================================

    const fetchWelfareObligations = async (
        profileOverride = null,
        memberDataOverride = null,
        eventDataOverride = null,
        contributionDataOverride = null
    ) => {

        try {

            setObligationsLoading(true);
            setObligationsError("");

            const profile =
                profileOverride ||
                currentProfile ||
                await fetchProfile();

            const memberList =
                Array.isArray(memberDataOverride)
                    ? memberDataOverride
                    : members;

            const eventList =
                Array.isArray(eventDataOverride)
                    ? eventDataOverride
                    : events;

            const {
                data,
                error: balanceError
            } = await supabase
                .from("social_fund_event_member_balances")
                .select("*");

            if (balanceError) {
                throw balanceError;
            }

            const rows = Array.isArray(data) ? data : [];

            const schoolId =
                profile?.school_id == null
                    ? null
                    : String(profile.school_id);

            const filteredRows =
                Number(profile?.role_id) === 1 || !schoolId
                    ? rows
                    : rows.filter(row => {
                        const rowSchoolId =
                            row?.school_id ??
                            row?.schoolId ??
                            row?.school;

                        return (
                            rowSchoolId == null ||
                            String(rowSchoolId) === schoolId
                        );
                    });

            const getFirstValue = (row, keys, fallback = null) => {
                for (const key of keys) {
                    if (
                        row &&
                        row[key] !== undefined &&
                        row[key] !== null &&
                        row[key] !== ""
                    ) {
                        return row[key];
                    }
                }

                return fallback;
            };

            const contributionTotals = new Map();

            const contributionList = Array.isArray(contributionDataOverride)
                ? contributionDataOverride
                : contributions;

            contributionList.forEach(contribution => {

                if (
                    String(contribution?.status || "")
                        .toLowerCase() !== "posted"
                ) {
                    return;
                }

                const memberId =
                    getFirstValue(
                        contribution,
                        [
                            "member_id",
                            "social_fund_member_id",
                            "welfare_member_id"
                        ]
                    );

                const eventId =
                    getFirstValue(
                        contribution,
                        [
                            "event_id",
                            "social_fund_event_id"
                        ]
                    );

                if (memberId == null || eventId == null) {
                    return;
                }

                const key =
                    `${String(memberId)}::${String(eventId)}`;

                contributionTotals.set(
                    key,
                    (contributionTotals.get(key) || 0) +
                    (Number(contribution.amount) || 0)
                );
            });

            const normalized = filteredRows
                .map(row => {

                    const memberId =
                        getFirstValue(
                            row,
                            [
                                "member_id",
                                "social_fund_member_id",
                                "welfare_member_id",
                                "memberId"
                            ]
                        );

                    const eventId =
                        getFirstValue(
                            row,
                            [
                                "event_id",
                                "social_fund_event_id",
                                "eventId"
                            ]
                        );

                    const member =
                        memberList.find(
                            item =>
                                memberId != null &&
                                String(item.id) ===
                                String(memberId)
                        );

                    const event =
                        eventList.find(
                            item =>
                                eventId != null &&
                                String(item.id) ===
                                String(eventId)
                        );

                    const expectedRaw =
                        getFirstValue(
                            row,
                            [
                                "expected_amount",
                                "required_amount",
                                "assigned_amount",
                                "amount_expected",
                                "amount_due",
                                "expected"
                            ],
                            0
                        );

                    const paidRaw =
                        getFirstValue(
                            row,
                            [
                                "paid_amount",
                                "contributed_amount",
                                "total_paid",
                                "amount_paid",
                                "paid"
                            ],
                            null
                        );

                    const expected =
                        Math.max(
                            0,
                            Number(expectedRaw) || 0
                        );

                    const contributionKey =
                        memberId != null && eventId != null
                            ? `${String(memberId)}::${String(eventId)}`
                            : null;

                    const contributionPaid =
                        contributionKey
                            ? Number(
                                contributionTotals.get(
                                    contributionKey
                                ) || 0
                            )
                            : 0;

                    // The statement must use the actual posted contributions
                    // for this exact member + event as the source of truth.
                    // The balance view may contain a stale/zero paid_amount,
                    // which previously caused a paid event to appear as MISSED.
                    const paid = Math.max(
                        0,
                        contributionPaid
                    );

                    const outstandingRaw =
                        getFirstValue(
                            row,
                            [
                                "outstanding_amount",
                                "outstanding_balance",
                                "balance",
                                "remaining_amount",
                                "amount_remaining"
                            ],
                            null
                        );

                    // Always derive outstanding from expected minus the
                    // actual posted payments so status and debt cannot
                    // disagree with the contribution ledger.
                    const outstanding = Math.max(
                        0,
                        expected - paid
                    );

                    const rawStatus =
                        String(
                            getFirstValue(
                                row,
                                [
                                    "status",
                                    "payment_status"
                                ],
                                ""
                            )
                        ).toUpperCase();

                    let status = "NOT ASSIGNED";

                    if (rawStatus === "WAIVED") {
                        status = "WAIVED";
                    } else if (expected <= 0) {
                        status = "NOT ASSIGNED";
                    } else if (paid >= expected) {
                        status = "PAID";
                    } else if (paid > 0) {
                        status = "PARTIAL";
                    } else {
                        status = "MISSED";
                    }

                    return {
                        ...row,
                        member_id: memberId,
                        event_id: eventId,
                        member_name:
                            getFirstValue(
                                row,
                                [
                                    "member_name",
                                    "full_name"
                                ],
                                member?.full_name ||
                                "Unknown Member"
                            ),
                        member_number:
                            getFirstValue(
                                row,
                                [
                                    "member_number"
                                ],
                                member?.member_number || "-"
                            ),
                        event_name:
                            getFirstValue(
                                row,
                                [
                                    "event_name",
                                    "event_title"
                                ],
                                event?.event_name ||
                                "Unknown Event"
                            ),
                        event_type:
                            getFirstValue(
                                row,
                                [
                                    "event_type"
                                ],
                                event?.event_type || "-"
                            ),
                        event_date:
                            getFirstValue(
                                row,
                                [
                                    "event_date",
                                    "start_date"
                                ],
                                event?.start_date || null
                            ),
                        expected_amount: expected,
                        paid_amount: paid,
                        outstanding_amount: outstanding,
                        calculated_status: status
                    };
                })
                .filter(row => row.member_id != null);

            setWelfareObligations(normalized);

            return normalized;

        } catch (err) {

            console.error(
                "Fetch welfare event obligations error:",
                err
            );

            setWelfareObligations([]);

            setObligationsError(
                err?.message ||
                "Welfare event obligation data could not be loaded."
            );

            return [];

        } finally {

            setObligationsLoading(false);
        }
    };

    // =========================================================
    // CONTRIBUTIONS
    //
    // IMPORTANT:
    // social_fund_contributions DOES NOT HAVE school_id.
    // RLS already controls school visibility.
    // =========================================================

    const fetchContributions = async () => {

        const {
            data,
            error: contributionError
        } = await supabase
            .from("social_fund_contributions")
            .select(`
                id,
                member_id,
                event_id,
                contribution_date,
                amount,
                payment_method,
                financial_account_id,
                reference_number,
                status,
                journal_entry_id,
                created_at
            `)
            .order("contribution_date", {
                ascending: false
            });

        if (contributionError) {
            throw contributionError;
        }

        const normalized = Array.isArray(data)
            ? data
            : [];

        setContributions(normalized);

        return normalized;
    };

    // =========================================================
    // DISBURSEMENTS
    // =========================================================

    const fetchDisbursements = async (profileOverride = null) => {

        const profile =
            profileOverride ||
            currentProfile ||
            await fetchProfile();

        let query = supabase
            .from("social_fund_disbursements")
            .select(`
                id,
                school_id,
                event_id,
                member_id,
                beneficiary_name,
                amount,
                purpose,
                disbursement_date,
                payment_method,
                financial_account_id,
                reference_number,
                status,
                journal_entry_id,
                approved_by,
                approved_at,
                created_by,
                created_at,
                updated_at
            `)
            .order("disbursement_date", {
                ascending: false
            });

        if (Number(profile?.role_id) !== 1) {

            if (!profile?.school_id) {
                throw new Error(
                    "Your profile is not assigned to a school."
                );
            }

            query = query.eq(
                "school_id",
                profile.school_id
            );
        }

        const {
            data,
            error: disbursementError
        } = await query;

        if (disbursementError) {
            throw disbursementError;
        }

        const normalized = Array.isArray(data)
            ? data
            : [];

        setDisbursements(normalized);

        return normalized;
    };

    // =========================================================
    // LOAD ALL FINANCIAL DATA
    // =========================================================

    const fetchFinancialData = async (profileOverride = null) => {

        try {

            setFinancialLoading(true);

            const profile =
                profileOverride ||
                currentProfile ||
                await fetchProfile();

            const [
                contributionData,
                disbursementData,
                eventData
            ] = await Promise.all([
                fetchContributions(),
                fetchDisbursements(profile),
                fetchEvents(profile)
            ]);

            const postedContributions =
                (contributionData || []).filter(
                    item =>
                        String(
                            item.status || ""
                        ).toLowerCase() === "posted"
                );

            const postedDisbursements =
                (disbursementData || []).filter(
                    item =>
                        String(
                            item.status || ""
                        ).toLowerCase() === "posted"
                );

            const totalContributions =
                postedContributions.reduce(
                    (total, item) =>
                        total +
                        (Number(item.amount) || 0),
                    0
                );

            const totalDisbursements =
                postedDisbursements.reduce(
                    (total, item) =>
                        total +
                        (Number(item.amount) || 0),
                    0
                );

            const activeEvents =
                (eventData || []).filter(
                    event =>
                        String(
                            event.status || ""
                        ).toLowerCase() === "active"
                ).length;

            setFinancialSummary({
                totalContributions,
                totalDisbursements,
                availableBalance:
                    totalContributions -
                    totalDisbursements,
                contributionTransactions:
                    postedContributions.length,
                disbursementTransactions:
                    postedDisbursements.length,
                activeEvents,
                totalEvents:
                    (eventData || []).length
            });

        } finally {

            setFinancialLoading(false);
        }
    };

    // =========================================================
    // INITIAL LOAD
    // =========================================================

    useEffect(() => {

        let mounted = true;

        const loadDashboard = async () => {

            try {

                setLoading(true);
                setError("");

                const profile =
                    await fetchProfile();

                const [
                    memberData,
                    eventData
                ] = await Promise.all([
                    fetchMembers(profile),
                    fetchEvents(profile)
                ]);

                await fetchFinancialData(profile);

                const contributionData = await fetchContributions();

                await fetchWelfareObligations(
                    profile,
                    memberData,
                    eventData,
                    contributionData
                );

                if (!mounted) {
                    return;
                }

                setLastUpdated(
                    new Date()
                );

            } catch (err) {

                console.error(
                    "Social Welfare dashboard error:",
                    err
                );

                if (mounted) {

                    setError(
                        err?.message ||
                        "Failed to load Social Welfare Dashboard."
                    );
                }

            } finally {

                if (mounted) {
                    setLoading(false);
                }
            }
        };

        loadDashboard();

        return () => {
            mounted = false;
        };

    }, []);

    // =========================================================
    // REFRESH
    // =========================================================

    const handleRefresh = async () => {

        try {

            setLoading(true);
            setError("");
            setSuccessMessage("");

            const profile =
                currentProfile ||
                await fetchProfile();

            const [
                memberData,
                eventData
            ] = await Promise.all([
                fetchMembers(profile),
                fetchEvents(profile)
            ]);

            const contributionData = await fetchContributions();

            await fetchFinancialData(profile);

            await fetchWelfareObligations(
                profile,
                memberData,
                eventData,
                contributionData
            );

            setLastUpdated(
                new Date()
            );

        } catch (err) {

            console.error(
                "Refresh welfare dashboard error:",
                err
            );

            setError(
                err?.message ||
                "Failed to refresh Social Welfare data."
            );

        } finally {

            setLoading(false);
        }
    };

    // =========================================================
    // EVENT CALCULATIONS
    // =========================================================

    const eventsWithFinancials = useMemo(() => {

        return events.map(event => {

            const eventContributions =
                contributions.filter(
                    item =>
                        item.event_id === event.id &&
                        String(
                            item.status || ""
                        ).toLowerCase() === "posted"
                );

            const eventDisbursements =
                disbursements.filter(
                    item =>
                        item.event_id === event.id &&
                        String(
                            item.status || ""
                        ).toLowerCase() === "posted"
                );

            const collected =
                eventContributions.reduce(
                    (total, item) =>
                        total +
                        (Number(item.amount) || 0),
                    0
                );

            const disbursed =
                eventDisbursements.reduce(
                    (total, item) =>
                        total +
                        (Number(item.amount) || 0),
                    0
                );

            const available =
                collected -
                disbursed;

            return {
                ...event,
                event_id: event.id,
                event_status: event.status,
                collected_amount: collected,
                disbursed_amount: disbursed,
                available_amount: available,
                contribution_transactions:
                    eventContributions.length,
                disbursement_transactions:
                    eventDisbursements.length
            };
        });

    }, [
        events,
        contributions,
        disbursements
    ]);

    // =========================================================
    // MEMBER STATISTICS
    // =========================================================

    const statistics = useMemo(() => {

        const totalMembers =
            members.length;

        const activeMembers =
            members.filter(
                member =>
                    String(
                        member.status || ""
                    ).toLowerCase() === "active"
            ).length;

        const inactiveMembers =
            members.filter(
                member =>
                    String(
                        member.status || ""
                    ).toLowerCase() !== "active"
            ).length;

        const monthlyContribution =
            members.reduce(
                (total, member) =>
                    total +
                    (
                        Number(
                            member.monthly_contribution
                        ) || 0
                    ),
                0
            );

        return {
            totalMembers,
            activeMembers,
            inactiveMembers,
            monthlyContribution
        };

    }, [members]);

    // =========================================================
    // EVENT SEARCH
    // =========================================================

    const filteredEvents = useMemo(() => {

        const search =
            eventSearch
                .trim()
                .toLowerCase();

        if (!search) {
            return eventsWithFinancials;
        }

        return eventsWithFinancials.filter(
            event =>
                String(
                    event.event_name || ""
                )
                    .toLowerCase()
                    .includes(search)
                ||
                String(
                    event.event_type || ""
                )
                    .toLowerCase()
                    .includes(search)
                ||
                String(
                    event.event_status || ""
                )
                    .toLowerCase()
                    .includes(search)
        );

    }, [
        eventsWithFinancials,
        eventSearch
    ]);

    // =========================================================
    // MEMBER STATEMENT
    // =========================================================

    const selectedStatementMember = useMemo(() => {

        if (!statementMemberId) {
            return null;
        }

        return members.find(
            member =>
                String(member.id) ===
                String(statementMemberId)
        ) || null;

    }, [
        members,
        statementMemberId
    ]);

    const memberStatementRows = useMemo(() => {

        if (!statementMemberId) {
            return [];
        }

        const member = selectedStatementMember;
        const initialBalance = Math.max(0, Number(member?.initial_balance) || 0);

        // Build the statement around EACH EVENT OBLIGATION.
        // Direct event contributions remain event contributions and are
        // never converted into Initial Balance.
        const obligationRows = (welfareObligations || [])
            .filter(row => String(row.member_id) === String(statementMemberId))
            .filter(row => String(row.status || row.assignment_status || "active").toLowerCase() !== "cancelled")
            .map(row => {
                const event = eventsWithFinancials.find(
                    item => String(item.id) === String(row.event_id)
                );

                const expected = Math.max(0, Number(row.expected_amount) || 0);
                const paid = contributions.reduce((sum, contribution) => {
                    if (
                        String(contribution.member_id) === String(statementMemberId) &&
                        String(contribution.event_id) === String(row.event_id) &&
                        String(contribution.status || "").toLowerCase() === "posted"
                    ) {
                        return sum + (Number(contribution.amount) || 0);
                    }
                    return sum;
                }, 0);

                const eventStatus = String(event?.event_status || event?.status || "").toLowerCase();
                const closed = eventStatus === "closed" || eventStatus === "completed";
                const unpaidBeforeInitial = Math.max(0, expected - paid);

                return {
                    id: `event-${row.event_id}-${row.member_id}`,
                    row_type: "event_statement",
                    contribution_date: event?.end_date || event?.start_date || row.event_date || new Date().toISOString().slice(0, 10),
                    event_id: row.event_id,
                    event_name: row.event_name || event?.event_name || "Welfare Event",
                    event_type: row.event_type || event?.event_type || "Welfare",
                    expected_amount: expected,
                    paid_amount: paid,
                    outstanding_before_initial: unpaidBeforeInitial,
                    event_closed: closed,
                    status_label: paid >= expected && expected > 0
                        ? "FULL CONTRIBUTION"
                        : paid > 0
                            ? "PARTIAL"
                            : closed
                                ? "MISSED EVENT"
                                : "NOT PAID"
                };
            })
            .sort((a, b) => new Date(a.contribution_date || 0) - new Date(b.contribution_date || 0));

        // Initial Balance is applied ONLY to debt from CLOSED events.
        let initialAvailable = initialBalance;
        const eventRows = obligationRows.map(row => {
            const initialApplied = row.event_closed
                ? Math.min(initialAvailable, row.outstanding_before_initial)
                : 0;

            initialAvailable = Math.max(0, initialAvailable - initialApplied);

            const debtRemaining = Math.max(0, row.outstanding_before_initial - initialApplied);

            return {
                ...row,
                initial_applied: initialApplied,
                debt_remaining: debtRemaining,
                status_label: row.paid_amount >= row.expected_amount && row.expected_amount > 0
                    ? "FULL CONTRIBUTION"
                    : initialApplied > 0 && debtRemaining === 0
                        ? "SETTLED BY INITIAL BALANCE"
                        : row.paid_amount > 0 && debtRemaining > 0
                            ? "PARTIAL / DEBT REMAINING"
                            : row.event_closed && debtRemaining > 0
                                ? "MISSED EVENT / DEBT"
                                : row.paid_amount > 0
                                    ? "PARTIAL"
                                    : row.event_closed
                                        ? "MISSED EVENT"
                                        : "NOT PAID"
            };
        });

        // Keep the opening Initial Balance visible as a separate non-event row.
        const openingRows = initialBalance > 0
            ? [{
                id: `initial-${statementMemberId}`,
                row_type: "initial_balance",
                contribution_date: member?.join_date || new Date().toISOString().slice(0, 10),
                event_id: null,
                event_name: "Initial Balance",
                event_type: "Opening",
                expected_amount: 0,
                paid_amount: 0,
                outstanding_before_initial: 0,
                initial_applied: initialBalance - initialAvailable,
                debt_remaining: 0,
                status_label: "INITIAL BALANCE"
            }]
            : [];

        return [...openingRows, ...eventRows];

    }, [statementMemberId, selectedStatementMember, contributions, eventsWithFinancials, welfareObligations]);

    // Member balance is independent from total contributions.
    // Contributions belong to welfare events/expenses. Only the Initial
    // Balance is available to absorb debt from events that have been closed.
    const selectedMemberTotal = useMemo(() => {
        return contributions.reduce((total, item) => {
            if (String(item.member_id) === String(statementMemberId) && String(item.status || "").toLowerCase() === "posted") {
                return total + (Number(item.amount) || 0);
            }
            return total;
        }, 0);
    }, [contributions, statementMemberId]);

    const selectedMemberClosedDebt = useMemo(() => {
        return (welfareObligations || []).reduce((total, row) => {
            if (String(row.member_id) !== String(statementMemberId)) return total;
            const event = eventsWithFinancials.find(item => String(item.id) === String(row.event_id));
            const assignmentStatus = String(row.status || row.assignment_status || "active").toLowerCase();
            if (assignmentStatus === "cancelled") return total;
            const eventStatus = String(event?.event_status || event?.status || "").toLowerCase();
            if (eventStatus !== "completed" && eventStatus !== "closed") return total;
            return total + Math.max(0, Number(row.outstanding_amount) || 0);
        }, 0);
    }, [welfareObligations, eventsWithFinancials, statementMemberId]);

    const selectedMemberInitialBalance = Math.max(0, Number(selectedStatementMember?.initial_balance) || 0);
    const selectedMemberInitialApplied = Math.min(selectedMemberInitialBalance, selectedMemberClosedDebt);
    const selectedMemberInitialRemaining = Math.max(0, selectedMemberInitialBalance - selectedMemberInitialApplied);
    const selectedMemberDebtRemaining = Math.max(0, selectedMemberClosedDebt - selectedMemberInitialApplied);
    const selectedMemberNetInitialBalance = selectedMemberInitialRemaining;
    const selectedMemberFinalStatus = selectedMemberDebtRemaining > 0
        ? "DEBT REMAINING"
        : selectedMemberNetInitialBalance > 0
            ? "NET INITIAL BALANCE"
            : "ZERO BALANCE";

    // =========================================================
    // EVENT STATEMENT
    // =========================================================

    const selectedStatementEvent =
        useMemo(() => {

            if (!statementEventId) {
                return null;
            }

            return eventsWithFinancials.find(
                event =>
                    String(event.id) ===
                    String(statementEventId)
            ) || null;

        }, [
            statementEventId,
            eventsWithFinancials
        ]);

    const eventStatementContributions =
        useMemo(() => {

            if (!statementEventId) {
                return [];
            }

            return contributions
                .filter(
                    contribution =>
                        String(
                            contribution.event_id
                        ) ===
                        String(statementEventId)
                )
                .map(contribution => {

                    const member =
                        members.find(
                            item =>
                                String(item.id) ===
                                String(
                                    contribution.member_id
                                )
                        );

                    return {
                        ...contribution,
                        member_name:
                            member?.full_name ||
                            "Unknown Member",
                        member_type:
                            member?.member_type ||
                            "-"
                    };

                })
                .sort(
                    (a, b) =>
                        new Date(
                            b.contribution_date
                        ) -
                        new Date(
                            a.contribution_date
                        )
                );

        }, [
            statementEventId,
            contributions,
            members
        ]);

    const eventStatementDisbursements =
        useMemo(() => {

            if (!statementEventId) {
                return [];
            }

            return disbursements
                .filter(
                    item =>
                        String(
                            item.event_id
                        ) ===
                        String(statementEventId)
                )
                .map(item => {

                    const member =
                        members.find(
                            member =>
                                String(member.id) ===
                                String(item.member_id)
                        );

                    return {
                        ...item,
                        member_name:
                            member?.full_name ||
                            "-"
                    };
                })
                .sort(
                    (a, b) =>
                        new Date(
                            b.disbursement_date
                        ) -
                        new Date(
                            a.disbursement_date
                        )
                );

        }, [
            statementEventId,
            disbursements,
            members
        ]);

    // =========================================================
    // ALL MEMBER STATEMENT SUMMARY
    // =========================================================

    const allMemberStatement = useMemo(() => {

        const search =
            statementSearch
                .trim()
                .toLowerCase();

        return members
            .map(member => {

                const rows =
                    contributions.filter(
                        contribution =>
                            String(
                                contribution.member_id
                            ) ===
                            String(member.id)
                    );

                const postedRows =
                    rows.filter(
                        row =>
                            String(
                                row.status || ""
                            ).toLowerCase() ===
                            "posted"
                    );

                const total =
                    postedRows.reduce(
                        (sum, row) =>
                            sum +
                            (
                                Number(
                                    row.amount
                                ) || 0
                            ),
                        0
                    );

                const eventCount =
                    new Set(
                        postedRows
                            .map(
                                row =>
                                    row.event_id
                            )
                            .filter(Boolean)
                    ).size;

                const lastContribution =
                    postedRows.length
                        ? postedRows
                              .slice()
                              .sort(
                                  (a, b) =>
                                      new Date(
                                          b.contribution_date
                                      ) -
                                      new Date(
                                          a.contribution_date
                                      )
                              )[0]
                              ?.contribution_date
                        : null;

                const memberClosedDebt = (welfareObligations || []).reduce((sum, obligation) => {
                    if (String(obligation.member_id) !== String(member.id)) return sum;
                    const event = eventsWithFinancials.find(item => String(item.id) === String(obligation.event_id));
                    const eventStatus = String(event?.event_status || event?.status || "").toLowerCase();
                    if (eventStatus !== "completed" && eventStatus !== "closed") return sum;
                    return sum + Math.max(0, Number(obligation.outstanding_amount) || 0);
                }, 0);

                const memberInitialBalance = Math.max(0, Number(member.initial_balance) || 0);
                const memberInitialUsed = Math.min(memberInitialBalance, memberClosedDebt);
                const memberNetInitialBalance = Math.max(0, memberInitialBalance - memberInitialUsed);
                const memberDebtRemaining = Math.max(0, memberClosedDebt - memberInitialUsed);

                return {
                    ...member,
                    totalContribution: total,
                    eventCount,
                    lastContribution,
                    closedDebt: memberClosedDebt,
                    initialUsed: memberInitialUsed,
                    netInitialBalance: memberNetInitialBalance,
                    debtRemaining: memberDebtRemaining
                };

            })
            .filter(member => {

                if (!search) {
                    return true;
                }

                return (
                    String(
                        member.full_name || ""
                    )
                        .toLowerCase()
                        .includes(search)
                    ||
                    String(
                        member.member_number || ""
                    )
                        .toLowerCase()
                        .includes(search)
                    ||
                    String(
                        member.phone || ""
                    )
                        .toLowerCase()
                        .includes(search)
                    ||
                    String(
                        member.member_type || ""
                    )
                        .toLowerCase()
                        .includes(search)
                );

            })
            .sort(
                (a, b) =>
                    b.totalContribution -
                    a.totalContribution
            );

    }, [
        members,
        contributions,
        welfareObligations,
        eventsWithFinancials,
        statementSearch
    ]);

    // =========================================================
    // WELFARE OBLIGATION STATEMENTS
    // =========================================================

    const statementSummary = useMemo(() => {

        const rows = welfareObligations || [];

        const totalExpected =
            rows.reduce(
                (sum, row) =>
                    sum +
                    (Number(row.expected_amount) || 0),
                0
            );

        const totalPaid =
            rows.reduce(
                (sum, row) =>
                    sum +
                    (Number(row.paid_amount) || 0),
                0
            );

        const totalOutstanding =
            rows.reduce(
                (sum, row) =>
                    sum +
                    (Number(row.outstanding_amount) || 0),
                0
            );

        return {
            totalExpected,
            totalPaid,
            totalOutstanding,
            paidCount: rows.filter(
                row => row.calculated_status === "PAID"
            ).length,
            partialCount: rows.filter(
                row => row.calculated_status === "PARTIAL"
            ).length,
            missedCount: rows.filter(
                row => row.calculated_status === "MISSED"
            ).length,
            waivedCount: rows.filter(
                row => row.calculated_status === "WAIVED"
            ).length,
            notAssignedCount: rows.filter(
                row => row.calculated_status === "NOT ASSIGNED"
            ).length
        };

    }, [welfareObligations]);

    const filteredStatementObligations = useMemo(() => {

        const search =
            statementSearch
                .trim()
                .toLowerCase();

        return (welfareObligations || [])
            .filter(row => {

                if (!search) {
                    return true;
                }

                return (
                    String(row.member_name || "")
                        .toLowerCase()
                        .includes(search) ||
                    String(row.member_number || "")
                        .toLowerCase()
                        .includes(search) ||
                    String(row.event_name || "")
                        .toLowerCase()
                        .includes(search) ||
                    String(row.event_type || "")
                        .toLowerCase()
                        .includes(search) ||
                    String(row.calculated_status || "")
                        .toLowerCase()
                        .includes(search)
                );

            })
            .sort(
                (a, b) =>
                    (Number(b.outstanding_amount) || 0) -
                    (Number(a.outstanding_amount) || 0)
            );

    }, [
        welfareObligations,
        statementSearch
    ]);

    const selectedMemberObligations = useMemo(() => {

        if (!statementMemberId) {
            return [];
        }

        return (welfareObligations || [])
            .filter(
                row =>
                    String(row.member_id) ===
                    String(statementMemberId)
            )
            .sort(
                (a, b) =>
                    (Number(b.outstanding_amount) || 0) -
                    (Number(a.outstanding_amount) || 0)
            );

    }, [
        welfareObligations,
        statementMemberId
    ]);

    const selectedMemberObligationSummary = useMemo(() => {

        const rows =
            selectedMemberObligations || [];

        return {
            expected:
                rows.reduce(
                    (sum, row) =>
                        sum +
                        (Number(row.expected_amount) || 0),
                    0
                ),
            paid:
                rows.reduce(
                    (sum, row) =>
                        sum +
                        (Number(row.paid_amount) || 0),
                    0
                ),
            outstanding:
                rows.reduce(
                    (sum, row) =>
                        sum +
                        (Number(row.outstanding_amount) || 0),
                    0
                ),
            paidCount:
                rows.filter(
                    row =>
                        row.calculated_status === "PAID"
                ).length,
            partialCount:
                rows.filter(
                    row =>
                        row.calculated_status === "PARTIAL"
                ).length,
            missedCount:
                rows.filter(
                    row =>
                        row.calculated_status === "MISSED"
                ).length
        };

    }, [selectedMemberObligations]);

    const getObligationStatusClass = status => {

        switch (status) {

            case "PAID":
                return "bg-green-100 text-green-700 border-green-200";

            case "PARTIAL":
                return "bg-yellow-100 text-yellow-700 border-yellow-200";

            case "MISSED":
                return "bg-red-100 text-red-700 border-red-200";

            case "WAIVED":
                return "bg-blue-100 text-blue-700 border-blue-200";

            default:
                return "bg-slate-100 text-slate-600 border-slate-200";
        }
    };

    const getObligationStatusDot = status => {

        switch (status) {

            case "PAID":
                return "bg-green-500";

            case "PARTIAL":
                return "bg-yellow-500";

            case "MISSED":
                return "bg-red-500";

            case "WAIVED":
                return "bg-blue-500";

            default:
                return "bg-slate-400";
        }
    };

    // =========================================================
    // FORMAT MONEY
    // =========================================================

    const formatMoney = (amount) => {

        const value =
            Number(amount) || 0;

        return new Intl.NumberFormat(
            "en-TZ",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        ).format(value);
    };

    // =========================================================
    // FORMAT DATE
    // =========================================================

    const formatDate = (date) => {

        if (!date) {
            return "-";
        }

        try {

            return new Intl.DateTimeFormat(
                "en-TZ",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            ).format(
                new Date(date)
            );

        } catch {

            return date;
        }
    };

    // =========================================================
    // INTERNAL NAVIGATION
    // =========================================================

    const openSection = (section) => {

        setActiveSection(section);

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };

    // =========================================================
    // CREATE EVENT
    // =========================================================

    const openCreateEvent = () => {

        setSelectedEvent(null);

        setEventForm({
            ...emptyEventForm,
            start_date:
                new Date()
                    .toISOString()
                    .slice(0, 10)
        });

        setEventAssignments([]);
        setEventAssignmentMemberId("");
        setEventAssignmentExpectedAmount("");
        setEventModalOpen(true);
    };

    // =========================================================
    // EVENT DETAILS
    // =========================================================

    const openEventDetails = (event) => {

        setSelectedEvent(event);
    };

    // =========================================================
    // CONTRIBUTION MODAL
    // =========================================================

    const openContributionModal = (event = null) => {

        setContributionForm({
            ...emptyContributionForm,
            event_id:
                event?.event_id ||
                event?.id ||
                ""
        });

        setContributionModalOpen(true);
    };

    // =========================================================
    // DISBURSEMENT MODAL
    // =========================================================

    const openDisbursementModal = (event = null) => {

        setDisbursementForm({
            ...emptyDisbursementForm,
            event_id:
                event?.event_id ||
                event?.id ||
                ""
        });

        setDisbursementModalOpen(true);
    };

    // =========================================================
    // CREATE EVENT
    // =========================================================

    const addEventCreationAssignment = () => {

        if (!eventAssignmentMemberId) {
            setError("Please select a welfare member to assign.");
            return;
        }

        const expectedAmount = Number(eventAssignmentExpectedAmount);

        if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
            setError("Please enter a valid expected contribution amount.");
            return;
        }

        if (eventAssignments.some(item => String(item.member_id) === String(eventAssignmentMemberId))) {
            setError("This member is already assigned to this event.");
            return;
        }

        const member = members.find(item => String(item.id) === String(eventAssignmentMemberId));

        if (!member) {
            setError("Selected welfare member could not be found.");
            return;
        }

        setEventAssignments(prev => [
            ...prev,
            {
                member_id: Number(eventAssignmentMemberId),
                member_name: member.full_name,
                member_number: member.member_number || "",
                expected_amount: expectedAmount
            }
        ]);

        setEventAssignmentMemberId("");
        setEventAssignmentExpectedAmount("");
        setError("");
    };

    const removeEventCreationAssignment = (memberId) => {
        setEventAssignments(prev =>
            prev.filter(item => String(item.member_id) !== String(memberId))
        );
    };

    const handleCreateEvent = async (e) => {

        e.preventDefault();

        try {

            if (!currentProfile) {
                throw new Error(
                    "Current profile is not available."
                );
            }

            if (!currentProfile.school_id) {
                throw new Error(
                    "Your profile is not assigned to a school."
                );
            }

            if (
                !eventForm.event_name.trim()
            ) {
                throw new Error(
                    "Event name is required."
                );
            }

            if (
                eventForm.target_amount === "" ||
                Number(
                    eventForm.target_amount
                ) < 0
            ) {
                throw new Error(
                    "Please enter a valid target amount."
                );
            }

            if (eventAssignments.length === 0) {
                throw new Error(
                    "Please assign at least one welfare member and set their expected contribution amount before creating the event."
                );
            }

            setSaving(true);
            setError("");
            setSuccessMessage("");

            const {
                data: createdEvent,
                error: insertError
            } = await supabase
                .from("social_fund_events")
                .insert([
                    {
                        school_id:
                            currentProfile.school_id,

                        event_name:
                            eventForm.event_name.trim(),

                        event_type:
                            eventForm.event_type,

                        description:
                            eventForm.description.trim() ||
                            null,

                        target_amount:
                            Number(
                                eventForm.target_amount
                            ) || 0,

                        start_date:
                            eventForm.start_date,

                        end_date:
                            eventForm.end_date ||
                            null,

                        status:
                            "Active",

                        created_by:
                            currentProfile.id
                    }
                ])
                .select("id")
                .single();

            if (insertError) {
                throw insertError;
            }

            if (!createdEvent?.id) {
                throw new Error("The welfare event was created but its ID could not be retrieved.");
            }

            // Save all member assignments made during event creation.
            // Each member gets an event-specific expected contribution amount.
            if (eventAssignments.length > 0) {
                const assignmentRows = eventAssignments.map(item => ({
                    event_id: createdEvent.id,
                    member_id: Number(item.member_id),
                    expected_amount: Number(item.expected_amount),
                    status: "Active"
                }));

                const { error: assignmentError } = await supabase
                    .from("social_fund_event_members")
                    .insert(assignmentRows);

                if (assignmentError) {
                    throw assignmentError;
                }
            }

            setEventModalOpen(false);
            setEventForm(emptyEventForm);
            setEventAssignments([]);
            setEventAssignmentMemberId("");
            setEventAssignmentExpectedAmount("");

            await fetchFinancialData(
                currentProfile
            );

            setSuccessMessage(
                "Welfare event created successfully."
            );

            setActiveSection("events");

        } catch (err) {

            console.error(
                "Create welfare event error:",
                err
            );

            setError(
                err?.message ||
                "Failed to create welfare event."
            );

        } finally {

            setSaving(false);
        }
    };

    // =========================================================
    // UPDATE EVENT STATUS
    // =========================================================

    const updateEventStatus = async (
        event,
        status
    ) => {

        try {

            if (!event?.id) {
                return;
            }

            const confirmed =
                window.confirm(
                    status === "Closed"
                        ? "Close this welfare event? Its financial history will remain available."
                        : "Cancel this welfare event? Its history will remain available."
                );

            if (!confirmed) {
                return;
            }

            setSaving(true);
            setError("");
            setSuccessMessage("");

            // The database constraint accepts: draft, active, completed, cancelled.
            // The UI uses "Closed" as the button/action label, so translate it
            // to the actual persisted status "completed" before updating Supabase.
            const dbStatus =
                String(status || "").toLowerCase() === "closed"
                    ? "completed"
                    : String(status || "").toLowerCase() === "cancelled"
                        ? "cancelled"
                        : String(status || "").toLowerCase();

            const {
                error: updateError
            } = await supabase
                .from("social_fund_events")
                .update({
                    status: dbStatus
                })
                .eq(
                    "id",
                    event.id
                );

            if (updateError) {
                throw updateError;
            }

            setSelectedEvent(null);

            await fetchFinancialData(
                currentProfile
            );

            setSuccessMessage(
                status === "Cancelled"
                    ? "Welfare event cancelled successfully."
                    : "Welfare event closed successfully."
            );

        } catch (err) {

            console.error(
                "Update welfare event status error:",
                err
            );

            setError(
                err?.message ||
                "Failed to update welfare event."
            );

        } finally {

            setSaving(false);
        }
    };

    // =========================================================
    // DELETE CANCELLED EVENT
    // =========================================================

    const handleDeleteCancelledEvent = async (
        event
    ) => {

        try {

            if (!event?.id) {
                return;
            }

            if (
                String(
                    event.status || ""
                ).toLowerCase() !==
                "cancelled"
            ) {

                setError(
                    "Only cancelled events can be deleted."
                );

                return;
            }

            const confirmed =
                window.confirm(
                    `Delete the cancelled event "${event.event_name}"? This action cannot be undone.`
                );

            if (!confirmed) {
                return;
            }

            setSaving(true);
            setError("");
            setSuccessMessage("");

            const {
                data,
                error: rpcError
            } = await supabase.rpc(
                "delete_cancelled_social_fund_event",
                {
                    p_event_id:
                        event.id
                }
            );

            if (rpcError) {
                throw rpcError;
            }

            if (
                !data?.success
            ) {

                throw new Error(
                    data?.message ||
                    "The event could not be deleted."
                );
            }

            setSelectedEvent(null);

            await fetchFinancialData(
                currentProfile
            );

            setSuccessMessage(
                "Cancelled welfare event deleted successfully."
            );

        } catch (err) {

            console.error(
                "Delete welfare event error:",
                err
            );

            setError(
                err?.message ||
                "Failed to delete welfare event."
            );

        } finally {

            setSaving(false);
        }
    };

    // =========================================================
    // RECORD CONTRIBUTION
    // =========================================================

    const handleAssignEventMember = async () => {
        try {
            if (!selectedEvent?.id) throw new Error("Please select a welfare event first.");
            if (String(selectedEvent.event_status || "").toLowerCase() !== "active") throw new Error("Members can only be assigned to an active welfare event.");
            if (!assignmentMemberId) throw new Error("Please select a welfare member.");
            const expectedAmount = Number(assignmentExpectedAmount);
            if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) throw new Error("Please enter a valid expected contribution amount.");
            if ((welfareObligations || []).some(row => String(row.event_id) === String(selectedEvent.id) && String(row.member_id) === String(assignmentMemberId))) throw new Error("This member is already assigned to this event.");
            setAssignmentSaving(true); setError(""); setSuccessMessage("");
            const { error: insertError } = await supabase.from("social_fund_event_members").insert([{ event_id: selectedEvent.id, member_id: Number(assignmentMemberId), expected_amount: expectedAmount, status: "Active" }]);
            if (insertError) {
                if (String(insertError.code) === "23505") throw new Error("This member is already assigned to this welfare event.");
                throw insertError;
            }
            setAssignmentMemberId(""); setAssignmentExpectedAmount("");
            const contributionData = await fetchContributions();
            await fetchWelfareObligations(currentProfile, null, null, contributionData);
            await fetchFinancialData(currentProfile);
            setSuccessMessage("Member assigned to the welfare event successfully.");
        } catch (err) {
            console.error("Assign welfare event member error:", err);
            setError(err?.message || "Failed to assign member to welfare event.");
        } finally { setAssignmentSaving(false); }
    };

    const handleRecordContribution = async (
        e
    ) => {

        e.preventDefault();

        try {

            if (!currentProfile?.school_id) {
                throw new Error(
                    "Your profile is not assigned to a school."
                );
            }

            if (!contributionForm.member_id) {
                throw new Error(
                    "Please select a welfare member."
                );
            }

            if (!contributionForm.event_id) {
                throw new Error(
                    "Please select the welfare event."
                );
            }

            if (
                !contributionForm.amount ||
                Number(
                    contributionForm.amount
                ) <= 0
            ) {
                throw new Error(
                    "Please enter a valid contribution amount."
                );
            }

            const selectedEvent =
                eventsWithFinancials.find(
                    event =>
                        String(
                            event.id
                        ) ===
                        String(
                            contributionForm.event_id
                        )
                );

            if (
                String(
                    selectedEvent?.event_status ||
                    ""
                ).toLowerCase() !==
                "active"
            ) {
                throw new Error(
                    "Contribution can only be recorded for an active event."
                );
            }

            setSaving(true);
            setError("");
            setSuccessMessage("");

            const {
                error: insertError
            } = await supabase
                .from("social_fund_contributions")
                .insert([
                    {
                        member_id:
                            Number(
                                contributionForm.member_id
                            ),

                        contribution_date:
                            contributionForm.contribution_date,

                        amount:
                            Number(
                                contributionForm.amount
                            ),

                        payment_method:
                            contributionForm.payment_method,

                        reference_number:
                            contributionForm.reference_number.trim() ||
                            null,

                        status:
                            "posted",

                        event_id:
                            contributionForm.event_id
                    }
                ]);

            if (insertError) {
                throw insertError;
            }

            setContributionModalOpen(false);
            setContributionForm(
                emptyContributionForm
            );

            const contributionData = await fetchContributions();

            await fetchFinancialData(
                currentProfile
            );

            await fetchWelfareObligations(
                currentProfile,
                null,
                null,
                contributionData
            );

            setSuccessMessage(
                "Welfare contribution saved successfully."
            );

        } catch (err) {

            console.error(
                "Record welfare contribution error:",
                err
            );

            setError(
                err?.message ||
                "Failed to record welfare contribution."
            );

        } finally {

            setSaving(false);
        }
    };

    // =========================================================
    // RECORD DISBURSEMENT
    // =========================================================

    const handleRecordDisbursement = async (
        e
    ) => {

        e.preventDefault();

        try {

            if (!currentProfile?.school_id) {
                throw new Error(
                    "Your profile is not assigned to a school."
                );
            }

            if (!disbursementForm.event_id) {
                throw new Error(
                    "Please select a welfare event."
                );
            }

            if (
                !disbursementForm.amount ||
                Number(
                    disbursementForm.amount
                ) <= 0
            ) {
                throw new Error(
                    "Please enter a valid disbursement amount."
                );
            }

            if (
                !disbursementForm.purpose.trim()
            ) {
                throw new Error(
                    "Disbursement purpose is required."
                );
            }

            const selectedEvent =
                eventsWithFinancials.find(
                    event =>
                        String(
                            event.id
                        ) ===
                        String(
                            disbursementForm.event_id
                        )
                );

            if (
                String(
                    selectedEvent?.event_status ||
                    ""
                ).toLowerCase() !==
                "active"
            ) {
                throw new Error(
                    "Disbursement can only be recorded for an active event."
                );
            }

            const available =
                Number(
                    selectedEvent?.available_amount
                ) || 0;

            if (
                Number(
                    disbursementForm.amount
                ) > available
            ) {
                throw new Error(
                    `Disbursement exceeds the available event balance of TZS ${formatMoney(
                        available
                    )}.`
                );
            }

            setSaving(true);
            setError("");
            setSuccessMessage("");

            const {
                error: insertError
            } = await supabase
                .from("social_fund_disbursements")
                .insert([
                    {
                        school_id:
                            currentProfile.school_id,

                        event_id:
                            disbursementForm.event_id,

                        member_id:
                            disbursementForm.member_id
                                ? Number(
                                    disbursementForm.member_id
                                )
                                : null,

                        beneficiary_name:
                            disbursementForm.beneficiary_name.trim() ||
                            null,

                        amount:
                            Number(
                                disbursementForm.amount
                            ),

                        purpose:
                            disbursementForm.purpose.trim(),

                        disbursement_date:
                            disbursementForm.disbursement_date,

                        payment_method:
                            disbursementForm.payment_method,

                        financial_account_id:
                            disbursementForm.financial_account_id
                                ? Number(
                                    disbursementForm.financial_account_id
                                )
                                : null,

                        reference_number:
                            disbursementForm.reference_number.trim() ||
                            null,

                        status:
                            "posted",

                        created_by:
                            currentProfile.id
                    }
                ]);

            if (insertError) {
                throw insertError;
            }

            setDisbursementModalOpen(false);

            setDisbursementForm(
                emptyDisbursementForm
            );

            await fetchFinancialData(
                currentProfile
            );

            setSuccessMessage(
                "Welfare disbursement saved successfully."
            );

        } catch (err) {

            console.error(
                "Record welfare disbursement error:",
                err
            );

            setError(
                err?.message ||
                "Failed to record welfare disbursement."
            );

        } finally {

            setSaving(false);
        }
    };

    // =========================================================
    // EVENT ICON
    // =========================================================

    const getEventIcon = (
        eventType
    ) => {

        const type =
            String(
                eventType || ""
            ).toLowerCase();

        if (
            type.includes("medical")
        ) {
            return <FaHospital />;
        }

        if (
            type.includes("wedding")
        ) {
            return <FaHeart />;
        }

        if (
            type.includes("bereavement") ||
            type.includes("funeral")
        ) {
            return <FaCross />;
        }

        if (
            type.includes("emergency")
        ) {
            return <FaExclamationTriangle />;
        }

        return <FaHandHoldingHeart />;
    };

    // =========================================================
    // STATUS CLASS
    // =========================================================

    const getEventStatusClass = (
        status
    ) => {

        const normalized =
            String(
                status || ""
            ).toLowerCase();

        if (
            normalized === "active"
        ) {
            return "bg-green-100 text-green-700";
        }

        if (
            normalized === "closed"
        ) {
            return "bg-slate-100 text-slate-600";
        }

        if (
            normalized === "cancelled"
        ) {
            return "bg-red-100 text-red-700";
        }

        return "bg-orange-100 text-orange-700";
    };

    // =========================================================
    // EVENT PROGRESS
    // =========================================================

    const getEventProgress = (
        event
    ) => {

        const target =
            Number(
                event.target_amount
            ) || 0;

        const collected =
            Number(
                event.collected_amount
            ) || 0;

        if (target <= 0) {
            return 0;
        }

        return Math.min(
            100,
            Math.round(
                (
                    collected /
                    target
                ) * 100
            )
        );
    };

    // =========================================================
    // PRINT MEMBER STATEMENT
    // =========================================================

    const printMemberStatement = () => {

        if (!selectedStatementMember) {
            return;
        }

        const rows = memberStatementRows.map(item => `
            <tr>
                <td>${formatDate(item.contribution_date)}</td>
                <td>${item.description}</td>
                <td>${item.event_name}</td>
                <td style="text-align:right;color:#b91c1c;">${item.debit > 0 ? `TZS ${formatMoney(item.debit)}` : "-"}</td>
                <td style="text-align:right;color:#047857;">${item.credit > 0 ? `TZS ${formatMoney(item.credit)}` : "-"}</td>
                <td style="text-align:right;font-weight:bold;">TZS ${formatMoney(Math.abs(item.runningContributionBalance))} ${item.runningContributionBalance >= 0 ? "CR" : "DR"}</td>
                <td>${item.status_label}</td>
            </tr>
        `).join("");

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Member Welfare Bank Statement</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 30px; color: #1e293b; }
                    h1 { margin-bottom: 5px; }
                    .muted { color: #64748b; }
                    .summary { margin: 25px 0; padding: 18px; background: #f8fafc; border-radius: 10px; }
                    .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:15px; }
                    .box { padding:12px; background:#fff; border:1px solid #e2e8f0; border-radius:8px; }
                    .label { font-size:11px; color:#64748b; }
                    .value { font-size:15px; font-weight:bold; margin-top:5px; }
                    table { width:100%; border-collapse:collapse; margin-top:20px; }
                    th, td { border:1px solid #e2e8f0; padding:8px; text-align:left; font-size:11px; }
                    th { background:#f1f5f9; }
                    @media print { body { padding:10px; } }
                </style>
            </head>
            <body>
                <h1>AfriCore Social Welfare</h1>
                <p class="muted">Individual Member Welfare Bank Statement</p>
                <div class="summary">
                    <strong>Member:</strong> ${selectedStatementMember.full_name}<br />
                    <strong>Member Number:</strong> ${selectedStatementMember.member_number || "-"}<br />
                    <strong>Member Type:</strong> ${selectedStatementMember.member_type || "-"}<br />
                    <strong>Phone:</strong> ${selectedStatementMember.phone || "-"}
                    <div class="grid">
                        <div class="box"><div class="label">Total Contributions</div><div class="value">TZS ${formatMoney(selectedMemberTotal)}</div></div>
                        <div class="box"><div class="label">Net Initial Balance</div><div class="value">TZS ${formatMoney(selectedMemberNetInitialBalance)}</div></div>
                        <div class="box"><div class="label">Initial Balance Used for Debt</div><div class="value">TZS ${formatMoney(selectedMemberInitialApplied)}</div></div><div class="box"><div class="label">Debt Remaining</div><div class="value">TZS ${formatMoney(selectedMemberDebtRemaining)}</div></div>
                        <div class="box"><div class="label">Final ${selectedMemberFinalStatus}</div><div class="value">TZS ${formatMoney(selectedMemberDebtRemaining > 0 ? selectedMemberDebtRemaining : selectedMemberNetInitialBalance)}</div></div>
                    </div>
                </div>
                <table>
                    <thead><tr><th>Date</th><th>Description</th><th>Event</th><th>Debit</th><th>Credit</th><th>Balance</th><th>Status</th></tr></thead>
                    <tbody>${rows || `<tr><td colspan="7">No statement records found.</td></tr>`}</tbody>
                </table>
                <p style="margin-top:30px;color:#64748b;">Generated by AfriCore ERP Social Welfare.</p>
            </body>
            </html>
        `;

        const printWindow = window.open("", "_blank", "width=1100,height=850");

        if (!printWindow) {
            setError("Please allow pop-ups to print the statement.");
            return;
        }

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 300);
    };

    // =========================================================
    // PRINT EVENT STATEMENT
    // =========================================================

    const printEventStatement = () => {

        if (!selectedStatementEvent) {
            return;
        }

        const contributionRows =
            eventStatementContributions
                .map(
                    item => `
                        <tr>
                            <td>${formatDate(
                                item.contribution_date
                            )}</td>
                            <td>${item.member_name}</td>
                            <td>${item.member_type}</td>
                            <td>${item.payment_method || "-"}</td>
                            <td style="text-align:right;">
                                TZS ${formatMoney(item.amount)}
                            </td>
                        </tr>
                    `
                )
                .join("");

        const disbursementRows =
            eventStatementDisbursements
                .map(
                    item => `
                        <tr>
                            <td>${formatDate(
                                item.disbursement_date
                            )}</td>
                            <td>${item.beneficiary_name || item.member_name}</td>
                            <td>${item.purpose}</td>
                            <td>${item.payment_method || "-"}</td>
                            <td style="text-align:right;">
                                TZS ${formatMoney(item.amount)}
                            </td>
                        </tr>
                    `
                )
                .join("");

        const html = `
            <!DOCTYPE html>
            <html>
            <head>

                <title>
                    Welfare Event Statement
                </title>

                <style>

                    body {
                        font-family: Arial, sans-serif;
                        padding: 30px;
                        color: #1e293b;
                    }

                    h1 {
                        margin-bottom: 5px;
                    }

                    .muted {
                        color: #64748b;
                    }

                    .cards {
                        display: grid;
                        grid-template-columns:
                            repeat(4, 1fr);
                        gap: 12px;
                        margin: 25px 0;
                    }

                    .card {
                        background: #f8fafc;
                        padding: 15px;
                        border-radius: 8px;
                    }

                    .label {
                        font-size: 11px;
                        color: #64748b;
                    }

                    .value {
                        font-size: 18px;
                        font-weight: bold;
                        margin-top: 5px;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 15px;
                    }

                    th,
                    td {
                        border: 1px solid #e2e8f0;
                        padding: 8px;
                        font-size: 12px;
                        text-align: left;
                    }

                    th {
                        background: #f1f5f9;
                    }

                    h2 {
                        margin-top: 30px;
                    }

                    @media print {

                        body {
                            padding: 10px;
                        }

                        .cards {
                            grid-template-columns:
                                repeat(4, 1fr);
                        }
                    }

                </style>

            </head>

            <body>

                <h1>
                    AfriCore Social Welfare
                </h1>

                <p class="muted">
                    Welfare Event Statement
                </p>

                <h2>
                    ${selectedStatementEvent.event_name}
                </h2>

                <p>
                    Type:
                    <strong>
                        ${selectedStatementEvent.event_type}
                    </strong>
                </p>

                <p>
                    Status:
                    <strong>
                        ${selectedStatementEvent.event_status}
                    </strong>
                </p>

                <div class="cards">

                    <div class="card">
                        <div class="label">
                            Target
                        </div>
                        <div class="value">
                            TZS ${formatMoney(
                                selectedStatementEvent.target_amount
                            )}
                        </div>
                    </div>

                    <div class="card">
                        <div class="label">
                            Collected
                        </div>
                        <div class="value">
                            TZS ${formatMoney(
                                selectedStatementEvent.collected_amount
                            )}
                        </div>
                    </div>

                    <div class="card">
                        <div class="label">
                            Disbursed
                        </div>
                        <div class="value">
                            TZS ${formatMoney(
                                selectedStatementEvent.disbursed_amount
                            )}
                        </div>
                    </div>

                    <div class="card">
                        <div class="label">
                            Available
                        </div>
                        <div class="value">
                            TZS ${formatMoney(
                                selectedStatementEvent.available_amount
                            )}
                        </div>
                    </div>

                </div>

                <h2>
                    Contributions
                </h2>

                <table>

                    <thead>

                        <tr>
                            <th>Date</th>
                            <th>Member</th>
                            <th>Type</th>
                            <th>Payment Method</th>
                            <th>Amount</th>
                        </tr>

                    </thead>

                    <tbody>

                        ${
                            contributionRows ||
                            `
                                <tr>
                                    <td colspan="5">
                                        No contribution records.
                                    </td>
                                </tr>
                            `
                        }

                    </tbody>

                </table>

                <h2>
                    Disbursements
                </h2>

                <table>

                    <thead>

                        <tr>
                            <th>Date</th>
                            <th>Beneficiary</th>
                            <th>Purpose</th>
                            <th>Payment Method</th>
                            <th>Amount</th>
                        </tr>

                    </thead>

                    <tbody>

                        ${
                            disbursementRows ||
                            `
                                <tr>
                                    <td colspan="5">
                                        No disbursement records.
                                    </td>
                                </tr>
                            `
                        }

                    </tbody>

                </table>

                <p style="margin-top:30px;color:#64748b;">
                    Generated by AfriCore ERP Social Welfare.
                </p>

            </body>
            </html>
        `;

        const printWindow =
            window.open(
                "",
                "_blank",
                "width=1100,height=850"
            );

        if (!printWindow) {
            setError(
                "Please allow pop-ups to print the statement."
            );
            return;
        }

        printWindow.document.write(html);
        printWindow.document.close();

        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
        }, 300);
    };

    // =========================================================
    // ACTIVE SECTION INFO
    // =========================================================

    const activeSectionInfo =
        sections.find(
            section =>
                section.id ===
                activeSection
        );

    // =========================================================
    // LOADING
    // =========================================================

    const saveInitialBalanceForMember = async () => {
        const member = members.find(item => String(item.id) === String(initialBalanceMemberId));
        const amount = Number(initialBalanceMemberAmount);

        if (!member) {
            setError("Please select a welfare member.");
            return;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            setError("Initial Balance amount must be greater than 0.");
            return;
        }

        try {
            setInitialBalanceSaving(true);
            setError("");
            setSuccessMessage("");

            // Adding Initial Balance is cumulative. It does not create a
            // contribution and does not enter event collections. The
            // statement automatically uses it first against closed-event debt.
            const currentAmount = Math.max(0, Number(member.initial_balance) || 0);
            const newAmount = currentAmount + amount;

            const { error: updateError } = await supabase
                .from("social_fund_members")
                .update({ initial_balance: newAmount })
                .eq("id", member.id);

            if (updateError) throw updateError;

            await fetchMembers(currentProfile);
            setInitialBalanceModalOpen(false);
            setInitialBalanceMemberId("");
            setInitialBalanceMemberAmount("");
            setSuccessMessage(`Initial Balance of TZS ${formatMoney(amount)} added to ${member.full_name}.`);
        } catch (err) {
            console.error("Add member initial balance error:", err);
            setError(err?.message || "Failed to add Initial Balance.");
        } finally {
            setInitialBalanceSaving(false);
        }
    };

    const saveInitialBalanceForMembers = async () => {
        const amount = Number(initialBalanceValue);
        if (!Number.isFinite(amount) || amount < 0) {
            setError("Initial Balance must be a valid amount of 0 or more.");
            return;
        }
        if (!currentProfile?.school_id) {
            setError("Your profile is not assigned to a school.");
            return;
        }
        if (!window.confirm(`Set Initial Balance to TZS ${formatMoney(amount)} for all welfare members in this school?`)) return;
        try {
            setInitialBalanceSaving(true);
            setError("");
            setSuccessMessage("");
            const { error: updateError } = await supabase
                .from("social_fund_members")
                .update({ initial_balance: amount })
                .eq("school_id", currentProfile.school_id);
            if (updateError) throw updateError;
            await fetchMembers(currentProfile);
            setInitialBalanceValue(String(amount));
            setSuccessMessage(`Initial Balance updated to TZS ${formatMoney(amount)} for all welfare members.`);
        } catch (err) {
            console.error("Initial balance update error:", err);
            setError(err?.message || "Failed to update Initial Balance.");
        } finally {
            setInitialBalanceSaving(false);
        }
    };

    if (loading) {

        return (
            <div className="p-6">

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10">

                    <div className="flex flex-col items-center justify-center text-center">

                        <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />

                        <h2 className="mt-5 text-lg font-semibold text-slate-800">
                            Loading Social Welfare Dashboard
                        </h2>

                        <p className="mt-2 text-sm text-slate-500">
                            Loading welfare members, events and financial information...
                        </p>

                    </div>

                </div>

            </div>
        );
    }

    // =========================================================
    // MAIN UI
    // =========================================================

    return (
        <div className="p-6 space-y-6">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                <div>

                    <div className="flex items-center gap-3">

                        <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl">
                            <FaHandHoldingHeart />
                        </div>

                        <div>

                            <h1 className="text-2xl font-bold text-slate-800">
                                Social Welfare
                            </h1>

                            <p className="text-sm text-slate-500">
                                School society and welfare fund management
                            </p>

                        </div>

                    </div>

                </div>

                <div className="flex flex-wrap items-center gap-3">

                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                    >
                        <FaSyncAlt />
                        Refresh
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            openSection("members")
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                    >
                        <FaUsers />
                        Manage Members
                    </button>

                    <button
                        type="button"
                        onClick={openCreateEvent}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                    >
                        <FaPlus />
                        Create Welfare Event
                    </button>

                </div>

            </div>


            {/* =================================================
                INTERNAL NAVIGATION
            ================================================= */}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2">

                <div className="flex gap-2 overflow-x-auto">

                    {sections.map(
                        section => {

                            const isActive =
                                activeSection ===
                                section.id;

                            return (
                                <button
                                    key={section.id}
                                    type="button"
                                    onClick={() =>
                                        openSection(
                                            section.id
                                        )
                                    }
                                    className={`
                                        flex-shrink-0
                                        inline-flex
                                        items-center
                                        gap-2
                                        rounded-xl
                                        px-4
                                        py-3
                                        text-sm
                                        font-semibold
                                        transition
                                        ${
                                            isActive
                                                ? "bg-blue-600 text-white shadow-sm"
                                                : "text-slate-600 hover:bg-slate-100 hover:text-blue-700"
                                        }
                                    `}
                                >
                                    {section.icon}
                                    {section.label}
                                </button>
                            );
                        }
                    )}

                </div>

            </div>


            {/* =================================================
                BREADCRUMB
            ================================================= */}

            {activeSection !== "dashboard" && (

                <div className="flex items-center gap-2 text-sm text-slate-500">

                    <span>
                        Social Welfare
                    </span>

                    <FaChevronRight className="text-xs text-slate-300" />

                    <span className="font-semibold text-slate-700">
                        {activeSectionInfo?.label}
                    </span>

                </div>
            )}


            {/* =================================================
                SUCCESS
            ================================================= */}

            {successMessage && (

                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">

                    <div className="flex items-center justify-between gap-4">

                        <p className="text-sm font-semibold text-green-700">
                            {successMessage}
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                setSuccessMessage("")
                            }
                            className="text-green-500 hover:text-green-800"
                        >
                            <FaTimes />
                        </button>

                    </div>

                </div>
            )}


            {/* =================================================
                ERROR
            ================================================= */}

            {error && (

                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">

                    <div className="flex items-start justify-between gap-4">

                        <div>

                            <p className="text-sm font-semibold text-red-700">
                                Unable to complete Social Welfare operation
                            </p>

                            <p className="text-sm text-red-600 mt-1">
                                {error}
                            </p>

                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setError("")
                            }
                            className="text-red-400 hover:text-red-700"
                        >
                            <FaTimes />
                        </button>

                    </div>

                </div>
            )}


            {/* =================================================
                DASHBOARD
            ================================================= */}

            {activeSection === "dashboard" && (

                <>

                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">

                        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">

                            <div>

                                <p className="text-sm font-semibold text-blue-800">
                                    Data Scope
                                </p>

                                <p className="text-sm text-blue-700">
                                    {Number(currentProfile?.role_id) === 1
                                        ? "Super Admin: viewing welfare data across all schools."
                                        : "You are viewing welfare data belonging to your assigned school."
                                    }
                                </p>

                            </div>

                            {lastUpdated && (

                                <p className="text-xs text-blue-600">
                                    Updated{" "}
                                    {lastUpdated.toLocaleTimeString()}
                                </p>

                            )}

                        </div>

                    </div>


                    {/* FINANCIAL CARDS */}

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-sm text-slate-500">
                                        Welfare Balance
                                    </p>

                                    <h2 className="mt-2 text-2xl font-bold text-blue-700">

                                        {financialLoading
                                            ? "..."
                                            : `TZS ${formatMoney(
                                                financialSummary.availableBalance
                                            )}`
                                        }

                                    </h2>

                                </div>

                                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <FaWallet />
                                </div>

                            </div>

                            <p className="mt-3 text-xs text-slate-400">
                                Posted contributions less posted disbursements
                            </p>

                        </div>


                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-sm text-slate-500">
                                        Total Contributions
                                    </p>

                                    <h2 className="mt-2 text-2xl font-bold text-green-700">

                                        {financialLoading
                                            ? "..."
                                            : `TZS ${formatMoney(
                                                financialSummary.totalContributions
                                            )}`
                                        }

                                    </h2>

                                </div>

                                <div className="w-11 h-11 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                                    <FaMoneyBillWave />
                                </div>

                            </div>

                            <p className="mt-3 text-xs text-slate-400">
                                {financialSummary.contributionTransactions} posted transactions
                            </p>

                        </div>


                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-sm text-slate-500">
                                        Total Disbursements
                                    </p>

                                    <h2 className="mt-2 text-2xl font-bold text-orange-600">

                                        {financialLoading
                                            ? "..."
                                            : `TZS ${formatMoney(
                                                financialSummary.totalDisbursements
                                            )}`
                                        }

                                    </h2>

                                </div>

                                <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                                    <FaExchangeAlt />
                                </div>

                            </div>

                            <p className="mt-3 text-xs text-slate-400">
                                {financialSummary.disbursementTransactions} posted transactions
                            </p>

                        </div>


                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-sm text-slate-500">
                                        Active Events
                                    </p>

                                    <h2 className="mt-2 text-2xl font-bold text-purple-700">
                                        {financialSummary.activeEvents}
                                    </h2>

                                </div>

                                <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                    <FaCalendarAlt />
                                </div>

                            </div>

                            <p className="mt-3 text-xs text-slate-400">
                                {financialSummary.totalEvents} total events in history
                            </p>

                        </div>

                    </div>


                    {/* QUICK ACTIONS */}

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                        <button
                            type="button"
                            onClick={openCreateEvent}
                            className="group rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 text-left shadow-sm hover:border-blue-400 hover:shadow-md"
                        >

                            <div className="flex items-start justify-between">

                                <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                                    <FaCalendarAlt />
                                </div>

                                <FaArrowRight className="text-slate-300" />

                            </div>

                            <h3 className="mt-4 font-bold text-slate-800">
                                Create Welfare Event
                            </h3>

                            <p className="mt-1 text-sm text-slate-500">
                                Wedding, funeral, medical, emergency or custom cause.
                            </p>

                        </button>


                        <button
                            type="button"
                            onClick={() =>
                                openContributionModal()
                            }
                            className="group rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-white p-5 text-left shadow-sm hover:border-green-400 hover:shadow-md"
                        >

                            <div className="flex items-start justify-between">

                                <div className="w-11 h-11 rounded-xl bg-green-600 text-white flex items-center justify-center">
                                    <FaMoneyBillWave />
                                </div>

                                <FaArrowRight className="text-slate-300" />

                            </div>

                            <h3 className="mt-4 font-bold text-slate-800">
                                Record Contribution
                            </h3>

                            <p className="mt-1 text-sm text-slate-500">
                                Record a member contribution against a welfare event.
                            </p>

                        </button>


                        <button
                            type="button"
                            onClick={() =>
                                openDisbursementModal()
                            }
                            className="group rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-5 text-left shadow-sm hover:border-orange-400 hover:shadow-md"
                        >

                            <div className="flex items-start justify-between">

                                <div className="w-11 h-11 rounded-xl bg-orange-600 text-white flex items-center justify-center">
                                    <FaExchangeAlt />
                                </div>

                                <FaArrowRight className="text-slate-300" />

                            </div>

                            <h3 className="mt-4 font-bold text-slate-800">
                                Record Disbursement
                            </h3>

                            <p className="mt-1 text-sm text-slate-500">
                                Record money released to a beneficiary.
                            </p>

                        </button>


                        <button
                            type="button"
                            onClick={() =>
                                openSection("statements")
                            }
                            className="group rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5 text-left shadow-sm hover:border-purple-400 hover:shadow-md"
                        >

                            <div className="flex items-start justify-between">

                                <div className="w-11 h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                                    <FaFileAlt />
                                </div>

                                <FaArrowRight className="text-slate-300" />

                            </div>

                            <h3 className="mt-4 font-bold text-slate-800">
                                Member Statements
                            </h3>

                            <p className="mt-1 text-sm text-slate-500">
                                View individual, member and event welfare statements.
                            </p>

                        </button>

                    </div>


                    {/* MEMBER SUMMARY */}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">

                            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                <FaUsers />
                            </div>

                            <p className="mt-4 text-sm text-slate-500">
                                Total Members
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-slate-800">
                                {statistics.totalMembers}
                            </h2>

                        </div>


                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">

                            <div className="w-11 h-11 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                                <FaUserCheck />
                            </div>

                            <p className="mt-4 text-sm text-slate-500">
                                Active Members
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-green-700">
                                {statistics.activeMembers}
                            </h2>

                        </div>


                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">

                            <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                                <FaMoneyBillWave />
                            </div>

                            <p className="mt-4 text-sm text-slate-500">
                                Monthly Commitments
                            </p>

                            <h2 className="mt-2 text-xl font-bold text-slate-800">
                                TZS{" "}
                                {formatMoney(
                                    statistics.monthlyContribution
                                )}
                            </h2>

                        </div>

                    </div>


                    {/* ACTIVE EVENTS */}

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                        <div className="p-6 border-b border-slate-100">

                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                                <div>

                                    <h2 className="font-bold text-slate-800">
                                        Active Welfare Events
                                    </h2>

                                    <p className="text-sm text-slate-500 mt-1">
                                        Track welfare causes and available funds.
                                    </p>

                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        openSection("events")
                                    }
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                                >
                                    View All Events
                                    <FaArrowRight />
                                </button>

                            </div>

                        </div>


                        <div className="p-6">

                            {eventsWithFinancials.filter(
                                event =>
                                    String(
                                        event.event_status
                                    ).toLowerCase() ===
                                    "active"
                            ).length === 0 ? (

                                <div className="text-center py-10">

                                    <FaCalendarAlt className="mx-auto text-3xl text-slate-300" />

                                    <h3 className="mt-3 font-semibold text-slate-700">
                                        No active welfare events
                                    </h3>

                                    <button
                                        type="button"
                                        onClick={openCreateEvent}
                                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                                    >
                                        <FaPlus />
                                        Create Event
                                    </button>

                                </div>

                            ) : (

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                                    {eventsWithFinancials
                                        .filter(
                                            event =>
                                                String(
                                                    event.event_status
                                                ).toLowerCase() ===
                                                "active"
                                        )
                                        .slice(0, 4)
                                        .map(
                                            event => {

                                                const progress =
                                                    getEventProgress(
                                                        event
                                                    );

                                                return (
                                                    <div
                                                        key={event.id}
                                                        className="rounded-2xl border border-slate-200 p-5 hover:border-blue-300 transition"
                                                    >

                                                        <div className="flex items-start justify-between gap-4">

                                                            <div className="flex items-center gap-3">

                                                                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                                                    {getEventIcon(
                                                                        event.event_type
                                                                    )}
                                                                </div>

                                                                <div>

                                                                    <h3 className="font-bold text-slate-800">
                                                                        {event.event_name}
                                                                    </h3>

                                                                    <p className="text-xs text-slate-500">
                                                                        {event.event_type}
                                                                    </p>

                                                                </div>

                                                            </div>

                                                            <span
                                                                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getEventStatusClass(
                                                                    event.event_status
                                                                )}`}
                                                            >
                                                                {event.event_status}
                                                            </span>

                                                        </div>


                                                        <div className="mt-5">

                                                            <div className="flex items-center justify-between text-xs mb-2">

                                                                <span className="text-slate-500">
                                                                    Collection progress
                                                                </span>

                                                                <span className="font-semibold text-slate-700">
                                                                    {progress}%
                                                                </span>

                                                            </div>

                                                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">

                                                                <div
                                                                    className="h-full rounded-full bg-blue-600"
                                                                    style={{
                                                                        width:
                                                                            `${progress}%`
                                                                    }}
                                                                />

                                                            </div>

                                                        </div>


                                                        <div className="mt-5 grid grid-cols-3 gap-3">

                                                            <div>

                                                                <p className="text-xs text-slate-400">
                                                                    Target
                                                                </p>

                                                                <p className="mt-1 text-sm font-bold text-slate-800">
                                                                    TZS{" "}
                                                                    {formatMoney(
                                                                        event.target_amount
                                                                    )}
                                                                </p>

                                                            </div>

                                                            <div>

                                                                <p className="text-xs text-slate-400">
                                                                    Collected
                                                                </p>

                                                                <p className="mt-1 text-sm font-bold text-green-700">
                                                                    TZS{" "}
                                                                    {formatMoney(
                                                                        event.collected_amount
                                                                    )}
                                                                </p>

                                                            </div>

                                                            <div>

                                                                <p className="text-xs text-slate-400">
                                                                    Available
                                                                </p>

                                                                <p className="mt-1 text-sm font-bold text-blue-700">
                                                                    TZS{" "}
                                                                    {formatMoney(
                                                                        event.available_amount
                                                                    )}
                                                                </p>

                                                            </div>

                                                        </div>


                                                        <div className="mt-5 flex flex-wrap gap-2">

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    openEventDetails(
                                                                        event
                                                                    )
                                                                }
                                                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                            >
                                                                <FaEye />
                                                                Details
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    openContributionModal(
                                                                        event
                                                                    )
                                                                }
                                                                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
                                                            >
                                                                <FaPlus />
                                                                Contribution
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    openDisbursementModal(
                                                                        event
                                                                    )
                                                                }
                                                                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700"
                                                            >
                                                                <FaExchangeAlt />
                                                                Disburse
                                                            </button>

                                                        </div>

                                                    </div>
                                                );
                                            }
                                        )}

                                </div>
                            )}

                        </div>

                    </div>

                </>
            )}


            {/* =================================================
                MEMBERS
            ================================================= */}

            {activeSection === "members" && (

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                    <Members />

                </div>
            )}


            {/* =================================================
                EVENTS
            ================================================= */}

            {activeSection === "events" && (

                <div className="space-y-6">

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">

                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                            <div>

                                <h2 className="text-lg font-bold text-slate-800">
                                    Welfare Events & Causes
                                </h2>

                                <p className="text-sm text-slate-500 mt-1">
                                    Create, track, close, cancel and review welfare causes.
                                </p>

                            </div>

                            <button
                                type="button"
                                onClick={openCreateEvent}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                                <FaPlus />
                                Create Event
                            </button>

                        </div>


                        <div className="mt-5 relative">

                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                            <input
                                type="text"
                                value={eventSearch}
                                onChange={e =>
                                    setEventSearch(
                                        e.target.value
                                    )
                                }
                                placeholder="Search event name, type or status..."
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />

                        </div>

                    </div>


                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

                        {filteredEvents.length === 0 ? (

                            <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-12 text-center">

                                <FaCalendarAlt className="mx-auto text-4xl text-slate-300" />

                                <h3 className="mt-4 font-semibold text-slate-700">
                                    No welfare events found
                                </h3>

                            </div>

                        ) : (

                            filteredEvents.map(
                                event => {

                                    const progress =
                                        getEventProgress(
                                            event
                                        );

                                    const isActive =
                                        String(
                                            event.event_status
                                        ).toLowerCase() ===
                                        "active";

                                    const isCancelled =
                                        String(
                                            event.event_status
                                        ).toLowerCase() ===
                                        "cancelled";

                                    return (

                                        <div
                                            key={event.id}
                                            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
                                        >

                                            <div className="flex items-start justify-between gap-4">

                                                <div className="flex items-start gap-3">

                                                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                                        {getEventIcon(
                                                            event.event_type
                                                        )}
                                                    </div>

                                                    <div>

                                                        <h3 className="font-bold text-slate-800">
                                                            {event.event_name}
                                                        </h3>

                                                        <p className="text-sm text-slate-500">
                                                            {event.event_type}
                                                        </p>

                                                        <p className="text-xs text-slate-400 mt-1">
                                                            Started{" "}
                                                            {formatDate(
                                                                event.start_date
                                                            )}
                                                        </p>

                                                    </div>

                                                </div>

                                                <span
                                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getEventStatusClass(
                                                        event.event_status
                                                    )}`}
                                                >
                                                    {event.event_status}
                                                </span>

                                            </div>


                                            {event.description && (

                                                <p className="mt-4 text-sm text-slate-600">
                                                    {event.description}
                                                </p>

                                            )}


                                            <div className="mt-5">

                                                <div className="flex items-center justify-between text-xs mb-2">

                                                    <span className="text-slate-500">
                                                        Target progress
                                                    </span>

                                                    <span className="font-semibold text-slate-700">
                                                        {progress}%
                                                    </span>

                                                </div>

                                                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">

                                                    <div
                                                        className="h-full rounded-full bg-blue-600"
                                                        style={{
                                                            width:
                                                                `${progress}%`
                                                        }}
                                                    />

                                                </div>

                                            </div>


                                            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">

                                                <div>

                                                    <p className="text-xs text-slate-400">
                                                        Target
                                                    </p>

                                                    <p className="mt-1 text-sm font-bold text-slate-800">
                                                        TZS{" "}
                                                        {formatMoney(
                                                            event.target_amount
                                                        )}
                                                    </p>

                                                </div>

                                                <div>

                                                    <p className="text-xs text-slate-400">
                                                        Collected
                                                    </p>

                                                    <p className="mt-1 text-sm font-bold text-green-700">
                                                        TZS{" "}
                                                        {formatMoney(
                                                            event.collected_amount
                                                        )}
                                                    </p>

                                                </div>

                                                <div>

                                                    <p className="text-xs text-slate-400">
                                                        Disbursed
                                                    </p>

                                                    <p className="mt-1 text-sm font-bold text-orange-600">
                                                        TZS{" "}
                                                        {formatMoney(
                                                            event.disbursed_amount
                                                        )}
                                                    </p>

                                                </div>

                                                <div>

                                                    <p className="text-xs text-slate-400">
                                                        Available
                                                    </p>

                                                    <p className="mt-1 text-sm font-bold text-blue-700">
                                                        TZS{" "}
                                                        {formatMoney(
                                                            event.available_amount
                                                        )}
                                                    </p>

                                                </div>

                                            </div>


                                            <div className="mt-5 flex flex-wrap gap-2">

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        openEventDetails(
                                                            event
                                                        )
                                                    }
                                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                >
                                                    <FaEye />
                                                    View Details
                                                </button>


                                                {isActive && (

                                                    <>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openContributionModal(
                                                                    event
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
                                                        >
                                                            <FaMoneyBillWave />
                                                            Contribution
                                                        </button>


                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openDisbursementModal(
                                                                    event
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700"
                                                        >
                                                            <FaExchangeAlt />
                                                            Disburse
                                                        </button>


                                                        <button
                                                            type="button"
                                                            disabled={saving}
                                                            onClick={() =>
                                                                updateEventStatus(
                                                                    event,
                                                                    "Closed"
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                                        >
                                                            <FaLock />
                                                            Close
                                                        </button>


                                                        <button
                                                            type="button"
                                                            disabled={saving}
                                                            onClick={() =>
                                                                updateEventStatus(
                                                                    event,
                                                                    "Cancelled"
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                                        >
                                                            <FaBan />
                                                            Cancel
                                                        </button>

                                                    </>

                                                )}


                                                {isCancelled && (

                                                    <button
                                                        type="button"
                                                        disabled={saving}
                                                        onClick={() =>
                                                            handleDeleteCancelledEvent(
                                                                event
                                                            )
                                                        }
                                                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                                    >
                                                        <FaTrash />
                                                        Delete
                                                    </button>

                                                )}

                                            </div>

                                        </div>
                                    );
                                }
                            )

                        )}

                    </div>

                </div>
            )}


            {/* =================================================
                CONTRIBUTIONS
            ================================================= */}

            {activeSection === "contributions" && (

                <div className="space-y-4">

                    <div className="flex justify-end">

                        <button
                            type="button"
                            onClick={() =>
                                openContributionModal()
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700"
                        >
                            <FaPlus />
                            Record Event Contribution
                        </button>

                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                        <Contributions />

                    </div>

                </div>
            )}


            {/* =================================================
                WELFARE REQUESTS
            ================================================= */}

            {activeSection === "requests" && (

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                    <WelfareRequests />

                </div>
            )}


            {/* =================================================
                WELFARE FUND
            ================================================= */}

            {activeSection === "fund" && (

                <div className="space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

                            <FaMoneyBillWave className="text-green-600 text-xl" />

                            <p className="mt-4 text-sm text-slate-500">
                                Total Contributions
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-green-700">
                                TZS{" "}
                                {formatMoney(
                                    financialSummary.totalContributions
                                )}
                            </h2>

                        </div>


                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

                            <FaExchangeAlt className="text-orange-600 text-xl" />

                            <p className="mt-4 text-sm text-slate-500">
                                Total Disbursements
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-orange-600">
                                TZS{" "}
                                {formatMoney(
                                    financialSummary.totalDisbursements
                                )}
                            </h2>

                        </div>


                        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6">

                            <FaWallet className="text-blue-600 text-xl" />

                            <p className="mt-4 text-sm text-slate-500">
                                Available Welfare Balance
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-blue-700">
                                TZS{" "}
                                {formatMoney(
                                    financialSummary.availableBalance
                                )}
                            </h2>

                        </div>

                    </div>


                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

                        <h2 className="text-lg font-bold text-slate-800">
                            Welfare Fund
                        </h2>

                        <p className="mt-2 text-sm text-slate-500">
                            The available welfare balance is calculated from all posted welfare contributions less all posted welfare disbursements.
                        </p>

                    </div>

                </div>
            )}


            {/* =================================================
                STATEMENTS
            ================================================= */}

            {activeSection === "statements" && (

                <div className="space-y-6">

                    {/* STATEMENT HEADER */}

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

                        <div className="flex items-start gap-4">

                            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                <FaFileAlt />
                            </div>

                            <div>

                                <h2 className="text-lg font-bold text-slate-800">
                                    Welfare Statements
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    View complete welfare contribution history for all members, individual members and specific events.
                                </p>

                            </div>

                        </div>

                    </div>


                    {/* =================================================
                        EVENT OBLIGATIONS / WELFARE DEBT
                    ================================================= */}

                    <div className="space-y-5">

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                            <div className="p-6 border-b border-slate-100">

                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                                    <div>

                                        <div className="flex items-center gap-3">

                                            <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                                                <FaHistory />
                                            </div>

                                            <div>

                                                <h3 className="font-bold text-slate-800">
                                                    Welfare Event Obligations & Debt
                                                </h3>

                                                <p className="text-sm text-slate-500 mt-1">
                                                    An event does not become a debt until a member is assigned an expected contribution.
                                                </p>

                                            </div>

                                        </div>

                                    </div>

                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const profile =
                                                currentProfile ||
                                                await fetchProfile();

                                            const contributionData = await fetchContributions();

                                            await fetchWelfareObligations(
                                                profile,
                                                null,
                                                null,
                                                contributionData
                                            );
                                        }}
                                        disabled={obligationsLoading}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                                    >
                                        <FaSyncAlt className={obligationsLoading ? "animate-spin" : ""} />
                                        {obligationsLoading
                                            ? "Refreshing..."
                                            : "Refresh Statements"
                                        }
                                    </button>

                                </div>

                            </div>

                            {obligationsError && (
                                <div className="mx-6 mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4">

                                    <div className="flex items-start gap-3">

                                        <FaExclamationTriangle className="mt-0.5 text-orange-600" />

                                        <div>

                                            <p className="text-sm font-semibold text-orange-800">
                                                Obligation statement data is unavailable
                                            </p>

                                            <p className="text-sm text-orange-700 mt-1">
                                                {obligationsError}
                                            </p>

                                        </div>

                                    </div>

                                </div>
                            )}

                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Total Expected
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-slate-800">
                                        TZS {formatMoney(statementSummary.totalExpected)}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Assigned event obligations
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                                        Total Paid
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-green-700">
                                        TZS {formatMoney(statementSummary.totalPaid)}
                                    </p>
                                    <p className="mt-1 text-xs text-green-700">
                                        Posted contributions against events
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                                        Welfare Debt / Outstanding
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-red-700">
                                        TZS {formatMoney(statementSummary.totalOutstanding)}
                                    </p>
                                    <p className="mt-1 text-xs text-red-700">
                                        Expected less paid
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Obligation Records
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-slate-800">
                                        {welfareObligations.length}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Member-event assignments
                                    </p>
                                </div>

                            </div>

                        </div>


                        {/* STATUS CARDS */}

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">

                            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                    <span className="text-xs font-bold text-green-700">
                                        PAID
                                    </span>
                                </div>
                                <p className="mt-2 text-2xl font-bold text-green-700">
                                    {statementSummary.paidCount}
                                </p>
                            </div>

                            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                                    <span className="text-xs font-bold text-yellow-700">
                                        PARTIAL
                                    </span>
                                </div>
                                <p className="mt-2 text-2xl font-bold text-yellow-700">
                                    {statementSummary.partialCount}
                                </p>
                            </div>

                            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                    <span className="text-xs font-bold text-red-700">
                                        MISSED
                                    </span>
                                </div>
                                <p className="mt-2 text-2xl font-bold text-red-700">
                                    {statementSummary.missedCount}
                                </p>
                            </div>

                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                    <span className="text-xs font-bold text-blue-700">
                                        WAIVED
                                    </span>
                                </div>
                                <p className="mt-2 text-2xl font-bold text-blue-700">
                                    {statementSummary.waivedCount}
                                </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                                    <span className="text-xs font-bold text-slate-600">
                                        NOT ASSIGNED
                                    </span>
                                </div>
                                <p className="mt-2 text-2xl font-bold text-slate-700">
                                    {statementSummary.notAssignedCount}
                                </p>
                            </div>

                        </div>


                        {/* ALL EVENT OBLIGATIONS */}

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                            <div className="p-6 border-b border-slate-100">

                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                                    <div>

                                        <h3 className="font-bold text-slate-800">
                                            All Member Event Statements
                                        </h3>

                                        <p className="text-sm text-slate-500 mt-1">
                                            Each row represents a member assigned to a welfare event with an expected amount.
                                        </p>

                                    </div>

                                    <div className="relative">

                                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                                        <input
                                            value={statementSearch}
                                            onChange={e =>
                                                setStatementSearch(
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Search member or event..."
                                            className="w-full lg:w-80 rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                        />

                                    </div>

                                </div>

                            </div>

                            <div className="overflow-x-auto">

                                <table className="w-full text-sm">

                                    <thead className="bg-slate-50">

                                        <tr>

                                            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">
                                                Member
                                            </th>

                                            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">
                                                Event / Purpose
                                            </th>

                                            <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500">
                                                Expected
                                            </th>

                                            <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500">
                                                Paid
                                            </th>

                                            <th className="text-right px-5 py-3 text-xs font-semibold text-red-600">
                                                Outstanding
                                            </th>

                                            <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500">
                                                Status
                                            </th>

                                        </tr>

                                    </thead>

                                    <tbody className="divide-y divide-slate-100">

                                        {obligationsLoading ? (

                                            <tr>
                                                <td
                                                    colSpan="6"
                                                    className="px-5 py-10 text-center text-slate-500"
                                                >
                                                    Loading welfare obligations...
                                                </td>
                                            </tr>

                                        ) : filteredStatementObligations.length === 0 ? (

                                            <tr>
                                                <td
                                                    colSpan="6"
                                                    className="px-5 py-10 text-center text-slate-500"
                                                >
                                                    No member-event obligation records found.
                                                </td>
                                            </tr>

                                        ) : (

                                            filteredStatementObligations.map(
                                                row => (

                                                    <tr
                                                        key={`${row.member_id}-${row.event_id}-${row.id || Math.random()}`}
                                                        className="hover:bg-slate-50"
                                                    >

                                                        <td className="px-5 py-4">

                                                            <div className="font-semibold text-slate-800">
                                                                {row.member_name}
                                                            </div>

                                                            <div className="text-xs text-slate-500">
                                                                {row.member_number}
                                                            </div>

                                                        </td>

                                                        <td className="px-5 py-4">

                                                            <div className="font-semibold text-slate-800">
                                                                {row.event_name}
                                                            </div>

                                                            <div className="text-xs text-slate-500">
                                                                {row.event_type}
                                                                {row.event_date
                                                                    ? ` • ${formatDate(row.event_date)}`
                                                                    : ""
                                                                }
                                                            </div>

                                                        </td>

                                                        <td className="px-5 py-4 text-right font-semibold text-slate-700">
                                                            TZS {formatMoney(row.expected_amount)}
                                                        </td>

                                                        <td className="px-5 py-4 text-right font-semibold text-green-700">
                                                            TZS {formatMoney(row.paid_amount)}
                                                        </td>

                                                        <td className="px-5 py-4 text-right font-bold text-red-700">
                                                            TZS {formatMoney(row.outstanding_amount)}
                                                        </td>

                                                        <td className="px-5 py-4 text-center">

                                                            <span
                                                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${getObligationStatusClass(
                                                                    row.calculated_status
                                                                )}`}
                                                            >

                                                                <span
                                                                    className={`w-2 h-2 rounded-full ${getObligationStatusDot(
                                                                        row.calculated_status
                                                                    )}`}
                                                                />

                                                                {row.calculated_status}

                                                            </span>

                                                        </td>

                                                    </tr>

                                                )
                                            )

                                        )}

                                    </tbody>

                                </table>

                            </div>

                        </div>


                        {/* INDIVIDUAL MEMBER STATEMENT */}

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                            <div className="p-6 border-b border-slate-100">

                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                                    <div>

                                        <h3 className="font-bold text-slate-800">
                                            Individual Member Welfare Statement
                                        </h3>

                                        <p className="text-sm text-slate-500 mt-1">
                                            Select a member to see expected contributions, payments, missed events and welfare debt.
                                        </p>

                                    </div>

                                    <select
                                        value={statementMemberId}
                                        onChange={e =>
                                            setStatementMemberId(
                                                e.target.value
                                            )
                                        }
                                        className="w-full lg:w-96 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                                    >

                                        <option value="">
                                            Select member
                                        </option>

                                        {members.map(member => (
                                            <option
                                                key={member.id}
                                                value={member.id}
                                            >
                                                {member.full_name}
                                                {" — "}
                                                {member.member_number || ""}
                                            </option>
                                        ))}

                                    </select>

                                </div>

                            </div>

                            {selectedStatementMember ? (

                                <div className="p-6 space-y-5">

                                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                                        <div>

                                            <h4 className="text-lg font-bold text-slate-800">
                                                {selectedStatementMember.full_name}
                                            </h4>

                                            <p className="text-sm text-slate-500">
                                                {selectedStatementMember.member_number || "-"}
                                                {" • "}
                                                {selectedStatementMember.member_type || "-"}
                                            </p>

                                        </div>

                                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">

                                            <p className="text-xs font-semibold text-red-600">
                                                WELFARE DEBT / OUTSTANDING
                                            </p>

                                            <p className="text-xl font-bold text-red-700">
                                                TZS {formatMoney(
                                                    selectedMemberObligationSummary.outstanding
                                                )}
                                            </p>

                                        </div>

                                    </div>


                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">

                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-xs text-slate-500">
                                                Expected
                                            </p>
                                            <p className="mt-1 font-bold text-slate-800">
                                                TZS {formatMoney(
                                                    selectedMemberObligationSummary.expected
                                                )}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                                            <p className="text-xs text-green-700">
                                                Paid
                                            </p>
                                            <p className="mt-1 font-bold text-green-700">
                                                TZS {formatMoney(
                                                    selectedMemberObligationSummary.paid
                                                )}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                                            <p className="text-xs text-red-700">
                                                Debt
                                            </p>
                                            <p className="mt-1 font-bold text-red-700">
                                                TZS {formatMoney(
                                                    selectedMemberObligationSummary.outstanding
                                                )}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                                            <p className="text-xs text-yellow-700">
                                                Partial
                                            </p>
                                            <p className="mt-1 font-bold text-yellow-700">
                                                {selectedMemberObligationSummary.partialCount}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                                            <p className="text-xs text-red-700">
                                                Missed
                                            </p>
                                            <p className="mt-1 font-bold text-red-700">
                                                {selectedMemberObligationSummary.missedCount}
                                            </p>
                                        </div>

                                    </div>


                                    <div className="overflow-x-auto rounded-xl border border-slate-200">

                                        <table className="w-full text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Date</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Event</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Type</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-blue-600">Expected</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-green-600">Contribution</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-red-600">Debt</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-purple-600">Initial Used</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {memberStatementRows.filter(row => row.row_type === "event_statement").length === 0 ? (
                                                <tr><td colSpan="8" className="px-4 py-10 text-center text-slate-400">No statement records found.</td></tr>
                                            ) : (
                                                memberStatementRows.map(row => (
                                                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                                                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.contribution_date)}</td>
                                                        <td className="px-4 py-3 font-semibold text-slate-700">{row.event_name}</td>
                                                        <td className="px-4 py-3">{row.event_type}</td>
                                                        <td className="px-4 py-3 text-right font-semibold text-blue-700">{row.expected_amount > 0 ? `TZS ${formatMoney(row.expected_amount)}` : "-"}</td>
                                                        <td className="px-4 py-3 text-right font-semibold text-green-700">{row.paid_amount > 0 ? `TZS ${formatMoney(row.paid_amount)}` : "-"}</td>
                                                        <td className="px-4 py-3 text-right font-semibold text-red-700">{row.debt_remaining > 0 ? `TZS ${formatMoney(row.debt_remaining)}` : "-"}</td>
                                                        <td className="px-4 py-3 text-right font-semibold text-purple-700">{row.initial_applied > 0 ? `TZS ${formatMoney(row.initial_applied)}` : "-"}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                                                                row.status_label === "FULL CONTRIBUTION" || row.status_label === "SETTLED BY INITIAL BALANCE"
                                                                    ? "bg-green-100 text-green-700"
                                                                    : row.status_label.includes("PARTIAL")
                                                                        ? "bg-yellow-100 text-yellow-700"
                                                                        : row.status_label.includes("DEBT") || row.status_label === "MISSED EVENT"
                                                                            ? "bg-red-100 text-red-700"
                                                                            : "bg-slate-100 text-slate-600"
                                                            }`}>
                                                                {row.status_label}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>

                                    </div>

                                </div>

                            ) : (

                                <div className="p-8 text-center text-sm text-slate-500">
                                    Select a member above to view their complete welfare event statement.
                                </div>

                            )}

                        </div>

                    </div>


                    {/* ALL MEMBERS */}

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                        <div className="p-6 border-b border-slate-100">

                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                                <div>

                                    <h3 className="font-bold text-slate-800">
                                        All Members Statement
                                    </h3>

                                    <p className="text-sm text-slate-500 mt-1">
                                        Contribution summary for every welfare member.
                                    </p>

                                </div>

                                <div className="relative">

                                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                                    <input
                                        value={statementSearch}
                                        onChange={e =>
                                            setStatementSearch(
                                                e.target.value
                                            )
                                        }
                                        placeholder="Search member..."
                                        className="w-full lg:w-80 rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                                    />

                                </div>

                            </div>

                        </div>


                        <div className="overflow-x-auto">

                            <table className="w-full text-sm">

                                <thead className="bg-slate-50">

                                    <tr>

                                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">
                                            Member
                                        </th>

                                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">
                                            Type
                                        </th>

                                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">
                                            Phone
                                        </th>

                                        <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500">
                                            Events
                                        </th>

                                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">
                                            Last Contribution
                                        </th>

                                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500">
                                            Total Contribution
                                        </th>

                                        <th className="text-right px-5 py-3 text-xs font-semibold text-blue-600">
                                            Net Initial Balance
                                        </th>

                                        <th className="text-right px-5 py-3 text-xs font-semibold text-red-600">
                                            Debt Remaining
                                        </th>

                                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500">
                                            Action
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    {allMemberStatement.length === 0 ? (

                                        <tr>

                                            <td
                                                colSpan="9"
                                                className="px-5 py-10 text-center text-slate-400"
                                            >
                                                No members found.
                                            </td>

                                        </tr>

                                    ) : (

                                        allMemberStatement.map(
                                            member => (

                                                <tr
                                                    key={member.id}
                                                    className="border-t border-slate-100 hover:bg-slate-50"
                                                >

                                                    <td className="px-5 py-4">

                                                        <div className="flex items-center gap-3">

                                                            <div className="w-9 h-9 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                                                                <FaUser />
                                                            </div>

                                                            <div>

                                                                <p className="font-semibold text-slate-800">
                                                                    {member.full_name}
                                                                </p>

                                                                <p className="text-xs text-slate-400">
                                                                    {member.member_number || "-"}
                                                                </p>

                                                            </div>

                                                        </div>

                                                    </td>


                                                    <td className="px-5 py-4 capitalize">
                                                        {member.member_type || "-"}
                                                    </td>


                                                    <td className="px-5 py-4">
                                                        {member.phone || "-"}
                                                    </td>


                                                    <td className="px-5 py-4 text-center">
                                                        {member.eventCount}
                                                    </td>


                                                    <td className="px-5 py-4">
                                                        {formatDate(
                                                            member.lastContribution
                                                        )}
                                                    </td>


                                                    <td className="px-5 py-4 text-right font-bold text-green-700">
                                                        TZS{" "}
                                                        {formatMoney(
                                                            member.totalContribution
                                                        )}
                                                    </td>

                                                    <td className="px-5 py-4 text-right font-bold text-blue-700">
                                                        TZS {formatMoney(member.netInitialBalance)}
                                                    </td>

                                                    <td className="px-5 py-4 text-right font-bold text-red-700">
                                                        TZS {formatMoney(member.debtRemaining)}
                                                    </td>

                                                    <td className="px-5 py-4 text-right">

                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setInitialBalanceMemberId(String(member.id));
                                                                setInitialBalanceMemberAmount("");
                                                                setInitialBalanceModalOpen(true);
                                                            }}
                                                            className="mr-2 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                                                        >
                                                            <FaPlus />
                                                            Add Initial
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setStatementMemberId(
                                                                    String(member.id)
                                                                );
                                                                setActiveSection(
                                                                    "statements"
                                                                );
                                                                window.scrollTo({
                                                                    top: 0,
                                                                    behavior: "smooth"
                                                                });
                                                            }}
                                                            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700"
                                                        >
                                                            <FaEye />
                                                            Statement
                                                        </button>

                                                    </td>

                                                </tr>

                                            )
                                        )

                                    )}

                                </tbody>

                            </table>

                        </div>

                    </div>


                    {/* INDIVIDUAL MEMBER STATEMENT */}

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                        <div className="p-6 border-b border-slate-100">

                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                                <div>

                                    <h3 className="font-bold text-slate-800">
                                        Individual Member Statement
                                    </h3>

                                    <p className="text-sm text-slate-500 mt-1">
                                        Select a member to view complete contribution history.
                                    </p>

                                </div>


                                <div className="flex flex-wrap gap-2">

                                    <select
                                        value={statementMemberId}
                                        onChange={e =>
                                            setStatementMemberId(
                                                e.target.value
                                            )
                                        }
                                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-white outline-none focus:border-purple-400"
                                    >

                                        <option value="">
                                            Select member
                                        </option>

                                        {members.map(
                                            member => (

                                                <option
                                                    key={member.id}
                                                    value={member.id}
                                                >
                                                    {member.full_name}
                                                    {" — "}
                                                    {member.member_number || member.phone || ""}
                                                </option>

                                            )
                                        )}

                                    </select>


                                    <button
                                        type="button"
                                        disabled={
                                            !selectedStatementMember
                                        }
                                        onClick={
                                            printMemberStatement
                                        }
                                        className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-40"
                                    >
                                        <FaPrint />
                                        Print
                                    </button>

                                </div>

                            </div>

                        </div>


                        {!selectedStatementMember ? (

                            <div className="p-12 text-center">

                                <FaUser className="mx-auto text-4xl text-slate-200" />

                                <p className="mt-4 text-sm text-slate-500">
                                    Select a member to view their statement.
                                </p>

                            </div>

                        ) : (

                            <div className="p-6 space-y-6">

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                    <div className="rounded-xl bg-green-50 p-4">
                                        <p className="text-xs text-green-600">Total Contributions</p>
                                        <p className="mt-1 font-bold text-green-700">TZS {formatMoney(selectedMemberTotal)}</p>
                                        <p className="mt-1 text-xs text-green-600">Direct event contributions only</p>
                                    </div>
                                    <div className="rounded-xl bg-blue-50 p-4">
                                        <p className="text-xs text-blue-600">Initial Amount</p>
                                        <p className="mt-1 font-bold text-blue-700">TZS {formatMoney(selectedMemberInitialBalance)}</p>
                                        <p className="mt-1 text-xs text-blue-600">Separate member reserve</p>
                                    </div>
                                    <div className="rounded-xl bg-purple-50 p-4">
                                        <p className="text-xs text-purple-600">Net Initial Balance</p>
                                        <p className="mt-1 font-bold text-purple-700">TZS {formatMoney(selectedMemberNetInitialBalance)}</p>
                                        <p className="mt-1 text-xs text-purple-600">After closed-event debt</p>
                                    </div>
                                    <div className="rounded-xl bg-red-50 p-4">
                                        <p className="text-xs text-red-600">Debt</p>
                                        <p className="mt-1 font-bold text-red-700">TZS {formatMoney(selectedMemberDebtRemaining)}</p>
                                        <p className="mt-1 text-xs text-red-600">Remaining after Initial Balance</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 p-4">
                                        <p className="text-xs text-slate-500">Member</p>
                                        <p className="mt-1 font-bold text-slate-800 truncate">{selectedStatementMember.full_name}</p>
                                        <p className="mt-1 text-xs text-slate-500">{selectedStatementMember.member_type || "-"}</p>
                                    </div>
                                </div>



                                <div className="overflow-x-auto">

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
                                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-semibold text-blue-700">Initial Balance</p><p className="mt-1 font-bold text-blue-800">TZS {formatMoney(selectedMemberInitialBalance)}</p><p className="mt-1 text-xs text-blue-600">Separate opening reserve</p></div>
                                        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4"><p className="text-xs font-semibold text-purple-700">Initial Balance Used</p><p className="mt-1 font-bold text-purple-800">TZS {formatMoney(selectedMemberInitialApplied)}</p><p className="mt-1 text-xs text-purple-600">Used only against debit</p></div>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-600">Initial Balance Remaining</p><p className="mt-1 font-bold text-slate-800">TZS {formatMoney(selectedMemberInitialRemaining)}</p><p className="mt-1 text-xs text-slate-500">Not included in contributions</p></div>
                                        <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-semibold text-red-700">Debt Before Initial Balance</p><p className="mt-1 font-bold text-red-800">TZS {formatMoney(selectedMemberClosedDebt)}</p><p className="mt-1 text-xs text-red-600">Original unpaid debt after event close</p></div>
                                        <div className={`${selectedMemberDebtRemaining > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"} rounded-xl border p-4`}><p className={`text-xs font-semibold ${selectedMemberDebtRemaining > 0 ? "text-red-700" : "text-green-700"}`}>{selectedMemberFinalStatus}</p><p className={`mt-1 font-bold ${selectedMemberDebtRemaining > 0 ? "text-red-800" : "text-green-800"}`}>TZS {formatMoney(selectedMemberDebtRemaining > 0 ? selectedMemberDebtRemaining : selectedMemberNetInitialBalance)}</p><p className={`mt-1 text-xs ${selectedMemberDebtRemaining > 0 ? "text-red-600" : "text-green-600"}`}>{selectedMemberDebtRemaining > 0 ? "Debt still outstanding" : "Initial reserve remaining"}</p></div>
                                    </div>

                                    <table className="w-full text-sm min-w-[900px]">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Date</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Event</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Type</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Expected</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-green-600">Contribution</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-red-600">Debt</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-purple-600">Initial Used</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {memberStatementRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan="8" className="px-4 py-10 text-center text-slate-400">
                                                        No event records found.
                                                    </td>
                                                </tr>
                                            ) : (
                                                memberStatementRows
                                                    .filter(row => row.row_type === "event_statement")
                                                    .map(row => (
                                                        <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                                                            <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.contribution_date)}</td>
                                                            <td className="px-4 py-3 font-semibold text-slate-700">{row.event_name}</td>
                                                            <td className="px-4 py-3 capitalize">{row.event_type || "-"}</td>
                                                            <td className="px-4 py-3 text-right font-medium">TZS {formatMoney(row.expected_amount)}</td>
                                                            <td className="px-4 py-3 text-right font-semibold text-green-700">{row.paid_amount > 0 ? `TZS ${formatMoney(row.paid_amount)}` : "-"}</td>
                                                            <td className="px-4 py-3 text-right font-semibold text-red-700">{row.debt_remaining > 0 ? `TZS ${formatMoney(row.debt_remaining)}` : "-"}</td>
                                                            <td className="px-4 py-3 text-right font-semibold text-purple-700">{row.initial_applied > 0 ? `TZS ${formatMoney(row.initial_applied)}` : "-"}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                                                    row.status_label === "FULL CONTRIBUTION"
                                                                        ? "bg-green-100 text-green-700"
                                                                        : row.status_label === "PARTIAL"
                                                                            ? "bg-yellow-100 text-yellow-700"
                                                                            : row.status_label.includes("PARTIAL")
                                                                                ? "bg-orange-100 text-orange-700"
                                                                                : row.status_label.includes("SETTLED")
                                                                                    ? "bg-blue-100 text-blue-700"
                                                                                    : row.status_label.includes("DEBT") || row.status_label.includes("MISSED")
                                                                                        ? "bg-red-100 text-red-700"
                                                                                        : "bg-slate-100 text-slate-600"
                                                                }`}>
                                                                    {row.status_label}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                            )}
                                        </tbody>
                                    </table>

                                </div>

                            </div>

                        )}

                    </div>


                    {/* EVENT STATEMENT */}

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                        <div className="p-6 border-b border-slate-100">

                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                                <div>

                                    <h3 className="font-bold text-slate-800">
                                        Event Statement
                                    </h3>

                                    <p className="text-sm text-slate-500 mt-1">
                                        View all contributions and disbursements for one welfare cause.
                                    </p>

                                </div>


                                <div className="flex gap-2">

                                    <select
                                        value={statementEventId}
                                        onChange={e =>
                                            setStatementEventId(
                                                e.target.value
                                            )
                                        }
                                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-white outline-none focus:border-blue-400"
                                    >

                                        <option value="">
                                            Select event
                                        </option>

                                        {eventsWithFinancials.map(
                                            event => (

                                                <option
                                                    key={event.id}
                                                    value={event.id}
                                                >
                                                    {event.event_name}
                                                </option>

                                            )
                                        )}

                                    </select>


                                    <button
                                        type="button"
                                        disabled={
                                            !selectedStatementEvent
                                        }
                                        onClick={
                                            printEventStatement
                                        }
                                        className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-40"
                                    >
                                        <FaPrint />
                                        Print
                                    </button>

                                </div>

                            </div>

                        </div>


                        {!selectedStatementEvent ? (

                            <div className="p-12 text-center">

                                <FaCalendarAlt className="mx-auto text-4xl text-slate-200" />

                                <p className="mt-4 text-sm text-slate-500">
                                    Select an event to view its complete statement.
                                </p>

                            </div>

                        ) : (

                            <div className="p-6 space-y-6">

                                <div>

                                    <h3 className="text-xl font-bold text-slate-800">
                                        {selectedStatementEvent.event_name}
                                    </h3>

                                    <p className="text-sm text-slate-500 mt-1">
                                        {selectedStatementEvent.event_type}
                                    </p>

                                </div>


                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                                    <div className="rounded-xl bg-slate-50 p-4">

                                        <p className="text-xs text-slate-400">
                                            Target
                                        </p>

                                        <p className="mt-1 font-bold">
                                            TZS{" "}
                                            {formatMoney(
                                                selectedStatementEvent.target_amount
                                            )}
                                        </p>

                                    </div>


                                    <div className="rounded-xl bg-green-50 p-4">

                                        <p className="text-xs text-green-600">
                                            Collected
                                        </p>

                                        <p className="mt-1 font-bold text-green-700">
                                            TZS{" "}
                                            {formatMoney(
                                                selectedStatementEvent.collected_amount
                                            )}
                                        </p>

                                    </div>


                                    <div className="rounded-xl bg-orange-50 p-4">

                                        <p className="text-xs text-orange-600">
                                            Disbursed
                                        </p>

                                        <p className="mt-1 font-bold text-orange-700">
                                            TZS{" "}
                                            {formatMoney(
                                                selectedStatementEvent.disbursed_amount
                                            )}
                                        </p>

                                    </div>


                                    <div className="rounded-xl bg-blue-50 p-4">

                                        <p className="text-xs text-blue-600">
                                            Available
                                        </p>

                                        <p className="mt-1 font-bold text-blue-700">
                                            TZS{" "}
                                            {formatMoney(
                                                selectedStatementEvent.available_amount
                                            )}
                                        </p>

                                    </div>

                                </div>


                                {/* EVENT CONTRIBUTIONS */}

                                <div>

                                    <h4 className="font-bold text-slate-800 mb-3">
                                        Event Contributions
                                    </h4>

                                    <div className="overflow-x-auto">

                                        <table className="w-full text-sm">

                                            <thead className="bg-slate-50">

                                                <tr>

                                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">
                                                        Date
                                                    </th>

                                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">
                                                        Member
                                                    </th>

                                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">
                                                        Type
                                                    </th>

                                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">
                                                        Method
                                                    </th>

                                                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">
                                                        Amount
                                                    </th>

                                                </tr>

                                            </thead>

                                            <tbody>

                                                {eventStatementContributions.length === 0 ? (

                                                    <tr>

                                                        <td
                                                            colSpan="5"
                                                            className="px-4 py-8 text-center text-slate-400"
                                                        >
                                                            No contributions recorded for this event.
                                                        </td>

                                                    </tr>

                                                ) : (

                                                    eventStatementContributions.map(
                                                        item => (

                                                            <tr
                                                                key={item.id}
                                                                className="border-t border-slate-100"
                                                            >

                                                                <td className="px-4 py-3">
                                                                    {formatDate(
                                                                        item.contribution_date
                                                                    )}
                                                                </td>

                                                                <td className="px-4 py-3 font-semibold">
                                                                    {item.member_name}
                                                                </td>

                                                                <td className="px-4 py-3 capitalize">
                                                                    {item.member_type}
                                                                </td>

                                                                <td className="px-4 py-3">
                                                                    {item.payment_method}
                                                                </td>

                                                                <td className="px-4 py-3 text-right font-bold text-green-700">
                                                                    TZS{" "}
                                                                    {formatMoney(
                                                                        item.amount
                                                                    )}
                                                                </td>

                                                            </tr>

                                                        )
                                                    )

                                                )}

                                            </tbody>

                                        </table>

                                    </div>

                                </div>


                                {/* EVENT DISBURSEMENTS */}

                                <div>

                                    <h4 className="font-bold text-slate-800 mb-3">
                                        Event Disbursements
                                    </h4>

                                    <div className="overflow-x-auto">

                                        <table className="w-full text-sm">

                                            <thead className="bg-slate-50">

                                                <tr>

                                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">
                                                        Date
                                                    </th>

                                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">
                                                        Beneficiary
                                                    </th>

                                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">
                                                        Purpose
                                                    </th>

                                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">
                                                        Method
                                                    </th>

                                                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">
                                                        Amount
                                                    </th>

                                                </tr>

                                            </thead>

                                            <tbody>

                                                {eventStatementDisbursements.length === 0 ? (

                                                    <tr>

                                                        <td
                                                            colSpan="5"
                                                            className="px-4 py-8 text-center text-slate-400"
                                                        >
                                                            No disbursements recorded for this event.
                                                        </td>

                                                    </tr>

                                                ) : (

                                                    eventStatementDisbursements.map(
                                                        item => (

                                                            <tr
                                                                key={item.id}
                                                                className="border-t border-slate-100"
                                                            >

                                                                <td className="px-4 py-3">
                                                                    {formatDate(
                                                                        item.disbursement_date
                                                                    )}
                                                                </td>

                                                                <td className="px-4 py-3 font-semibold">
                                                                    {item.beneficiary_name ||
                                                                        item.member_name ||
                                                                        "-"
                                                                    }
                                                                </td>

                                                                <td className="px-4 py-3">
                                                                    {item.purpose}
                                                                </td>

                                                                <td className="px-4 py-3">
                                                                    {item.payment_method}
                                                                </td>

                                                                <td className="px-4 py-3 text-right font-bold text-orange-600">
                                                                    TZS{" "}
                                                                    {formatMoney(
                                                                        item.amount
                                                                    )}
                                                                </td>

                                                            </tr>

                                                        )
                                                    )

                                                )}

                                            </tbody>

                                        </table>

                                    </div>

                                </div>

                            </div>

                        )}

                    </div>

                </div>
            )}


            {/* =================================================
                REPORTS
            ================================================= */}

            {activeSection === "reports" && (

                <div className="space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

                            <FaUsers className="text-blue-600 text-xl" />

                            <p className="mt-4 text-sm text-slate-500">
                                Total Members
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-slate-800">
                                {statistics.totalMembers}
                            </h2>

                        </div>


                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

                            <FaMoneyBillWave className="text-green-600 text-xl" />

                            <p className="mt-4 text-sm text-slate-500">
                                Contributions
                            </p>

                            <h2 className="mt-2 text-xl font-bold text-green-700">
                                TZS{" "}
                                {formatMoney(
                                    financialSummary.totalContributions
                                )}
                            </h2>

                        </div>


                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

                            <FaExchangeAlt className="text-orange-600 text-xl" />

                            <p className="mt-4 text-sm text-slate-500">
                                Disbursements
                            </p>

                            <h2 className="mt-2 text-xl font-bold text-orange-600">
                                TZS{" "}
                                {formatMoney(
                                    financialSummary.totalDisbursements
                                )}
                            </h2>

                        </div>


                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

                            <FaWallet className="text-blue-600 text-xl" />

                            <p className="mt-4 text-sm text-slate-500">
                                Available Balance
                            </p>

                            <h2 className="mt-2 text-xl font-bold text-blue-700">
                                TZS{" "}
                                {formatMoney(
                                    financialSummary.availableBalance
                                )}
                            </h2>

                        </div>

                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">

                        <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-green-700">PAID</span>
                                <FaUserCheck className="text-green-600" />
                            </div>
                            <p className="mt-3 text-2xl font-bold text-green-700">
                                {statementSummary.paidCount}
                            </p>
                            <p className="text-xs text-green-700 mt-1">
                                Fully settled events
                            </p>
                        </div>

                        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-yellow-700">PARTIAL</span>
                                <FaHistory className="text-yellow-600" />
                            </div>
                            <p className="mt-3 text-2xl font-bold text-yellow-700">
                                {statementSummary.partialCount}
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">
                                Partially paid events
                            </p>
                        </div>

                        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-red-700">MISSED</span>
                                <FaExclamationTriangle className="text-red-600" />
                            </div>
                            <p className="mt-3 text-2xl font-bold text-red-700">
                                {statementSummary.missedCount}
                            </p>
                            <p className="text-xs text-red-700 mt-1">
                                No payment recorded
                            </p>
                        </div>

                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-blue-700">WAIVED</span>
                                <FaBan className="text-blue-600" />
                            </div>
                            <p className="mt-3 text-2xl font-bold text-blue-700">
                                {statementSummary.waivedCount}
                            </p>
                            <p className="text-xs text-blue-700 mt-1">
                                Waived obligations
                            </p>
                        </div>

                        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-red-700">
                                    WELFARE DEBT
                                </span>
                                <FaCreditCard className="text-red-600" />
                            </div>
                            <p className="mt-3 text-xl font-bold text-red-700">
                                TZS {formatMoney(statementSummary.totalOutstanding)}
                            </p>
                            <p className="text-xs text-red-700 mt-1">
                                Total outstanding obligations
                            </p>
                        </div>

                    </div>


                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">

                        <div className="flex items-start gap-4">

                            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                <FaChartLine />
                            </div>

                            <div>

                                <h2 className="text-lg font-bold text-slate-800">
                                    Welfare Reports & Analytics
                                </h2>

                                <p className="mt-2 text-sm text-slate-500 max-w-3xl">
                                    Social Welfare financial and membership data is connected to the verified welfare tables.
                                </p>

                            </div>

                        </div>


                        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">

                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">

                                <FaCalendarAlt className="text-blue-600" />

                                <h3 className="mt-3 font-semibold text-slate-800">
                                    Events
                                </h3>

                                <p className="mt-1 text-sm text-slate-500">
                                    {financialSummary.totalEvents} total welfare events.
                                </p>

                            </div>


                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">

                                <FaMoneyBillWave className="text-green-600" />

                                <h3 className="mt-3 font-semibold text-slate-800">
                                    Contributions
                                </h3>

                                <p className="mt-1 text-sm text-slate-500">
                                    {financialSummary.contributionTransactions} posted contribution transactions.
                                </p>

                            </div>


                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">

                                <FaExchangeAlt className="text-orange-600" />

                                <h3 className="mt-3 font-semibold text-slate-800">
                                    Fund Utilization
                                </h3>

                                <p className="mt-1 text-sm text-slate-500">
                                    TZS{" "}
                                    {formatMoney(
                                        financialSummary.totalDisbursements
                                    )}{" "}
                                    has been recorded as disbursed.
                                </p>

                            </div>

                        </div>

                    </div>

                </div>
            )}


            {/* =================================================
                SETTINGS
            ================================================= */}

            {activeSection === "settings" && (

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">

                    <div className="flex items-start gap-4">

                        <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                            <FaCog />
                        </div>

                        <div>

                            <h2 className="text-lg font-bold text-slate-800">
                                Social Welfare Settings & Rules
                            </h2>

                            <p className="mt-2 text-sm text-slate-500 max-w-3xl">
                                Configure the common Initial Balance for welfare members. It remains separate from actual contributions and is used only when a closed event leaves the member with a debit.
                            </p>

                            <div className="mt-6 max-w-2xl rounded-2xl border border-blue-200 bg-blue-50/50 p-6">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center"><FaWallet /></div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">Initial Balance</h3>
                                        <p className="mt-1 text-sm text-slate-500">The same opening reserve can be applied to all members. It never increases Total Contributions.</p>
                                    </div>
                                </div>
                                <div className="mt-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-2">Common Initial Balance (TZS)</label>
                                        <input type="number" min="0" step="0.01" value={initialBalanceValue} onChange={e => setInitialBalanceValue(e.target.value)} placeholder="e.g. 50000" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-400" />
                                    </div>
                                    <button type="button" disabled={initialBalanceSaving} onClick={saveInitialBalanceForMembers} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                                        <FaSave /> {initialBalanceSaving ? "Saving..." : "Save for All Members"}
                                    </button>
                                </div>
                                <div className="mt-4 rounded-xl border border-blue-100 bg-white p-4 text-sm text-slate-600"><strong>Rule:</strong> event credits offset event debits. If a closed-event debit remains, Initial Balance is consumed only up to the remaining debit. Any unused Initial Balance stays separate.</div>
                            </div>

                        </div>

                    </div>

                </div>
            )}


            {/* =================================================
                EVENT DETAILS MODAL
            ================================================= */}

            {selectedEvent && (

                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">

                    <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">

                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

                            <div>

                                <h2 className="text-xl font-bold text-slate-800">
                                    {selectedEvent.event_name}
                                </h2>

                                <p className="text-sm text-slate-500 mt-1">
                                    {selectedEvent.event_type}
                                </p>

                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setSelectedEvent(null)
                                }
                                className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
                            >
                                <FaTimes />
                            </button>

                        </div>


                        <div className="p-6 space-y-6">

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                                <div className="rounded-xl bg-slate-50 p-4">

                                    <p className="text-xs text-slate-400">
                                        Target
                                    </p>

                                    <p className="mt-1 font-bold">
                                        TZS{" "}
                                        {formatMoney(
                                            selectedEvent.target_amount
                                        )}
                                    </p>

                                </div>


                                <div className="rounded-xl bg-green-50 p-4">

                                    <p className="text-xs text-green-600">
                                        Collected
                                    </p>

                                    <p className="mt-1 font-bold text-green-700">
                                        TZS{" "}
                                        {formatMoney(
                                            selectedEvent.collected_amount
                                        )}
                                    </p>

                                </div>


                                <div className="rounded-xl bg-orange-50 p-4">

                                    <p className="text-xs text-orange-600">
                                        Disbursed
                                    </p>

                                    <p className="mt-1 font-bold text-orange-700">
                                        TZS{" "}
                                        {formatMoney(
                                            selectedEvent.disbursed_amount
                                        )}
                                    </p>

                                </div>


                                <div className="rounded-xl bg-blue-50 p-4">

                                    <p className="text-xs text-blue-600">
                                        Available
                                    </p>

                                    <p className="mt-1 font-bold text-blue-700">
                                        TZS{" "}
                                        {formatMoney(
                                            selectedEvent.available_amount
                                        )}
                                    </p>

                                </div>

                            </div>


                            <div>

                                <p className="text-sm font-semibold text-slate-700">
                                    Purpose / Description
                                </p>

                                <p className="mt-2 text-sm text-slate-600">
                                    {selectedEvent.description ||
                                        "No additional description was provided."
                                    }
                                </p>

                            </div>


                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                <div>

                                    <p className="text-xs text-slate-400">
                                        Start Date
                                    </p>

                                    <p className="mt-1 text-sm font-semibold">
                                        {formatDate(
                                            selectedEvent.start_date
                                        )}
                                    </p>

                                </div>


                                <div>

                                    <p className="text-xs text-slate-400">
                                        End Date
                                    </p>

                                    <p className="mt-1 text-sm font-semibold">
                                        {formatDate(
                                            selectedEvent.end_date
                                        )}
                                    </p>

                                </div>


                                <div>

                                    <p className="text-xs text-slate-400">
                                        Status
                                    </p>

                                    <span
                                        className={`inline-flex mt-1 px-2.5 py-1 rounded-full text-xs font-semibold ${getEventStatusClass(
                                            selectedEvent.event_status
                                        )}`}
                                    >
                                        {selectedEvent.event_status}
                                    </span>

                                </div>

                            </div>


                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">

                                <div className="flex items-center gap-3">

                                    <FaHistory className="text-blue-600" />

                                    <div>

                                        <p className="font-semibold text-slate-800">
                                            Financial History
                                        </p>

                                        <p className="text-sm text-slate-500">

                                            Contributions:{" "}
                                            {
                                                selectedEvent.contribution_transactions
                                            }

                                            {" • "}

                                            Disbursements:{" "}
                                            {
                                                selectedEvent.disbursement_transactions
                                            }

                                        </p>

                                    </div>

                                </div>

                            </div>


                            <div id="event-member-assignment" className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 mb-6">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <div className="flex items-center gap-2"><FaUserPlus className="text-blue-600" /><h3 className="font-bold text-slate-800">Member Contribution Assignments</h3></div>
                                        <p className="mt-1 text-sm text-slate-500">Set the amount each member is expected to contribute to this specific event.</p>
                                    </div>
                                    <div className="text-sm font-semibold text-blue-700">{welfareObligations.filter(row => String(row.event_id) === String(selectedEvent.id)).length} assigned</div>
                                </div>
                                {String(selectedEvent.event_status || "").toLowerCase() === "active" && (
                                    <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-3">
                                        <div className="md:col-span-5"><label className="block text-xs font-semibold text-slate-600 mb-1.5">Member</label><select value={assignmentMemberId} onChange={e => setAssignmentMemberId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Select member</option>{members.filter(member => String(member.status || "").toLowerCase() === "active").filter(member => !(welfareObligations || []).some(row => String(row.event_id) === String(selectedEvent.id) && String(row.member_id) === String(member.id))).map(member => <option key={member.id} value={member.id}>{member.full_name}{member.member_number ? ` — ${member.member_number}` : ""}</option>)}</select></div>
                                        <div className="md:col-span-4"><label className="block text-xs font-semibold text-slate-600 mb-1.5">Expected Contribution (TZS)</label><input type="number" min="0.01" step="0.01" value={assignmentExpectedAmount} onChange={e => setAssignmentExpectedAmount(e.target.value)} placeholder="100000" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" /></div>
                                        <div className="md:col-span-3 flex items-end"><button type="button" onClick={handleAssignEventMember} disabled={assignmentSaving} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><FaUserPlus />{assignmentSaving ? "Assigning..." : "Assign Member"}</button></div>
                                    </div>
                                )}
                                <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left">Member</th><th className="px-4 py-3 text-right">Expected</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-left">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{welfareObligations.filter(row => String(row.event_id) === String(selectedEvent.id)).map(row => { const status=row.calculated_status || row.contribution_status || "MISSED"; const cls=status === "PAID" ? "bg-green-100 text-green-700" : status === "PARTIAL" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"; return <tr key={row.event_member_id || `${row.event_id}-${row.member_id}`}><td className="px-4 py-3 font-medium">{row.member_name}</td><td className="px-4 py-3 text-right">TZS {formatMoney(row.expected_amount)}</td><td className="px-4 py-3 text-right text-green-700">TZS {formatMoney(row.paid_amount)}</td><td className="px-4 py-3 text-right text-red-700">TZS {formatMoney(row.outstanding_amount)}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{status}</span></td></tr>; })}{welfareObligations.filter(row => String(row.event_id) === String(selectedEvent.id)).length === 0 && <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500">No members have been assigned to this event yet.</td></tr>}</tbody></table></div>
                            </div>

                            <div className="flex flex-wrap gap-3">

                                {String(
                                    selectedEvent.event_status
                                ).toLowerCase() === "active" && (

                                    <>

                                        <button type="button" onClick={() => document.getElementById("event-member-assignment")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"><FaUserPlus />Assign Member</button>

                                        <button
                                            type="button"
                                            onClick={() => {

                                                const event =
                                                    selectedEvent;

                                                setSelectedEvent(
                                                    null
                                                );

                                                openContributionModal(
                                                    event
                                                );

                                            }}
                                            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700"
                                        >
                                            <FaMoneyBillWave />
                                            Add Contribution
                                        </button>


                                        <button
                                            type="button"
                                            onClick={() => {

                                                const event =
                                                    selectedEvent;

                                                setSelectedEvent(
                                                    null
                                                );

                                                openDisbursementModal(
                                                    event
                                                );

                                            }}
                                            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700"
                                        >
                                            <FaExchangeAlt />
                                            Record Disbursement
                                        </button>


                                        <button
                                            type="button"
                                            disabled={saving}
                                            onClick={() =>
                                                updateEventStatus(
                                                    selectedEvent,
                                                    "Closed"
                                                )
                                            }
                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                        >
                                            <FaLock />
                                            Close Event
                                        </button>


                                        <button
                                            type="button"
                                            disabled={saving}
                                            onClick={() =>
                                                updateEventStatus(
                                                    selectedEvent,
                                                    "Cancelled"
                                                )
                                            }
                                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                        >
                                            <FaBan />
                                            Cancel Event
                                        </button>

                                    </>

                                )}


                                {String(
                                    selectedEvent.event_status
                                ).toLowerCase() === "cancelled" && (

                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() =>
                                            handleDeleteCancelledEvent(
                                                selectedEvent
                                            )
                                        }
                                        className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                    >
                                        <FaTrash />
                                        Delete Cancelled Event
                                    </button>

                                )}


                                <button
                                    type="button"
                                    onClick={() => {

                                        setSelectedEvent(
                                            null
                                        );

                                        setStatementEventId(
                                            selectedEvent.id
                                        );

                                        setActiveSection(
                                            "statements"
                                        );

                                    }}
                                    className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700"
                                >
                                    <FaFileAlt />
                                    Event Statement
                                </button>

                            </div>

                        </div>

                    </div>

                </div>
            )}


            {/* =================================================
                CREATE EVENT MODAL
            ================================================= */}

            {eventModalOpen && (

                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">

                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">

                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

                            <div>

                                <h2 className="text-xl font-bold text-slate-800">
                                    Create Welfare Event
                                </h2>

                                <p className="text-sm text-slate-500 mt-1">
                                    Create a wedding, funeral, medical, emergency or custom cause.
                                </p>

                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setEventModalOpen(false)
                                }
                                className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
                            >
                                <FaTimes />
                            </button>

                        </div>


                        <form
                            onSubmit={
                                handleCreateEvent
                            }
                            className="p-6 space-y-5"
                        >

                            <div>

                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Event Name
                                </label>

                                <input
                                    type="text"
                                    value={
                                        eventForm.event_name
                                    }
                                    onChange={e =>
                                        setEventForm({
                                            ...eventForm,
                                            event_name:
                                                e.target.value
                                        })
                                    }
                                    placeholder="e.g. Medical Support - John"
                                    required
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />

                            </div>


                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                                <div>

                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Event Type
                                    </label>

                                    <select
                                        value={
                                            eventForm.event_type
                                        }
                                        onChange={e =>
                                            setEventForm({
                                                ...eventForm,
                                                event_type:
                                                    e.target.value
                                            })
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white outline-none focus:border-blue-400"
                                    >

                                        {eventTypes.map(
                                            type => (

                                                <option
                                                    key={type}
                                                    value={type}
                                                >
                                                    {type}
                                                </option>

                                            )
                                        )}

                                    </select>

                                </div>


                                <div>

                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Target Amount
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={
                                            eventForm.target_amount
                                        }
                                        onChange={e =>
                                            setEventForm({
                                                ...eventForm,
                                                target_amount:
                                                    e.target.value
                                            })
                                        }
                                        placeholder="100000"
                                        required
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
                                    />

                                </div>

                            </div>


                            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">

                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                                        <FaUserPlus />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">Assign Members to This Event</h3>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Assign each member now and set the exact amount they are expected to contribute to this specific event.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-3">
                                    <div className="md:col-span-5">
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Member</label>
                                        <select
                                            value={eventAssignmentMemberId}
                                            onChange={e => setEventAssignmentMemberId(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                        >
                                            <option value="">Select member</option>
                                            {members
                                                .filter(member => String(member.status || "").toLowerCase() === "active")
                                                .filter(member => !eventAssignments.some(item => String(item.member_id) === String(member.id)))
                                                .map(member => (
                                                    <option key={member.id} value={member.id}>
                                                        {member.full_name}{member.member_number ? ` — ${member.member_number}` : ""}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>

                                    <div className="md:col-span-4">
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Expected Contribution (TZS)</label>
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={eventAssignmentExpectedAmount}
                                            onChange={e => setEventAssignmentExpectedAmount(e.target.value)}
                                            placeholder="e.g. 100000"
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                        />
                                    </div>

                                    <div className="md:col-span-3 flex items-end">
                                        <button
                                            type="button"
                                            onClick={addEventCreationAssignment}
                                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                                        >
                                            <FaUserPlus /> Add Member
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left">Member</th>
                                                <th className="px-4 py-3 text-right">Expected Contribution</th>
                                                <th className="px-4 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {eventAssignments.map(item => (
                                                <tr key={item.member_id}>
                                                    <td className="px-4 py-3 font-medium text-slate-800">
                                                        {item.member_name}
                                                        {item.member_number ? <span className="ml-2 text-xs text-slate-400">{item.member_number}</span> : null}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-blue-700">
                                                        TZS {formatMoney(item.expected_amount)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeEventCreationAssignment(item.member_id)}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                        >
                                                            <FaTimes /> Remove
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {eventAssignments.length === 0 && (
                                                <tr>
                                                    <td colSpan="3" className="px-4 py-6 text-center text-sm text-slate-400">
                                                        No members assigned yet. You can add one or more members before creating the event.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                            </div>


                            <div>

                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Purpose / Description
                                </label>

                                <textarea
                                    rows="4"
                                    value={
                                        eventForm.description
                                    }
                                    onChange={e =>
                                        setEventForm({
                                            ...eventForm,
                                            description:
                                                e.target.value
                                        })
                                    }
                                    placeholder="Explain the purpose of this welfare event..."
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none resize-none focus:border-blue-400"
                                />

                            </div>


                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                                <div>

                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Start Date
                                    </label>

                                    <input
                                        type="date"
                                        value={
                                            eventForm.start_date
                                        }
                                        onChange={e =>
                                            setEventForm({
                                                ...eventForm,
                                                start_date:
                                                    e.target.value
                                            })
                                        }
                                        required
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
                                    />

                                </div>


                                <div>

                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        End Date
                                    </label>

                                    <input
                                        type="date"
                                        value={
                                            eventForm.end_date
                                        }
                                        onChange={e =>
                                            setEventForm({
                                                ...eventForm,
                                                end_date:
                                                    e.target.value
                                            })
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
                                    />

                                </div>

                            </div>


                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">

                                <button
                                    type="button"
                                    onClick={() =>
                                        setEventModalOpen(false)
                                    }
                                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                    <FaSave />
                                    {saving
                                        ? "Saving..."
                                        : "Create Event"
                                    }
                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}


            {/* =================================================
                ADD INITIAL BALANCE MODAL
            ================================================= */}

            {initialBalanceModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Add Initial Balance</h2>
                                <p className="text-sm text-slate-500 mt-1">
                                    This is a member reserve, not an event contribution.
                                </p>
                            </div>
                            <button type="button" onClick={() => setInitialBalanceModalOpen(false)} className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                                <FaTimes />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                                <p className="text-xs font-semibold text-blue-700">Member</p>
                                <p className="mt-1 font-bold text-blue-900">
                                    {members.find(item => String(item.id) === String(initialBalanceMemberId))?.full_name || "Selected Member"}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Amount to Add (TZS)</label>
                                <input type="number" min="0.01" step="0.01" value={initialBalanceMemberAmount} onChange={e => setInitialBalanceMemberAmount(e.target.value)} placeholder="100000" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
                                <p className="mt-2 text-xs text-slate-500">If this member has a closed-event debt, the new initial balance is automatically applied against that debt first.</p>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setInitialBalanceModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
                                <button type="button" onClick={saveInitialBalanceForMember} disabled={initialBalanceSaving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{initialBalanceSaving ? "Saving..." : "Add Initial Balance"}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* =================================================
                CONTRIBUTION MODAL
            ================================================= */}

            {contributionModalOpen && (

                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">

                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">

                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

                            <div>

                                <h2 className="text-xl font-bold text-slate-800">
                                    Record Welfare Contribution
                                </h2>

                                <p className="text-sm text-slate-500 mt-1">
                                    Link this contribution to a specific welfare event.
                                </p>

                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setContributionModalOpen(false)
                                }
                                className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center"
                            >
                                <FaTimes />
                            </button>

                        </div>


                        <form
                            onSubmit={
                                handleRecordContribution
                            }
                            className="p-6 space-y-5"
                        >

                            <div>

                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Welfare Member
                                </label>

                                <select
                                    value={
                                        contributionForm.member_id
                                    }
                                    onChange={e =>
                                        setContributionForm({
                                            ...contributionForm,
                                            member_id:
                                                e.target.value
                                        })
                                    }
                                    required
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white"
                                >

                                    <option value="">
                                        Select member
                                    </option>

                                    {contributionEventMembersLoading ? (
                                        <option value="">Loading assigned members...</option>
                                    ) : !contributionForm.event_id ? (
                                        <option value="" disabled>Select an event first</option>
                                    ) : contributionEventMembers.length === 0 ? (
                                        <option value="">No members assigned to this event</option>
                                    ) : (
                                        contributionEventMembers.map(assignment => {
                                            const member = assignment.member;
                                            return (
                                                <option
                                                    key={member.id}
                                                    value={member.id}
                                                >
                                                    {member.full_name}
                                                    {" — "}
                                                    {member.member_number || ""}
                                                    {" — Expected TZS "}
                                                    {formatMoney(assignment.expected_amount)}
                                                </option>
                                            );
                                        })
                                    )}

                                </select>

                                {contributionForm.member_id && contributionForm.event_id && (() => {
                                    const assignment = contributionEventMembers.find(row =>
                                        String(row.member_id) === String(contributionForm.member_id)
                                    );

                                    const obligation = assignment
                                        ? {
                                            ...assignment,
                                            outstanding_amount: Math.max(
                                                0,
                                                Number(assignment.expected_amount) -
                                                contributions.reduce((sum, contribution) => {
                                                    if (
                                                        String(contribution.member_id) === String(contributionForm.member_id) &&
                                                        String(contribution.event_id) === String(contributionForm.event_id) &&
                                                        String(contribution.status || "").toLowerCase() === "posted"
                                                    ) {
                                                        return sum + (Number(contribution.amount) || 0);
                                                    }
                                                    return sum;
                                                }, 0)
                                            )
                                        }
                                        : null;

                                    return obligation ? (
                                        <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-slate-600">Expected for this event</span>
                                                <strong className="text-blue-700">TZS {formatMoney(obligation.expected_amount)}</strong>
                                            </div>
                                            <div className="mt-1 flex items-center justify-between gap-3">
                                                <span className="text-slate-500">Outstanding</span>
                                                <strong className="text-red-600">TZS {formatMoney(obligation.outstanding_amount)}</strong>
                                            </div>
                                        </div>
                                    ) : null;
                                })()}

                            </div>


                            <div>

                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Welfare Event
                                </label>

                                <select
                                    value={
                                        contributionForm.event_id
                                    }
                                    onChange={e =>
                                        setContributionForm({
                                            ...contributionForm,
                                            event_id: e.target.value,
                                            member_id: ""
                                        })
                                    }
                                    required
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white"
                                >

                                    <option value="">
                                        Select event
                                    </option>

                                    {eventsWithFinancials
                                        .filter(
                                            event =>
                                                String(
                                                    event.event_status || ""
                                                ).toLowerCase() ===
                                                "active"
                                        )
                                        .map(
                                            event => (

                                                <option
                                                    key={event.id}
                                                    value={event.id}
                                                >
                                                    {event.event_name}
                                                    {" — Available TZS "}
                                                    {formatMoney(
                                                        event.available_amount
                                                    )}
                                                </option>

                                            )
                                        )}

                                </select>

                            </div>


                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                                <div>

                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Amount
                                    </label>

                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={
                                            contributionForm.amount
                                        }
                                        onChange={e =>
                                            setContributionForm({
                                                ...contributionForm,
                                                amount:
                                                    e.target.value
                                            })
                                        }
                                        required
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                                    />

                                </div>


                                <div>

                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Payment Method
                                    </label>

                                    <select
                                        value={
                                            contributionForm.payment_method
                                        }
                                        onChange={e =>
                                            setContributionForm({
                                                ...contributionForm,
                                                payment_method:
                                                    e.target.value
                                            })
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white"
                                    >

                                        {paymentMethods.map(
                                            method => (

                                                <option
                                                    key={method}
                                                    value={method}
                                                >
                                                    {method}
                                                </option>

                                            )
                                        )}

                                    </select>

                                </div>

                            </div>


                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                                <div>

                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Contribution Date
                                    </label>

                                    <input
                                        type="date"
                                        value={
                                            contributionForm.contribution_date
                                        }
                                        onChange={e =>
                                            setContributionForm({
                                                ...contributionForm,
                                                contribution_date:
                                                    e.target.value
                                            })
                                        }
                                        required
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                                    />

                                </div>


                                <div>

                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Reference Number
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            contributionForm.reference_number
                                        }
                                        onChange={e =>
                                            setContributionForm({
                                                ...contributionForm,
                                                reference_number:
                                                    e.target.value
                                            })
                                        }
                                        placeholder="Optional"
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                                    />

                                </div>

                            </div>


                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">

                                <button
                                    type="button"
                                    onClick={() =>
                                        setContributionModalOpen(false)
                                    }
                                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                                >
                                    <FaSave />
                                    {saving
                                        ? "Saving..."
                                        : "Save Contribution"
                                    }
                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}


            {/* =================================================
                DISBURSEMENT MODAL
            ================================================= */}

            {disbursementModalOpen && (

                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">

                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">

                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

                            <div>

                                <h2 className="text-xl font-bold text-slate-800">
                                    Record Welfare Disbursement
                                </h2>

                                <p className="text-sm text-slate-500 mt-1">
                                    Record money released from a welfare event.
                                </p>

                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setDisbursementModalOpen(false)
                                }
                                className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center"
                            >
                                <FaTimes />
                            </button>

                        </div>


                        <form
                            onSubmit={
                                handleRecordDisbursement
                            }
                            className="p-6 space-y-5"
                        >

                            <div>

                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Welfare Event
                                </label>

                                <select
                                    value={
                                        disbursementForm.event_id
                                    }
                                    onChange={e =>
                                        setDisbursementForm({
                                            ...disbursementForm,
                                            event_id:
                                                e.target.value
                                        })
                                    }
                                    required
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white"
                                >

                                    <option value="">
                                        Select event
                                    </option>

                                    {eventsWithFinancials
                                        .filter(
                                            event =>
                                                String(
                                                    event.event_status || ""
                                                ).toLowerCase() ===
                                                "active"
                                        )
                                        .map(
                                            event => (

                                                <option
                                                    key={event.id}
                                                    value={event.id}
                                                >
                                                    {event.event_name}
                                                    {" — Available TZS "}
                                                    {formatMoney(
                                                        event.available_amount
                                                    )}
                                                </option>

                                            )
                                        )}

                                </select>

                            </div>


                            <div>

                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Beneficiary Name
                                </label>

                                <input
                                    type="text"
                                    value={
                                        disbursementForm.beneficiary_name
                                    }
                                    onChange={e =>
                                        setDisbursementForm({
                                            ...disbursementForm,
                                            beneficiary_name:
                                                e.target.value
                                        })
                                    }
                                    placeholder="e.g. John Family"
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                                />

                            </div>


                            <div>

                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Welfare Member Beneficiary
                                </label>

                                <select
                                    value={
                                        disbursementForm.member_id
                                    }
                                    onChange={e =>
                                        setDisbursementForm({
                                            ...disbursementForm,
                                            member_id:
                                                e.target.value
                                        })
                                    }
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white"
                                >

                                    <option value="">
                                        Optional — select member
                                    </option>

                                    {members.map(
                                        member => (

                                            <option
                                                key={member.id}
                                                value={member.id}
                                            >
                                                {member.full_name}
                                                {" — "}
                                                {member.member_number || ""}
                                            </option>

                                        )
                                    )}

                                </select>

                            </div>


                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                                <div>

                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Amount
                                    </label>

                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={
                                            disbursementForm.amount
                                        }
                                        onChange={e =>
                                            setDisbursementForm({
                                                ...disbursementForm,
                                                amount:
                                                    e.target.value
                                            })
                                        }
                                        required
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                                    />

                                </div>


                                <div>

                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Payment Method
                                    </label>

                                    <select
                                        value={
                                            disbursementForm.payment_method
                                        }
                                        onChange={e =>
                                            setDisbursementForm({
                                                ...disbursementForm,
                                                payment_method:
                                                    e.target.value
                                            })
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white"
                                    >

                                        {paymentMethods.map(
                                            method => (

                                                <option
                                                    key={method}
                                                    value={method}
                                                >
                                                    {method}
                                                </option>

                                            )
                                        )}

                                    </select>

                                </div>

                            </div>


                            <div>

                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Purpose
                                </label>

                                <textarea
                                    rows="3"
                                    value={
                                        disbursementForm.purpose
                                    }
                                    onChange={e =>
                                        setDisbursementForm({
                                            ...disbursementForm,
                                            purpose:
                                                e.target.value
                                        })
                                    }
                                    placeholder="e.g. Funeral assistance, medical assistance..."
                                    required
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm resize-none"
                                />

                            </div>


                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                                <div>

                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Disbursement Date
                                    </label>

                                    <input
                                        type="date"
                                        value={
                                            disbursementForm.disbursement_date
                                        }
                                        onChange={e =>
                                            setDisbursementForm({
                                                ...disbursementForm,
                                                disbursement_date:
                                                    e.target.value
                                            })
                                        }
                                        required
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                                    />

                                </div>


                                <div>

                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Reference Number
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            disbursementForm.reference_number
                                        }
                                        onChange={e =>
                                            setDisbursementForm({
                                                ...disbursementForm,
                                                reference_number:
                                                    e.target.value
                                            })
                                        }
                                        placeholder="Optional"
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                                    />

                                </div>

                            </div>


                            <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">

                                <p className="text-sm font-semibold text-orange-800">
                                    Financial control
                                </p>

                                <p className="mt-1 text-sm text-orange-700">
                                    The system will not allow a disbursement greater than the available balance of the selected event.
                                </p>

                            </div>


                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">

                                <button
                                    type="button"
                                    onClick={() =>
                                        setDisbursementModalOpen(false)
                                    }
                                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                                >
                                    <FaSave />
                                    {saving
                                        ? "Saving..."
                                        : "Save Disbursement"
                                    }
                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}

        </div>
    );
}

export default SocialWelfareDashboard;