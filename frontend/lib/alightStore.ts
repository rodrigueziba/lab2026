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
    delay:      { amount: 0.0, feedback: 0.3 },
    reverb:     0.0,
    lfo:        { speed: 2.0, depth: 0.0, waveform: "sine" as OscType, target: "volume" as LFOTarget },
    sampler:    { loopStart: 0, loopEnd: -1, loopActive: false },
    trackIndex: 0,
    tracks:     [] as string[],
  },
};

type Listener = () => void;
const _listeners = new Set<Listener>();
export const storeSubscribe = (fn: Listener): (() => void) => {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
};
export const storeNotify = () => _listeners.forEach(fn => fn());

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
  camSaved:  null as { pos: [number,number,number]; quat: [number,number,number,number] } | null,
  camTarget: null as { pos: [number,number,number]; quat: [number,number,number,number] } | null,
  // S2: player world position — written each frame by ThreeScene, read by Prism
  playerPos: { x: 0, y: 1.6, z: 0 } as { x: number; y: number; z: number },
};
