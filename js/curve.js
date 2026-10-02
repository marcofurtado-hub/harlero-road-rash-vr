// "Tambor": o mundo é desenhado em cima de um cilindro gigante (eixo X) que gira na sua direção.
// A lógica do jogo continua plana (x, y, z); só a renderização enrola tudo no tambor.
// Espaço "plano" = coordenadas do jogo. Espaço "aparente" = como aparece na tela (enrolado).
import * as THREE from 'three';

export const DRUM_R = 220;
export const CURVE = { uR: { value: DRUM_R } };
const MAX_TH = 1.75; // não deixa a geometria dar a volta no tambor

export function curveMaterial(m) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uR = CURVE.uR;
    shader.vertexShader =
      'uniform float uR;\n' +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
vec4 bwp = modelMatrix * mvPosition;
float th = clamp( -bwp.z / uR, -${MAX_TH.toFixed(2)}, ${MAX_TH.toFixed(2)} );
float rr = uR + bwp.y;
bwp.y = rr * cos( th ) - uR;
bwp.z = -rr * sin( th );
mvPosition = viewMatrix * bwp;
gl_Position = projectionMatrix * mvPosition;`
      );
  };
  m.customProgramCacheKey = () => 'drum';
  return m;
}

// plano -> aparente (in-place)
export function toDrum(v) {
  const th = Math.max(-MAX_TH, Math.min(MAX_TH, -v.z / DRUM_R));
  const r = DRUM_R + v.y;
  v.y = r * Math.cos(th) - DRUM_R;
  v.z = -r * Math.sin(th);
  return v;
}

// aparente -> plano (in-place)
export function fromDrum(v) {
  const yy = v.y + DRUM_R;
  const r = Math.hypot(yy, v.z);
  const th = Math.atan2(-v.z, yy);
  v.y = r - DRUM_R;
  v.z = -th * DRUM_R;
  return v;
}

// altura de um ponto aparente acima da superfície do tambor
export function drumHeight(v) {
  return Math.hypot(v.y + DRUM_R, v.z) - DRUM_R;
}

// ângulo do tambor num ponto aparente (pra alinhar coisas tangentes ao chão)
export function drumAngle(v) {
  return Math.atan2(-v.z, v.y + DRUM_R);
}
