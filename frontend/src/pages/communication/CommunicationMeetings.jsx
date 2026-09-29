import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Video,
    Plus,
    CalendarDays,
    Clock3,
    Users,
    Copy,
    Play,
    Search,
    Loader2,
    X,
} from "lucide-react";

import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";


const CommunicationMeetings = () => {

    const navigate = useNavigate();
    const { schoolId } = useSchool();

    const [showCreate, setShowCreate] = useState(false);

    const [meetingTitle, setMeetingTitle] = useState("");
    const [meetingDate, setMeetingDate] = useState("");
    const [meetingTime, setMeetingTime] = useState("");

    const [meetings, setMeetings] = useState([]);

    const [searchTerm, setSearchTerm] = useState("");

    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");


    /*
     * ---------------------------------------------------------
     * LOAD MEETINGS FROM SUPABASE
     * ---------------------------------------------------------
     */

    const loadMeetings = async () => {

        try {

            setLoading(true);
            setError("");

            const {
                data: {
                    user,
                },
                error: authError,
            } = await supabase.auth.getUser();


            if (authError) {
                throw authError;
            }


            if (!user) {
                throw new Error("You must be logged in to view meetings.");
            }


            let query = supabase
                .from("video_rooms")
                .select(`
                    id,
                    school_id,
                    room_code,
                    title,
                    description,
                    created_by,
                    status,
                    scheduled_start,
                    scheduled_end,
                    created_at,
                    updated_at
                `)
                .order("created_at", {
                    ascending: false,
                });


            /*
             * SchoolContext may expose schoolId as a number/string.
             * Only add the filter when it is actually available.
             */
            if (schoolId !== undefined && schoolId !== null && schoolId !== "") {

                query = query.eq(
                    "school_id",
                    schoolId
                );

            }


            const {
                data,
                error: queryError,
            } = await query;


            if (queryError) {
                throw queryError;
            }


            /*
             * Convert database rows into the format
             * already expected by the existing UI.
             */
            const formattedMeetings = (data || []).map((meeting) => {

                const scheduledStart = meeting.scheduled_start
                    ? new Date(meeting.scheduled_start)
                    : null;


                const dateValue = scheduledStart
                    ? scheduledStart.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                    })
                    : "Today";


                const timeValue = scheduledStart
                    ? scheduledStart.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                    })
                    : "Now";


                let status = meeting.status || "ready";


                /*
                 * Keep the UI friendly while preserving
                 * the real database status.
                 */
                if (status === "scheduled") {
                    status = "Scheduled";
                } else if (status === "live") {
                    status = "Live";
                } else if (status === "ended") {
                    status = "Ended";
                } else if (status === "cancelled") {
                    status = "Cancelled";
                } else if (status === "ready") {
                    status = "Ready";
                } else {
                    status =
                        status.charAt(0).toUpperCase() +
                        status.slice(1);
                }


                return {
                    ...meeting,

                    /*
                     * IMPORTANT:
                     * This is the real Supabase video_rooms.id.
                     */
                    id: meeting.id,

                    title: meeting.title || "Untitled Meeting",

                    date: dateValue,

                    time: timeValue,

                    participants: 0,

                    status,

                    databaseStatus: meeting.status,

                };

            });


            setMeetings(formattedMeetings);

        } catch (loadError) {

            console.error(
                "Communication meetings load error:",
                loadError
            );

            setError(
                loadError?.message ||
                "Failed to load meetings."
            );

        } finally {

            setLoading(false);

        }

    };


    /*
     * ---------------------------------------------------------
     * INITIAL LOAD
     * ---------------------------------------------------------
     */

    useEffect(() => {

        loadMeetings();

    }, [schoolId]);


    /*
     * ---------------------------------------------------------
     * FILTER MEETINGS
     * ---------------------------------------------------------
     */

    const filteredMeetings = useMemo(() => {

        const term = searchTerm.trim().toLowerCase();

        if (!term) {
            return meetings;
        }


        return meetings.filter((meeting) => {

            return (
                String(meeting.title || "")
                    .toLowerCase()
                    .includes(term) ||

                String(meeting.room_code || "")
                    .toLowerCase()
                    .includes(term) ||

                String(meeting.status || "")
                    .toLowerCase()
                    .includes(term)
            );

        });

    }, [meetings, searchTerm]);


    /*
     * ---------------------------------------------------------
     * CREATE MEETING
     * ---------------------------------------------------------
     */

    const createMeeting = async (event) => {

        event.preventDefault();


        if (!meetingTitle.trim()) {
            return;
        }


        try {

            setCreating(true);
            setError("");
            setSuccessMessage("");


            const {
                data: {
                    user,
                },
                error: authError,
            } = await supabase.auth.getUser();


            if (authError) {
                throw authError;
            }


            if (!user) {
                throw new Error(
                    "You must be logged in to create a meeting."
                );
            }


            if (
                schoolId === undefined ||
                schoolId === null ||
                schoolId === ""
            ) {

                throw new Error(
                    "Your school could not be identified. Please refresh the page and try again."
                );

            }


            /*
             * -------------------------------------------------
             * CREATE A REAL ROOM CODE
             * -------------------------------------------------
             *
             * The room code is separate from the numeric
             * video_rooms.id.
             */
            const randomPart = Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase();


            const roomCode = `ROOM-${randomPart}`;


            /*
             * -------------------------------------------------
             * BUILD SCHEDULE
             * -------------------------------------------------
             *
             * If date/time are provided, create scheduled_start.
             * If no date is selected, the room can be joined
             * immediately.
             */
            let scheduledStart = null;


            if (meetingDate) {

                if (meetingTime) {

                    scheduledStart =
                        `${meetingDate}T${meetingTime}:00`;

                } else {

                    scheduledStart =
                        `${meetingDate}T00:00:00`;

                }

            }


            /*
             * -------------------------------------------------
             * INSERT INTO video_rooms
             * -------------------------------------------------
             *
             * THIS IS THE IMPORTANT FIX.
             *
             * Previously the application created:
             *
             * crypto.randomUUID()
             *
             * only inside React state.
             *
             * Now the room is permanently created in
             * Supabase and the returned database ID is used
             * for joining.
             */
            const {
                data: createdRoom,
                error: insertError,
            } = await supabase
                .from("video_rooms")
                .insert({
                    school_id: schoolId,

                    room_code: roomCode,

                    title: meetingTitle.trim(),

                    description: null,

                    created_by: user.id,

                    /*
                     * Use the existing status values expected
                     * by CommunicationMeeting.jsx.
                     */
                    status: meetingDate
                        ? "scheduled"
                        : "live",

                    scheduled_start: scheduledStart,

                    scheduled_end: null,
                })
                .select(`
                    id,
                    school_id,
                    room_code,
                    title,
                    description,
                    created_by,
                    status,
                    scheduled_start,
                    scheduled_end,
                    created_at,
                    updated_at
                `)
                .single();


            if (insertError) {
                throw insertError;
            }


            if (!createdRoom) {

                throw new Error(
                    "The meeting was not created because no room was returned from Supabase."
                );

            }


            /*
             * -------------------------------------------------
             * ADD THE NEW MEETING TO THE UI
             * -------------------------------------------------
             */
            const scheduledDate = createdRoom.scheduled_start
                ? new Date(createdRoom.scheduled_start)
                : null;


            const formattedMeeting = {

                ...createdRoom,

                /*
                 * IMPORTANT:
                 * Use the actual numeric database ID.
                 */
                id: createdRoom.id,

                title:
                    createdRoom.title ||
                    "Untitled Meeting",

                date: scheduledDate
                    ? scheduledDate.toLocaleDateString(
                        undefined,
                        {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                        }
                    )
                    : "Today",

                time: scheduledDate
                    ? scheduledDate.toLocaleTimeString(
                        undefined,
                        {
                            hour: "2-digit",
                            minute: "2-digit",
                        }
                    )
                    : "Now",

                participants: 0,

                status:
                    createdRoom.status === "scheduled"
                        ? "Scheduled"
                        : createdRoom.status === "live"
                            ? "Live"
                            : createdRoom.status,

                databaseStatus:
                    createdRoom.status,

            };


            setMeetings((current) => [
                formattedMeeting,
                ...current,
            ]);


            /*
             * Reset form.
             */
            setMeetingTitle("");
            setMeetingDate("");
            setMeetingTime("");
            setShowCreate(false);


            setSuccessMessage(
                `Meeting created successfully. Room code: ${createdRoom.room_code}`
            );


            /*
             * Automatically remove success message.
             */
            window.setTimeout(() => {

                setSuccessMessage("");

            }, 5000);


        } catch (createError) {

            console.error(
                "Communication meeting creation error:",
                createError
            );


            setError(
                createError?.message ||
                "Failed to create meeting."
            );

        } finally {

            setCreating(false);

        }

    };


    /*
     * ---------------------------------------------------------
     * COPY MEETING LINK
     * ---------------------------------------------------------
     *
     * IMPORTANT:
     * The link uses the actual database room ID.
     *
     * CommunicationMeeting.jsx accepts:
     * /communication/meetings/:meetingId
     */
    const copyMeetingLink = async (meetingId) => {

        if (!meetingId) {
            return;
        }


        const link =
            `${window.location.origin}/communication/meetings/${encodeURIComponent(
                String(meetingId)
            )}`;


        try {

            await navigator.clipboard.writeText(link);

            setSuccessMessage(
                "Meeting link copied successfully."
            );


            window.setTimeout(() => {

                setSuccessMessage("");

            }, 3000);

        } catch (clipboardError) {

            console.error(
                "Clipboard error:",
                clipboardError
            );

        }

    };


    /*
     * ---------------------------------------------------------
     * JOIN MEETING
     * ---------------------------------------------------------
     */
    const joinMeeting = (meetingId) => {

        if (!meetingId) {
            return;
        }


        navigate(
            `/communication/meetings/${encodeURIComponent(
                String(meetingId)
            )}`
        );

    };


    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6">

            {/* HEADER */}

            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                <div className="flex items-center gap-3">

                    <button
                        type="button"
                        onClick={() => navigate("/communication")}
                        className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-100"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>

                    <div>

                        <h1 className="text-2xl font-bold text-slate-900">
                            Live Meetings
                        </h1>

                        <p className="text-sm text-slate-500">
                            Create, schedule and join video conferences.
                        </p>

                    </div>

                </div>


                <button
                    type="button"
                    onClick={() => {
                        setError("");
                        setShowCreate(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                    <Plus className="h-4 w-4" />
                    Create Meeting
                </button>

            </div>


            {/* SUCCESS */}

            {successMessage && (

                <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {successMessage}
                </div>

            )}


            {/* ERROR */}

            {error && (

                <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

                    <div>
                        <p className="font-semibold">
                            Meeting Error
                        </p>

                        <p className="mt-1">
                            {error}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setError("")}
                        className="rounded-lg p-1 hover:bg-red-100"
                    >
                        <X className="h-4 w-4" />
                    </button>

                </div>

            )}


            {/* SEARCH */}

            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">

                <Search className="h-5 w-5 text-slate-400" />

                <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) =>
                        setSearchTerm(event.target.value)
                    }
                    placeholder="Search meetings..."
                    className="w-full bg-transparent text-sm outline-none"
                />

            </div>


            {/* LOADING */}

            {loading ? (

                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">

                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />

                    <p className="mt-4 text-sm font-medium text-slate-600">
                        Loading meetings...
                    </p>

                </div>

            ) : meetings.length === 0 ? (

                /* EMPTY */

                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                        <Video className="h-8 w-8" />
                    </div>

                    <h2 className="mt-5 text-lg font-bold text-slate-900">
                        No meetings yet
                    </h2>

                    <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                        Create your first meeting and invite teachers,
                        students, parents or staff.
                    </p>

                    <button
                        type="button"
                        onClick={() => {
                            setError("");
                            setShowCreate(true);
                        }}
                        className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                        Create First Meeting
                    </button>

                </div>

            ) : filteredMeetings.length === 0 ? (

                /* NO SEARCH RESULTS */

                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">

                    <Search className="mx-auto h-10 w-10 text-slate-300" />

                    <h2 className="mt-4 text-lg font-bold text-slate-900">
                        No matching meetings
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        Try another meeting title or room code.
                    </p>

                </div>

            ) : (

                /* MEETINGS */

                <div className="grid gap-4 lg:grid-cols-2">

                    {filteredMeetings.map((meeting) => (

                        <div
                            key={meeting.id}
                            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                        >

                            <div className="flex items-start justify-between">

                                <div className="flex items-start gap-3">

                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                                        <Video className="h-5 w-5" />
                                    </div>

                                    <div>

                                        <h3 className="font-bold text-slate-900">
                                            {meeting.title}
                                        </h3>

                                        <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-600">
                                            {meeting.status}
                                        </span>

                                    </div>

                                </div>

                            </div>


                            {/* ROOM CODE */}

                            {meeting.room_code && (

                                <div className="mt-3">

                                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                        Room Code
                                    </span>

                                    <p className="mt-0.5 text-sm font-bold tracking-wide text-indigo-600">
                                        {meeting.room_code}
                                    </p>

                                </div>

                            )}


                            <div className="mt-5 grid grid-cols-3 gap-3">

                                <Info
                                    icon={CalendarDays}
                                    value={meeting.date}
                                />

                                <Info
                                    icon={Clock3}
                                    value={meeting.time}
                                />

                                <Info
                                    icon={Users}
                                    value={`${meeting.participants} people`}
                                />

                            </div>


                            <div className="mt-5 flex flex-wrap gap-2">

                                <button
                                    type="button"
                                    onClick={() =>
                                        joinMeeting(meeting.id)
                                    }
                                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                                >
                                    <Play className="h-4 w-4" />
                                    Join
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        copyMeetingLink(meeting.id)
                                    }
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    <Copy className="h-4 w-4" />
                                    Copy Link
                                </button>

                            </div>

                        </div>

                    ))}

                </div>

            )}


            {/* CREATE MODAL */}

            {showCreate && (

                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">

                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">

                        <div className="mb-5 flex items-center justify-between">

                            <div>

                                <h2 className="text-lg font-bold text-slate-900">
                                    Create Meeting
                                </h2>

                                <p className="text-sm text-slate-500">
                                    Set up a new video conference.
                                </p>

                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    if (!creating) {
                                        setShowCreate(false);
                                    }
                                }}
                                disabled={creating}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                ×
                            </button>

                        </div>


                        <form
                            onSubmit={createMeeting}
                            className="space-y-4"
                        >

                            <Field
                                label="Meeting title"
                                value={meetingTitle}
                                onChange={setMeetingTitle}
                                placeholder="e.g. Staff Meeting"
                                required
                                disabled={creating}
                            />


                            <div className="grid gap-4 sm:grid-cols-2">

                                <Field
                                    label="Date"
                                    type="date"
                                    value={meetingDate}
                                    onChange={setMeetingDate}
                                    disabled={creating}
                                />

                                <Field
                                    label="Time"
                                    type="time"
                                    value={meetingTime}
                                    onChange={setMeetingTime}
                                    disabled={creating}
                                />

                            </div>


                            <div className="flex justify-end gap-3 pt-3">

                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    disabled={creating}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Cancel
                                </button>


                                <button
                                    type="submit"
                                    disabled={
                                        creating ||
                                        !meetingTitle.trim()
                                    }
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >

                                    {creating ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Video className="h-4 w-4" />
                                            Create Meeting
                                        </>
                                    )}

                                </button>

                            </div>

                        </form>

                    </div>

                </div>

            )}

        </div>
    );
};


/*
 * -------------------------------------------------------------
 * FIELD
 * -------------------------------------------------------------
 */

const Field = ({
    label,
    type = "text",
    value,
    onChange,
    placeholder,
    required = false,
    disabled = false,
}) => {

    return (
        <label className="block">

            <span className="mb-1.5 block text-sm font-medium text-slate-700">
                {label}
            </span>

            <input
                type={type}
                value={value}
                onChange={(event) =>
                    onChange(event.target.value)
                }
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            />

        </label>
    );
};


/*
 * -------------------------------------------------------------
 * INFO
 * -------------------------------------------------------------
 */

const Info = ({ icon: Icon, value }) => {

    return (
        <div className="rounded-xl bg-slate-50 p-3">

            <Icon className="h-4 w-4 text-slate-400" />

            <p className="mt-1 truncate text-xs font-medium text-slate-600">
                {value}
            </p>

        </div>
    );
};


export default CommunicationMeetings;