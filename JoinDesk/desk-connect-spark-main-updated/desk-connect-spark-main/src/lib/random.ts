import { API_URL, AUTH_TOKEN_KEY, api } from "@/lib/api";

// =========================
// Types (mirror /api/random)
// =========================
export type RandomConfig = {
  enabled: boolean;
  paid: boolean;
  allowed: boolean;
  iceServers: RTCIceServer[];
  payment: { priceInr: number; days: number; message: string } | null;
};

export type RoomView = {
  roomId: string;
  status: "waiting" | "matched" | "ended";
  role: "caller" | "callee";
  offer: string | null;
  answer: string | null;
  endedByMe: boolean;
};

export type ReportReason = "nudity" | "harassment" | "underage" | "spam" | "other";

export const randomApi = {
  config: () => api.get<RandomConfig>("/api/random/config"),
  join: () => api.post<RoomView>("/api/random/join"),
  poll: (id: string) => api.get<RoomView>(`/api/random/room/${id}`),
  offer: (id: string, sdp: string) => api.post<{ ok: true }>(`/api/random/room/${id}/offer`, { sdp }),
  answer: (id: string, sdp: string) => api.post<{ ok: true }>(`/api/random/room/${id}/answer`, { sdp }),
  leave: (id: string) => api.post<{ ok: true }>(`/api/random/room/${id}/leave`),
  report: (id: string, reason: ReportReason, details: string) =>
    api.post<{ ok: true }>(`/api/random/room/${id}/report`, { reason, details }),
  block: (id: string) => api.post<{ ok: true }>(`/api/random/room/${id}/block`),
};

// =========================
// The call itself
// =========================
export type CallState = "idle" | "searching" | "connecting" | "connected" | "partner-left" | "failed";

type Handlers = {
  onState: (state: CallState) => void;
  onRemote: (stream: MediaStream | null) => void;
};

const WAIT_POLL_MS = 5000; // while nobody has been found yet
const SHAKE_POLL_MS = 1000; // only during the few seconds of the handshake
const CONNECT_TIMEOUT_MS = 20_000;
const ICE_GATHER_MS = 4000;
const MAX_POLL_ERRORS = 5;

/** Resolves when the browser has found its network addresses (or after a short wait). */
function waitForIce(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    const timer = setTimeout(done, ICE_GATHER_MS);
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

/**
 * One person's side of a random 1-on-1 call.
 *
 * Matching and the connection handshake go through our own backend (plain
 * HTTP, so it works on Vercel). Once connected, video and audio travel
 * directly between the two browsers. Nothing keeps polling during the call:
 * a small data channel tells the other side instantly when someone presses
 * Next or Stop, and the browser's own connection state covers a closed tab.
 */
export class RandomClient {
  private pc: RTCPeerConnection | null = null;
  // One stream that holds BOTH the other person's audio and video tracks, however the browser groups them.
  private remote: MediaStream | null = null;
  private dc: RTCDataChannel | null = null;
  private roomId: string | null = null;
  private lastRoom: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private discTimer: ReturnType<typeof setTimeout> | null = null;
  private run = 0; // bumped on every start/stop so stale async work stops itself
  private negotiating = false;
  private answered = false;
  private gotAnswer = false;
  private connected = false;
  private matchedAt = 0;
  private pollErrors = 0;

  constructor(
    private readonly stream: MediaStream,
    private readonly iceServers: RTCIceServer[],
    private readonly h: Handlers,
  ) {}

  /** The room of the person you're (or were just) talking to, for Report / Block. */
  get partnerRoomId(): string | null {
    return this.lastRoom;
  }

  /** Looks for someone. Throws an ApiError (402 / 403 / 503) if you may not use Random chat. */
  async start(): Promise<void> {
    this.teardown();
    const run = ++this.run;
    this.negotiating = this.answered = this.gotAnswer = this.connected = false;
    this.pollErrors = 0;
    this.lastRoom = null;
    this.h.onState("searching");

    const view = await randomApi.join();
    if (run !== this.run) {
      void randomApi.leave(view.roomId).catch(() => {});
      return;
    }
    await this.handle(run, view);
  }

  /** "Next": tell the other person, then look for someone new. */
  async next(): Promise<void> {
    this.sayBye();
    await this.start();
  }

  /** "Stop": leave and go back to the start screen. */
  stop(): void {
    const id = this.roomId;
    this.sayBye();
    this.run += 1;
    this.teardown();
    if (id) void randomApi.leave(id).catch(() => {});
    this.h.onState("idle");
  }

  /** Page is closing: tell the server (keepalive) without touching the UI. */
  dispose(): void {
    const id = this.roomId;
    this.sayBye();
    this.run += 1;
    this.teardown();
    if (id) {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      void fetch(`${API_URL}/api/random/room/${id}/leave`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      }).catch(() => {});
    }
  }

  // ---------- internals ----------

  private sayBye() {
    try {
      if (this.dc && this.dc.readyState === "open") this.dc.send("bye");
    } catch {
      /* the channel is already gone */
    }
  }

  private teardown() {
    if (this.timer) clearTimeout(this.timer);
    if (this.discTimer) clearTimeout(this.discTimer);
    this.timer = this.discTimer = null;
    if (this.dc) {
      this.dc.onmessage = null;
      try {
        this.dc.close();
      } catch {
        /* ignore */
      }
    }
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.ondatachannel = null;
      try {
        this.pc.close();
      } catch {
        /* ignore */
      }
    }
    this.dc = null;
    this.pc = null;
    this.remote = null;
    this.roomId = null;
    this.h.onRemote(null);
  }

  private schedulePoll(run: number, ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.poll(run), ms);
  }

  private async poll(run: number) {
    if (run !== this.run || !this.roomId) return;
    try {
      const view = await randomApi.poll(this.roomId);
      if (run !== this.run) return;
      this.pollErrors = 0;
      await this.handle(run, view);
    } catch {
      if (run !== this.run) return;
      this.pollErrors += 1;
      if (this.pollErrors >= MAX_POLL_ERRORS) return this.fail(run);
      this.schedulePoll(run, SHAKE_POLL_MS * 2);
    }
  }

  /** Reacts to what the server says about our room. */
  private async handle(run: number, v: RoomView) {
    if (run !== this.run) return;
    this.roomId = v.roomId; // can change if we ended up joining an older waiting room

    if (v.status === "ended") return this.partnerGone(run, v.endedByMe);

    if (v.status === "waiting") {
      this.schedulePoll(run, WAIT_POLL_MS);
      return;
    }

    // matched
    this.lastRoom = v.roomId;
    if (!this.negotiating) {
      this.negotiating = true;
      this.matchedAt = Date.now();
      this.h.onState("connecting");
      try {
        await this.createPeer(run, v);
      } catch {
        return this.fail(run);
      }
      if (run !== this.run) return;
    }
    if (this.connected) return; // nothing left to poll for

    try {
      if (v.role === "callee" && v.offer && !this.answered) {
        this.answered = true;
        await this.answerOffer(v.offer, v.roomId);
      } else if (v.role === "caller" && v.answer && !this.gotAnswer) {
        this.gotAnswer = true;
        await this.pc?.setRemoteDescription(JSON.parse(v.answer) as RTCSessionDescriptionInit);
      }
    } catch {
      return this.fail(run);
    }
    if (run !== this.run) return;

    if (Date.now() - this.matchedAt > CONNECT_TIMEOUT_MS) return this.fail(run);
    this.schedulePoll(run, SHAKE_POLL_MS);
  }

  private async createPeer(run: number, v: RoomView) {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.pc = pc;
    this.stream.getTracks().forEach((t) => pc.addTrack(t, this.stream));

    // Audio and video arrive as separate "track" events. Some browsers give each its own (or no)
    // stream, which used to replace the video's stream with an audio-only one and lose the sound.
    // So we always collect every incoming track into ONE stream.
    pc.ontrack = (e) => {
      if (!this.remote) this.remote = new MediaStream();
      if (!this.remote.getTracks().some((t) => t.id === e.track.id)) this.remote.addTrack(e.track);
      this.h.onRemote(this.remote);
    };
    // make sure we both send and receive audio and video
    pc.getTransceivers().forEach((t) => {
      if (t.sender.track) {
        try {
          t.direction = "sendrecv";
        } catch {
          /* already fine */
        }
      }
    });
    pc.onconnectionstatechange = () => this.onConnection(run);

    if (v.role === "caller") {
      this.bindChannel(run, pc.createDataChannel("ctl"));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIce(pc);
      if (run !== this.run) return;
      await randomApi.offer(v.roomId, JSON.stringify(pc.localDescription));
    } else {
      pc.ondatachannel = (e) => this.bindChannel(run, e.channel);
    }
  }

  private async answerOffer(offer: string, roomId: string) {
    const pc = this.pc;
    if (!pc) return;
    await pc.setRemoteDescription(JSON.parse(offer) as RTCSessionDescriptionInit);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIce(pc);
    await randomApi.answer(roomId, JSON.stringify(pc.localDescription));
  }

  private bindChannel(run: number, dc: RTCDataChannel) {
    this.dc = dc;
    dc.onmessage = (e) => {
      if (e.data === "bye") this.partnerGone(run, false);
    };
  }

  private onConnection(run: number) {
    if (run !== this.run || !this.pc) return;
    const state = this.pc.connectionState;
    if (state === "connected") {
      if (this.discTimer) clearTimeout(this.discTimer);
      this.connected = true;
      if (this.timer) clearTimeout(this.timer);
      this.h.onState("connected");
      void this.capBitrate();
    } else if (state === "disconnected") {
      // a short hiccup is normal; a long one means they're gone (closed tab, lost network)
      if (this.discTimer) clearTimeout(this.discTimer);
      this.discTimer = setTimeout(() => {
        if (run === this.run && this.pc?.connectionState !== "connected") this.partnerGone(run, false);
      }, 8000);
    } else if (state === "failed") {
      if (this.connected) this.partnerGone(run, false);
      else this.fail(run);
    }
  }

  /** Keeps video light so it also works on slow networks (and stays cheap if a relay is added later). */
  private async capBitrate() {
    try {
      const sender = this.pc?.getSenders().find((s) => s.track?.kind === "video");
      if (!sender) return;
      const params = sender.getParameters();
      const first = params.encodings?.[0] ?? {};
      params.encodings = [{ ...first, maxBitrate: 700_000 }];
      await sender.setParameters(params);
    } catch {
      /* not supported everywhere: fine */
    }
  }

  private partnerGone(run: number, byMe: boolean) {
    if (run !== this.run) return;
    this.run += 1; // stops every loop of this call
    this.teardown();
    this.h.onState(byMe ? "idle" : "partner-left");
  }

  private fail(run: number) {
    if (run !== this.run) return;
    const id = this.roomId;
    this.run += 1;
    this.teardown();
    if (id) void randomApi.leave(id).catch(() => {});
    this.h.onState("failed");
  }
}
