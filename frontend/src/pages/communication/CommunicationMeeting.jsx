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

const ICE_SERVERS = [
    {
        urls: "stun:stun.l.google.com:19302",
    },
    {
        urls: "stun:stun1.l.google.com:19302",
    },
];

const getInitials = (name) => {
    const value = String(name || "").trim();

    if (!value) {
        return "P";
    }

    const parts = value
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 1) {
        return parts[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return `${parts[0][0] || ""}${
        parts[parts.length - 1][0] || ""
    }`.toUpperCase();
};

const normalizeId = (value) => {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value).trim();
};

const makeRoomChannelName = (roomId) =>
    `video-meeting-${normalizeId(roomId)}`;

const isValidRoomId = (value) =>
    String(value || "").trim().length > 0;

const formatTime = (value) => {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatDateTime = (value) => {
    if (!value) {
        return "No scheduled time";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "No scheduled time";
    }

    return date.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
    });
};

const extractPresenceUsers = (
    presenceState
) => {
    const users = [];

    Object.entries(
        presenceState || {}
    ).forEach(
        ([key, entries]) => {
            const list = Array.isArray(entries)
                ? entries
                : [];

            list.forEach((entry) => {
                const userId = normalizeId(
                    entry?.user_id || key
                );

                if (!userId) {
                    return;
                }

                users.push({
                    ...entry,
                    user_id: userId,
                });
            });
        }
    );

    const seen = new Set();

    return users.filter((user) => {
        const userId = normalizeId(
            user.user_id
        );

        if (!userId) {
            return false;
        }

        if (seen.has(userId)) {
            return false;
        }

        seen.add(userId);

        return true;
    });
};

const getErrorMessage = (
    error,
    fallback
) => {
    if (error?.message) {
        return error.message;
    }

    if (error?.details) {
        return error.details;
    }

    if (error?.hint) {
        return error.hint;
    }

    return fallback;
};

const CommunicationMeeting = () => {
    const navigate = useNavigate();
    const { meetingId } = useParams();

    const localVideoRef =
        useRef(null);

    const localStreamRef =
        useRef(null);

    const screenStreamRef =
        useRef(null);

    const screenSharingRef =
        useRef(false);

    const channelRef =
        useRef(null);

    const peerConnectionsRef =
        useRef(new Map());

    const remoteStreamsRef =
        useRef(new Map());

    const remoteVideoRefs =
        useRef(new Map());

    const pendingIceCandidatesRef =
        useRef(new Map());

    const reactionTimersRef =
        useRef(new Map());

    const localParticipantJoinedAt =
        useRef(null);

    const mountedRef =
        useRef(false);

    /*
     * IMPORTANT:
     * A generation token prevents an old async initialization
     * from creating a new channel or peer after React cleanup.
     */
    const initializationGenerationRef =
        useRef(0);

    const processedOffersRef =
        useRef(new Set());

    const processedAnswersRef =
        useRef(new Set());

    const processedIceRef =
        useRef(new Set());

    const currentUserIdRef =
        useRef("");

    const currentDisplayNameRef =
        useRef("Participant");

    const roomRef =
        useRef(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [room, setRoom] =
        useState(null);

    const [currentUser, setCurrentUser] =
        useState(null);

    const [profile, setProfile] =
        useState(null);

    const [participants, setParticipants] =
        useState([]);

    const [localMicEnabled, setLocalMicEnabled] =
        useState(true);

    const [
        localCameraEnabled,
        setLocalCameraEnabled,
    ] = useState(true);

    const [cameraStarted, setCameraStarted] =
        useState(false);

    const [screenSharing, setScreenSharing] =
        useState(false);

    const [chatOpen, setChatOpen] =
        useState(false);

    const [
        participantsOpen,
        setParticipantsOpen,
    ] = useState(false);

    const [settingsOpen, setSettingsOpen] =
        useState(false);

    const [
        raiseHandEnabled,
        setRaiseHandEnabled,
    ] = useState(false);

    const [applauseCount, setApplauseCount] =
        useState(0);

    const [
        floatingReactions,
        setFloatingReactions,
    ] = useState([]);

    const [messages, setMessages] =
        useState([]);

    const [chatMessage, setChatMessage] =
        useState("");

    const [copySuccess, setCopySuccess] =
        useState(false);

    const [
        endingMeeting,
        setEndingMeeting,
    ] = useState(false);

    const [
        remoteStreamVersion,
        setRemoteStreamVersion,
    ] = useState(0);

    const currentUserId = useMemo(
        () =>
            normalizeId(
                currentUser?.id
            ),
        [currentUser]
    );

    const currentDisplayName = useMemo(
        () =>
            profile?.full_name ||
            currentUser?.email ||
            "Participant",
        [profile, currentUser]
    );

    const joinLink = useMemo(
        () =>
            typeof window !==
            "undefined"
                ? `${window.location.origin}/communication/meetings/${meetingId}`
                : "",
        [meetingId]
    );

    const remoteParticipantCount =
        useMemo(
            () =>
                participants.filter(
                    (participant) =>
                        normalizeId(
                            participant.user_id
                        ) !== currentUserId
                ).length,
            [participants, currentUserId]
        );

    useEffect(() => {
        currentUserIdRef.current =
            currentUserId;
    }, [currentUserId]);

    useEffect(() => {
        currentDisplayNameRef.current =
            currentDisplayName;
    }, [currentDisplayName]);

    useEffect(() => {
        roomRef.current = room;
    }, [room]);

    useEffect(() => {
        screenSharingRef.current =
            screenSharing;
    }, [screenSharing]);

    /*
     * ============================================================
     * STOP MEDIA
     * ============================================================
     */

    const stopAllMedia = useCallback(
        () => {
            if (localStreamRef.current) {
                localStreamRef.current
                    .getTracks()
                    .forEach((track) => {
                        try {
                            track.stop();
                        } catch {}
                    });
            }

            if (screenStreamRef.current) {
                screenStreamRef.current
                    .getTracks()
                    .forEach((track) => {
                        try {
                            track.stop();
                        } catch {}
                    });
            }

            localStreamRef.current = null;
            screenStreamRef.current = null;
            screenSharingRef.current = false;

            if (mountedRef.current) {
                setCameraStarted(false);
                setScreenSharing(false);
            }

            if (localVideoRef.current) {
                try {
                    localVideoRef.current.srcObject =
                        null;
                } catch {}
            }
        },
        []
    );

    /*
     * ============================================================
     * CLOSE ONE PEER
     * ============================================================
     */

    const closePeerConnection =
        useCallback(
            (remoteUserId) => {
                const userId =
                    normalizeId(
                        remoteUserId
                    );

                if (!userId) {
                    return;
                }

                const peer =
                    peerConnectionsRef.current.get(
                        userId
                    );

                if (peer) {
                    try {
                        peer.ontrack = null;
                        peer.onicecandidate = null;
                        peer.onconnectionstatechange =
                            null;
                        peer.oniceconnectionstatechange =
                            null;
                        peer.onnegotiationneeded =
                            null;
                        peer.close();
                    } catch {}
                }

                peerConnectionsRef.current.delete(
                    userId
                );

                remoteStreamsRef.current.delete(
                    userId
                );

                remoteVideoRefs.current.delete(
                    userId
                );

                pendingIceCandidatesRef.current.delete(
                    userId
                );

                if (mountedRef.current) {
                    setRemoteStreamVersion(
                        (value) =>
                            value + 1
                    );
                }
            },
            []
        );

    /*
     * ============================================================
     * CLOSE ALL PEERS
     * ============================================================
     */

    const closeAllPeerConnections =
        useCallback(() => {
            peerConnectionsRef.current.forEach(
                (peer) => {
                    try {
                        peer.ontrack = null;
                        peer.onicecandidate = null;
                        peer.onconnectionstatechange =
                            null;
                        peer.oniceconnectionstatechange =
                            null;
                        peer.onnegotiationneeded =
                            null;
                        peer.close();
                    } catch {}
                }
            );

            peerConnectionsRef.current.clear();
            remoteStreamsRef.current.clear();
            remoteVideoRefs.current.clear();
            pendingIceCandidatesRef.current.clear();

            if (mountedRef.current) {
                setRemoteStreamVersion(
                    (value) =>
                        value + 1
                );
            }
        }, []);

    /*
     * ============================================================
     * PRESENCE
     * ============================================================
     */

    const updateParticipantPresence =
        useCallback(
            (presenceState) => {
                const users =
                    extractPresenceUsers(
                        presenceState
                    );

                setParticipants(
                    (current) => {
                        const existingMap =
                            new Map(
                                current.map(
                                    (
                                        participant
                                    ) => [
                                        normalizeId(
                                            participant.user_id
                                        ),
                                        participant,
                                    ]
                                )
                            );

                        return users.map(
                            (user) => {
                                const userId =
                                    normalizeId(
                                        user.user_id
                                    );

                                const existing =
                                    existingMap.get(
                                        userId
                                    );

                                return {
                                    ...(existing ||
                                        {}),
                                    ...user,
                                    user_id:
                                        userId,
                                    display_name:
                                        user.display_name ||
                                        existing?.display_name ||
                                        "Participant",
                                    joined_at:
                                        user.joined_at ||
                                        existing?.joined_at ||
                                        null,
                                    role:
                                        user.role ||
                                        existing?.role ||
                                        "participant",
                                    status:
                                        "joined",
                                    hand_raised:
                                        user.hand_raised ??
                                        existing?.hand_raised ??
                                        false,
                                    mic_enabled:
                                        user.mic_enabled ??
                                        existing?.mic_enabled ??
                                        true,
                                    camera_enabled:
                                        user.camera_enabled ??
                                        existing?.camera_enabled ??
                                        true,
                                };
                            }
                        );
                    }
                );
            },
            []
        );

    /*
     * ============================================================
     * ICE QUEUE
     * ============================================================
     */

    const flushPendingIceCandidates =
        useCallback(
            async (
                remoteUserId,
                peer
            ) => {
                const userId =
                    normalizeId(
                        remoteUserId
                    );

                if (
                    !userId ||
                    !peer?.remoteDescription
                ) {
                    return;
                }

                const queued =
                    pendingIceCandidatesRef.current.get(
                        userId
                    ) || [];

                if (!queued.length) {
                    return;
                }

                pendingIceCandidatesRef.current.delete(
                    userId
                );

                for (
                    const candidate of queued
                ) {
                    try {
                        await peer.addIceCandidate(
                            new RTCIceCandidate(
                                candidate
                            )
                        );
                    } catch (
                        iceError
                    ) {
                        console.warn(
                            "Unable to apply queued ICE candidate:",
                            iceError
                        );
                    }
                }
            },
            []
        );

    /*
     * ============================================================
     * REALTIME SEND
     * ============================================================
     */

    const sendRealtime =
        useCallback(
            async (
                event,
                payload
            ) => {
                const channel =
                    channelRef.current;

                if (!channel) {
                    return false;
                }

                try {
                    await channel.send({
                        type: "broadcast",
                        event,
                        payload,
                    });

                    return true;
                } catch (
                    realtimeError
                ) {
                    console.warn(
                        `Realtime ${event} send failed:`,
                        realtimeError
                    );

                    return false;
                }
            },
            []
        );

    /*
     * ============================================================
     * CREATE PEER CONNECTION
     * ============================================================
     */

    const createPeerConnection =
        useCallback(
            async (
                remoteUserId,
                shouldCreateOffer = false
            ) => {
                const userId =
                    normalizeId(
                        remoteUserId
                    );

                const localUserId =
                    currentUserIdRef.current;

                if (
                    !userId ||
                    !localUserId ||
                    userId === localUserId
                ) {
                    return null;
                }

                const localStream =
                    localStreamRef.current;

                if (!localStream) {
                    throw new Error(
                        "Local media is not ready."
                    );
                }

                /*
                 * IMPORTANT:
                 * Never renegotiate just because another presence
                 * event asks for an offer. One peer must own the
                 * initial offer. The caller already uses the
                 * deterministic smaller-user-ID rule.
                 */
                const existingPeer =
                    peerConnectionsRef.current.get(
                        userId
                    );

                if (existingPeer) {
                    return existingPeer;
                }

                const peer =
                    new RTCPeerConnection({
                        iceServers:
                            ICE_SERVERS,
                    });

                peerConnectionsRef.current.set(
                    userId,
                    peer
                );

                localStream
                    .getTracks()
                    .forEach((track) => {
                        try {
                            peer.addTrack(
                                track,
                                localStream
                            );
                        } catch (
                            trackError
                        ) {
                            console.warn(
                                "Unable to add local track:",
                                trackError
                            );
                        }
                    });

                peer.ontrack = (
                    event
                ) => {
                    /*
                     * Ignore callbacks from an obsolete peer.
                     */
                    if (
                        peerConnectionsRef.current.get(
                            userId
                        ) !== peer
                    ) {
                        return;
                    }

                    const incomingStream =
                        event.streams?.[0] ||
                        remoteStreamsRef.current.get(
                            userId
                        );

                    if (!incomingStream) {
                        return;
                    }

                    remoteStreamsRef.current.set(
                        userId,
                        incomingStream
                    );

                    if (mountedRef.current) {
                        setRemoteStreamVersion(
                            (value) =>
                                value + 1
                        );
                    }

                    const element =
                        remoteVideoRefs.current.get(
                            userId
                        );

                    if (
                        element &&
                        element.srcObject !==
                            incomingStream
                    ) {
                        try {
                            element.srcObject =
                                incomingStream;

                            element
                                .play?.()
                                .catch(
                                    () => null
                                );
                        } catch {}
                    }
                };

                peer.onicecandidate =
                    async (event) => {
                        if (
                            !event.candidate
                        ) {
                            return;
                        }

                        /*
                         * Do not send ICE from an obsolete peer.
                         */
                        if (
                            peerConnectionsRef.current.get(
                                userId
                            ) !== peer
                        ) {
                            return;
                        }

                        await sendRealtime(
                            "webrtc-ice",
                            {
                                from:
                                    localUserId,
                                to: userId,
                                candidate:
                                    event.candidate,
                            }
                        );
                    };

                /*
                 * IMPORTANT:
                 *
                 * "disconnected" is transient.
                 * Do NOT close the peer here.
                 */
                peer.onconnectionstatechange =
                    () => {
                        /*
                         * This callback may belong to an old peer.
                         */
                        if (
                            peerConnectionsRef.current.get(
                                userId
                            ) !== peer
                        ) {
                            return;
                        }

                        const state =
                            peer.connectionState;

                        if (
                            state ===
                                "failed" ||
                            state ===
                                "closed"
                        ) {
                            closePeerConnection(
                                userId
                            );
                        }
                    };

                /*
                 * ICE "disconnected" is also transient.
                 * Only "failed" requires cleanup.
                 */
                peer.oniceconnectionstatechange =
                    () => {
                        if (
                            peerConnectionsRef.current.get(
                                userId
                            ) !== peer
                        ) {
                            return;
                        }

                        const state =
                            peer.iceConnectionState;

                        if (
                            state ===
                            "failed"
                        ) {
                            closePeerConnection(
                                userId
                            );
                        }
                    };

                if (
                    shouldCreateOffer
                ) {
                    try {
                        /*
                         * Only the deterministic offer owner should
                         * normally reach this branch.
                         */
                        if (
                            localUserId >=
                            userId
                        ) {
                            return peer;
                        }

                        const offer =
                            await peer.createOffer();

                        /*
                         * Peer could have been replaced while
                         * createOffer() was running.
                         */
                        if (
                            peerConnectionsRef.current.get(
                                userId
                            ) !== peer
                        ) {
                            return null;
                        }

                        await peer.setLocalDescription(
                            offer
                        );

                        if (
                            peerConnectionsRef.current.get(
                                userId
                            ) !== peer
                        ) {
                            return null;
                        }

                        await sendRealtime(
                            "webrtc-offer",
                            {
                                from:
                                    localUserId,
                                to: userId,
                                offer,
                            }
                        );
                    } catch (
                        offerError
                    ) {
                        console.warn(
                            "Initial WebRTC offer failed:",
                            offerError
                        );

                        if (
                            peerConnectionsRef.current.get(
                                userId
                            ) === peer
                        ) {
                            closePeerConnection(
                                userId
                            );
                        }

                        throw offerError;
                    }
                }

                return peer;
            },
            [
                sendRealtime,
                closePeerConnection,
            ]
        );

    /*
     * ============================================================
     * HANDLE OFFER
     * ============================================================
     */

    const handleOffer =
        useCallback(
            async (payload) => {
                const from =
                    normalizeId(
                        payload?.from ||
                            payload?.user_id
                    );

                const to =
                    normalizeId(
                        payload?.to
                    );

                const localUserId =
                    currentUserIdRef.current;

                const offer =
                    payload?.offer;

                if (
                    !from ||
                    !to ||
                    !offer ||
                    to !== localUserId ||
                    from === localUserId
                ) {
                    return;
                }

                const dedupKey =
                    `${from}:${offer?.sdp || ""}`;

                if (
                    processedOffersRef.current.has(
                        dedupKey
                    )
                ) {
                    return;
                }

                processedOffersRef.current.add(
                    dedupKey
                );

                let peer =
                    peerConnectionsRef.current.get(
                        from
                    );

                if (!peer) {
                    peer =
                        await createPeerConnection(
                            from,
                            false
                        );
                }

                if (!peer) {
                    return;
                }

                if (
                    peerConnectionsRef.current.get(
                        from
                    ) !== peer
                ) {
                    return;
                }

                /*
                 * Perfect-negotiation style collision handling.
                 *
                 * Smaller ID is the deterministic offer owner.
                 * The larger ID is polite and may rollback its
                 * own local offer when a collision occurs.
                 */
                if (
                    peer.signalingState ===
                    "have-local-offer"
                ) {
                    const polite =
                        localUserId >
                        from;

                    if (!polite) {
                        return;
                    }

                    try {
                        await peer.setLocalDescription(
                            {
                                type:
                                    "rollback",
                            }
                        );
                    } catch (
                        rollbackError
                    ) {
                        console.warn(
                            "WebRTC offer collision rollback failed:",
                            rollbackError
                        );

                        return;
                    }
                }

                if (
                    peer.signalingState !==
                    "stable"
                ) {
                    return;
                }

                try {
                    await peer.setRemoteDescription(
                        new RTCSessionDescription(
                            offer
                        )
                    );

                    if (
                        peerConnectionsRef.current.get(
                            from
                        ) !== peer
                    ) {
                        return;
                    }

                    await flushPendingIceCandidates(
                        from,
                        peer
                    );

                    const answer =
                        await peer.createAnswer();

                    await peer.setLocalDescription(
                        answer
                    );

                    if (
                        peerConnectionsRef.current.get(
                            from
                        ) !== peer
                    ) {
                        return;
                    }

                    await sendRealtime(
                        "webrtc-answer",
                        {
                            from:
                                localUserId,
                            to: from,
                            answer,
                        }
                    );
                } catch (
                    offerError
                ) {
                    console.warn(
                        "WebRTC offer handling failed:",
                        offerError
                    );
                }
            },
            [
                createPeerConnection,
                flushPendingIceCandidates,
                sendRealtime,
            ]
        );

    /*
     * ============================================================
     * HANDLE ANSWER
     * ============================================================
     */

    const handleAnswer =
        useCallback(
            async (payload) => {
                const from =
                    normalizeId(
                        payload?.from
                    );

                const to =
                    normalizeId(
                        payload?.to
                    );

                const localUserId =
                    currentUserIdRef.current;

                const answer =
                    payload?.answer;

                if (
                    !from ||
                    !to ||
                    !answer ||
                    to !== localUserId ||
                    from === localUserId
                ) {
                    return;
                }

                const dedupKey =
                    `${from}:${answer?.sdp || ""}`;

                if (
                    processedAnswersRef.current.has(
                        dedupKey
                    )
                ) {
                    return;
                }

                processedAnswersRef.current.add(
                    dedupKey
                );

                const peer =
                    peerConnectionsRef.current.get(
                        from
                    );

                if (!peer) {
                    return;
                }

                if (
                    peer.signalingState !==
                    "have-local-offer"
                ) {
                    return;
                }

                try {
                    await peer.setRemoteDescription(
                        new RTCSessionDescription(
                            answer
                        )
                    );

                    await flushPendingIceCandidates(
                        from,
                        peer
                    );
                } catch (
                    answerError
                ) {
                    console.warn(
                        "WebRTC answer handling failed:",
                        answerError
                    );
                }
            },
            [
                flushPendingIceCandidates,
            ]
        );

    /*
     * ============================================================
     * HANDLE ICE
     * ============================================================
     */

    const handleIceCandidate =
        useCallback(
            async (payload) => {
                const from =
                    normalizeId(
                        payload?.from
                    );

                const to =
                    normalizeId(
                        payload?.to
                    );

                const localUserId =
                    currentUserIdRef.current;

                const candidate =
                    payload?.candidate;

                if (
                    !from ||
                    !to ||
                    !candidate ||
                    to !== localUserId ||
                    from === localUserId
                ) {
                    return;
                }

                const candidateKey =
                    `${from}:${candidate.candidate || ""}:${candidate.sdpMid || ""}:${candidate.sdpMLineIndex ?? ""}`;

                if (
                    processedIceRef.current.has(
                        candidateKey
                    )
                ) {
                    return;
                }

                processedIceRef.current.add(
                    candidateKey
                );

                const peer =
                    peerConnectionsRef.current.get(
                        from
                    );

                if (
                    !peer ||
                    !peer.remoteDescription
                ) {
                    const queue =
                        pendingIceCandidatesRef.current.get(
                            from
                        ) || [];

                    queue.push(candidate);

                    pendingIceCandidatesRef.current.set(
                        from,
                        queue
                    );

                    return;
                }

                try {
                    await peer.addIceCandidate(
                        new RTCIceCandidate(
                            candidate
                        )
                    );
                } catch (
                    iceError
                ) {
                    console.warn(
                        "Unable to add ICE candidate:",
                        iceError
                    );
                }
            },
            []
        );

    /*
     * ============================================================
     * REACTIONS
     * ============================================================
     */

    const showFloatingReaction =
        useCallback(
            (
                emoji,
                displayName
            ) => {
                const id =
                    `${Date.now()}-${Math.random()
                        .toString(36)
                        .slice(2, 8)}`;

                setFloatingReactions(
                    (current) => [
                        ...current,
                        {
                            id,
                            emoji,
                            display_name:
                                displayName ||
                                "Participant",
                        },
                    ]
                );

                const timer =
                    window.setTimeout(
                        () => {
                            if (
                                mountedRef.current
                            ) {
                                setFloatingReactions(
                                    (
                                        current
                                    ) =>
                                        current.filter(
                                            (
                                                item
                                            ) =>
                                                item.id !==
                                                id
                                        )
                                );
                            }

                            reactionTimersRef.current.delete(
                                id
                            );
                        },
                        1800
                    );

                reactionTimersRef.current.set(
                    id,
                    timer
                );
            },
            []
        );

    const handleRemoteReaction =
        useCallback(
            (payload) => {
                if (
                    !payload?.type
                ) {
                    return;
                }

                const from =
                    normalizeId(
                        payload.user_id ||
                            payload.from
                    );

                const localUserId =
                    currentUserIdRef.current;

                if (
                    !from ||
                    from === localUserId
                ) {
                    return;
                }

                const displayName =
                    payload.display_name ||
                    "Participant";

                if (
                    payload.type ===
                    "applause"
                ) {
                    setApplauseCount(
                        (value) =>
                            value + 1
                    );

                    showFloatingReaction(
                        "ðŸ‘",
                        displayName
                    );

                    return;
                }

                if (
                    payload.type ===
                    "raise_hand"
                ) {
                    const raised =
                        Boolean(
                            payload.enabled
                        );

                    setParticipants(
                        (current) =>
                            current.map(
                                (
                                    participant
                                ) =>
                                    normalizeId(
                                        participant.user_id
                                    ) === from
                                        ? {
                                              ...participant,
                                              hand_raised:
                                                  raised,
                                          }
                                        : participant
                            )
                    );

                    if (raised) {
                        showFloatingReaction(
                            "âœ‹",
                            displayName
                        );
                    }
                }
            },
            [
                showFloatingReaction,
            ]
        );

    /*
     * ============================================================
     * RAISE HAND
     * ============================================================
     */

    const toggleRaiseHand =
        useCallback(
            async () => {
                const localUserId =
                    currentUserIdRef.current;

                const channel =
                    channelRef.current;

                if (
                    !localUserId ||
                    !channel
                ) {
                    return;
                }

                const nextRaised =
                    !raiseHandEnabled;

                setRaiseHandEnabled(
                    nextRaised
                );

                setParticipants(
                    (current) =>
                        current.map(
                            (
                                participant
                            ) =>
                                normalizeId(
                                    participant.user_id
                                ) ===
                                localUserId
                                    ? {
                                          ...participant,
                                          hand_raised:
                                              nextRaised,
                                      }
                                    : participant
                        )
                );

                try {
                    await channel.track({
                        user_id:
                            localUserId,
                        display_name:
                            currentDisplayNameRef.current,
                        joined_at:
                            localParticipantJoinedAt.current ||
                            new Date().toISOString(),
                        mic_enabled:
                            localStreamRef.current
                                ?.getAudioTracks?.()[0]
                                ?.enabled !== false,
                        camera_enabled:
                            localStreamRef.current
                                ?.getVideoTracks?.()[0]
                                ?.enabled !== false,
                        hand_raised:
                            nextRaised,
                        role:
                            normalizeId(
                                roomRef.current
                                    ?.created_by
                            ) ===
                            localUserId
                                ? "host"
                                : "participant",
                    });
                } catch (
                    presenceError
                ) {
                    console.warn(
                        "Unable to update raised hand presence:",
                        presenceError
                    );
                }

                await sendRealtime(
                    "meeting-reaction",
                    {
                        type:
                            "raise_hand",
                        user_id:
                            localUserId,
                        display_name:
                            currentDisplayNameRef.current,
                        enabled:
                            nextRaised,
                    }
                );

                if (
                    nextRaised
                ) {
                    showFloatingReaction(
                        "âœ‹",
                        currentDisplayNameRef.current
                    );
                }
            },
            [
                raiseHandEnabled,
                sendRealtime,
                showFloatingReaction,
            ]
        );

    /*
     * ============================================================
     * APPLAUSE
     * ============================================================
     */

    const sendApplause =
        useCallback(
            async () => {
                const localUserId =
                    currentUserIdRef.current;

                if (!localUserId) {
                    return;
                }

                setApplauseCount(
                    (value) =>
                        value + 1
                );

                showFloatingReaction(
                    "ðŸ‘",
                    currentDisplayNameRef.current
                );

                await sendRealtime(
                    "meeting-reaction",
                    {
                        type:
                            "applause",
                        user_id:
                            localUserId,
                        display_name:
                            currentDisplayNameRef.current,
                    }
                );
            },
            [
                sendRealtime,
                showFloatingReaction,
            ]
        );

    /*
     * ============================================================
     * REMOTE LEAVE
     * ============================================================
     */

    const handleRemoteLeave =
        useCallback(
            (payload) => {
                const userId =
                    normalizeId(
                        payload?.user_id ||
                            payload?.from
                    );

                if (!userId) {
                    return;
                }

                closePeerConnection(
                    userId
                );

                setParticipants(
                    (current) =>
                        current.filter(
                            (
                                participant
                            ) =>
                                normalizeId(
                                    participant.user_id
                                ) !== userId
                        )
                );
            },
            [
                closePeerConnection,
            ]
        );

    /*
     * ============================================================
     * REMOTE MEDIA STATE
     * ============================================================
     */

    const handleRemoteMediaState =
        useCallback(
            (payload) => {
                if (
                    !payload?.user_id
                ) {
                    return;
                }

                setParticipants(
                    (current) =>
                        current.map(
                            (
                                participant
                            ) =>
                                normalizeId(
                                    participant.user_id
                                ) ===
                                normalizeId(
                                    payload.user_id
                                )
                                    ? {
                                          ...participant,
                                          mic_enabled:
                                              payload.mic_enabled ??
                                              participant.mic_enabled,
                                          camera_enabled:
                                              payload.camera_enabled ??
                                              participant.camera_enabled,
                                      }
                                    : participant
                        )
                );
            },
            []
        );

    /*
     * ============================================================
     * REMOTE CHAT
     * ============================================================
     */

    const handleRemoteChat =
        useCallback(
            (payload) => {
                if (
                    !payload?.id ||
                    !payload?.sender_id
                ) {
                    return;
                }

                setMessages(
                    (current) => {
                        if (
                            current.some(
                                (item) =>
                                    item.id ===
                                    payload.id
                            )
                        ) {
                            return current;
                        }

                        return [
                            ...current,
                            {
                                id:
                                    payload.id,
                                sender_id:
                                    normalizeId(
                                        payload.sender_id
                                    ),
                                sender_name:
                                    payload.sender_name ||
                                    "Participant",
                                message_text:
                                    payload.message_text ||
                                    "",
                                created_at:
                                    payload.created_at ||
                                    new Date().toISOString(),
                            },
                        ];
                    }
                );
            },
            []
        );

    /*
     * ============================================================
     * BROADCAST HANDLER
     * ============================================================
     */

    const handleBroadcast =
        useCallback(
            async ({
                event,
                payload,
            }) => {
                if (!payload) {
                    return;
                }

                switch (event) {
                    case "webrtc-offer":
                        await handleOffer(
                            payload
                        );
                        break;

                    case "webrtc-answer":
                        await handleAnswer(
                            payload
                        );
                        break;

                    case "webrtc-ice":
                        await handleIceCandidate(
                            payload
                        );
                        break;

                    case "participant-left":
                        handleRemoteLeave(
                            payload
                        );
                        break;

                    case "media-state":
                        handleRemoteMediaState(
                            payload
                        );
                        break;

                    case "chat-message":
                        handleRemoteChat(
                            payload
                        );
                        break;

                    case "meeting-reaction":
                        handleRemoteReaction(
                            payload
                        );
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

    /*
     * ============================================================
     * START LOCAL MEDIA
     * ============================================================
     */

    const startLocalMedia =
        useCallback(
            async (
                generation
            ) => {
                if (
                    localStreamRef.current
                ) {
                    if (
                        mountedRef.current &&
                        initializationGenerationRef.current ===
                            generation
                    ) {
                        setCameraStarted(
                            true
                        );
                    }

                    return localStreamRef.current;
                }

                if (
                    !navigator.mediaDevices
                        ?.getUserMedia
                ) {
                    throw new Error(
                        "Camera and microphone are not supported by this browser."
                    );
                }

                const stream =
                    await navigator.mediaDevices.getUserMedia(
                        {
                            audio: true,
                            video: {
                                width: {
                                    ideal: 1280,
                                },
                                height: {
                                    ideal: 720,
                                },
                                facingMode:
                                    "user",
                            },
                        }
                    );

                /*
                 * The permission dialog may take a long time.
                 * If the component was already cleaned up while
                 * waiting, immediately stop this stale stream.
                 */
                if (
                    !mountedRef.current ||
                    initializationGenerationRef.current !==
                        generation
                ) {
                    stream
                        .getTracks()
                        .forEach(
                            (track) => {
                                try {
                                    track.stop();
                                } catch {}
                            }
                        );

                    return null;
                }

                localStreamRef.current =
                    stream;

                const audioTrack =
                    stream.getAudioTracks()[0];

                const videoTrack =
                    stream.getVideoTracks()[0];

                setLocalMicEnabled(
                    audioTrack
                        ? audioTrack.enabled !==
                              false
                        : false
                );

                setLocalCameraEnabled(
                    videoTrack
                        ? videoTrack.enabled !==
                              false
                        : false
                );

                setCameraStarted(
                    true
                );

                /*
                 * Do not depend on the video element existing here.
                 * The dedicated local-video effect below handles it
                 * after React renders the self-view.
                 */

                return stream;
            },
            []
        );

    /*
     * ============================================================
     * LOCAL VIDEO ATTACHMENT
     *
     * IMPORTANT FIX:
     *
     * The video element remains mounted all the time.
     * We only change its visibility using opacity.
     *
     * This prevents React from destroying/recreating the video
     * element when the camera is toggled.
     * ============================================================
     */

    useEffect(() => {
        const video =
            localVideoRef.current;

        if (!video) {
            return;
        }

        const stream =
            screenSharing &&
            screenStreamRef.current
                ? screenStreamRef.current
                : localStreamRef.current;

        if (!stream) {
            video.srcObject = null;
            return;
        }

        if (
            video.srcObject !==
            stream
        ) {
            video.srcObject =
                stream;
        }

        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;

        video.play?.().catch(
            () => null
        );
    }, [screenSharing]);

    /*
     * ============================================================
     * BROADCAST MEDIA STATE
     * ============================================================
     */

    const broadcastMediaState =
        useCallback(
            async (
                overrides = {}
            ) => {
                await sendRealtime(
                    "media-state",
                    {
                        user_id:
                            currentUserIdRef.current,

                        mic_enabled:
                            overrides.mic_enabled ??
                            localStreamRef.current
                                ?.getAudioTracks?.()[0]
                                ?.enabled ??
                            localMicEnabled,

                        camera_enabled:
                            overrides.camera_enabled ??
                            localStreamRef.current
                                ?.getVideoTracks?.()[0]
                                ?.enabled ??
                            localCameraEnabled,
                    }
                );
            },
            [
                localMicEnabled,
                localCameraEnabled,
                sendRealtime,
            ]
        );

    /*
     * ============================================================
     * TOGGLE MIC
     * ============================================================
     */

    const toggleMic =
        useCallback(
            async () => {
                const track =
                    localStreamRef.current
                        ?.getAudioTracks?.()[0];

                if (!track) {
                    return;
                }

                const nextEnabled =
                    !track.enabled;

                track.enabled =
                    nextEnabled;

                setLocalMicEnabled(
                    nextEnabled
                );

                await broadcastMediaState({
                    mic_enabled:
                        nextEnabled,
                });
            },
            [
                broadcastMediaState,
            ]
        );

    /*
     * ============================================================
     * TOGGLE CAMERA
     * ============================================================
     */

    const toggleCamera =
        useCallback(
            async () => {
                const track =
                    localStreamRef.current
                        ?.getVideoTracks?.()[0];

                if (!track) {
                    return;
                }

                const nextEnabled =
                    !track.enabled;

                track.enabled =
                    nextEnabled;

                setLocalCameraEnabled(
                    nextEnabled
                );

                await broadcastMediaState({
                    camera_enabled:
                        nextEnabled,
                });

                /*
                 * Do NOT manually replace the local video stream
                 * here while screen sharing. The local-video effect
                 * owns which stream is displayed.
                 */
            },
            [
                broadcastMediaState,
            ]
        );

    /*
     * ============================================================
     * SCREEN SHARE
     * ============================================================
     */

    const toggleScreenShare =
        useCallback(
            async () => {
                if (
                    !localStreamRef.current
                ) {
                    return;
                }

                /*
                 * IMPORTANT:
                 * Read from ref instead of captured React state.
                 *
                 * This makes browser's screenTrack.onended callback
                 * reliable even when the callback was created while
                 * screenSharing had a different value.
                 */
                if (
                    screenSharingRef.current
                ) {
                    const cameraTrack =
                        localStreamRef.current
                            .getVideoTracks?.()[0];

                    if (
                        cameraTrack
                    ) {
                        peerConnectionsRef.current.forEach(
                            (peer) => {
                                const sender =
                                    peer
                                        .getSenders?.()
                                        ?.find(
                                            (
                                                item
                                            ) =>
                                                item.track
                                                    ?.kind ===
                                                "video"
                                        );

                                if (
                                    sender
                                ) {
                                    sender
                                        .replaceTrack(
                                            cameraTrack
                                        )
                                        .catch(
                                            () =>
                                                null
                                        );
                                }
                            }
                        );
                    }

                    if (
                        screenStreamRef.current
                    ) {
                        screenStreamRef.current
                            .getTracks()
                            .forEach(
                                (track) => {
                                    try {
                                        track.stop();
                                    } catch {}
                                }
                            );
                    }

                    screenStreamRef.current =
                        null;

                    screenSharingRef.current =
                        false;

                    setScreenSharing(
                        false
                    );

                    /*
                     * The local-video effect restores the camera
                     * stream automatically.
                     */
                    return;
                }

                if (
                    !navigator.mediaDevices
                        ?.getDisplayMedia
                ) {
                    setError(
                        "Screen sharing is not supported by this browser."
                    );

                    return;
                }

                try {
                    const screenStream =
                        await navigator.mediaDevices.getDisplayMedia(
                            {
                                video: true,
                                audio: false,
                            }
                        );

                    /*
                     * User may have left the meeting while the
                     * browser was waiting for screen-share selection.
                     */
                    if (
                        !mountedRef.current
                    ) {
                        screenStream
                            .getTracks()
                            .forEach(
                                (track) => {
                                    try {
                                        track.stop();
                                    } catch {}
                                }
                            );

                        return;
                    }

                    const screenTrack =
                        screenStream.getVideoTracks()[0];

                    if (
                        !screenTrack
                    ) {
                        screenStream
                            .getTracks()
                            .forEach(
                                (track) => {
                                    try {
                                        track.stop();
                                    } catch {}
                                }
                            );

                        return;
                    }

                    screenStreamRef.current =
                        screenStream;

                    peerConnectionsRef.current.forEach(
                        (peer) => {
                            const sender =
                                peer
                                    .getSenders?.()
                                    ?.find(
                                        (
                                            item
                                        ) =>
                                            item.track
                                                ?.kind ===
                                            "video"
                                    );

                            if (
                                sender
                            ) {
                                sender
                                    .replaceTrack(
                                        screenTrack
                                    )
                                    .catch(
                                        () =>
                                            null
                                    );
                            }
                        }
                    );

                    screenSharingRef.current =
                        true;

                    setScreenSharing(
                        true
                    );

                    /*
                     * Browser stop-sharing button.
                     */
                    screenTrack.onended =
                        () => {
                            if (
                                mountedRef.current &&
                                screenStreamRef.current
                            ) {
                                toggleScreenShare().catch(
                                    () =>
                                        null
                                );
                            }
                        };
                } catch (
                    screenError
                ) {
                    if (
                        screenError?.name !==
                        "NotAllowedError"
                    ) {
                        setError(
                            getErrorMessage(
                                screenError,
                                "Unable to start screen sharing."
                            )
                        );
                    }
                }
            },
            []
        );

    /*
     * ============================================================
     * CHAT
     * ============================================================
     */

    const sendChatMessage =
        useCallback(
            async () => {
                const text =
                    String(
                        chatMessage || ""
                    ).trim();

                const localUserId =
                    currentUserIdRef.current;

                if (
                    !text ||
                    !localUserId
                ) {
                    return;
                }

                const message = {
                    id:
                        `${localUserId}-${Date.now()}-${Math.random()
                            .toString(36)
                            .slice(2, 8)}`,
                    sender_id:
                        localUserId,
                    sender_name:
                        currentDisplayNameRef.current,
                    message_text:
                        text,
                    created_at:
                        new Date().toISOString(),
                };

                setMessages(
                    (current) => [
                        ...current,
                        message,
                    ]
                );

                setChatMessage("");

                await sendRealtime(
                    "chat-message",
                    message
                );
            },
            [
                chatMessage,
                sendRealtime,
            ]
        );

    /*
     * ============================================================
     * COPY LINK
     * ============================================================
     */

    const copyJoinLink =
        useCallback(
            async () => {
                if (!joinLink) {
                    return;
                }

                try {
                    await navigator.clipboard.writeText(
                        joinLink
                    );

                    setCopySuccess(
                        true
                    );

                    window.setTimeout(
                        () => {
                            if (
                                mountedRef.current
                            ) {
                                setCopySuccess(
                                    false
                                );
                            }
                        },
                        2000
                    );
                } catch {
                    setError(
                        "Unable to copy the meeting link."
                    );
                }
            },
            [joinLink]
        );

    /*
     * ============================================================
     * LOAD ROOM
     * ============================================================
     */

    const loadRoom =
        useCallback(
            async () => {
                if (
                    !isValidRoomId(
                        meetingId
                    )
                ) {
                    throw new Error(
                        "Meeting ID is missing."
                    );
                }

                const {
                    data: {
                        user,
                    },
                    error: userError,
                } =
                    await supabase.auth.getUser();

                if (userError) {
                    throw userError;
                }

                if (!user) {
                    throw new Error(
                        "Your session has expired. Please login again."
                    );
                }

                if (
                    !mountedRef.current
                ) {
                    return null;
                }

                currentUserIdRef.current =
                    normalizeId(
                        user.id
                    );

                setCurrentUser(
                    user
                );

                const {
                    data: profileData,
                    error: profileError,
                } =
                    await supabase
                        .from(
                            "profiles"
                        )
                        .select(
                            `
                            id,
                            full_name,
                            school_id,
                            role_id
                        `
                        )
                        .eq(
                            "id",
                            user.id
                        )
                        .single();

                if (
                    profileError
                ) {
                    throw profileError;
                }

                if (
                    !profileData
                ) {
                    throw new Error(
                        "Your user profile was not found."
                    );
                }

                currentDisplayNameRef.current =
                    profileData.full_name ||
                    user.email ||
                    "Participant";

                setProfile(
                    profileData
                );

                const rawMeetingId =
                    String(
                        meetingId
                    ).trim();

                let roomData =
                    null;

                let roomError =
                    null;

                if (
                    /^\d+$/.test(
                        rawMeetingId
                    )
                ) {
                    const numericId =
                        Number(
                            rawMeetingId
                        );

                    const result =
                        await supabase
                            .from(
                                "video_rooms"
                            )
                            .select(
                                `
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
                            `
                            )
                            .eq(
                                "id",
                                numericId
                            )
                            .maybeSingle();

                    roomData =
                        result.data;

                    roomError =
                        result.error;
                }

                if (
                    !roomData &&
                    !roomError
                ) {
                    const result =
                        await supabase
                            .from(
                                "video_rooms"
                            )
                            .select(
                                `
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
                            `
                            )
                            .eq(
                                "room_code",
                                rawMeetingId
                            )
                            .maybeSingle();

                    roomData =
                        result.data;

                    roomError =
                        result.error;
                }

                if (
                    roomError
                ) {
                    throw roomError;
                }

                if (
                    !roomData
                ) {
                    throw new Error(
                        "This meeting could not be found. Check the meeting link or meeting ID."
                    );
                }

                const roomStatus =
                    String(
                        roomData.status ||
                            ""
                    ).toLowerCase();

                if (
                    roomStatus ===
                        "cancelled" ||
                    roomStatus ===
                        "canceled" ||
                    roomStatus ===
                        "ended"
                ) {
                    throw new Error(
                        "This meeting has already ended or was cancelled."
                    );
                }

                roomRef.current =
                    roomData;

                setRoom(
                    roomData
                );

                const {
                    data: participantRows,
                    error:
                        participantsError,
                } =
                    await supabase
                        .from(
                            "video_room_participants"
                        )
                        .select(
                            `
                            id,
                            room_id,
                            user_id,
                            role,
                            status,
                            joined_at,
                            left_at,
                            created_at
                        `
                        )
                        .eq(
                            "room_id",
                            roomData.id
                        )
                        .neq(
                            "status",
                            "removed"
                        );

                if (
                    participantsError
                ) {
                    console.warn(
                        "Meeting participant rows could not be loaded:",
                        participantsError
                    );
                }

                const rows =
                    Array.isArray(
                        participantRows
                    )
                        ? participantRows
                        : [];

                const participantIds =
                    Array.from(
                        new Set(
                            rows
                                .map(
                                    (
                                        row
                                    ) =>
                                        normalizeId(
                                            row.user_id
                                        )
                                )
                                .filter(
                                    Boolean
                                )
                        )
                    );

                let profileMap =
                    new Map();

                if (
                    participantIds.length
                ) {
                    const {
                        data:
                            participantProfiles,
                        error:
                            participantProfilesError,
                    } =
                        await supabase
                            .from(
                                "profiles"
                            )
                            .select(
                                "id, full_name"
                            )
                            .in(
                                "id",
                                participantIds
                            );

                    if (
                        participantProfilesError
                    ) {
                        console.warn(
                            "Participant profile names could not be loaded:",
                            participantProfilesError
                        );
                    } else {
                        profileMap =
                            new Map(
                                (
                                    participantProfiles ||
                                    []
                                ).map(
                                    (
                                        item
                                    ) => [
                                        normalizeId(
                                            item.id
                                        ),
                                        item.full_name ||
                                            "Participant",
                                    ]
                                )
                            );
                    }
                }

                const localParticipantRow =
                    rows.find(
                        (row) =>
                            normalizeId(
                                row.user_id
                            ) ===
                            normalizeId(
                                user.id
                            )
                    );

                localParticipantJoinedAt.current =
                    localParticipantRow?.joined_at ||
                    null;

                setParticipants(
                    rows.map(
                        (row) => {
                            const rowUserId =
                                normalizeId(
                                    row.user_id
                                );

                            return {
                                user_id:
                                    rowUserId,

                                display_name:
                                    profileMap.get(
                                        rowUserId
                                    ) ||
                                    (
                                        rowUserId ===
                                        normalizeId(
                                            user.id
                                        )
                                            ? profileData.full_name ||
                                              user.email ||
                                              "Participant"
                                            : "Participant"
                                    ),

                                joined_at:
                                    row.joined_at,

                                role:
                                    row.role,

                                status:
                                    row.status,

                                hand_raised:
                                    false,

                                mic_enabled:
                                    true,

                                camera_enabled:
                                    true,
                            };
                        }
                    )
                );

                return {
                    room:
                        roomData,
                    user,
                    profile:
                        profileData,
                };
            },
            [meetingId]
        );

    /*
     * ============================================================
     * JOIN REALTIME ROOM
     * ============================================================
     */

    const joinRealtimeRoom =
        useCallback(
            async (
                roomData,
                user,
                profileData,
                generation
            ) => {
                if (
                    !roomData?.id ||
                    !user?.id
                ) {
                    throw new Error(
                        "Meeting room information is incomplete."
                    );
                }

                const isCurrentGeneration =
                    () =>
                        mountedRef.current &&
                        initializationGenerationRef.current ===
                            generation;

                if (
                    !isCurrentGeneration()
                ) {
                    return;
                }

                const roomId =
                    normalizeId(
                        roomData.id
                    );

                const channelName =
                    makeRoomChannelName(
                        roomId
                    );

                currentUserIdRef.current =
                    normalizeId(
                        user.id
                    );

                currentDisplayNameRef.current =
                    profileData?.full_name ||
                    user.email ||
                    "Participant";

                roomRef.current =
                    roomData;

                /*
                 * ==================================================
                 * REMOVE EXISTING CHANNEL
                 * ==================================================
                 */

                if (
                    channelRef.current
                ) {
                    try {
                        await supabase.removeChannel(
                            channelRef.current
                        );
                    } catch (
                        removeError
                    ) {
                        console.warn(
                            "Existing meeting channel cleanup failed:",
                            removeError
                        );
                    }

                    if (
                        !isCurrentGeneration()
                    ) {
                        return;
                    }

                    channelRef.current =
                        null;
                }

                if (
                    !isCurrentGeneration()
                ) {
                    return;
                }

                const staleChannels =
                    supabase
                        .getChannels()
                        .filter(
                            (
                                existingChannel
                            ) => {
                                const topic =
                                    String(
                                        existingChannel
                                            ?.topic ||
                                            ""
                                    ).replace(
                                        /^realtime:/,
                                        ""
                                    );

                                return (
                                    topic ===
                                    channelName
                                );
                            }
                        );

                for (
                    const staleChannel of staleChannels
                ) {
                    if (
                        !isCurrentGeneration()
                    ) {
                        return;
                    }

                    try {
                        await supabase.removeChannel(
                            staleChannel
                        );
                    } catch (
                        removeError
                    ) {
                        console.warn(
                            "Stale meeting channel cleanup failed:",
                            removeError
                        );
                    }

                    if (
                        !isCurrentGeneration()
                    ) {
                        return;
                    }
                }

                if (
                    !isCurrentGeneration()
                ) {
                    return;
                }

                const channel =
                    supabase.channel(
                        channelName,
                        {
                            config: {
                                broadcast: {
                                    self: false,
                                },
                                presence: {
                                    key:
                                        user.id,
                                },
                            },
                        }
                    );

                channelRef.current =
                    channel;

                /*
                 * ==================================================
                 * BROADCAST LISTENERS
                 * ==================================================
                 */

                const registerBroadcast =
                    (eventName) => {
                        channel.on(
                            "broadcast",
                            {
                                event:
                                    eventName,
                            },
                            ({
                                payload,
                            }) => {
                                if (
                                    channelRef.current !==
                                    channel
                                ) {
                                    return;
                                }

                                if (
                                    !mountedRef.current
                                ) {
                                    return;
                                }

                                handleBroadcast(
                                    {
                                        event:
                                            eventName,
                                        payload,
                                    }
                                ).catch(
                                    (
                                        broadcastError
                                    ) => {
                                        console.warn(
                                            `Realtime ${eventName} handler failed:`,
                                            broadcastError
                                        );
                                    }
                                );
                            }
                        );
                    };

                registerBroadcast(
                    "webrtc-offer"
                );

                registerBroadcast(
                    "webrtc-answer"
                );

                registerBroadcast(
                    "webrtc-ice"
                );

                registerBroadcast(
                    "participant-left"
                );

                registerBroadcast(
                    "media-state"
                );

                registerBroadcast(
                    "chat-message"
                );

                registerBroadcast(
                    "meeting-reaction"
                );

                /*
                 * ==================================================
                 * PRESENCE SYNC
                 * ==================================================
                 */

                channel.on(
                    "presence",
                    {
                        event:
                            "sync",
                    },
                    () => {
                        if (
                            channelRef.current !==
                            channel ||
                            !isCurrentGeneration()
                        ) {
                            return;
                        }

                        updateParticipantPresence(
                            channel.presenceState()
                        );
                    }
                );

                /*
                 * ==================================================
                 * PRESENCE JOIN
                 * ==================================================
                 */

                channel.on(
                    "presence",
                    {
                        event:
                            "join",
                    },
                    ({
                        key,
                        newPresences,
                    }) => {
                        if (
                            channelRef.current !==
                                channel ||
                            !isCurrentGeneration()
                        ) {
                            return;
                        }

                        const state =
                            channel.presenceState();

                        updateParticipantPresence(
                            state
                        );

                        const localUserId =
                            normalizeId(
                                user.id
                            );

                        const remoteIds =
                            (
                                Array.isArray(
                                    newPresences
                                )
                                    ? newPresences
                                    : []
                            )
                                .map(
                                    (
                                        item
                                    ) =>
                                        normalizeId(
                                            item?.user_id ||
                                                key
                                        )
                                )
                                .filter(
                                    Boolean
                                )
                                .filter(
                                    (
                                        id
                                    ) =>
                                        id !==
                                        localUserId
                                );

                        remoteIds.forEach(
                            (
                                remoteId
                            ) => {
                                /*
                                 * Deterministic offer owner:
                                 * smaller user ID creates offer.
                                 */
                                if (
                                    localUserId <
                                    remoteId
                                ) {
                                    createPeerConnection(
                                        remoteId,
                                        true
                                    ).catch(
                                        (
                                            peerError
                                        ) => {
                                            console.warn(
                                                "Initial WebRTC offer failed:",
                                                peerError
                                            );
                                        }
                                    );
                                }
                            }
                        );
                    }
                );

                /*
                 * ==================================================
                 * PRESENCE LEAVE
                 * ==================================================
                 */

                channel.on(
                    "presence",
                    {
                        event:
                            "leave",
                    },
                    ({
                        key,
                        leftPresences,
                    }) => {
                        if (
                            channelRef.current !==
                                channel ||
                            !isCurrentGeneration()
                        ) {
                            return;
                        }

                        const state =
                            channel.presenceState();

                        updateParticipantPresence(
                            state
                        );

                        const leftIds =
                            new Set(
                                (
                                    Array.isArray(
                                        leftPresences
                                    )
                                        ? leftPresences
                                        : []
                                )
                                    .map(
                                        (
                                            item
                                        ) =>
                                            normalizeId(
                                                item?.user_id ||
                                                    key
                                            )
                                    )
                                    .filter(
                                        Boolean
                                    )
                            );

                        if (key) {
                            leftIds.add(
                                normalizeId(
                                    key
                                )
                            );
                        }

                        leftIds.forEach(
                            (
                                remoteId
                            ) => {
                                if (
                                    remoteId !==
                                    normalizeId(
                                        user.id
                                    )
                                ) {
                                    closePeerConnection(
                                        remoteId
                                    );
                                }
                            }
                        );
                    }
                );

                /*
                 * ==================================================
                 * SUBSCRIBE
                 * ==================================================
                 */

                await new Promise(
                    (
                        resolve,
                        reject
                    ) => {
                        let settled =
                            false;

                        const finish =
                            (
                                callback,
                                value
                            ) => {
                                if (
                                    settled
                                ) {
                                    return;
                                }

                                settled =
                                    true;

                                callback(
                                    value
                                );
                            };

                        channel.subscribe(
                            (
                                status,
                                subscriptionError
                            ) => {
                                if (
                                    status ===
                                    "SUBSCRIBED"
                                ) {
                                    finish(
                                        resolve,
                                        status
                                    );

                                    return;
                                }

                                if (
                                    status ===
                                    "CHANNEL_ERROR"
                                ) {
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

                                if (
                                    status ===
                                    "TIMED_OUT"
                                ) {
                                    finish(
                                        reject,
                                        new Error(
                                            "Meeting realtime connection timed out."
                                        )
                                    );

                                    return;
                                }

                                if (
                                    status ===
                                    "CLOSED"
                                ) {
                                    finish(
                                        reject,
                                        new Error(
                                            "Meeting realtime channel was closed."
                                        )
                                    );
                                }
                            }
                        );
                    }
                );

                if (
                    !isCurrentGeneration() ||
                    channelRef.current !==
                        channel
                ) {
                    try {
                        await supabase.removeChannel(
                            channel
                        );
                    } catch {}

                    return;
                }

                /*
                 * ==================================================
                 * TRACK PRESENCE
                 * ==================================================
                 */

                await channel.track({
                    user_id:
                        user.id,

                    display_name:
                        profileData?.full_name ||
                        user.email ||
                        "Participant",

                    joined_at:
                        localParticipantJoinedAt.current ||
                        new Date().toISOString(),

                    mic_enabled:
                        localStreamRef.current
                            ?.getAudioTracks?.()[0]
                            ?.enabled !== false,

                    camera_enabled:
                        localStreamRef.current
                            ?.getVideoTracks?.()[0]
                            ?.enabled !== false,

                    hand_raised:
                        false,

                    role:
                        normalizeId(
                            roomData.created_by
                        ) ===
                        normalizeId(
                            user.id
                        )
                            ? "host"
                            : "participant",
                });

                if (
                    !isCurrentGeneration() ||
                    channelRef.current !==
                        channel
                ) {
                    return;
                }

                /*
                 * ==================================================
                 * PERSIST PARTICIPANT JOIN
                 * ==================================================
                 */

                const participantRole =
                    normalizeId(
                        roomData.created_by
                    ) ===
                    normalizeId(
                        user.id
                    )
                        ? "host"
                        : "participant";

                const {
                    error:
                        participantUpsertError,
                } =
                    await supabase
                        .from(
                            "video_room_participants"
                        )
                        .upsert(
                            {
                                room_id:
                                    roomData.id,
                                user_id:
                                    user.id,
                                role:
                                    participantRole,
                                status:
                                    "joined",
                                joined_at:
                                    new Date().toISOString(),
                                left_at:
                                    null,
                            },
                            {
                                onConflict:
                                    "room_id,user_id",
                            }
                        );

                if (
                    participantUpsertError
                ) {
                    console.warn(
                        "Meeting participant record could not be saved:",
                        participantUpsertError
                    );
                }

                if (
                    !isCurrentGeneration() ||
                    channelRef.current !==
                        channel
                ) {
                    return;
                }

                /*
                 * ==================================================
                 * ONLY HOST CHANGES SCHEDULED -> LIVE
                 * ==================================================
                 */

                if (
                    String(
                        roomData.status ||
                            ""
                    ).toLowerCase() ===
                        "scheduled" &&
                    normalizeId(
                        roomData.created_by
                    ) ===
                        normalizeId(
                            user.id
                        )
                ) {
                    const {
                        error:
                            liveUpdateError,
                    } =
                        await supabase
                            .from(
                                "video_rooms"
                            )
                            .update(
                                {
                                    status:
                                        "live",
                                    updated_at:
                                        new Date().toISOString(),
                                }
                            )
                            .eq(
                                "id",
                                roomData.id
                            )
                            .eq(
                                "created_by",
                                user.id
                            );

                    if (
                        liveUpdateError
                    ) {
                        console.warn(
                            "Unable to switch scheduled meeting to live:",
                            liveUpdateError
                        );
                    } else if (
                        isCurrentGeneration()
                    ) {
                        const updatedRoom =
                            {
                                ...roomData,
                                status:
                                    "live",
                            };

                        roomRef.current =
                            updatedRoom;

                        setRoom(
                            updatedRoom
                        );
                    }
                }

                if (
                    !isCurrentGeneration() ||
                    channelRef.current !==
                        channel
                ) {
                    return;
                }

                /*
                 * ==================================================
                 * INITIAL PRESENCE
                 * ==================================================
                 */

                const presenceState =
                    channel.presenceState();

                updateParticipantPresence(
                    presenceState
                );

                const existingUsers =
                    extractPresenceUsers(
                        presenceState
                    )
                        .map(
                            (
                                item
                            ) =>
                                normalizeId(
                                    item.user_id
                                )
                        )
                        .filter(
                            (id) =>
                                id &&
                                id !==
                                    normalizeId(
                                        user.id
                                    )
                        );

                /*
                 * ==================================================
                 * CREATE OFFERS TO EXISTING PARTICIPANTS
                 * ==================================================
                 */

                for (
                    const remoteUserId of existingUsers
                ) {
                    if (
                        !isCurrentGeneration()
                    ) {
                        return;
                    }

                    if (
                        normalizeId(
                            user.id
                        ) <
                        remoteUserId
                    ) {
                        await createPeerConnection(
                            remoteUserId,
                            true
                        );

                        if (
                            !isCurrentGeneration()
                        ) {
                            return;
                        }
                    }
                }
            },
            [
                handleBroadcast,
                updateParticipantPresence,
                createPeerConnection,
                closePeerConnection,
            ]
        );

    /*
     * ============================================================
     * LEAVE MEETING
     * ============================================================
     */

    const leaveMeeting =
        useCallback(
            async ({
                endForEveryone = false,
            } = {}) => {
                if (
                    endingMeeting
                ) {
                    return;
                }

                setEndingMeeting(
                    true
                );

                const localUserId =
                    currentUserIdRef.current;

                const activeRoom =
                    roomRef.current;

                try {
                    const channel =
                        channelRef.current;

                    if (
                        channel &&
                        localUserId
                    ) {
                        await sendRealtime(
                            "participant-left",
                            {
                                user_id:
                                    localUserId,
                                from:
                                    localUserId,
                            }
                        );
                    }

                    if (
                        activeRoom?.id &&
                        localUserId
                    ) {
                        const {
                            error:
                                participantError,
                        } =
                            await supabase
                                .from(
                                    "video_room_participants"
                                )
                                .update(
                                    {
                                        status:
                                            "left",
                                        left_at:
                                            new Date().toISOString(),
                                    }
                                )
                                .eq(
                                    "room_id",
                                    activeRoom.id
                                )
                                .eq(
                                    "user_id",
                                    localUserId
                                );

                        if (
                            participantError
                        ) {
                            console.warn(
                                "Unable to update participant leave status:",
                                participantError
                            );
                        }
                    }

                    const isHost =
                        normalizeId(
                            activeRoom?.created_by
                        ) ===
                        localUserId;

                    if (
                        endForEveryone &&
                        isHost &&
                        activeRoom?.id
                    ) {
                        const {
                            error:
                                endError,
                        } =
                            await supabase
                                .from(
                                    "video_rooms"
                                )
                                .update(
                                    {
                                        status:
                                            "ended",
                                        updated_at:
                                            new Date().toISOString(),
                                    }
                                )
                                .eq(
                                    "id",
                                    activeRoom.id
                                )
                                .eq(
                                    "created_by",
                                    localUserId
                                );

                        if (
                            endError
                        ) {
                            throw endError;
                        }
                    }
                } catch (
                    leaveError
                ) {
                    console.warn(
                        "Meeting leave cleanup warning:",
                        leaveError
                    );
                } finally {
                    try {
                        if (
                            channelRef.current
                        ) {
                            await supabase.removeChannel(
                                channelRef.current
                            );
                        }
                    } catch {
                        // Ignore.
                    }

                    channelRef.current =
                        null;

                    /*
                     * Invalidate any in-flight initialization.
                     */
                    initializationGenerationRef.current +=
                        1;

                    closeAllPeerConnections();

                    stopAllMedia();

                    navigate(
                        "/communication/meetings"
                    );

                    setEndingMeeting(
                        false
                    );
                }
            },
            [
                endingMeeting,
                sendRealtime,
                closeAllPeerConnections,
                stopAllMedia,
                navigate,
            ]
        );

    /*
     * ============================================================
     * INITIALIZATION
     *
     * IMPORTANT:
     *
     * This effect depends ONLY on meetingId.
     *
     * UI state such as:
     * - Mic
     * - Camera
     * - Raise hand
     * - Applause
     * - Chat
     * - Participants
     * - Settings
     *
     * can therefore never cause this effect to reconnect.
     *
     * The generation token additionally prevents stale async
     * initialization from surviving React StrictMode cleanup.
     * ============================================================
     */

    useEffect(() => {
        mountedRef.current =
            true;

        const generation =
            initializationGenerationRef.current +
            1;

        initializationGenerationRef.current =
            generation;

        const isCurrentGeneration =
            () =>
                mountedRef.current &&
                initializationGenerationRef.current ===
                    generation;

        const initialize =
            async () => {
                try {
                    setLoading(
                        true
                    );

                    setError(
                        ""
                    );

                    const roomContext =
                        await loadRoom();

                    if (
                        !isCurrentGeneration() ||
                        !roomContext
                    ) {
                        return;
                    }

                    const localStream =
                        await startLocalMedia(
                            generation
                        );

                    if (
                        !isCurrentGeneration() ||
                        !localStream
                    ) {
                        return;
                    }

                    await joinRealtimeRoom(
                        roomContext.room,
                        roomContext.user,
                        roomContext.profile,
                        generation
                    );

                    if (
                        !isCurrentGeneration()
                    ) {
                        return;
                    }
                } catch (
                    initializationError
                ) {
                    console.error(
                        "Communication meeting initialization failed:",
                        initializationError
                    );

                    if (
                        isCurrentGeneration()
                    ) {
                        setError(
                            getErrorMessage(
                                initializationError,
                                "Unable to open this meeting."
                            )
                        );
                    }
                } finally {
                    if (
                        isCurrentGeneration()
                    ) {
                        setLoading(
                            false
                        );
                    }
                }
            };

        initialize();

        return () => {
            /*
             * Invalidate this exact initialization generation.
             * Any pending async work will stop when it resumes.
             */
            if (
                initializationGenerationRef.current ===
                generation
            ) {
                initializationGenerationRef.current +=
                    1;

                mountedRef.current =
                    false;

                if (
                    channelRef.current
                ) {
                    const channel =
                        channelRef.current;

                    channelRef.current =
                        null;

                    supabase
                        .removeChannel(
                            channel
                        )
                        .catch(
                            () => null
                        );
                }

                closeAllPeerConnections();

                stopAllMedia();

                reactionTimersRef.current.forEach(
                    (timer) => {
                        window.clearTimeout(
                            timer
                        );
                    }
                );

                reactionTimersRef.current.clear();
            }
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meetingId]);

    /*
     * ============================================================
     * ATTACH REMOTE VIDEO STREAMS
     * ============================================================
     */

    useEffect(() => {
        void remoteStreamVersion;

        participants.forEach(
            (participant) => {
                const userId =
                    normalizeId(
                        participant.user_id
                    );

                if (
                    userId ===
                    currentUserIdRef.current
                ) {
                    return;
                }

                const element =
                    remoteVideoRefs.current.get(
                        userId
                    );

                const stream =
                    remoteStreamsRef.current.get(
                        userId
                    );

                if (
                    element &&
                    stream &&
                    element.srcObject !==
                        stream
                ) {
                    try {
                        element.srcObject =
                            stream;

                        element
                            .play?.()
                            .catch(
                                () => null
                            );
                    } catch {}
                }
            }
        );
    }, [
        participants,
        currentUserId,
        remoteStreamVersion,
    ]);

    const remoteParticipants =
        participants.filter(
            (participant) =>
                normalizeId(
                    participant.user_id
                ) !==
                currentUserId
        );

    /*
     * ============================================================
     * LOADING
     * ============================================================
     */

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
                <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-300" />
                    </div>

                    <h1 className="text-xl font-bold">
                        Joining meeting...
                    </h1>

                    <p className="mt-2 text-sm text-slate-400">
                        Preparing your camera, microphone and realtime connection.
                    </p>
                </div>
            </div>
        );
    }

    /*
     * ============================================================
     * ERROR
     * ============================================================
     */

    if (
        error &&
        !room
    ) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
                <div className="w-full max-w-xl rounded-3xl border border-red-400/20 bg-red-500/10 p-8 shadow-2xl">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
                            <ShieldCheck className="h-6 w-6" />
                        </div>

                        <div className="min-w-0 flex-1">
                            <h1 className="text-xl font-bold">
                                Unable to open meeting
                            </h1>

                            <p className="mt-2 text-sm leading-6 text-red-100/80">
                                {error}
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/communication/meetings"
                                )
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to Meetings
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                window.location.reload()
                            }
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /*
     * ============================================================
     * MAIN UI
     * ============================================================
     */

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">

            <header className="border-b border-white/10 bg-slate-950/95 backdrop-blur sticky top-0 z-40">
                <div className="flex min-h-[68px] items-center justify-between gap-4 px-4 md:px-6">

                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/communication/meetings"
                                )
                            }
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h1 className="truncate text-sm font-bold md:text-base">
                                    {room?.title ||
                                        "Video Meeting"}
                                </h1>

                                <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300 sm:inline-flex">
                                    {String(
                                        room?.status ||
                                            "live"
                                    ).toUpperCase()}
                                </span>
                            </div>

                            <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-slate-400">
                                <span className="truncate">
                                    {room?.room_code ||
                                        `Room #${room?.id || meetingId}`}
                                </span>

                                <span>
                                    â€¢
                                </span>

                                <span>
                                    {
                                        participants.length
                                    }{" "}
                                    participant
                                    {participants.length ===
                                    1
                                        ? ""
                                        : "s"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="hidden items-center gap-2 lg:flex">
                        <button
                            type="button"
                            onClick={
                                copyJoinLink
                            }
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                        >
                            {copySuccess ? (
                                <Check className="h-4 w-4 text-emerald-300" />
                            ) : (
                                <Copy className="h-4 w-4" />
                            )}

                            {copySuccess
                                ? "Copied"
                                : "Copy invite link"}
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                setParticipantsOpen(
                                    (value) =>
                                        !value
                                )
                            }
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                                participantsOpen
                                    ? "border-indigo-400/30 bg-indigo-500/15 text-indigo-200"
                                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                            }`}
                        >
                            <Users className="h-4 w-4" />
                            Participants
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                setChatOpen(
                                    (value) =>
                                        !value
                                )
                            }
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                                chatOpen
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
                        onClick={() =>
                            setSettingsOpen(
                                (value) =>
                                    !value
                            )
                        }
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 lg:hidden"
                    >
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </header>

            {error &&
                room && (
                    <div className="mx-4 mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100 md:mx-6">
                        {error}
                    </div>
                )}

            <main className="flex-1 p-4 md:p-6">
                <div className="mx-auto flex h-[calc(100vh-150px)] min-h-[520px] max-w-[1800px] gap-4 overflow-hidden">

                    <section className="relative min-w-0 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl">

                        <div
                            className={`grid h-full gap-3 p-3 pb-24 ${
                                remoteParticipants.length ===
                                0
                                    ? "grid-cols-1"
                                    : remoteParticipants.length ===
                                      1
                                        ? "grid-cols-1"
                                        : remoteParticipants.length <=
                                          4
                                            ? "grid-cols-2"
                                            : "grid-cols-2 lg:grid-cols-3"
                            }`}
                        >
                            {remoteParticipants.map(
                                (
                                    participant
                                ) => {
                                    const userId =
                                        normalizeId(
                                            participant.user_id
                                        );

                                    const stream =
                                        remoteStreamsRef.current.get(
                                            userId
                                        );

                                    return (
                                        <div
                                            key={
                                                userId
                                            }
                                            className="group relative min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-900"
                                        >
                                            {stream ? (
                                                <video
                                                    ref={(
                                                        node
                                                    ) => {
                                                        if (
                                                            node
                                                        ) {
                                                            remoteVideoRefs.current.set(
                                                                userId,
                                                                node
                                                            );

                                                            if (
                                                                node.srcObject !==
                                                                stream
                                                            ) {
                                                                node.srcObject =
                                                                    stream;

                                                                node.play?.().catch(
                                                                    () =>
                                                                        null
                                                                );
                                                            }
                                                        } else {
                                                            remoteVideoRefs.current.delete(
                                                                userId
                                                            );
                                                        }
                                                    }}
                                                    autoPlay
                                                    playsInline
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
                                                    <div className="flex flex-col items-center gap-3 text-center">
                                                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-500/15 text-2xl font-bold text-indigo-200 ring-1 ring-indigo-400/20">
                                                            {getInitials(
                                                                participant.display_name
                                                            )}
                                                        </div>

                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-200">
                                                                Connecting...
                                                            </p>

                                                            <p className="mt-1 text-xs text-slate-500">
                                                                Waiting for video stream
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {!participant.camera_enabled && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85">
                                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-xl font-bold text-slate-200">
                                                        {getInitials(
                                                            participant.display_name
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="absolute left-3 top-3 flex items-center gap-2">
                                                <span className="max-w-[220px] truncate rounded-full border border-white/10 bg-slate-950/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                                                    {
                                                        participant.display_name
                                                    }
                                                </span>

                                                {participant.hand_raised && (
                                                    <span
                                                        className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-300/30 bg-amber-500/25 text-amber-100 shadow-lg backdrop-blur"
                                                        title="Hand raised"
                                                    >
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
                                }
                            )}

                            {remoteParticipants.length ===
                                0 && (
                                <div className="pointer-events-none absolute inset-x-0 top-8 flex justify-center px-6">
                                    <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-center text-xs text-slate-300 backdrop-blur">
                                        Waiting for another participant to join...
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* SELF VIEW */}

                        <div className="absolute bottom-24 right-4 z-30 h-32 w-48 overflow-hidden rounded-2xl border border-white/20 bg-slate-900 shadow-2xl ring-1 ring-black/40 sm:h-36 sm:w-56 md:bottom-24 md:right-5 md:h-40 md:w-64">

                            {/*
                             * IMPORTANT FIX:
                             * The video is ALWAYS mounted.
                             * Camera off only changes opacity.
                             * This preserves srcObject and prevents
                             * the self-view from disappearing after
                             * camera toggles.
                             */}
                            <video
                                ref={
                                    localVideoRef
                                }
                                autoPlay
                                muted
                                playsInline
                                className={`h-full w-full object-cover transition-opacity duration-200 ${
                                    cameraStarted &&
                                    (
                                        localCameraEnabled ||
                                        screenSharing
                                    )
                                        ? "opacity-100"
                                        : "opacity-0"
                                }`}
                            />

                            {!(
                                cameraStarted &&
                                (
                                    localCameraEnabled ||
                                    screenSharing
                                )
                            ) && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/20 text-lg font-bold text-indigo-200 ring-1 ring-indigo-400/20">
                                            {getInitials(
                                                currentDisplayName
                                            )}
                                        </div>

                                        <p className="text-[11px] font-semibold text-slate-300">
                                            Camera is off
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
                                <span className="rounded-full border border-white/10 bg-slate-950/75 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
                                    You
                                </span>

                                {screenSharing && (
                                    <span className="rounded-full border border-amber-400/20 bg-amber-500/15 px-2 py-1 text-[10px] font-semibold text-amber-200 backdrop-blur">
                                        Screen
                                    </span>
                                )}
                            </div>

                            <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                                <span className="max-w-[145px] truncate rounded-full border border-white/10 bg-slate-950/75 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
                                    {currentDisplayName}
                                </span>

                                {!localMicEnabled && (
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/90 text-white">
                                        <MicOff className="h-3 w-3" />
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="absolute left-5 top-5 hidden rounded-full border border-white/10 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300 backdrop-blur sm:block">
                            {remoteParticipantCount >
                            0
                                ? `${remoteParticipantCount} other participant${
                                      remoteParticipantCount ===
                                      1
                                          ? ""
                                          : "s"
                                  } connected`
                                : "Private meeting room"}
                        </div>

                        {floatingReactions.length >
                            0 && (
                            <div className="pointer-events-none absolute right-4 top-16 z-20 flex max-w-[280px] flex-col items-end gap-2 sm:right-6 sm:top-20">
                                {floatingReactions.map(
                                    (
                                        reaction
                                    ) => (
                                        <div
                                            key={
                                                reaction.id
                                            }
                                            className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/80 px-3 py-2 shadow-2xl backdrop-blur-xl"
                                        >
                                            <span className="text-2xl leading-none">
                                                {
                                                    reaction.emoji
                                                }
                                            </span>

                                            <span className="max-w-[150px] truncate text-xs font-semibold text-white">
                                                {
                                                    reaction.display_name
                                                }
                                            </span>
                                        </div>
                                    )
                                )}
                            </div>
                        )}

                        <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-5 pt-10">
                            <div className="flex flex-wrap items-center justify-center gap-2 rounded-3xl border border-white/10 bg-slate-950/85 p-2.5 shadow-2xl backdrop-blur-xl">

                                <button
                                    type="button"
                                    onClick={
                                        toggleMic
                                    }
                                    className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
                                        localMicEnabled
                                            ? "border-white/10 bg-white/10 text-white hover:bg-white/15"
                                            : "border-red-400/20 bg-red-500/20 text-red-100"
                                    }`}
                                    title={
                                        localMicEnabled
                                            ? "Mute"
                                            : "Unmute"
                                    }
                                >
                                    {localMicEnabled ? (
                                        <Mic className="h-5 w-5" />
                                    ) : (
                                        <MicOff className="h-5 w-5" />
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={
                                        toggleCamera
                                    }
                                    className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
                                        localCameraEnabled
                                            ? "border-white/10 bg-white/10 text-white hover:bg-white/15"
                                            : "border-red-400/20 bg-red-500/20 text-red-100"
                                    }`}
                                    title={
                                        localCameraEnabled
                                            ? "Turn camera off"
                                            : "Turn camera on"
                                    }
                                >
                                    {localCameraEnabled ? (
                                        <Video className="h-5 w-5" />
                                    ) : (
                                        <VideoOff className="h-5 w-5" />
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={
                                        toggleScreenShare
                                    }
                                    className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
                                        screenSharing
                                            ? "border-indigo-400/30 bg-indigo-500/20 text-indigo-200"
                                            : "border-white/10 bg-white/10 text-white hover:bg-white/15"
                                    }`}
                                    title={
                                        screenSharing
                                            ? "Stop sharing"
                                            : "Share screen"
                                    }
                                >
                                    {screenSharing ? (
                                        <MonitorOff className="h-5 w-5" />
                                    ) : (
                                        <Monitor className="h-5 w-5" />
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={
                                        sendApplause
                                    }
                                    className="relative flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 text-white transition hover:bg-white/15"
                                    title="Applause / Support"
                                >
                                    <span className="text-lg leading-none">
                                        ðŸ‘
                                    </span>

                                    {applauseCount >
                                        0 && (
                                        <span className="text-[11px] font-bold text-slate-200">
                                            {
                                                applauseCount
                                            }
                                        </span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={
                                        toggleRaiseHand
                                    }
                                    className={`flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border px-3 transition ${
                                        raiseHandEnabled
                                            ? "border-amber-300/30 bg-amber-500/20 text-amber-100"
                                            : "border-white/10 bg-white/10 text-white hover:bg-white/15"
                                    }`}
                                    title={
                                        raiseHandEnabled
                                            ? "Lower hand"
                                            : "Raise hand"
                                    }
                                >
                                    <Hand className="h-5 w-5" />
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setChatOpen(
                                            (
                                                value
                                            ) =>
                                                !value
                                        )
                                    }
                                    className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
                                        chatOpen
                                            ? "border-indigo-400/30 bg-indigo-500/20 text-indigo-200"
                                            : "border-white/10 bg-white/10 text-white hover:bg-white/15"
                                    }`}
                                    title="Meeting chat"
                                >
                                    <MessageCircle className="h-5 w-5" />
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setParticipantsOpen(
                                            (
                                                value
                                            ) =>
                                                !value
                                        )
                                    }
                                    className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
                                        participantsOpen
                                            ? "border-indigo-400/30 bg-indigo-500/20 text-indigo-200"
                                            : "border-white/10 bg-white/10 text-white hover:bg-white/15"
                                    }`}
                                    title="Participants"
                                >
                                    <Users className="h-5 w-5" />
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setSettingsOpen(
                                            (
                                                value
                                            ) =>
                                                !value
                                        )
                                    }
                                    className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
                                        settingsOpen
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
                                            normalizeId(
                                                room?.created_by
                                            ) ===
                                            currentUserId;

                                        if (
                                            isHost
                                        ) {
                                            const shouldEnd =
                                                window.confirm(
                                                    "Do you want to end this meeting for everyone?"
                                                );

                                            if (
                                                shouldEnd
                                            ) {
                                                leaveMeeting(
                                                    {
                                                        endForEveryone:
                                                            true,
                                                    }
                                                );
                                            } else {
                                                leaveMeeting(
                                                    {
                                                        endForEveryone:
                                                            false,
                                                    }
                                                );
                                            }
                                        } else {
                                            leaveMeeting(
                                                {
                                                    endForEveryone:
                                                        false,
                                                }
                                            );
                                        }
                                    }}
                                    disabled={
                                        endingMeeting
                                    }
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

                    {chatOpen && (
                        <aside className="hidden w-[360px] shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl xl:flex">
                            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                                <div>
                                    <h2 className="text-sm font-bold">
                                        Meeting Chat
                                    </h2>

                                    <p className="mt-0.5 text-xs text-slate-400">
                                        {
                                            messages.length
                                        }{" "}
                                        message
                                        {messages.length ===
                                        1
                                            ? ""
                                            : "s"}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setChatOpen(
                                            false
                                        )
                                    }
                                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                                {messages.length ===
                                0 ? (
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
                                    messages.map(
                                        (
                                            message
                                        ) => {
                                            const isMine =
                                                normalizeId(
                                                    message.sender_id
                                                ) ===
                                                currentUserId;

                                            return (
                                                <div
                                                    key={
                                                        message.id
                                                    }
                                                    className={`flex ${
                                                        isMine
                                                            ? "justify-end"
                                                            : "justify-start"
                                                    }`}
                                                >
                                                    <div
                                                        className={`max-w-[86%] ${
                                                            isMine
                                                                ? "items-end"
                                                                : "items-start"
                                                        }`}
                                                    >
                                                        {!isMine && (
                                                            <p className="mb-1 px-1 text-[10px] font-semibold text-slate-400">
                                                                {
                                                                    message.sender_name
                                                                }
                                                            </p>
                                                        )}

                                                        <div
                                                            className={`rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${
                                                                isMine
                                                                    ? "rounded-br-md bg-indigo-600 text-white"
                                                                    : "rounded-bl-md bg-white/10 text-slate-100"
                                                            }`}
                                                        >
                                                            {
                                                                message.message_text
                                                            }
                                                        </div>

                                                        <div
                                                            className={`mt-1 flex items-center gap-1 px-1 text-[10px] text-slate-500 ${
                                                                isMine
                                                                    ? "justify-end"
                                                                    : "justify-start"
                                                            }`}
                                                        >
                                                            <span>
                                                                {formatTime(
                                                                    message.created_at
                                                                )}
                                                            </span>

                                                            {isMine && (
                                                                <CheckCheck className="h-3 w-3" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                    )
                                )}
                            </div>

                            <div className="border-t border-white/10 p-3">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                                    <textarea
                                        value={
                                            chatMessage
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setChatMessage(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        onKeyDown={(
                                            event
                                        ) => {
                                            if (
                                                event.key ===
                                                    "Enter" &&
                                                !event.shiftKey
                                            ) {
                                                event.preventDefault();

                                                sendChatMessage();
                                            }
                                        }}
                                        rows={
                                            2
                                        }
                                        placeholder="Type a message..."
                                        className="w-full resize-none bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-slate-500"
                                    />

                                    <div className="mt-2 flex items-center justify-end">
                                        <button
                                            type="button"
                                            onClick={
                                                sendChatMessage
                                            }
                                            disabled={
                                                !chatMessage.trim()
                                            }
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

                    {participantsOpen && (
                        <aside className="hidden w-[320px] shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl xl:flex">
                            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                                <div>
                                    <h2 className="text-sm font-bold">
                                        Participants
                                    </h2>

                                    <p className="mt-0.5 text-xs text-slate-400">
                                        {
                                            participants.length
                                        }{" "}
                                        connected / room members
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setParticipantsOpen(
                                            false
                                        )
                                    }
                                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                                <div className="space-y-2">
                                    {participants.map(
                                        (
                                            participant
                                        ) => {
                                            const isMine =
                                                normalizeId(
                                                    participant.user_id
                                                ) ===
                                                currentUserId;

                                            return (
                                                <div
                                                    key={normalizeId(
                                                        participant.user_id
                                                    )}
                                                    className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3"
                                                >
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-sm font-bold text-indigo-200">
                                                        {getInitials(
                                                            participant.display_name
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-semibold text-slate-100">
                                                            {
                                                                participant.display_name
                                                            }

                                                            {isMine
                                                                ? " (You)"
                                                                : ""}
                                                        </p>

                                                        <p className="mt-0.5 text-[11px] text-slate-500">
                                                            {participant.role ===
                                                            "host"
                                                                ? "Host"
                                                                : "Participant"}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        {participant.hand_raised && (
                                                            <Hand
                                                                className="h-3.5 w-3.5 text-amber-300"
                                                                title="Hand raised"
                                                            />
                                                        )}

                                                        {participant.mic_enabled !==
                                                        false ? (
                                                            <Mic className="h-3.5 w-3.5 text-slate-400" />
                                                        ) : (
                                                            <MicOff className="h-3.5 w-3.5 text-red-400" />
                                                        )}

                                                        {participant.camera_enabled !==
                                                        false ? (
                                                            <Video className="h-3.5 w-3.5 text-slate-400" />
                                                        ) : (
                                                            <VideoOff className="h-3.5 w-3.5 text-red-400" />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }
                                    )}
                                </div>
                            </div>
                        </aside>
                    )}
                </div>
            </main>

            {settingsOpen && (
                <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-3 backdrop-blur-sm lg:items-center lg:justify-center">
                    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl">

                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold">
                                    Meeting actions
                                </h2>

                                <p className="mt-1 text-xs text-slate-400">
                                    {formatDateTime(
                                        room?.scheduled_start
                                    )}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setSettingsOpen(
                                        false
                                    )
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-5 grid gap-2">
                            <button
                                type="button"
                                onClick={
                                    copyJoinLink
                                }
                                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10"
                            >
                                <span className="text-sm font-semibold">
                                    Copy meeting link
                                </span>

                                {copySuccess ? (
                                    <Check className="h-4 w-4 text-emerald-300" />
                                ) : (
                                    <Copy className="h-4 w-4 text-slate-400" />
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setSettingsOpen(
                                        false
                                    );

                                    setParticipantsOpen(
                                        true
                                    );
                                }}
                                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10"
                            >
                                <span className="text-sm font-semibold">
                                    Open participants
                                </span>

                                <Users className="h-4 w-4 text-slate-400" />
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setSettingsOpen(
                                        false
                                    );

                                    setChatOpen(
                                        true
                                    );
                                }}
                                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10"
                            >
                                <span className="text-sm font-semibold">
                                    Open meeting chat
                                </span>

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
};

export default CommunicationMeeting;
