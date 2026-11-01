// bigMeshData.ts — shared data populated by BigMeshScanner (inside Canvas)
// and read by DebugMenu (outside Canvas). No circular imports.
import type * as THREE from "three";

export type BigMeshEntry = {
  name: string;
  geoType: string;
  sX: number; sY: number; sZ: number;
  pX: number; pY: number; pZ: number;
  side: string;
  transparent: boolean;
  renderOrder: number;
  depthWrite: boolean;
  colorHex: string;
  obj: THREE.Object3D;
};

export const BIG_MESH_DATA: BigMeshEntry[] = [];
