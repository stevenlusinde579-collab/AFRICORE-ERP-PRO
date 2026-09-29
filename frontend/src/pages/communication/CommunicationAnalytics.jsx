import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Activity,
    Bell,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Mail,
    MessageSquare,
    Megaphone,
    RefreshCw,
    Search,
    TrendingUp,
    Users,
    Video,
    XCircle,
} from "lucide-react";

import { supabase } from "../../services/supabase";


// ============================================================
// COMMUNICATION ANALYTICS
// ============================================================

const CommunicationAnalytics = () => {

    const [currentUser, setCurrentUser] = useState(null);

    const [profile, setProfile] = useState(null);

    const [messages, setMessages] = useState([]);

    const [notifications, setNotifications] = useState([]);

    const [meetings, setMeetings] = useState([]);

    const [users, setUsers] = useState([]);

    const [loading, setLoading] = useState(true);

    const [refreshing, setRefreshing] = useState(false);

    const [error, setError] = useState("");

    const [search, setSearch] = useState("");

    const [period, setPeriod] = useState("all");

    const [activeTab, setActiveTab] = useState("overview");


    // ========================================================
    // LOAD CURRENT USER
    // ========================================================

    const loadCurrentUser = useCallback(async () => {

        const {
            data: authData,
            error: authError,
        } = await supabase.auth.getUser();


        if (authError) {
            throw authError;
        }


        const user = authData?.user || null;

        setCurrentUser(user);


        if (!user?.id) {
            setProfile(null);
            return null;
        }


        const {
            data,
            error: profileError,
        } = await supabase
            .from("profiles")
            .select(`
                id,
                full_name,
                phone,
                role_id,
                school_id,
                teacher_id,
                employee_id,
                created_at,
                roles (
                    id,
                    role_name,
                    description
                )
            `)
            .eq("id", user.id)
            .maybeSingle();


        if (profileError) {
            throw profileError;
        }


        setProfile(data || null);

        return data || null;

    }, []);


    // ========================================================
    // LOAD DATA
    // ========================================================

    const loadAnalytics = useCallback(async () => {

        setError("");


        try {

            const userProfile = await loadCurrentUser();

            const schoolId = userProfile?.school_id;


            // ------------------------------------------------
            // MESSAGES
            // ------------------------------------------------

            let messagesQuery = supabase
                .from("messages")
                .select(`
                    id,
                    school_id,
                    sender_id,
                    receiver_id,
                    message_text,
                    message_type,
                    is_read,
                    created_at
                `)
                .order("created_at", {
                    ascending: false,
                });


            if (
                schoolId !== null &&
                schoolId !== undefined
            ) {
                messagesQuery = messagesQuery.eq(
                    "school_id",
                    schoolId
                );
            }


            const {
                data: messageData,
                error: messageError,
            } = await messagesQuery.limit(1000);


            if (messageError) {
                throw messageError;
            }


            // ------------------------------------------------
            // NOTIFICATIONS
            // ------------------------------------------------

            let notificationsQuery = supabase
                .from("notifications")
                .select("*")
                .order("created_at", {
                    ascending: false,
                });


            if (
                schoolId !== null &&
                schoolId !== undefined
            ) {

                notificationsQuery =
                    notificationsQuery.eq(
                        "school_id",
                        schoolId
                    );

            }


            const {
                data: notificationData,
                error: notificationError,
            } = await notificationsQuery.limit(1000);


            if (notificationError) {
                throw notificationError;
            }


            // ------------------------------------------------
            // MEETINGS
            // ------------------------------------------------

            let meetingsQuery = supabase
                .from("meetings")
                .select("*")
                .order("created_at", {
                    ascending: false,
                });


            if (
                schoolId !== null &&
                schoolId !== undefined
            ) {

                meetingsQuery =
                    meetingsQuery.eq(
                        "school_id",
                        schoolId
                    );

            }


            const {
                data: meetingData,
                error: meetingError,
            } = await meetingsQuery.limit(1000);


            if (meetingError) {
                throw meetingError;
            }


            // ------------------------------------------------
            // USERS
            // ------------------------------------------------

            let usersQuery = supabase
                .from("profiles")
                .select(`
                    id,
                    full_name,
                    role_id,
                    school_id,
                    created_at,
                    roles (
                        id,
                        role_name,
                        description
                    )
                `)
                .order("full_name", {
                    ascending: true,
                });


            if (
                schoolId !== null &&
                schoolId !== undefined
            ) {

                usersQuery = usersQuery.eq(
                    "school_id",
                    schoolId
                );

            }


            const {
                data: userData,
                error: userError,
            } = await usersQuery.limit(1000);


            if (userError) {
                throw userError;
            }


            setMessages(messageData || []);

            setNotifications(
                notificationData || []
            );

            setMeetings(meetingData || []);

            setUsers(userData || []);


        } catch (err) {

            console.error(
                "COMMUNICATION ANALYTICS ERROR:",
                err
            );


            setError(
                err?.message ||
                "Failed to load communication analytics."
            );


        } finally {

            setLoading(false);

        }

    }, [loadCurrentUser]);


    // ========================================================
    // INITIAL LOAD
    // ========================================================

    useEffect(() => {

        loadAnalytics();

    }, [loadAnalytics]);


    // ========================================================
    // REFRESH
    // ========================================================

    const handleRefresh = async () => {

        setRefreshing(true);

        try {

            await loadAnalytics();

        } finally {

            setRefreshing(false);

        }

    };


    // ========================================================
    // PERIOD FILTER
    // ========================================================

    const isWithinPeriod = useCallback(
        (dateValue) => {

            if (period === "all") {
                return true;
            }

            if (!dateValue) {
                return false;
            }


            const date = new Date(dateValue);

            const now = new Date();

            const start = new Date(now);


            if (period === "today") {

                start.setHours(
                    0,
                    0,
                    0,
                    0
                );

            }


            if (period === "7days") {

                start.setDate(
                    now.getDate() - 6
                );

            }


            if (period === "30days") {

                start.setDate(
                    now.getDate() - 29
                );

            }


            return date >= start;

        },
        [period]
    );


    // ========================================================
    // FILTERED DATA
    // ========================================================

    const filteredMessages = useMemo(() => {

        const term =
            search.trim().toLowerCase();


        return messages.filter((item) => {

            if (
                !isWithinPeriod(
                    item.created_at
                )
            ) {
                return false;
            }


            if (!term) {
                return true;
            }


            return [
                item.message_text,
                item.message_type,
                item.sender_id,
                item.receiver_id,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(term);

        });

    }, [
        messages,
        search,
        isWithinPeriod,
    ]);


    const filteredNotifications = useMemo(() => {

        return notifications.filter((item) => {

            return isWithinPeriod(
                item.created_at
            );

        });

    }, [
        notifications,
        isWithinPeriod,
    ]);


    const filteredMeetings = useMemo(() => {

        return meetings.filter((item) => {

            return isWithinPeriod(
                item.created_at ||
                item.start_time ||
                item.meeting_date
            );

        });

    }, [
        meetings,
        isWithinPeriod,
    ]);


    // ========================================================
    // SUMMARY
    // ========================================================

    const summary = useMemo(() => {

        const sent = filteredMessages.filter(
            (item) =>
                item.sender_id ===
                currentUser?.id
        ).length;


        const received = filteredMessages.filter(
            (item) =>
                item.receiver_id ===
                currentUser?.id
        ).length;


        const read = filteredMessages.filter(
            (item) =>
                item.is_read === true
        ).length;


        const unread = filteredMessages.filter(
            (item) =>
                item.is_read !== true
        ).length;


        const announcementCount =
            filteredMessages.filter(
                (item) =>
                    String(
                        item.message_type || ""
                    ).toLowerCase() ===
                    "announcement"
            ).length;


        const notificationRead =
            filteredNotifications.filter(
                (item) =>
                    item.is_read === true
            ).length;


        return {

            messages:
                filteredMessages.length,

            sent,

            received,

            read,

            unread,

            notifications:
                filteredNotifications.length,

            notificationRead,

            notificationUnread:
                Math.max(
                    0,
                    filteredNotifications.length -
                    notificationRead
                ),

            meetings:
                filteredMeetings.length,

            announcements:
                announcementCount,

            users:
                users.length,

        };

    }, [
        filteredMessages,
        filteredNotifications,
        filteredMeetings,
        currentUser,
        users,
    ]);


    // ========================================================
    // MESSAGE TYPES
    // ========================================================

    const messageTypes = useMemo(() => {

        const map = {};


        filteredMessages.forEach((item) => {

            const type =
                item.message_type ||
                "message";


            map[type] =
                (map[type] || 0) + 1;

        });


        return Object.entries(map)
            .sort(
                (a, b) =>
                    b[1] - a[1]
            );

    }, [filteredMessages]);


    // ========================================================
    // ROLE ANALYSIS
    // ========================================================

    const roleAnalysis = useMemo(() => {

        const map = {};


        users.forEach((user) => {

            const role =
                user?.roles?.role_name ||
                "Unknown";


            if (!map[role]) {

                map[role] = {
                    role,
                    users: 0,
                    sent: 0,
                    received: 0,
                };

            }


            map[role].users += 1;

        });


        const userMap = new Map(
            users.map((user) => [
                user.id,
                user,
            ])
        );


        filteredMessages.forEach((message) => {

            const sender =
                userMap.get(
                    message.sender_id
                );


            const receiver =
                userMap.get(
                    message.receiver_id
                );


            const senderRole =
                sender?.roles?.role_name ||
                "Unknown";


            const receiverRole =
                receiver?.roles?.role_name ||
                "Unknown";


            if (!map[senderRole]) {

                map[senderRole] = {
                    role: senderRole,
                    users: 0,
                    sent: 0,
                    received: 0,
                };

            }


            if (!map[receiverRole]) {

                map[receiverRole] = {
                    role: receiverRole,
                    users: 0,
                    sent: 0,
                    received: 0,
                };

            }


            map[senderRole].sent += 1;

            map[receiverRole].received += 1;

        });


        return Object.values(map)
            .sort(
                (a, b) =>
                    (
                        b.sent +
                        b.received
                    ) -
                    (
                        a.sent +
                        a.received
                    )
            );

    }, [
        users,
        filteredMessages,
    ]);


    // ========================================================
    // DAILY ACTIVITY
    // ========================================================

    const dailyActivity = useMemo(() => {

        const map = {};


        filteredMessages.forEach((item) => {

            if (!item.created_at) {
                return;
            }


            const key =
                new Date(
                    item.created_at
                ).toLocaleDateString(
                    "en-GB",
                    {
                        day: "2-digit",
                        month: "short",
                    }
                );


            map[key] =
                (map[key] || 0) + 1;

        });


        return Object.entries(map)
            .slice(0, 14)
            .reverse();

    }, [filteredMessages]);


    // ========================================================
    // RECENT ACTIVITY
    // ========================================================

    const recentActivity = useMemo(() => {

        const result = [];


        filteredMessages
            .slice(0, 8)
            .forEach((item) => {

                result.push({
                    id: `message-${item.id}`,
                    type: "Message",
                    title:
                        item.message_text ||
                        "Message",
                    date:
                        item.created_at,
                    icon:
                        MessageSquare,
                });

            });


        filteredNotifications
            .slice(0, 5)
            .forEach((item) => {

                result.push({
                    id:
                        `notification-${item.id}`,
                    type: "Notification",
                    title:
                        item.title ||
                        item.message ||
                        "Notification",
                    date:
                        item.created_at,
                    icon:
                        Bell,
                });

            });


        filteredMeetings
            .slice(0, 5)
            .forEach((item) => {

                result.push({
                    id:
                        `meeting-${item.id}`,
                    type: "Meeting",
                    title:
                        item.title ||
                        item.name ||
                        "Meeting",
                    date:
                        item.created_at ||
                        item.start_time ||
                        item.meeting_date,
                    icon:
                        Video,
                });

            });


        return result
            .sort(
                (a, b) =>
                    new Date(b.date || 0) -
                    new Date(a.date || 0)
            )
            .slice(0, 10);

    }, [
        filteredMessages,
        filteredNotifications,
        filteredMeetings,
    ]);


    // ========================================================
    // FORMAT DATE
    // ========================================================

    const formatDateTime = (value) => {

        if (!value) {
            return "Date not available";
        }


        try {

            return new Intl.DateTimeFormat(
                "en-GB",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                }
            ).format(
                new Date(value)
            );

        } catch {

            return String(value);

        }

    };


    // ========================================================
    // LOADING
    // ========================================================

    if (loading) {

        return (

            <div className="min-h-full bg-slate-50 p-6">

                <div className="mx-auto max-w-7xl">

                    <div className="animate-pulse space-y-6">

                        <div className="h-10 w-72 rounded-xl bg-slate-200" />

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

                            {Array.from({
                                length: 4,
                            }).map((_, index) => (

                                <div
                                    key={index}
                                    className="h-32 rounded-2xl bg-slate-200"
                                />

                            ))}

                        </div>

                    </div>

                </div>

            </div>

        );

    }


    // ========================================================
    // RENDER
    // ========================================================

    return (

        <div className="min-h-full bg-slate-50 p-4 md:p-6">

            <div className="mx-auto max-w-7xl space-y-6">

                {/* HEADER */}

                <div className="rounded-3xl bg-gradient-to-r from-indigo-700 via-blue-700 to-slate-900 p-6 text-white shadow-lg">

                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                        <div>

                            <div className="flex items-center gap-3">

                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">

                                    <Activity className="h-6 w-6" />

                                </div>

                                <div>

                                    <p className="text-sm font-medium text-blue-100">
                                        Communication
                                    </p>

                                    <h1 className="text-2xl font-bold md:text-3xl">
                                        Communication Analytics
                                    </h1>

                                </div>

                            </div>

                            <p className="mt-3 max-w-2xl text-sm text-blue-100">
                                Monitor communication activity,
                                messages, notifications,
                                meetings and user engagement
                                across the school.
                            </p>

                        </div>


                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-blue-50 disabled:opacity-60"
                        >

                            <RefreshCw
                                className={`h-4 w-4 ${
                                    refreshing
                                        ? "animate-spin"
                                        : ""
                                }`}
                            />

                            Refresh Data

                        </button>

                    </div>

                </div>


                {/* ERROR */}

                {error && (

                    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">

                        <XCircle className="mt-0.5 h-5 w-5 shrink-0" />

                        <div>

                            <p className="font-semibold">
                                Analytics loading error
                            </p>

                            <p className="mt-1 text-sm">
                                {error}
                            </p>

                        </div>

                    </div>

                )}


                {/* FILTERS */}

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

                        <div className="relative w-full lg:max-w-md">

                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                            <input
                                type="text"
                                value={search}
                                onChange={(event) =>
                                    setSearch(
                                        event.target.value
                                    )
                                }
                                placeholder="Search communication..."
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                            />

                        </div>


                        <select
                            value={period}
                            onChange={(event) =>
                                setPeriod(
                                    event.target.value
                                )
                            }
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400"
                        >

                            <option value="all">
                                All time
                            </option>

                            <option value="today">
                                Today
                            </option>

                            <option value="7days">
                                Last 7 days
                            </option>

                            <option value="30days">
                                Last 30 days
                            </option>

                        </select>

                    </div>

                </div>


                {/* SUMMARY CARDS */}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                    <MetricCard
                        icon={MessageSquare}
                        label="Total Messages"
                        value={summary.messages}
                        description="Communication messages"
                    />

                    <MetricCard
                        icon={Mail}
                        label="Messages Sent"
                        value={summary.sent}
                        description="Sent by current user"
                    />

                    <MetricCard
                        icon={CheckCircle2}
                        label="Read Messages"
                        value={summary.read}
                        description={`${summary.unread} unread`}
                    />

                    <MetricCard
                        icon={Bell}
                        label="Notifications"
                        value={summary.notifications}
                        description={`${summary.notificationUnread} unread`}
                    />

                    <MetricCard
                        icon={Video}
                        label="Meetings"
                        value={summary.meetings}
                        description="Communication meetings"
                    />

                    <MetricCard
                        icon={Megaphone}
                        label="Announcements"
                        value={summary.announcements}
                        description="Announcement messages"
                    />

                    <MetricCard
                        icon={Users}
                        label="Users"
                        value={summary.users}
                        description="Users in school"
                    />

                    <MetricCard
                        icon={TrendingUp}
                        label="Received"
                        value={summary.received}
                        description="Messages received"
                    />

                </div>


                {/* TABS */}

                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">

                    {[
                        [
                            "overview",
                            "Overview",
                        ],
                        [
                            "messages",
                            "Messages",
                        ],
                        [
                            "roles",
                            "Role Analysis",
                        ],
                        [
                            "activity",
                            "Activity",
                        ],
                    ].map(
                        ([value, label]) => (

                            <button
                                key={value}
                                type="button"
                                onClick={() =>
                                    setActiveTab(
                                        value
                                    )
                                }
                                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                    activeTab === value
                                        ? "bg-indigo-600 text-white shadow-sm"
                                        : "text-slate-600 hover:bg-slate-100"
                                }`}
                            >

                                {label}

                            </button>

                        )
                    )}

                </div>


                {/* OVERVIEW */}

                {activeTab === "overview" && (

                    <div className="grid gap-6 lg:grid-cols-2">

                        <Panel
                            title="Communication Activity"
                            subtitle="Messages recorded during the selected period"
                            icon={Activity}
                        >

                            {dailyActivity.length === 0 ? (

                                <EmptyState
                                    message="No message activity found for this period."
                                />

                            ) : (

                                <div className="space-y-4">

                                    {dailyActivity.map(
                                        ([date, count]) => {

                                            const max =
                                                Math.max(
                                                    ...dailyActivity.map(
                                                        (item) =>
                                                            item[1]
                                                    ),
                                                    1
                                                );


                                            const width =
                                                `${Math.max(
                                                    6,
                                                    (
                                                        count /
                                                        max
                                                    ) *
                                                        100
                                                )}%`;


                                            return (

                                                <div
                                                    key={date}
                                                >

                                                    <div className="mb-1 flex items-center justify-between text-xs">

                                                        <span className="font-medium text-slate-500">
                                                            {date}
                                                        </span>

                                                        <span className="font-bold text-slate-700">
                                                            {count}
                                                        </span>

                                                    </div>

                                                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">

                                                        <div
                                                            className="h-full rounded-full bg-indigo-500 transition-all"
                                                            style={{
                                                                width,
                                                            }}
                                                        />

                                                    </div>

                                                </div>

                                            );

                                        }
                                    )}

                                </div>

                            )}

                        </Panel>


                        <Panel
                            title="Communication Types"
                            subtitle="Distribution of recorded message types"
                            icon={MessageSquare}
                        >

                            {messageTypes.length === 0 ? (

                                <EmptyState
                                    message="No message type data available."
                                />

                            ) : (

                                <div className="space-y-3">

                                    {messageTypes.map(
                                        ([type, count]) => (

                                            <div
                                                key={type}
                                                className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                                            >

                                                <div className="flex items-center gap-3">

                                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">

                                                        <MessageSquare className="h-4 w-4" />

                                                    </div>

                                                    <span className="text-sm font-semibold capitalize text-slate-700">
                                                        {type}
                                                    </span>

                                                </div>

                                                <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-700 shadow-sm">
                                                    {count}
                                                </span>

                                            </div>

                                        )
                                    )}

                                </div>

                            )}

                        </Panel>


                        <Panel
                            title="Recent Communication Activity"
                            subtitle="Latest recorded activity"
                            icon={Clock3}
                        >

                            {recentActivity.length === 0 ? (

                                <EmptyState
                                    message="No recent communication activity."
                                />

                            ) : (

                                <div className="space-y-3">

                                    {recentActivity.map(
                                        (item) => {

                                            const Icon =
                                                item.icon;


                                            return (

                                                <div
                                                    key={item.id}
                                                    className="flex gap-3 rounded-xl border border-slate-100 p-3"
                                                >

                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">

                                                        <Icon className="h-4 w-4" />

                                                    </div>

                                                    <div className="min-w-0">

                                                        <p className="truncate text-sm font-semibold text-slate-700">
                                                            {item.title}
                                                        </p>

                                                        <p className="mt-1 text-xs text-slate-400">
                                                            {item.type}
                                                            {" • "}
                                                            {formatDateTime(
                                                                item.date
                                                            )}
                                                        </p>

                                                    </div>

                                                </div>

                                            );

                                        }
                                    )}

                                </div>

                            )}

                        </Panel>


                        <Panel
                            title="Communication Status"
                            subtitle="Read and unread communication"
                            icon={CheckCircle2}
                        >

                            <div className="grid gap-4 sm:grid-cols-2">

                                <StatusBox
                                    icon={CheckCircle2}
                                    label="Read Messages"
                                    value={summary.read}
                                />

                                <StatusBox
                                    icon={Clock3}
                                    label="Unread Messages"
                                    value={summary.unread}
                                />

                                <StatusBox
                                    icon={CheckCircle2}
                                    label="Read Notifications"
                                    value={
                                        summary.notificationRead
                                    }
                                />

                                <StatusBox
                                    icon={Bell}
                                    label="Unread Notifications"
                                    value={
                                        summary.notificationUnread
                                    }
                                />

                            </div>

                        </Panel>

                    </div>

                )}


                {/* MESSAGES */}

                {activeTab === "messages" && (

                    <Panel
                        title="Message Records"
                        subtitle={`${filteredMessages.length} messages in the selected period`}
                        icon={MessageSquare}
                    >

                        {filteredMessages.length === 0 ? (

                            <EmptyState
                                message="No messages match the current filters."
                            />

                        ) : (

                            <div className="overflow-x-auto">

                                <table className="w-full min-w-[760px] text-left">

                                    <thead>

                                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">

                                            <th className="px-3 py-3">
                                                Message
                                            </th>

                                            <th className="px-3 py-3">
                                                Type
                                            </th>

                                            <th className="px-3 py-3">
                                                Status
                                            </th>

                                            <th className="px-3 py-3">
                                                Sender
                                            </th>

                                            <th className="px-3 py-3">
                                                Receiver
                                            </th>

                                            <th className="px-3 py-3">
                                                Date
                                            </th>

                                        </tr>

                                    </thead>

                                    <tbody>

                                        {filteredMessages
                                            .slice(0, 100)
                                            .map(
                                                (item) => (

                                                    <tr
                                                        key={item.id}
                                                        className="border-b border-slate-100 last:border-0"
                                                    >

                                                        <td className="max-w-xs px-3 py-3">

                                                            <p className="truncate text-sm font-medium text-slate-700">
                                                                {item.message_text ||
                                                                    "No message text"}
                                                            </p>

                                                        </td>

                                                        <td className="px-3 py-3">

                                                            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold capitalize text-indigo-700">
                                                                {item.message_type ||
                                                                    "message"}
                                                            </span>

                                                        </td>

                                                        <td className="px-3 py-3">

                                                            {item.is_read ? (

                                                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">

                                                                    <CheckCircle2 className="h-4 w-4" />

                                                                    Read

                                                                </span>

                                                            ) : (

                                                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">

                                                                    <Clock3 className="h-4 w-4" />

                                                                    Unread

                                                                </span>

                                                            )}

                                                        </td>

                                                        <td className="px-3 py-3 text-xs text-slate-500">
                                                            {shortId(
                                                                item.sender_id
                                                            )}
                                                        </td>

                                                        <td className="px-3 py-3 text-xs text-slate-500">
                                                            {shortId(
                                                                item.receiver_id
                                                            )}
                                                        </td>

                                                        <td className="px-3 py-3 text-xs text-slate-500">
                                                            {formatDateTime(
                                                                item.created_at
                                                            )}
                                                        </td>

                                                    </tr>

                                                )
                                            )}

                                    </tbody>

                                </table>

                            </div>

                        )}

                    </Panel>

                )}


                {/* ROLES */}

                {activeTab === "roles" && (

                    <Panel
                        title="Communication by Role"
                        subtitle="Communication activity grouped by user role"
                        icon={Users}
                    >

                        {roleAnalysis.length === 0 ? (

                            <EmptyState
                                message="No role activity available."
                            />

                        ) : (

                            <div className="overflow-x-auto">

                                <table className="w-full min-w-[620px] text-left">

                                    <thead>

                                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">

                                            <th className="px-3 py-3">
                                                Role
                                            </th>

                                            <th className="px-3 py-3">
                                                Users
                                            </th>

                                            <th className="px-3 py-3">
                                                Sent
                                            </th>

                                            <th className="px-3 py-3">
                                                Received
                                            </th>

                                            <th className="px-3 py-3">
                                                Total Activity
                                            </th>

                                        </tr>

                                    </thead>

                                    <tbody>

                                        {roleAnalysis.map(
                                            (item) => (

                                                <tr
                                                    key={item.role}
                                                    className="border-b border-slate-100 last:border-0"
                                                >

                                                    <td className="px-3 py-4">

                                                        <span className="font-semibold capitalize text-slate-700">
                                                            {item.role}
                                                        </span>

                                                    </td>

                                                    <td className="px-3 py-4 text-sm text-slate-600">
                                                        {item.users}
                                                    </td>

                                                    <td className="px-3 py-4 text-sm font-semibold text-indigo-600">
                                                        {item.sent}
                                                    </td>

                                                    <td className="px-3 py-4 text-sm font-semibold text-emerald-600">
                                                        {item.received}
                                                    </td>

                                                    <td className="px-3 py-4">

                                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                                                            {item.sent +
                                                                item.received}
                                                        </span>

                                                    </td>

                                                </tr>

                                            )
                                        )}

                                    </tbody>

                                </table>

                            </div>

                        )}

                    </Panel>

                )}


                {/* ACTIVITY */}

                {activeTab === "activity" && (

                    <div className="grid gap-6 lg:grid-cols-2">

                        <Panel
                            title="Daily Activity"
                            subtitle="Message volume by day"
                            icon={CalendarDays}
                        >

                            {dailyActivity.length === 0 ? (

                                <EmptyState
                                    message="No activity data available."
                                />

                            ) : (

                                <div className="space-y-4">

                                    {dailyActivity.map(
                                        ([date, count]) => (

                                            <div
                                                key={date}
                                                className="flex items-center gap-4"
                                            >

                                                <span className="w-16 text-xs font-semibold text-slate-500">
                                                    {date}
                                                </span>

                                                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">

                                                    <div
                                                        className="h-full rounded-full bg-blue-600"
                                                        style={{
                                                            width: `${Math.min(
                                                                100,
                                                                count * 10
                                                            )}%`,
                                                        }}
                                                    />

                                                </div>

                                                <span className="w-8 text-right text-sm font-bold text-slate-700">
                                                    {count}
                                                </span>

                                            </div>

                                        )
                                    )}

                                </div>

                            )}

                        </Panel>


                        <Panel
                            title="Meetings"
                            subtitle="Communication meetings recorded in the system"
                            icon={Video}
                        >

                            {filteredMeetings.length === 0 ? (

                                <EmptyState
                                    message="No meetings found for this period."
                                />

                            ) : (

                                <div className="space-y-3">

                                    {filteredMeetings
                                        .slice(0, 15)
                                        .map(
                                            (meeting) => (

                                                <div
                                                    key={meeting.id}
                                                    className="rounded-xl border border-slate-100 p-4"
                                                >

                                                    <div className="flex items-start gap-3">

                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">

                                                            <Video className="h-5 w-5" />

                                                        </div>

                                                        <div className="min-w-0 flex-1">

                                                            <p className="font-semibold text-slate-700">
                                                                {meeting.title ||
                                                                    meeting.name ||
                                                                    "Communication Meeting"}
                                                            </p>

                                                            <p className="mt-1 text-xs text-slate-400">
                                                                {formatDateTime(
                                                                    meeting.created_at ||
                                                                    meeting.start_time ||
                                                                    meeting.meeting_date
                                                                )}
                                                            </p>

                                                        </div>

                                                    </div>

                                                </div>

                                            )
                                        )}

                                </div>

                            )}

                        </Panel>

                    </div>

                )}

            </div>

        </div>

    );

};


// ============================================================
// METRIC CARD
// ============================================================

const MetricCard = ({
    icon: Icon,
    label,
    value,
    description,
}) => (

    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="flex items-start justify-between gap-4">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">

                <Icon className="h-5 w-5" />

            </div>

            <span className="text-2xl font-bold text-slate-900">
                {value}
            </span>

        </div>

        <p className="mt-4 text-sm font-bold text-slate-700">
            {label}
        </p>

        <p className="mt-1 text-xs text-slate-400">
            {description}
        </p>

    </div>

);


// ============================================================
// PANEL
// ============================================================

const Panel = ({
    title,
    subtitle,
    icon: Icon,
    children,
}) => (

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="mb-5 flex items-start gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">

                <Icon className="h-5 w-5" />

            </div>

            <div>

                <h2 className="font-bold text-slate-900">
                    {title}
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                    {subtitle}
                </p>

            </div>

        </div>

        {children}

    </section>

);


// ============================================================
// STATUS BOX
// ============================================================

const StatusBox = ({
    icon: Icon,
    label,
    value,
}) => (

    <div className="rounded-xl bg-slate-50 p-4">

        <div className="flex items-center justify-between">

            <Icon className="h-5 w-5 text-indigo-500" />

            <span className="text-xl font-bold text-slate-800">
                {value}
            </span>

        </div>

        <p className="mt-3 text-xs font-semibold text-slate-500">
            {label}
        </p>

    </div>

);


// ============================================================
// EMPTY STATE
// ============================================================

const EmptyState = ({
    message,
}) => (

    <div className="flex min-h-32 items-center justify-center rounded-xl bg-slate-50 p-6 text-center">

        <div>

            <Activity className="mx-auto h-7 w-7 text-slate-300" />

            <p className="mt-2 text-sm text-slate-400">
                {message}
            </p>

        </div>

    </div>

);


// ============================================================
// SHORT ID
// ============================================================

const shortId = (value) => {

    if (!value) {
        return "—";
    }


    const text = String(value);


    if (text.length <= 12) {
        return text;
    }


    return `${text.slice(0, 8)}…`;

};


// ============================================================
// EXPORT
// ============================================================

export default CommunicationAnalytics;