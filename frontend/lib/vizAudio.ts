// G2: Audio singleton for the SILLAS visualizer path.
// Extracted from DomeVisualizer so that startVizAudio() can be called directly
// from ThreeScene's keydown handler (preserving the browser's user-gesture context).
// /login source: /music.mp3 via /api/music-list — we use the same track.

import { DBG_SILLAS } from "./debugConfig";

// ── N4 constants ──────────────────────────────────────────────────────────────
const MUSIC_FIRST             = '/music.mp3'; // always the first track each session
const BANDS_FILTER_ORDER      = 2;            // cascaded biquads per crossover edge
const LEGACY_H3_CHAIN_ENABLED = false;        // N4: disabled; applyEffects() is a no-op

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

// ── N5: monolith proximity state (set by Monoliths.tsx, read by DomeVisualizer) ─
export const N5_STATE = {
  leftProximity:  0 as number, // 0–1; drives uRemoteMix + uStaticMix on dome
  rightProximity: 0 as number, // 0–1; drives music fade + white noise
};

// ── N4: band state (published per-frame for SymbolSystem, DomeVisualizer) ─────
export const BAND_STATE = {
  energy:     [0, 0, 0, 0] as number[],                 // pre-gate smoothed RMS per band
  normEnergy: [0, 0, 0, 0] as number[],                 // U2: AGC-normalized energy 0–1
  gateOpen:   [false, false, false, false] as boolean[], // per band (indexed by bandIdx)
  assignment: [0, 1, 2, 3] as number[],                 // assignment[symbolIdx] = bandIdx
  domeEnergy: 0 as number,                              // max energy of bands with open gate
  kick:       false as boolean,                         // true for one getVizBands() call
};

// ── U2: AGC debug (meters in DebugMenu) ──────────────────────────────────────
export const BAND_U2_DEBUG = {
  rawEnergy:  [0, 0, 0, 0] as number[],
  normEnergy: [0, 0, 0, 0] as number[],
  agcFloor:   [0, 0, 0, 0] as number[],
  agcCeil:    [0.1, 0.1, 0.1, 0.1] as number[],
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
let _playStarted  = false;

// N5: white noise cross-fade nodes
let _noiseSource:    AudioBufferSourceNode | null = null;
let _noiseGain:      GainNode | null = null;
let _musicFadeGain:  GainNode | null = null;

// N4: band chain nodes
let _bandFilters:   BiquadFilterNode[][] = [];
let _bandAnalysers: AnalyserNode[]       = [];
let _bandTimeDom:   U8[]                 = [];
let _bandGates:     GainNode[]           = [];
let _sumGain:       GainNode | null      = null;

// N4: per-band energy + kick detection state
const _bandEnergySmooth = [0, 0, 0, 0];
let _lastBandTime   = 0;

// U2: AGC per-band state
const _agcFloor    = [0,   0,   0,   0  ];
const _agcCeil     = [0.1, 0.1, 0.1, 0.1];
const _agcNormSmo  = [0,   0,   0,   0  ];
let _kickBandPrev   = 0;
let _kickBandLast   = 0;
let _bandAssignment: number[] = [0, 1, 2, 3];

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

// ── N4: update per-band energy, kick detection, dome energy ──────────────────
// Called once per frame by getVizBands(). Reads pre-gate analysers.
function _updateBandEnergy(): void {
  if (!_bandAnalysers.length) return;
  const now = performance.now() / 1000;
  const dt  = Math.min(0.1, Math.max(0.001, now - _lastBandTime));
  _lastBandTime = now;

  const atkF = 1 - Math.exp(-dt / 0.040); // 40 ms attack
  const relF = 1 - Math.exp(-dt / 0.200); // 200 ms release

  // U2: AGC coefficients (read from debug config each frame for live tuning)
  const agcCeilDecF = 1 - Math.exp(-dt / DBG_SILLAS.agcCeilDecayS);
  const agcAtkF     = 1 - Math.exp(-dt / (DBG_SILLAS.agcAttackMs  / 1000));
  const agcRelF     = 1 - Math.exp(-dt / (DBG_SILLAS.agcReleaseMs / 1000));
  const agcEps      = DBG_SILLAS.agcEpsilon;
  const agcPow      = DBG_SILLAS.agcPow;
  const floorRise   = DBG_SILLAS.agcFloorRise;

  let domeE = 0;
  for (let i = 0; i < 4; i++) {
    _bandAnalysers[i].getByteTimeDomainData(_bandTimeDom[i]);
    let ss = 0;
    const buf = _bandTimeDom[i];
    for (let j = 0; j < buf.length; j++) { const v = (buf[j] - 128) / 128; ss += v * v; }
    const rms  = Math.sqrt(ss / buf.length);
    const prev = _bandEnergySmooth[i];
    _bandEnergySmooth[i] = rms > prev ? prev + (rms - prev) * atkF : prev + (rms - prev) * relF;
    BAND_STATE.energy[i] = _bandEnergySmooth[i];
    if (BAND_STATE.gateOpen[i]) domeE = Math.max(domeE, _bandEnergySmooth[i]);

    // U2: AGC — floor tracks min (instant drop, slow rise), ceiling tracks peak (instant attack, slow decay)
    const s = _bandEnergySmooth[i];
    if (s < _agcFloor[i]) { _agcFloor[i] = s; }
    else                  { _agcFloor[i] = Math.min(_agcFloor[i] + floorRise * dt, s); }
    if (s > _agcCeil[i])  { _agcCeil[i]  = s; }
    else                  { _agcCeil[i]  = Math.max(_agcCeil[i] + (s - _agcCeil[i]) * agcCeilDecF, _agcFloor[i] + agcEps); }
    const raw     = (s - _agcFloor[i]) / Math.max(_agcCeil[i] - _agcFloor[i], agcEps);
    const normRaw = Math.pow(Math.min(1, Math.max(0, raw)), agcPow);
    const nPrev   = _agcNormSmo[i];
    _agcNormSmo[i]          = normRaw > nPrev ? nPrev + (normRaw - nPrev) * agcAtkF : nPrev + (normRaw - nPrev) * agcRelF;
    BAND_STATE.normEnergy[i]   = _agcNormSmo[i];
    BAND_U2_DEBUG.rawEnergy[i] = s;
    BAND_U2_DEBUG.normEnergy[i]= _agcNormSmo[i];
    BAND_U2_DEBUG.agcFloor[i]  = _agcFloor[i];
    BAND_U2_DEBUG.agcCeil[i]   = _agcCeil[i];
  }

  // Kick on band 1 (bombos 80–250 Hz), 150 ms refractory
  const kickE = _bandEnergySmooth[1];
  if (kickE > _kickBandPrev * 1.4 && kickE > 0.05 && (now - _kickBandLast) > 0.150) {
    _kickBandLast = now;
    BAND_STATE.kick = true;
    window.dispatchEvent(new CustomEvent("alight:kick"));
  } else {
    BAND_STATE.kick = false;
  }
  _kickBandPrev = kickE;
  BAND_STATE.domeEnergy = domeE;
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

// ── _buildChain: create audio element + N4 band chain (no play) ──────────────
async function _buildChain(): Promise<void> {
  if (_vizCtx) return; // already built

  _currentUrl = MUSIC_FIRST; // N4: first track is always MUSIC_FIRST
  _vizAudioEl = new Audio(MUSIC_FIRST);
  _vizAudioEl.crossOrigin = "anonymous";
  _vizAudioEl.loop = false; // H1.2: playlist via onTrackEnded
  _vizAudioEl.addEventListener("ended", onTrackEnded);

  _vizCtx = new AudioContext();

  // N4: source → 4 parallel bands → sumGain → masterGain → vizAnalyser → destination
  _masterGain  = _vizCtx.createGain(); _masterGain.gain.value  = 1;
  _vizAnalyser = _vizCtx.createAnalyser(); _vizAnalyser.fftSize = 256;
  _vizFreq     = new Uint8Array(_vizAnalyser.frequencyBinCount) as any as U8;
  _sumGain     = _vizCtx.createGain(); _sumGain.gain.value = 0.25; // 4 bands → normalize

  const src = _vizCtx.createMediaElementSource(_vizAudioEl);

  // Band defs: { hp: cutoff|null, lp: cutoff|null }
  const BAND_DEFS: Array<{ hp: number | null; lp: number | null }> = [
    { hp: null, lp: 80   }, // 0: bass   < 80 Hz
    { hp: 80,   lp: 250  }, // 1: kick   80–250 Hz
    { hp: 250,  lp: 4000 }, // 2: mids   250–4 kHz
    { hp: 4000, lp: null }, // 3: treble > 4 kHz
  ];

  _bandFilters = []; _bandAnalysers = []; _bandTimeDom = []; _bandGates = [];

  for (let bi = 0; bi < 4; bi++) {
    const def     = BAND_DEFS[bi];
    const filters: BiquadFilterNode[] = [];

    if (def.hp !== null) {
      for (let f = 0; f < BANDS_FILTER_ORDER; f++) {
        const n = _vizCtx.createBiquadFilter();
        n.type = "highpass"; n.frequency.value = def.hp; n.Q.value = 0.707;
        filters.push(n);
      }
    }
    if (def.lp !== null) {
      for (let f = 0; f < BANDS_FILTER_ORDER; f++) {
        const n = _vizCtx.createBiquadFilter();
        n.type = "lowpass"; n.frequency.value = def.lp; n.Q.value = 0.707;
        filters.push(n);
      }
    }

    // src → filters in series → analyser → gate → sumGain
    let prev: AudioNode = src;
    for (const ff of filters) { prev.connect(ff); prev = ff; }
    const analyser = _vizCtx.createAnalyser(); analyser.fftSize = 256;
    prev.connect(analyser);
    const gate = _vizCtx.createGain(); gate.gain.value = 0; // all closed
    analyser.connect(gate);
    gate.connect(_sumGain);

    _bandFilters.push(filters);
    _bandAnalysers.push(analyser);
    _bandTimeDom.push(new Uint8Array(analyser.fftSize) as U8);
    _bandGates.push(gate);
  }

  // H3 legacy chain disabled (LEGACY_H3_CHAIN_ENABLED = false)
  // _lpFilter etc. remain null → applyEffects() null-guards prevent crashes
  if (LEGACY_H3_CHAIN_ENABLED) {
    _lpFilter = _vizCtx.createBiquadFilter(); _lpFilter.type = "lowpass";  _lpFilter.frequency.value = 20000;
    _hpFilter = _vizCtx.createBiquadFilter(); _hpFilter.type = "highpass"; _hpFilter.frequency.value = 20;
    _dryGain  = _vizCtx.createGain();         _dryGain.gain.value         = 1;
    _delay    = _vizCtx.createDelay(1.0);     _delay.delayTime.value      = 0.35;
    _echoFeedback  = _vizCtx.createGain();    _echoFeedback.gain.value    = 0;
    _echoOutGain   = _vizCtx.createGain();    _echoOutGain.gain.value     = 0;
    _convolver     = _vizCtx.createConvolver(); _convolver.buffer         = makeIR(_vizCtx);
    _reverbOutGain = _vizCtx.createGain();    _reverbOutGain.gain.value   = 0;
  }

  // N5: insert music-fade gain between sumGain and masterGain
  _musicFadeGain = _vizCtx.createGain(); _musicFadeGain.gain.value = 1;
  _sumGain.connect(_musicFadeGain);
  _musicFadeGain.connect(_masterGain);

  // N5: white noise source looped through a closed gain → masterGain
  const noiseSr  = _vizCtx.sampleRate;
  const noiseBuf = _vizCtx.createBuffer(1, noiseSr * 2, noiseSr);
  const noiseD   = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseD.length; i++) noiseD[i] = Math.random() * 2 - 1;
  _noiseSource = _vizCtx.createBufferSource();
  _noiseSource.buffer = noiseBuf;
  _noiseSource.loop   = true;
  _noiseGain = _vizCtx.createGain(); _noiseGain.gain.value = 0;
  _noiseSource.connect(_noiseGain);
  _noiseGain.connect(_masterGain);
  _noiseSource.start();

  _masterGain.connect(_vizAnalyser);
  _vizAnalyser.connect(_vizCtx.destination);

  // Shuffle band→symbol assignment once per session
  _bandAssignment      = shuffleArray([0, 1, 2, 3]);
  BAND_STATE.assignment = [..._bandAssignment];
  console.info(
    "[VizAudio] N4 band assignment:",
    _bandAssignment.map((b, i) => `symbol${i}→band${b}`).join(', ')
  );

  VIZ_AUDIO_DEBUG.sourceType = `file:${MUSIC_FIRST}`;
}

// ── prepareVizAudio (N2) ───────────────────────────────────────────────────────
// Builds the audio graph and pre-buffers the first track without starting playback.
// Call from a user-gesture (keydown/click) to unblock the AudioContext while keeping
// the gesture context for a future play() call (N4).
export async function prepareVizAudio(): Promise<void> {
  try {
    await _buildChain();
    VIZ_AUDIO_DEBUG.ctxState = _vizCtx!.state;
    if (_vizCtx!.state === "suspended") await _vizCtx!.resume();
    _vizAudioEl!.preload = "auto";
    _vizAudioEl!.load();
    void fetchVizPlaylist();
  } catch (err) {
    console.warn("[VizAudio] prepareVizAudio error:", err);
  }
}

// ── startVizAudio ──────────────────────────────────────────────────────────────
// Builds chain (if not yet built) and starts playback immediately.
// Must be called directly from a user-gesture handler (keydown / click).
export async function startVizAudio(): Promise<"ok" | "need-gesture"> {
  try {
    await _buildChain();

    VIZ_AUDIO_DEBUG.ctxState = _vizCtx!.state;
    if (_vizCtx!.state === "suspended") await _vizCtx!.resume();
    _vizAudioEl!.currentTime = 0; // N4: start MUSIC_FIRST from the beginning
    await _vizAudioEl!.play();
    _playStarted = true;
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
  // N4: band chain cleanup
  _bandFilters = []; _bandAnalysers = []; _bandTimeDom = []; _bandGates = []; _sumGain = null;
  // N5: noise cleanup
  try { _noiseSource?.stop(); } catch { /* already stopped */ }
  _noiseSource = null; _noiseGain = null; _musicFadeGain = null;
  N5_STATE.leftProximity = 0; N5_STATE.rightProximity = 0;
  _bandEnergySmooth.fill(0); _kickBandPrev = 0; _kickBandLast = 0; _lastBandTime = 0;
  _agcFloor.fill(0); _agcCeil.fill(0.1); _agcNormSmo.fill(0);
  _playStarted = false;
  BAND_STATE.energy.fill(0); BAND_STATE.normEnergy.fill(0);
  BAND_STATE.gateOpen.fill(false);
  BAND_STATE.domeEnergy = 0; BAND_STATE.kick = false;
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
  _updateBandEnergy(); // N4: update per-band state before reading spectrum
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

// ── N4: gate control ──────────────────────────────────────────────────────────
// symbolIdx (0–3) → bandIdx via _bandAssignment permutation.
// setTargetAtTime gives smooth attack/release envelopes.
export function openGate(symbolIdx: number): void {
  if (!_vizCtx || !_bandGates.length) return;
  const bandIdx = _bandAssignment[symbolIdx] ?? symbolIdx;
  const gate    = _bandGates[bandIdx];
  if (!gate) return;
  const tau = (DBG_SILLAS.gateAttackMs / 1000) / 3;
  gate.gain.setTargetAtTime(1, _vizCtx.currentTime, tau);
  BAND_STATE.gateOpen[bandIdx] = true;
}

export function closeGate(symbolIdx: number): void {
  if (!_vizCtx || !_bandGates.length) return;
  const bandIdx = _bandAssignment[symbolIdx] ?? symbolIdx;
  const gate    = _bandGates[bandIdx];
  if (!gate) return;
  const tau = (DBG_SILLAS.gateReleaseMs / 1000) / 3;
  gate.gain.setTargetAtTime(0, _vizCtx.currentTime, tau);
  BAND_STATE.gateOpen[bandIdx] = false;
}

export function isPlaying(): boolean {
  return _playStarted && !(_vizAudioEl?.paused ?? true);
}

export function reshuffleAssignment(): void {
  _bandAssignment      = shuffleArray([0, 1, 2, 3]);
  BAND_STATE.assignment = [..._bandAssignment];
  console.info("[VizAudio] N4 reshuffle:", _bandAssignment.map((b, i) => `s${i}→b${b}`).join(', '));
}

// ── N5: monolith proximity crossfade ─────────────────────────────────────────
// left  (0–1): image monolith proximity → updates N5_STATE.leftProximity
// right (0–1): sound monolith proximity → fades music, raises white noise
export function setMonolithProximity(left: number, right: number): void {
  N5_STATE.leftProximity  = left;
  N5_STATE.rightProximity = right;
  if (!_vizCtx) return;
  const t   = _vizCtx.currentTime;
  const tau = 0.12;
  if (_musicFadeGain) _musicFadeGain.gain.setTargetAtTime(1 - right * 0.85, t, tau);
  if (_noiseGain)     _noiseGain.gain.setTargetAtTime(right * DBG_SILLAS.noiseGain, t, tau);
}
