import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
    ArrowLeft,
    Megaphone,
    Plus,
    Send,
    Users,
    Clock,
    Search,
    X,
    CheckCircle2,
    AlertCircle,
    UserCircle,
    RefreshCw,
} from "lucide-react";

import { supabase } from "../../services/supabase";


// ============================================================
// AUTHORIZED ANNOUNCEMENT CREATORS
// ============================================================

const ANNOUNCEMENT_CREATOR_ROLE_IDS = [
    2, // Headmaster
    3, // Deputy Headmaster
    4, // Academic Master
    8, // Social Welfare Manager
];


// ============================================================
// HELPERS
// ============================================================

const formatDateTime = (value) => {
    if (!value) return "";

    try {
        return new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(value));
    } catch {
        return "";
    }
};


const formatDateOnly = (value) => {
    if (!value) return "";

    try {
        return new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }).format(new Date(value));
    } catch {
        return "";
    }
};


const getInitials = (name) => {
    const value = String(name || "").trim();

    if (!value) {
        return "?";
    }

    const parts = value
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 1) {
        return parts[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return (
        parts[0].charAt(0) +
        parts[parts.length - 1].charAt(0)
    ).toUpperCase();
};


// ============================================================
// COMPONENT
// ============================================================

const CommunicationAnnouncements = () => {

    const navigate = useNavigate();

    // ========================================================
    // USER
    // ========================================================

    const [currentUser, setCurrentUser] =
        useState(null);

    const [loadingUser, setLoadingUser] =
        useState(true);


    // ========================================================
    // ANNOUNCEMENTS
    // ========================================================

    const [announcements, setAnnouncements] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [refreshing, setRefreshing] =
        useState(false);


    // ========================================================
    // FORM
    // ========================================================

    const [showForm, setShowForm] =
        useState(false);

    const [title, setTitle] =
        useState("");

    const [message, setMessage] =
        useState("");

    const [publishing, setPublishing] =
        useState(false);


    // ========================================================
    // SEARCH
    // ========================================================

    const [searchText, setSearchText] =
        useState("");


    // ========================================================
    // UI MESSAGES
    // ========================================================

    const [error, setError] =
        useState("");

    const [successMessage, setSuccessMessage] =
        useState("");


    // ========================================================
    // REF
    // ========================================================

    const realtimeChannelRef =
        useRef(null);


    // ========================================================
    // LOAD CURRENT USER
    // ========================================================

    const loadCurrentUser =
        useCallback(async () => {

            try {

                setLoadingUser(true);

                const {
                    data: {
                        user,
                    },
                    error: authError,
                } =
                    await supabase.auth.getUser();

                if (authError) {
                    throw authError;
                }

                if (!user) {
                    throw new Error(
                        "You are not logged in."
                    );
                }


                const {
                    data: profile,
                    error: profileError,
                } =
                    await supabase
                        .from("profiles")
                        .select(`
                            id,
                            full_name,
                            role_id,
                            school_id,
                            phone,
                            teacher_id,
                            employee_id
                        `)
                        .eq(
                            "id",
                            user.id
                        )
                        .single();

                if (profileError) {
                    throw profileError;
                }


                const completeUser = {
                    ...profile,
                    email:
                        user.email || "",
                };


                setCurrentUser(
                    completeUser
                );

                return completeUser;

            } catch (userError) {

                console.error(
                    "Load current user error:",
                    userError
                );

                setError(
                    userError?.message ||
                    "Unable to load your profile."
                );

                return null;

            } finally {

                setLoadingUser(false);

            }

        }, []);


    // ========================================================
    // PERMISSION CHECK
    // ========================================================

    const canCreateAnnouncement =
        useMemo(() => {

            if (!currentUser) {
                return false;
            }

            return ANNOUNCEMENT_CREATOR_ROLE_IDS.includes(
                Number(currentUser.role_id)
            );

        }, [
            currentUser,
        ]);


    // ========================================================
    // LOAD ANNOUNCEMENTS
    // ========================================================

    const loadAnnouncements =
        useCallback(async (
            showRefresh = false
        ) => {

            if (
                !currentUser?.school_id
            ) {
                return;
            }


            try {

                if (showRefresh) {
                    setRefreshing(true);
                } else {
                    setLoading(true);
                }

                setError("");


                /*
                 * Actual verified announcements schema:
                 *
                 * id
                 * school_id
                 * title
                 * content
                 * created_by
                 * created_at
                 * updated_at
                 *
                 * We do not use a guessed audience column.
                 */
                const {
                    data,
                    error: announcementsError,
                } =
                    await supabase
                        .from("announcements")
                        .select(`
                            id,
                            school_id,
                            title,
                            content,
                            created_by,
                            created_at,
                            updated_at
                        `)
                        .eq(
                            "school_id",
                            currentUser.school_id
                        )
                        .order(
                            "created_at",
                            {
                                ascending: false,
                            }
                        );


                if (announcementsError) {
                    throw announcementsError;
                }


                const rows =
                    data || [];


                /*
                 * Get creator profiles so the UI can show
                 * who published the announcement.
                 */
                const creatorIds = [
                    ...new Set(
                        rows
                            .map(
                                item =>
                                    item.created_by
                            )
                            .filter(Boolean)
                    ),
                ];


                let creatorMap = {};


                if (
                    creatorIds.length > 0
                ) {

                    const {
                        data: creators,
                        error: creatorsError,
                    } =
                        await supabase
                            .from("profiles")
                            .select(`
                                id,
                                full_name,
                                role_id
                            `)
                            .in(
                                "id",
                                creatorIds
                            );


                    if (
                        creatorsError
                    ) {

                        console.warn(
                            "Creator profiles could not be loaded:",
                            creatorsError
                        );

                    } else {

                        creatorMap =
                            (creators || []).reduce(
                                (
                                    result,
                                    creator
                                ) => {

                                    result[
                                        creator.id
                                    ] =
                                        creator;

                                    return result;

                                },
                                {}
                            );

                    }

                }


                const enriched =
                    rows.map(
                        announcement => ({
                            ...announcement,
                            creator:
                                creatorMap[
                                    announcement.created_by
                                ] || null,
                        })
                    );


                setAnnouncements(
                    enriched
                );


                return enriched;

            } catch (loadError) {

                console.error(
                    "Load announcements error:",
                    loadError
                );

                setError(
                    loadError?.message ||
                    "Failed to load announcements."
                );

                return [];

            } finally {

                setLoading(false);
                setRefreshing(false);

            }

        }, [
            currentUser?.school_id,
        ]);


    // ========================================================
    // INITIAL LOAD
    // ========================================================

    useEffect(() => {

        let mounted = true;


        const initialize =
            async () => {

                const user =
                    await loadCurrentUser();

                if (
                    !mounted ||
                    !user
                ) {
                    return;
                }

                await loadAnnouncements(
                    false
                );

            };


        initialize();


        return () => {
            mounted = false;
        };

    }, [
        loadCurrentUser,
        loadAnnouncements,
    ]);


    // ========================================================
    // REALTIME ANNOUNCEMENTS
    // ========================================================

    useEffect(() => {

        if (
            !currentUser?.school_id
        ) {
            return;
        }


        /*
         * Remove old channel if it exists.
         */
        if (
            realtimeChannelRef.current
        ) {

            supabase.removeChannel(
                realtimeChannelRef.current
            );

            realtimeChannelRef.current =
                null;

        }


        const channel =
            supabase
                .channel(
                    `school-announcements-${currentUser.school_id}-${Date.now()}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "announcements",
                        filter:
                            `school_id=eq.${currentUser.school_id}`,
                    },
                    async (payload) => {

                        const newAnnouncement =
                            payload.new;

                        if (
                            !newAnnouncement
                        ) {
                            return;
                        }


                        /*
                         * Fetch creator information for the
                         * newly received announcement.
                         */
                        let creator =
                            null;


                        if (
                            newAnnouncement.created_by
                        ) {

                            const {
                                data: creatorData,
                            } =
                                await supabase
                                    .from("profiles")
                                    .select(`
                                        id,
                                        full_name,
                                        role_id
                                    `)
                                    .eq(
                                        "id",
                                        newAnnouncement.created_by
                                    )
                                    .maybeSingle();

                            creator =
                                creatorData ||
                                null;

                        }


                        setAnnouncements(
                            previous => {

                                const exists =
                                    previous.some(
                                        item =>
                                            item.id ===
                                            newAnnouncement.id
                                    );

                                if (exists) {
                                    return previous;
                                }


                                return [
                                    {
                                        ...newAnnouncement,
                                        creator,
                                    },
                                    ...previous,
                                ];

                            }
                        );


                        /*
                         * Only show a success message for
                         * realtime announcements that were not
                         * already inserted by this browser.
                         */
                        if (
                            newAnnouncement.created_by !==
                            currentUser.id
                        ) {

                            setSuccessMessage(
                                "A new school announcement has been published."
                            );

                            setTimeout(() => {
                                setSuccessMessage("");
                            }, 3500);

                        }

                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",
                        schema: "public",
                        table: "announcements",
                        filter:
                            `school_id=eq.${currentUser.school_id}`,
                    },
                    (payload) => {

                        const updated =
                            payload.new;

                        if (!updated) {
                            return;
                        }


                        setAnnouncements(
                            previous =>
                                previous.map(
                                    item =>
                                        item.id ===
                                        updated.id
                                            ? {
                                                ...item,
                                                ...updated,
                                            }
                                            : item
                                )
                        );

                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "postgres_changes",
                    },
                    () => {
                        /*
                         * Intentionally empty.
                         *
                         * The INSERT and UPDATE listeners above
                         * handle announcement changes.
                         */
                    }
                )
                .subscribe(
                    status => {

                        if (
                            status ===
                            "CHANNEL_ERROR"
                        ) {

                            console.warn(
                                "Announcement realtime channel error."
                            );

                        }

                        if (
                            status ===
                            "TIMED_OUT"
                        ) {

                            console.warn(
                                "Announcement realtime channel timed out."
                            );

                        }

                    }
                );


        realtimeChannelRef.current =
            channel;


        return () => {

            if (
                realtimeChannelRef.current ===
                channel
            ) {

                supabase.removeChannel(
                    channel
                );

                realtimeChannelRef.current =
                    null;

            }

        };

    }, [
        currentUser?.id,
        currentUser?.school_id,
    ]);


    // ========================================================
    // FILTER
    // ========================================================

    const filteredAnnouncements =
        useMemo(() => {

            const query =
                searchText
                    .trim()
                    .toLowerCase();


            if (!query) {
                return announcements;
            }


            return announcements.filter(
                announcement => {

                    const title =
                        String(
                            announcement.title ||
                            ""
                        ).toLowerCase();

                    const content =
                        String(
                            announcement.content ||
                            ""
                        ).toLowerCase();

                    const creator =
                        String(
                            announcement.creator?.full_name ||
                            ""
                        ).toLowerCase();

                    return (
                        title.includes(query) ||
                        content.includes(query) ||
                        creator.includes(query)
                    );

                }
            );

        }, [
            announcements,
            searchText,
        ]);


    // ========================================================
    // OPEN FORM
    // ========================================================

    const openForm = () => {

        setError("");
        setSuccessMessage("");

        setTitle("");
        setMessage("");

        setShowForm(true);

    };


    // ========================================================
    // CLOSE FORM
    // ========================================================

    const closeForm = () => {

        if (publishing) {
            return;
        }

        setShowForm(false);

    };


    // ========================================================
    // PUBLISH ANNOUNCEMENT
    // ========================================================

    const publishAnnouncement =
        async (
            event
        ) => {

            event.preventDefault();


            if (
                !currentUser?.id ||
                !currentUser?.school_id
            ) {

                setError(
                    "Your school profile could not be identified."
                );

                return;

            }


            if (
                !canCreateAnnouncement
            ) {

                setError(
                    "You are not authorized to create announcements."
                );

                return;

            }


            const cleanTitle =
                title.trim();

            const cleanMessage =
                message.trim();


            if (!cleanTitle) {

                setError(
                    "Please enter the announcement title."
                );

                return;

            }


            if (!cleanMessage) {

                setError(
                    "Please enter the announcement message."
                );

                return;

            }


            try {

                setPublishing(true);
                setError("");
                setSuccessMessage("");


                /*
                 * IMPORTANT:
                 *
                 * The actual database table uses `content`,
                 * not `message`.
                 *
                 * We also use the authenticated user's real
                 * profile ID as created_by.
                 */
                const {
                    data,
                    error: insertError,
                } =
                    await supabase
                        .from("announcements")
                        .insert({
                            school_id:
                                currentUser.school_id,

                            title:
                                cleanTitle,

                            content:
                                cleanMessage,

                            created_by:
                                currentUser.id,
                        })
                        .select(`
                            id,
                            school_id,
                            title,
                            content,
                            created_by,
                            created_at,
                            updated_at
                        `)
                        .single();


                if (insertError) {
                    throw insertError;
                }


                /*
                 * Add immediately to the current browser so the
                 * creator does not have to wait for realtime.
                 */
                if (data) {

                    setAnnouncements(
                        previous => {

                            const exists =
                                previous.some(
                                    item =>
                                        item.id ===
                                        data.id
                                );

                            if (exists) {
                                return previous;
                            }


                            return [
                                {
                                    ...data,
                                    creator: {
                                        id:
                                            currentUser.id,
                                        full_name:
                                            currentUser.full_name,
                                        role_id:
                                            currentUser.role_id,
                                    },
                                },
                                ...previous,
                            ];

                        }
                    );

                }


                /*
                 * IMPORTANT:
                 *
                 * The database trigger already created in
                 * Supabase will notify all users belonging to
                 * this school.
                 *
                 * We therefore DO NOT manually insert duplicate
                 * notifications here.
                 */


                setTitle("");
                setMessage("");
                setShowForm(false);


                setSuccessMessage(
                    "Announcement published successfully. All users in your school will receive it."
                );


                setTimeout(() => {
                    setSuccessMessage("");
                }, 5000);


            } catch (publishError) {

                console.error(
                    "Publish announcement error:",
                    publishError
                );


                setError(
                    publishError?.message ||
                    "Failed to publish announcement."
                );

            } finally {

                setPublishing(false);

            }

        };


    // ========================================================
    // LOADING USER
    // ========================================================

    if (
        loadingUser
    ) {

        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">

                <div className="text-center">

                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />

                    <p className="text-sm font-semibold text-slate-600">
                        Loading announcements...
                    </p>

                </div>

            </div>
        );

    }


    // ========================================================
    // MAIN
    // ========================================================

    return (

        <div className="min-h-screen bg-slate-50 p-4 md:p-6">

            <div className="mx-auto max-w-6xl">


                {/* ==================================================
                    HEADER
                ================================================== */}

                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                    <div className="flex items-center gap-3">

                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/communication"
                                )
                            }
                            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition hover:bg-slate-100"
                        >

                            <ArrowLeft className="h-5 w-5" />

                        </button>


                        <div>

                            <div className="flex items-center gap-2">

                                <h1 className="text-2xl font-bold text-slate-900">
                                    Announcements
                                </h1>

                                <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
                                    SCHOOL
                                </span>

                            </div>

                            <p className="text-sm text-slate-500">
                                Publish important information to your school community.
                            </p>

                        </div>

                    </div>


                    {canCreateAnnouncement && (

                        <button
                            type="button"
                            onClick={openForm}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                        >

                            <Plus className="h-4 w-4" />

                            New Announcement

                        </button>

                    )}

                </div>


                {/* ==================================================
                    PERMISSION INFORMATION
                ================================================== */}

                {!canCreateAnnouncement && (

                    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">

                        <Users className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

                        <div>

                            <p className="text-sm font-bold text-blue-900">
                                School Announcements
                            </p>

                            <p className="mt-0.5 text-xs leading-5 text-blue-700">
                                You can view announcements published for your school.
                                Announcement creation is available to authorized management roles.
                            </p>

                        </div>

                    </div>

                )}


                {/* ==================================================
                    SUCCESS
                ================================================== */}

                {successMessage && (

                    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">

                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />

                        <p className="text-sm font-semibold text-green-700">
                            {successMessage}
                        </p>

                    </div>

                )}


                {/* ==================================================
                    ERROR
                ================================================== */}

                {error && (

                    <div className="mb-5 flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">

                        <div className="flex items-start gap-3">

                            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

                            <p className="text-sm font-semibold text-red-700">
                                {error}
                            </p>

                        </div>


                        <button
                            type="button"
                            onClick={() =>
                                setError("")
                            }
                            className="text-red-500 hover:text-red-700"
                        >
                            <X className="h-4 w-4" />
                        </button>

                    </div>

                )}


                {/* ==================================================
                    SEARCH / REFRESH
                ================================================== */}

                <div className="mb-6 flex flex-col gap-3 sm:flex-row">

                    <div className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">

                        <Search className="h-5 w-5 text-slate-400" />

                        <input
                            type="text"
                            value={searchText}
                            onChange={(event) =>
                                setSearchText(
                                    event.target.value
                                )
                            }
                            placeholder="Search announcements..."
                            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                        />

                    </div>


                    <button
                        type="button"
                        onClick={() =>
                            loadAnnouncements(
                                true
                            )
                        }
                        disabled={refreshing}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                    >

                        <RefreshCw
                            className={`h-4 w-4 ${
                                refreshing
                                    ? "animate-spin"
                                    : ""
                            }`}
                        />

                        Refresh

                    </button>

                </div>


                {/* ==================================================
                    STATS
                ================================================== */}

                {!loading && (

                    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <div className="flex items-center gap-3">

                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">

                                    <Megaphone className="h-5 w-5" />

                                </div>

                                <div>

                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Total Announcements
                                    </p>

                                    <p className="mt-1 text-2xl font-extrabold text-slate-900">
                                        {announcements.length}
                                    </p>

                                </div>

                            </div>

                        </div>


                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <div className="flex items-center gap-3">

                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">

                                    <Users className="h-5 w-5" />

                                </div>

                                <div>

                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Audience
                                    </p>

                                    <p className="mt-1 text-lg font-extrabold text-slate-900">
                                        All School Users
                                    </p>

                                </div>

                            </div>

                        </div>

                    </div>

                )}


                {/* ==================================================
                    CONTENT
                ================================================== */}

                {loading ? (

                    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm">

                        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />

                        <p className="text-sm font-semibold text-slate-600">
                            Loading announcements...
                        </p>

                    </div>

                ) : filteredAnnouncements.length === 0 ? (

                    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">

                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">

                            <Megaphone className="h-8 w-8" />

                        </div>


                        <h2 className="mt-5 text-lg font-bold text-slate-900">

                            {searchText.trim()
                                ? "No announcements found"
                                : "No announcements"}

                        </h2>


                        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">

                            {searchText.trim()
                                ? "Try another search term."
                                : "Publish an announcement to communicate important information to your school community."}

                        </p>


                        {!searchText.trim() &&
                            canCreateAnnouncement && (

                                <button
                                    type="button"
                                    onClick={openForm}
                                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                                >

                                    <Plus className="h-4 w-4" />

                                    Create First Announcement

                                </button>

                            )}

                    </div>

                ) : (

                    <div className="space-y-4">

                        {filteredAnnouncements.map(
                            (
                                announcement
                            ) => (

                                <div
                                    key={
                                        announcement.id
                                    }
                                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                                >

                                    <div className="flex items-start gap-4">


                                        {/* ICON */}

                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">

                                            <Megaphone className="h-5 w-5" />

                                        </div>


                                        {/* CONTENT */}

                                        <div className="min-w-0 flex-1">

                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

                                                <h3 className="font-bold text-slate-900">

                                                    {
                                                        announcement.title
                                                    }

                                                </h3>


                                                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">

                                                    <Users className="h-3 w-3" />

                                                    All Users

                                                </span>

                                            </div>


                                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">

                                                {
                                                    announcement.content
                                                }

                                            </p>


                                            {/* META */}

                                            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">


                                                <span className="inline-flex items-center gap-1.5">

                                                    <Clock className="h-3.5 w-3.5" />

                                                    {
                                                        formatDateTime(
                                                            announcement.created_at
                                                        )
                                                    }

                                                </span>


                                                <span className="inline-flex items-center gap-1.5">

                                                    <UserCircle className="h-3.5 w-3.5" />

                                                    Published by{" "}

                                                    <span className="font-semibold text-slate-700">

                                                        {
                                                            announcement
                                                                .creator
                                                                ?.full_name ||
                                                            "School Management"
                                                        }

                                                    </span>

                                                </span>

                                            </div>

                                        </div>

                                    </div>

                                </div>

                            )
                        )}

                    </div>

                )}


                {/* ==================================================
                    FORM MODAL
                ================================================== */}

                {showForm && (

                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
                        onMouseDown={(event) => {

                            if (
                                event.target ===
                                event.currentTarget
                            ) {
                                closeForm();
                            }

                        }}
                    >

                        <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">


                            {/* MODAL HEADER */}

                            <div className="mb-5 flex items-start justify-between gap-4">

                                <div>

                                    <div className="flex items-center gap-2">

                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">

                                            <Megaphone className="h-5 w-5" />

                                        </div>

                                        <div>

                                            <h2 className="text-lg font-bold text-slate-900">
                                                New Announcement
                                            </h2>

                                            <p className="text-sm text-slate-500">
                                                Send an announcement to all users in your school.
                                            </p>

                                        </div>

                                    </div>

                                </div>


                                <button
                                    type="button"
                                    onClick={closeForm}
                                    disabled={publishing}
                                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                                >

                                    <X className="h-5 w-5" />

                                </button>

                            </div>


                            {/* AUDIENCE NOTICE */}

                            <div className="mb-5 flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">

                                <Users className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />

                                <div>

                                    <p className="text-xs font-bold text-indigo-900">
                                        Audience: All School Users
                                    </p>

                                    <p className="mt-1 text-[11px] leading-5 text-indigo-700">
                                        Once published, the announcement will be available to all users in this school and a notification will be generated for them.
                                    </p>

                                </div>

                            </div>


                            {/* FORM */}

                            <form
                                onSubmit={
                                    publishAnnouncement
                                }
                                className="space-y-4"
                            >


                                {/* TITLE */}

                                <label className="block">

                                    <span className="mb-1.5 block text-sm font-medium text-slate-700">
                                        Title
                                    </span>

                                    <input
                                        value={title}
                                        onChange={(event) =>
                                            setTitle(
                                                event.target.value
                                            )
                                        }
                                        placeholder="Announcement title"
                                        required
                                        maxLength={200}
                                        disabled={
                                            publishing
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                                    />

                                </label>


                                {/* MESSAGE */}

                                <label className="block">

                                    <span className="mb-1.5 block text-sm font-medium text-slate-700">
                                        Message
                                    </span>

                                    <textarea
                                        value={message}
                                        onChange={(event) =>
                                            setMessage(
                                                event.target.value
                                            )
                                        }
                                        rows={7}
                                        placeholder="Write your announcement..."
                                        required
                                        disabled={
                                            publishing
                                        }
                                        className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                                    />

                                </label>


                                {/* ACTIONS */}

                                <div className="flex justify-end gap-3 pt-3">

                                    <button
                                        type="button"
                                        onClick={
                                            closeForm
                                        }
                                        disabled={
                                            publishing
                                        }
                                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>


                                    <button
                                        type="submit"
                                        disabled={
                                            publishing ||
                                            !title.trim() ||
                                            !message.trim()
                                        }
                                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >

                                        {publishing ? (

                                            <>
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                                Publishing...
                                            </>

                                        ) : (

                                            <>
                                                <Send className="h-4 w-4" />
                                                Publish
                                            </>

                                        )}

                                    </button>

                                </div>

                            </form>

                        </div>

                    </div>

                )}

            </div>

        </div>

    );

};


export default CommunicationAnnouncements;