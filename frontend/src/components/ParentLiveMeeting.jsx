import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

function VideoTile({ item }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  useEffect(() => {
    if (!item?.track) return undefined;
    const element = item.track.kind === Track.Kind.Video ? videoRef.current : audioRef.current;
    if (!element) return undefined;
    item.track.attach(element);
    if (element instanceof HTMLMediaElement) element.play?.().catch(() => {});
    return () => { try { item.track.detach(element); } catch {} };
  }, [item]);
  return (
    <article className="relative min-h-44 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
      {item.track.kind === Track.Kind.Video
        ? <video ref={videoRef} autoPlay playsInline muted={item.local} className="h-full min-h-44 w-full object-cover" />
        : <div className="flex min-h-44 items-center justify-center text-4xl text-cyan-200">{(item.name || "M").slice(0,1).toUpperCase()}</div>}
      {item.track.kind === Track.Kind.Audio && <audio ref={audioRef} autoPlay playsInline />}
      <span className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-semibold text-white">{item.name}{item.local ? " · Wewe" : ""}</span>
    </article>
  );
}

export default function ParentLiveMeeting({ meeting, connectionInfo, isAdmin = false, onEnd, onLeave }) {
  const roomRef = useRef(null);
  const [tiles, setTiles] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState("");
  const [ending, setEnding] = useState(false);
  const [roomState, setRoomState] = useState("connecting");

  const upsertTile = (item) => setTiles((current) => {
    const index = current.findIndex((tile) => tile.key === item.key);
    if (index < 0) return [...current, item];
    return current.map((tile, i) => i === index ? item : tile);
  });
  const removeTile = (key) => setTiles((current) => current.filter((tile) => tile.key !== key));

  useEffect(() => {
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    const syncParticipants = () => setParticipants(Array.from(room.remoteParticipants.values()).map((p) => ({ id: p.identity, name: p.name || p.identity })));
    room.on(RoomEvent.ConnectionStateChanged, (state) => setRoomState(state));
    room.on(RoomEvent.ParticipantConnected, syncParticipants);
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      setTiles((current) => current.filter((tile) => tile.identity !== participant.identity));
      syncParticipants();
    });
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      upsertTile({ key: participant.identity + "-" + publication.trackSid, identity: participant.identity, name: participant.name || participant.identity, track, local: false });
    });
    room.on(RoomEvent.TrackUnsubscribed, (_track, publication, participant) => removeTile(participant.identity + "-" + publication.trackSid));
    room.on(RoomEvent.LocalTrackPublished, (publication) => {
      if (publication.track && publication.source !== Track.Source.Microphone) {
        upsertTile({ key: "local-" + publication.trackSid, identity: room.localParticipant.identity, name: room.localParticipant.name || "Mimi", track: publication.track, local: true });
      }
    });
    room.on(RoomEvent.LocalTrackUnpublished, (publication) => removeTile("local-" + publication.trackSid));
    room.on(RoomEvent.Disconnected, () => setRoomState("disconnected"));

    (async () => {
      try {
        if (!connectionInfo?.token || !connectionInfo?.serverUrl) throw new Error("Taarifa za kuingia kwenye mkutano hazijakamilika.");
        await room.connect(connectionInfo.serverUrl, connectionInfo.token);
        if (cancelled) { await room.disconnect(); return; }
        try {
          await room.localParticipant.setCameraEnabled(true);
          setCameraOn(true);
        } catch { setCameraOn(false); }
        try {
          await room.localParticipant.setMicrophoneEnabled(false);
          setMicOn(false);
        } catch { setMicOn(false); }
        room.localParticipant.trackPublications.forEach((publication) => {
          if (publication.track && publication.source !== Track.Source.Microphone) {
            upsertTile({ key: "local-" + publication.trackSid, identity: room.localParticipant.identity, name: room.localParticipant.name || "Mimi", track: publication.track, local: true });
          }
        });
        room.remoteParticipants.forEach((participant) => participant.trackPublications.forEach((publication) => {
          if (publication.track && publication.isSubscribed) upsertTile({ key: participant.identity + "-" + publication.trackSid, identity: participant.identity, name: participant.name || participant.identity, track: publication.track, local: false });
        }));
        syncParticipants();
      } catch (e) {
        if (!cancelled) setError(e?.message || "Imeshindikana kuunganisha video conference.");
      } finally {
        if (!cancelled) setConnecting(false);
      }
    })();
    return () => {
      cancelled = true;
      room.disconnect();
      if (roomRef.current === room) roomRef.current = null;
    };
  }, [connectionInfo?.token, connectionInfo?.serverUrl]);

  const toggleCamera = async () => {
    try { await roomRef.current?.localParticipant.setCameraEnabled(!cameraOn); setCameraOn((v) => !v); }
    catch (e) { setError(e?.message || "Kamera haijawashwa."); }
  };
  const toggleMic = async () => {
    try { await roomRef.current?.localParticipant.setMicrophoneEnabled(!micOn); setMicOn((v) => !v); }
    catch (e) { setError(e?.message || "Maikrofoni haijawashwa."); }
  };
  const leave = async () => {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    onLeave?.();
  };
  const end = async () => {
    if (!isAdmin || ending) return;
    setEnding(true);
    try { await onEnd?.(); }
    catch (e) { setError(e?.message || "Imeshindikana kumaliza mkutano."); setEnding(false); }
  };

  return (
    <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900/80 p-4 md:p-5">
        <div className="min-w-0"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" /><span className="text-xs font-black uppercase tracking-widest text-rose-300">LIVE</span><span className="text-xs text-slate-400">{roomState}</span></div><h2 className="mt-1 truncate text-lg font-black md:text-xl">{meeting?.title || "Mkutano wa wazazi"}</h2><p className="mt-1 text-xs text-slate-400">{participants.length + 1} washiriki wameunganishwa</p></div>
        <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">{connecting ? "Inaunganisha..." : "Mkutano unaendelea"}</span>
      </header>
      {error && <div role="alert" className="m-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((item) => <VideoTile key={item.key} item={item} />)}
        {!tiles.length && !connecting && <div className="col-span-full rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-400">Subiri washiriki wengine waingie. Kamera yako inaweza kuhitaji ruhusa ya browser.</div>}
      </div>
      <footer className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 bg-slate-900/80 p-4">
        <button type="button" onClick={toggleMic} disabled={connecting} className={"rounded-xl px-5 py-3 text-sm font-bold " + (micOn ? "bg-emerald-600" : "bg-slate-700")}>{micOn ? "Zima Mic" : "Washa Mic"}</button>
        <button type="button" onClick={toggleCamera} disabled={connecting} className={"rounded-xl px-5 py-3 text-sm font-bold " + (cameraOn ? "bg-blue-600" : "bg-slate-700")}>{cameraOn ? "Zima Kamera" : "Washa Kamera"}</button>
        {isAdmin
          ? <button type="button" onClick={end} disabled={ending || connecting} className="rounded-xl bg-rose-600 px-6 py-3 text-sm font-black hover:bg-rose-500 disabled:opacity-50">{ending ? "Inamaliza..." : "End Meeting · Maliza mkutano"}</button>
          : <button type="button" onClick={leave} className="rounded-xl bg-rose-600 px-6 py-3 text-sm font-black hover:bg-rose-500">Leave Meeting · Ondoka</button>}
      </footer>
    </section>
  );
}
