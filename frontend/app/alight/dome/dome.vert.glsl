// dome.vert.glsl
// Vertex shader del domo. Se usa sobre una esfera/hemisferio con side: BackSide.
// vDir = direccion desde el centro del domo (el espectador esta en el centro).
varying vec3 vDir;

void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
