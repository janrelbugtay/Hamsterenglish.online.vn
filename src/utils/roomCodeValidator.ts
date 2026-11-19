import { doc, getDoc } from "firebase/firestore";
import { db, isFirestoreQuotaExhausted } from "../lib/firebase";
import { ViewState } from "../types";

export interface RoomCodeValidationResult {
  valid: boolean;
  gameView?: ViewState;
  roomCode: string;
  error?: string;
}

export function pingSameBrowserHost(channelName: string, code: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof BroadcastChannel === "undefined") {
      resolve(false);
      return;
    }
    let settled = false;
    let bc: BroadcastChannel | null = null;
    const done = (found: boolean) => {
      if (settled) return;
      settled = true;
      try {
        bc?.close();
      } catch {}
      resolve(found);
    };
    const timer = window.setTimeout(() => done(false), 260);
    try {
      bc = new BroadcastChannel(channelName);
      bc.onmessage = (ev) => {
        if (ev?.data?.type === "pong_host") {
          window.clearTimeout(timer);
          done(true);
        }
      };
      bc.postMessage({ type: "ping_host", roomCode: code });
    } catch {
      window.clearTimeout(timer);
      done(false);
    }
  });
}

async function checkPaintballServer(code: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/paintball/room/${encodeURIComponent(code)}`);
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(
      data?.exists === true ||
        (data?.room && data.room.isUninitialized === false && !data.room.hostClosed)
    );
  } catch {
    return false;
  }
}

async function checkPaintballFirestore(code: string): Promise<boolean> {
  if (isFirestoreQuotaExhausted()) return false;
  try {
    const pbSnap = await getDoc(doc(db, "ttt_rooms", `pb_room_${code}`));
    if (!pbSnap.exists()) return false;
    const pbData = pbSnap.data();
    return Boolean(pbData && pbData.isUninitialized !== true && pbData.hostClosed !== true);
  } catch {
    return false;
  }
}

async function checkTicTacToeServer(code: string): Promise<boolean> {
  try {
    const tttRes = await fetch(`/api/tictactoe/room/${encodeURIComponent(code)}`);
    if (!tttRes.ok) return false;
    const tttData = await tttRes.json();
    return Boolean(tttData?.exists === true);
  } catch {
    return false;
  }
}

async function checkTicTacToeFirestore(code: string): Promise<boolean> {
  if (isFirestoreQuotaExhausted()) return false;
  try {
    const tttSnap = await getDoc(doc(db, "ttt_rooms", code));
    if (!tttSnap.exists()) return false;
    const tttDoc = tttSnap.data();
    return Boolean(
      tttDoc?.state?.roomId === code &&
        tttDoc?.state?.status &&
        tttDoc.state.status !== "SETUP" &&
        !tttDoc.closed
    );
  } catch {
    return false;
  }
}

/**
 * Validates whether a 6-character room code was actively created by a host
 * in a multiplayer game (Hamster Paintball or Tic-Tac-Toe).
 */
export async function verifyMultiplayerRoomCode(rawCode: string): Promise<RoomCodeValidationResult> {
  const cleaned = String(rawCode || "")
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase()
    .trim()
    .slice(0, 6);

  if (!cleaned || cleaned.length < 6) {
    return {
      valid: false,
      roomCode: cleaned,
      error: "Please enter the complete 6-character code from your host.",
    };
  }

  // Run fast server API + same-browser checks first in parallel
  const [pbServer, pbBroadcast, tttServer, tttBroadcast] = await Promise.all([
    checkPaintballServer(cleaned),
    pingSameBrowserHost(`hamster_paintball_net_${cleaned}`, cleaned),
    checkTicTacToeServer(cleaned),
    pingSameBrowserHost(`ttt_room_net_${cleaned}`, cleaned),
  ]);

  if (pbServer || pbBroadcast) {
    return {
      valid: true,
      gameView: "hamster-paintball",
      roomCode: cleaned,
    };
  }

  if (tttServer || tttBroadcast) {
    return {
      valid: true,
      gameView: "tic-tac-toe",
      roomCode: cleaned,
    };
  }

  // Fallback to Firestore checks in parallel
  const [pbFirestore, tttFirestore] = await Promise.all([
    checkPaintballFirestore(cleaned),
    checkTicTacToeFirestore(cleaned),
  ]);

  if (pbFirestore) {
    return {
      valid: true,
      gameView: "hamster-paintball",
      roomCode: cleaned,
    };
  }

  if (tttFirestore) {
    return {
      valid: true,
      gameView: "tic-tac-toe",
      roomCode: cleaned,
    };
  }

  return {
    valid: false,
    roomCode: cleaned,
    error: `Incorrect room code "${cleaned}". No host is currently hosting a game with this code.`,
  };
}
