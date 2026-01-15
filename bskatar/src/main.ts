import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { BskyAgent } from '@atproto/api'
import './style.css'

// Bluesky agent for auth and storage
const agent = new BskyAgent({ service: 'https://bsky.social' })

// Session state
let isLoggedIn = false
let userHandle = ''

// Avatar state - this is what we store in Bluesky
interface AvatarConfig {
  headShape: 'round' | 'oval' | 'square'
  headColor: string
  hairStyle: 'none' | 'short' | 'spiky' | 'bob' | 'ponytail'
  hairColor: string
  eyeStyle: 'dots' | 'wide' | 'sleepy' | 'sparkle'
  eyeColor: string
  eyebrowStyle: 'none' | 'normal' | 'angry' | 'worried' | 'thick'
  noseStyle: 'none' | 'small' | 'round' | 'pointed'
  mouthStyle: 'smile' | 'neutral' | 'open' | 'cat' | 'surprised'
  hasBlush: boolean
}

let currentConfig: AvatarConfig = {
  headShape: 'round',
  headColor: '#ffccaa',
  hairStyle: 'short',
  hairColor: '#4a3728',
  eyeStyle: 'dots',
  eyeColor: '#333333',
  eyebrowStyle: 'normal',
  noseStyle: 'small',
  mouthStyle: 'smile',
  hasBlush: true
}

// Scene setup
const scene = new THREE.Scene()
scene.background = new THREE.Color('#e8f4f8')

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 0, 5)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

// Orbit controls for rotating the view
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.enablePan = false
controls.minDistance = 3
controls.maxDistance = 8

// Lighting - soft and friendly
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
scene.add(ambientLight)

const mainLight = new THREE.DirectionalLight(0xffffff, 0.8)
mainLight.position.set(2, 4, 3)
scene.add(mainLight)

const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
fillLight.position.set(-2, -1, 2)
scene.add(fillLight)

// Avatar group - contains all parts
const avatarGroup = new THREE.Group()
scene.add(avatarGroup)

// Create material helper - using Lambert for low-poly look
function createMaterial(color: string | number, options?: { transparent?: boolean; opacity?: number }): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color: new THREE.Color(color),
    flatShading: true,
    transparent: options?.transparent,
    opacity: options?.opacity
  })
}

// Create low-poly head shapes
function createHead(shape: AvatarConfig['headShape'], color: string): THREE.Mesh {
  let geometry: THREE.BufferGeometry

  switch (shape) {
    case 'round':
      geometry = new THREE.IcosahedronGeometry(1, 1)
      break
    case 'oval':
      geometry = new THREE.IcosahedronGeometry(1, 1)
      geometry.scale(0.85, 1.1, 0.9)
      break
    case 'square':
      geometry = new THREE.BoxGeometry(1.6, 1.8, 1.5, 2, 2, 2)
      const positions = geometry.attributes.position
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i)
        const y = positions.getY(i)
        const z = positions.getZ(i)
        const length = Math.sqrt(x*x + y*y + z*z)
        const factor = 0.15
        positions.setXYZ(
          i,
          x + (x/length - x) * factor,
          y + (y/length - y) * factor,
          z + (z/length - z) * factor
        )
      }
      break
    default:
      geometry = new THREE.IcosahedronGeometry(1, 1)
  }

  return new THREE.Mesh(geometry, createMaterial(color))
}

// Create hair
function createHair(style: AvatarConfig['hairStyle'], color: string): THREE.Group {
  const hairGroup = new THREE.Group()
  if (style === 'none') return hairGroup

  const hairMaterial = createMaterial(color)

  switch (style) {
    case 'short': {
      // Simple cap of hair on top
      const capGeom = new THREE.SphereGeometry(1.05, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.45)
      const cap = new THREE.Mesh(capGeom, hairMaterial)
      cap.position.y = 0.15
      hairGroup.add(cap)

      // Add some chunky bangs
      const bangGeom = new THREE.BoxGeometry(0.8, 0.15, 0.3, 2, 1, 1)
      const bangs = new THREE.Mesh(bangGeom, hairMaterial)
      bangs.position.set(0, 0.75, 0.7)
      bangs.rotation.x = 0.3
      hairGroup.add(bangs)
      break
    }

    case 'spiky': {
      // Multiple spikes pointing up
      const spikeGeom = new THREE.ConeGeometry(0.15, 0.5, 4)
      const spikePositions = [
        { x: 0, y: 1.1, z: 0, rotX: 0, rotZ: 0 },
        { x: 0.3, y: 1.0, z: 0.1, rotX: 0.2, rotZ: -0.3 },
        { x: -0.3, y: 1.0, z: 0.1, rotX: 0.2, rotZ: 0.3 },
        { x: 0.15, y: 1.05, z: -0.2, rotX: -0.2, rotZ: -0.15 },
        { x: -0.15, y: 1.05, z: -0.2, rotX: -0.2, rotZ: 0.15 },
        { x: 0, y: 0.95, z: 0.35, rotX: 0.5, rotZ: 0 },
        { x: 0.4, y: 0.85, z: 0.2, rotX: 0.3, rotZ: -0.5 },
        { x: -0.4, y: 0.85, z: 0.2, rotX: 0.3, rotZ: 0.5 },
      ]
      spikePositions.forEach(pos => {
        const spike = new THREE.Mesh(spikeGeom, hairMaterial)
        spike.position.set(pos.x, pos.y, pos.z)
        spike.rotation.x = pos.rotX
        spike.rotation.z = pos.rotZ
        hairGroup.add(spike)
      })
      break
    }

    case 'bob': {
      // Rounded bob haircut
      const bobGeom = new THREE.SphereGeometry(1.1, 8, 6)
      bobGeom.scale(1, 0.9, 0.95)
      const bob = new THREE.Mesh(bobGeom, hairMaterial)
      bob.position.y = 0.2

      // Clip the bottom half using a box
      const clipGeom = new THREE.BoxGeometry(3, 1.5, 3)
      const clipMesh = new THREE.Mesh(clipGeom)
      clipMesh.position.y = -1.1

      hairGroup.add(bob)

      // Side pieces
      const sideGeom = new THREE.CapsuleGeometry(0.25, 0.4, 4, 8)
      const leftSide = new THREE.Mesh(sideGeom, hairMaterial)
      leftSide.position.set(-0.85, -0.1, 0.2)
      leftSide.rotation.z = 0.15
      const rightSide = new THREE.Mesh(sideGeom, hairMaterial)
      rightSide.position.set(0.85, -0.1, 0.2)
      rightSide.rotation.z = -0.15
      hairGroup.add(leftSide, rightSide)

      // Bangs
      const bangGeom = new THREE.BoxGeometry(0.9, 0.2, 0.25, 2, 1, 1)
      const bangs = new THREE.Mesh(bangGeom, hairMaterial)
      bangs.position.set(0, 0.7, 0.75)
      bangs.rotation.x = 0.4
      hairGroup.add(bangs)
      break
    }

    case 'ponytail': {
      // Top bun/cap
      const capGeom = new THREE.SphereGeometry(1.05, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5)
      const cap = new THREE.Mesh(capGeom, hairMaterial)
      cap.position.y = 0.1
      hairGroup.add(cap)

      // Ponytail at back
      const tailGeom = new THREE.CapsuleGeometry(0.2, 0.7, 4, 8)
      const tail = new THREE.Mesh(tailGeom, hairMaterial)
      tail.position.set(0, 0.3, -0.9)
      tail.rotation.x = 0.6
      hairGroup.add(tail)

      // Hair tie
      const tieGeom = new THREE.TorusGeometry(0.15, 0.05, 6, 8)
      const tieMaterial = createMaterial('#ff6b6b')
      const tie = new THREE.Mesh(tieGeom, tieMaterial)
      tie.position.set(0, 0.6, -0.85)
      tie.rotation.x = Math.PI / 2 + 0.3
      hairGroup.add(tie)

      // Bangs
      const bangGeom = new THREE.BoxGeometry(0.7, 0.15, 0.25, 2, 1, 1)
      const bangs = new THREE.Mesh(bangGeom, hairMaterial)
      bangs.position.set(0, 0.75, 0.7)
      bangs.rotation.x = 0.3
      hairGroup.add(bangs)
      break
    }
  }

  return hairGroup
}

// Create eyebrows
function createEyebrows(style: AvatarConfig['eyebrowStyle'], color: string): THREE.Group {
  const browGroup = new THREE.Group()
  if (style === 'none') return browGroup

  const browMaterial = createMaterial(color)
  const eyeSpacing = 0.35
  const browY = 0.4
  const browZ = 0.82

  switch (style) {
    case 'normal': {
      const browGeom = new THREE.BoxGeometry(0.2, 0.04, 0.05, 1, 1, 1)
      const leftBrow = new THREE.Mesh(browGeom, browMaterial)
      leftBrow.position.set(-eyeSpacing, browY, browZ)
      const rightBrow = new THREE.Mesh(browGeom, browMaterial)
      rightBrow.position.set(eyeSpacing, browY, browZ)
      browGroup.add(leftBrow, rightBrow)
      break
    }

    case 'angry': {
      const browGeom = new THREE.BoxGeometry(0.22, 0.05, 0.05, 1, 1, 1)
      const leftBrow = new THREE.Mesh(browGeom, browMaterial)
      leftBrow.position.set(-eyeSpacing, browY, browZ)
      leftBrow.rotation.z = 0.4 // Angled down toward center
      const rightBrow = new THREE.Mesh(browGeom, browMaterial)
      rightBrow.position.set(eyeSpacing, browY, browZ)
      rightBrow.rotation.z = -0.4
      browGroup.add(leftBrow, rightBrow)
      break
    }

    case 'worried': {
      const browGeom = new THREE.BoxGeometry(0.22, 0.05, 0.05, 1, 1, 1)
      const leftBrow = new THREE.Mesh(browGeom, browMaterial)
      leftBrow.position.set(-eyeSpacing, browY, browZ)
      leftBrow.rotation.z = -0.35 // Angled up toward center
      const rightBrow = new THREE.Mesh(browGeom, browMaterial)
      rightBrow.position.set(eyeSpacing, browY, browZ)
      rightBrow.rotation.z = 0.35
      browGroup.add(leftBrow, rightBrow)
      break
    }

    case 'thick': {
      const browGeom = new THREE.BoxGeometry(0.25, 0.08, 0.06, 1, 1, 1)
      const leftBrow = new THREE.Mesh(browGeom, browMaterial)
      leftBrow.position.set(-eyeSpacing, browY, browZ)
      const rightBrow = new THREE.Mesh(browGeom, browMaterial)
      rightBrow.position.set(eyeSpacing, browY, browZ)
      browGroup.add(leftBrow, rightBrow)
      break
    }
  }

  return browGroup
}

// Create nose
function createNose(style: AvatarConfig['noseStyle'], headColor: string): THREE.Group {
  const noseGroup = new THREE.Group()
  if (style === 'none') return noseGroup

  // Nose is slightly darker than head
  const noseColor = new THREE.Color(headColor).multiplyScalar(0.9)
  const noseMaterial = createMaterial(noseColor)

  const noseY = -0.05
  const noseZ = 0.95

  switch (style) {
    case 'small': {
      const noseGeom = new THREE.SphereGeometry(0.06, 6, 4)
      const nose = new THREE.Mesh(noseGeom, noseMaterial)
      nose.position.set(0, noseY, noseZ)
      noseGroup.add(nose)
      break
    }

    case 'round': {
      const noseGeom = new THREE.SphereGeometry(0.1, 6, 4)
      noseGeom.scale(1, 0.8, 0.7)
      const nose = new THREE.Mesh(noseGeom, noseMaterial)
      nose.position.set(0, noseY, noseZ)
      noseGroup.add(nose)
      break
    }

    case 'pointed': {
      const noseGeom = new THREE.ConeGeometry(0.06, 0.15, 4)
      noseGeom.rotateX(-Math.PI / 2)
      const nose = new THREE.Mesh(noseGeom, noseMaterial)
      nose.position.set(0, noseY, noseZ + 0.05)
      noseGroup.add(nose)
      break
    }
  }

  return noseGroup
}

// Create eyes
function createEyes(style: AvatarConfig['eyeStyle'], color: string): THREE.Group {
  const eyeGroup = new THREE.Group()
  const eyeMaterial = createMaterial(color)
  const whiteMaterial = createMaterial(0xffffff)

  const eyeSpacing = 0.35
  const eyeY = 0.15
  const eyeZ = 0.85

  switch (style) {
    case 'dots': {
      const dotGeom = new THREE.SphereGeometry(0.08, 8, 6)
      const leftDot = new THREE.Mesh(dotGeom, eyeMaterial)
      leftDot.position.set(-eyeSpacing, eyeY, eyeZ)
      const rightDot = new THREE.Mesh(dotGeom, eyeMaterial)
      rightDot.position.set(eyeSpacing, eyeY, eyeZ)
      eyeGroup.add(leftDot, rightDot)
      break
    }

    case 'wide': {
      const wideWhiteGeom = new THREE.SphereGeometry(0.15, 8, 6)
      const widePupilGeom = new THREE.SphereGeometry(0.08, 8, 6)

      const leftWhite = new THREE.Mesh(wideWhiteGeom, whiteMaterial)
      leftWhite.position.set(-eyeSpacing, eyeY, eyeZ - 0.05)
      const leftPupil = new THREE.Mesh(widePupilGeom, eyeMaterial)
      leftPupil.position.set(-eyeSpacing, eyeY, eyeZ + 0.08)

      const rightWhite = new THREE.Mesh(wideWhiteGeom, whiteMaterial)
      rightWhite.position.set(eyeSpacing, eyeY, eyeZ - 0.05)
      const rightPupil = new THREE.Mesh(widePupilGeom, eyeMaterial)
      rightPupil.position.set(eyeSpacing, eyeY, eyeZ + 0.08)

      eyeGroup.add(leftWhite, leftPupil, rightWhite, rightPupil)
      break
    }

    case 'sleepy': {
      const sleepyGeom = new THREE.CapsuleGeometry(0.04, 0.12, 4, 8)
      sleepyGeom.rotateZ(Math.PI / 2)
      const leftSleepy = new THREE.Mesh(sleepyGeom, eyeMaterial)
      leftSleepy.position.set(-eyeSpacing, eyeY, eyeZ)
      leftSleepy.scale.y = 0.5
      const rightSleepy = new THREE.Mesh(sleepyGeom, eyeMaterial)
      rightSleepy.position.set(eyeSpacing, eyeY, eyeZ)
      rightSleepy.scale.y = 0.5
      eyeGroup.add(leftSleepy, rightSleepy)
      break
    }

    case 'sparkle': {
      // Big shiny anime eyes
      const whiteGeom = new THREE.SphereGeometry(0.16, 8, 6)
      const pupilGeom = new THREE.SphereGeometry(0.1, 8, 6)
      const shineGeom = new THREE.SphereGeometry(0.04, 6, 4)
      const shineMaterial = createMaterial(0xffffff)

      // Left eye
      const leftWhite = new THREE.Mesh(whiteGeom, whiteMaterial)
      leftWhite.position.set(-eyeSpacing, eyeY, eyeZ - 0.05)
      const leftPupil = new THREE.Mesh(pupilGeom, eyeMaterial)
      leftPupil.position.set(-eyeSpacing, eyeY, eyeZ + 0.06)
      const leftShine = new THREE.Mesh(shineGeom, shineMaterial)
      leftShine.position.set(-eyeSpacing + 0.05, eyeY + 0.05, eyeZ + 0.12)

      // Right eye
      const rightWhite = new THREE.Mesh(whiteGeom, whiteMaterial)
      rightWhite.position.set(eyeSpacing, eyeY, eyeZ - 0.05)
      const rightPupil = new THREE.Mesh(pupilGeom, eyeMaterial)
      rightPupil.position.set(eyeSpacing, eyeY, eyeZ + 0.06)
      const rightShine = new THREE.Mesh(shineGeom, shineMaterial)
      rightShine.position.set(eyeSpacing + 0.05, eyeY + 0.05, eyeZ + 0.12)

      eyeGroup.add(leftWhite, leftPupil, leftShine, rightWhite, rightPupil, rightShine)
      break
    }
  }

  return eyeGroup
}

// Create mouth
function createMouth(style: AvatarConfig['mouthStyle']): THREE.Group {
  const mouthGroup = new THREE.Group()
  const mouthMaterial = createMaterial(0x333333)
  const tongueMaterial = createMaterial(0xff6b6b)

  const mouthY = -0.25
  const mouthZ = 0.9

  switch (style) {
    case 'smile': {
      const smileGeom = new THREE.TorusGeometry(0.15, 0.025, 8, 12, Math.PI)
      smileGeom.rotateX(Math.PI)
      smileGeom.rotateZ(Math.PI)
      const smile = new THREE.Mesh(smileGeom, mouthMaterial)
      smile.position.set(0, mouthY, mouthZ)
      mouthGroup.add(smile)
      break
    }

    case 'neutral': {
      const lineGeom = new THREE.CapsuleGeometry(0.02, 0.2, 4, 8)
      lineGeom.rotateZ(Math.PI / 2)
      const line = new THREE.Mesh(lineGeom, mouthMaterial)
      line.position.set(0, mouthY, mouthZ)
      mouthGroup.add(line)
      break
    }

    case 'open': {
      const openGeom = new THREE.SphereGeometry(0.12, 8, 6)
      openGeom.scale(1.3, 0.8, 0.5)
      const openMouth = new THREE.Mesh(openGeom, mouthMaterial)
      openMouth.position.set(0, mouthY, mouthZ)

      const tongueGeom = new THREE.SphereGeometry(0.06, 6, 4)
      tongueGeom.scale(1, 0.6, 0.5)
      const tongue = new THREE.Mesh(tongueGeom, tongueMaterial)
      tongue.position.set(0, mouthY - 0.05, mouthZ + 0.02)

      mouthGroup.add(openMouth, tongue)
      break
    }

    case 'cat': {
      // Cat-like :3 mouth
      const leftGeom = new THREE.TorusGeometry(0.08, 0.02, 6, 8, Math.PI)
      leftGeom.rotateX(Math.PI)
      leftGeom.rotateZ(Math.PI * 0.75)
      const left = new THREE.Mesh(leftGeom, mouthMaterial)
      left.position.set(-0.06, mouthY - 0.02, mouthZ)

      const rightGeom = new THREE.TorusGeometry(0.08, 0.02, 6, 8, Math.PI)
      rightGeom.rotateX(Math.PI)
      rightGeom.rotateZ(Math.PI * 0.25)
      const right = new THREE.Mesh(rightGeom, mouthMaterial)
      right.position.set(0.06, mouthY - 0.02, mouthZ)

      mouthGroup.add(left, right)
      break
    }

    case 'surprised': {
      // O shaped surprised mouth
      const oGeom = new THREE.TorusGeometry(0.1, 0.03, 8, 12)
      const o = new THREE.Mesh(oGeom, mouthMaterial)
      o.position.set(0, mouthY, mouthZ)
      mouthGroup.add(o)
      break
    }
  }

  return mouthGroup
}

// Create blush marks
function createBlush(): THREE.Group {
  const blushGroup = new THREE.Group()
  const blushMaterial = createMaterial(0xffaaaa, { transparent: true, opacity: 0.6 })

  const blushGeom = new THREE.CircleGeometry(0.1, 6)

  const leftBlush = new THREE.Mesh(blushGeom, blushMaterial)
  leftBlush.position.set(-0.55, -0.05, 0.75)
  leftBlush.rotation.y = -0.4

  const rightBlush = new THREE.Mesh(blushGeom, blushMaterial)
  rightBlush.position.set(0.55, -0.05, 0.75)
  rightBlush.rotation.y = 0.4

  blushGroup.add(leftBlush, rightBlush)
  return blushGroup
}

// Build the complete avatar
function buildAvatar(config: AvatarConfig) {
  // Clear existing
  while (avatarGroup.children.length > 0) {
    avatarGroup.remove(avatarGroup.children[0])
  }

  // Add parts in order (back to front)
  const head = createHead(config.headShape, config.headColor)
  avatarGroup.add(head)

  const hair = createHair(config.hairStyle, config.hairColor)
  avatarGroup.add(hair)

  const nose = createNose(config.noseStyle, config.headColor)
  avatarGroup.add(nose)

  const eyes = createEyes(config.eyeStyle, config.eyeColor)
  avatarGroup.add(eyes)

  const eyebrows = createEyebrows(config.eyebrowStyle, config.hairColor)
  avatarGroup.add(eyebrows)

  const mouth = createMouth(config.mouthStyle)
  avatarGroup.add(mouth)

  if (config.hasBlush) {
    const blush = createBlush()
    avatarGroup.add(blush)
  }
}

// Build initial avatar
buildAvatar(currentConfig)

// UI
function createUI() {
  const ui = document.createElement('div')
  ui.className = 'ui-panel'
  ui.innerHTML = `
    <h2>bskatar</h2>
    <p class="subtitle">your bluesky avatar</p>

    <div class="auth-section">
      <div class="login-form">
        <input type="text" id="handle-input" placeholder="Handle (e.g. user.bsky.social)">
        <input type="password" id="password-input" placeholder="App Password">
        <button id="login-btn">Connect Bluesky</button>
        <p class="login-hint">Use an <a href="https://bsky.app/settings/app-passwords" target="_blank">App Password</a></p>
      </div>
    </div>

    <div class="control-group">
      <label>Head Shape</label>
      <div class="button-group">
        <button data-head="round" class="active">Round</button>
        <button data-head="oval">Oval</button>
        <button data-head="square">Square</button>
      </div>
    </div>

    <div class="control-group">
      <label>Skin Color</label>
      <div class="color-options" data-type="head">
        <button class="color-btn active" data-color="#ffccaa" style="background: #ffccaa"></button>
        <button class="color-btn" data-color="#ffe4c4" style="background: #ffe4c4"></button>
        <button class="color-btn" data-color="#f5d0c5" style="background: #f5d0c5"></button>
        <button class="color-btn" data-color="#deb887" style="background: #deb887"></button>
        <button class="color-btn" data-color="#d2a679" style="background: #d2a679"></button>
        <button class="color-btn" data-color="#a67c52" style="background: #a67c52"></button>
        <button class="color-btn" data-color="#8d5524" style="background: #8d5524"></button>
        <button class="color-btn" data-color="#a8e6cf" style="background: #a8e6cf"></button>
        <button class="color-btn" data-color="#ffd3b6" style="background: #ffd3b6"></button>
        <button class="color-btn" data-color="#c5b4e3" style="background: #c5b4e3"></button>
      </div>
    </div>

    <div class="control-group">
      <label>Hair Style</label>
      <div class="button-group">
        <button data-hair="none">None</button>
        <button data-hair="short" class="active">Short</button>
        <button data-hair="spiky">Spiky</button>
        <button data-hair="bob">Bob</button>
        <button data-hair="ponytail">Pony</button>
      </div>
    </div>

    <div class="control-group">
      <label>Hair Color</label>
      <div class="color-options" data-type="hair">
        <button class="color-btn active" data-color="#4a3728" style="background: #4a3728"></button>
        <button class="color-btn" data-color="#2c1810" style="background: #2c1810"></button>
        <button class="color-btn" data-color="#8b7355" style="background: #8b7355"></button>
        <button class="color-btn" data-color="#d4a574" style="background: #d4a574"></button>
        <button class="color-btn" data-color="#ffd700" style="background: #ffd700"></button>
        <button class="color-btn" data-color="#ff6b6b" style="background: #ff6b6b"></button>
        <button class="color-btn" data-color="#4ecdc4" style="background: #4ecdc4"></button>
        <button class="color-btn" data-color="#9b59b6" style="background: #9b59b6"></button>
        <button class="color-btn" data-color="#3498db" style="background: #3498db"></button>
        <button class="color-btn" data-color="#1a1a2e" style="background: #1a1a2e"></button>
      </div>
    </div>

    <div class="control-group">
      <label>Eyebrows</label>
      <div class="button-group">
        <button data-brow="none">None</button>
        <button data-brow="normal" class="active">Normal</button>
        <button data-brow="angry">Angry</button>
        <button data-brow="worried">Worried</button>
        <button data-brow="thick">Thick</button>
      </div>
    </div>

    <div class="control-group">
      <label>Eyes</label>
      <div class="button-group">
        <button data-eyes="dots" class="active">Dots</button>
        <button data-eyes="wide">Wide</button>
        <button data-eyes="sleepy">Sleepy</button>
        <button data-eyes="sparkle">Sparkle</button>
      </div>
    </div>

    <div class="control-group">
      <label>Eye Color</label>
      <div class="color-options" data-type="eyes">
        <button class="color-btn active" data-color="#333333" style="background: #333333"></button>
        <button class="color-btn" data-color="#4a4a4a" style="background: #4a4a4a"></button>
        <button class="color-btn" data-color="#2d5a27" style="background: #2d5a27"></button>
        <button class="color-btn" data-color="#4a90d9" style="background: #4a90d9"></button>
        <button class="color-btn" data-color="#8b4513" style="background: #8b4513"></button>
        <button class="color-btn" data-color="#9b59b6" style="background: #9b59b6"></button>
      </div>
    </div>

    <div class="control-group">
      <label>Nose</label>
      <div class="button-group">
        <button data-nose="none">None</button>
        <button data-nose="small" class="active">Small</button>
        <button data-nose="round">Round</button>
        <button data-nose="pointed">Pointed</button>
      </div>
    </div>

    <div class="control-group">
      <label>Mouth</label>
      <div class="button-group">
        <button data-mouth="smile" class="active">Smile</button>
        <button data-mouth="neutral">Neutral</button>
        <button data-mouth="open">Open</button>
        <button data-mouth="cat">Cat</button>
        <button data-mouth="surprised">O</button>
      </div>
    </div>

    <div class="control-group">
      <label>
        <input type="checkbox" id="blush-toggle" checked>
        Blush
      </label>
    </div>

    <div class="config-output">
      <label>Avatar Data (JSON)</label>
      <pre id="config-json"></pre>
    </div>
  `
  document.body.appendChild(ui)

  // Generic handler factory
  const setupButtonGroup = (selector: string, configKey: keyof AvatarConfig) => {
    ui.querySelectorAll(selector).forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement
        ui.querySelectorAll(selector).forEach(b => b.classList.remove('active'))
        target.classList.add('active')
        const value = target.dataset[selector.replace('[data-', '').replace(']', '')]
        ;(currentConfig as any)[configKey] = value
        buildAvatar(currentConfig)
        updateConfigDisplay()
      })
    })
  }

  // Head shape
  ui.querySelectorAll('[data-head]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      ui.querySelectorAll('[data-head]').forEach(b => b.classList.remove('active'))
      target.classList.add('active')
      currentConfig.headShape = target.dataset.head as AvatarConfig['headShape']
      buildAvatar(currentConfig)
      updateConfigDisplay()
    })
  })

  // Hair style
  ui.querySelectorAll('[data-hair]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      ui.querySelectorAll('[data-hair]').forEach(b => b.classList.remove('active'))
      target.classList.add('active')
      currentConfig.hairStyle = target.dataset.hair as AvatarConfig['hairStyle']
      buildAvatar(currentConfig)
      updateConfigDisplay()
    })
  })

  // Eyebrows
  ui.querySelectorAll('[data-brow]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      ui.querySelectorAll('[data-brow]').forEach(b => b.classList.remove('active'))
      target.classList.add('active')
      currentConfig.eyebrowStyle = target.dataset.brow as AvatarConfig['eyebrowStyle']
      buildAvatar(currentConfig)
      updateConfigDisplay()
    })
  })

  // Eyes
  ui.querySelectorAll('[data-eyes]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      ui.querySelectorAll('[data-eyes]').forEach(b => b.classList.remove('active'))
      target.classList.add('active')
      currentConfig.eyeStyle = target.dataset.eyes as AvatarConfig['eyeStyle']
      buildAvatar(currentConfig)
      updateConfigDisplay()
    })
  })

  // Nose
  ui.querySelectorAll('[data-nose]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      ui.querySelectorAll('[data-nose]').forEach(b => b.classList.remove('active'))
      target.classList.add('active')
      currentConfig.noseStyle = target.dataset.nose as AvatarConfig['noseStyle']
      buildAvatar(currentConfig)
      updateConfigDisplay()
    })
  })

  // Mouth
  ui.querySelectorAll('[data-mouth]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      ui.querySelectorAll('[data-mouth]').forEach(b => b.classList.remove('active'))
      target.classList.add('active')
      currentConfig.mouthStyle = target.dataset.mouth as AvatarConfig['mouthStyle']
      buildAvatar(currentConfig)
      updateConfigDisplay()
    })
  })

  // Head color
  ui.querySelectorAll('[data-type="head"] .color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      ui.querySelectorAll('[data-type="head"] .color-btn').forEach(b => b.classList.remove('active'))
      target.classList.add('active')
      currentConfig.headColor = target.dataset.color!
      buildAvatar(currentConfig)
      updateConfigDisplay()
    })
  })

  // Hair color
  ui.querySelectorAll('[data-type="hair"] .color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      ui.querySelectorAll('[data-type="hair"] .color-btn').forEach(b => b.classList.remove('active'))
      target.classList.add('active')
      currentConfig.hairColor = target.dataset.color!
      buildAvatar(currentConfig)
      updateConfigDisplay()
    })
  })

  // Eye color
  ui.querySelectorAll('[data-type="eyes"] .color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      ui.querySelectorAll('[data-type="eyes"] .color-btn').forEach(b => b.classList.remove('active'))
      target.classList.add('active')
      currentConfig.eyeColor = target.dataset.color!
      buildAvatar(currentConfig)
      updateConfigDisplay()
    })
  })

  // Blush toggle
  document.getElementById('blush-toggle')!.addEventListener('change', (e) => {
    currentConfig.hasBlush = (e.target as HTMLInputElement).checked
    buildAvatar(currentConfig)
    updateConfigDisplay()
  })

  // Login button
  document.getElementById('login-btn')?.addEventListener('click', async () => {
    const handleInput = document.getElementById('handle-input') as HTMLInputElement
    const passwordInput = document.getElementById('password-input') as HTMLInputElement
    const btn = document.getElementById('login-btn') as HTMLButtonElement

    const handle = handleInput.value.trim()
    const password = passwordInput.value

    if (!handle || !password) {
      showNotification('Please enter handle and password')
      return
    }

    btn.disabled = true
    btn.textContent = 'Connecting...'

    const result = await login(handle, password)

    btn.disabled = false
    btn.textContent = 'Connect Bluesky'

    if (!result.success) {
      showNotification('Error: ' + result.error)
    }
  })

  updateConfigDisplay()
}

function updateConfigDisplay() {
  const pre = document.getElementById('config-json')
  if (pre) {
    pre.textContent = JSON.stringify(currentConfig, null, 2)
  }
}

// Bluesky Auth Functions
async function login(handle: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    await agent.login({ identifier: handle, password })
    isLoggedIn = true
    userHandle = handle
    updateAuthUI()
    // Try to load existing avatar
    await loadAvatarFromBluesky()
    return { success: true }
  } catch (err: any) {
    console.error('Login error:', err)
    return { success: false, error: err.message || 'Login failed' }
  }
}

function logout() {
  isLoggedIn = false
  userHandle = ''
  updateAuthUI()
}

// Avatar Storage Functions
const AVATAR_COLLECTION = 'xyz.bskatar.avatar'
const AVATAR_RKEY = 'self'

async function saveAvatarToBluesky(): Promise<{ success: boolean; error?: string }> {
  if (!isLoggedIn) {
    return { success: false, error: 'Not logged in' }
  }

  try {
    // Check if record exists, then update or create
    const repo = agent.session?.did
    if (!repo) throw new Error('No session')

    try {
      // Try to update existing record
      await agent.com.atproto.repo.putRecord({
        repo,
        collection: AVATAR_COLLECTION,
        rkey: AVATAR_RKEY,
        record: {
          $type: AVATAR_COLLECTION,
          ...currentConfig,
          createdAt: new Date().toISOString()
        }
      })
    } catch {
      // Create new record if doesn't exist
      await agent.com.atproto.repo.createRecord({
        repo,
        collection: AVATAR_COLLECTION,
        rkey: AVATAR_RKEY,
        record: {
          $type: AVATAR_COLLECTION,
          ...currentConfig,
          createdAt: new Date().toISOString()
        }
      })
    }

    showNotification('Avatar saved to Bluesky!')
    return { success: true }
  } catch (err: any) {
    console.error('Save error:', err)
    return { success: false, error: err.message || 'Save failed' }
  }
}

async function loadAvatarFromBluesky(): Promise<{ success: boolean; error?: string }> {
  if (!isLoggedIn) {
    return { success: false, error: 'Not logged in' }
  }

  try {
    const repo = agent.session?.did
    if (!repo) throw new Error('No session')

    const response = await agent.com.atproto.repo.getRecord({
      repo,
      collection: AVATAR_COLLECTION,
      rkey: AVATAR_RKEY
    })

    const record = response.data.value as any

    // Apply loaded config
    currentConfig = {
      headShape: record.headShape || 'round',
      headColor: record.headColor || '#ffccaa',
      hairStyle: record.hairStyle || 'short',
      hairColor: record.hairColor || '#4a3728',
      eyeStyle: record.eyeStyle || 'dots',
      eyeColor: record.eyeColor || '#333333',
      eyebrowStyle: record.eyebrowStyle || 'normal',
      noseStyle: record.noseStyle || 'small',
      mouthStyle: record.mouthStyle || 'smile',
      hasBlush: record.hasBlush ?? true
    }

    buildAvatar(currentConfig)
    updateConfigDisplay()
    updateUIFromConfig()
    showNotification('Avatar loaded from Bluesky!')
    return { success: true }
  } catch (err: any) {
    // No existing avatar is fine
    if (err.message?.includes('not found') || err.status === 400) {
      console.log('No existing avatar found')
      return { success: false, error: 'No avatar saved yet' }
    }
    console.error('Load error:', err)
    return { success: false, error: err.message || 'Load failed' }
  }
}

function showNotification(message: string) {
  const existing = document.querySelector('.notification')
  if (existing) existing.remove()

  const notification = document.createElement('div')
  notification.className = 'notification'
  notification.textContent = message
  document.body.appendChild(notification)

  setTimeout(() => notification.classList.add('show'), 10)
  setTimeout(() => {
    notification.classList.remove('show')
    setTimeout(() => notification.remove(), 300)
  }, 2500)
}

function updateAuthUI() {
  const authSection = document.querySelector('.auth-section')
  if (!authSection) return

  if (isLoggedIn) {
    authSection.innerHTML = `
      <div class="logged-in">
        <span class="user-handle">@${userHandle}</span>
        <button id="logout-btn">Logout</button>
      </div>
      <div class="storage-buttons">
        <button id="save-btn" class="primary-btn">Save to Bluesky</button>
        <button id="load-btn">Load from Bluesky</button>
      </div>
    `
    document.getElementById('logout-btn')?.addEventListener('click', logout)
    document.getElementById('save-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('save-btn') as HTMLButtonElement
      btn.disabled = true
      btn.textContent = 'Saving...'
      const result = await saveAvatarToBluesky()
      btn.disabled = false
      btn.textContent = 'Save to Bluesky'
      if (!result.success) {
        showNotification('Error: ' + result.error)
      }
    })
    document.getElementById('load-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('load-btn') as HTMLButtonElement
      btn.disabled = true
      btn.textContent = 'Loading...'
      const result = await loadAvatarFromBluesky()
      btn.disabled = false
      btn.textContent = 'Load from Bluesky'
      if (!result.success && result.error !== 'No avatar saved yet') {
        showNotification('Error: ' + result.error)
      }
    })
  } else {
    authSection.innerHTML = `
      <div class="login-form">
        <input type="text" id="handle-input" placeholder="Handle (e.g. user.bsky.social)">
        <input type="password" id="password-input" placeholder="App Password">
        <button id="login-btn">Connect Bluesky</button>
        <p class="login-hint">Use an <a href="https://bsky.app/settings/app-passwords" target="_blank">App Password</a></p>
      </div>
    `
    document.getElementById('login-btn')?.addEventListener('click', async () => {
      const handleInput = document.getElementById('handle-input') as HTMLInputElement
      const passwordInput = document.getElementById('password-input') as HTMLInputElement
      const btn = document.getElementById('login-btn') as HTMLButtonElement

      const handle = handleInput.value.trim()
      const password = passwordInput.value

      if (!handle || !password) {
        showNotification('Please enter handle and password')
        return
      }

      btn.disabled = true
      btn.textContent = 'Connecting...'

      const result = await login(handle, password)

      btn.disabled = false
      btn.textContent = 'Connect Bluesky'

      if (!result.success) {
        showNotification('Error: ' + result.error)
      }
    })
  }
}

function updateUIFromConfig() {
  // Update button active states to match loaded config
  const ui = document.querySelector('.ui-panel')
  if (!ui) return

  // Head shape
  ui.querySelectorAll('[data-head]').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.head === currentConfig.headShape)
  })

  // Hair style
  ui.querySelectorAll('[data-hair]').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.hair === currentConfig.hairStyle)
  })

  // Eyebrows
  ui.querySelectorAll('[data-brow]').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.brow === currentConfig.eyebrowStyle)
  })

  // Eyes
  ui.querySelectorAll('[data-eyes]').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.eyes === currentConfig.eyeStyle)
  })

  // Nose
  ui.querySelectorAll('[data-nose]').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.nose === currentConfig.noseStyle)
  })

  // Mouth
  ui.querySelectorAll('[data-mouth]').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.mouth === currentConfig.mouthStyle)
  })

  // Colors
  ui.querySelectorAll('[data-type="head"] .color-btn').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.color === currentConfig.headColor)
  })
  ui.querySelectorAll('[data-type="hair"] .color-btn').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.color === currentConfig.hairColor)
  })
  ui.querySelectorAll('[data-type="eyes"] .color-btn').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.color === currentConfig.eyeColor)
  })

  // Blush
  const blushToggle = document.getElementById('blush-toggle') as HTMLInputElement
  if (blushToggle) blushToggle.checked = currentConfig.hasBlush
}

createUI()

// Animation loop
function animate() {
  requestAnimationFrame(animate)
  controls.update()

  // Gentle idle animation
  avatarGroup.rotation.y = Math.sin(Date.now() * 0.0005) * 0.1

  renderer.render(scene, camera)
}

animate()

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
