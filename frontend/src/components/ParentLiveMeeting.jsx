import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabase";
import api from "../services/api";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];
const idOf = (value) => String(value ?? "").trim();

function VideoTile({ participant, stream, local }) {
  const videoRef = useRef(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    el.play?.().catch(() => {});
    return () => { if (el.srcObject === stream) el.srcObject = null; };
  }, [stream]);
  return <article className="relative min-h-48 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
    <video ref={videoRef} autoPlay playsInline muted={local} className="h-full min-h-48 w-full object-cover"/>
    <span className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-semibold text-white">{participant.display_name || "Mshiriki"}{local ? " · Wewe" : ""}</span>
  </article>;
}

export default function ParentLiveMeeting({ meeting, connectionInfo, isAdmin = false, onEnd, onLeave, authToken = "" }) {
  const channelRef = useRef(null), localStreamRef = useRef(null), peersRef = useRef(new Map()), remoteStreamsRef = useRef(new Map()), pendingIceRef = useRef(new Map());
  const identityRef = useRef(""), nameRef = useRef(""), mountedRef = useRef(false), onLeaveRef = useRef(onLeave);
  const [participants, setParticipants] = useState([]), [version, setVersion] = useState(0);
  const [cameraOn, setCameraOn] = useState(false), [micOn, setMicOn] = useState(false), [connecting, setConnecting] = useState(true);
  const [error, setError] = useState(""), [ending, setEnding] = useState(false), [roomState, setRoomState] = useState("Inaunganisha");

  useEffect(() => { onLeaveRef.current = onLeave; }, [onLeave]);

  const send = useCallback(async (event, payload) => {
    if (channelRef.current) await channelRef.current.send({ type: "broadcast", event, payload });
  }, []);
  const closePeer = useCallback((value) => {
    const id = idOf(value), peer = peersRef.current.get(id);
    if (peer) peer.close();
    peersRef.current.delete(id); remoteStreamsRef.current.delete(id); pendingIceRef.current.delete(id);
    if (mountedRef.current) setVersion(v => v + 1);
  }, []);
  const createPeer = useCallback(async (value, makeOffer = false) => {
    const remote = idOf(value), local = identityRef.current;
    if (!remote || !local || remote === local || !localStreamRef.current) return null;
    let peer = peersRef.current.get(remote);
    if (peer) return peer;
    peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(remote, peer);
    localStreamRef.current.getTracks().forEach(track => peer.addTrack(track, localStreamRef.current));
    peer.ontrack = event => { const stream = event.streams?.[0]; if (stream) { remoteStreamsRef.current.set(remote, stream); if (mountedRef.current) setVersion(v => v + 1); } };
    peer.onicecandidate = event => { if (event.candidate) send("webrtc-ice", { from: local, to: remote, candidate: event.candidate }); };
    peer.onconnectionstatechange = () => { if (["failed","closed"].includes(peer.connectionState)) closePeer(remote); };
    if (makeOffer) {
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
      await send("webrtc-offer", { from: local, to: remote, offer });
    }
    return peer;
  }, [closePeer, send]);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    const cleanup = async () => {
      mountedRef.current = false;
      peersRef.current.forEach(peer => peer.close()); peersRef.current.clear();
      localStreamRef.current?.getTracks().forEach(track => track.stop()); localStreamRef.current = null;
      const channel = channelRef.current; channelRef.current = null;
      if (channel) await supabase.removeChannel(channel);
    };
    const connect = async () => {
      try {
        const roomCode = String(connectionInfo?.roomCode || "").trim(), identity = idOf(connectionInfo?.identity);
        if (!roomCode || !identity) throw new Error("Taarifa za chumba cha mkutano hazijakamilika. Ondoka kisha ujaribu tena.");
        identityRef.current = identity; nameRef.current = connectionInfo?.displayName || "Mshiriki";
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        localStreamRef.current = stream;
        setCameraOn(stream.getVideoTracks().some(t => t.enabled)); setMicOn(stream.getAudioTracks().some(t => t.enabled));
        const channel = supabase.channel("video-meeting-" + roomCode, { config: { broadcast: { self: false }, presence: { key: identity } } });
        channelRef.current = channel;
        const handlers = {
          "webrtc-offer": async p => {
            if (idOf(p?.to) !== identity || !p?.offer) return;
            const peer = await createPeer(p.from);
            if (!peer || peer.signalingState !== "stable") return;
            await peer.setRemoteDescription(new RTCSessionDescription(p.offer));
            for (const c of pendingIceRef.current.get(idOf(p.from)) || []) await peer.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            pendingIceRef.current.delete(idOf(p.from));
            const answer = await peer.createAnswer(); await peer.setLocalDescription(answer);
            await send("webrtc-answer", { from: identity, to: idOf(p.from), answer });
          },
          "webrtc-answer": async p => {
            if (idOf(p?.to) !== identity || !p?.answer) return;
            const peer = peersRef.current.get(idOf(p.from));
            if (peer?.signalingState === "have-local-offer") {
              await peer.setRemoteDescription(new RTCSessionDescription(p.answer));
              for (const c of pendingIceRef.current.get(idOf(p.from)) || []) await peer.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
              pendingIceRef.current.delete(idOf(p.from));
            }
          },
          "webrtc-ice": async p => {
            if (idOf(p?.to) !== identity || !p?.candidate) return;
            const from = idOf(p.from), peer = peersRef.current.get(from);
            if (!peer?.remoteDescription) pendingIceRef.current.set(from, [...(pendingIceRef.current.get(from) || []), p.candidate]);
            else await peer.addIceCandidate(new RTCIceCandidate(p.candidate)).catch(() => {});
          },
          "participant-left": p => { if (idOf(p?.user_id) !== identity) closePeer(p?.user_id); },
        };
        Object.entries(handlers).forEach(([event, handler]) => channel.on("broadcast", { event }, ({ payload }) => {
          if (!cancelled) Promise.resolve(handler(payload || {})).catch(e => console.warn("Meeting signalling failed", e));
        }));
        channel.on("presence", { event: "sync" }, () => {
          if (cancelled) return;
          const state = channel.presenceState();
          const all = Object.entries(state).flatMap(([key, entries]) => (entries || []).map(p => ({ ...p, user_id: idOf(p.user_id || key) })));
          const unique = [...new Map(all.map(p => [p.user_id, p])).values()];
          setParticipants(unique);
          unique.filter(p => p.user_id !== identity && identity < p.user_id).forEach(p => createPeer(p.user_id, true).catch(e => console.warn("WebRTC offer failed", e)));
        });
        await new Promise((resolve, reject) => {
          const timer = window.setTimeout(() => reject(new Error("Muda wa kuunganisha chumba umeisha. Jaribu tena.")), 15000);
          channel.subscribe((status, err) => {
            if (status === "SUBSCRIBED") { window.clearTimeout(timer); resolve(); }
            if (["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status)) { window.clearTimeout(timer); reject(new Error(err?.message || "Imeshindikana kuunganisha chumba.")); }
          });
        });
        if (cancelled) return;
        await channel.track({ user_id: identity, display_name: nameRef.current, joined_at: new Date().toISOString(), mic_enabled: true, camera_enabled: true, role: isAdmin ? "host" : "participant" });
        setRoomState("Imeunganishwa");
      } catch (e) { if (!cancelled) setError(e?.message || "Imeshindikana kuunganisha video conference."); }
      finally { if (!cancelled) setConnecting(false); }
    };
    connect();
    return () => { cancelled = true; cleanup(); };
  }, [connectionInfo?.roomCode, connectionInfo?.identity, connectionInfo?.displayName, isAdmin, closePeer, createPeer, send]);

  useEffect(() => {
    if (!meeting?.id) return;
    let active = true;
    const check = async () => {
      try {
        const config = authToken ? { headers: { Authorization: "Bearer " + authToken } } : undefined;
        const response = isAdmin ? await api.get("/parent-portal/staff/meetings", config) : await api.get("/parent-portal/meetings/active", config);
        const rows = isAdmin ? (response.data?.meetings || []).filter(row => row.status === "scheduled" && !row.ends_at) : [response.data?.meeting].filter(Boolean);
        if (active && !rows.some(row => String(row.id) === String(meeting.id))) { setRoomState("Mkutano umemalizika"); onLeaveRef.current?.(); }
      } catch (e) {
        if (active && [401,403].includes(e?.response?.status)) { setError("Ruhusa ya mkutano imeisha. Ingia tena."); onLeaveRef.current?.(); }
      }
    };
    const timer = window.setInterval(check, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [meeting?.id, authToken, isAdmin]);

  const toggleCamera = async () => { const t = localStreamRef.current?.getVideoTracks?.()[0]; if (!t) return; t.enabled = !t.enabled; setCameraOn(t.enabled); await send("media-state", { user_id: identityRef.current, camera_enabled: t.enabled }); };
  const toggleMic = async () => { const t = localStreamRef.current?.getAudioTracks?.()[0]; if (!t) return; t.enabled = !t.enabled; setMicOn(t.enabled); await send("media-state", { user_id: identityRef.current, mic_enabled: t.enabled }); };
  const leave = async () => { await send("participant-left", { user_id: identityRef.current }); onLeave?.(); };
  const end = async () => { if (!isAdmin || ending) return; setEnding(true); try { await onEnd?.(); } catch (e) { setError(e?.message || "Imeshindikana kumaliza mkutano."); setEnding(false); } };
  const tiles = [{ participant: { user_id: identityRef.current, display_name: nameRef.current }, stream: localStreamRef.current, local: true },
    ...participants.filter(p => p.user_id !== identityRef.current).map(participant => ({ participant, stream: remoteStreamsRef.current.get(participant.user_id), local: false }))];
  void version;
  return <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900/80 p-4 md:p-5"><div><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500"/><span className="text-xs font-black uppercase tracking-widest text-rose-300">LIVE</span><span className="text-xs text-slate-400">{roomState}</span></div><h2 className="mt-1 text-lg font-black">{meeting?.title || "Mkutano wa wazazi"}</h2><p className="mt-1 text-xs text-slate-400">{participants.length} washiriki wameunganishwa</p></div><span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">{connecting ? "Inaunganisha..." : "Mkutano unaendelea"}</span></header>
    {error && <div role="alert" className="m-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{tiles.map(tile => <VideoTile key={tile.participant.user_id} participant={tile.participant} stream={tile.stream} local={tile.local}/>)}{!connecting && participants.length <= 1 && <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">Subiri washiriki wengine waingie kwenye mkutano.</div>}</div>
    <footer className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 bg-slate-900/80 p-4"><button type="button" onClick={toggleMic} disabled={connecting} className={"rounded-xl px-5 py-3 text-sm font-bold " + (micOn ? "bg-emerald-600" : "bg-slate-700")}>{micOn ? "Zima Mic" : "Washa Mic"}</button><button type="button" onClick={toggleCamera} disabled={connecting} className={"rounded-xl px-5 py-3 text-sm font-bold " + (cameraOn ? "bg-blue-600" : "bg-slate-700")}>{cameraOn ? "Zima Kamera" : "Washa Kamera"}</button>{isAdmin ? <button type="button" onClick={end} disabled={ending || connecting} className="rounded-xl bg-rose-600 px-6 py-3 text-sm font-black hover:bg-rose-500 disabled:opacity-50">{ending ? "Inamaliza..." : "Maliza mkutano"}</button> : <button type="button" onClick={leave} className="rounded-xl bg-rose-600 px-6 py-3 text-sm font-black hover:bg-rose-500">Ondoka</button>}</footer>
  </section>;
}
