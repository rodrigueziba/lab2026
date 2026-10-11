// T4 / T6: Web Audio engine.
// Graph: source → LP → HP → distortion → delay → reverb → gain(vol) → analyser → dest
// All functions are no-ops until init() is called on a user-gesture.

import { STORE, storeNotify } from "./alightStore";

let ctx:          AudioContext | null = null;
let sourceNode:   MediaElementAudioSourceNode | null = null;
let lpFilter:     BiquadFilterNode | null = null;
let hpFilter:     BiquadFilterNode | null = null;
let distShaper:   WaveShaperNode | null = null;
let delayNode:    DelayNode | null = null;
let delayFB:      GainNode | null = null;
let reverbConv:   ConvolverNode | null = null;
let reverbWet:    GainNode | null = null;
let reverbDry:    GainNode | null = null;
let masterGain:   GainNode | null = null;
let analyserNode: AnalyserNode | null = null;
let lfoOsc:       OscillatorNode | null = null;
let lfoGain:      GainNode | null = null;

let audioEl: HTMLAudioElement | null = null;
let loopWatchdog: number | null = null;

// ── IR generator for reverb ────────────────────────────────────────────────────
function makeIR(c: AudioContext, durationSec = 2.0): AudioBuffer {
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

// TypeScript 5 types new Float32Array(n) as Float32Array<ArrayBufferLike> which causes
// assignment errors with Web Audio API methods that expect Float32Array<ArrayBuffer>.
// Cast once here; at runtime these are identical.
type F32 = Float32Array<ArrayBuffer>;
/* eslint-disable @typescript-eslint/no-explicit-any */
function f32(n: number): F32 { return new Float32Array(n) as any as F32; }

// ── Distortion curve ───────────────────────────────────────────────────────────
function makeDistCurve(amount: number): F32 {
  const n     = 256;
  const curve = f32(n);
  const k     = amount * 100;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// ── init ───────────────────────────────────────────────────────────────────────
export async function initAudio(existingEl?: HTMLAudioElement): Promise<void> {
  if (ctx) return;

  audioEl = existingEl ?? document.createElement("audio");
  if (!existingEl) {
    audioEl.crossOrigin = "anonymous";
    document.body.appendChild(audioEl);
  }

  ctx          = new AudioContext();
  sourceNode   = ctx.createMediaElementSource(audioEl);
  lpFilter     = ctx.createBiquadFilter();
  hpFilter     = ctx.createBiquadFilter();
  distShaper   = ctx.createWaveShaper();
  delayNode    = ctx.createDelay(5.0);
  delayFB      = ctx.createGain();
  reverbConv   = ctx.createConvolver();
  reverbWet    = ctx.createGain();
  reverbDry    = ctx.createGain();
  masterGain   = ctx.createGain();
  analyserNode = ctx.createAnalyser();

  lpFilter.type      = "lowpass";
  lpFilter.frequency.value  = 20000;
  hpFilter.type      = "highpass";
  hpFilter.frequency.value  = 20;
  distShaper.curve   = makeDistCurve(0);
  distShaper.oversample = "4x";
  delayNode.delayTime.value = 0;
  delayFB.gain.value        = 0;
  reverbConv.buffer         = makeIR(ctx);
  reverbWet.gain.value      = 0;
  reverbDry.gain.value      = 1;
  masterGain.gain.value     = STORE.audio.volume;
  analyserNode.fftSize      = 256;

  // Chain: source → LP → HP → distortion → [delay loop] → dry/wet reverb mix → master → analyser → dest
  sourceNode.connect(lpFilter);
  lpFilter.connect(hpFilter);
  hpFilter.connect(distShaper);
  distShaper.connect(delayNode);
  delayNode.connect(delayFB);
  delayFB.connect(delayNode); // feedback loop
  delayNode.connect(reverbDry);
  delayNode.connect(reverbConv);
  reverbDry.connect(masterGain);
  reverbConv.connect(reverbWet);
  reverbWet.connect(masterGain);
  masterGain.connect(analyserNode);
  analyserNode.connect(ctx.destination);

  // Resume if suspended (browser autoplay policy)
  if (ctx.state === "suspended") {
    const resume = () => { ctx?.resume(); document.removeEventListener("click", resume); document.removeEventListener("keydown", resume); };
    document.addEventListener("click", resume);
    document.addEventListener("keydown", resume);
  }
}

// ── Playlist ───────────────────────────────────────────────────────────────────
export function loadPlaylist(tracks: string[]): void {
  STORE.audio.tracks = tracks;
  storeNotify();
}

export async function playTrack(index: number): Promise<void> {
  if (!audioEl || !ctx) return;
  const tracks = STORE.audio.tracks;
  if (!tracks.length) return;
  const i = ((index % tracks.length) + tracks.length) % tracks.length;
  STORE.audio.trackIndex = i;
  audioEl.src = tracks[i];
  audioEl.loop = false;
  if (ctx.state === "suspended") await ctx.resume();
  audioEl.play().catch(() => {});
  audioEl.onended = () => playTrack(STORE.audio.trackIndex + 1);
  storeNotify();
}

export const nextTrack = () => playTrack(STORE.audio.trackIndex + 1);
export const prevTrack = () => playTrack(STORE.audio.trackIndex - 1);

// ── T6 controls ────────────────────────────────────────────────────────────────
export function setVolume(v: number): void {
  STORE.audio.volume = v;
  if (masterGain) masterGain.gain.linearRampToValueAtTime(v, (ctx?.currentTime ?? 0) + 0.05);
}

export function setLP(enabled: boolean, frequency: number): void {
  STORE.audio.lowPass = { enabled, frequency };
  if (!lpFilter || !ctx) return;
  lpFilter.frequency.linearRampToValueAtTime(enabled ? frequency : 20000, ctx.currentTime + 0.05);
}

export function setHP(enabled: boolean, frequency: number): void {
  STORE.audio.highPass = { enabled, frequency };
  if (!hpFilter || !ctx) return;
  hpFilter.frequency.linearRampToValueAtTime(enabled ? frequency : 20, ctx.currentTime + 0.05);
}

export function setDistortion(amount: number): void {
  STORE.audio.distortion = amount;
  if (distShaper) distShaper.curve = makeDistCurve(amount);
}

export function setDelay(amount: number, feedback: number): void {
  STORE.audio.delay = { amount, feedback };
  if (!delayNode || !delayFB || !ctx) return;
  delayNode.delayTime.linearRampToValueAtTime(amount * 0.8, ctx.currentTime + 0.05);
  delayFB.gain.linearRampToValueAtTime(feedback * 0.9, ctx.currentTime + 0.05);
}

export function setReverb(amount: number): void {
  STORE.audio.reverb = amount;
  if (!reverbWet || !reverbDry || !ctx) return;
  reverbWet.gain.linearRampToValueAtTime(amount, ctx.currentTime + 0.05);
  reverbDry.gain.linearRampToValueAtTime(1 - amount * 0.5, ctx.currentTime + 0.05);
}

export function setLFO(speed: number, depth: number, waveform: OscillatorType, target: string): void {
  if (!ctx || !masterGain || !lpFilter) return;
  STORE.audio.lfo = { ...STORE.audio.lfo, speed, depth, waveform: waveform as any, target: target as any };

  if (lfoOsc) { lfoOsc.stop(); lfoOsc.disconnect(); lfoOsc = null; }
  if (lfoGain) { lfoGain.disconnect(); lfoGain = null; }

  if (depth <= 0) return;

  lfoOsc  = ctx.createOscillator();
  lfoGain = ctx.createGain();
  lfoOsc.type      = waveform;
  lfoOsc.frequency.value = speed;
  lfoGain.gain.value     = depth;
  lfoOsc.connect(lfoGain);

  if (target === "volume") {
    lfoGain.connect(masterGain.gain);
  } else if (target === "cutoff") {
    lfoGain.connect(lpFilter.frequency);
  }

  lfoOsc.start();
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
