import * as THREE from 'three'
import { BskyAgent } from '@atproto/api'
import './style.css'

// Low-res render target dimensions (GBA-ish but wider for modern screens)
const RENDER_WIDTH = 480
const RENDER_HEIGHT = 270

// Bluesky agent
const agent = new BskyAgent({ service: 'https://bsky.social' })

// Session state
let isLoggedIn = false
let userHandle = ''

// Avatar config type (matches bskatar)
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

// Default avatar
let playerAvatar: AvatarConfig = {
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

// Post type
interface Post {
  uri: string
  author: { handle: string; displayName?: string; avatar?: string }
  text: string
  createdAt: string
  mesh?: THREE.Group
}

let posts: Post[] = []
let closestPost: Post | null = null
const INTERACT_DISTANCE = 6 // How close to glow/interact

// World state
type WorldTheme = 'cyber' | 'fantasy'
let currentWorld: WorldTheme = 'cyber'

// Scene setup - MMBN Cyber Net style
const scene = new THREE.Scene()
scene.background = new THREE.Color('#0a0a1a') // Dark cyber void
scene.fog = new THREE.Fog('#0a0a1a', 30, 100)

// Orthographic camera for 2.5D isometric view
let frustumSize = 20
let targetFrustumSize = 20
const MIN_ZOOM = 10  // Closest zoom
const MAX_ZOOM = 40  // Furthest zoom
const aspect = window.innerWidth / window.innerHeight
const camera = new THREE.OrthographicCamera(
  -frustumSize * aspect / 2,
  frustumSize * aspect / 2,
  frustumSize / 2,
  -frustumSize / 2,
  0.1,
  1000
)

// Fixed isometric angle (MMBN style)
const isoAngle = Math.PI / 4 // 45 degrees rotation
const isoTilt = Math.atan(1 / Math.sqrt(2)) // ~35 degrees down (true isometric)
camera.position.set(30, 30, 30)
camera.lookAt(0, 0, 0)
camera.rotation.order = 'YXZ'

const renderer = new THREE.WebGLRenderer({ antialias: false }) // No AA for pixel look
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(1) // Fixed pixel ratio for consistent pixelation
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.appendChild(renderer.domElement)

// Low-res render target for true pixel art look (no jitter)
const lowResTarget = new THREE.WebGLRenderTarget(RENDER_WIDTH, RENDER_HEIGHT, {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  format: THREE.RGBAFormat
})

// Fullscreen quad to display the low-res render scaled up
const quadGeom = new THREE.PlaneGeometry(2, 2)
const quadMat = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: lowResTarget.texture }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      gl_FragColor = texture2D(tDiffuse, vUv);
    }
  `,
  depthTest: false,
  depthWrite: false
})
const fullscreenQuad = new THREE.Mesh(quadGeom, quadMat)
const quadScene = new THREE.Scene()
quadScene.add(fullscreenQuad)
const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
scene.add(ambientLight)

const sunLight = new THREE.DirectionalLight(0xffffff, 0.8)
sunLight.position.set(50, 100, 50)
sunLight.castShadow = true
sunLight.shadow.mapSize.width = 2048
sunLight.shadow.mapSize.height = 2048
sunLight.shadow.camera.near = 0.5
sunLight.shadow.camera.far = 200
sunLight.shadow.camera.left = -50
sunLight.shadow.camera.right = 50
sunLight.shadow.camera.top = 50
sunLight.shadow.camera.bottom = -50
scene.add(sunLight)

// Ground - Cyber grid floor
const groundGeometry = new THREE.PlaneGeometry(80, 80, 40, 40)
const groundMaterial = new THREE.MeshBasicMaterial({
  color: '#00ffff',
  wireframe: true,
  transparent: true,
  opacity: 0.3
})
const ground = new THREE.Mesh(groundGeometry, groundMaterial)
ground.rotation.x = -Math.PI / 2
scene.add(ground)

// Solid dark floor underneath (well below grid to prevent z-fighting)
const floorGeom = new THREE.PlaneGeometry(80, 80)
const floorMat = new THREE.MeshBasicMaterial({ color: '#050510' })
const floor = new THREE.Mesh(floorGeom, floorMat)
floor.rotation.x = -Math.PI / 2
floor.position.y = -0.5
scene.add(floor)

// Center platform - glowing hexagon
const platformGeom = new THREE.CylinderGeometry(8, 8, 0.3, 6)
const platformMat = new THREE.MeshBasicMaterial({
  color: '#00ffff',
  transparent: true,
  opacity: 0.2
})
const platform = new THREE.Mesh(platformGeom, platformMat)
platform.position.y = 0.15
scene.add(platform)

// Platform edge glow
const platformEdgeGeom = new THREE.TorusGeometry(8, 0.1, 8, 6)
const platformEdgeMat = new THREE.MeshBasicMaterial({ color: '#00ffff' })
const platformEdge = new THREE.Mesh(platformEdgeGeom, platformEdgeMat)
platformEdge.rotation.x = -Math.PI / 2
platformEdge.position.y = 0.3
scene.add(platformEdge)

// Cyber towers/data pillars instead of trees
function createDataPillar(x: number, z: number, height: number = 8) {
  const pillar = new THREE.Group()

  // Main pillar - wireframe
  const pillarGeom = new THREE.BoxGeometry(1.5, height, 1.5, 1, 4, 1)
  const pillarMat = new THREE.MeshBasicMaterial({
    color: '#ff00ff',
    wireframe: true,
    transparent: true,
    opacity: 0.6
  })
  const pillarMesh = new THREE.Mesh(pillarGeom, pillarMat)
  pillarMesh.position.y = height / 2
  pillar.add(pillarMesh)

  // Glowing core
  const coreGeom = new THREE.BoxGeometry(0.5, height - 1, 0.5)
  const coreMat = new THREE.MeshBasicMaterial({
    color: '#ff00ff',
    transparent: true,
    opacity: 0.8
  })
  const core = new THREE.Mesh(coreGeom, coreMat)
  core.position.y = height / 2
  pillar.add(core)

  // Top ring
  const ringGeom = new THREE.TorusGeometry(1, 0.1, 8, 4)
  const ringMat = new THREE.MeshBasicMaterial({ color: '#00ff88' })
  const ring = new THREE.Mesh(ringGeom, ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = height
  pillar.add(ring)

  // Floating data cube on top
  const cubeGeom = new THREE.BoxGeometry(0.8, 0.8, 0.8)
  const cubeMat = new THREE.MeshBasicMaterial({
    color: '#00ff88',
    wireframe: true
  })
  const cube = new THREE.Mesh(cubeGeom, cubeMat)
  cube.position.y = height + 1.5
  cube.userData.floatOffset = Math.random() * Math.PI * 2
  pillar.add(cube)

  pillar.position.set(x, 0, z)
  return pillar
}

// Data pillars around the area
const pillarPositions = [
  { x: 20, z: 0, h: 10 }, { x: -20, z: 0, h: 8 },
  { x: 0, z: 20, h: 12 }, { x: 0, z: -20, h: 9 },
  { x: 15, z: 15, h: 7 }, { x: -15, z: 15, h: 11 },
  { x: 15, z: -15, h: 8 }, { x: -15, z: -15, h: 10 },
  { x: 25, z: 10, h: 6 }, { x: -25, z: -10, h: 9 },
]
const pillars: THREE.Group[] = []
pillarPositions.forEach(pos => {
  const pillar = createDataPillar(pos.x, pos.z, pos.h)
  pillars.push(pillar)
  scene.add(pillar)
})

// Floating ring accents
for (let i = 0; i < 5; i++) {
  const ringGeom = new THREE.TorusGeometry(30 + i * 5, 0.05, 8, 64)
  const ringMat = new THREE.MeshBasicMaterial({
    color: i % 2 === 0 ? '#00ffff' : '#ff00ff',
    transparent: true,
    opacity: 0.15
  })
  const ring = new THREE.Mesh(ringGeom, ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.1
  scene.add(ring)
}

// Refresh token in the center - MMBN mystery data style
const refreshToken = new THREE.Group()

// Outer spinning cube frame
const outerCubeGeom = new THREE.BoxGeometry(1.5, 1.5, 1.5)
const outerCubeMat = new THREE.MeshBasicMaterial({
  color: '#00ff88',
  wireframe: true
})
const outerCube = new THREE.Mesh(outerCubeGeom, outerCubeMat)
refreshToken.add(outerCube)

// Inner glowing core
const innerGeom = new THREE.OctahedronGeometry(0.5, 0)
const innerMat = new THREE.MeshBasicMaterial({
  color: '#00ff88',
  transparent: true,
  opacity: 0.8
})
const innerCore = new THREE.Mesh(innerGeom, innerMat)
refreshToken.add(innerCore)

// Floating ring around it
const tokenRingGeom = new THREE.TorusGeometry(1, 0.08, 8, 16)
const tokenRingMat = new THREE.MeshBasicMaterial({ color: '#00ffff' })
const tokenRing = new THREE.Mesh(tokenRingGeom, tokenRingMat)
tokenRing.rotation.x = Math.PI / 2
refreshToken.add(tokenRing)

// Second ring perpendicular
const tokenRing2 = new THREE.Mesh(tokenRingGeom, tokenRingMat)
tokenRing2.rotation.y = Math.PI / 2
refreshToken.add(tokenRing2)

refreshToken.position.set(0, 2, 0)
refreshToken.userData = { isRefreshToken: true }
scene.add(refreshToken)

// Teleport portal
const teleportPortal = new THREE.Group()

// Portal base - glowing ring on ground (green = leads to fantasy)
const portalBaseGeom = new THREE.TorusGeometry(2, 0.2, 8, 32)
const portalBaseMat = new THREE.MeshBasicMaterial({ color: '#00ff88' })
const portalBase = new THREE.Mesh(portalBaseGeom, portalBaseMat)
portalBase.rotation.x = -Math.PI / 2
portalBase.position.y = 0.1
teleportPortal.add(portalBase)

// Inner glow disc
const portalDiscGeom = new THREE.CircleGeometry(1.8, 32)
const portalDiscMat = new THREE.MeshBasicMaterial({
  color: '#00ff88',
  transparent: true,
  opacity: 0.4,
  side: THREE.DoubleSide
})
const portalDisc = new THREE.Mesh(portalDiscGeom, portalDiscMat)
portalDisc.rotation.x = -Math.PI / 2
portalDisc.position.y = 0.15
teleportPortal.add(portalDisc)

// Vertical energy beam
const beamGeom = new THREE.CylinderGeometry(0.3, 0.3, 8, 8, 1, true)
const beamMat = new THREE.MeshBasicMaterial({
  color: '#00ff88',
  transparent: true,
  opacity: 0.3,
  side: THREE.DoubleSide
})
const beam = new THREE.Mesh(beamGeom, beamMat)
beam.position.y = 4
teleportPortal.add(beam)

// Floating runes/particles
for (let i = 0; i < 4; i++) {
  const runeGeom = new THREE.OctahedronGeometry(0.3, 0)
  const runeMat = new THREE.MeshBasicMaterial({ color: '#00ff88' })
  const rune = new THREE.Mesh(runeGeom, runeMat)
  rune.position.y = 2 + i * 1.5
  rune.userData.orbitOffset = (i / 4) * Math.PI * 2
  teleportPortal.add(rune)
}

teleportPortal.position.set(-12, 0, -12)
teleportPortal.userData = { isTeleporter: true }
scene.add(teleportPortal)

// ============ FANTASY WORLD OBJECTS ============
const fantasyGroup = new THREE.Group()
fantasyGroup.visible = false
scene.add(fantasyGroup)

// Fantasy grass floor
const grassGeom = new THREE.PlaneGeometry(80, 80)
const grassMat = new THREE.MeshLambertMaterial({ color: '#4a8c4a' })
const grass = new THREE.Mesh(grassGeom, grassMat)
grass.rotation.x = -Math.PI / 2
grass.position.y = 0.01
grass.receiveShadow = true
fantasyGroup.add(grass)

// Fantasy center - stone circle
const stoneCircleGeom = new THREE.CylinderGeometry(8, 8.5, 0.5, 12)
const stoneCircleMat = new THREE.MeshLambertMaterial({ color: '#8b8b8b' })
const stoneCircle = new THREE.Mesh(stoneCircleGeom, stoneCircleMat)
stoneCircle.position.y = 0.25
stoneCircle.receiveShadow = true
fantasyGroup.add(stoneCircle)

// Fantasy trees
function createTree(x: number, z: number, height: number = 6): THREE.Group {
  const tree = new THREE.Group()

  // Trunk
  const trunkGeom = new THREE.CylinderGeometry(0.3, 0.5, height * 0.4, 8)
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#8b4513' })
  const trunk = new THREE.Mesh(trunkGeom, trunkMat)
  trunk.position.y = height * 0.2
  trunk.castShadow = true
  tree.add(trunk)

  // Foliage layers
  const foliageColors = ['#2d5a2d', '#3d6a3d', '#4d7a4d']
  for (let i = 0; i < 3; i++) {
    const foliageGeom = new THREE.ConeGeometry(2 - i * 0.4, height * 0.3, 8)
    const foliageMat = new THREE.MeshLambertMaterial({ color: foliageColors[i] })
    const foliage = new THREE.Mesh(foliageGeom, foliageMat)
    foliage.position.y = height * 0.4 + i * height * 0.2
    foliage.castShadow = true
    tree.add(foliage)
  }

  tree.position.set(x, 0, z)
  return tree
}

// Add trees to fantasy world
const treePositions = [
  { x: 20, z: 0, h: 8 }, { x: -20, z: 0, h: 6 },
  { x: 0, z: 20, h: 10 }, { x: 0, z: -20, h: 7 },
  { x: 15, z: 15, h: 5 }, { x: -15, z: 15, h: 9 },
  { x: 15, z: -15, h: 6 }, { x: -15, z: -15, h: 8 },
  { x: 25, z: 10, h: 4 }, { x: -25, z: -10, h: 7 },
]
treePositions.forEach(pos => {
  const tree = createTree(pos.x, pos.z, pos.h)
  fantasyGroup.add(tree)
})

// Fantasy flowers/mushrooms scattered
for (let i = 0; i < 30; i++) {
  const angle = Math.random() * Math.PI * 2
  const dist = 10 + Math.random() * 25
  const x = Math.cos(angle) * dist
  const z = Math.sin(angle) * dist

  // Randomly choose flower or mushroom
  if (Math.random() > 0.5) {
    // Flower
    const stemGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 4)
    const stemMat = new THREE.MeshLambertMaterial({ color: '#228b22' })
    const stem = new THREE.Mesh(stemGeom, stemMat)
    stem.position.set(x, 0.25, z)
    fantasyGroup.add(stem)

    const petalGeom = new THREE.SphereGeometry(0.2, 6, 4)
    const flowerColors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bff']
    const petalMat = new THREE.MeshLambertMaterial({ color: flowerColors[Math.floor(Math.random() * flowerColors.length)] })
    const petal = new THREE.Mesh(petalGeom, petalMat)
    petal.position.set(x, 0.55, z)
    fantasyGroup.add(petal)
  } else {
    // Mushroom
    const capGeom = new THREE.SphereGeometry(0.25, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2)
    const capColors = ['#ff6347', '#ffa500', '#dda0dd']
    const capMat = new THREE.MeshLambertMaterial({ color: capColors[Math.floor(Math.random() * capColors.length)] })
    const cap = new THREE.Mesh(capGeom, capMat)
    cap.position.set(x, 0.3, z)
    fantasyGroup.add(cap)

    const stipeGeom = new THREE.CylinderGeometry(0.08, 0.1, 0.3, 6)
    const stipeMat = new THREE.MeshLambertMaterial({ color: '#f5f5dc' })
    const stipe = new THREE.Mesh(stipeGeom, stipeMat)
    stipe.position.set(x, 0.15, z)
    fantasyGroup.add(stipe)
  }
}

// Fantasy portal (different style - stone archway)
const fantasyPortal = new THREE.Group()

// Stone arch base
const archBaseGeom = new THREE.TorusGeometry(2, 0.4, 8, 32)
const archBaseMat = new THREE.MeshLambertMaterial({ color: '#696969' })
const archBase = new THREE.Mesh(archBaseGeom, archBaseMat)
archBase.rotation.x = -Math.PI / 2
archBase.position.y = 0.2
fantasyPortal.add(archBase)

// Inner magical glow
const magicDiscGeom = new THREE.CircleGeometry(1.6, 32)
const magicDiscMat = new THREE.MeshBasicMaterial({
  color: '#00ffff',
  transparent: true,
  opacity: 0.5,
  side: THREE.DoubleSide
})
const magicDisc = new THREE.Mesh(magicDiscGeom, magicDiscMat)
magicDisc.rotation.x = -Math.PI / 2
magicDisc.position.y = 0.25
fantasyPortal.add(magicDisc)

// Sparkles
for (let i = 0; i < 6; i++) {
  const sparkleGeom = new THREE.OctahedronGeometry(0.15, 0)
  const sparkleMat = new THREE.MeshBasicMaterial({ color: '#00ffff' })
  const sparkle = new THREE.Mesh(sparkleGeom, sparkleMat)
  sparkle.position.y = 0.5 + Math.random() * 2
  sparkle.userData.sparkleOffset = Math.random() * Math.PI * 2
  fantasyPortal.add(sparkle)
}

fantasyPortal.position.set(-12, 0, -12)
fantasyPortal.visible = false
fantasyGroup.add(fantasyPortal)

// Cyber world group (for toggling)
const cyberGroup = new THREE.Group()
cyberGroup.add(ground)
cyberGroup.add(floor)
cyberGroup.add(platform)
cyberGroup.add(platformEdge)
pillars.forEach(p => cyberGroup.add(p))
// Add floating rings to cyber group
scene.children.forEach(child => {
  if (child instanceof THREE.Mesh && child.geometry instanceof THREE.TorusGeometry) {
    const radius = (child.geometry as THREE.TorusGeometry).parameters.radius
    if (radius >= 30) cyberGroup.add(child)
  }
})
cyberGroup.add(teleportPortal)
scene.add(cyberGroup)

// Function to switch worlds
function switchWorld(theme: WorldTheme) {
  if (currentWorld === theme) return

  currentWorld = theme

  if (theme === 'cyber') {
    // Switch to cyber world
    scene.background = new THREE.Color('#0a0a1a')
    scene.fog = new THREE.Fog('#0a0a1a', 30, 100)
    cyberGroup.visible = true
    fantasyGroup.visible = false
    teleportPortal.visible = true
    fantasyPortal.visible = false
  } else {
    // Switch to fantasy world
    scene.background = new THREE.Color('#87ceeb') // Sky blue
    scene.fog = new THREE.Fog('#a8d8a8', 40, 120)
    cyberGroup.visible = false
    fantasyGroup.visible = true
    teleportPortal.visible = false
    fantasyPortal.visible = true
  }

  // Move player to just outside the platform after teleport
  player.position.set(10, 0, 0)

  showNotification(`Teleported to ${theme === 'cyber' ? 'CYBER NET' : 'FANTASY GROVE'}!`)
}

// Player character group
const player = new THREE.Group()
player.position.set(10, 0, 0) // Start outside the platform
scene.add(player)

// Player shadow/ground marker (helps with jump landing)
const shadowGeom = new THREE.CircleGeometry(0.6, 16)
const shadowMat = new THREE.MeshBasicMaterial({
  color: '#ffffff',
  transparent: true,
  opacity: 0.4,
  side: THREE.DoubleSide
})
const playerShadow = new THREE.Mesh(shadowGeom, shadowMat)
playerShadow.rotation.x = -Math.PI / 2
playerShadow.position.y = 0.02 // Just above ground to avoid z-fighting
scene.add(playerShadow)

// Build player avatar
function createMaterial(color: string | number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color: new THREE.Color(color),
    flatShading: true
  })
}

function buildPlayerAvatar(config: AvatarConfig) {
  // Clear existing
  while (player.children.length > 0) {
    player.remove(player.children[0])
  }

  const avatarGroup = new THREE.Group()
  avatarGroup.position.y = 1.2 // Head height
  avatarGroup.scale.setScalar(0.6) // Smaller for world scale

  // Head
  let headGeom: THREE.BufferGeometry
  switch (config.headShape) {
    case 'oval':
      headGeom = new THREE.IcosahedronGeometry(1, 1)
      headGeom.scale(0.85, 1.1, 0.9)
      break
    case 'square':
      headGeom = new THREE.BoxGeometry(1.6, 1.8, 1.5, 2, 2, 2)
      break
    default:
      headGeom = new THREE.IcosahedronGeometry(1, 1)
  }
  const head = new THREE.Mesh(headGeom, createMaterial(config.headColor))
  head.castShadow = true
  avatarGroup.add(head)

  // Simple body
  const bodyGeom = new THREE.CapsuleGeometry(0.4, 0.8, 4, 8)
  const body = new THREE.Mesh(bodyGeom, createMaterial(config.headColor))
  body.position.y = -1.4
  body.castShadow = true
  avatarGroup.add(body)

  // Hair (simplified)
  if (config.hairStyle !== 'none') {
    const hairMat = createMaterial(config.hairColor)
    if (config.hairStyle === 'spiky') {
      const spikeGeom = new THREE.ConeGeometry(0.15, 0.5, 4)
      const positions = [
        { x: 0, y: 1.1, z: 0 },
        { x: 0.3, y: 1.0, z: 0.1 },
        { x: -0.3, y: 1.0, z: 0.1 },
      ]
      positions.forEach(pos => {
        const spike = new THREE.Mesh(spikeGeom, hairMat)
        spike.position.set(pos.x, pos.y, pos.z)
        spike.castShadow = true
        avatarGroup.add(spike)
      })
    } else {
      const hairGeom = new THREE.SphereGeometry(1.05, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.45)
      const hair = new THREE.Mesh(hairGeom, hairMat)
      hair.position.y = 0.15
      hair.castShadow = true
      avatarGroup.add(hair)
    }
  }

  // Eyes (simple dots)
  const eyeMat = createMaterial(config.eyeColor)
  const eyeGeom = new THREE.SphereGeometry(0.08, 8, 6)
  const leftEye = new THREE.Mesh(eyeGeom, eyeMat)
  leftEye.position.set(-0.3, 0.15, 0.85)
  const rightEye = new THREE.Mesh(eyeGeom, eyeMat)
  rightEye.position.set(0.3, 0.15, 0.85)
  avatarGroup.add(leftEye, rightEye)

  // Blush
  if (config.hasBlush) {
    const blushMat = new THREE.MeshLambertMaterial({
      color: 0xffaaaa,
      transparent: true,
      opacity: 0.6
    })
    const blushGeom = new THREE.CircleGeometry(0.1, 6)
    const leftBlush = new THREE.Mesh(blushGeom, blushMat)
    leftBlush.position.set(-0.5, -0.05, 0.75)
    leftBlush.rotation.y = -0.4
    const rightBlush = new THREE.Mesh(blushGeom, blushMat)
    rightBlush.position.set(0.5, -0.05, 0.75)
    rightBlush.rotation.y = 0.4
    avatarGroup.add(leftBlush, rightBlush)
  }

  player.add(avatarGroup)
}

buildPlayerAvatar(playerAvatar)

// Camera initial position (isometric)

// Movement state
const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
  jump: false
}

const WALK_SPEED = 5
const SPRINT_SPEED = 12
const JUMP_FORCE = 8
const GRAVITY = 20

// Jump state
let verticalVelocity = 0
let isGrounded = true

const playerDirection = new THREE.Vector3()

// Input handling
document.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': keys.forward = true; break
    case 'KeyS': case 'ArrowDown': keys.backward = true; break
    case 'KeyA': case 'ArrowLeft': keys.left = true; break
    case 'KeyD': case 'ArrowRight': keys.right = true; break
    case 'ShiftLeft': case 'ShiftRight': keys.sprint = true; break
    case 'Space':
      if (isGrounded) {
        verticalVelocity = JUMP_FORCE
        isGrounded = false
      }
      break
    case 'KeyE':
      // Interact with closest post
      if (closestPost) {
        showPostViewer(closestPost)
      }
      break
  }
})

document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': keys.forward = false; break
    case 'KeyS': case 'ArrowDown': keys.backward = false; break
    case 'KeyA': case 'ArrowLeft': keys.left = false; break
    case 'KeyD': case 'ArrowRight': keys.right = false; break
    case 'ShiftLeft': case 'ShiftRight': keys.sprint = false; break
  }
})

// Scroll wheel zoom
document.addEventListener('wheel', (e) => {
  e.preventDefault()
  targetFrustumSize += e.deltaY * 0.02
  targetFrustumSize = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetFrustumSize))
}, { passive: false })

// No mouse camera rotation in isometric mode - camera is fixed

// Create post visualization - MMBN style data panels
function createPostMesh(post: Post, index: number): THREE.Group {
  const group = new THREE.Group()

  // Random position within the playable area (outside platform, inside boundary)
  const angle = Math.random() * Math.PI * 2
  const radius = 10 + Math.random() * 20 // Between 10 and 30 units from center
  const x = Math.cos(angle) * radius
  const z = Math.sin(angle) * radius
  group.position.set(x, 2 + Math.random() * 2, z)

  // Get cyber color based on author
  const color = stringToCyberColor(post.author.handle)

  // Outer frame - wireframe box
  const frameGeom = new THREE.BoxGeometry(3, 2, 0.3)
  const frameMat = new THREE.MeshBasicMaterial({
    color: color,
    wireframe: true,
    transparent: true,
    opacity: 0.8
  })
  const frame = new THREE.Mesh(frameGeom, frameMat)
  group.add(frame)

  // Inner panel - solid with glow
  const panelGeom = new THREE.BoxGeometry(2.6, 1.6, 0.1)
  const panelMat = new THREE.MeshBasicMaterial({
    color: '#0a0a1a',
    transparent: true,
    opacity: 0.9
  })
  const panel = new THREE.Mesh(panelGeom, panelMat)
  group.add(panel)

  // Top accent bar
  const barGeom = new THREE.BoxGeometry(2.6, 0.2, 0.15)
  const barMat = new THREE.MeshBasicMaterial({ color: color })
  const bar = new THREE.Mesh(barGeom, barMat)
  bar.position.y = 0.7
  bar.position.z = 0.05
  group.add(bar)

  // Corner accents
  const cornerGeom = new THREE.BoxGeometry(0.3, 0.3, 0.2)
  const cornerMat = new THREE.MeshBasicMaterial({ color: color })
  const corners = [
    { x: -1.15, y: -0.65 },
    { x: 1.15, y: -0.65 },
    { x: -1.15, y: 0.65 },
    { x: 1.15, y: 0.65 }
  ]
  corners.forEach(pos => {
    const corner = new THREE.Mesh(cornerGeom, cornerMat)
    corner.position.set(pos.x, pos.y, 0.1)
    group.add(corner)
  })

  // Floating data indicator
  const indicatorGeom = new THREE.OctahedronGeometry(0.2, 0)
  const indicatorMat = new THREE.MeshBasicMaterial({ color: color })
  const indicator = new THREE.Mesh(indicatorGeom, indicatorMat)
  indicator.position.set(0, 1.3, 0)
  group.add(indicator)

  // Store post data for interaction
  group.userData = { post, color, baseColor: color }

  // Random initial rotation
  group.rotation.y = Math.random() * Math.PI * 2

  return group
}

function stringToCyberColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  // MMBN-style colors: cyan, magenta, green, yellow, orange
  const cyberColors = ['#00ffff', '#ff00ff', '#00ff88', '#ffff00', '#ff8800', '#88ff00', '#ff0088', '#0088ff']
  return cyberColors[Math.abs(hash) % cyberColors.length]
}

// Fetch and display posts
async function fetchPosts() {
  if (!isLoggedIn) return

  try {
    const timeline = await agent.getTimeline({ limit: 20 })

    // Remove old post meshes
    posts.forEach(p => {
      if (p.mesh) scene.remove(p.mesh)
    })

    posts = timeline.data.feed.map((item, index) => {
      const post: Post = {
        uri: item.post.uri,
        author: {
          handle: item.post.author.handle,
          displayName: item.post.author.displayName,
          avatar: item.post.author.avatar
        },
        text: (item.post.record as any).text || '',
        createdAt: item.post.indexedAt
      }

      post.mesh = createPostMesh(post, index)
      scene.add(post.mesh)

      return post
    })

    showNotification(`Loaded ${posts.length} posts from your timeline`)
  } catch (err) {
    console.error('Failed to fetch posts:', err)
  }
}

// Load avatar from Bluesky
async function loadAvatarFromBluesky() {
  if (!isLoggedIn) return

  try {
    const repo = agent.session?.did
    if (!repo) return

    const response = await agent.com.atproto.repo.getRecord({
      repo,
      collection: 'xyz.bskatar.avatar',
      rkey: 'self'
    })

    const record = response.data.value as any
    playerAvatar = {
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

    buildPlayerAvatar(playerAvatar)
    showNotification('Loaded your bskatar!')
  } catch (err) {
    console.log('No bskatar found, using default avatar')
  }
}

// Session persistence
const SESSION_KEY = 'bskyplace_session'

function saveSession() {
  if (agent.session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(agent.session))
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

async function tryResumeSession(): Promise<boolean> {
  const saved = localStorage.getItem(SESSION_KEY)
  if (!saved) return false

  try {
    const session = JSON.parse(saved)
    await agent.resumeSession(session)
    isLoggedIn = true
    userHandle = session.handle
    updateUI()
    await loadAvatarFromBluesky()
    await fetchPosts()
    showNotification('Welcome back, @' + userHandle)
    return true
  } catch (err) {
    // Session expired or invalid, clear it
    clearSession()
    return false
  }
}

// Auth functions
async function login(handle: string, password: string): Promise<boolean> {
  try {
    await agent.login({ identifier: handle, password })
    isLoggedIn = true
    userHandle = handle
    saveSession()
    updateUI()
    await loadAvatarFromBluesky()
    await fetchPosts()
    return true
  } catch (err: any) {
    showNotification('Login failed: ' + (err.message || 'Unknown error'))
    return false
  }
}

function showNotification(message: string) {
  const existing = document.querySelector('.notification')
  if (existing) existing.remove()

  const notification = document.createElement('div')
  notification.className = 'notification show'
  notification.textContent = message
  document.body.appendChild(notification)

  setTimeout(() => {
    notification.classList.remove('show')
    setTimeout(() => notification.remove(), 300)
  }, 3000)
}

// UI
function createUI() {
  const ui = document.createElement('div')
  ui.className = 'ui-overlay'
  ui.innerHTML = `
    <div class="login-panel" id="login-panel">
      <h1>bskyplace</h1>
      <p class="subtitle">walk through your bluesky feed</p>
      <input type="text" id="handle-input" placeholder="Handle (e.g. user.bsky.social)">
      <input type="password" id="password-input" placeholder="App Password">
      <button id="login-btn">Enter</button>
      <p class="hint">Use an <a href="https://bsky.app/settings/app-passwords" target="_blank">App Password</a></p>
    </div>
    <div class="hud" id="hud" style="display: none;">
      <div class="user-info">@<span id="user-handle"></span> <button id="logout-btn">logout</button></div>
      <div class="controls-hint">WASD move • Space jump • Shift sprint • Scroll zoom • E interact</div>
    </div>
    <div class="post-viewer" id="post-viewer" style="display: none;">
      <div class="post-content">
        <div class="post-author" id="post-author"></div>
        <div class="post-text" id="post-text"></div>
      </div>
      <button id="close-post">×</button>
    </div>
  `
  document.body.appendChild(ui)

  // Login handler
  document.getElementById('login-btn')?.addEventListener('click', async () => {
    const handle = (document.getElementById('handle-input') as HTMLInputElement).value.trim()
    const password = (document.getElementById('password-input') as HTMLInputElement).value

    if (!handle || !password) {
      showNotification('Please enter handle and password')
      return
    }

    const btn = document.getElementById('login-btn') as HTMLButtonElement
    btn.disabled = true
    btn.textContent = 'Connecting...'

    await login(handle, password)

    btn.disabled = false
    btn.textContent = 'Enter'
  })

  // Close post viewer
  document.getElementById('close-post')?.addEventListener('click', () => {
    document.getElementById('post-viewer')!.style.display = 'none'
  })

  // Logout handler
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    clearSession()
    isLoggedIn = false
    userHandle = ''
    // Remove posts from scene
    posts.forEach(p => {
      if (p.mesh) scene.remove(p.mesh)
    })
    posts = []
    // Reset UI
    document.getElementById('login-panel')!.style.display = 'flex'
    document.getElementById('hud')!.style.display = 'none'
    document.getElementById('post-viewer')!.style.display = 'none'
    showNotification('Logged out')
  })
}

function updateUI() {
  if (isLoggedIn) {
    document.getElementById('login-panel')!.style.display = 'none'
    document.getElementById('hud')!.style.display = 'block'
    document.getElementById('user-handle')!.textContent = userHandle
  }
}

createUI()

// Try to resume saved session on load
tryResumeSession()

// Raycaster for post interaction
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

document.addEventListener('click', (e) => {
  if (!isLoggedIn) return

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)

  // Check refresh token first
  const tokenIntersects = raycaster.intersectObject(refreshToken, true)
  if (tokenIntersects.length > 0) {
    // Clicked the refresh token!
    fetchPosts()
    return
  }

  const postMeshes = posts.map(p => p.mesh).filter(Boolean) as THREE.Group[]
  const intersects = raycaster.intersectObjects(postMeshes, true)

  if (intersects.length > 0) {
    // Find the post group
    let obj = intersects[0].object
    while (obj.parent && !obj.userData.post) {
      obj = obj.parent as THREE.Object3D
    }

    if (obj.userData.post) {
      const post = obj.userData.post as Post
      showPostViewer(post)
    }
  }
})

function showPostViewer(post: Post) {
  const viewer = document.getElementById('post-viewer')!
  const author = document.getElementById('post-author')!
  const text = document.getElementById('post-text')!

  author.textContent = `@${post.author.handle}${post.author.displayName ? ` (${post.author.displayName})` : ''}`
  text.textContent = post.text

  viewer.style.display = 'block'
}


// Animation loop
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)

  const delta = clock.getDelta()

  // Animate refresh token
  refreshToken.rotation.y += 0.02
  refreshToken.children[0].rotation.x += 0.01 // outer cube
  refreshToken.children[0].rotation.z += 0.015
  refreshToken.children[1].rotation.y += 0.03 // inner core
  refreshToken.position.y = 2 + Math.sin(Date.now() * 0.003) * 0.3

  // Animate teleport portal
  teleportPortal.children[0].rotation.z += 0.01 // base ring
  teleportPortal.children[2].rotation.y += 0.02 // beam
  // Animate floating runes orbiting
  for (let i = 4; i < teleportPortal.children.length; i++) {
    const rune = teleportPortal.children[i]
    const offset = rune.userData.orbitOffset || 0
    const time = Date.now() * 0.002
    rune.position.x = Math.cos(time + offset) * 1.5
    rune.position.z = Math.sin(time + offset) * 1.5
    rune.rotation.y += 0.05
    rune.rotation.x += 0.03
  }

  // Check teleporter proximity (check appropriate portal based on current world)
  const activePortal = currentWorld === 'cyber' ? teleportPortal : fantasyPortal
  const portalDx = player.position.x - activePortal.position.x
  const portalDz = player.position.z - activePortal.position.z
  const portalDist = Math.sqrt(portalDx * portalDx + portalDz * portalDz)
  if (portalDist < 2) {
    // Teleport to other world
    const targetWorld = currentWorld === 'cyber' ? 'fantasy' : 'cyber'
    switchWorld(targetWorld)
  }

  // Animate fantasy portal sparkles if visible
  if (fantasyPortal.visible) {
    for (let i = 2; i < fantasyPortal.children.length; i++) {
      const sparkle = fantasyPortal.children[i]
      const offset = sparkle.userData.sparkleOffset || 0
      const time = Date.now() * 0.003
      sparkle.position.x = Math.cos(time + offset) * 1.2
      sparkle.position.z = Math.sin(time + offset) * 1.2
      sparkle.rotation.y += 0.08
    }
  }

  // Player movement - isometric controls
  // In isometric, we rotate input 45 degrees so "up" moves up-left on screen
  playerDirection.set(0, 0, 0)

  // MMBN-style: directions are rotated 45 degrees for isometric
  if (keys.forward) {
    playerDirection.x -= 1
    playerDirection.z -= 1
  }
  if (keys.backward) {
    playerDirection.x += 1
    playerDirection.z += 1
  }
  if (keys.left) {
    playerDirection.x -= 1
    playerDirection.z += 1
  }
  if (keys.right) {
    playerDirection.x += 1
    playerDirection.z -= 1
  }

  if (playerDirection.length() > 0) {
    playerDirection.normalize()

    // Move player (sprint if shift held)
    const speed = keys.sprint ? SPRINT_SPEED : WALK_SPEED
    player.position.add(playerDirection.multiplyScalar(speed * delta))

    // Rotate player to face movement direction
    player.rotation.y = Math.atan2(playerDirection.x, playerDirection.z)

    // Keep player in bounds (outer boundary)
    const dist = Math.sqrt(player.position.x ** 2 + player.position.z ** 2)
    if (dist > 35) {
      const norm = player.position.clone().normalize().multiplyScalar(35)
      player.position.x = norm.x
      player.position.z = norm.z
    }
  }

  // Calculate ground height at player position
  const distFromCenter = Math.sqrt(player.position.x ** 2 + player.position.z ** 2)
  let groundHeight = 0

  if (currentWorld === 'cyber') {
    // Cyber platform is a hexagon with radius 8, height 0.3
    if (distFromCenter < 8) {
      groundHeight = 0.3
    }
  } else {
    // Fantasy stone circle radius 8, height 0.5
    if (distFromCenter < 8) {
      groundHeight = 0.5
    }
  }

  // Apply gravity and jumping
  if (!isGrounded) {
    verticalVelocity -= GRAVITY * delta
    player.position.y += verticalVelocity * delta

    // Check if landed
    if (player.position.y <= groundHeight) {
      player.position.y = groundHeight
      verticalVelocity = 0
      isGrounded = true
    }
  } else {
    // Smooth height transition when walking on ground
    player.position.y += (groundHeight - player.position.y) * 0.2

    // Check if we walked off an edge
    if (player.position.y > groundHeight + 0.1) {
      isGrounded = false
    }
  }

  // Update shadow position (follows player XZ, stays at ground height)
  playerShadow.position.x = player.position.x
  playerShadow.position.z = player.position.z
  playerShadow.position.y = groundHeight + 0.02

  // Shadow gets smaller/more transparent when player is higher (shows jump height)
  const heightAboveGround = player.position.y - groundHeight
  const shadowScale = Math.max(0.3, 1 - heightAboveGround * 0.3)
  const shadowOpacity = Math.max(0.1, 0.4 - heightAboveGround * 0.1)
  playerShadow.scale.setScalar(shadowScale)
  ;(playerShadow.material as THREE.MeshBasicMaterial).opacity = shadowOpacity

  // Camera follows player directly (no sway)
  const camOffset = new THREE.Vector3(20, 20, 20)
  camera.position.copy(player.position).add(camOffset)

  // Always look at player
  const lookTarget = player.position.clone()
  lookTarget.y += 1
  camera.lookAt(lookTarget)

  // Smooth zoom
  if (Math.abs(frustumSize - targetFrustumSize) > 0.01) {
    frustumSize += (targetFrustumSize - frustumSize) * 0.1
    const currentAspect = window.innerWidth / window.innerHeight
    camera.left = -frustumSize * currentAspect / 2
    camera.right = frustumSize * currentAspect / 2
    camera.top = frustumSize / 2
    camera.bottom = -frustumSize / 2
    camera.updateProjectionMatrix()
  }

  // Find closest post and animate posts
  let minDist = Infinity
  closestPost = null

  posts.forEach((post, i) => {
    if (post.mesh) {
      // Calculate distance to player (XZ plane)
      const dx = post.mesh.position.x - player.position.x
      const dz = post.mesh.position.z - player.position.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      // Track closest post within interact distance
      if (dist < INTERACT_DISTANCE && dist < minDist) {
        minDist = dist
        closestPost = post
      }

      // Floating animation
      post.mesh.position.y = 2.5 + Math.sin(Date.now() * 0.002 + i) * 0.5
      post.mesh.rotation.y += 0.002

      // Glow effect for closest post
      const isClosest = closestPost === post
      const frame = post.mesh.children[0] as THREE.Mesh
      const bar = post.mesh.children[2] as THREE.Mesh
      const indicator = post.mesh.children[5] as THREE.Mesh

      if (frame && bar) {
        const targetColor = isClosest ? '#ffffff' : post.mesh.userData.baseColor
        const mat = frame.material as THREE.MeshBasicMaterial
        const barMat = bar.material as THREE.MeshBasicMaterial
        mat.color.lerp(new THREE.Color(targetColor), 0.1)
        barMat.color.lerp(new THREE.Color(targetColor), 0.1)
        mat.opacity = isClosest ? 1.0 : 0.8
      }

      // Pulse the indicator
      if (indicator) {
        indicator.rotation.y += 0.05
        indicator.rotation.x += 0.02
        // Scale up indicator when closest
        const targetScale = isClosest ? 1.5 : 1.0
        indicator.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1)
      }
    }
  })

  // Animate data pillars
  pillars.forEach((pillar, i) => {
    // Rotate the top cube
    const cube = pillar.children[3]
    if (cube) {
      cube.rotation.y += 0.02
      cube.rotation.x += 0.01
      cube.position.y = pillar.userData?.baseY || (pillarPositions[i]?.h || 8) + 1.5 + Math.sin(Date.now() * 0.003 + i) * 0.3
    }
  })

  // Rotate platform edge
  platformEdge.rotation.z += 0.001

  // Render scene to low-res target, then display scaled up (no jitter!)
  renderer.setRenderTarget(lowResTarget)
  renderer.render(scene, camera)
  renderer.setRenderTarget(null)
  renderer.render(quadScene, quadCamera)
}

animate()

// Handle resize - orthographic camera (low-res target stays fixed for consistent pixels)
window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight
  camera.left = -frustumSize * aspect / 2
  camera.right = frustumSize * aspect / 2
  camera.top = frustumSize / 2
  camera.bottom = -frustumSize / 2
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  // Note: lowResTarget stays at fixed resolution for consistent pixel size
})
