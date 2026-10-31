// Module-level shared state for the TARIMA path.
// No Zustand — plain objects mutated in place so useFrame can read without re-renders.
// React components that need to re-render use storeSubscribe.

export type OscType   = "sine" | "square" | "sawtooth" | "triangle";
export type LFOTarget = "volume" | "cutoff" | "pitch";

export const STORE = {
  dome: {
    sectorEnabled:   [true, true, true, true, true, true, true] as boolean[],
    sectorIntensity: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0] as number[],
    globalSpeed:     1.0,
    psychedelic:     false,
    reactiveAudio:   false,
  },
  webcam: {
    brightness: 1.0,
    contrast:   1.0,
    saturation: 1.0,
    zoom:       1.0,
  },
  cam: { fov: 90 },
  lights: {
    globalIntensity: 1.0,
    extras: [] as Array<{ color: string; intensity: number; position: [number, number, number] }>,
  },
  audio: {
    volume:     0.8,
    lowPass:    { enabled: false, frequency: 8000 },
    highPass:   { enabled: false, frequency:  200 },
    distortion: 0.0,
    distEffect: { enabled: false, drive: 10,  mix: 0.5 },
    phaser:     { enabled: false, speed: 1.0, depth: 0.5 },
    pitch:      { enabled: false, semitones: 0, mix: 0.5 },
    delay:      { amount: 0.0, feedback: 0.3 },
    reverb:     0.0,
    lfo:        { speed: 2.0, depth: 0.0, waveform: "sine" as OscType, target: "volume" as LFOTarget },
    sampler:    { loopStart: 0, loopEnd: -1, loopActive: false },
    trackIndex: 0,
    tracks:     [] as string[],
    paused:     false,
  },
};

type Listener = () => void;
const _listeners = new Set<Listener>();
export const storeSubscribe = (fn: Listener): (() => void) => {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
};
export const storeNotify = () => _listeners.forEach(fn => fn());

// J1: lectern trigger — today called by the timer after people appear; future: ink.js dialog
export const LECTERN_TRIGGER = "timer" as const;
export function requestLecterns(): void {
  window.dispatchEvent(new CustomEvent("alight:request-lecterns"));
}

// T1: single idempotent entry point for visualizer activation.
// Used by key E, prism touch, and the debug button — nothing else activates the visualizer.
let _vizActivated = false;
export function activateVisualizerOnce(): void {
  if (_vizActivated) return;
  _vizActivated = true;
  console.info("[ACTIVACION] activateVisualizerOnce — dispatching alight:visualizer-activate");
  window.dispatchEvent(new CustomEvent("alight:visualizer-activate"));
}
export function isVizActivated(): boolean { return _vizActivated; }
export function resetVizActivated(): void { _vizActivated = false; }

// U9: dawn sequence state machine
export type DawnPhase = 'inactivo' | 'amanecer' | 'completo';
const _DAWN_SECTOR_DEG = Math.floor(Math.random() * 360); // random on page load, stable per session
let _dawnPhase: DawnPhase = 'inactivo';
let _dawnStartT   = 0;   // clock.elapsedTime when phase 1 started
let _dawnCompleteT = 0;  // clock.elapsedTime when phase 1 ended

export function getDawnState() {
  return { phase: _dawnPhase, startT: _dawnStartT, completeT: _dawnCompleteT, sectorDeg: _DAWN_SECTOR_DEG };
}
export function startDawnSequence(clockT: number): void {
  if (_dawnPhase !== 'inactivo') return;
  _dawnPhase = 'amanecer';
  _dawnStartT = clockT;
}
export function finishDawnPhase1(clockT: number): void {
  if (_dawnPhase !== 'amanecer') return;
  _dawnPhase = 'completo';
  _dawnCompleteT = clockT;
  window.dispatchEvent(new CustomEvent('alight:dawn-complete'));
}
export function resetDawn(): void {
  _dawnPhase = 'inactivo';
  _dawnStartT = 0;
  _dawnCompleteT = 0;
}
export function skipDawnToFinal(clockT: number): void {
  _dawnPhase = 'completo';
  _dawnStartT    = clockT - 9999;
  _dawnCompleteT = clockT - 9999;
}

// W3: dome dawn sequence state machine (independiente de U9 que maneja VizPanorama)
export type DomeDawnPhase = 'inactivo' | 'amanecer' | 'completo';

let _domeDawnPhase: DomeDawnPhase = 'inactivo';
let _domeDawnStartT   = 0;   // clock.elapsedTime cuando arrancó la fase 1
let _domeDawnCompleteT = 0;  // clock.elapsedTime cuando terminó la fase 1

export function getDomeDawnState() {
  return { phase: _domeDawnPhase, startT: _domeDawnStartT, completeT: _domeDawnCompleteT };
}
export function startDomeDawn(clockT: number): void {
  if (_domeDawnPhase !== 'inactivo') return;
  _domeDawnPhase = 'amanecer';
  _domeDawnStartT = clockT;
}
export function finishDomeDawnPhase1(clockT: number): void {
  if (_domeDawnPhase !== 'amanecer') return;
  _domeDawnPhase = 'completo';
  _domeDawnCompleteT = clockT;
  window.dispatchEvent(new CustomEvent('alight:dome-dawn-complete'));
}
export function resetDomeDawnState(): void {
  _domeDawnPhase = 'inactivo';
  _domeDawnStartT = 0;
  _domeDawnCompleteT = 0;
}
export function skipDomeDawnState(clockT: number): void {
  _domeDawnPhase = 'completo';
  _domeDawnStartT    = clockT - 9999;
  _domeDawnCompleteT = clockT - 9999;
}

// Interaction mode — shared between Player (ThreeScene) and LecternSystem
export const INTERACT_STATE = {
  mode:         "none" as "none" | "image" | "sound",
  mouseNDC:     { x: 0, y: 0 },
  mouseDown:    false,
  dragId:       null as string | null,
  dragStartY:   0,
  dragStartVal: 0,
  // Prompt C: camera fly-in/out
  camAnimActive:   false,
  camAnimStart:    0,
  camAnimDur:      600,
  camAnimReverse:  false,   // false = saved→target (enter), true = target→saved (exit)
  camSaved:     null as { pos: [number,number,number]; quat: [number,number,number,number] } | null,
  camTarget:    null as { pos: [number,number,number]; quat: [number,number,number,number] } | null,
  camFovSaved:  90,   // K1: player FOV saved before lectern mode
  // S2: player world position — written each frame by ThreeScene, read by Prism
  playerPos: { x: 0, y: 1.6, z: 0 } as { x: number; y: number; z: number },
  // N1: sillas narrative sequencer
  // N6: initial state is 'cortina' (player behind the red curtain)
  experienceState: 'cortina' as 'cortina' | 'exploracion' | 'sillas_secuencia' | 'sala_activa',
  movementLocked: false,
};
