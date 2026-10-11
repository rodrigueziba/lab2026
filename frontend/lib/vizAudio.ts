// G2: Audio singleton for the SILLAS visualizer path.
// Extracted from DomeVisualizer so that startVizAudio() can be called directly
// from ThreeScene's keydown handler (preserving the browser's user-gesture context).
// /login source: /music.mp3 via /api/music-list — we use the same track.

import { DBG_SILLAS } from "./debugConfig";

// ── Audio bands ────────────────────────────────────────────────────────────────
export interface AudioBands {
  sub: number; bass: number; lowMid: number; mid: number;
  highMid: number; presence: number; brilliance: number; air: number;
  rms: number; beat: number;
}
export function zeroBands(): AudioBands {
  return { sub:0, bass:0, lowMid:0, mid:0, highMid:0, presence:0, brilliance:0, air:0, rms:0, beat:0 };
}

// ── Live debug state (polled by AudioDebugOverlay) ─────────────────────────────
export const VIZ_AUDIO_DEBUG = {
  ctxState:       "none"   as string,
  sourceType:     "none"   as string,
  paused:         true     as boolean,
  currentTime:    0        as number,
  volume:         1        as number,
  muted:          false    as boolean,
  rms:            0        as number,
  lastPlayResult: ""       as string,
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type U8 = Uint8Array<ArrayBuffer>;

let _vizCtx:      AudioContext | null = null;
let _vizAnalyser: AnalyserNode | null = null;
let _vizFreq:     U8 | null = null;
let _vizAudioEl:  HTMLAudioElement | null = null;
let _beatPrev     = 0;
let _beatLast     = 0;
let _silenceTimer: ReturnType<typeof setTimeout> | null = null;

// H3: effect chain nodes
let _lpFilter:      BiquadFilterNode | null = null;
let _hpFilter:      BiquadFilterNode | null = null;
let _dryGain:       GainNode | null = null;
let _delay:         DelayNode | null = null;
let _echoFeedback:  GainNode | null = null;
let _echoOutGain:   GainNode | null = null;
let _convolver:     ConvolverNode | null = null;
let _reverbOutGain: GainNode | null = null;
let _masterGain:    GainNode | null = null;
// JS-side current values (smoothed toward targets each frame by applyEffects)
let _lpCur = 20000, _hpCur = 20;
let _echoFBCur = 0, _echoMxCur = 0, _revMxCur = 0, _rateCur = 1.0;

function makeIR(ctx: AudioContext, dur = 2.8, decay = 3.5): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * dur);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export const VIZ_EFFECTS_DEBUG = {
  sector: -1 as number, t: 0 as number,
  lpCut: 20000 as number, hpCut: 20 as number,
  rate: 1.0 as number, echoFB: 0 as number, echoMx: 0 as number, revMx: 0 as number,
};

// H1.2: playlist state
let _playlist:   string[] = [];
let _currentUrl: string   = "";
let _recentUrls: string[] = [];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickNextTrack(): string {
  if (_playlist.length === 0) return DBG_SILLAS.vizTrackUrl;
  const candidates = _playlist.filter(u => !_recentUrls.includes(u));
  const pool = candidates.length > 0 ? candidates : _playlist;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function fetchVizPlaylist(): Promise<void> {
  try {
    const res  = await fetch("/api/music-list");
    if (!res.ok) return;
    const data = await res.json() as { files?: string[] };
    if (Array.isArray(data.files) && data.files.length > 0) {
      _playlist = shuffleArray(data.files);
    }
  } catch { /* playlist stays empty, loop plays same track */ }
}

function onTrackEnded(): void {
  if (!_vizAudioEl) return;
  _recentUrls.push(_currentUrl);
  if (_recentUrls.length > 2) _recentUrls.shift();
  const next = pickNextTrack();
  _currentUrl = next;
  _vizAudioEl.src = next;
  _vizAudioEl.load();
  void _vizAudioEl.play().catch(err => {
    console.warn("[VizAudio] playlist next play error:", err);
  });
}

// ── startVizAudio ──────────────────────────────────────────────────────────────
// Must be called directly from a user-gesture handler (keydown / click).
// Uses DBG_SILLAS.vizTrackUrl directly — no fetch() — to keep play() in the
// gesture stack and avoid NotAllowedError.
export async function startVizAudio(): Promise<"ok" | "need-gesture"> {
  try {
    if (!_vizCtx) {
      const url        = DBG_SILLAS.vizTrackUrl;
      _currentUrl      = url;
      _vizAudioEl      = new Audio(url);
      _vizAudioEl.crossOrigin = "anonymous";
      // H1.2: loop=false; next track chosen by onTrackEnded when playlist is loaded
      _vizAudioEl.loop = false;
      _vizAudioEl.addEventListener("ended", onTrackEnded);

      _vizCtx = new AudioContext();

      // H3: source → LP → HP → dry/echo/reverb → master → analyser → out
      _lpFilter = _vizCtx.createBiquadFilter(); _lpFilter.type = "lowpass";  _lpFilter.frequency.value = 20000;
      _hpFilter = _vizCtx.createBiquadFilter(); _hpFilter.type = "highpass"; _hpFilter.frequency.value = 20;
      _dryGain  = _vizCtx.createGain();  _dryGain.gain.value  = 1;
      _delay    = _vizCtx.createDelay(1.0); _delay.delayTime.value = 0.35;
      _echoFeedback  = _vizCtx.createGain(); _echoFeedback.gain.value  = 0;
      _echoOutGain   = _vizCtx.createGain(); _echoOutGain.gain.value   = 0;
      _convolver = _vizCtx.createConvolver(); _convolver.buffer = makeIR(_vizCtx);
      _reverbOutGain = _vizCtx.createGain(); _reverbOutGain.gain.value = 0;
      _masterGain    = _vizCtx.createGain(); _masterGain.gain.value    = 1;
      _vizAnalyser = _vizCtx.createAnalyser(); _vizAnalyser.fftSize = 256;
      _vizFreq = new Uint8Array(_vizAnalyser.frequencyBinCount) as any as U8;

      const src = _vizCtx.createMediaElementSource(_vizAudioEl!);
      src.connect(_lpFilter);
      _lpFilter.connect(_hpFilter);
      _hpFilter.connect(_dryGain);
      _hpFilter.connect(_delay);
      _hpFilter.connect(_convolver);
      _dryGain.connect(_masterGain);
      _delay.connect(_echoFeedback);
      _echoFeedback.connect(_delay);           // feedback loop
      _delay.connect(_echoOutGain);
      _echoOutGain.connect(_masterGain);
      _convolver.connect(_reverbOutGain);
      _reverbOutGain.connect(_masterGain);
      _masterGain.connect(_vizAnalyser);
      _vizAnalyser.connect(_vizCtx.destination);

      VIZ_AUDIO_DEBUG.sourceType = `file:${url}`;
    }

    VIZ_AUDIO_DEBUG.ctxState = _vizCtx.state;
    if (_vizCtx.state === "suspended") await _vizCtx.resume();
    await _vizAudioEl!.play();
    VIZ_AUDIO_DEBUG.lastPlayResult = "ok";

    // H1.2: fetch playlist async after play() — never before (preserves gesture context)
    void fetchVizPlaylist();

    // 3s silence guard: log a warning if no signal detected
    if (_silenceTimer) clearTimeout(_silenceTimer);
    _silenceTimer = setTimeout(() => {
      const b = getVizBands();
      if (b.rms < 0.001) {
        console.warn("[VizAudio] 3s after start, RMS still 0. Full state:", {
          ctxState:    _vizCtx?.state,
          paused:      _vizAudioEl?.paused,
          currentTime: _vizAudioEl?.currentTime,
          src:         _vizAudioEl?.src,
          volume:      _vizAudioEl?.volume,
          muted:       _vizAudioEl?.muted,
          analyser:    !!_vizAnalyser,
        });
      }
    }, 3_000);

    return "ok";
  } catch (err: any) {
    VIZ_AUDIO_DEBUG.lastPlayResult = err?.name ?? "error";
    if (err?.name === "NotAllowedError" || err?.name === "SecurityError") return "need-gesture";
    console.warn("[VizAudio] play() error:", err);
    return "ok";
  }
}

// ── stopVizAudio ───────────────────────────────────────────────────────────────
export function stopVizAudio(): void {
  if (_silenceTimer) { clearTimeout(_silenceTimer); _silenceTimer = null; }
  try { _vizAudioEl?.pause(); } catch { /* */ }
  try { _vizCtx?.close(); } catch { /* */ }
  _vizCtx = null; _vizAnalyser = null; _vizFreq = null; _vizAudioEl = null;
  _beatPrev = 0; _beatLast = 0;
  _playlist = []; _currentUrl = ""; _recentUrls = [];
  // H3: clear effect nodes
  _lpFilter = null; _hpFilter = null; _dryGain = null;
  _delay = null; _echoFeedback = null; _echoOutGain = null;
  _convolver = null; _reverbOutGain = null; _masterGain = null;
  _lpCur = 20000; _hpCur = 20; _echoFBCur = 0; _echoMxCur = 0; _revMxCur = 0; _rateCur = 1.0;
  VIZ_AUDIO_DEBUG.ctxState = "closed";
  VIZ_AUDIO_DEBUG.paused   = true;
  VIZ_AUDIO_DEBUG.rms      = 0;
}

// ── setVizVolume ───────────────────────────────────────────────────────────────
export function setVizVolume(v: number): void {
  if (_vizAudioEl) _vizAudioEl.volume = Math.max(0, Math.min(1, v));
}

// ── restartVizAudio ────────────────────────────────────────────────────────────
export function restartVizAudio(): void {
  stopVizAudio();
  void startVizAudio().then(result => {
    if (result === "need-gesture") {
      window.dispatchEvent(new CustomEvent("alight:audio-need-gesture", { detail: { need: true } }));
    }
  });
}

// ── getVizBands ────────────────────────────────────────────────────────────────
export function getVizBands(): AudioBands {
  if (!_vizAnalyser || !_vizFreq) return zeroBands();
  _vizAnalyser.getByteFrequencyData(_vizFreq as any);
  const d    = _vizFreq;
  const sr   = _vizCtx?.sampleRate ?? 44100;
  const binHz = (sr / 2) / d.length;
  const band = (lo: number, hi: number): number => {
    let s = 0, n = 0;
    for (let i = Math.floor(lo / binHz); i <= Math.min(d.length - 1, Math.ceil(hi / binHz)); i++) { s += d[i]; n++; }
    return n > 0 ? s / (n * 255) : 0;
  };
  const sub  = band(20, 60), bass = band(60, 250), lm = band(250, 500), mid = band(500, 2000);
  const hm   = band(2000, 4000), pr = band(4000, 6000), br = band(6000, 12000), air = band(12000, 20000);
  const rms  = sub*.2 + bass*.25 + lm*.15 + mid*.15 + hm*.1 + pr*.07 + br*.05 + air*.03;
  const now  = performance.now() / 1000;
  const energy = sub * .5 + bass * .5;
  let beat = 0;
  if (energy > _beatPrev * 1.35 && now - _beatLast > 0.18) { beat = 1.0; _beatLast = now; }
  _beatPrev = _beatPrev + (energy - _beatPrev) * 0.15;

  // Update live debug state every call
  VIZ_AUDIO_DEBUG.ctxState    = _vizCtx?.state    ?? "none";
  VIZ_AUDIO_DEBUG.paused      = _vizAudioEl?.paused      ?? true;
  VIZ_AUDIO_DEBUG.currentTime = _vizAudioEl?.currentTime ?? 0;
  VIZ_AUDIO_DEBUG.volume      = _vizAudioEl?.volume      ?? 1;
  VIZ_AUDIO_DEBUG.muted       = _vizAudioEl?.muted       ?? false;
  VIZ_AUDIO_DEBUG.rms         = rms;

  return { sub, bass, lowMid: lm, mid, highMid: hm, presence: pr, brilliance: br, air, rms, beat };
}

// ── applyEffects (H3) ──────────────────────────────────────────────────────────
// Called each frame by SectorAudioFX with pre-computed target values.
// Smooths current → target (tau≈0.08 s); directly assigns .value (no automation queue).
export function applyEffects(
  lpTgt: number, hpTgt: number, rateTgt: number,
  echoFbTgt: number, echoMxTgt: number, revMxTgt: number,
  dt: number,
): void {
  if (!_vizCtx) return;
  const ef = 1 - Math.exp(-dt / 0.08); // exponential smoothing, tau = 0.08 s
  const rf = Math.min(1, dt * 8);       // faster linear for playback rate
  _lpCur    += (lpTgt    - _lpCur)    * ef;
  _hpCur    += (hpTgt    - _hpCur)    * ef;
  _echoFBCur += (echoFbTgt - _echoFBCur) * ef;
  _echoMxCur += (echoMxTgt - _echoMxCur) * ef;
  _revMxCur  += (revMxTgt  - _revMxCur)  * ef;
  _rateCur   += (rateTgt   - _rateCur)   * rf;
  if (_lpFilter)      _lpFilter.frequency.value      = Math.max(30,  _lpCur);
  if (_hpFilter)      _hpFilter.frequency.value      = Math.max(1,   _hpCur);
  if (_echoFeedback)  _echoFeedback.gain.value        = Math.max(0, _echoFBCur);
  if (_echoOutGain)   _echoOutGain.gain.value         = Math.max(0, _echoMxCur);
  if (_reverbOutGain) _reverbOutGain.gain.value        = Math.max(0, _revMxCur);
  if (_vizAudioEl) {
    _vizAudioEl.playbackRate = Math.max(0.25, Math.min(4, _rateCur));
    (_vizAudioEl as any).preservesPitch = false;
  }
  VIZ_EFFECTS_DEBUG.lpCut  = _lpCur;
  VIZ_EFFECTS_DEBUG.hpCut  = _hpCur;
  VIZ_EFFECTS_DEBUG.rate   = _rateCur;
  VIZ_EFFECTS_DEBUG.echoFB = _echoFBCur;
  VIZ_EFFECTS_DEBUG.echoMx = _echoMxCur;
  VIZ_EFFECTS_DEBUG.revMx  = _revMxCur;
}

// ── resetEffects (H3) ──────────────────────────────────────────────────────────
// Returns all effects to neutral; called on SectorAudioFX unmount.
export function resetEffects(): void {
  _lpCur = 20000; _hpCur = 20; _echoFBCur = 0; _echoMxCur = 0; _revMxCur = 0; _rateCur = 1.0;
  if (_lpFilter)      _lpFilter.frequency.value      = 20000;
  if (_hpFilter)      _hpFilter.frequency.value      = 20;
  if (_echoFeedback)  _echoFeedback.gain.value        = 0;
  if (_echoOutGain)   _echoOutGain.gain.value         = 0;
  if (_reverbOutGain) _reverbOutGain.gain.value        = 0;
  if (_vizAudioEl)    { _vizAudioEl.playbackRate = 1.0; (_vizAudioEl as any).preservesPitch = true; }
}
