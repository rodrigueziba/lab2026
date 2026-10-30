// N5: Remote session abstraction — architecture not yet decided.
// Defines the interface and a mock implementation; LiveKitRemoteSession is a skeleton.

export type RemoteSessionStatus = 'idle' | 'connecting' | 'active' | 'error';

export interface RemoteSession {
  status: RemoteSessionStatus;
  /** Returns a <video> element (live stream) or <img> (still), or null if no image available. */
  getImage(): HTMLVideoElement | HTMLImageElement | null;
  /** Returns the remote audio source node connected to the given AudioContext, or null. */
  getAudio(ctx: AudioContext): AudioNode | null;
  /** Notify the session whether this client is currently watching (connected). */
  setWatching(watching: boolean): void;
  /** Subscribe to watcher-count updates; returns unsubscribe function. */
  onWatchers(cb: (count: number) => void): () => void;
  dispose(): void;
}

// ── MockRemoteSession ─────────────────────────────────────────────────────────
// Always idle, returns null for media. Used when no session URL is configured.
export class MockRemoteSession implements RemoteSession {
  status: RemoteSessionStatus = 'idle';
  getImage()                            { return null; }
  getAudio(_ctx: AudioContext)          { return null; }
  setWatching(_watching: boolean)       {}
  onWatchers(_cb: (n: number) => void)  { return () => {}; }
  dispose()                             {}
}

// ── LiveKitRemoteSession (skeleton) ───────────────────────────────────────────
// Not wired — LiveKit SDK not installed. Placeholder that matches the interface.
export class LiveKitRemoteSession implements RemoteSession {
  status: RemoteSessionStatus = 'idle';
  private _watcherCbs: Set<(n: number) => void> = new Set();

  getImage()           { return null; }
  getAudio(_ctx: AudioContext) { return null; }
  setWatching(_watching: boolean) { /* TODO: publish presence track */ }

  onWatchers(cb: (n: number) => void): () => void {
    this._watcherCbs.add(cb);
    return () => this._watcherCbs.delete(cb);
  }

  dispose() {
    this._watcherCbs.clear();
    // TODO: disconnect LiveKit room
  }
}

// ── Active session singleton ───────────────────────────────────────────────────
export let SESSION: RemoteSession = new MockRemoteSession();

export function setSession(s: RemoteSession): void {
  SESSION.dispose();
  SESSION = s;
}
