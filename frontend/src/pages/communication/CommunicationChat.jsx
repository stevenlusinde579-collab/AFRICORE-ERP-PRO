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
    Check,
    CheckCheck,
    Download,
    File,
    FileImage,
    FileText,
    Image as ImageIcon,
    Loader2,
    MessageCircle,
    MoreVertical,
    Paperclip,
    Printer,
    Search,
    Send,
    User,
    Wifi,
    WifiOff,
    X,
} from "lucide-react";
import { supabase } from "../../services/supabase";

const CHAT_BUCKET = "chat-documents";
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "image/png",
    "image/jpeg",
]);

const IMAGE_MIME_TYPES = new Set([
    "image/png",
    "image/jpeg",
]);

const normalizeAttachment = (message) => {
    if (!message) return null;

    if (
        message.message_type !== "image" &&
        message.message_type !== "document"
    ) {
        return null;
    }

    try {
        const parsed = JSON.parse(message.message_text || "{}");

        if (!parsed?.path || !parsed?.name) {
            return null;
        }

        return {
            type:
                parsed.attachmentType === "image" ||
                message.message_type === "image"
                    ? "image"
                    : "document",
            path: parsed.path,
            name: parsed.name,
            size: Number(parsed.size) || 0,
            mimeType: parsed.mimeType || "",
            caption: parsed.caption || "",
        };
    } catch {
        return null;
    }
};

const getMessagePreview = (message) => {
    const attachment = normalizeAttachment(message);

    if (attachment) {
        return attachment.type === "image"
            ? `📷 ${attachment.name}`
            : `📎 ${attachment.name}`;
    }

    return String(message?.message_text || "");
};

const formatFileSize = (bytes) => {
    const value = Number(bytes) || 0;

    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)} KB`;
    }

    if (value < 1024 * 1024 * 1024) {
        return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const sanitizeFileName = (name) => {
    const original = String(name || "file").trim();
    const dotIndex = original.lastIndexOf(".");
    const extension =
        dotIndex > 0 ? original.slice(dotIndex).toLowerCase() : "";
    const base = dotIndex > 0 ? original.slice(0, dotIndex) : original;

    const cleanBase = base
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 100);

    return `${cleanBase || "file"}${extension}`;
};

const getAttachmentIcon = (attachment) => {
    if (!attachment) return File;
    if (attachment.type === "image") return FileImage;
    if (attachment.mimeType === "application/pdf") return FileText;
    return File;
};

const openUrl = (url) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
};

const AttachmentMessage = ({ attachment, mine, onCreateSignedUrl }) => {
    const [url, setUrl] = useState("");
    const [urlLoading, setUrlLoading] = useState(true);
    const [urlError, setUrlError] = useState("");

    useEffect(() => {
        let alive = true;

        const loadUrl = async () => {
            try {
                setUrlLoading(true);
                setUrlError("");
                const signedUrl = await onCreateSignedUrl(attachment.path);

                if (alive) {
                    setUrl(signedUrl || "");
                    if (!signedUrl) {
                        setUrlError("File URL could not be created.");
                    }
                }
            } catch (err) {
                if (alive) {
                    setUrlError(
                        err?.message || "Unable to open this attachment."
                    );
                }
            } finally {
                if (alive) setUrlLoading(false);
            }
        };

        loadUrl();

        return () => {
            alive = false;
        };
    }, [attachment.path, onCreateSignedUrl]);

    const Icon = getAttachmentIcon(attachment);

    const handleDownload = () => {
        if (!url) return;
        const downloadUrl = `${url}${url.includes("?") ? "&" : "?"}download=1`;
        openUrl(downloadUrl);
    };

    const handlePrint = async () => {
        if (!url) return;

        if (attachment.type === "image") {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error("Unable to load image for printing.");

                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const printWindow = window.open(
                    "",
                    "_blank",
                    "noopener,noreferrer,width=900,height=700"
                );

                if (!printWindow) {
                    URL.revokeObjectURL(blobUrl);
                    openUrl(url);
                    return;
                }

                printWindow.document.write(`
                    <!doctype html>
                    <html>
                        <head>
                            <title>${attachment.name}</title>
                            <style>
                                html, body {
                                    margin: 0;
                                    padding: 0;
                                    background: #ffffff;
                                }
                                body {
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    min-height: 100vh;
                                }
                                img {
                                    max-width: 100%;
                                    max-height: 100vh;
                                    object-fit: contain;
                                }
                            </style>
                        </head>
                        <body>
                            <img src="${blobUrl}" alt="${attachment.name}" />
                            <script>
                                window.addEventListener('load', function () {
                                    setTimeout(function () {
                                        window.focus();
                                        window.print();
                                    }, 250);
                                });
                            </script>
                        </body>
                    </html>
                `);
                printWindow.document.close();

                setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
            } catch {
                openUrl(url);
            }

            return;
        }

        openUrl(url);
    };

    if (attachment.type === "image") {
        return (
            <div className="space-y-2">
                {urlLoading ? (
                    <div className="flex h-48 w-full min-w-[220px] items-center justify-center rounded-xl bg-slate-100">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                ) : url ? (
                    <button
                        type="button"
                        onClick={() => openUrl(url)}
                        className="block overflow-hidden rounded-xl border border-black/5 bg-black/5 text-left"
                        title="Open image"
                    >
                        <img
                            src={url}
                            alt={attachment.name}
                            className="max-h-[420px] w-full max-w-[420px] object-contain"
                        />
                    </button>
                ) : (
                    <div className="rounded-xl bg-red-50 px-3 py-3 text-xs text-red-700">
                        {urlError || "Image could not be loaded."}
                    </div>
                )}

                <div className="flex items-center gap-2 rounded-xl border border-black/5 bg-white/60 px-3 py-2">
                    <ImageIcon className="h-4 w-4 shrink-0 text-indigo-500" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-700">
                            {attachment.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                            {formatFileSize(attachment.size)}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handlePrint}
                        disabled={!url}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                        title="Print image"
                    >
                        <Printer className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={!url}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                        title="Open / download image"
                    >
                        <Download className="h-4 w-4" />
                    </button>
                </div>

                {attachment.caption && (
                    <p className="whitespace-pre-wrap text-sm leading-5 text-slate-800">
                        {attachment.caption}
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                    <Icon className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">
                        {attachment.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                        {formatFileSize(attachment.size)}
                    </p>
                </div>
            </div>

            {urlError && (
                <p className="text-xs text-red-600">{urlError}</p>
            )}

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => openUrl(url)}
                    disabled={!url || urlLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
                >
                    {urlLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <File className="h-3.5 w-3.5" />
                    )}
                    Open
                </button>

                <button
                    type="button"
                    onClick={handlePrint}
                    disabled={!url || urlLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
                >
                    <Printer className="h-3.5 w-3.5" />
                    Print
                </button>

                <button
                    type="button"
                    onClick={handleDownload}
                    disabled={!url || urlLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
                >
                    <Download className="h-3.5 w-3.5" />
                    Download
                </button>
            </div>

            {attachment.mimeType === "application/pdf" && (
                <p className="text-[10px] text-slate-400">
                    PDF opens in the browser so the normal browser print dialog can be used.
                </p>
            )}

            {attachment.caption && (
                <p className="whitespace-pre-wrap text-sm leading-5 text-slate-800">
                    {attachment.caption}
                </p>
            )}
        </div>
    );
};

const CommunicationChat = () => {
    const navigate = useNavigate();
    const [authUser, setAuthUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [lastMessages, setLastMessages] = useState({});
    const [unreadCounts, setUnreadCounts] = useState({});
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [search, setSearch] = useState("");
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(true);
    const [conversationLoading, setConversationLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [attachment, setAttachment] = useState(null);
    const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState("");
    const [error, setError] = useState("");
    const [failedMessages, setFailedMessages] = useState([]);
    const fileInputRef = useRef(null);
    const bottomRef = useRef(null);
    const selectedUserRef = useRef(null);

    useEffect(() => {
        selectedUserRef.current = selectedUser;
    }, [selectedUser]);

    useEffect(() => {
        return () => {
            if (attachmentPreviewUrl) {
                URL.revokeObjectURL(attachmentPreviewUrl);
            }
        };
    }, [attachmentPreviewUrl]);

    const loadProfile = useCallback(async () => {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData?.user;
        if (!user) throw new Error("User session not found.");
        setAuthUser(user);

        const { data, error } = await supabase
            .from("profiles")
            .select(
                "id, full_name, phone, role_id, school_id, teacher_id, employee_id, roles(id, role_name)"
            )
            .eq("id", user.id)
            .maybeSingle();
        if (error) throw error;
        setProfile(data || null);
        return { user, profile: data || null };
    }, []);

    const loadUsers = useCallback(async (schoolId) => {
        let query = supabase
            .from("profiles")
            .select(
                "id, full_name, phone, role_id, school_id, teacher_id, employee_id, roles(id, role_name)"
            )
            .order("full_name", { ascending: true });
        if (schoolId !== null && schoolId !== undefined) {
            query = query.eq("school_id", schoolId);
        }
        const { data, error } = await query;
        if (error) throw error;
        setUsers((data || []).filter((item) => item.id));
    }, []);

    const loadInbox = useCallback(async (userId, schoolId) => {
        let query = supabase
            .from("messages")
            .select(
                "id, school_id, sender_id, receiver_id, message_text, message_type, is_read, created_at"
            )
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .order("created_at", { ascending: false })
            .limit(1000);
        if (schoolId !== null && schoolId !== undefined) {
            query = query.eq("school_id", schoolId);
        }
        const { data, error } = await query;
        if (error) throw error;

        const all = data || [];
        const latest = {};
        const unread = {};

        all.forEach((message) => {
            const otherId =
                message.sender_id === userId
                    ? message.receiver_id
                    : message.sender_id;

            if (!latest[otherId]) {
                latest[otherId] = message;
            }

            if (
                message.receiver_id === userId &&
                !message.is_read
            ) {
                unread[message.sender_id] =
                    (unread[message.sender_id] || 0) + 1;
            }
        });

        setLastMessages(latest);
        setUnreadCounts(unread);
    }, []);

    const loadConversation = useCallback(async (userId, otherId, schoolId) => {
        if (!otherId) return;
        setConversationLoading(true);

        try {
            let query = supabase
                .from("messages")
                .select(
                    "id, school_id, sender_id, receiver_id, message_text, message_type, is_read, created_at"
                )
                .or(
                    `and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`
                )
                .order("created_at", { ascending: true })
                .limit(500);

            if (schoolId !== null && schoolId !== undefined) {
                query = query.eq("school_id", schoolId);
            }

            const { data, error } = await query;
            if (error) throw error;

            setMessages(data || []);

            const unreadIds = (data || [])
                .filter(
                    (message) =>
                        message.receiver_id === userId &&
                        !message.is_read
                )
                .map((message) => message.id);

            if (unreadIds.length) {
                const { error: updateError } = await supabase
                    .from("messages")
                    .update({ is_read: true })
                    .in("id", unreadIds);

                if (!updateError) {
                    setMessages((prev) =>
                        prev.map((message) =>
                            unreadIds.includes(message.id)
                                ? { ...message, is_read: true }
                                : message
                        )
                    );
                }

                setUnreadCounts((prev) => ({
                    ...prev,
                    [otherId]: 0,
                }));
            }
        } catch (err) {
            setError(err?.message || "Unable to load conversation.");
        } finally {
            setConversationLoading(false);
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                setLoading(true);
                const { user, profile: p } = await loadProfile();
                if (!mounted) return;

                await Promise.all([
                    loadUsers(p?.school_id),
                    loadInbox(user.id, p?.school_id),
                ]);
            } catch (err) {
                if (mounted) {
                    setError(err?.message || "Unable to load chat.");
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        init();

        return () => {
            mounted = false;
        };
    }, [loadProfile, loadUsers, loadInbox]);

    useEffect(() => {
        if (!authUser?.id) return;

        const channel = supabase.channel(
            `communication-presence-school-${profile?.school_id ?? "global"}`,
            {
                config: {
                    presence: { key: authUser.id },
                },
            }
        );

        const updatePresence = () => {
            const state = channel.presenceState();
            const ids = new Set();

            Object.keys(state || {}).forEach((key) => {
                ids.add(key);
            });

            setOnlineUsers(ids);
        };

        channel.on(
            "presence",
            { event: "sync" },
            updatePresence
        );
        channel.on(
            "presence",
            { event: "join" },
            updatePresence
        );
        channel.on(
            "presence",
            { event: "leave" },
            updatePresence
        );

        channel.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
                await channel.track({
                    user_id: authUser.id,
                    online_at: new Date().toISOString(),
                });
                updatePresence();
            }
        });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [authUser?.id, profile?.school_id]);

    useEffect(() => {
        if (!authUser?.id) return;

        const channel = supabase
            .channel(`messages-${authUser.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `receiver_id=eq.${authUser.id}`,
                },
                (payload) => {
                    const message = payload.new;

                    setLastMessages((prev) => ({
                        ...prev,
                        [message.sender_id]: message,
                    }));

                    if (
                        selectedUserRef.current?.id ===
                        message.sender_id
                    ) {
                        setMessages((prev) =>
                            prev.some((item) => item.id === message.id)
                                ? prev
                                : [...prev, message]
                        );

                        supabase
                            .from("messages")
                            .update({ is_read: true })
                            .eq("id", message.id)
                            .then(() => {});
                    } else {
                        setUnreadCounts((prev) => ({
                            ...prev,
                            [message.sender_id]:
                                (prev[message.sender_id] || 0) + 1,
                        }));
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `sender_id=eq.${authUser.id}`,
                },
                (payload) => {
                    const message = payload.new;

                    setLastMessages((prev) => ({
                        ...prev,
                        [message.receiver_id]: message,
                    }));

                    if (
                        selectedUserRef.current?.id ===
                        message.receiver_id
                    ) {
                        setMessages((prev) =>
                            prev.some((item) => item.id === message.id)
                                ? prev
                                : [...prev, message]
                        );
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "messages",
                    filter: `receiver_id=eq.${authUser.id}`,
                },
                (payload) => {
                    const updated = payload.new;

                    setMessages((prev) =>
                        prev.map((message) =>
                            message.id === updated.id
                                ? updated
                                : message
                        )
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [authUser?.id]);

    useEffect(() => {
        if (!selectedUser || !authUser) return;
        loadConversation(
            authUser.id,
            selectedUser.id,
            profile?.school_id
        );
    }, [
        selectedUser,
        authUser,
        profile?.school_id,
        loadConversation,
    ]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({
            behavior: "smooth",
        });
    }, [messages]);

    const createSignedUrl = useCallback(async (path) => {
        if (!path) return "";

        const { data, error: signedUrlError } = await supabase.storage
            .from(CHAT_BUCKET)
            .createSignedUrl(path, 3600);

        if (signedUrlError) throw signedUrlError;

        return data?.signedUrl || "";
    }, []);

    const filteredUsers = useMemo(() => {
        const term = search.trim().toLowerCase();

        return users
            .filter((user) => user.id !== authUser?.id)
            .filter(
                (user) =>
                    !term ||
                    `${user.full_name || ""} ${
                        user.roles?.role_name || ""
                    }`
                        .toLowerCase()
                        .includes(term)
            )
            .sort((a, b) => {
                const unreadDiff =
                    (unreadCounts[b.id] || 0) -
                    (unreadCounts[a.id] || 0);

                if (unreadDiff !== 0) return unreadDiff;

                return (
                    new Date(
                        lastMessages[b.id]?.created_at || 0
                    ) -
                    new Date(
                        lastMessages[a.id]?.created_at || 0
                    )
                );
            });
    }, [
        users,
        authUser?.id,
        search,
        unreadCounts,
        lastMessages,
    ]);

    const clearAttachment = useCallback(() => {
        if (attachmentPreviewUrl) {
            URL.revokeObjectURL(attachmentPreviewUrl);
        }

        setAttachmentPreviewUrl("");
        setAttachment(null);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, [attachmentPreviewUrl]);

    const handleFileSelect = useCallback(
        (event) => {
            const file = event.target.files?.[0];
            if (!file) return;

            setError("");

            if (!ALLOWED_MIME_TYPES.has(file.type)) {
                setError(
                    "This file type is not supported. Use PDF, Word, Excel, PowerPoint, TXT, PNG or JPG."
                );
                event.target.value = "";
                return;
            }

            if (file.size > MAX_FILE_SIZE) {
                setError("The maximum chat file size is 50 MB.");
                event.target.value = "";
                return;
            }

            if (attachmentPreviewUrl) {
                URL.revokeObjectURL(attachmentPreviewUrl);
            }

            setAttachment(file);

            if (IMAGE_MIME_TYPES.has(file.type)) {
                setAttachmentPreviewUrl(URL.createObjectURL(file));
            } else {
                setAttachmentPreviewUrl("");
            }
        },
        [attachmentPreviewUrl]
    );

    const uploadAttachment = useCallback(
        async (file) => {
            if (!file || !authUser?.id || !selectedUser?.id) {
                throw new Error("Select a recipient and a file first.");
            }

            const schoolId =
                selectedUser.school_id ??
                profile?.school_id ??
                null;

            if (schoolId === null || schoolId === undefined) {
                throw new Error(
                    "The current users do not have a school assigned."
                );
            }

            const safeName = sanitizeFileName(file.name);
            const uniqueName = `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 10)}-${safeName}`;

            const path = `${schoolId}/${authUser.id}__${selectedUser.id}/${uniqueName}`;

            const { error: uploadError } = await supabase.storage
                .from(CHAT_BUCKET)
                .upload(path, file, {
                    cacheControl: "3600",
                    contentType: file.type,
                    upsert: false,
                });

            if (uploadError) throw uploadError;

            return {
                path,
                name: file.name,
                size: file.size,
                mimeType: file.type,
                attachmentType: IMAGE_MIME_TYPES.has(file.type)
                    ? "image"
                    : "document",
            };
        },
        [authUser?.id, profile?.school_id, selectedUser?.id]
    );

    const insertAttachmentMessage = useCallback(
        async (file, caption = "") => {
            const attachmentData = await uploadAttachment(file);

            const messageType =
                attachmentData.attachmentType === "image"
                    ? "image"
                    : "document";

            const messagePayload = {
                attachmentType: attachmentData.attachmentType,
                path: attachmentData.path,
                name: attachmentData.name,
                size: attachmentData.size,
                mimeType: attachmentData.mimeType,
                caption: String(caption || "").trim(),
            };

            const schoolId =
                selectedUser.school_id ??
                profile?.school_id ??
                null;

            const { data, error: insertError } = await supabase
                .from("messages")
                .insert({
                    school_id: schoolId,
                    sender_id: authUser.id,
                    receiver_id: selectedUser.id,
                    message_text: JSON.stringify(messagePayload),
                    message_type: messageType,
                    is_read: false,
                })
                .select(
                    "id, school_id, sender_id, receiver_id, message_text, message_type, is_read, created_at"
                )
                .single();

            if (insertError) {
                await supabase.storage
                    .from(CHAT_BUCKET)
                    .remove([attachmentData.path]);
                throw insertError;
            }

            return data;
        },
        [
            authUser?.id,
            profile?.school_id,
            selectedUser?.id,
            selectedUser?.school_id,
            uploadAttachment,
        ]
    );

    const sendMessage = async (
        messageText = text,
        retryId = null
    ) => {
        const value = String(messageText || "").trim();

        if (
            (!value && !attachment) ||
            !selectedUser ||
            !authUser ||
            sending
        ) {
            return;
        }

        setSending(true);
        setError("");

        if (!retryId) {
            setText("");
        }

        const fileToSend = attachment;
        const previewUrlToKeep = attachmentPreviewUrl;

        try {
            if (fileToSend) {
                const data = await insertAttachmentMessage(
                    fileToSend,
                    value
                );

                setMessages((prev) =>
                    prev.some((message) => message.id === data.id)
                        ? prev
                        : [...prev, data]
                );

                setLastMessages((prev) => ({
                    ...prev,
                    [selectedUser.id]: data,
                }));

                if (previewUrlToKeep) {
                    URL.revokeObjectURL(previewUrlToKeep);
                }

                setAttachmentPreviewUrl("");
                setAttachment(null);

                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }

                setFailedMessages((prev) =>
                    prev.filter((message) => message.id !== retryId)
                );

                return;
            }

            const tempId = `local-${Date.now()}-${Math.random()}`;
            const optimistic = {
                id: tempId,
                school_id:
                    selectedUser.school_id ??
                    profile?.school_id ??
                    null,
                sender_id: authUser.id,
                receiver_id: selectedUser.id,
                message_text: value,
                message_type: "text",
                is_read: false,
                created_at: new Date().toISOString(),
                optimistic: true,
            };

            setMessages((prev) => [...prev, optimistic]);

            const { data, error: insertError } = await supabase
                .from("messages")
                .insert({
                    school_id:
                        selectedUser.school_id ??
                        profile?.school_id ??
                        null,
                    sender_id: authUser.id,
                    receiver_id: selectedUser.id,
                    message_text: value,
                    message_type: "text",
                    is_read: false,
                })
                .select(
                    "id, school_id, sender_id, receiver_id, message_text, message_type, is_read, created_at"
                )
                .single();

            if (insertError) throw insertError;

            setMessages((prev) =>
                prev.map((message) =>
                    message.id === tempId ? data : message
                )
            );

            setLastMessages((prev) => ({
                ...prev,
                [selectedUser.id]: data,
            }));

            setFailedMessages((prev) =>
                prev.filter((message) => message.id !== retryId)
            );
        } catch (err) {
            setFailedMessages((prev) =>
                retryId
                    ? prev.map((message) =>
                          message.id === retryId
                              ? {
                                    ...message,
                                    error:
                                        err?.message ||
                                        "Failed to send",
                                }
                              : message
                      )
                    : [
                          ...prev,
                          {
                              id: `failed-${Date.now()}`,
                              message_text: value,
                              error:
                                  err?.message ||
                                  "Failed to send",
                          },
                      ]
            );

            setError(
                err?.message ||
                    "Unable to send the message or attachment."
            );
        } finally {
            setSending(false);
        }
    };

    const renderMessageBody = (message, mine) => {
        const attachmentData = normalizeAttachment(message);

        if (attachmentData) {
            return (
                <AttachmentMessage
                    attachment={attachmentData}
                    mine={mine}
                    onCreateSignedUrl={createSignedUrl}
                />
            );
        }

        return (
            <p className="whitespace-pre-wrap text-sm leading-5">
                {message.message_text}
            </p>
        );
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Loader2 className="mx-auto h-9 w-9 animate-spin text-indigo-600" />
                    <p className="mt-3 text-sm font-semibold text-slate-600">
                        Loading messages...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-1rem)] min-h-[620px] bg-slate-100 p-2 md:p-4">
            <div className="mx-auto flex h-full max-w-7xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <aside
                    className={`${
                        selectedUser ? "hidden md:flex" : "flex"
                    } w-full shrink-0 flex-col border-r border-slate-200 md:w-[360px]`}
                >
                    <div className="bg-slate-900 px-4 py-4 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Communication
                                </p>
                                <h1 className="text-xl font-bold">Messages</h1>
                            </div>
                            <button
                                onClick={() => navigate("/communication")}
                                className="rounded-lg p-2 hover:bg-white/10"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                            <Search className="h-4 w-4 text-slate-300" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search users..."
                                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {filteredUsers.map((user) => {
                            const online = onlineUsers.has(user.id);
                            const last = lastMessages[user.id];
                            const unread = unreadCounts[user.id] || 0;

                            return (
                                <button
                                    key={user.id}
                                    onClick={() => setSelectedUser(user)}
                                    className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${
                                        selectedUser?.id === user.id
                                            ? "bg-indigo-50"
                                            : ""
                                    }`}
                                >
                                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                                        <User className="h-5 w-5" />
                                        {online && (
                                            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <p
                                                className={`truncate text-sm ${
                                                    unread
                                                        ? "font-bold text-slate-900"
                                                        : "font-semibold text-slate-700"
                                                }`}
                                            >
                                                {user.full_name ||
                                                    "Unnamed User"}
                                            </p>

                                            {last && (
                                                <span className="text-[10px] text-slate-400">
                                                    {new Date(
                                                        last.created_at
                                                    ).toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between gap-2">
                                            <p className="truncate text-xs text-slate-400">
                                                {online
                                                    ? "Online"
                                                    : user.roles?.role_name ||
                                                      "User"}
                                                {last
                                                    ? ` · ${getMessagePreview(
                                                          last
                                                      )}`
                                                    : ""}
                                            </p>

                                            {unread > 0 && (
                                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                                                    {unread > 99
                                                        ? "99+"
                                                        : unread}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}

                        {!filteredUsers.length && (
                            <div className="p-8 text-center text-sm text-slate-400">
                                No users found.
                            </div>
                        )}
                    </div>
                </aside>

                <main
                    className={`${
                        selectedUser ? "flex" : "hidden md:flex"
                    } min-w-0 flex-1 flex-col bg-[#efeae2]`}
                >
                    {!selectedUser ? (
                        <div className="flex h-full items-center justify-center text-center">
                            <div>
                                <MessageCircle className="mx-auto h-16 w-16 text-slate-300" />
                                <h2 className="mt-4 text-xl font-bold text-slate-500">
                                    Select a user to start chatting
                                </h2>
                                <p className="mt-2 text-sm text-slate-400">
                                    Send messages, images and documents internally.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
                                <button
                                    className="rounded-lg p-2 hover:bg-slate-100 md:hidden"
                                    onClick={() => setSelectedUser(null)}
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </button>

                                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                                    <User className="h-5 w-5" />
                                    {onlineUsers.has(selectedUser.id) && (
                                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                                    )}
                                </div>

                                <div className="flex-1">
                                    <h2 className="font-bold text-slate-900">
                                        {selectedUser.full_name ||
                                            "Unnamed User"}
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        {onlineUsers.has(selectedUser.id)
                                            ? "Online"
                                            : selectedUser.roles?.role_name ||
                                              "Offline"}
                                    </p>
                                </div>

                                <div className="text-slate-400">
                                    {onlineUsers.has(selectedUser.id) ? (
                                        <Wifi className="h-5 w-5 text-emerald-500" />
                                    ) : (
                                        <WifiOff className="h-5 w-5" />
                                    )}
                                </div>

                                <MoreVertical className="h-5 w-5 text-slate-400" />
                            </header>

                            <div className="flex-1 overflow-y-auto px-3 py-5 md:px-8">
                                {conversationLoading ? (
                                    <div className="flex h-full items-center justify-center">
                                        <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
                                    </div>
                                ) : (
                                    messages.map((message) => {
                                        const mine =
                                            message.sender_id ===
                                            authUser.id;

                                        return (
                                            <div
                                                key={message.id}
                                                className={`mb-2 flex ${
                                                    mine
                                                        ? "justify-end"
                                                        : "justify-start"
                                                }`}
                                            >
                                                <div
                                                    className={`max-w-[86%] rounded-2xl px-3 py-2 shadow-sm md:max-w-[70%] ${
                                                        mine
                                                            ? "rounded-br-md bg-emerald-100 text-slate-800"
                                                            : "rounded-bl-md bg-white text-slate-800"
                                                    }`}
                                                >
                                                    {renderMessageBody(
                                                        message,
                                                        mine
                                                    )}

                                                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                                                        {new Date(
                                                            message.created_at
                                                        ).toLocaleTimeString(
                                                            [],
                                                            {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            }
                                                        )}

                                                        {mine &&
                                                            (message.optimistic ? (
                                                                <Check className="h-3 w-3" />
                                                            ) : message.is_read ? (
                                                                <CheckCheck className="h-3 w-3 text-blue-500" />
                                                            ) : (
                                                                <Check className="h-3 w-3" />
                                                            ))}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}

                                <div ref={bottomRef} />
                            </div>

                            {error && (
                                <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
                                    {error}
                                </div>
                            )}

                            {failedMessages
                                .filter(() => selectedUser)
                                .map((failed) => (
                                    <div
                                        key={failed.id}
                                        className="mx-3 mb-2 flex justify-end"
                                    >
                                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                            <div>Failed to send</div>
                                            <div className="mt-1 text-slate-600">
                                                {failed.message_text ||
                                                    "Attachment"}
                                            </div>
                                            {!attachment &&
                                                failed.message_text && (
                                                    <button
                                                        onClick={() =>
                                                            sendMessage(
                                                                failed.message_text,
                                                                failed.id
                                                            )
                                                        }
                                                        className="mt-1 font-bold underline"
                                                    >
                                                        Retry
                                                    </button>
                                                )}
                                        </div>
                                    </div>
                                ))}

                            {attachment && (
                                <div className="mx-3 mb-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <div className="min-w-0 flex-1">
                                            {attachmentPreviewUrl ? (
                                                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                                    <img
                                                        src={attachmentPreviewUrl}
                                                        alt="Selected attachment"
                                                        className="max-h-52 w-full object-contain"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white">
                                                        <Paperclip className="h-5 w-5 text-indigo-600" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-bold text-slate-700">
                                                            {attachment.name}
                                                        </p>
                                                        <p className="text-[11px] text-slate-400">
                                                            {formatFileSize(
                                                                attachment.size
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            <p className="mt-2 text-[11px] text-slate-400">
                                                {attachmentPreviewUrl
                                                    ? "Image ready to send"
                                                    : "Document ready to send"}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={clearAttachment}
                                            className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200"
                                            title="Remove attachment"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    sendMessage();
                                }}
                                className="flex items-end gap-2 border-t border-slate-200 bg-white p-3"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept="image/png,image/jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
                                    onChange={handleFileSelect}
                                />

                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={sending}
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                                    title="Attach image or document"
                                >
                                    <Paperclip className="h-5 w-5" />
                                </button>

                                <textarea
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === "Enter" &&
                                            !e.shiftKey
                                        ) {
                                            e.preventDefault();
                                            sendMessage();
                                        }
                                    }}
                                    rows={1}
                                    placeholder={
                                        attachment
                                            ? "Add a caption..."
                                            : "Type a message..."
                                    }
                                    className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400"
                                />

                                <button
                                    type="submit"
                                    disabled={
                                        (!text.trim() && !attachment) ||
                                        sending
                                    }
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                                    title="Send message"
                                >
                                    {sending ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <Send className="h-5 w-5" />
                                    )}
                                </button>
                            </form>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
};

export default CommunicationChat;
