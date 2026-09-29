import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Bell,
    CheckCheck,
    FileWarning,
    CreditCard,
    Megaphone,
    CalendarDays,
    Trash2,
    MessageSquare,
    ShieldCheck,
    AlertTriangle,
    RefreshCw,
} from "lucide-react";

import { supabase } from "../../services/supabase";

const CommunicationNotifications = () => {
    const navigate = useNavigate();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const [currentUserId, setCurrentUserId] = useState(null);

    /*
     * ---------------------------------------------------------
     * GET CURRENT USER
     * ---------------------------------------------------------
     */
    const loadCurrentUser = async () => {
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
            throw userError;
        }

        if (!user) {
            throw new Error("Your session has expired. Please log in again.");
        }

        setCurrentUserId(user.id);

        return user;
    };

    /*
     * ---------------------------------------------------------
     * LOAD NOTIFICATIONS
     * ---------------------------------------------------------
     */
    const loadNotifications = async (showRefresh = false) => {
        try {
            if (showRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                throw userError;
            }

            if (!user) {
                throw new Error(
                    "Your session has expired. Please log in again."
                );
            }

            setCurrentUserId(user.id);

            const { data, error: notificationError } = await supabase
                .from("notifications")
                .select(
                    "id, school_id, user_id, title, message, notification_type, is_read, created_at"
                )
                .eq("user_id", user.id)
                .order("created_at", {
                    ascending: false,
                });

            if (notificationError) {
                throw notificationError;
            }

            setNotifications(data || []);
        } catch (err) {
            console.error(
                "CommunicationNotifications load error:",
                err
            );

            setError(
                err?.message ||
                    "Failed to load notifications."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    /*
     * ---------------------------------------------------------
     * INITIAL LOAD + REALTIME
     * ---------------------------------------------------------
     */
    useEffect(() => {
        let channel = null;
        let mounted = true;

        const initialize = async () => {
            try {
                const user = await loadCurrentUser();

                if (!mounted) {
                    return;
                }

                await loadNotifications(false);

                if (!mounted) {
                    return;
                }

                /*
                 * IMPORTANT:
                 *
                 * notifications is already included in the
                 * Supabase realtime publication.
                 *
                 * We subscribe only to this user's notifications.
                 */
                channel = supabase
                    .channel(
                        `communication-notifications-${user.id}`
                    )
                    .on(
                        "postgres_changes",
                        {
                            event: "INSERT",
                            schema: "public",
                            table: "notifications",
                            filter: `user_id=eq.${user.id}`,
                        },
                        (payload) => {
                            if (!mounted) {
                                return;
                            }

                            const incoming =
                                payload?.new;

                            if (!incoming) {
                                return;
                            }

                            setNotifications(
                                (current) => {
                                    const exists =
                                        current.some(
                                            (item) =>
                                                String(
                                                    item.id
                                                ) ===
                                                String(
                                                    incoming.id
                                                )
                                        );

                                    if (exists) {
                                        return current;
                                    }

                                    return [
                                        incoming,
                                        ...current,
                                    ];
                                }
                            );
                        }
                    )
                    .on(
                        "postgres_changes",
                        {
                            event: "UPDATE",
                            schema: "public",
                            table: "notifications",
                            filter: `user_id=eq.${user.id}`,
                        },
                        (payload) => {
                            if (!mounted) {
                                return;
                            }

                            const updated =
                                payload?.new;

                            if (!updated) {
                                return;
                            }

                            setNotifications(
                                (current) =>
                                    current.map(
                                        (item) =>
                                            String(
                                                item.id
                                            ) ===
                                            String(
                                                updated.id
                                            )
                                                ? updated
                                                : item
                                    )
                            );
                        }
                    )
                    .subscribe((status) => {
                        console.log(
                            "Notifications realtime status:",
                            status
                        );
                    });
            } catch (err) {
                console.error(
                    "Notification initialization error:",
                    err
                );

                if (mounted) {
                    setError(
                        err?.message ||
                            "Unable to initialize notifications."
                    );
                    setLoading(false);
                }
            }
        };

        initialize();

        return () => {
            mounted = false;

            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, []);

    /*
     * ---------------------------------------------------------
     * MARK ONE AS READ
     * ---------------------------------------------------------
     */
    const markRead = async (id) => {
        if (!currentUserId) {
            return;
        }

        /*
         * Optimistic UI
         */
        setNotifications((current) =>
            current.map((item) =>
                String(item.id) === String(id)
                    ? {
                          ...item,
                          is_read: true,
                      }
                    : item
            )
        );

        const { error: updateError } = await supabase
            .from("notifications")
            .update({
                is_read: true,
            })
            .eq("id", id)
            .eq("user_id", currentUserId);

        if (updateError) {
            console.error(
                "Failed to mark notification as read:",
                updateError
            );

            /*
             * Reload from database so UI returns to the
             * real database state if the update failed.
             */
            await loadNotifications(true);
        }
    };

    /*
     * ---------------------------------------------------------
     * MARK ALL AS READ
     * ---------------------------------------------------------
     */
    const markAllRead = async () => {
        if (!currentUserId) {
            return;
        }

        const unreadIds = notifications
            .filter((item) => !item.is_read)
            .map((item) => item.id);

        if (unreadIds.length === 0) {
            return;
        }

        /*
         * Optimistic UI
         */
        setNotifications((current) =>
            current.map((item) => ({
                ...item,
                is_read: true,
            }))
        );

        const { error: updateError } = await supabase
            .from("notifications")
            .update({
                is_read: true,
            })
            .eq("user_id", currentUserId)
            .eq("is_read", false);

        if (updateError) {
            console.error(
                "Failed to mark all notifications as read:",
                updateError
            );

            await loadNotifications(true);
        }
    };

    /*
     * ---------------------------------------------------------
     * REMOVE FROM CURRENT DISPLAY
     * ---------------------------------------------------------
     *
     * There is currently no DELETE policy on notifications.
     * Therefore we intentionally remove it only from the
     * current UI instead of pretending it was deleted from DB.
     */
    const clearNotification = (id) => {
        setNotifications((current) =>
            current.filter(
                (item) =>
                    String(item.id) !== String(id)
            )
        );
    };

    /*
     * ---------------------------------------------------------
     * NOTIFICATION TYPE
     * ---------------------------------------------------------
     */
    const normalizeType = (type) => {
        return String(type || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/-/g, "_");
    };

    const getIcon = (type) => {
        const normalized = normalizeType(type);

        switch (normalized) {
            case "exam":
            case "exam_rejected":
            case "exam_approval":
            case "exam_approved":
                return FileWarning;

            case "finance":
            case "payment":
            case "fee":
                return CreditCard;

            case "announcement":
            case "announcements":
                return Megaphone;

            case "meeting":
            case "meetings":
            case "video_meeting":
                return CalendarDays;

            case "message":
            case "messages":
            case "chat":
                return MessageSquare;

            case "permission":
            case "permission_request":
            case "permission_approved":
            case "permission_rejected":
                return ShieldCheck;

            case "warning":
            case "alert":
                return AlertTriangle;

            default:
                return Bell;
        }
    };

    /*
     * ---------------------------------------------------------
     * TIME FORMATTER
     * ---------------------------------------------------------
     */
    const formatTime = (createdAt) => {
        if (!createdAt) {
            return "";
        }

        const date = new Date(createdAt);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        const now = new Date();

        const diff =
            now.getTime() - date.getTime();

        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;

        if (diff < minute) {
            return "Just now";
        }

        if (diff < hour) {
            const minutes = Math.floor(
                diff / minute
            );

            return `${minutes} ${
                minutes === 1
                    ? "minute"
                    : "minutes"
            } ago`;
        }

        if (diff < day) {
            const hours = Math.floor(
                diff / hour
            );

            return `${hours} ${
                hours === 1
                    ? "hour"
                    : "hours"
            } ago`;
        }

        if (diff < 2 * day) {
            return "Yesterday";
        }

        return date.toLocaleDateString(
            undefined,
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }
        );
    };

    /*
     * ---------------------------------------------------------
     * COUNTS
     * ---------------------------------------------------------
     */
    const unreadCount = useMemo(() => {
        return notifications.filter(
            (item) => !item.is_read
        ).length;
    }, [notifications]);

    /*
     * ---------------------------------------------------------
     * REFRESH
     * ---------------------------------------------------------
     */
    const handleRefresh = async () => {
        await loadNotifications(true);
    };

    /*
     * ---------------------------------------------------------
     * LOADING
     * ---------------------------------------------------------
     */
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 p-4 md:p-6">
                <div className="mx-auto max-w-5xl">
                    <div className="flex min-h-[500px] items-center justify-center">
                        <div className="text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
                                <Bell className="h-7 w-7 animate-pulse text-indigo-600" />
                            </div>

                            <h2 className="mt-4 font-bold text-slate-900">
                                Loading notifications...
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Checking your latest communication alerts.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /*
     * ---------------------------------------------------------
     * MAIN UI
     * ---------------------------------------------------------
     */
    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6">
            <div className="mx-auto max-w-5xl">

                {/* HEADER */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                    <div className="flex items-center gap-3">

                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/communication"
                                )
                            }
                            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-100"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>

                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-slate-900">
                                    Notifications
                                </h1>

                                {unreadCount > 0 && (
                                    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                                        {unreadCount}
                                    </span>
                                )}
                            </div>

                            <p className="text-sm text-slate-500">
                                System alerts and communication events.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">

                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            title="Refresh notifications"
                        >
                            <RefreshCw
                                className={`h-4 w-4 ${
                                    refreshing
                                        ? "animate-spin"
                                        : ""
                                }`}
                            />

                            <span className="hidden sm:inline">
                                Refresh
                            </span>
                        </button>

                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={markAllRead}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                <CheckCheck className="h-4 w-4" />
                                Mark all as read
                            </button>
                        )}
                    </div>
                </div>

                {/* ERROR */}
                {error && (
                    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

                        <div className="min-w-0 flex-1">
                            <p className="font-semibold text-red-800">
                                Notification error
                            </p>

                            <p className="mt-1 text-sm text-red-700">
                                {error}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-100"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {/* REALTIME STATUS */}
                <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </span>

                    Notifications update automatically in real time.
                </div>

                {/* LIST */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                    {notifications.length === 0 ? (
                        <div className="px-6 py-16 text-center">

                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                                <Bell className="h-7 w-7 text-slate-400" />
                            </div>

                            <h2 className="mt-4 font-bold text-slate-900">
                                No notifications
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                You are all caught up.
                            </p>

                        </div>
                    ) : (
                        notifications.map(
                            (notification) => {
                                const Icon =
                                    getIcon(
                                        notification.notification_type
                                    );

                                return (
                                    <div
                                        key={
                                            notification.id
                                        }
                                        className={`flex gap-4 border-b border-slate-100 p-4 transition last:border-b-0 ${
                                            notification.is_read
                                                ? "bg-white"
                                                : "bg-indigo-50/50"
                                        }`}
                                    >

                                        {/* ICON */}
                                        <div
                                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                                                notification.is_read
                                                    ? "bg-slate-100 text-slate-500"
                                                    : "bg-indigo-100 text-indigo-600"
                                            }`}
                                        >
                                            <Icon className="h-5 w-5" />
                                        </div>

                                        {/* CONTENT */}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                markRead(
                                                    notification.id
                                                )
                                            }
                                            className="min-w-0 flex-1 text-left"
                                        >
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                                                <h3 className="font-semibold text-slate-900">
                                                    {
                                                        notification.title
                                                    }
                                                </h3>

                                                <span className="shrink-0 text-xs text-slate-400">
                                                    {formatTime(
                                                        notification.created_at
                                                    )}
                                                </span>
                                            </div>

                                            <p className="mt-1 text-sm leading-5 text-slate-500">
                                                {
                                                    notification.message
                                                }
                                            </p>

                                            {!notification.is_read && (
                                                <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-indigo-600">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                                                    Unread
                                                </div>
                                            )}
                                        </button>

                                        {/* REMOVE FROM CURRENT VIEW */}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                clearNotification(
                                                    notification.id
                                                )
                                            }
                                            className="self-start rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-red-500"
                                            title="Remove from current view"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>

                                    </div>
                                );
                            }
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommunicationNotifications;