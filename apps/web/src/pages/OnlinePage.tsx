import { useEffect, useMemo, useState } from "react";
import type { Loadout } from "@paddle-tactics/game-core";
import { fetchCatalog } from "../lib/api.js";
import type { PublicCatalog } from "../lib/api.js";
import {
  emitOnline,
  getGameSocket,
  getGuestSessionId,
  type OnlineRoomSnapshot,
} from "../lib/online.js";

type Props = { navigate: (path: string) => void; roomCode?: string };
type SeatLoadout = Loadout;

function initialLoadout(catalog: PublicCatalog): SeatLoadout {
  return {
    playerId: catalog.players[0]!.id,
    bladeId: catalog.blades[0]!.id,
    forehandRubberId: catalog.rubbers[0]!.id,
    backhandRubberId: catalog.rubbers[0]!.id,
  };
}

export function OnlinePage({ navigate, roomCode }: Props) {
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [loadout, setLoadout] = useState<SeatLoadout | null>(null);
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(3);
  const [room, setRoom] = useState<OnlineRoomSnapshot | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [typedCode, setTypedCode] = useState(roomCode ?? "");
  const [socketState, setSocketState] = useState("正在连接…");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let cleanup = () => undefined;
    void (async () => {
      try {
        const [loadedCatalog, identity, socket] = await Promise.all([
          fetchCatalog(),
          getGuestSessionId(),
          getGameSocket(),
        ]);
        if (!active) return;
        setCatalog(loadedCatalog);
        setLoadout(initialLoadout(loadedCatalog));
        setSessionId(identity);
        setSocketState(socket.connected ? "已连接" : "正在连接…");
        const onConnect = () => {
          setSocketState("已连接");
          if (roomCode) {
            void emitOnline<{ room: OnlineRoomSnapshot }>(
              socket,
              "match:request-snapshot",
              {},
            )
              .then((response) => response.room && setRoom(response.room))
              .catch(() => undefined);
          }
        };
        const onDisconnect = () => setSocketState("连接中断，正在重连…");
        const onRoom = (message: { room: OnlineRoomSnapshot }) => {
          if (!active) return;
          setRoom(message.room);
          if (message.room.status === "ACTIVE")
            navigate(`/online/${message.room.roomCode}/match`);
        };
        const onSeat = (message: { roomCode: string; seat: "A" | "B" }) => {
          localStorage.setItem(
            "paddle-tactics-online-room",
            `${message.roomCode}:${message.seat}`,
          );
        };
        const onMatch = () => {
          if (roomCode) navigate(`/online/${roomCode}/match`);
        };
        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("room:snapshot", onRoom);
        socket.on("match:snapshot", onMatch);
        socket.on("room:seat", onSeat);
        if (socket.connected) onConnect();
        cleanup = () => {
          socket.off("connect", onConnect);
          socket.off("disconnect", onDisconnect);
          socket.off("room:snapshot", onRoom);
          socket.off("match:snapshot", onMatch);
          socket.off("room:seat", onSeat);
        };
        if (roomCode) {
          const response = await fetch(
            `/api/rooms/${encodeURIComponent(roomCode)}`,
          );
          const initialRoom: unknown = await response.json().catch(() => null);
          if (
            active &&
            response.ok &&
            initialRoom &&
            typeof initialRoom === "object" &&
            "roomCode" in initialRoom
          )
            setRoom(initialRoom as OnlineRoomSnapshot);
        }
      } catch (cause: unknown) {
        if (active)
          setError(cause instanceof Error ? cause.message : "无法连接联机服务");
      }
    })();
    return () => {
      active = false;
      cleanup();
    };
  }, [navigate, roomCode]);

  const selectOptions = useMemo(() => {
    if (!catalog) return null;
    return {
      players: catalog.players,
      blades: catalog.blades,
      rubbers: catalog.rubbers,
    };
  }, [catalog]);

  const updateLoadout = (key: keyof SeatLoadout, value: string) =>
    setLoadout((current) => (current ? { ...current, [key]: value } : current));

  const perform = async (kind: "create" | "join") => {
    if (!loadout) return;
    setBusy(true);
    setError(null);
    try {
      const socket = await getGameSocket();
      if (!socket.connected)
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(
            () => reject(new Error("联机服务暂时不可用")),
            10000,
          );
          socket.once("connect", () => {
            window.clearTimeout(timer);
            resolve();
          });
          socket.once("connect_error", () => {
            window.clearTimeout(timer);
            reject(new Error("无法连接联机服务"));
          });
        });
      const response = await emitOnline<{
        room: OnlineRoomSnapshot;
        seat: "A" | "B";
      }>(
        socket,
        kind === "create" ? "room:create" : "room:join",
        kind === "create"
          ? { bestOf, loadout }
          : { roomCode: typedCode.trim().toUpperCase(), loadout },
      );
      setRoom(response.room);
      localStorage.setItem(
        "paddle-tactics-online-room",
        `${response.room.roomCode}:${response.seat}`,
      );
      navigate(`/online/${response.room.roomCode}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "房间操作失败");
    } finally {
      setBusy(false);
    }
  };

  const setReady = async () => {
    if (!room) return;
    setBusy(true);
    setError(null);
    try {
      const socket = await getGameSocket();
      const response = await emitOnline<{ room: OnlineRoomSnapshot }>(
        socket,
        "room:ready",
        {
          ready: !room.players.find((player) => player.seat === mySeat)?.ready,
        },
      );
      setRoom(response.room);
      if (response.room.status === "ACTIVE")
        navigate(`/online/${response.room.roomCode}/match`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "准备状态更新失败");
    } finally {
      setBusy(false);
    }
  };

  const mySeat = room?.players.find((player) => {
    // The currently connected guest ID is never sent in the public room snapshot.
    // A local room marker identifies this browser's creator seat; otherwise it joined seat B.
    const seatMarker = localStorage.getItem("paddle-tactics-online-room");
    return seatMarker === `${room?.roomCode}:${player.seat}`;
  })?.seat;
  const isMember = Boolean(room && sessionId && mySeat);
  const slotBEmpty = Boolean(room && !room.players[1]?.loadout);
  const selectedPlayerName = (id: string | null) =>
    catalog?.players.find((player) => player.id === id)?.name ?? "等待玩家加入";

  if (!catalog || !loadout || !selectOptions)
    return (
      <main className="content-page narrow-page">
        <div className="loading-panel">正在准备联机房间…</div>
      </main>
    );

  return (
    <main className="content-page narrow-page online-page">
      <button className="back-link" onClick={() => navigate("/play")}>
        ← 返回对局方式
      </button>
      <span className="eyebrow">ONLINE FRIEND MATCH</span>
      <h1 className="page-title">在线双人对局</h1>
      <p className="page-lede">
        创建房间分享链接，或输入朋友发来的 6 位房间码。无需注册账号。
      </p>
      <div className="online-connection">
        <i /> {socketState}
      </div>

      <section className="online-loadout-card">
        <h2>你的球员与装备</h2>
        <div className="select-grid">
          <label className="field field-wide">
            球员
            <select
              value={loadout.playerId}
              onChange={(event) =>
                updateLoadout("playerId", event.target.value)
              }
            >
              {selectOptions.players.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field field-wide">
            底板
            <select
              value={loadout.bladeId}
              onChange={(event) => updateLoadout("bladeId", event.target.value)}
            >
              {selectOptions.blades.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            正手胶皮
            <select
              value={loadout.forehandRubberId}
              onChange={(event) =>
                updateLoadout("forehandRubberId", event.target.value)
              }
            >
              {selectOptions.rubbers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            反手胶皮
            <select
              value={loadout.backhandRubberId}
              onChange={(event) =>
                updateLoadout("backhandRubberId", event.target.value)
              }
            >
              {selectOptions.rubbers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {roomCode && room ? (
        <section className="online-room-card">
          <div className="online-room-code">
            <div>
              <span className="eyebrow">ROOM CODE</span>
              <strong>{room.roomCode}</strong>
            </div>
            <button
              className="button button-secondary"
              onClick={() =>
                void navigator.clipboard?.writeText(
                  `${window.location.origin}/online/${room.roomCode}`,
                )
              }
            >
              复制邀请链接
            </button>
          </div>
          <p>
            BO{room.bestOf} · 房间状态：
            {room.status === "WAITING"
              ? "等待准备"
              : room.status === "ACTIVE"
                ? "比赛进行中"
                : room.status === "COMPLETED"
                  ? "比赛已结束"
                  : "房间已关闭"}
          </p>
          <div className="online-player-slots">
            {room.players.map((player) => (
              <div className="online-player-slot" key={player.seat}>
                <span>选手 {player.seat}</span>
                <strong>
                  {selectedPlayerName(player.loadout?.playerId ?? null)}
                </strong>
                <small>
                  {player.ready
                    ? "已准备"
                    : player.loadout
                      ? "尚未准备"
                      : "等待加入"}{" "}
                  · {player.connected ? "在线" : "离线"}
                </small>
              </div>
            ))}
          </div>
          {room.status === "WAITING" && isMember && (
            <button
              className="button button-primary"
              disabled={busy || !room.players[1]?.loadout}
              onClick={() => void setReady()}
            >
              {busy
                ? "正在更新…"
                : room.players.find((player) => player.seat === mySeat)?.ready
                  ? "取消准备"
                  : "准备开始"}
            </button>
          )}
          {room.status === "WAITING" && !isMember && slotBEmpty && (
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => void perform("join")}
            >
              加入这个房间
            </button>
          )}
          {room.status === "ACTIVE" && (
            <button
              className="button button-primary"
              onClick={() => navigate(`/online/${room.roomCode}/match`)}
            >
              进入比赛
            </button>
          )}
        </section>
      ) : (
        <section className="online-actions-card">
          <label className="field">
            比赛长度
            <select
              value={bestOf}
              onChange={(event) =>
                setBestOf(Number(event.target.value) as 1 | 3 | 5)
              }
            >
              <option value={1}>BO1 · 一局定胜负</option>
              <option value={3}>BO3 · 三局两胜</option>
              <option value={5}>BO5 · 五局三胜</option>
            </select>
          </label>
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() => void perform("create")}
          >
            创建房间
          </button>
          <div className="online-code-entry">
            <label className="field">
              朋友的 6 位房间码
              <input
                value={typedCode}
                maxLength={6}
                autoCapitalize="characters"
                onChange={(event) =>
                  setTypedCode(event.target.value.toUpperCase())
                }
                placeholder="例如 7K4P2M"
              />
            </label>
            <button
              className="button button-secondary"
              disabled={busy || typedCode.trim().length !== 6}
              onClick={() => {
                if (roomCode) void perform("join");
                else navigate(`/online/${typedCode.trim().toUpperCase()}`);
              }}
            >
              加入房间
            </button>
          </div>
        </section>
      )}
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      <p className="mode-footnote">
        在线对局由服务器裁定。未揭晓的秘密加点不会发送给对手。
      </p>
    </main>
  );
}
