// Shared texture references for the TARIMA (camino B) webcam experience.
// Using `any` to avoid importing THREE on the server.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FACE_TEX_REF: { value: any } = { value: null }; // legacy snapshot ref (unused)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LIVE_TEX_REF: { value: any } = { value: null }; // live VideoTexture, written by useFaceTracking
