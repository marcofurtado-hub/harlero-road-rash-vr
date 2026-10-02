// "Curved world": o vértice é deslocado em X/Y conforme a distância à frente do jogador.
// A lógica do jogo continua numa estrada reta, mas visualmente a estrada faz curvas e morros.
import * as THREE from 'three';

export const CURVE = {
  uBend: { value: new THREE.Vector2(0, 0) },
  uBendStart: { value: 30 },
};
const MAXD = 260;

export function curveMaterial(m) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uBend = CURVE.uBend;
    shader.uniforms.uBendStart = CURVE.uBendStart;
    shader.vertexShader =
      'uniform vec2 uBend;\nuniform float uBendStart;\n' +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
vec4 bwp = modelMatrix * mvPosition;
float bd = clamp( -bwp.z - uBendStart, 0.0, ${MAXD.toFixed(1)} );
bwp.x += uBend.x * bd * bd;
bwp.y += uBend.y * bd * bd;
mvPosition = viewMatrix * bwp;
gl_Position = projectionMatrix * mvPosition;`
      );
  };
  m.customProgramCacheKey = () => 'curved';
  return m;
}

// Deslocamento aparente de um ponto no mundo (pra mira bater com o que se vê)
export function bendOffset(z, out) {
  const d = Math.min(Math.max(-z - CURVE.uBendStart.value, 0), MAXD);
  out.x = CURVE.uBend.value.x * d * d;
  out.y = CURVE.uBend.value.y * d * d;
  return out;
}
