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
