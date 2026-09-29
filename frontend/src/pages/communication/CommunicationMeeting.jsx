import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    useNavigate,
    useParams,
} from "react-router-dom";

import {
    ArrowLeft,
    Check,
    CheckCheck,
    ChevronDown,
    Copy,
    Loader2,
    MessageCircle,
    Mic,
    MicOff,
    Monitor,
    MonitorOff,
    MoreVertical,
    PhoneOff,
    Send,
    Settings,
    Hand,
    ShieldCheck,
    Users,
    Video,
    VideoOff,
    X,
} from "lucide-react";

import { supabase } from "../../services/supabase";


// ============================================================
// WEBRTC
// ============================================================

const ICE_SERVERS = [
    {
        urls: "stun:stun.l.google.com:19302",
    },
    {
        urls: "stun:stun1.l.google.com:19302",
    },
];


// ============================================================
// HELPERS
// ============================================================

const getInitials = (name = "") => {
    const value = String(name || "").trim();

    if (!value) {
        return "U";
    }

    const parts = value.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
};


const normalizeId = (value) => {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value);
};


const makeRoomChannelName = (roomId) => {
    return `video-room-${normalizeId(roomId)}`;
};


const isValidRoomId = (value) => {
    return String(value || "").trim().length > 0;
};


const formatTime = (value) => {
    if (!value) {
        return "";
    }

    try {
        return new Intl.DateTimeFormat("en-TZ", {
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(value));
    } catch {
        return "";
    }
};


const formatDateTime = (value) => {
    if (!value) {
        return "";
    }

    try {
        return new Intl.DateTimeFormat("en-TZ", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(value));
    } catch {
        return String(value);
    }
};


const extractPresenceUsers = (presenceState = {}) => {
    const users = [];

    Object.entries(presenceState || {}).forEach(([key, values]) => {
        const list = Array.isArray(values) ? values : [];

        list.forEach((item) => {
            users.push({
                user_id: normalizeId(item?.user_id || key),
                display_name: item?.display_name || "Participant",
                joined_at: item?.joined_at || null,
                mic_enabled: item?.mic_enabled !== false,
                camera_enabled: item?.camera_enabled !== false,
                hand_raised: item?.hand_raised === true,
                role: item?.role || "participant",
            });
        });
    });

    const unique = new Map();

    users.forEach((user) => {
        if (!user.user_id) {
            return;
        }

        unique.set(user.user_id, user);
    });

    return Array.from(unique.values());
};


const getErrorMessage = (error, fallback) => {
    if (error?.message) {
        return error.message;
    }

    if (error?.details) {
        return error.details;
    }

    return fallback;
};


// ============================================================
// COMPONENT
// ============================================================

function CommunicationMeeting() {

    const navigate = useNavigate();
    const { meetingId } = useParams();


    // ========================================================
    // REFS
    // ========================================================

    const localVideoRef = useRef(null);
    const localStreamRef = useRef(null);
    const screenStreamRef = useRef(null);
    const channelRef = useRef(null);
    const peerConnectionsRef = useRef(new Map());
    const remoteStreamsRef = useRef(new Map());
    const remoteVideoRefs = useRef(new Map());
    const pendingIceCandidatesRef = useRef(new Map());
    const reactionTimersRef = useRef(new Map());
    const localParticipantJoinedAt = useRef(null);

    const mountedRef = useRef(false);
    const initializingRef = useRef(false);
    const processedOffersRef = useRef(new Set());
    const processedAnswersRef = useRef(new Set());
    const processedIceRef = useRef(new Set());


    // ========================================================
    // STATE
    // ========================================================

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [room, setRoom] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [participants, setParticipants] = useState([]);

    const [localMicEnabled, setLocalMicEnabled] = useState(true);
    const [localCameraEnabled, setLocalCameraEnabled] = useState(true);
    const [cameraStarted, setCameraStarted] = useState(false);
    const [screenSharing, setScreenSharing] = useState(false);

    const [chatOpen, setChatOpen] = useState(false);
    const [participantsOpen, setParticipantsOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [raiseHandEnabled, setRaiseHandEnabled] = useState(false);
    const [applauseCount, setApplauseCount] = useState(0);
    const [floatingReactions, setFloatingReactions] = useState([]);

    const [messages, setMessages] = useState([]);
    const [chatMessage, setChatMessage] = useState("");
    const [copySuccess, setCopySuccess] = useState(false);
    const [endingMeeting, setEndingMeeting] = useState(false);


    // ========================================================
    // MEMOS
    // ========================================================

    const currentUserId = useMemo(() => {
        return normalizeId(currentUser?.id);
    }, [currentUser]);


    const currentDisplayName = useMemo(() => {
        return (
            profile?.full_name ||
            currentUser?.email ||
            "Participant"
        );
    }, [profile, currentUser]);


    const joinLink = useMemo(() => {
        if (!room) {
            return "";
        }

        const value = room?.room_code || room?.id || meetingId;

        return `${window.location.origin}/communication/meeting/${encodeURIComponent(
            String(value)
        )}`;
    }, [room, meetingId]);


    const remoteParticipantCount = useMemo(() => {
        return participants.filter(
            (participant) =>
                normalizeId(participant.user_id) !== currentUserId
        ).length;
    }, [participants, currentUserId]);


    // ========================================================
    // MEDIA CLEANUP
    // ========================================================

    const stopAllMedia = useCallback(() => {
        try {
            localStreamRef.current?.getTracks?.().forEach((track) => {
                track.stop();
            });
        } catch {
            // Ignore cleanup errors.
        }

        try {
            screenStreamRef.current?.getTracks?.().forEach((track) => {
                track.stop();
            });
        } catch {
            // Ignore cleanup errors.
        }

        localStreamRef.current = null;
        screenStreamRef.current = null;

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }

        setCameraStarted(false);
        setScreenSharing(false);
    }, []);


    const closePeerConnection = useCallback((remoteUserId) => {
        const key = normalizeId(remoteUserId);
        const peer = peerConnectionsRef.current.get(key);

        if (!peer) {
            return;
        }

        try {
            peer.ontrack = null;
            peer.onicecandidate = null;
            peer.onconnectionstatechange = null;
            peer.close();
        } catch {
            // Ignore cleanup errors.
        }

        peerConnectionsRef.current.delete(key);
        remoteStreamsRef.current.delete(key);
        remoteVideoRefs.current.delete(key);
        pendingIceCandidatesRef.current.delete(key);
    }, []);


    const closeAllPeerConnections = useCallback(() => {
        Array.from(peerConnectionsRef.current.keys()).forEach((userId) => {
            closePeerConnection(userId);
        });

        peerConnectionsRef.current.clear();
        remoteStreamsRef.current.clear();
        pendingIceCandidatesRef.current.clear();
    }, [closePeerConnection]);


    // ========================================================
    // PRESENCE
    // ========================================================

    const updateParticipantPresence = useCallback((presenceState) => {
        const users = extractPresenceUsers(presenceState);

        if (mountedRef.current) {
            setParticipants(users);
        }
    }, []);


    // ========================================================
    // ICE QUEUE
    // ========================================================

    const flushPendingIceCandidates = useCallback(async (remoteUserId, peer) => {
        const key = normalizeId(remoteUserId);
        const queue = pendingIceCandidatesRef.current.get(key) || [];

        if (!queue.length || !peer?.remoteDescription) {
            return;
        }

        for (const candidate of queue) {
            try {
                await peer.addIceCandidate(candidate);
            } catch (candidateError) {
                console.warn(
                    "Failed to apply queued ICE candidate:",
                    candidateError
                );
            }
        }

        pendingIceCandidatesRef.current.delete(key);
    }, []);


    // ========================================================
    // SEND REALTIME EVENT
    // ========================================================

    const sendRealtime = useCallback(async (event, payload) => {
        const channel = channelRef.current;

        if (!channel) {
            return null;
        }

        try {
            return await channel.send({
                type: "broadcast",
                event,
                payload,
            });
        } catch (sendError) {
            console.warn(`Realtime event ${event} failed:`, sendError);
            return null;
        }
    }, []);


    // ========================================================
    // CREATE PEER
    // ========================================================

    const createPeerConnection = useCallback(
        async (remoteUserId, shouldCreateOffer) => {
            const key = normalizeId(remoteUserId);

            if (!key || key === currentUserId) {
                return null;
            }

            if (!localStreamRef.current) {
                return null;
            }

            const existingPeer = peerConnectionsRef.current.get(key);

            if (existingPeer) {
                if (
                    shouldCreateOffer &&
                    existingPeer.signalingState === "stable"
                ) {
                    try {
                        const offer = await existingPeer.createOffer();
                        await existingPeer.setLocalDescription(offer);

                        await sendRealtime("webrtc-offer", {
                            from: currentUserId,
                            to: key,
                            offer: existingPeer.localDescription,
                        });
                    } catch (offerError) {
                        console.warn(
                            "Failed to renegotiate existing peer:",
                            offerError
                        );
                    }
                }

                return existingPeer;
            }

            const peer = new RTCPeerConnection({
                iceServers: ICE_SERVERS,
            });

            peerConnectionsRef.current.set(key, peer);

            localStreamRef.current.getTracks().forEach((track) => {
                try {
                    peer.addTrack(track, localStreamRef.current);
                } catch (trackError) {
                    console.warn(
                        "Failed to add local track to peer:",
                        trackError
                    );
                }
            });

            peer.ontrack = (event) => {
                const [stream] = event.streams || [];

                if (!stream) {
                    return;
                }

                remoteStreamsRef.current.set(key, stream);

                const videoElement = remoteVideoRefs.current.get(key);

                if (videoElement) {
                    videoElement.srcObject = stream;
                    videoElement.play?.().catch(() => null);
                }
            };

            peer.onicecandidate = async (event) => {
                if (!event.candidate) {
                    return;
                }

                await sendRealtime("webrtc-ice", {
                    from: currentUserId,
                    to: key,
                    candidate: event.candidate,
                });
            };

            peer.onconnectionstatechange = () => {
                const state = peer.connectionState;

                if (
                    state === "failed" ||
                    state === "closed" ||
                    state === "disconnected"
                ) {
                    closePeerConnection(key);
                }
            };

            if (shouldCreateOffer) {
                try {
                    const offer = await peer.createOffer();
                    await peer.setLocalDescription(offer);

                    await sendRealtime("webrtc-offer", {
                        from: currentUserId,
                        to: key,
                        offer: peer.localDescription,
                    });
                } catch (offerError) {
                    console.error(
                        "WebRTC offer creation failed:",
                        offerError
                    );
                }
            }

            return peer;
        },
        [
            currentUserId,
            sendRealtime,
            closePeerConnection,
        ]
    );


    // ========================================================
    // OFFER
    // ========================================================

    const handleOffer = useCallback(
        async (payload) => {
            const from = normalizeId(payload?.from);
            const to = normalizeId(payload?.to);

            if (
                !from ||
                !to ||
                to !== currentUserId ||
                !payload?.offer
            ) {
                return;
            }

            const offerKey = `${from}:${payload.offer?.sdp || ""}`;

            if (processedOffersRef.current.has(offerKey)) {
                return;
            }

            processedOffersRef.current.add(offerKey);

            try {
                let peer = peerConnectionsRef.current.get(from);

                if (!peer) {
                    peer = await createPeerConnection(from, false);
                }

                if (!peer) {
                    return;
                }

                await peer.setRemoteDescription(
                    new RTCSessionDescription(payload.offer)
                );

                await flushPendingIceCandidates(from, peer);

                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);

                await sendRealtime("webrtc-answer", {
                    from: currentUserId,
                    to: from,
                    answer: peer.localDescription,
                });
            } catch (offerError) {
                console.error(
                    "Failed to handle WebRTC offer:",
                    offerError
                );
            }
        },
        [
            currentUserId,
            createPeerConnection,
            flushPendingIceCandidates,
            sendRealtime,
        ]
    );


    // ========================================================
    // ANSWER
    // ========================================================

    const handleAnswer = useCallback(
        async (payload) => {
            const from = normalizeId(payload?.from);
            const to = normalizeId(payload?.to);

            if (
                !from ||
                !to ||
                to !== currentUserId ||
                !payload?.answer
            ) {
                return;
            }

            const answerKey = `${from}:${payload.answer?.sdp || ""}`;

            if (processedAnswersRef.current.has(answerKey)) {
                return;
            }

            processedAnswersRef.current.add(answerKey);

            const peer = peerConnectionsRef.current.get(from);

            if (!peer) {
                return;
            }

            try {
                await peer.setRemoteDescription(
                    new RTCSessionDescription(payload.answer)
                );

                await flushPendingIceCandidates(from, peer);
            } catch (answerError) {
                console.error(
                    "Failed to handle WebRTC answer:",
                    answerError
                );
            }
        },
        [
            currentUserId,
            flushPendingIceCandidates,
        ]
    );


    // ========================================================
    // ICE
    // ========================================================

    const handleIceCandidate = useCallback(
        async (payload) => {
            const from = normalizeId(payload?.from);
            const to = normalizeId(payload?.to);
            const candidate = payload?.candidate;

            if (
                !from ||
                !to ||
                to !== currentUserId ||
                !candidate
            ) {
                return;
            }

            const candidateId =
                `${from}:${candidate?.candidate || ""}:${candidate?.sdpMLineIndex ?? ""}`;

            if (processedIceRef.current.has(candidateId)) {
                return;
            }

            processedIceRef.current.add(candidateId);

            const peer = peerConnectionsRef.current.get(from);

            if (!peer || !peer.remoteDescription) {
                const queue =
                    pendingIceCandidatesRef.current.get(from) || [];

                queue.push(candidate);
                pendingIceCandidatesRef.current.set(from, queue);
                return;
            }

            try {
                await peer.addIceCandidate(candidate);
            } catch (iceError) {
                console.warn(
                    "Failed to apply ICE candidate:",
                    iceError
                );
            }
        },
        [currentUserId]
    );


    // ========================================================
    // MEETING REACTIONS
    // ========================================================

    const showFloatingReaction = useCallback((emoji, displayName = "Participant") => {
        const reactionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        setFloatingReactions((current) => [
            ...current,
            { id: reactionId, emoji, display_name: displayName },
        ].slice(-8));

        const timer = window.setTimeout(() => {
            setFloatingReactions((current) =>
                current.filter((item) => item.id !== reactionId)
            );
            reactionTimersRef.current.delete(reactionId);
        }, 1800);

        reactionTimersRef.current.set(reactionId, timer);
    }, []);


    const handleRemoteReaction = useCallback((payload) => {
        const type = String(payload?.type || "").toLowerCase();
        const userId = normalizeId(payload?.user_id);
        const displayName = payload?.display_name || "Participant";

        if (!type || !userId || userId === currentUserId) {
            return;
        }

        if (type === "applause") {
            setApplauseCount((current) => current + 1);
            showFloatingReaction("👏", displayName);
            return;
        }

        if (type === "raise_hand") {
            const active = payload?.active === true;

            setParticipants((current) =>
                current.map((participant) =>
                    normalizeId(participant.user_id) === userId
                        ? { ...participant, hand_raised: active }
                        : participant
                )
            );

            if (active) {
                showFloatingReaction("✋", displayName);
            }
        }
    }, [currentUserId, showFloatingReaction]);


    const toggleRaiseHand = useCallback(async () => {
        if (!currentUserId) return;

        const nextRaised = !raiseHandEnabled;
        setRaiseHandEnabled(nextRaised);

        setParticipants((current) =>
            current.map((participant) =>
                normalizeId(participant.user_id) === currentUserId
                    ? { ...participant, hand_raised: nextRaised }
                    : participant
            )
        );

        try {
            const channel = channelRef.current;

            if (channel) {
                await channel.track({
                    user_id: currentUserId,
                    display_name: currentDisplayName,
                    joined_at:
                        localParticipantJoinedAt.current ||
                        new Date().toISOString(),
                    mic_enabled: localMicEnabled,
                    camera_enabled: localCameraEnabled,
                    hand_raised: nextRaised,
                    role:
                        normalizeId(room?.created_by) === currentUserId
                            ? "host"
                            : "participant",
                });
            }
        } catch (trackError) {
            console.warn("Failed to update raised-hand presence:", trackError);
        }

        await sendRealtime("meeting-reaction", {
            type: "raise_hand",
            user_id: currentUserId,
            display_name: currentDisplayName,
            active: nextRaised,
        });

        if (nextRaised) {
            showFloatingReaction("✋", currentDisplayName);
        }
    }, [
        currentUserId,
        raiseHandEnabled,
        currentDisplayName,
        localMicEnabled,
        localCameraEnabled,
        room,
        sendRealtime,
        showFloatingReaction,
    ]);


    const sendApplause = useCallback(async () => {
        if (!currentUserId) return;

        setApplauseCount((current) => current + 1);
        showFloatingReaction("👏", currentDisplayName);

        await sendRealtime("meeting-reaction", {
            type: "applause",
            user_id: currentUserId,
            display_name: currentDisplayName,
            active: true,
        });
    }, [currentUserId, currentDisplayName, sendRealtime, showFloatingReaction]);


    // ========================================================
    // REMOTE EVENTS
    // ========================================================

    const handleRemoteLeave = useCallback(
        (payload) => {
            const userId = normalizeId(payload?.user_id || payload?.from);

            if (!userId) {
                return;
            }

            closePeerConnection(userId);

            // Functional state update keeps this callback stable. That is
            // important because it is registered on the realtime channel
            // once; it must not force the whole meeting effect to restart
            // whenever the participant list changes.
            setParticipants((current) =>
                current.filter(
                    (participant) =>
                        normalizeId(participant.user_id) !== userId
                )
            );
        },
        [closePeerConnection]
    );


    const handleRemoteMediaState = useCallback((payload) => {
        if (!payload?.user_id) {
            return;
        }

        setParticipants((current) =>
            current.map((participant) =>
                normalizeId(participant.user_id) ===
                normalizeId(payload.user_id)
                    ? {
                        ...participant,
                        mic_enabled:
                            payload.mic_enabled ?? participant.mic_enabled,
                        camera_enabled:
                            payload.camera_enabled ?? participant.camera_enabled,
                    }
                    : participant
            )
        );
    }, []);


    const handleRemoteChat = useCallback(
        (payload) => {
            if (!payload?.id || !payload?.sender_id) {
                return;
            }

            setMessages((current) => {
                if (current.some((item) => item.id === payload.id)) {
                    return current;
                }

                return [
                    ...current,
                    {
                        id: payload.id,
                        sender_id: normalizeId(payload.sender_id),
                        sender_name:
                            payload.sender_name || "Participant",
                        message_text: payload.message_text || "",
                        created_at:
                            payload.created_at ||
                            new Date().toISOString(),
                    },
                ];
            });
        },
        []
    );


    const handleBroadcast = useCallback(
        async ({ event, payload }) => {
            if (!payload) {
                return;
            }

            switch (event) {
                case "webrtc-offer":
                    await handleOffer(payload);
                    break;

                case "webrtc-answer":
                    await handleAnswer(payload);
                    break;

                case "webrtc-ice":
                    await handleIceCandidate(payload);
                    break;

                case "participant-left":
                    handleRemoteLeave(payload);
                    break;

                case "media-state":
                    handleRemoteMediaState(payload);
                    break;

                case "chat-message":
                    handleRemoteChat(payload);
                    break;

                case "meeting-reaction":
                    handleRemoteReaction(payload);
                    break;

                default:
                    break;
            }
        },
        [
            handleOffer,
            handleAnswer,
            handleIceCandidate,
            handleRemoteLeave,
            handleRemoteMediaState,
            handleRemoteChat,
            handleRemoteReaction,
        ]
    );


    // ========================================================
    // START LOCAL MEDIA
    // ========================================================

    const startLocalMedia = useCallback(async () => {
        if (localStreamRef.current) {
            setCameraStarted(true);

            if (localVideoRef.current) {
                localVideoRef.current.srcObject =
                    localStreamRef.current;
            }

            return localStreamRef.current;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error(
                "Camera and microphone are not supported by this browser."
            );
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user",
            },
        });

        localStreamRef.current = stream;

        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];

        setLocalMicEnabled(
            audioTrack ? audioTrack.enabled !== false : false
        );

        setLocalCameraEnabled(
            videoTrack ? videoTrack.enabled !== false : false
        );

        setCameraStarted(true);

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play?.().catch(() => null);
        }

        return stream;
    }, []);


    // ========================================================
    // BROADCAST MEDIA STATE
    // ========================================================

    const broadcastMediaState = useCallback(
        async (overrides = {}) => {
            await sendRealtime("media-state", {
                user_id: currentUserId,
                mic_enabled:
                    overrides.mic_enabled ?? localMicEnabled,
                camera_enabled:
                    overrides.camera_enabled ?? localCameraEnabled,
            });
        },
        [
            currentUserId,
            localMicEnabled,
            localCameraEnabled,
            sendRealtime,
        ]
    );


    // ========================================================
    // TOGGLES
    // ========================================================

    const toggleMic = useCallback(async () => {
        const track =
            localStreamRef.current?.getAudioTracks?.()[0];

        if (!track) {
            return;
        }

        const nextEnabled = !track.enabled;

        track.enabled = nextEnabled;
        setLocalMicEnabled(nextEnabled);

        await broadcastMediaState({
            mic_enabled: nextEnabled,
        });
    }, [broadcastMediaState]);


    const toggleCamera = useCallback(async () => {
        const track =
            localStreamRef.current?.getVideoTracks?.()[0];

        if (!track) {
            return;
        }

        const nextEnabled = !track.enabled;

        track.enabled = nextEnabled;
        setLocalCameraEnabled(nextEnabled);

        await broadcastMediaState({
            camera_enabled: nextEnabled,
        });
    }, [broadcastMediaState]);


    // ========================================================
    // SCREEN SHARE
    // ========================================================

    const toggleScreenShare = useCallback(async () => {
        if (!localStreamRef.current) {
            return;
        }

        if (screenSharing) {
            const cameraTrack =
                localStreamRef.current.getVideoTracks?.()[0];

            peerConnectionsRef.current.forEach((peer) => {
                const sender = peer
                    .getSenders?.()
                    ?.find((item) => item.track?.kind === "video");

                if (sender && cameraTrack) {
                    sender.replaceTrack(cameraTrack).catch(() => null);
                }
            });

            screenStreamRef.current?.getTracks?.().forEach((track) => {
                track.stop();
            });

            screenStreamRef.current = null;
            setScreenSharing(false);

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
            }

            return;
        }

        if (!navigator.mediaDevices?.getDisplayMedia) {
            setError("Screen sharing is not supported by this browser.");
            return;
        }

        try {
            const screenStream =
                await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false,
                });

            const screenTrack = screenStream.getVideoTracks()[0];

            if (!screenTrack) {
                return;
            }

            screenStreamRef.current = screenStream;

            peerConnectionsRef.current.forEach((peer) => {
                const sender = peer
                    .getSenders?.()
                    ?.find((item) => item.track?.kind === "video");

                if (sender) {
                    sender.replaceTrack(screenTrack).catch(() => null);
                }
            });

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = screenStream;
            }

            setScreenSharing(true);

            screenTrack.onended = () => {
                toggleScreenShare().catch(() => null);
            };
        } catch (screenError) {
            if (screenError?.name !== "NotAllowedError") {
                setError(
                    getErrorMessage(
                        screenError,
                        "Unable to start screen sharing."
                    )
                );
            }
        }
    }, [screenSharing]);


    // ========================================================
    // CHAT
    // ========================================================

    const sendChatMessage = useCallback(async () => {
        const text = String(chatMessage || "").trim();

        if (!text || !currentUserId) {
            return;
        }

        const message = {
            id: `${currentUserId}-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
            sender_id: currentUserId,
            sender_name: currentDisplayName,
            message_text: text,
            created_at: new Date().toISOString(),
        };

        setMessages((current) => [...current, message]);
        setChatMessage("");

        await sendRealtime("chat-message", message);
    }, [
        chatMessage,
        currentUserId,
        currentDisplayName,
        sendRealtime,
    ]);


    // ========================================================
    // COPY LINK
    // ========================================================

    const copyJoinLink = useCallback(async () => {
        if (!joinLink) {
            return;
        }

        try {
            await navigator.clipboard.writeText(joinLink);
            setCopySuccess(true);

            window.setTimeout(() => {
                if (mountedRef.current) {
                    setCopySuccess(false);
                }
            }, 2000);
        } catch {
            setError("Unable to copy the meeting link.");
        }
    }, [joinLink]);


    // ========================================================
    // LOAD ROOM
    // ========================================================

    const loadRoom = useCallback(async () => {
        if (!isValidRoomId(meetingId)) {
            throw new Error("Meeting ID is missing.");
        }

        const {
            data: {
                user,
            },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
            throw userError;
        }

        if (!user) {
            throw new Error("Your session has expired. Please login again.");
        }

        if (!mountedRef.current) {
            return null;
        }

        setCurrentUser(user);

        const {
            data: profileData,
            error: profileError,
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

        if (!profileData) {
            throw new Error("Your user profile was not found.");
        }

        setProfile(profileData);

        const rawMeetingId = String(meetingId).trim();
        let roomData = null;
        let roomError = null;

        // First try the real numeric video_rooms.id.
        if (/^\d+$/.test(rawMeetingId)) {
            const numericId = Number(rawMeetingId);

            const result = await supabase
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
                .eq("id", numericId)
                .maybeSingle();

            roomData = result.data;
            roomError = result.error;
        }

        // If id lookup did not resolve, allow a room-code link.
        if (!roomData && !roomError) {
            const result = await supabase
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
                .eq("room_code", rawMeetingId)
                .maybeSingle();

            roomData = result.data;
            roomError = result.error;
        }

        if (roomError) {
            throw roomError;
        }

        if (!roomData) {
            throw new Error(
                "This meeting could not be found. Check the meeting link or meeting ID."
            );
        }

        if (
            String(roomData.status || "").toLowerCase() === "cancelled" ||
            String(roomData.status || "").toLowerCase() === "canceled" ||
            String(roomData.status || "").toLowerCase() === "ended"
        ) {
            throw new Error("This meeting has already ended or was cancelled.");
        }

        setRoom(roomData);

        // Load participant records for the room. This is intentionally NOT
        // filtered by created_by because another authenticated same-school
        // user must be able to join the creator's meeting.
        const {
            data: participantRows,
            error: participantsError,
        } = await supabase
            .from("video_room_participants")
            .select(`
                id,
                room_id,
                user_id,
                role,
                status,
                joined_at,
                left_at,
                created_at
            `)
            .eq("room_id", roomData.id)
            .neq("status", "removed");

        if (participantsError) {
            console.warn(
                "Meeting participant rows could not be loaded:",
                participantsError
            );
        }

        const rows = Array.isArray(participantRows)
            ? participantRows
            : [];

        const participantIds = Array.from(
            new Set(
                rows
                    .map((row) => normalizeId(row.user_id))
                    .filter(Boolean)
            )
        );

        let profileMap = new Map();

        if (participantIds.length) {
            const {
                data: participantProfiles,
                error: participantProfilesError,
            } = await supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", participantIds);

            if (participantProfilesError) {
                console.warn(
                    "Participant profile names could not be loaded:",
                    participantProfilesError
                );
            } else {
                profileMap = new Map(
                    (participantProfiles || []).map((item) => [
                        normalizeId(item.id),
                        item.full_name || "Participant",
                    ])
                );
            }
        }

        const localParticipantRow = rows.find(
            (row) => normalizeId(row.user_id) === normalizeId(user.id)
        );

        localParticipantJoinedAt.current =
            localParticipantRow?.joined_at || null;

        setParticipants(
            rows.map((row) => ({
                user_id: normalizeId(row.user_id),
                display_name:
                    profileMap.get(normalizeId(row.user_id)) ||
                    (normalizeId(row.user_id) === normalizeId(user.id)
                        ? profileData.full_name || user.email
                        : "Participant"),
                joined_at: row.joined_at,
                role: row.role,
                status: row.status,
                hand_raised: false,
            }))
        );

        return {
            room: roomData,
            user,
            profile: profileData,
        };
    }, [meetingId]);


    // ========================================================
    // JOIN REALTIME ROOM
    // ========================================================

    const joinRealtimeRoom = useCallback(
        async (roomData, user, profileData) => {
            if (!roomData?.id || !user?.id) {
                throw new Error("Meeting room information is incomplete.");
            }

            const roomId = normalizeId(roomData.id);
            const channelName = makeRoomChannelName(roomId);

            // ====================================================
            // CRITICAL FIX:
            // Never reuse a stale channel for the same realtime topic.
            // React StrictMode/HMR/navigation can leave a subscribed
            // channel behind. Presence callbacks cannot be added after
            // that channel is subscribed.
            // ====================================================

            if (channelRef.current) {
                try {
                    await supabase.removeChannel(channelRef.current);
                } catch (removeError) {
                    console.warn(
                        "Existing meeting channel cleanup failed:",
                        removeError
                    );
                }

                channelRef.current = null;
            }

            const staleChannels = supabase
                .getChannels()
                .filter((existingChannel) => {
                    const topic = String(
                        existingChannel?.topic || ""
                    ).replace(/^realtime:/, "");

                    return topic === channelName;
                });

            for (const staleChannel of staleChannels) {
                try {
                    await supabase.removeChannel(staleChannel);
                } catch (removeError) {
                    console.warn(
                        "Stale meeting channel cleanup failed:",
                        removeError
                    );
                }
            }

            // ====================================================
            // Create a fresh channel.
            // IMPORTANT: ALL listeners are attached BEFORE subscribe.
            // ====================================================

            const channel = supabase.channel(channelName, {
                config: {
                    broadcast: {
                        self: false,
                    },
                    presence: {
                        key: user.id,
                    },
                },
            });

            channelRef.current = channel;

            // ----------------------------------------------------
            // BROADCAST LISTENER
            // ----------------------------------------------------

            channel.on(
                "broadcast",
                {
                    event: "webrtc-offer",
                },
                ({ payload }) => {
                    if (channelRef.current !== channel) {
                        return;
                    }

                    handleBroadcast({
                        event: "webrtc-offer",
                        payload,
                    });
                }
            );

            channel.on(
                "broadcast",
                {
                    event: "webrtc-answer",
                },
                ({ payload }) => {
                    if (channelRef.current !== channel) {
                        return;
                    }

                    handleBroadcast({
                        event: "webrtc-answer",
                        payload,
                    });
                }
            );

            channel.on(
                "broadcast",
                {
                    event: "webrtc-ice",
                },
                ({ payload }) => {
                    if (channelRef.current !== channel) {
                        return;
                    }

                    handleBroadcast({
                        event: "webrtc-ice",
                        payload,
                    });
                }
            );

            channel.on(
                "broadcast",
                {
                    event: "participant-left",
                },
                ({ payload }) => {
                    if (channelRef.current !== channel) {
                        return;
                    }

                    handleBroadcast({
                        event: "participant-left",
                        payload,
                    });
                }
            );

            channel.on(
                "broadcast",
                {
                    event: "media-state",
                },
                ({ payload }) => {
                    if (channelRef.current !== channel) {
                        return;
                    }

                    handleBroadcast({
                        event: "media-state",
                        payload,
                    });
                }
            );

            channel.on(
                "broadcast",
                {
                    event: "chat-message",
                },
                ({ payload }) => {
                    if (channelRef.current !== channel) {
                        return;
                    }

                    handleBroadcast({
                        event: "chat-message",
                        payload,
                    });
                }
            );

            channel.on(
                "broadcast",
                { event: "meeting-reaction" },
                ({ payload }) => {
                    if (channelRef.current !== channel) return;

                    handleBroadcast({
                        event: "meeting-reaction",
                        payload,
                    });
                }
            );

            // ----------------------------------------------------
            // PRESENCE LISTENERS
            // ----------------------------------------------------
            // These MUST stay before channel.subscribe().

            channel.on(
                "presence",
                {
                    event: "sync",
                },
                () => {
                    if (channelRef.current !== channel) {
                        return;
                    }

                    const state = channel.presenceState();
                    updateParticipantPresence(state);
                }
            );

            channel.on(
                "presence",
                {
                    event: "join",
                },
                ({ key, newPresences }) => {
                    if (channelRef.current !== channel) {
                        return;
                    }

                    const state = channel.presenceState();
                    updateParticipantPresence(state);

                    const remoteIds = (
                        Array.isArray(newPresences)
                            ? newPresences
                            : []
                    )
                        .map((item) => normalizeId(item?.user_id || key))
                        .filter(Boolean)
                        .filter((id) => id !== normalizeId(user.id));

                    // Deterministic offer ownership prevents both sides
                    // from creating a competing offer at the same time.
                    remoteIds.forEach((remoteId) => {
                        if (normalizeId(user.id) < remoteId) {
                            createPeerConnection(remoteId, true).catch(
                                (peerError) => {
                                    console.warn(
                                        "Initial WebRTC offer failed:",
                                        peerError
                                    );
                                }
                            );
                        }
                    });
                }
            );

            channel.on(
                "presence",
                {
                    event: "leave",
                },
                ({ key, leftPresences }) => {
                    if (channelRef.current !== channel) {
                        return;
                    }

                    const state = channel.presenceState();
                    updateParticipantPresence(state);

                    const leftIds = new Set(
                        (Array.isArray(leftPresences)
                            ? leftPresences
                            : []
                        )
                            .map((item) => normalizeId(item?.user_id || key))
                            .filter(Boolean)
                    );

                    if (key) {
                        leftIds.add(normalizeId(key));
                    }

                    leftIds.forEach((remoteId) => {
                        if (remoteId !== normalizeId(user.id)) {
                            closePeerConnection(remoteId);
                        }
                    });
                }
            );

            // ====================================================
            // SUBSCRIBE
            // ====================================================

            await new Promise((resolve, reject) => {
                let settled = false;

                const finish = (callback, value) => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    callback(value);
                };

                channel.subscribe((status, subscriptionError) => {
                    if (status === "SUBSCRIBED") {
                        finish(resolve, status);
                        return;
                    }

                    if (status === "CHANNEL_ERROR") {
                        finish(
                            reject,
                            new Error(
                                subscriptionError?.message ||
                                subscriptionError?.details ||
                                "Unable to connect to the meeting realtime channel."
                            )
                        );
                        return;
                    }

                    if (status === "TIMED_OUT") {
                        finish(
                            reject,
                            new Error(
                                "Meeting realtime connection timed out."
                            )
                        );
                        return;
                    }

                    if (status === "CLOSED") {
                        finish(
                            reject,
                            new Error(
                                "Meeting realtime channel was closed."
                            )
                        );
                    }
                });
            });

            if (!mountedRef.current || channelRef.current !== channel) {
                return;
            }

            // Presence tracking happens ONLY after successful subscription.
            await channel.track({
                user_id: user.id,
                display_name:
                    profileData?.full_name ||
                    user.email ||
                    "Participant",
                joined_at: new Date().toISOString(),
                mic_enabled: true,
                camera_enabled: true,
                hand_raised: false,
                role:
                    normalizeId(roomData.created_by) === normalizeId(user.id)
                        ? "host"
                        : "participant",
            });

            // ====================================================
            // PERSIST PARTICIPANT JOIN
            // ====================================================

            const participantRole =
                normalizeId(roomData.created_by) === normalizeId(user.id)
                    ? "host"
                    : "participant";

            const {
                error: participantUpsertError,
            } = await supabase
                .from("video_room_participants")
                .upsert(
                    {
                        room_id: roomData.id,
                        user_id: user.id,
                        role: participantRole,
                        status: "joined",
                        joined_at: new Date().toISOString(),
                        left_at: null,
                    },
                    {
                        onConflict: "room_id,user_id",
                    }
                );

            if (participantUpsertError) {
                console.warn(
                    "Meeting participant record could not be saved:",
                    participantUpsertError
                );
            }

            // Only the meeting creator moves a scheduled room to live.
            if (
                String(roomData.status || "").toLowerCase() === "scheduled" &&
                normalizeId(roomData.created_by) === normalizeId(user.id)
            ) {
                const { error: liveUpdateError } = await supabase
                    .from("video_rooms")
                    .update({
                        status: "live",
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", roomData.id)
                    .eq("created_by", user.id);

                if (liveUpdateError) {
                    console.warn(
                        "Unable to switch scheduled meeting to live:",
                        liveUpdateError
                    );
                } else if (mountedRef.current) {
                    setRoom((currentRoom) =>
                        currentRoom
                            ? {
                                ...currentRoom,
                                status: "live",
                            }
                            : currentRoom
                    );
                }
            }

            // ====================================================
            // INITIAL PRESENCE + DETERMINISTIC OFFERS
            // ====================================================

            const presenceState = channel.presenceState();
            updateParticipantPresence(presenceState);

            const existingUsers = extractPresenceUsers(
                presenceState
            )
                .map((item) => normalizeId(item.user_id))
                .filter((id) => id && id !== normalizeId(user.id));

            // Lexicographic ownership: the lower UUID creates the offer.
            for (const remoteUserId of existingUsers) {
                if (normalizeId(user.id) < remoteUserId) {
                    await createPeerConnection(remoteUserId, true);
                }
            }
        },
        [
            closePeerConnection,
            createPeerConnection,
            handleBroadcast,
            updateParticipantPresence,
        ]
    );


    // ========================================================
    // LEAVE MEETING
    // ========================================================

    const leaveMeeting = useCallback(
        async ({ endForEveryone = false } = {}) => {
            if (endingMeeting) {
                return;
            }

            setEndingMeeting(true);

            try {
                const channel = channelRef.current;

                if (channel && currentUserId) {
                    await sendRealtime("participant-left", {
                        user_id: currentUserId,
                        from: currentUserId,
                    });
                }

                if (room?.id && currentUserId) {
                    const { error: participantError } = await supabase
                        .from("video_room_participants")
                        .update({
                            status: "left",
                            left_at: new Date().toISOString(),
                        })
                        .eq("room_id", room.id)
                        .eq("user_id", currentUserId);

                    if (participantError) {
                        console.warn(
                            "Unable to update participant leave status:",
                            participantError
                        );
                    }
                }

                const isHost =
                    normalizeId(room?.created_by) === currentUserId;

                if (endForEveryone && isHost && room?.id) {
                    const { error: endError } = await supabase
                        .from("video_rooms")
                        .update({
                            status: "ended",
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", room.id)
                        .eq("created_by", currentUserId);

                    if (endError) {
                        throw endError;
                    }
                }
            } catch (leaveError) {
                console.warn(
                    "Meeting leave cleanup warning:",
                    leaveError
                );
            } finally {
                try {
                    if (channelRef.current) {
                        await supabase.removeChannel(channelRef.current);
                    }
                } catch {
                    // Ignore channel removal errors.
                }

                channelRef.current = null;
                closeAllPeerConnections();
                stopAllMedia();

                navigate("/communication/meetings");
                setEndingMeeting(false);
            }
        },
        [
            endingMeeting,
            currentUserId,
            room,
            sendRealtime,
            closeAllPeerConnections,
            stopAllMedia,
            navigate,
        ]
    );


    // ========================================================
    // INITIALIZATION
    // ========================================================

    useEffect(() => {
        mountedRef.current = true;

        if (initializingRef.current) {
            return () => {
                mountedRef.current = false;
                initializingRef.current = false;
            };
        }

        initializingRef.current = true;

        const initialize = async () => {
            try {
                setLoading(true);
                setError("");

                const roomContext = await loadRoom();

                if (!mountedRef.current || !roomContext) {
                    return;
                }

                await startLocalMedia();

                if (!mountedRef.current) {
                    return;
                }

                await joinRealtimeRoom(
                    roomContext.room,
                    roomContext.user,
                    roomContext.profile
                );
            } catch (initializationError) {
                console.error(
                    "Communication meeting initialization failed:",
                    initializationError
                );

                if (mountedRef.current) {
                    setError(
                        getErrorMessage(
                            initializationError,
                            "Unable to open this meeting."
                        )
                    );
                }
            } finally {
                if (mountedRef.current) {
                    setLoading(false);
                }
            }
        };

        initialize();

        return () => {
            // ====================================================
            // CRITICAL CLEANUP FIX:
            // reset initializingRef so React StrictMode/navigation
            // does not leave the component permanently "initializing".
            // ====================================================

            mountedRef.current = false;
            initializingRef.current = false;

            if (channelRef.current) {
                supabase.removeChannel(channelRef.current).catch(() => null);
                channelRef.current = null;
            }

            closeAllPeerConnections();
            stopAllMedia();

            reactionTimersRef.current.forEach((timer) => {
                window.clearTimeout(timer);
            });
            reactionTimersRef.current.clear();
            setFloatingReactions([]);
        };
    }, [
        loadRoom,
        startLocalMedia,
        joinRealtimeRoom,
        closeAllPeerConnections,
        stopAllMedia,
    ]);


    // ========================================================
    // ATTACH REMOTE VIDEO STREAMS AFTER RENDER
    // ========================================================

    useEffect(() => {
        participants.forEach((participant) => {
            const userId = normalizeId(participant.user_id);

            if (userId === currentUserId) {
                return;
            }

            const element = remoteVideoRefs.current.get(userId);
            const stream = remoteStreamsRef.current.get(userId);

            if (element && stream && element.srcObject !== stream) {
                element.srcObject = stream;
                element.play?.().catch(() => null);
            }
        });
    }, [
        participants,
        currentUserId,
    ]);


    // ========================================================
    // UI DERIVED DATA
    // ========================================================

    const localParticipant = participants.find(
        (participant) =>
            normalizeId(participant.user_id) === currentUserId
    );

    const remoteParticipants = participants.filter(
        (participant) =>
            normalizeId(participant.user_id) !== currentUserId
    );

    const visibleRemoteParticipants = remoteParticipants.filter(
        (participant) =>
            remoteStreamsRef.current.has(
                normalizeId(participant.user_id)
            )
    );


    // ========================================================
    // LOADING
    // ========================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
                <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-300" />
                    </div>
                    <h1 className="text-xl font-bold">Joining meeting...</h1>
                    <p className="mt-2 text-sm text-slate-400">
                        Preparing your camera, microphone and realtime connection.
                    </p>
                </div>
            </div>
        );
    }


    // ========================================================
    // ERROR
    // ========================================================

    if (error && !room) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
                <div className="w-full max-w-xl rounded-3xl border border-red-400/20 bg-red-500/10 p-8 shadow-2xl">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-xl font-bold">Unable to open meeting</h1>
                            <p className="mt-2 text-sm leading-6 text-red-100/80">
                                {error}
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => navigate("/communication/meetings")}
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to Meetings
                        </button>

                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }


    // ========================================================
    // MAIN UI
    // ========================================================

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">

            {/* ==================================================
                TOP BAR
            ================================================== */}

            <header className="border-b border-white/10 bg-slate-950/95 backdrop-blur sticky top-0 z-40">
                <div className="flex min-h-[68px] items-center justify-between gap-4 px-4 md:px-6">

                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate("/communication/meetings")}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h1 className="truncate text-sm font-bold md:text-base">
                                    {room?.title || "Video Meeting"}
                                </h1>
                                <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300 sm:inline-flex">
                                    {String(room?.status || "live").toUpperCase()}
                                </span>
                            </div>

                            <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-slate-400">
                                <span className="truncate">
                                    {room?.room_code || `Room #${room?.id || meetingId}`}
                                </span>
                                <span>•</span>
                                <span>{participants.length} participant{participants.length === 1 ? "" : "s"}</span>
                            </div>
                        </div>
                    </div>

                    <div className="hidden items-center gap-2 lg:flex">
                        <button
                            type="button"
                            onClick={copyJoinLink}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                        >
                            {copySuccess ? (
                                <Check className="h-4 w-4 text-emerald-300" />
                            ) : (
                                <Copy className="h-4 w-4" />
                            )}
                            {copySuccess ? "Copied" : "Copy invite link"}
                        </button>

                        <button
                            type="button"
                            onClick={() => setParticipantsOpen((value) => !value)}
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${participantsOpen
                                ? "border-indigo-400/30 bg-indigo-500/15 text-indigo-200"
                                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                                }`}
                        >
                            <Users className="h-4 w-4" />
                            Participants
                        </button>

                        <button
                            type="button"
                            onClick={() => setChatOpen((value) => !value)}
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${chatOpen
                                ? "border-indigo-400/30 bg-indigo-500/15 text-indigo-200"
                                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                                }`}
                        >
                            <MessageCircle className="h-4 w-4" />
                            Chat
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => setSettingsOpen((value) => !value)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 lg:hidden"
                    >
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </header>


            {/* ==================================================
                ERROR BANNER
            ================================================== */}

            {error && room && (
                <div className="mx-4 mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100 md:mx-6">
                    {error}
                </div>
            )}


            {/* ==================================================
                BODY
            ================================================== */}

            <main className="flex-1 p-4 md:p-6">
                <div className="mx-auto flex h-[calc(100vh-150px)] min-h-[520px] max-w-[1800px] gap-4 overflow-hidden">

                    {/* ==================================================
                        VIDEO AREA
                    ================================================== */}

                    <section className="relative min-w-0 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl">

                        <div
                            className={`grid h-full gap-3 p-3 ${visibleRemoteParticipants.length === 0
                                ? "grid-cols-1"
                                : visibleRemoteParticipants.length === 1
                                    ? "grid-cols-1"
                                    : visibleRemoteParticipants.length <= 4
                                        ? "grid-cols-2"
                                        : "grid-cols-2 lg:grid-cols-3"
                                }`}
                        >
                            {/* LOCAL TILE */}
                            <div className="group relative min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
                                {cameraStarted && localCameraEnabled ? (
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
                                        <div className="flex flex-col items-center gap-3 text-center">
                                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-500/20 text-2xl font-bold text-indigo-200 ring-1 ring-indigo-400/20">
                                                {getInitials(currentDisplayName)}
                                            </div>
                                            <p className="text-sm font-semibold text-slate-200">
                                                Camera is off
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="absolute left-3 top-3 flex items-center gap-2">
                                    <span className="rounded-full border border-white/10 bg-slate-950/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                                        You
                                    </span>

                                    {raiseHandEnabled && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-100 backdrop-blur">
                                            <Hand className="h-3.5 w-3.5" />
                                            Hand raised
                                        </span>
                                    )}

                                    {screenSharing && (
                                        <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200 backdrop-blur">
                                            Sharing screen
                                        </span>
                                    )}
                                </div>

                                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                    <span className="max-w-[200px] truncate rounded-full border border-white/10 bg-slate-950/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                                        {currentDisplayName}
                                    </span>

                                    {!localMicEnabled && (
                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white">
                                            <MicOff className="h-3.5 w-3.5" />
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* REMOTE TILES */}
                            {visibleRemoteParticipants.map((participant) => {
                                const userId = normalizeId(participant.user_id);
                                const stream = remoteStreamsRef.current.get(userId);

                                return (
                                    <div
                                        key={userId}
                                        className="group relative min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-900"
                                    >
                                        <video
                                            ref={(node) => {
                                                if (node) {
                                                    remoteVideoRefs.current.set(userId, node);

                                                    if (
                                                        stream &&
                                                        node.srcObject !== stream
                                                    ) {
                                                        node.srcObject = stream;
                                                    }
                                                } else {
                                                    remoteVideoRefs.current.delete(userId);
                                                }
                                            }}
                                            autoPlay
                                            playsInline
                                            className="h-full w-full object-cover"
                                        />

                                        {!participant.camera_enabled && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85">
                                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-xl font-bold text-slate-200">
                                                    {getInitials(participant.display_name)}
                                                </div>
                                            </div>
                                        )}

                                        <div className="absolute left-3 top-3 flex items-center gap-2">
                                            <span className="rounded-full border border-white/10 bg-slate-950/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                                                {participant.display_name}
                                            </span>

                                            {participant.hand_raised && (
                                                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-300/30 bg-amber-500/25 text-amber-100 shadow-lg backdrop-blur" title="Hand raised">
                                                    <Hand className="h-4 w-4" />
                                                </span>
                                            )}
                                        </div>

                                        <div className="absolute bottom-3 right-3 flex items-center gap-2">
                                            {!participant.mic_enabled && (
                                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white">
                                                    <MicOff className="h-3.5 w-3.5" />
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* EMPTY STATE */}
                            {visibleRemoteParticipants.length === 0 && (
                                <div className="pointer-events-none absolute inset-x-0 top-8 flex justify-center px-6">
                                    <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-center text-xs text-slate-300 backdrop-blur">
                                        Waiting for another participant to join...
                                    </div>
                                </div>
                            )}
                        </div>


                        {/* STATUS */}
                        <div className="absolute left-5 top-5 hidden rounded-full border border-white/10 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300 backdrop-blur sm:block">
                            {remoteParticipantCount > 0
                                ? `${remoteParticipantCount} other participant${remoteParticipantCount === 1 ? "" : "s"} connected`
                                : "Private meeting room"}
                        </div>


                        {/* ==================================================
                            LIVE REACTIONS
                        ================================================== */}

                        {floatingReactions.length > 0 && (
                            <div className="pointer-events-none absolute right-4 top-16 z-20 flex max-w-[280px] flex-col items-end gap-2 sm:right-6 sm:top-20">
                                {floatingReactions.map((reaction) => (
                                    <div
                                        key={reaction.id}
                                        className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/80 px-3 py-2 shadow-2xl backdrop-blur-xl"
                                    >
                                        <span className="text-2xl leading-none">{reaction.emoji}</span>
                                        <span className="max-w-[150px] truncate text-xs font-semibold text-white">
                                            {reaction.display_name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}


                        {/* ==================================================
                            BOTTOM CONTROLS
                        ================================================== */}

                        <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-5 pt-10">
                            <div className="flex flex-wrap items-center justify-center gap-2 rounded-3xl border border-white/10 bg-slate-950/85 p-2.5 shadow-2xl backdrop-blur-xl">

                                <button
                                    type="button"
                                    onClick={toggleMic}
                                    className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${localMicEnabled
                                        ? "border-white/10 bg-white/10 text-white hover:bg-white/15"
                                        : "border-red-400/20 bg-red-500/20 text-red-100"
                                        }`}
                                    title={localMicEnabled ? "Mute" : "Unmute"}
                                >
                                    {localMicEnabled ? (
                                        <Mic className="h-5 w-5" />
                                    ) : (
                                        <MicOff className="h-5 w-5" />
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={toggleCamera}
                                    className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${localCameraEnabled
                                        ? "border-white/10 bg-white/10 text-white hover:bg-white/15"
                                        : "border-red-400/20 bg-red-500/20 text-red-100"
                                        }`}
                                    title={localCameraEnabled ? "Turn camera off" : "Turn camera on"}
                                >
                                    {localCameraEnabled ? (
                                        <Video className="h-5 w-5" />
                                    ) : (
                                        <VideoOff className="h-5 w-5" />
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={toggleScreenShare}
                                    className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${screenSharing
                                        ? "border-indigo-400/30 bg-indigo-500/20 text-indigo-200"
                                        : "border-white/10 bg-white/10 text-white hover:bg-white/15"
                                        }`}
                                    title={screenSharing ? "Stop sharing" : "Share screen"}
                                >
                                    {screenSharing ? (
                                        <MonitorOff className="h-5 w-5" />
                                    ) : (
                                        <Monitor className="h-5 w-5" />
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={sendApplause}
                                    className="relative flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 text-white transition hover:bg-white/15"
                                    title="Applause / Support"
                                >
                                    <span className="text-lg leading-none">👏</span>
                                    {applauseCount > 0 && (
                                        <span className="text-[11px] font-bold text-slate-200">
                                            {applauseCount}
                                        </span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={toggleRaiseHand}
                                    className={`flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border px-3 transition ${raiseHandEnabled
                                        ? "border-amber-300/30 bg-amber-500/20 text-amber-100"
                                        : "border-white/10 bg-white/10 text-white hover:bg-white/15"
                                        }`}
                                    title={raiseHandEnabled ? "Lower hand" : "Raise hand"}
                                >
                                    <Hand className="h-5 w-5" />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setChatOpen((value) => !value)}
                                    className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${chatOpen
                                        ? "border-indigo-400/30 bg-indigo-500/20 text-indigo-200"
                                        : "border-white/10 bg-white/10 text-white hover:bg-white/15"
                                        }`}
                                    title="Meeting chat"
                                >
                                    <MessageCircle className="h-5 w-5" />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setParticipantsOpen((value) => !value)}
                                    className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${participantsOpen
                                        ? "border-indigo-400/30 bg-indigo-500/20 text-indigo-200"
                                        : "border-white/10 bg-white/10 text-white hover:bg-white/15"
                                        }`}
                                    title="Participants"
                                >
                                    <Users className="h-5 w-5" />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSettingsOpen((value) => !value)}
                                    className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${settingsOpen
                                        ? "border-indigo-400/30 bg-indigo-500/20 text-indigo-200"
                                        : "border-white/10 bg-white/10 text-white hover:bg-white/15"
                                        }`}
                                    title="Settings"
                                >
                                    <Settings className="h-5 w-5" />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const isHost =
                                            normalizeId(room?.created_by) ===
                                            currentUserId;

                                        if (isHost) {
                                            const shouldEnd = window.confirm(
                                                "Do you want to end this meeting for everyone?"
                                            );

                                            if (shouldEnd) {
                                                leaveMeeting({
                                                    endForEveryone: true,
                                                });
                                            } else {
                                                leaveMeeting({
                                                    endForEveryone: false,
                                                });
                                            }
                                        } else {
                                            leaveMeeting({
                                                endForEveryone: false,
                                            });
                                        }
                                    }}
                                    disabled={endingMeeting}
                                    className="ml-1 flex h-11 items-center gap-2 rounded-full bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {endingMeeting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <PhoneOff className="h-4 w-4" />
                                    )}
                                    <span className="hidden sm:inline">
                                        Leave
                                    </span>
                                </button>
                            </div>
                        </div>
                    </section>


                    {/* ==================================================
                        CHAT SIDEBAR
                    ================================================== */}

                    {chatOpen && (
                        <aside className="hidden w-[360px] shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl xl:flex">
                            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                                <div>
                                    <h2 className="text-sm font-bold">Meeting Chat</h2>
                                    <p className="mt-0.5 text-xs text-slate-400">
                                        {messages.length} message{messages.length === 1 ? "" : "s"}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setChatOpen(false)}
                                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                                {messages.length === 0 ? (
                                    <div className="flex h-full flex-col items-center justify-center px-6 text-center text-slate-400">
                                        <MessageCircle className="mb-3 h-8 w-8 text-slate-600" />
                                        <p className="text-sm font-semibold text-slate-300">
                                            No messages yet
                                        </p>
                                        <p className="mt-1 text-xs leading-5">
                                            Send a message to everyone in this meeting.
                                        </p>
                                    </div>
                                ) : (
                                    messages.map((message) => {
                                        const isMine =
                                            normalizeId(message.sender_id) === currentUserId;

                                        return (
                                            <div
                                                key={message.id}
                                                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                                            >
                                                <div className={`max-w-[86%] ${isMine ? "items-end" : "items-start"}`}>
                                                    {!isMine && (
                                                        <p className="mb-1 px-1 text-[10px] font-semibold text-slate-400">
                                                            {message.sender_name || "Participant"}
                                                        </p>
                                                    )}

                                                    <div
                                                        className={`rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${isMine
                                                            ? "rounded-br-md bg-indigo-600 text-white"
                                                            : "rounded-bl-md bg-white/10 text-slate-100"
                                                            }`}
                                                    >
                                                        {message.message_text}
                                                    </div>

                                                    <div className={`mt-1 flex items-center gap-1 px-1 text-[10px] text-slate-500 ${isMine ? "justify-end" : "justify-start"}`}>
                                                        <span>{formatTime(message.created_at)}</span>
                                                        {isMine && <CheckCheck className="h-3 w-3" />}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="border-t border-white/10 p-3">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                                    <textarea
                                        value={chatMessage}
                                        onChange={(event) => setChatMessage(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === "Enter" &&
                                                !event.shiftKey
                                            ) {
                                                event.preventDefault();
                                                sendChatMessage();
                                            }
                                        }}
                                        rows={2}
                                        placeholder="Type a message..."
                                        className="w-full resize-none bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-slate-500"
                                    />

                                    <div className="mt-2 flex items-center justify-end">
                                        <button
                                            type="button"
                                            onClick={sendChatMessage}
                                            disabled={!chatMessage.trim()}
                                            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <Send className="h-3.5 w-3.5" />
                                            Send
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    )}


                    {/* ==================================================
                        PARTICIPANT SIDEBAR
                    ================================================== */}

                    {participantsOpen && (
                        <aside className="hidden w-[320px] shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl xl:flex">
                            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                                <div>
                                    <h2 className="text-sm font-bold">Participants</h2>
                                    <p className="mt-0.5 text-xs text-slate-400">
                                        {participants.length} connected / room members
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setParticipantsOpen(false)}
                                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                                <div className="space-y-2">
                                    {participants.map((participant) => {
                                        const isMine =
                                            normalizeId(participant.user_id) === currentUserId;

                                        return (
                                            <div
                                                key={normalizeId(participant.user_id)}
                                                className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3"
                                            >
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-sm font-bold text-indigo-200">
                                                    {getInitials(participant.display_name)}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-semibold text-slate-100">
                                                        {participant.display_name || "Participant"}
                                                        {isMine ? " (You)" : ""}
                                                    </p>
                                                    <p className="mt-0.5 text-[11px] text-slate-500">
                                                        {participant.role === "host" ? "Host" : "Participant"}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    {participant.hand_raised && (
                                                        <Hand className="h-3.5 w-3.5 text-amber-300" title="Hand raised" />
                                                    )}

                                                    {participant.mic_enabled !== false ? (
                                                        <Mic className="h-3.5 w-3.5 text-slate-400" />
                                                    ) : (
                                                        <MicOff className="h-3.5 w-3.5 text-red-400" />
                                                    )}

                                                    {participant.camera_enabled !== false ? (
                                                        <Video className="h-3.5 w-3.5 text-slate-400" />
                                                    ) : (
                                                        <VideoOff className="h-3.5 w-3.5 text-red-400" />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </aside>
                    )}
                </div>
            </main>


            {/* ==================================================
                MOBILE UTILITY SHEET
            ================================================== */}

            {settingsOpen && (
                <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-3 backdrop-blur-sm lg:items-center lg:justify-center">
                    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold">Meeting actions</h2>
                                <p className="mt-1 text-xs text-slate-400">
                                    {formatDateTime(room?.scheduled_start)}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSettingsOpen(false)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-5 grid gap-2">
                            <button
                                type="button"
                                onClick={copyJoinLink}
                                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10"
                            >
                                <span className="text-sm font-semibold">Copy meeting link</span>
                                {copySuccess ? (
                                    <Check className="h-4 w-4 text-emerald-300" />
                                ) : (
                                    <Copy className="h-4 w-4 text-slate-400" />
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setSettingsOpen(false);
                                    setParticipantsOpen(true);
                                }}
                                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10"
                            >
                                <span className="text-sm font-semibold">Open participants</span>
                                <Users className="h-4 w-4 text-slate-400" />
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setSettingsOpen(false);
                                    setChatOpen(true);
                                }}
                                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10"
                            >
                                <span className="text-sm font-semibold">Open meeting chat</span>
                                <MessageCircle className="h-4 w-4 text-slate-400" />
                            </button>

                            <div className="mt-2 rounded-2xl border border-indigo-400/10 bg-indigo-500/5 p-4">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-300" />
                                    <div>
                                        <p className="text-sm font-semibold text-indigo-100">
                                            Shared meeting room
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-slate-400">
                                            Participants join the room by meeting ID or room code. The room creator does not have to be the person joining.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


export default CommunicationMeeting;
