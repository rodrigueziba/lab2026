// T4 / T6 / J4: Web Audio engine.
// Chain: source → LP → HP → distortion(dry+wet) → phaser → pitch-shifter → delay → reverb → master → analyser → dest

import { STORE, storeNotify } from "./alightStore";

// ── Filter nodes ────────────────────────────────────────────────────────────────
let ctx:         AudioContext | null = null;
let sourceNode:  MediaElementAudioSourceNode | null = null;
let lpFilter:    BiquadFilterNode | null = null;
let hpFilter:    BiquadFilterNode | null = null;

// ── Distortion (wet/dry) ────────────────────────────────────────────────────────
let distShaper:  WaveShaperNode | null = null;
let distDryGain: GainNode | null = null;
let distWetGain: GainNode | null = null;
let distOut:     GainNode | null = null;

// ── Phaser (4 allpass + feedback LFO) ──────────────────────────────────────────
let phaserDryGain: GainNode | null = null;
let phaserWetGain: GainNode | null = null;
let phaserOut:     GainNode | null = null;
let phaserSumIn:   GainNode | null = null;
let phaserAP:      BiquadFilterNode[] = [];
let phaserFBGain:  GainNode | null = null;
let phaserFBDly:   DelayNode | null = null;
let phaserLFO:     OscillatorNode | null = null;
let phaserLFOGain: GainNode | null = null;

// ── Pitch shifter (granular, 2 delay lines) ─────────────────────────────────────
const GRAIN_DUR    = 0.080;
const GRAIN_FREQ   = 1 / GRAIN_DUR;
const GRAIN_CENTER = GRAIN_DUR * 0.5;

let pitchDryGain: GainNode | null = null;
let pitchWetGain: GainNode | null = null;
let pitchOut:     GainNode | null = null;
let pitchInGain:  GainNode | null = null;
let pitchDelayA:  DelayNode | null = null;
let pitchDelayB:  DelayNode | null = null;
let pitchEnvA:    GainNode | null = null;
let pitchEnvB:    GainNode | null = null;
let pitchLFO:     OscillatorNode | null = null;
let pitchDelModA: GainNode | null = null;
let pitchDelModB: GainNode | null = null;
let pitchEnvModA: GainNode | null = null;
let pitchEnvModB: GainNode | null = null;

// ── Delay / reverb / master ─────────────────────────────────────────────────────
let delayNode:    DelayNode | null = null;
let delayFB:      GainNode | null = null;
let reverbConv:   ConvolverNode | null = null;
let reverbWet:    GainNode | null = null;
let reverbDry:    GainNode | null = null;
let masterGain:   GainNode | null = null;
let analyserNode: AnalyserNode | null = null;

// ── LFO ────────────────────────────────────────────────────────────────────────
let lfoOsc:  OscillatorNode | null = null;
let lfoGain: GainNode | null = null;

let audioEl: HTMLAudioElement | null = null;
let loopWatchdog: number | null = null;

// ── Track history (ANT./SIG. with memory) ───────────────────────────────────────
let _trackHistory: number[] = [];
let _histPos = -1;

// ── IR generator (2.8s reverb tail) ────────────────────────────────────────────
function makeIR(c: AudioContext, durationSec = 2.8): AudioBuffer {
  const sr  = c.sampleRate;
  const len = Math.floor(sr * durationSec);
  const buf = c.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    }
  }
  return buf;
}

type F32 = Float32Array<ArrayBuffer>;
/* eslint-disable @typescript-eslint/no-explicit-any */
function f32(n: number): F32 { return new Float32Array(n) as any as F32; }

// drive: 1–50
function makeDistCurve(drive: number): F32 {
  const n   = 256;
  const k   = Math.max(1, drive);
  const cur = f32(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    cur[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  return cur;
}

// ── init ───────────────────────────────────────────────────────────────────────
export async function initAudio(existingEl?: HTMLAudioElement): Promise<void> {
  if (ctx) return;

  audioEl = existingEl ?? document.createElement("audio");
  if (!existingEl) {
    audioEl.crossOrigin = "anonymous";
    document.body.appendChild(audioEl);
  }

  ctx = new AudioContext();

  sourceNode   = ctx.createMediaElementSource(audioEl);
  lpFilter     = ctx.createBiquadFilter();
  hpFilter     = ctx.createBiquadFilter();

  distShaper   = ctx.createWaveShaper();
  distDryGain  = ctx.createGain();
  distWetGain  = ctx.createGain();
  distOut      = ctx.createGain();

  phaserDryGain = ctx.createGain();
  phaserWetGain = ctx.createGain();
  phaserOut     = ctx.createGain();
  phaserSumIn   = ctx.createGain();
  phaserFBGain  = ctx.createGain();
  phaserFBDly   = ctx.createDelay(0.5);
  phaserAP      = [];
  for (let i = 0; i < 4; i++) {
    const ap    = ctx.createBiquadFilter();
    ap.type     = "allpass";
    ap.frequency.value = 1000;
    ap.Q.value  = 10;
    phaserAP.push(ap);
  }
  phaserLFO     = ctx.createOscillator();
  phaserLFOGain = ctx.createGain();

  pitchDryGain = ctx.createGain();
  pitchWetGain = ctx.createGain();
  pitchOut     = ctx.createGain();
  pitchInGain  = ctx.createGain();
  pitchDelayA  = ctx.createDelay(2.0);
  pitchDelayB  = ctx.createDelay(2.0);
  pitchEnvA    = ctx.createGain();
  pitchEnvB    = ctx.createGain();
  pitchLFO     = ctx.createOscillator();
  pitchDelModA = ctx.createGain();
  pitchDelModB = ctx.createGain();
  pitchEnvModA = ctx.createGain();
  pitchEnvModB = ctx.createGain();

  delayNode    = ctx.createDelay(5.0);
  delayFB      = ctx.createGain();
  reverbConv   = ctx.createConvolver();
  reverbWet    = ctx.createGain();
  reverbDry    = ctx.createGain();
  masterGain   = ctx.createGain();
  analyserNode = ctx.createAnalyser();

  // defaults
  lpFilter.type = "lowpass";   lpFilter.frequency.value = 20000;
  hpFilter.type = "highpass";  hpFilter.frequency.value = 20;

  distShaper.curve      = makeDistCurve(10);
  distShaper.oversample = "4x";
  distDryGain.gain.value = 1;
  distWetGain.gain.value = 0;

  phaserDryGain.gain.value = 1;
  phaserWetGain.gain.value = 0;
  phaserSumIn.gain.value   = 0.5;
  phaserFBGain.gain.value  = 0;
  phaserFBDly.delayTime.value = 0.001;
  phaserLFO.type             = "sine";
  phaserLFO.frequency.value  = 1.0;
  phaserLFOGain.gain.value   = 0;

  pitchDryGain.gain.value  = 1;
  pitchWetGain.gain.value  = 0;
  pitchDelayA.delayTime.value = GRAIN_CENTER;
  pitchDelayB.delayTime.value = GRAIN_CENTER;
  pitchEnvA.gain.value  = 0.5;
  pitchEnvB.gain.value  = 0.5;
  pitchDelModA.gain.value = 0;
  pitchDelModB.gain.value = 0;
  pitchEnvModA.gain.value =  0.5;
  pitchEnvModB.gain.value = -0.5;
  pitchLFO.type             = "sine";
  pitchLFO.frequency.value  = GRAIN_FREQ;

  delayNode.delayTime.value = 0;
  delayFB.gain.value        = 0;
  reverbConv.buffer         = makeIR(ctx);
  reverbWet.gain.value      = 0;
  reverbDry.gain.value      = 1;
  masterGain.gain.value     = STORE.audio.volume;
  analyserNode.fftSize      = 256;

  // ── Wire chain ────────────────────────────────────────────────────────────────
  sourceNode.connect(lpFilter);
  lpFilter.connect(hpFilter);

  // distortion dry/wet
  hpFilter.connect(distDryGain);
  hpFilter.connect(distShaper);
  distDryGain.connect(distOut);
  distShaper.connect(distWetGain);
  distWetGain.connect(distOut);

  // phaser dry/wet with feedback
  distOut.connect(phaserDryGain);
  distOut.connect(phaserSumIn);
  phaserDryGain.connect(phaserOut);
  phaserSumIn.connect(phaserAP[0]);
  phaserAP[0].connect(phaserAP[1]);
  phaserAP[1].connect(phaserAP[2]);
  phaserAP[2].connect(phaserAP[3]);
  phaserAP[3].connect(phaserWetGain);
  phaserWetGain.connect(phaserOut);
  phaserAP[3].connect(phaserFBGain);
  phaserFBGain.connect(phaserFBDly);
  phaserFBDly.connect(phaserSumIn);
  phaserLFO.connect(phaserLFOGain);
  for (const ap of phaserAP) phaserLFOGain.connect(ap.frequency);

  // pitch shifter dry/wet
  phaserOut.connect(pitchDryGain);
  phaserOut.connect(pitchInGain);
  pitchDryGain.connect(pitchOut);
  pitchInGain.connect(pitchDelayA);
  pitchInGain.connect(pitchDelayB);
  pitchDelayA.connect(pitchEnvA);
  pitchDelayB.connect(pitchEnvB);
  pitchEnvA.connect(pitchWetGain);
  pitchEnvB.connect(pitchWetGain);
  pitchWetGain.connect(pitchOut);
  pitchLFO.connect(pitchDelModA); pitchDelModA.connect(pitchDelayA.delayTime);
  pitchLFO.connect(pitchDelModB); pitchDelModB.connect(pitchDelayB.delayTime);
  pitchLFO.connect(pitchEnvModA); pitchEnvModA.connect(pitchEnvA.gain);
  pitchLFO.connect(pitchEnvModB); pitchEnvModB.connect(pitchEnvB.gain);

  // delay → reverb → master → analyser → dest
  pitchOut.connect(delayNode);
  delayNode.connect(delayFB);
  delayFB.connect(delayNode);
  delayNode.connect(reverbDry);
  delayNode.connect(reverbConv);
  reverbDry.connect(masterGain);
  reverbConv.connect(reverbWet);
  reverbWet.connect(masterGain);
  masterGain.connect(analyserNode);
  analyserNode.connect(ctx.destination);

  phaserLFO.start();
  pitchLFO.start();

  if (ctx.state === "suspended") {
    const resume = () => { ctx?.resume(); document.removeEventListener("click", resume); document.removeEventListener("keydown", resume); };
    document.addEventListener("click", resume);
    document.addEventListener("keydown", resume);
  }
}

// ── Playlist ───────────────────────────────────────────────────────────────────
export function loadPlaylist(tracks: string[]): void {
  STORE.audio.tracks = tracks;
  _trackHistory = [];
  _histPos = -1;
  storeNotify();
}

export async function playTrack(index: number): Promise<void> {
  if (!audioEl || !ctx) return;
  const tracks = STORE.audio.tracks;
  if (!tracks.length) return;
  const i = ((index % tracks.length) + tracks.length) % tracks.length;
  STORE.audio.trackIndex = i;
  if (_histPos >= _trackHistory.length - 1) {
    _trackHistory.push(i);
    _histPos = _trackHistory.length - 1;
  }
  audioEl.src = tracks[i];
  audioEl.loop = false;
  if (ctx.state === "suspended") await ctx.resume();
  STORE.audio.paused = false;
  audioEl.play().catch(() => {});
  audioEl.onended = () => _autoNext();
  storeNotify();
}

function _autoNext(): void {
  const tracks = STORE.audio.tracks;
  if (tracks.length <= 1) { playTrack(0); return; }
  const last2 = _trackHistory.slice(-2);
  let candidates = tracks.map((_, i) => i).filter(i => !last2.includes(i));
  if (!candidates.length) candidates = tracks.map((_, i) => i);
  playTrack(candidates[Math.floor(Math.random() * candidates.length)]);
}

export function nextTrack(): void {
  const tracks = STORE.audio.tracks;
  if (!tracks.length) return;
  if (_histPos < _trackHistory.length - 1) {
    _histPos++;
    const idx = _trackHistory[_histPos];
    STORE.audio.trackIndex = idx;
    if (audioEl && ctx) {
      audioEl.src = tracks[idx];
      STORE.audio.paused = false;
      audioEl.play().catch(() => {});
      audioEl.onended = () => _autoNext();
    }
    storeNotify();
    return;
  }
  _autoNext();
}

export function prevTrack(): void {
  if (_histPos > 0) {
    _histPos--;
    const tracks = STORE.audio.tracks;
    const idx    = _trackHistory[_histPos];
    STORE.audio.trackIndex = idx;
    if (audioEl && ctx && tracks.length) {
      audioEl.src = tracks[idx];
      STORE.audio.paused = false;
      audioEl.play().catch(() => {});
      audioEl.onended = () => _autoNext();
    }
    storeNotify();
  } else {
    playTrack(STORE.audio.trackIndex);
  }
}

export function togglePlayPause(): void {
  if (!audioEl || !ctx) return;
  if (STORE.audio.paused) {
    ctx.resume().then(() => { audioEl?.play().catch(() => {}); });
    STORE.audio.paused = false;
  } else {
    audioEl.pause();
    STORE.audio.paused = true;
  }
  storeNotify();
}

// ── Controls ───────────────────────────────────────────────────────────────────
export function setVolume(v: number): void {
  STORE.audio.volume = v;
  if (!masterGain || !ctx) return;
  const logV = v <= 0 ? 0 : Math.pow(v, 2.5);
  masterGain.gain.setTargetAtTime(logV, ctx.currentTime, 0.05);
}

export function setLP(enabled: boolean, frequency: number): void {
  STORE.audio.lowPass = { enabled, frequency };
  if (!lpFilter || !ctx) return;
  lpFilter.frequency.setTargetAtTime(enabled ? frequency : 20000, ctx.currentTime, 0.05);
}

export function setHP(enabled: boolean, frequency: number): void {
  STORE.audio.highPass = { enabled, frequency };
  if (!hpFilter || !ctx) return;
  hpFilter.frequency.setTargetAtTime(enabled ? frequency : 20, ctx.currentTime, 0.05);
}

// drive: 1–50, mix: 0–1
export function setDistortion(enabled: boolean, drive: number, mix: number): void {
  STORE.audio.distEffect = { enabled, drive, mix };
  if (!distShaper || !distDryGain || !distWetGain || !ctx) return;
  if (enabled) {
    distShaper.curve = makeDistCurve(drive);
    distDryGain.gain.setTargetAtTime(1 - mix, ctx.currentTime, 0.02);
    distWetGain.gain.setTargetAtTime(mix,      ctx.currentTime, 0.02);
  } else {
    distDryGain.gain.setTargetAtTime(1, ctx.currentTime, 0.02);
    distWetGain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
  }
}

export function setDelay(amount: number, feedback: number): void {
  STORE.audio.delay = { amount, feedback };
  if (!delayNode || !delayFB || !ctx) return;
  delayNode.delayTime.setTargetAtTime(amount * 0.8,  ctx.currentTime, 0.05);
  delayFB.gain.setTargetAtTime(feedback * 0.9,        ctx.currentTime, 0.05);
}

export function setReverb(amount: number): void {
  STORE.audio.reverb = amount;
  if (!reverbWet || !reverbDry || !ctx) return;
  reverbWet.gain.setTargetAtTime(amount,            ctx.currentTime, 0.05);
  reverbDry.gain.setTargetAtTime(1 - amount * 0.5,  ctx.currentTime, 0.05);
}

export function setLFO(speed: number, depth: number, waveform: OscillatorType, target: string): void {
  if (!ctx || !masterGain || !lpFilter || !pitchDelModA || !pitchDelModB) return;
  STORE.audio.lfo = { ...STORE.audio.lfo, speed, depth, waveform: waveform as any, target: target as any };

  if (lfoOsc) { try { lfoOsc.stop(); } catch {} lfoOsc.disconnect(); lfoOsc = null; }
  if (lfoGain) { lfoGain.disconnect(); lfoGain = null; }
  if (depth <= 0) return;

  lfoOsc  = ctx.createOscillator();
  lfoGain = ctx.createGain();
  lfoOsc.type            = waveform;
  lfoOsc.frequency.value = speed;
  lfoGain.gain.value     = depth;
  lfoOsc.connect(lfoGain);

  if (target === "volume") {
    lfoGain.connect(masterGain.gain);
  } else if (target === "cutoff") {
    lfoGain.connect(lpFilter.frequency);
  } else if (target === "pitch") {
    lfoGain.connect(pitchDelModA.gain);
    lfoGain.connect(pitchDelModB.gain);
  }
  lfoOsc.start();
}

// speed: 0.05–8 Hz, depth: 0–1, feedback: 0–1
export function setPhaser(enabled: boolean, speed: number, depth: number, feedback: number): void {
  STORE.audio.phaser = { enabled, speed, depth };
  if (!phaserLFO || !phaserLFOGain || !phaserDryGain || !phaserWetGain || !phaserFBGain || !ctx) return;
  const t = ctx.currentTime;
  if (enabled) {
    phaserDryGain.gain.setTargetAtTime(0.5,           t, 0.02);
    phaserWetGain.gain.setTargetAtTime(0.5,           t, 0.02);
    phaserFBGain.gain.setTargetAtTime(feedback * 0.9, t, 0.02);
    phaserLFO.frequency.setValueAtTime(speed, t);
    phaserLFOGain.gain.setTargetAtTime(depth * 1000,  t, 0.02);
  } else {
    phaserDryGain.gain.setTargetAtTime(1, t, 0.02);
    phaserWetGain.gain.setTargetAtTime(0, t, 0.02);
    phaserFBGain.gain.setTargetAtTime(0,  t, 0.02);
    phaserLFOGain.gain.setTargetAtTime(0, t, 0.02);
  }
}

// semitones: -12–+12 integer, mix: 0–1
export function setPitch(enabled: boolean, semitones: number, mix: number): void {
  STORE.audio.pitch = { enabled, semitones, mix };
  if (!pitchDryGain || !pitchWetGain || !pitchDelModA || !pitchDelModB || !ctx) return;
  const t = ctx.currentTime;
  if (enabled && semitones !== 0) {
    const r   = Math.pow(2, semitones / 12);
    const amp = GRAIN_CENTER * Math.abs(1 - r);
    const sgn = semitones > 0 ? -1 : 1; // negative → shorter delay → pitch up
    pitchDelModA.gain.setValueAtTime( sgn * amp, t);
    pitchDelModB.gain.setValueAtTime(-sgn * amp, t);
    pitchDryGain.gain.setTargetAtTime(1 - mix, t, 0.02);
    pitchWetGain.gain.setTargetAtTime(mix,     t, 0.02);
  } else {
    pitchDelModA.gain.setValueAtTime(0, t);
    pitchDelModB.gain.setValueAtTime(0, t);
    pitchDryGain.gain.setTargetAtTime(1, t, 0.02);
    pitchWetGain.gain.setTargetAtTime(0, t, 0.02);
  }
}

export function setSamplerLoop(start: number, end: number, active: boolean): void {
  STORE.audio.sampler = { loopStart: start, loopEnd: end, loopActive: active };
  if (loopWatchdog !== null) { clearInterval(loopWatchdog); loopWatchdog = null; }
  if (!active || !audioEl || end <= start) return;
  loopWatchdog = window.setInterval(() => {
    if (!audioEl) return;
    if (audioEl.currentTime >= end) audioEl.currentTime = start;
  }, 50);
}

export function getAnalyserData(): F32 | null {
  if (!analyserNode) return null;
  const buf = f32(analyserNode.frequencyBinCount);
  analyserNode.getFloatFrequencyData(buf);
  return buf;
}

export function getAudioContext(): AudioContext | null { return ctx; }
export function getAudioElement(): HTMLAudioElement | null { return audioEl; }

// K3: short UI click tone — bypasses the audio effects chain
export function playUIClick(freq = 1200, vol = 0.12): void {
  if (!ctx) return;
  try {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.022);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.025);
  } catch { /* ignore if ctx is suspended */ }
}
