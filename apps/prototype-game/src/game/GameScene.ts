import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three'
import type { ControllerInputEvent, PlayerProfile } from '@air-jam/sdk'

const PLAYER_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#22d3ee', '#facc15', '#34d399']

interface PlayerState {
  mesh: Mesh
  velocity: Vector3
  targetVelocity: Vector3
  color: Color
}

export class GameScene {
  private readonly scene: Scene

  private readonly camera: PerspectiveCamera

  private readonly renderer: WebGLRenderer

  private readonly container: HTMLElement

  private readonly playerStates = new Map<string, PlayerState>()

  private animationHandle: number | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.scene = new Scene()
    this.scene.background = new Color('#0b1224')

    const aspect = container.clientWidth / container.clientHeight
    this.camera = new PerspectiveCamera(60, aspect, 0.1, 100)
    this.camera.position.set(0, 8, 10)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(this.renderer.domElement)

    const ambient = new AmbientLight(0xffffff, 0.8)
    const directional = new DirectionalLight(0xffffff, 2)
    directional.position.set(5, 10, 7.5)
    this.scene.add(ambient)
    this.scene.add(directional)

    window.addEventListener('resize', this.handleResize)
    this.animate()
  }

  addPlayer(profile: PlayerProfile): void {
    if (this.playerStates.has(profile.id)) {
      return
    }
    const color = new Color(PLAYER_COLORS[this.playerStates.size % PLAYER_COLORS.length])
    const geometry = new BoxGeometry(1, 1, 1)
    const material = new MeshStandardMaterial({ color })
    const mesh = new Mesh(geometry, material)

    const radius = 2 + this.playerStates.size * 0.5
    const angle = (this.playerStates.size / 6) * Math.PI * 2
    mesh.position.set(Math.cos(angle) * radius, 0.5, Math.sin(angle) * radius)

    this.scene.add(mesh)
    this.playerStates.set(profile.id, {
      mesh,
      velocity: new Vector3(),
      targetVelocity: new Vector3(),
      color,
    })
  }

  removePlayer(controllerId: string): void {
    const state = this.playerStates.get(controllerId)
    if (!state) return
    this.scene.remove(state.mesh)
    state.mesh.geometry.dispose()
    if (Array.isArray(state.mesh.material)) {
      state.mesh.material.forEach((mat: Material) => mat.dispose())
    } else {
      ;(state.mesh.material as Material).dispose()
    }
    this.playerStates.delete(controllerId)
  }

  handleInput(event: ControllerInputEvent): void {
    const state = this.playerStates.get(event.controllerId)
    if (!state) {
      return
    }
    const speed = 3
    state.targetVelocity.set(event.input.vector.x * speed, 0, -event.input.vector.y * speed)
    if (event.input.action) {
      state.mesh.scale.setScalar(1.15)
    } else {
      state.mesh.scale.setScalar(1)
    }
  }

  private animate = (): void => {
    this.animationHandle = requestAnimationFrame(this.animate)
    this.playerStates.forEach((state) => {
      state.velocity.lerp(state.targetVelocity, 0.15)
      state.mesh.position.addScaledVector(state.velocity, 0.016)
      state.mesh.position.clamp(
        new Vector3(-6, 0.5, -6),
        new Vector3(6, 0.5, 6),
      )
      state.mesh.rotation.y += 0.01 + state.velocity.length() * 0.02
    })
    this.renderer.render(this.scene, this.camera)
  }

  private handleResize = (): void => {
    const { clientWidth, clientHeight } = this.container
    this.camera.aspect = clientWidth / clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(clientWidth, clientHeight)
  }

  dispose(): void {
    if (this.animationHandle) {
      cancelAnimationFrame(this.animationHandle)
    }
    window.removeEventListener('resize', this.handleResize)
    this.playerStates.forEach((_, controllerId) => this.removePlayer(controllerId))
    this.playerStates.clear()
    this.renderer.dispose()
    this.scene.clear()
    this.container.innerHTML = ''
  }
}
