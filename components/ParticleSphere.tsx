'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createNoise3D } from 'simplex-noise'

interface Props {
  focused: boolean
  intensity: number
}

function makeSoftDot(): THREE.Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size / 2
  const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.995)
  g.addColorStop(0,    'rgba(255,255,255,1)')
  g.addColorStop(0.14, 'rgba(255,255,255,0.88)')
  g.addColorStop(0.32, 'rgba(255,255,255,0.28)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.06)')
  g.addColorStop(1,    'rgba(255,255,255,0)')
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

export default function ParticleSphere({ focused, intensity }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ focused, intensity })
  const focusBlendRef = useRef(0)

  useEffect(() => { stateRef.current = { focused, intensity } }, [focused, intensity])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 100)
    camera.position.z = 5.1

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    const applySize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (w < 1 || h < 1) return
      renderer.setPixelRatio(pixelRatioForWidth(w))
      renderer.setSize(w, h)
    }
    applySize()
    mount.appendChild(renderer.domElement)

    const nA = createNoise3D()
    const nB = createNoise3D()
    const nC = createNoise3D()

    const COUNT  = 28_000
    const RADIUS = 1.75

    const BRIGHTNESS_MASTER = 1.45

    const ux   = new Float32Array(COUNT)
    const uy   = new Float32Array(COUNT)
    const uz   = new Float32Array(COUNT)
    const r0   = new Float32Array(COUNT)
    const kind = new Uint8Array(COUNT)
    const sz   = new Float32Array(COUNT)

    const positions = new Float32Array(COUNT * 3)
    const colors    = new Float32Array(COUNT * 3)

    for (let i = 0; i < COUNT; i++) {
      const phi   = Math.acos(1 - (2 * (i + 0.5)) / COUNT)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i
      const px = Math.sin(phi) * Math.cos(theta)
      const py = Math.sin(phi) * Math.sin(theta)
      const pz = Math.cos(phi)
      ux[i] = px; uy[i] = py; uz[i] = pz

      const roll = Math.random()

      if (roll < 0.62) {
        const t = Math.pow(Math.random(), 1.8)
        r0[i] = RADIUS * (0.94 + 0.12 * t)
        kind[i] = 0
        sz[i] = 0.9 + 0.6 * Math.random()
      } else if (roll < 0.80) {
        r0[i] = RADIUS * (1.02 + 0.20 * Math.pow(Math.random(), 0.8))
        kind[i] = 2
        sz[i] = 0.25 + 0.35 * Math.random()
      } else {
        r0[i] = RADIUS * 0.15 + RADIUS * 0.78 * Math.pow(Math.random(), 0.6)
        kind[i] = 1
        sz[i] = 0.2 + 0.3 * Math.random()
      }

      const x = ux[i] * r0[i]
      const y = uy[i] * r0[i]
      const z = uz[i] * r0[i]
      positions[i * 3]     = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3))

    const tex = makeSoftDot()
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    const mat = new THREE.PointsMaterial({
      map: tex,
      size: 0.055,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })

    const pts = new THREE.Points(geo, mat)
    scene.add(pts)

    const colVoid   = new THREE.Color(0x0a0000)
    const colOrange = new THREE.Color(0xff4d2e)
    const colPink   = new THREE.Color(0xff1a8a)
    const colWhite  = new THREE.Color(1, 1, 1)
    const colTmp    = new THREE.Color()

    function palette(t: number): THREE.Color {
      const x = Math.max(0, Math.min(1, t))
      if (x < 0.25) {
        colTmp.copy(colVoid).lerp(colOrange, x / 0.25)
      } else if (x < 0.65) {
        colTmp.copy(colOrange).lerp(colPink, (x - 0.25) / 0.40)
      } else {
        colTmp.copy(colPink).lerp(colWhite, (x - 0.65) / 0.35)
      }
      return colTmp
    }

    const PAL = 1024
    const palR = new Float32Array(PAL)
    const palG = new Float32Array(PAL)
    const palB = new Float32Array(PAL)
    for (let i = 0; i < PAL; i++) {
      const u = i / (PAL - 1)
      palette(u)
      palR[i] = colTmp.r
      palG[i] = colTmp.g
      palB[i] = colTmp.b
    }
    const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
    const samplePal = (u: number) => {
      const x = clamp01(u)
      const jf = x * (PAL - 1)
      const j0 = Math.min(PAL - 1, jf | 0)
      const j1 = Math.min(PAL - 1, j0 + 1)
      const fr = jf - j0
      return {
        r: palR[j0] * (1 - fr) + palR[j1] * fr,
        g: palG[j0] * (1 - fr) + palG[j1] * fr,
        b: palB[j0] * (1 - fr) + palB[j1] * fr,
      }
    }

    const dynColor = (base: number, px: number, py: number, pz: number, phase: number) =>
      clamp01(base + t * 0.01 + 0.22 * Math.sin(t * 0.14 + px * 1.8 + py * 1.2 + pz * 1.5 + phase))

    const mouse = { nx: 0, ny: 0, px: 0, py: 0, over: false }
    const rotTarget = { x: 0, y: 0 }
    const rotCur    = { x: 0, y: 0 }

    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const sphereWorld = new THREE.Sphere(new THREE.Vector3(0, 0, 0), RADIUS * 1.08)
    const hitPoint = new THREE.Vector3()
    const craterDirLocal = new THREE.Vector3()
    const qInv = new THREE.Quaternion()
    let craterBlend = 0

    const onMove = (e: MouseEvent) => {
      mouse.px = e.clientX
      mouse.py = e.clientY
      const rect = renderer.domElement.getBoundingClientRect()
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
    renderer.domElement.addEventListener('mouseleave', onLeave)

    const onResize = () => {
      if (!mount) return
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (w < 1 || h < 1) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(pixelRatioForWidth(w))
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    let tabVisible = !document.hidden
    const onVis = () => {
      tabVisible = !document.hidden
    }
    document.addEventListener('visibilitychange', onVis)

    let frameId: number
    let t = 0

    const animate = () => {
      frameId = requestAnimationFrame(animate)
      if (!tabVisible) {
        return
      }
      const { focused: isFocused, intensity: intens } = stateRef.current

      const focusTarget = isFocused ? 1 : 0
      focusBlendRef.current += (focusTarget - focusBlendRef.current) * 0.065
      const f = focusBlendRef.current

      const speed = (1 - f) * (0.8 + intens * 1.2) + f * 0.25
      t += 0.005 * speed

      pts.scale.setScalar(1)

      const rollZ = 0.07 * Math.sin(t * 0.19) + 0.04 * Math.sin(t * 0.55 + 0.2)

      const MAX = 14 * Math.PI / 180
      rotTarget.x = mouse.ny * MAX
      rotTarget.y = mouse.nx * MAX
      rotCur.x += (rotTarget.x - rotCur.x) * 0.028
      rotCur.y += (rotTarget.y - rotCur.y) * 0.028
      pts.rotation.x = rotCur.x
      pts.rotation.y = rotCur.y
      pts.rotation.z = rollZ
      pts.updateMatrixWorld()

      const rect = renderer.domElement.getBoundingClientRect()
      let cx = 0
      let cy = 0
      let czl = 0
      let hasCrater = false
      if (rect.width > 0 && rect.height > 0 && mouse.over) {
        ndc.x = (mouse.px - rect.left) / rect.width * 2 - 1
        ndc.y = -((mouse.py - rect.top) / rect.height) * 2 + 1
        raycaster.setFromCamera(ndc, camera)
        const hit = raycaster.ray.intersectSphere(sphereWorld, hitPoint)
        if (hit !== null) {
          hasCrater = true
          craterDirLocal.copy(hitPoint).applyQuaternion(qInv.copy(pts.quaternion).invert()).normalize()
          cx = craterDirLocal.x
          cy = craterDirLocal.y
          czl = craterDirLocal.z
        }
      }

      const craterTarget = hasCrater ? 1 : 0
      craterBlend += (craterTarget - craterBlend) * 0.028
      const craterPulse = 0.94 + 0.06 * Math.sin(t * 0.95 + craterBlend * 0.8)
      const craterStrength = craterBlend * craterBlend * craterPulse

      const posAttr = geo.attributes.position as THREE.BufferAttribute
      const colAttr = geo.attributes.color    as THREE.BufferAttribute

      const ta = t * 0.12
      const tb = t * 0.085
      const ph = t * 0.92
      const sinP = Math.sin(ph)
      const inward = Math.max(0, sinP)
      const out    = Math.max(0, -sinP)
      const rLung = 1 - 0.1 * inward + 0.028 * out

      const heart = 0.5 + 0.5 * Math.sin(t * 0.55)
      const lumaBreathe = 0.9 + 0.22 * out - 0.1 * Math.pow(inward, 0.6)
      const lumaSlow = 0.86 + 0.28 * heart
      const lumaGlint = 1 + 0.12 * Math.sin(t * 2.05) * (0.5 + 0.5 * Math.sin(t * 0.4))
      const lumaIntens = 1 + 0.4 * Math.min(1, Math.pow(intens, 0.85))
      const lumaFocus = 1 + 0.05 * f
      const gain = BRIGHTNESS_MASTER * lumaBreathe * lumaSlow * lumaGlint * lumaIntens * lumaFocus
      mat.opacity = Math.min(
        0.95,
        0.6 + 0.22 * heart + 0.08 * out - 0.04 * Math.pow(inward, 0.5) + 0.1 * Math.min(1, intens) + 0.035 * f
      )

      for (let i = 0; i < COUNT; i++) {
        const px = ux[i], py = uy[i], pz = uz[i]
        const ri = r0[i]
        const k  = kind[i]

        if (k === 1) {
          const s0 = 0.42
          const fx = nA(px * s0 + ta, py * s0, pz * s0)
          const turb = Math.abs(fx) * 1.2
          let colorT = 0.02 + Math.min(1, turb * 0.2) * 0.08
          let brightness = 0.04 + 0.07 * turb
          const ctMulI = 1 - 0.16 * f
          const brMulI = 1 - 0.1 * f
          colorT *= ctMulI
          brightness *= brMulI
          if (intens > 0.05) {
            brightness = Math.min(1, brightness + intens * 0.08 * (1.1 - intens * 0.25))
          }
          const tw = 0.9 + 0.22 * Math.pow(0.5 + 0.5 * Math.sin(fx * 2.4 + t * 0.5 + py * 0.1), 0.45)
          brightness *= gain * tw
          const s_i = sz[i]
          const pc = samplePal(dynColor(colorT, px, py, pz, s_i * 1.7))
          colAttr.setXYZ(
            i,
            Math.min(1, pc.r * brightness * s_i),
            Math.min(1, pc.g * brightness * s_i),
            Math.min(1, pc.b * brightness * s_i),
          )
          let rCrater = 1
          if (hasCrater && craterStrength > 0.004) {
            const dotc = Math.max(-1, Math.min(1, px * cx + py * cy + pz * czl))
            const ang = Math.acos(dotc)
            const cap = 0.58
            if (ang < cap) {
              const u = 1 - ang / cap
              const bowl = u * u * (3 - 2 * u)
              rCrater = 1 - bowl * craterStrength * 0.13
            }
          }
          posAttr.setXYZ(i, px * ri * rCrater, py * ri * rCrater, pz * ri * rCrater)
          continue
        }

        const nSlow = nA(px * 0.2 + 1.0, py * 0.2, pz * 0.2 + tb * 0.2)
        const fold = 0.55 + 0.45 * nSlow
        const rBreath = rLung * (1 - 0.12 * inward * fold) * (1 + 0.05 * out * (0.3 + 0.7 * (1 - fold)))
        const rRipple = 1 + 0.014 * Math.sin(1.15 * t + 2.0 * px + 0.7 * pz) + 0.008 * Math.sin(2.0 * t - 1.2 * py)

        const c0 = Math.cos(t * 0.14)
        const s0 = Math.sin(t * 0.14)
        const c1 = Math.cos(t * 0.11)
        const s1 = Math.sin(t * 0.11)
        const a = c0 * px - s0 * py
        const b = s0 * px + c0 * py
        const c = pz
        const rx = a
        const ry = c1 * b - s1 * c
        const rz = s1 * b + c1 * c

        const s = 0.42
        const f1x = nA(rx * s + ta, ry * s, rz * s)
        const f1y = nB(rx * s + 18, ry * s + tb, rz * s)
        const f1z = nC(rx * s + 33, ry * s, rz * s + ta)
        const f2x = nA(rx * 0.88 + 3, ry * 0.88 + ta * 0.5, rz * 0.88)
        const f2y = nB(rx * 0.88, ry * 0.88, rz * 0.88 + 4)
        const g3x = nA(ry * 0.29 + t * 0.11, rz * 0.29, rx * 0.29)
        const g3y = nB(rz * 0.29, rx * 0.29 + 0.4, ry * 0.29 + t * 0.09)
        const g3z = nC(rx * 0.29, ry * 0.29, rz * 0.29 + t * 0.1)

        const dot1 = f1x * px + f1y * py + f1z * pz
        let tx = f1x - px * dot1
        let ty = f1y - py * dot1
        let tz = f1z - pz * dot1
        const d2 = f2x * px + f2y * py
        tx += (f2x - px * d2) * 0.32
        ty += (f2y - py * d2) * 0.32
        tz += -pz * d2 * 0.28
        const d3 = g3x * px + g3y * py + g3z * pz
        const sx3 = (g3x - px * d3) * 0.55
        const sy3 = (g3y - py * d3) * 0.55
        const sz3 = (g3z - pz * d3) * 0.55
        tx += sx3
        ty += sy3
        tz += sz3

        let fMag = 0.14
        if (k === 0) fMag = 0.12 + 0.04 * Math.abs(f1x)
        else if (k === 2) fMag = 0.22
        else fMag = 0.05

        const tLen = Math.hypot(tx, ty, tz) + 1e-6
        const capT = k === 0 ? 0.13 : (k === 2 ? 0.16 : 0.06)
        const tScale = fMag * Math.min(1, capT / tLen)
        const ox = tx * tScale
        const oy = ty * tScale
        const oz = tz * tScale

        const rBase = ri * rBreath * rRipple

        let rCrater = 1
        if (hasCrater && craterStrength > 0.004) {
          const dotc = Math.max(-1, Math.min(1, px * cx + py * cy + pz * czl))
          const ang = Math.acos(dotc)
          const cap = k === 0 ? 0.52 : 0.46
          if (ang < cap) {
            const u = 1 - ang / cap
            const bowl = u * u * (3 - 2 * u)
            const rim = Math.sin(u * Math.PI) * 0.1
            const dip = bowl * (1 + rim)
            const shellMul = k === 0 ? 1 : 0.62
            rCrater = 1 - dip * craterStrength * 0.19 * shellMul
          }
        }

        posAttr.setXYZ(
          i,
          px * rBase * rCrater + ox,
          py * rBase * rCrater + oy,
          pz * rBase * rCrater + oz,
        )

        const turb   = Math.hypot(tx, ty, tz)
        const ridgeN = 0.5 + 0.5 * Math.sin(f1x * 5.0 + f1y * 3.2 + t * 0.4)

        let colorT: number
        let brightness: number

        if (k === 0) {
          const streamIntensity = Math.min(1, turb * 1.1 + ridgeN * 0.4)
          colorT     = 0.18 + streamIntensity * 0.7
          brightness = 0.2 + 0.58 * Math.pow(streamIntensity, 0.75)
        } else if (k === 2) {
          colorT     = 0.12 + Math.min(1, turb * 0.5 + ridgeN * 0.25) * 0.45
          brightness = 0.08 + 0.22 * Math.pow(turb * 0.6 + 0.1, 0.85)
        } else {
          colorT     = 0.02 + Math.min(1, turb * 0.2) * 0.08
          brightness = 0.04 + 0.07 * turb
        }

        {
          const ctMul = 1 - 0.16 * f
          const brMul = 1 - 0.1 * f
          colorT *= ctMul
          brightness *= brMul
        }
        if (intens > 0.05) {
          brightness = Math.min(1, brightness + intens * 0.08 * (1.1 - intens * 0.25))
        }

        const tw = 0.9 + 0.22 * Math.pow(0.5 + 0.5 * Math.sin(f1x * 2.4 + t * 0.5 + f1y), 0.45)
        brightness = brightness * gain * tw

        const s_i = sz[i]
        const pc = samplePal(dynColor(colorT, px, py, pz, s_i * 2.2 + k * 0.4))
        colAttr.setXYZ(
          i,
          Math.min(1, pc.r * brightness * s_i),
          Math.min(1, pc.g * brightness * s_i),
          Math.min(1, pc.b * brightness * s_i),
        )
      }

      posAttr.needsUpdate = true
      colAttr.needsUpdate = true
      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(frameId)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('mousemove', onMove)
      renderer.domElement.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('resize', onResize)
      tex.dispose()
      geo.dispose()
      mat.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} className="w-full h-full" />
}
