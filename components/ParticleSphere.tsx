'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface Props {
  isListening: boolean
  intensity: number
  searchPulse: number
}

function makeSoftDot(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size / 2
  const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.98)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.18, 'rgba(255,255,255,0.92)')
  g.addColorStop(0.42, 'rgba(255,255,255,0.22)')
  g.addColorStop(0.62, 'rgba(255,255,255,0.04)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  return tex
}

function pixelRatioForWidth(cssWidth: number): number {
  const dpr = window.devicePixelRatio || 1
  if (cssWidth >= 1800) return Math.min(dpr, 2.5)
  if (cssWidth >= 1200) return Math.min(dpr, 2)
  return Math.min(dpr, 1.75)
}

const RADIUS = 2.2
const COUNT = 48_000
const INTRO_DURATION = 2.45

function introFromElapsed(elapsed: number) {
  const et = Math.min(elapsed, INTRO_DURATION)
  const scaleT = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(et / 0.7, 0, 1), 0, 1)
  const uIntroScale = THREE.MathUtils.lerp(0.79, 1, 1 - Math.pow(1 - scaleT, 2.35))
  const liftT = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(et / 2.0, 0, 1), 0, 1)
  const uIntroLift = 1 - Math.pow(1 - liftT, 1.2)
  const tImp = et - 0.085
  const uStrikeImpulse =
    Math.exp(-(tImp * tImp) / (2 * 0.034 * 0.034)) * THREE.MathUtils.smoothstep(et, 0.03, 0.32)
  const ringElapsed = Math.max(0, et - 0.12)
  const uRingPhase = ringElapsed * 2.08
  const uRingAmp =
    Math.exp(-ringElapsed * 0.74) * 1.22 * (1 - THREE.MathUtils.smoothstep(et, 1.35, 2.15))
  const camEase = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp((et - 0.22) / 1.38, 0, 1), 0, 1)
  const camEaseOut = 1 - Math.pow(1 - camEase, 2.05)
  const camZ = THREE.MathUtils.lerp(6.9, 5.45, camEaseOut)
  const camY = THREE.MathUtils.lerp(0.34, 0, camEaseOut * 0.9)
  return { uIntroScale, uIntroLift, uStrikeImpulse, uRingPhase, uRingAmp, camZ, camY }
}

function submitPulseFromDt(dt: number) {
  if (dt < 0 || dt > 1.15) return { imp: 0, phase: 0, amp: 0 }
  const tImp = dt - 0.055
  const imp =
    Math.exp(-(tImp * tImp) / (2 * 0.026 * 0.026)) * THREE.MathUtils.smoothstep(dt, 0.02, 0.36)
  const ringElapsed = Math.max(0, dt - 0.09)
  const phase = ringElapsed * 2.42
  const amp =
    Math.exp(-ringElapsed * 0.95) * 1.08 * (1 - THREE.MathUtils.smoothstep(dt, 0.55, 1.05))
  return { imp, phase, amp }
}

const NOISE_GLSL = /* glsl */ `
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`

const vertexShader = /* glsl */ `
precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

uniform float uTime;
uniform float uTa;
uniform float uTb;
uniform float uPh;
uniform float uFocus;
uniform float uIntensity;
uniform float uGain;
uniform float uCraterStrength;
uniform vec3 uCraterDir;
uniform float uPointScale;
uniform float uIntroScale;
uniform float uIntroLift;
uniform float uStrikeImpulse;
uniform float uRingPhase;
uniform float uRingAmp;
uniform float uSubmitImpulse;
uniform float uSubmitRingPhase;
uniform float uSubmitRingAmp;

in vec3 position;
in float aKind;
in float aSz;
in float aPhase;

out vec3 vColor;
out float vAlpha;
out float vTw;

${NOISE_GLSL}

vec3 palette(float x) {
  x = clamp(x, 0.0, 1.0);
  vec3 voidC = vec3(0.039215686, 0.0, 0.0);
  vec3 ember = vec3(0.72, 0.11, 0.06);
  vec3 orange = vec3(1.0, 0.36, 0.14);
  vec3 warm = vec3(1.0, 0.5, 0.18);
  vec3 pink = vec3(1.0, 0.102, 0.541);
  vec3 glow = vec3(1.0, 0.86, 0.9);
  if (x < 0.18) return mix(voidC, ember, x / 0.18);
  if (x < 0.46) return mix(ember, orange, (x - 0.18) / 0.28);
  if (x < 0.74) return mix(orange, warm, (x - 0.46) / 0.28);
  if (x < 0.9) return mix(warm, pink, (x - 0.74) / 0.16);
  return mix(pink, glow, (x - 0.9) / 0.1);
}

float craterMul(vec3 dir, float kind, float capMul) {
  if (uCraterStrength < 0.001 || length(uCraterDir) < 0.01) return 1.0;
  vec3 c = normalize(uCraterDir);
  float dotc = clamp(dot(dir, c), -1.0, 1.0);
  float ang = acos(dotc);
  float cap = (kind < 0.5) ? 0.52 : ((kind > 1.5) ? 0.46 : 0.58);
  cap *= capMul;
  if (ang >= cap) return 1.0;
  float uu = 1.0 - ang / cap;
  float bowl = uu * uu * (3.0 - 2.0 * uu);
  float rim = sin(uu * 3.14159265) * 0.1;
  float dip = bowl * (1.0 + rim);
  float shellMul = kind < 0.5 ? 1.0 : (kind > 1.5 ? 0.62 : 1.0);
  float depth = kind > 1.5 ? 0.19 : (kind < 0.5 ? 0.19 : 0.13);
  if (kind > 0.5 && kind < 1.5) depth = 0.13;
  return 1.0 - dip * uCraterStrength * depth * shellMul;
}

void main() {
  vec3 base = position;
  vec3 dir = normalize(base);
  float rLen = length(base);
  float kind = aKind;

  float sinP = sin(uPh);
  float inward = max(0.0, sinP);
  float outw = max(0.0, -sinP);
  float rLung = 1.0 - 0.1 * inward + 0.028 * outw;

  vec3 localPos;
  float colorT;
  float brightness;
  float tw = 1.0;

  if (kind > 0.5 && kind < 1.5) {
    float s0 = 0.42;
    float fx = snoise(dir * s0 + vec3(uTa, uTa, uTa));
    float turb = abs(fx) * 1.2;
    colorT = 0.02 + min(1.0, turb * 0.2) * 0.08;
    brightness = 0.04 + 0.07 * turb;
    colorT *= (1.0 - 0.16 * uFocus);
    brightness *= (1.0 - 0.1 * uFocus);
    brightness *= (1.0 + 0.4 * clamp(pow(uIntensity, 0.85), 0.0, 1.0) * 0.28);
    tw = 0.9 + 0.22 * pow(0.5 + 0.5 * sin(fx * 2.4 + uTime * 0.5 + dir.y * 0.1), 0.45);
    float asymI = 1.0 + 0.032 * sin(uPh + dir.x * 2.35 + dir.y * 1.75 + dir.z * 2.05);
    float rC = craterMul(dir, kind, 1.0);
    localPos = dir * rLen * rC * asymI;
  } else {
    float nSlow = snoise(dir * 0.2 + vec3(1.0, 1.0, 1.0) + vec3(0.0, 0.0, uTb * 0.2));
    float fold = 0.55 + 0.45 * nSlow;
    float rBreath = rLung * (1.0 - 0.12 * inward * fold) * (1.0 + 0.05 * outw * (0.3 + 0.7 * (1.0 - fold)));
    float rRipple = 1.0 + 0.014 * sin(1.15 * uTime + 2.0 * dir.x + 0.7 * dir.z)
      + 0.008 * sin(2.0 * uTime - 1.2 * dir.y);

    float c0 = cos(uTime * 0.14);
    float s0 = sin(uTime * 0.14);
    float c1 = cos(uTime * 0.11);
    float s1 = sin(uTime * 0.11);
    float a = c0 * dir.x - s0 * dir.y;
    float b = s0 * dir.x + c0 * dir.y;
    float cc = dir.z;
    float rx = a;
    float ry = c1 * b - s1 * cc;
    float rz = s1 * b + c1 * cc;

    float s = 0.42;
    vec3 rs = vec3(rx, ry, rz) * s;
    float f1x = snoise(rs + vec3(uTa, uTa, uTa));
    float f1y = snoise(rs + vec3(18.0, uTb, 0.0));
    float f1z = snoise(rs + vec3(33.0, 0.0, uTa));
    float f2x = snoise(vec3(rx, ry, rz) * 0.88 + vec3(3.0 + uTa * 0.5, 0.0, 0.0));
    float f2y = snoise(vec3(rx, ry, rz) * 0.88 + vec3(0.0, 0.0, 4.0));
    float g3x = snoise(vec3(ry * 0.29 + uTime * 0.11, rz * 0.29, rx * 0.29));
    float g3y = snoise(vec3(rz * 0.29, rx * 0.29 + 0.4, ry * 0.29 + uTime * 0.09));
    float g3z = snoise(vec3(rx * 0.29, ry * 0.29, rz * 0.29 + uTime * 0.1));

    float px = dir.x, py = dir.y, pz = dir.z;
    float dot1 = f1x * px + f1y * py + f1z * pz;
    float tx = f1x - px * dot1;
    float ty = f1y - py * dot1;
    float tz = f1z - pz * dot1;
    float d2 = f2x * px + f2y * py;
    tx += (f2x - px * d2) * 0.32;
    ty += (f2y - py * d2) * 0.32;
    tz += -pz * d2 * 0.28;
    float d3 = g3x * px + g3y * py + g3z * pz;
    tx += (g3x - px * d3) * 0.55;
    ty += (g3y - py * d3) * 0.55;
    tz += (g3z - pz * d3) * 0.55;

    float fMag = kind < 0.5 ? (0.12 + 0.04 * abs(f1x)) : 0.22;
    float capT = kind < 0.5 ? 0.13 : 0.16;
    float tLen = length(vec3(tx, ty, tz)) + 1e-6;
    float tScale = fMag * min(1.0, capT / tLen);
    vec3 off = vec3(tx, ty, tz) * tScale;

    float rBase = rLen * rBreath * rRipple;
    float rC = craterMul(dir, kind, 1.0);
    localPos = dir * rBase * rC + off;

    float turb = length(vec3(tx, ty, tz));
    float ridgeN = 0.5 + 0.5 * sin(f1x * 5.0 + f1y * 3.2 + uTime * 0.4);
    if (kind < 0.5) {
      float streamIntensity = min(1.0, turb * 1.1 + ridgeN * 0.4);
      colorT = 0.18 + streamIntensity * 0.7;
      brightness = 0.2 + 0.58 * pow(streamIntensity, 0.75);
    } else {
      colorT = 0.12 + min(1.0, turb * 0.5 + ridgeN * 0.25) * 0.45;
      brightness = 0.08 + 0.22 * pow(turb * 0.6 + 0.1, 0.85);
    }
    colorT *= (1.0 - 0.16 * uFocus);
    brightness *= (1.0 - 0.1 * uFocus);
    if (uIntensity > 0.05) {
      brightness = min(1.0, brightness + uIntensity * 0.08 * (1.1 - uIntensity * 0.25));
    }
    tw = 0.9 + 0.22 * pow(0.5 + 0.5 * sin(f1x * 2.4 + uTime * 0.5 + f1y), 0.45);
  }

  localPos *= uIntroScale;

  float drift = 0.14 * sin(uTime * 0.14 + dir.x * 1.8 + dir.y * 1.2 + dir.z * 1.5 + aPhase);
  if (kind > 0.5 && kind < 1.5) {
    drift = 0.15 * snoise(dir * 0.48 + vec3(uTime * 0.042, -uTime * 0.03, uTime * 0.025))
      + 0.08 * sin(uTime * 0.24 + dir.x * 1.9 + dir.y * 1.1 + dir.z * 1.4 + aSz * 2.1);
    colorT = clamp(colorT + drift * 0.22, 0.0, 0.92);
  } else {
    drift = 0.16 * snoise(dir * 0.4 + vec3(uTime * 0.048, -uTime * 0.022, uTime * 0.036))
      + 0.09 * sin(uTime * 0.27 + dir.x * 1.6 + dir.y + dir.z * 1.5);
    colorT = clamp(colorT + drift * 0.2 + aSz * 0.04 * sin(uTime * 0.19 + dir.x * 3.0), 0.0, 0.92);
  }

  // Warm gradient layer: more orange at rest, smoother pink reveal on listening.
  float warmGrad = 0.5 + 0.5 * sin(dir.y * 2.3 + dir.x * 1.6 + dir.z * 0.9 + uTime * 0.16);
  float orangeBias = mix(0.2, 0.06, uFocus) * warmGrad;
  float focusLift = 0.12 * uFocus;
  colorT = clamp(colorT * (0.78 - 0.05 * uFocus) + orangeBias + focusLift, 0.01, 0.9);

  float znWide = snoise(dir * 0.52 + vec3(uTime * 0.024, -uTime * 0.018, uTb * 0.11));
  float znFine = snoise(dir * 1.32 + vec3(6.0, -4.0, 2.0) + vec3(uTa * 0.07, uTime * 0.042, uTime * 0.028));
  float zoneMix = clamp(0.5 + 0.5 * znWide, 0.0, 1.0) * 0.62 + clamp(0.5 + 0.5 * znFine, 0.0, 1.0) * 0.38;
  float zoneBright = mix(0.72, 1.45, zoneMix);
  if (kind > 0.5 && kind < 1.5) {
    zoneBright = mix(1.0, zoneBright, 0.58);
  }
  zoneBright = mix(1.0, zoneBright, 1.0 - 0.4 * uFocus);
  brightness *= zoneBright;
  brightness *= (1.0 + 0.28 * uFocus);

  brightness = brightness * uGain * tw;

  float introBase = mix(0.08, 1.0, smoothstep(0.0, 1.0, uIntroLift));
  float angFromPole = acos(clamp(dir.z, -1.0, 1.0));
  float ringDelta = angFromPole - uRingPhase;
  float ringGlow = exp(-(ringDelta * ringDelta) * 40.0) * uRingAmp;
  float submitRingDelta = angFromPole - uSubmitRingPhase;
  float submitRingGlow = exp(-(submitRingDelta * submitRingDelta) * 38.0) * uSubmitRingAmp;
  brightness = brightness * introBase + uStrikeImpulse * 0.58 + ringGlow * 1.05;
  brightness += uSubmitImpulse * 0.52 + submitRingGlow * 0.92;
  brightness = clamp(brightness, 0.0, 2.45);
  float beat = 0.945 + 0.09 * (0.5 + 0.5 * sin(uTime * 0.355) * sin(uTime * 0.431));
  brightness *= beat;

  vec3 baseHue = palette(colorT);
  vec3 priorityHue = vec3(1.0, 0.102, 0.541) * 0.5 + vec3(1.0) * 0.3 + vec3(1.0, 0.36, 0.14) * 0.2;
  vec3 finalHue = mix(baseHue, priorityHue, 0.78);
  vColor = finalHue * brightness * aSz;
  vAlpha = min(0.95, 0.55 + brightness * 0.35) * tw;
  vTw = tw;

  vec4 mvPosition = modelViewMatrix * vec4(localPos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  float dist = -mvPosition.z;
  float szNoise = 0.94 + 0.06 * snoise(dir * 3.5 + uTime * 0.1 + aPhase);
  float szW = pow(clamp(aSz, 0.15, 1.65), 0.42);
  float twW = mix(1.0, tw, 0.22);
  float ps = uPointScale * szNoise * szW * twW * (34.0 / max(dist, 0.55));
  gl_PointSize = clamp(ps, 1.0, 56.0);
}
`

const fragmentShader = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
in vec3 vColor;
in float vAlpha;
in float vTw;
out vec4 fragColor;

void main() {
  vec2 pc = gl_PointCoord * 2.0 - 1.0;
  if (dot(pc, pc) > 1.0) discard;
  vec4 tex = texture(uMap, gl_PointCoord);
  float cover = pow(tex.a, 1.12);
  float a = cover * vAlpha;
  fragColor = vec4(vColor * tex.rgb, a);
}
`

export default function ParticleSphere({ isListening, intensity, searchPulse }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ isListening, intensity, searchPulse })
  const calmBlendRef = useRef(0)

  useEffect(() => {
    stateRef.current = { isListening, intensity, searchPulse }
  }, [isListening, intensity, searchPulse])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let cancelled = false

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)

    const camera = new THREE.PerspectiveCamera(55, Math.max(1, mount.clientWidth) / Math.max(1, mount.clientHeight), 0.1, 100)
    camera.position.z = 6.9
    camera.position.y = 0.34

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15

    const readSize = () => {
      const r = mount.getBoundingClientRect()
      let w = Math.max(Math.round(r.width), mount.clientWidth, mount.offsetWidth)
      let h = Math.max(Math.round(r.height), mount.clientHeight, mount.offsetHeight)
      if (w < 2 || h < 2) {
        w = Math.max(w, Math.min(window.innerWidth, 1920))
        h = Math.max(h, Math.min(window.innerHeight, 1200))
      }
      return { w, h }
    }

    const applySize = () => {
      const { w, h } = readSize()
      if (w < 1 || h < 1) return
      renderer.setPixelRatio(pixelRatioForWidth(w))
      renderer.setSize(w, h)
    }
    applySize()
    const canvas = renderer.domElement
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    mount.appendChild(canvas)

    const pos = new Float32Array(COUNT * 3)
    const kindArr = new Float32Array(COUNT)
    const szArr = new Float32Array(COUNT)
    const phaseArr = new Float32Array(COUNT)

    for (let i = 0; i < COUNT; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / COUNT)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i
      const px = Math.sin(phi) * Math.cos(theta)
      const py = Math.sin(phi) * Math.sin(theta)
      const pz = Math.cos(phi)
      const roll = Math.random()
      let r0: number
      let k: number
      let sz: number
      if (roll < 0.62) {
        const t = Math.pow(Math.random(), 1.8)
        r0 = RADIUS * (0.94 + 0.12 * t)
        k = 0
        sz = 0.9 + 0.6 * Math.random()
      } else if (roll < 0.8) {
        r0 = RADIUS * (1.02 + 0.2 * Math.pow(Math.random(), 0.8))
        k = 2
        sz = 0.25 + 0.35 * Math.random()
      } else {
        r0 = RADIUS * 0.15 + RADIUS * 0.78 * Math.pow(Math.random(), 0.6)
        k = 1
        sz = 0.2 + 0.3 * Math.random()
      }
      pos[i * 3] = px * r0
      pos[i * 3 + 1] = py * r0
      pos[i * 3 + 2] = pz * r0
      kindArr[i] = k
      szArr[i] = sz
      phaseArr[i] = Math.random() * Math.PI * 2
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aKind', new THREE.BufferAttribute(kindArr, 1))
    geo.setAttribute('aSz', new THREE.BufferAttribute(szArr, 1))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phaseArr, 1))
    geo.computeBoundingSphere()
    if (geo.boundingSphere) {
      geo.boundingSphere.radius = Math.max(geo.boundingSphere.radius * 2.5, 12)
    }

    const tex = makeSoftDot()
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())

    const mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        modelViewMatrix: { value: new THREE.Matrix4() },
        projectionMatrix: { value: new THREE.Matrix4() },
        uTime: { value: 0 },
        uTa: { value: 0 },
        uTb: { value: 0 },
        uPh: { value: 0 },
        uFocus: { value: 0 },
        uIntensity: { value: 0 },
        uGain: { value: 1 },
        uCraterStrength: { value: 0 },
        uCraterDir: { value: new THREE.Vector3(0, 0, 0) },
        uPointScale: { value: 1.02 },
        uIntroScale: { value: 0.79 },
        uIntroLift: { value: 0 },
        uStrikeImpulse: { value: 0 },
        uRingPhase: { value: 0 },
        uRingAmp: { value: 0 },
        uSubmitImpulse: { value: 0 },
        uSubmitRingPhase: { value: 0 },
        uSubmitRingAmp: { value: 0 },
        uMap: { value: tex },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      toneMapped: false,
      depthTest: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })

    const pts = new THREE.Points(geo, mat)
    pts.frustumCulled = false
    scene.add(pts)

    canvas.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault()
        console.warn('ParticleSphere: WebGL context lost')
      },
      false,
    )

    const mouse = { nx: 0, ny: 0, px: 0, py: 0, over: false }
    const rotTarget = { x: 0, y: 0 }
    const rotCur = { x: 0, y: 0 }
    const tiltEuler = new THREE.Euler(0, 0, 0, 'YXZ')
    const tiltM4 = new THREE.Matrix4()

    const submitPulseRef = { version: 0, t0: -1e6 }
    const gyroRaw = { gx: 0, gy: 0, ok: false }
    const gyroSm = { x: 0, y: 0 }
    let gyroMix = 0
    let orientAttached = false

    const onDeviceOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      const g = Math.max(-44, Math.min(44, e.gamma))
      const b = Math.max(-40, Math.min(40, e.beta - 40))
      gyroRaw.gx = THREE.MathUtils.degToRad(g) * 0.4
      gyroRaw.gy = THREE.MathUtils.degToRad(b) * -0.34
      gyroRaw.ok = true
    }

    const attachOrientation = () => {
      if (orientAttached || typeof window === 'undefined') return
      orientAttached = true
      window.addEventListener('deviceorientation', onDeviceOrient, { passive: true })
    }

    const tryIosOrientationPermission = () => {
      const DO = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
      if (typeof DO.requestPermission === 'function') {
        DO.requestPermission()
          .then((s) => {
            if (s === 'granted') attachOrientation()
          })
          .catch(() => {})
      } else {
        attachOrientation()
      }
    }

    const coarsePointer = () =>
      typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    if (coarsePointer()) {
      const onceOrient = () => {
        tryIosOrientationPermission()
        window.removeEventListener('touchend', onceOrient)
        window.removeEventListener('click', onceOrient)
      }
      window.addEventListener('touchend', onceOrient, { passive: true })
      window.addEventListener('click', onceOrient, { passive: true })
    } else {
      attachOrientation()
    }

    const craterDirLocal = new THREE.Vector3()
    let craterBlend = 0

    const BRIGHTNESS_MASTER = 1.45

    const onMove = (e: MouseEvent) => {
      mouse.px = e.clientX
      mouse.py = e.clientY
      const rect = canvas.getBoundingClientRect()
      mouse.over =
        rect.width > 0 &&
        rect.height > 0 &&
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      const u = (e.clientX - rect.left) / rect.width
      const v = (e.clientY - rect.top) / rect.height
      mouse.nx = u * 2 - 1
      mouse.ny = -(v * 2 - 1)
    }
    const onLeave = () => {
      mouse.over = false
    }
    window.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)

    const onResize = () => {
      if (!mount) return
      const { w, h } = readSize()
      if (w < 1 || h < 1) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      applySize()
    }
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    let tabVisible = !document.hidden
    const onVis = () => {
      tabVisible = !document.hidden
    }
    document.addEventListener('visibilitychange', onVis)

    const clock = new THREE.Clock()
    let frameId = 0
    let warmupId = 0
    let speedSmooth = 0.8
    let simTime = 0
    let prevT = 0

    const animate = () => {
      if (cancelled) return
      frameId = requestAnimationFrame(animate)
      if (!tabVisible) return

      const { isListening: listening, intensity: intens } = stateRef.current
      const calmTarget = listening ? 1 : 0
      const calmDelta = calmTarget - calmBlendRef.current
      const calmK = calmDelta < 0 ? 0.018 : 0.026
      calmBlendRef.current += calmDelta * calmK
      const c = calmBlendRef.current
      const cEase = c * c * (3.0 - 2.0 * c)

      const t = clock.getElapsedTime()
      const intro = introFromElapsed(t)
      mat.uniforms.uIntroScale.value = intro.uIntroScale
      mat.uniforms.uIntroLift.value = intro.uIntroLift
      mat.uniforms.uStrikeImpulse.value = intro.uStrikeImpulse
      mat.uniforms.uRingPhase.value = intro.uRingPhase
      mat.uniforms.uRingAmp.value = intro.uRingAmp
      camera.position.z = intro.camZ
      camera.position.y = intro.camY

      const sp = stateRef.current.searchPulse
      if (sp !== submitPulseRef.version) {
        submitPulseRef.version = sp
        submitPulseRef.t0 = t
      }
      const sub = submitPulseFromDt(t - submitPulseRef.t0)
      mat.uniforms.uSubmitImpulse.value = sub.imp
      mat.uniforms.uSubmitRingPhase.value = sub.phase
      mat.uniforms.uSubmitRingAmp.value = sub.amp

      const speedTarget = 0.8 + intens * 1.2
      speedSmooth += (speedTarget - speedSmooth) * 0.05
      const dt = Math.min(0.05, Math.max(0, t - prevT))
      prevT = t
      if (!listening) {
        simTime += dt * speedSmooth
      }
      const simT = simTime

      const rollZ = 0.07 * Math.sin(simT * 0.19) + 0.04 * Math.sin(simT * 0.55 + 0.2)
      const MAX = (14 * Math.PI) / 180
      const mobileCoarse = coarsePointer()
      if (gyroRaw.ok && mobileCoarse) {
        gyroMix = Math.min(1, gyroMix + 0.018)
      } else {
        gyroMix = Math.max(0, gyroMix - 0.024)
      }
      gyroSm.x += (gyroRaw.gx - gyroSm.x) * 0.072
      gyroSm.y += (gyroRaw.gy - gyroSm.y) * 0.072
      const gStrength = MAX * 0.72 * gyroMix
      rotTarget.x = gyroSm.y * gStrength
      rotTarget.y = gyroSm.x * gStrength
      rotCur.x += (rotTarget.x - rotCur.x) * 0.028
      rotCur.y += (rotTarget.y - rotCur.y) * 0.028
      tiltEuler.set(rotCur.x, rotCur.y, rollZ)
      tiltM4.makeRotationFromEuler(tiltEuler)
      pts.rotation.setFromRotationMatrix(tiltM4, 'YXZ')
      pts.updateMatrixWorld()

      const hasCrater = false
      const craterTarget = 0
      craterBlend += (craterTarget - craterBlend) * 0.022
      const craterPulse = 0.94 + 0.06 * Math.sin(t * 0.95 + craterBlend * 0.8)
      const craterStrength = craterBlend * craterBlend * craterPulse

      const ph = simT * 0.92
      const sinP = Math.sin(ph)
      const inward = Math.max(0, sinP)
      const out = Math.max(0, -sinP)
      const heart = 0.5 + 0.5 * Math.sin(simT * 0.55)
      const lumaBreathe = 0.9 + 0.22 * out - 0.1 * Math.pow(inward, 0.6)
      const lumaSlow = 0.86 + 0.28 * heart
      const lumaGlint = 1 + 0.12 * Math.sin(simT * 2.05) * (0.5 + 0.5 * Math.sin(simT * 0.4))
      const lumaIntens = 1 + 0.4 * Math.min(1, Math.pow(intens, 0.85))
      const lumaFocus = 1 + 0.04 * cEase
      const gain = BRIGHTNESS_MASTER * lumaBreathe * lumaSlow * lumaGlint * lumaIntens * lumaFocus

      mat.uniforms.uTime.value = t
      mat.uniforms.uTa.value = simT * 0.12
      mat.uniforms.uTb.value = simT * 0.085
      mat.uniforms.uPh.value = ph
      mat.uniforms.uFocus.value = cEase
      mat.uniforms.uIntensity.value = THREE.MathUtils.clamp(intens, 0, 1)
      mat.uniforms.uGain.value = gain
      mat.uniforms.uCraterStrength.value = craterStrength
      if (craterStrength > 0.001 && hasCrater) {
        mat.uniforms.uCraterDir.value.copy(craterDirLocal)
      } else {
        mat.uniforms.uCraterDir.value.set(0, 0, 0)
      }

      camera.updateMatrixWorld()
      mat.uniforms.projectionMatrix.value.copy(camera.projectionMatrix)
      mat.uniforms.modelViewMatrix.value.multiplyMatrices(camera.matrixWorldInverse, pts.matrixWorld)

      renderer.render(scene, camera)
    }

    const start = () => {
      if (cancelled) return
      const { w, h } = readSize()
      if (w < 2 || h < 2) {
        warmupId = requestAnimationFrame(start)
        return
      }
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      applySize()
      animate()
    }
    warmupId = requestAnimationFrame(start)

    return () => {
      cancelled = true
      cancelAnimationFrame(warmupId)
      cancelAnimationFrame(frameId)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('deviceorientation', onDeviceOrient)
      tex.dispose()
      geo.dispose()
      mat.dispose()
      renderer.dispose()
      if (mount.contains(canvas)) mount.removeChild(canvas)
    }
  }, [])

  return <div ref={mountRef} className="absolute inset-0 w-full h-full min-h-0" />
}
