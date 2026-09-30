import { io, type Socket } from "socket.io-client";
import type { GameCommand, MatchPublicView } from "@paddle-tactics/game-core";
import type { Loadout } from "@paddle-tactics/game-core";

const STORAGE_KEY = "paddle-tactics-guest-session";
let gameSocket: Socket | null = null;
let guestSessionPromise: Promise<StoredGuest> | null = null;

type StoredGuest = { id: string; token: string; expiresAt: string };
export type OnlineRoomSnapshot = {
  roomCode: string;
  bestOf: 1 | 3 | 5;
  status: "WAITING" | "ACTIVE" | "COMPLETED" | "CLOSED";
  players: Array<{
    seat: "A" | "B";
    loadout: Loadout | null;
    ready: boolean;
    connected: boolean;
  }>;
};
export type OnlineAck<T> = { ok: true } & T;

async function getGuestSession(): Promise<StoredGuest> {
  if (guestSessionPromise) return guestSessionPromise;
  guestSessionPromise = createOrLoadGuestSession();
  try {
    return await guestSessionPromise;
  } finally {
    guestSessionPromise = null;
  }
}

async function createOrLoadGuestSession(): Promise<StoredGuest> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as StoredGuest;
      if (parsed.token && new Date(parsed.expiresAt).getTime() > Date.now())
        return parsed;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  const response = await fetch("/api/guest-session", { method: "POST" });
  const raw: unknown = await response.json().catch(() => null);
  if (
    !response.ok ||
    typeof raw !== "object" ||
    raw === null ||
    !("id" in raw) ||
    !("token" in raw) ||
    !("expiresAt" in raw)
  )
    throw new Error("无法建立访客会话，请稍后重试");
  const identity = raw as StoredGuest;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

export async function getGuestSessionId(): Promise<string> {
  return (await getGuestSession()).id;
}

export async function getGameSocket(): Promise<Socket> {
  if (gameSocket?.connected) return gameSocket;
  const { token } = await getGuestSession();
  if (!gameSocket) {
    gameSocket = io(`${window.location.origin}/game`, {
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
  } else {
    gameSocket.auth = { token };
  }
  if (!gameSocket.connected) gameSocket.connect();
  return gameSocket;
}

export async function emitOnline<T>(
  socket: Socket,
  event: string,
  payload: unknown,
): Promise<T> {
  let response: unknown;
  try {
    response = await socket.timeout(12000).emitWithAck(event, payload);
  } catch {
    throw new Error("网络连接中断，请检查连接后重试");
  }
  if (typeof response !== "object" || response === null || !("ok" in response))
    throw new Error("服务器返回了无效响应");
  if (!response.ok) {
    const message =
      "message" in response ? String(response.message) : "操作未能完成";
    throw new Error(message);
  }
  return response as T;
}

export async function sendOnlineCommand(
  socket: Socket,
  expectedVersion: number,
  command: GameCommand,
): Promise<MatchPublicView> {
  const payload = Object.fromEntries(
    Object.entries(command).filter(([key]) => key !== "expectedVersion"),
  );
  const response = await emitOnline<{ view: MatchPublicView }>(
    socket,
    "match:command",
    {
      clientCommandId: crypto.randomUUID(),
      expectedVersion,
      command: payload,
    },
  );
  return response.view;
}
