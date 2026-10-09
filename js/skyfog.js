// Neblina com a cor do CÉU atrás de cada pixel (mesmo degradê e brilho do sol do shader do céu).
// Sem isso, um morro longe some numa cor de horizonte fixa enquanto o céu atrás dele é de outra cor,
// e fica com cara de recorte branco. Aqui o objeto distante "derrete" exatamente no céu.
import * as THREE from 'three';

export const SKYFOG = {
  uSkyTop: { value: new THREE.Color() },
  uSkyMid: { value: new THREE.Color() },
  uSkyHor: { value: new THREE.Color() },
  uSkySun: { value: new THREE.Vector3(0, 0.07, -1).normalize() },
};

const C = THREE.ShaderChunk;
C.fog_pars_vertex = `#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogDir;
#endif`;
// direção do pixel no mundo = rotação inversa da view aplicada à posição no espaço da câmera
C.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogDir = transpose( mat3( viewMatrix ) ) * mvPosition.xyz;
#endif`;
C.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyMid;
  uniform vec3 uSkyHor;
  uniform vec3 uSkySun;
  varying float vFogDepth;
  varying vec3 vFogDir;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
C.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  vec3 fd = normalize( vFogDir );
  float fh = fd.y;
  vec3 fc = mix( uSkyHor, uSkyMid, smoothstep( 0.0, 0.25, fh ) );
  fc = mix( fc, uSkyTop, smoothstep( 0.25, 0.8, fh ) );
  fc += vec3( 1.0, 0.75, 0.45 ) * pow( max( dot( fd, uSkySun ), 0.0 ), 12.0 ) * 0.35;
  if ( fh < 0.0 ) fc = uSkyHor;
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fc, fogFactor );
#endif`;

// todo material recebe os uniforms do céu (o curveMaterial chama isso também)
export function skyFog(shader) {
  Object.assign(shader.uniforms, SKYFOG);
}
THREE.Material.prototype.onBeforeCompile = skyFog;
