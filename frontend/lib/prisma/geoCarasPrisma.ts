// Z43: geometría del overlay del fractal con coordenadas propias por cara (sin estirarse).
// El UV del ConeGeometry recorre las 3 caras con un solo u (0…1 alrededor) y en cada cara queda cortado
// (la punta es un vértice repetido): una imagen se estira y se corta entre caras. Acá se pasa a triángulos
// sueltos (toNonIndexed) y cada vértice recibe:
//   aCara   = 0, 1, 2 (caras laterales) o 3 (base)
//   aCaraUv = posición en METROS sobre el plano de su cara, centrada en el baricentro de la cara
//             (x a lo largo de la arista de la base, y hacia la punta). Isótropo: misma escala en x e y.
// Los triángulos degenerados del cono (área 0) no se dibujan; solo necesitan valores finitos.

import * as THREE from "three";

export function crearGeoCarasPrisma(radio: number, alto: number, lados = 3): THREE.BufferGeometry {
  const base = new THREE.ConeGeometry(radio, alto, lados, 1);
  const geo = base.toNonIndexed();
  base.dispose();
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const n = pos.count;
  const caraUv = new Float32Array(n * 2);
  const cara = new Float32Array(n);
  const paso = (Math.PI * 2) / lados;
  const h2 = alto / 2;
  const A = new THREE.Vector3(), B0 = new THREE.Vector3(), B1 = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), centro = new THREE.Vector3(), m = new THREE.Vector3();
  const p = new THREE.Vector3(), q = new THREE.Vector3();

  for (let t = 0; t < n; t += 3) {
    // centroide del triángulo → ¿base o cara lateral k?
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < 3; j++) { cx += pos.getX(t + j); cy += pos.getY(t + j); cz += pos.getZ(t + j); }
    cx /= 3; cy /= 3; cz /= 3;
    const esBase = Math.abs(cy + h2) < 1e-5;
    let k = 3;
    if (!esBase) {
      // three: x = r·sin(θ), z = r·cos(θ), θ = u·2π
      let th = Math.atan2(cx, cz);
      if (th < 0) th += Math.PI * 2;
      k = Math.min(lados - 1, Math.floor(th / paso + 1e-6));
      const t0 = k * paso, t1 = (k + 1) * paso;
      A.set(0, h2, 0);
      B0.set(radio * Math.sin(t0), -h2, radio * Math.cos(t0));
      B1.set(radio * Math.sin(t1), -h2, radio * Math.cos(t1));
      e1.subVectors(B1, B0).normalize();
      m.addVectors(B0, B1).multiplyScalar(0.5);
      e2.subVectors(A, m).normalize();
      centro.copy(A).add(B0).add(B1).multiplyScalar(1 / 3);
    }
    for (let j = 0; j < 3; j++) {
      const i = t + j;
      p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      cara[i] = k;
      if (esBase) { caraUv[i * 2] = p.x; caraUv[i * 2 + 1] = p.z; }
      else {
        q.subVectors(p, centro);
        caraUv[i * 2] = q.dot(e1);
        caraUv[i * 2 + 1] = q.dot(e2);
      }
    }
  }
  geo.setAttribute("aCaraUv", new THREE.BufferAttribute(caraUv, 2));
  geo.setAttribute("aCara", new THREE.BufferAttribute(cara, 1));
  return geo;
}

/** Z44: medidas de una cara lateral en el sistema de aCaraUv: ancho de la base (m) e y de la base
 *  respecto del baricentro (m, negativa). Para encuadrar el cuadro del original sobre la cara. */
export function dimCaraPrisma(radio: number, alto: number, lados = 3): { ancho: number; yBase: number } {
  const ancho = 2 * radio * Math.sin(Math.PI / lados);
  const apotema = radio * Math.cos(Math.PI / lados);
  const inclinada = Math.hypot(alto, apotema);   // de la mitad de la base a la punta
  return { ancho, yBase: -inclinada / 3 };
}
