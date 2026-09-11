import { Canvas } from '@react-three/fiber'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Camera,
  Check,
  ChevronRight,
  Compass,
  Expand,
  Flower2,
  Focus,
  Leaf,
  Lightbulb,
  Map,
  MapPin,
  Maximize,
  Minus,
  Moon,
  Mountain,
  Navigation,
  NotebookPen,
  Octagon,
  Orbit,
  Pause,
  Play,
  Plus,
  Power,
  Radar,
  RotateCcw,
  Settings2,
  Sprout,
  Sun,
  TreePine,
  Volume2,
  VolumeX,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react'
import { Component, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ACESFilmicToneMapping, PCFShadowMap } from 'three'
import './App.css'
import type { SceneApi } from './components/Scene'
import Scene from './components/Scene'
import type { DriveInput, Telemetry } from './lib/simulation'
import { EMPTY_INPUT, EMPTY_TELEMETRY } from './lib/simulation'
import { groundHeight, landmarks, pathDistance, WORLD_SIZE, worldObjects } from './lib/world'

type Panel = 'journal' | 'settings' | 'robot' | 'map' | null

class SceneBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    return this.state.error ? (
      <div className="scene-fallback" role="alert">
        <Sprout size={32} />
        <h2>The meadow could not open.</h2>
        <p>Enable browser hardware acceleration, then try again.</p>
        <button onClick={() => location.reload()}>Try again</button>
      </div>
    ) : (
      this.props.children
    )
  }
}

function IconButton({
  label,
  children,
  onClick,
  active,
  className = '',
  disabled = false,
}: {
  label: string
  children: ReactNode
  onClick: () => void
  active?: boolean
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      className={`icon-button ${active ? 'is-active' : ''} ${className}`}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
    >
      <span className="button-icon">{children}</span>
      <span className="tooltip" role="tooltip">
        {label}
      </span>
    </button>
  )
}

function createMapTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 440
  canvas.height = 440
  const context = canvas.getContext('2d')!
  const image = context.createImageData(440, 440)
  for (let row = 0; row < 440; row++) {
    for (let column = 0; column < 440; column++) {
      const x = (column / 440) * WORLD_SIZE - WORLD_SIZE / 2
      const z = (row / 440) * WORLD_SIZE - WORLD_SIZE / 2
      const height = groundHeight(x, z)
      const shade = Math.max(-10, Math.min(12, height * 3))
      const path = pathDistance(x, z) < 3
      const index = (row * 440 + column) * 4
      image.data[index] = (path ? 220 : 166) + shade
      image.data[index + 1] = (path ? 215 : 185) + shade
      image.data[index + 2] = (path ? 181 : 138) + shade
      image.data[index + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  for (const object of worldObjects.filter((object) => object.kind === 'tree')) {
    context.fillStyle = '#78966e'
    context.beginPath()
    context.arc(
      (object.x / WORLD_SIZE + 0.5) * 440,
      (object.z / WORLD_SIZE + 0.5) * 440,
      object.scale * 3.7,
      0,
      Math.PI * 2,
    )
    context.fill()
  }
  return canvas
}

function Minimap({
  telemetry,
  discovered,
  waypoint,
  expanded = false,
}: {
  telemetry: Telemetry
  discovered: string[]
  waypoint: string | null
  expanded?: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [texture] = useState(createMapTexture)
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context || !canvas.current) return
    const size = canvas.current.width
    const span = expanded ? 160 : 74
    const centerX = expanded ? 0 : telemetry.x
    const centerZ = expanded ? -18 : telemetry.z
    const sourceSize = (span / WORLD_SIZE) * 440
    const sourceX = (centerX / WORLD_SIZE + 0.5) * 440 - sourceSize / 2
    const sourceZ = (centerZ / WORLD_SIZE + 0.5) * 440 - sourceSize / 2
    context.fillStyle = '#a1b58b'
    context.fillRect(0, 0, size, size)
    context.drawImage(texture, sourceX, sourceZ, sourceSize, sourceSize, 0, 0, size, size)
    const project = (x: number, z: number) => [
      ((x - centerX) / span) * size + size / 2,
      ((z - centerZ) / span) * size + size / 2,
    ]
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--cp-accent').trim()
    for (const landmark of landmarks) {
      const [x, y] = project(landmark.x, landmark.z)
      if (x < 0 || y < 0 || x > size || y > size) continue
      if (waypoint === landmark.id) {
        const [robotX, robotY] = project(telemetry.x, telemetry.z)
        context.beginPath()
        context.setLineDash([5, 6])
        context.moveTo(robotX, robotY)
        context.lineTo(x, y)
        context.strokeStyle = accent
        context.lineWidth = 2
        context.stroke()
        context.setLineDash([])
      }
      context.beginPath()
      context.arc(x, y, expanded ? 8 : 7, 0, Math.PI * 2)
      context.fillStyle = discovered.includes(landmark.id) ? accent : '#f6f4df'
      context.fill()
      context.strokeStyle = '#6e8462'
      context.lineWidth = 2
      context.stroke()
      if (expanded) {
        context.fillStyle = '#334730'
        context.font = '500 13px "Segoe UI"'
        context.textAlign = 'center'
        context.fillText(landmark.name, x, y + 25)
      }
    }
    const [robotX, robotY] = project(telemetry.x, telemetry.z)
    context.save()
    context.translate(robotX, robotY)
    context.rotate(-telemetry.heading + Math.PI)
    context.beginPath()
    context.arc(0, 0, 17, 0, Math.PI * 2)
    context.fillStyle = '#ffffff75'
    context.fill()
    context.beginPath()
    context.moveTo(0, -12)
    context.lineTo(8, 9)
    context.lineTo(0, 5)
    context.lineTo(-8, 9)
    context.closePath()
    context.fillStyle = '#344b3a'
    context.strokeStyle = '#ffffff'
    context.lineWidth = 2.5
    context.fill()
    context.stroke()
    context.restore()
  }, [telemetry.x, telemetry.z, telemetry.heading, discovered, texture, waypoint, expanded])
  return (
    <canvas
      ref={canvas}
      width={expanded ? 660 : 320}
      height={expanded ? 660 : 320}
      aria-label={
        expanded
          ? 'Map of Sunpetal Meadow with your position and four landmarks'
          : 'Live north-up minimap'
      }
      role="img"
      className="map-canvas"
    />
  )
}

function HeadingCompass({ heading }: { heading: number }) {
  const bearing = (180 - (heading * 180) / Math.PI + 360) % 360
  const direction = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(bearing / 45) % 8]
  return (
    <div
      className="heading-compass"
      aria-label={`Heading ${Math.round(bearing)} degrees ${direction}`}
    >
      <div className="compass-needle" />
      <div className="compass-track">
        {Array.from({ length: 15 }, (_, index) => {
          const degree = Math.floor(bearing / 15) * 15 + (index - 7) * 15
          const normalized = (degree + 720) % 360
          const label =
            normalized % 90 === 0
              ? ['N', 'E', 'S', 'W'][normalized / 90]
              : normalized % 45 === 0
                ? `${normalized}`
                : ''
          return (
            <span
              key={index}
              className={`compass-tick ${label ? 'major' : ''}`}
              style={{ left: `calc(50% + ${(degree - bearing) * 2.2}px)` }}
            >
              {label && <span>{label}</span>}
            </span>
          )
        })}
      </div>
      <span className="compass-value">
        {String(Math.round(bearing)).padStart(3, '0')}&deg; <b>{direction}</b>
      </span>
    </div>
  )
}

function Speedometer({
  telemetry,
  powered,
  onRobot,
}: {
  telemetry: Telemetry
  powered: boolean
  onRobot: () => void
}) {
  const speed = Math.abs(telemetry.speed) * 3.6
  return (
    <section className="telemetry-panel" aria-label="Vehicle telemetry">
      <button className="robot-label" onClick={onRobot}>
        <span className={`status-dot ${!powered ? 'offline' : ''}`} /> MILO-01{' '}
        <ChevronRight size={12} />
      </button>
      <div className="instrument-row">
        <div className="speed-dial">
          <svg viewBox="0 0 108 91" aria-hidden="true">
            <path className="dial-track" d="M 17 78 A 44 44 0 1 1 91 78" />
            <path
              className="dial-value"
              d="M 17 78 A 44 44 0 1 1 91 78"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={100 - Math.min(100, (speed / 26) * 100)}
            />
          </svg>
          <output className="speed-number" data-testid="speed">
            {String(Math.floor(speed)).padStart(2, '0')}
          </output>
          <span className="speed-unit">km/h</span>
        </div>
        <div className="vehicle-readouts">
          <div className="drive-state">
            <span className="gear">{telemetry.gear}</span>
            <span>
              {!powered
                ? 'Powered off'
                : telemetry.gear === 'P'
                  ? 'At ease'
                  : telemetry.gear === 'R'
                    ? 'Reversing'
                    : 'On the move'}
            </span>
          </div>
          <div className={`boost-readout ${telemetry.boosting ? 'boosting' : ''}`}>
            <span>
              <Zap size={11} /> BOOST
            </span>
            <b>{Math.round(telemetry.boost * 100)}%</b>
          </div>
          <div className="boost-track">
            <span style={{ width: `${telemetry.boost * 100}%` }} />
          </div>
          <div className="ground-contact">
            <span className="contact-dots" aria-label={`${telemetry.contact} wheels in contact`}>
              {[0, 1, 2, 3].map((index) => (
                <i key={index} className={index < telemetry.contact ? 'in-contact' : ''} />
              ))}
            </span>
            <span>
              {telemetry.contact === 4 ? 'All-terrain ready' : `${telemetry.contact}/4 in contact`}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

function DriveButton({
  label,
  children,
  field,
  value,
  onInput,
  disabled = false,
}: {
  label: string
  children: ReactNode
  field: keyof DriveInput
  value: number | boolean
  onInput: (field: keyof DriveInput, value: number | boolean) => void
  disabled?: boolean
}) {
  const release = () => onInput(field, field === 'throttle' || field === 'steer' ? 0 : false)
  const press = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    onInput(field, value)
  }
  return (
    <button
      className={`drive-button drive-${field}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={(event) => {
        if (event.code !== 'Enter' && event.code !== 'Space') return
        event.preventDefault()
        onInput(field, value)
      }}
      onKeyUp={release}
      onBlur={release}
    >
      {children}
    </button>
  )
}

function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [telemetry, setTelemetry] = useState<Telemetry>({ ...EMPTY_TELEMETRY })
  const [panel, setPanel] = useState<Panel>(null)
  const [powered, setPowered] = useState(true)
  const [lights, setLights] = useState(true)
  const [hatchOpen, setHatchOpen] = useState(false)
  const [scan, setScan] = useState(0)
  const [paused, setPaused] = useState(false)
  const [evening, setEvening] = useState(false)
  const [sound, setSound] = useState(false)
  const [cameraMode, setCameraMode] = useState<'follow' | 'orbit'>('follow')
  const [quality, setQuality] = useState<'balanced' | 'high'>('high')
  const [zoom, setZoom] = useState(8.8)
  const [toast, setToast] = useState<string | null>(null)
  const [waypoint, setWaypoint] = useState<string | null>(null)
  const [discovered, setDiscovered] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('milo-discoveries') ?? '[]')
      return Array.isArray(saved)
        ? saved.filter(
            (id): id is string =>
              typeof id === 'string' && landmarks.some((landmark) => landmark.id === id),
          )
        : []
    } catch {
      return []
    }
  })
  const input = useRef<DriveInput>({ ...EMPTY_INPUT })
  const clearDriveInput = useCallback(() => {
    input.current = { ...EMPTY_INPUT }
  }, [])
  const updateDriveInput = useCallback((field: keyof DriveInput, value: number | boolean) => {
    if (field === 'throttle' || field === 'steer') input.current[field] = Number(value)
    else input.current[field] = Boolean(value)
  }, [])
  const scene = useRef<SceneApi | null>(null)
  const app = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLElement>(null)
  const motor = useRef<{ frequency: AudioParam; gain: AudioParam; context: AudioContext } | null>(
    null,
  )
  const selectedLandmark = landmarks.find((landmark) => landmark.id === waypoint)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!sound) return
    let context: AudioContext | undefined
    let cancelled = false
    void Promise.resolve()
      .then(async () => {
        if (cancelled) return
        const current = new AudioContext()
        context = current
        const buffer = current.createBuffer(1, current.sampleRate * 3, current.sampleRate)
        const channel = buffer.getChannelData(0)
        for (let index = 0; index < channel.length; index++)
          channel[index] = (Math.random() * 2 - 1) * 0.1
        const wind = current.createBufferSource()
        wind.buffer = buffer
        wind.loop = true
        const filter = current.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 550
        const ambient = current.createGain()
        ambient.gain.value = 0.28
        wind.connect(filter).connect(ambient).connect(current.destination)
        wind.start()
        const oscillator = current.createOscillator()
        oscillator.type = 'sine'
        oscillator.frequency.value = 75
        const gain = current.createGain()
        gain.gain.value = 0.003
        oscillator.connect(gain).connect(current.destination)
        oscillator.start()
        motor.current = { frequency: oscillator.frequency, gain: gain.gain, context: current }
        await current.resume()
      })
      .catch(() => {
        if (!cancelled) {
          setToast('Audio could not start.')
          setSound(false)
        }
      })
    return () => {
      cancelled = true
      motor.current = null
      void context?.close().catch(() => {})
    }
  }, [sound])

  useEffect(() => {
    if (!motor.current) return
    const { frequency, gain, context } = motor.current
    frequency.setTargetAtTime(75 + Math.abs(telemetry.speed) * 31, context.currentTime, 0.15)
    gain.setTargetAtTime(
      powered ? 0.002 + Math.abs(telemetry.speed) * 0.0015 : 0,
      context.currentTime,
      0.2,
    )
  }, [telemetry.speed, powered])

  useEffect(() => {
    if (!panel) return
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanel(null)
        return
      }
      if (event.key !== 'Tab' || !dialog.current) return
      const focusable = [
        ...dialog.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, [tabindex="0"]',
        ),
      ]
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog.current)
      ) {
        event.preventDefault()
        last?.focus()
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      previous?.focus()
    }
  }, [panel])

  const discover = (id: string) => {
    setDiscovered((previous) => {
      if (previous.includes(id)) return previous
      const next = [...previous, id]
      try {
        localStorage.setItem('milo-discoveries', JSON.stringify(next))
      } catch {}
      return next
    })
    const landmark = landmarks.find((item) => item.id === id)
    if (landmark) setToast(`Discovered: ${landmark.name}`)
  }
  const openPanel = (next: Panel) => setPanel((current) => (current === next ? null : next))
  const takePhoto = () => {
    scene.current?.capture()
    setToast('A little memory, captured. Photo downloaded.')
  }
  const runScan = () => {
    if (powered) {
      setScan((value) => value + 1)
      setToast('Scanning the meadow...')
    }
  }
  const reset = () => {
    scene.current?.reset()
    setPaused(false)
    setToast('Back on familiar ground.')
  }
  const toggleFullscreen = () => {
    const operation = document.fullscreenElement
      ? document.exitFullscreen()
      : app.current?.requestFullscreen()
    void operation?.catch(() => setToast('Fullscreen is unavailable in this browser view.'))
  }
  const distanceLabel =
    telemetry.distance >= 1000
      ? `${(telemetry.distance / 1000).toFixed(2)} km`
      : `${Math.floor(telemetry.distance)} m`

  return (
    <div
      className="app"
      ref={app}
      data-physics={ready ? 'ready' : 'loading'}
      data-vehicle-x={telemetry.x.toFixed(3)}
      data-vehicle-z={telemetry.z.toFixed(3)}
      data-speed={telemetry.speed.toFixed(3)}
      data-contact={telemetry.contact}
    >
      <header className="app-header">
        <button className="brand" aria-label="Milo home" onClick={() => setPanel(null)}>
          <span className="brand-mark">
            <Flower2 size={31} strokeWidth={1.6} />
          </span>
          <span className="brand-name">
            milo<span className="brand-period">.</span>
          </span>
          <span className="brand-divider" />
          <span className="brand-caption">
            A small world.
            <br />A little wonder.
          </span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={panel !== 'journal' ? 'active' : ''} onClick={() => setPanel(null)}>
            <Compass size={16} /> Explore
          </button>
          <button
            className={panel === 'journal' ? 'active' : ''}
            onClick={() => openPanel('journal')}
          >
            <NotebookPen size={16} /> Field journal{' '}
            <span className="journal-count">{discovered.length}</span>
          </button>
        </nav>
        <div className="header-tools">
          <span className="day-indicator">
            <Sun size={16} />
            <span>DAY 01</span>
          </span>
          <span className="tool-divider" />
          <IconButton
            label={sound ? 'Mute ambient sound' : 'Enable ambient sound'}
            onClick={() => setSound((value) => !value)}
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </IconButton>
          <IconButton
            label="World settings"
            active={panel === 'settings'}
            onClick={() => openPanel('settings')}
          >
            <Settings2 size={18} />
          </IconButton>
          <IconButton
            label="Toggle fullscreen"
            className="fullscreen-button"
            onClick={toggleFullscreen}
          >
            <Expand size={18} />
          </IconButton>
        </div>
      </header>
      <main className="world-stage" aria-label="Interactive robot exploration">
        <SceneBoundary>
          <Canvas
            shadows={{ type: PCFShadowMap }}
            dpr={quality === 'high' ? [1, 1.75] : [1, 1.15]}
            camera={{ position: [3, 3, 8], fov: 42, near: 0.08, far: 450 }}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: 'high-performance',
              preserveDrawingBuffer: true,
            }}
            onCreated={({ gl }) => {
              gl.toneMapping = ACESFilmicToneMapping
              gl.toneMappingExposure = 0.96
            }}
            aria-label="Drivable ivory and charcoal robot in a sunlit meadow"
            fallback={
              <div className="scene-fallback" role="alert">
                <h2>A little more graphics power is needed.</h2>
                <p>Open Milo in a WebGL-enabled browser with hardware acceleration.</p>
              </div>
            }
          >
            <Suspense fallback={null}>
              <Scene
                apiRef={scene}
                touchInput={input}
                clearInput={clearDriveInput}
                onReady={() => setReady(true)}
                onError={setError}
                onTelemetry={setTelemetry}
                onDiscover={discover}
                onZoom={setZoom}
                discovered={discovered}
                powered={powered}
                lights={lights}
                hatchOpen={hatchOpen}
                onPower={() => setPowered((value) => !value)}
                onScan={runScan}
                onHatch={() => setHatchOpen((value) => !value)}
                scan={scan}
                paused={paused || panel !== null}
                evening={evening}
                cameraMode={cameraMode}
                quality={quality}
                zoom={zoom}
              />
            </Suspense>
          </Canvas>
        </SceneBoundary>
        <section className="world-location" aria-label="Current location">
          <div className="location-eyebrow">
            <span className="location-icon">
              <Sprout size={13} />
            </span>{' '}
            THE LOWLANDS <span className="location-separator">/</span> 01
          </div>
          <h1>Sunpetal Meadow</h1>
          <div className="weather-line">
            {evening ? <Moon size={14} /> : <Sun size={15} />}
            <span>{evening ? '18' : '22'}&deg;C</span>
            <span className="weather-dot" />
            <span>{evening ? 'Golden hour' : 'Gentle breeze'}</span>
          </div>
        </section>
        <HeadingCompass heading={telemetry.heading} />
        <div className="world-tools" aria-label="Scene tools">
          <IconButton label="Take a photo" onClick={takePhoto} disabled={!ready}>
            <Camera size={19} />
          </IconButton>
          <span className="vertical-divider" />
          <IconButton
            label={cameraMode === 'follow' ? 'Switch to orbit camera' : 'Switch to follow camera'}
            active={cameraMode === 'orbit'}
            onClick={() => setCameraMode((mode) => (mode === 'follow' ? 'orbit' : 'follow'))}
          >
            <Orbit size={19} />
          </IconButton>
          <IconButton label="Center camera on Milo" onClick={() => scene.current?.focus()}>
            <Focus size={19} />
          </IconButton>
          <IconButton label="Zoom in" onClick={() => setZoom((value) => Math.max(5, value - 1))}>
            <Plus size={18} />
          </IconButton>
          <IconButton label="Zoom out" onClick={() => setZoom((value) => Math.min(17, value + 1))}>
            <Minus size={18} />
          </IconButton>
        </div>
        {selectedLandmark && (
          <button className="waypoint-chip" onClick={() => setWaypoint(null)}>
            <MapPin size={14} />
            <span>{selectedLandmark.name}</span>
            <b>
              {Math.round(
                Math.hypot(telemetry.x - selectedLandmark.x, telemetry.z - selectedLandmark.z),
              )}{' '}
              m
            </b>
            <X size={12} />
          </button>
        )}
        {toast && (
          <div className="toast" role="status">
            <Leaf size={16} />
            <span>{toast}</span>
          </div>
        )}
        {paused && panel === null && (
          <div className="pause-state">
            <button onClick={() => setPaused(false)}>
              <Play size={19} fill="currentColor" /> Back to the meadow
            </button>
            <span>PAUSED</span>
          </div>
        )}
        <div className="bottom-hud">
          <Speedometer telemetry={telemetry} powered={powered} onRobot={() => openPanel('robot')} />
          <div className="drive-console" aria-label="Driving controls">
            <div className="direction-controls">
              <DriveButton
                label="Steer left (A or left arrow)"
                field="steer"
                value={1}
                onInput={updateDriveInput}
                disabled={!ready || paused || !!panel}
              >
                <ArrowLeft size={18} />
              </DriveButton>
              <div className="forward-reverse">
                <DriveButton
                  label="Drive forward (W or up arrow)"
                  field="throttle"
                  value={1}
                  onInput={updateDriveInput}
                  disabled={!ready || paused || !!panel}
                >
                  <ArrowUp size={18} />
                </DriveButton>
                <DriveButton
                  label="Reverse (S or down arrow)"
                  field="throttle"
                  value={-1}
                  onInput={updateDriveInput}
                  disabled={!ready || paused || !!panel}
                >
                  <ArrowDown size={18} />
                </DriveButton>
              </div>
              <DriveButton
                label="Steer right (D or right arrow)"
                field="steer"
                value={-1}
                onInput={updateDriveInput}
                disabled={!ready || paused || !!panel}
              >
                <ArrowRight size={18} />
              </DriveButton>
            </div>
            <span className="console-divider" />
            <div className="action-controls">
              <DriveButton
                label="Brake (Space)"
                field="brake"
                value={true}
                onInput={updateDriveInput}
                disabled={!ready || paused || !!panel}
              >
                <Octagon size={17} />
              </DriveButton>
              <DriveButton
                label="Boost (Shift)"
                field="boost"
                value={true}
                onInput={updateDriveInput}
                disabled={!ready || paused || !!panel}
              >
                <Zap size={18} />
              </DriveButton>
            </div>
          </div>
          <section className="minimap-panel" aria-label="Minimap">
            <div className="minimap-heading">
              <span>
                <Navigation size={11} /> N
              </span>
              <button aria-label="Open meadow map" onClick={() => openPanel('map')}>
                <Maximize size={13} />
              </button>
            </div>
            <button
              className="minimap-image"
              aria-label="Expand meadow map"
              onClick={() => openPanel('map')}
            >
              <Minimap telemetry={telemetry} discovered={discovered} waypoint={waypoint} />
            </button>
            <div className="map-coordinates">
              <span>
                {telemetry.x >= 0 ? 'E' : 'W'} {Math.abs(telemetry.x).toFixed(0).padStart(3, '0')}
              </span>
              <i />
              <span>
                {telemetry.z >= 0 ? 'S' : 'N'} {Math.abs(telemetry.z).toFixed(0).padStart(3, '0')}
              </span>
              <span className="map-live-dot" />
            </div>
          </section>
        </div>
        {!ready && !error && (
          <div className="loading-state" role="status">
            <Flower2 size={34} strokeWidth={1.5} />
            <span>Growing a little world...</span>
            <div className="loading-line" />
          </div>
        )}
        {error && (
          <div className="loading-state" role="alert">
            <h2>The meadow needs a moment.</h2>
            <p>{error}</p>
            <button className="text-button" onClick={() => location.reload()}>
              Try again <RotateCcw size={15} />
            </button>
          </div>
        )}
        {panel && (
          <>
            <button
              className="drawer-backdrop"
              aria-label="Close panel"
              tabIndex={-1}
              onClick={() => setPanel(null)}
            />
            <section
              className={`side-panel ${panel === 'map' ? 'map-drawer' : ''}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="panel-title"
              ref={dialog}
              tabIndex={-1}
            >
              <div className="panel-heading">
                <span className="panel-heading-icon">
                  {panel === 'journal' ? (
                    <NotebookPen size={19} />
                  ) : panel === 'settings' ? (
                    <Settings2 size={19} />
                  ) : panel === 'map' ? (
                    <Map size={19} />
                  ) : (
                    <Wrench size={19} />
                  )}
                </span>
                <h2 id="panel-title">
                  {panel === 'journal'
                    ? 'Field journal'
                    : panel === 'settings'
                      ? 'World settings'
                      : panel === 'map'
                        ? 'The Lowlands'
                        : 'Meet Milo'}
                </h2>
                <IconButton label="Close panel" onClick={() => setPanel(null)}>
                  <X size={19} />
                </IconButton>
              </div>
              {panel === 'journal' && (
                <div className="journal-content">
                  <div className="journal-summary">
                    <span className="section-eyebrow">SUNPETAL MEADOW / DAY 01</span>
                    <h3>Little discoveries.</h3>
                    <div className="journal-summary-row">
                      <span>{discovered.length} of 4 places found</span>
                      <span>{distanceLabel} wandered</span>
                    </div>
                    <div className="discovery-progress">
                      {landmarks.map((landmark) => (
                        <span
                          className={discovered.includes(landmark.id) ? 'found' : ''}
                          key={landmark.id}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="journal-list">
                    {landmarks.map((landmark, index) => {
                      const found = discovered.includes(landmark.id)
                      const LandmarkIcon =
                        landmark.icon === 'tree'
                          ? TreePine
                          : landmark.icon === 'mushroom'
                            ? Flower2
                            : landmark.icon === 'stone'
                              ? Mountain
                              : Leaf
                      return (
                        <article
                          className={`journal-entry ${found ? 'discovered' : ''}`}
                          key={landmark.id}
                        >
                          <div className="journal-art">
                            <LandmarkIcon size={37} strokeWidth={1.2} />
                            <span>0{index + 1}</span>
                            {found && <Check className="discovery-check" size={13} />}
                          </div>
                          <div className="journal-entry-content">
                            <span className="section-eyebrow">{landmark.type}</span>
                            <h3>{landmark.name}</h3>
                            {found ? (
                              <p>{landmark.description}</p>
                            ) : (
                              <span className="unexplored-label">
                                {Math.round(
                                  Math.hypot(telemetry.x - landmark.x, telemetry.z - landmark.z),
                                )}{' '}
                                m away
                              </span>
                            )}
                            <button
                              className="waypoint-link"
                              onClick={() => {
                                setWaypoint(landmark.id)
                                setPanel(null)
                              }}
                            >
                              <MapPin size={12} />{' '}
                              {waypoint === landmark.id ? 'Waypoint set' : 'Set waypoint'}
                              <ArrowUpRight size={13} />
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                  <div className="journal-footer">
                    <Sprout size={16} />
                    <span>
                      {discovered.length === 4
                        ? 'Every corner holds a little memory.'
                        : 'The best things are often the smallest.'}
                    </span>
                  </div>
                </div>
              )}
              {panel === 'settings' && (
                <div className="settings-content">
                  <fieldset>
                    <legend>TIME OF DAY</legend>
                    <div className="segmented-control">
                      <button
                        className={!evening ? 'selected' : ''}
                        aria-pressed={!evening}
                        onClick={() => setEvening(false)}
                      >
                        <Sun size={15} /> Daylight
                      </button>
                      <button
                        className={evening ? 'selected' : ''}
                        aria-pressed={evening}
                        onClick={() => setEvening(true)}
                      >
                        <Moon size={15} /> Golden hour
                      </button>
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>CAMERA</legend>
                    <div className="segmented-control">
                      <button
                        className={cameraMode === 'follow' ? 'selected' : ''}
                        aria-pressed={cameraMode === 'follow'}
                        onClick={() => setCameraMode('follow')}
                      >
                        <Navigation size={15} /> Follow
                      </button>
                      <button
                        className={cameraMode === 'orbit' ? 'selected' : ''}
                        aria-pressed={cameraMode === 'orbit'}
                        onClick={() => setCameraMode('orbit')}
                      >
                        <Orbit size={15} /> Orbit
                      </button>
                    </div>
                    <label className="range-label" htmlFor="camera-distance">
                      Camera distance <output>{zoom.toFixed(1)} m</output>
                    </label>
                    <input
                      id="camera-distance"
                      type="range"
                      min="5"
                      max="17"
                      step="0.1"
                      value={zoom}
                      onChange={(event) => setZoom(Number(event.target.value))}
                    />
                  </fieldset>
                  <fieldset>
                    <legend>RENDER QUALITY</legend>
                    <div className="segmented-control">
                      <button
                        className={quality === 'balanced' ? 'selected' : ''}
                        aria-pressed={quality === 'balanced'}
                        onClick={() => setQuality('balanced')}
                      >
                        Balanced
                      </button>
                      <button
                        className={quality === 'high' ? 'selected' : ''}
                        aria-pressed={quality === 'high'}
                        onClick={() => setQuality('high')}
                      >
                        High detail
                      </button>
                    </div>
                  </fieldset>
                  <div className="setting-toggles">
                    <label>
                      <span>
                        <Volume2 size={16} /> Ambient sound
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={sound}
                        onChange={(event) => setSound(event.target.checked)}
                      />
                    </label>
                    <label>
                      <span>
                        <Lightbulb size={16} /> Running lights
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={lights}
                        onChange={(event) => setLights(event.target.checked)}
                      />
                    </label>
                  </div>
                  <button
                    className="reset-position-button"
                    onClick={() => {
                      reset()
                      setPanel(null)
                    }}
                  >
                    <RotateCcw size={16} /> Return to the clearing
                  </button>
                  <div className="settings-meta">
                    <span>PHYSICS</span>
                    <span>Rapier / 60 Hz</span>
                    <span>WORLD</span>
                    <span>220 &times; 220 m</span>
                  </div>
                </div>
              )}
              {panel === 'robot' && (
                <div className="robot-content">
                  <div className="robot-profile">
                    <div className="profile-symbol">
                      <Sprout size={34} strokeWidth={1.3} />
                    </div>
                    <span className="section-eyebrow">MOBILE FIELD UNIT</span>
                    <h3>
                      Milo<span>01</span>
                    </h3>
                    <span className="robot-profile-status">
                      <span className={`status-dot ${!powered ? 'offline' : ''}`} />
                      {powered ? 'All systems curious' : 'Taking a little rest'}
                    </span>
                  </div>
                  <div className="robot-specs">
                    <div>
                      <span>MASS</span>
                      <strong>
                        38 <small>kg</small>
                      </strong>
                    </div>
                    <div>
                      <span>DRIVE</span>
                      <strong>
                        4 <small>wheels</small>
                      </strong>
                    </div>
                    <div>
                      <span>RANGE</span>
                      <strong>{distanceLabel}</strong>
                    </div>
                  </div>
                  <div className="robot-switches">
                    <button onClick={() => setPowered((value) => !value)} aria-pressed={powered}>
                      <Power size={18} />
                      <span>Power</span>
                      <b>{powered ? 'On' : 'Off'}</b>
                    </button>
                    <button
                      onClick={() => {
                        runScan()
                        setPanel(null)
                      }}
                      disabled={!powered}
                    >
                      <Radar size={18} />
                      <span>Area scan</span>
                      <ArrowUpRight size={16} />
                    </button>
                    <button
                      onClick={() => setHatchOpen((value) => !value)}
                      aria-pressed={hatchOpen}
                    >
                      <Wrench size={18} />
                      <span>Rear service hatch</span>
                      <b>{hatchOpen ? 'Open' : 'Closed'}</b>
                    </button>
                    <button onClick={() => setLights((value) => !value)} aria-pressed={lights}>
                      <Lightbulb size={18} />
                      <span>Running lights</span>
                      <b>{lights ? 'On' : 'Off'}</b>
                    </button>
                  </div>
                  <button
                    className="reset-position-button"
                    onClick={() => {
                      reset()
                      setPanel(null)
                    }}
                  >
                    <RotateCcw size={16} /> Back on your wheels
                  </button>
                </div>
              )}
              {panel === 'map' && (
                <div className="expanded-map">
                  <div className="map-title-row">
                    <div>
                      <span className="section-eyebrow">REGION 01</span>
                      <h3>Sunpetal Meadow</h3>
                    </div>
                    <span>
                      <Navigation size={13} /> N
                    </span>
                  </div>
                  <Minimap
                    expanded
                    telemetry={telemetry}
                    discovered={discovered}
                    waypoint={waypoint}
                  />
                  <div className="map-legend">
                    <span>
                      <i className="legend-position" /> Milo
                    </span>
                    <span>
                      <i className="legend-landmark" /> Landmark
                    </span>
                    <span>160 m</span>
                  </div>
                  <div className="map-destinations">
                    {landmarks.map((landmark) => (
                      <button
                        className={waypoint === landmark.id ? 'selected' : ''}
                        key={landmark.id}
                        onClick={() => {
                          setWaypoint(landmark.id)
                          setPanel(null)
                        }}
                      >
                        <MapPin size={15} />
                        <span>{landmark.name}</span>
                        <span>
                          {Math.round(
                            Math.hypot(telemetry.x - landmark.x, telemetry.z - landmark.z),
                          )}{' '}
                          m
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <footer className="status-bar">
        <div className="connection-status">
          <span className={`status-dot ${!powered ? 'offline' : ''}`} />
          <span>
            {!ready
              ? 'CONNECTING'
              : paused || panel
                ? 'AT REST'
                : powered
                  ? 'CONNECTED'
                  : 'STANDBY'}
          </span>
          <span className="footer-divider" />
          <span>Free roam</span>
        </div>
        <button className="discovery-link" onClick={() => openPanel('journal')}>
          <Leaf size={13} />
          <span>
            <b>{discovered.length}</b> / 4 discoveries
          </span>
          <ChevronRight size={12} />
        </button>
        <div className="session-tools">
          <span>{distanceLabel} explored</span>
          <IconButton label="Reset position (R)" onClick={reset} disabled={!ready}>
            <RotateCcw size={14} />
          </IconButton>
          <IconButton
            label={paused ? 'Resume simulation' : 'Pause simulation'}
            onClick={() => setPaused((value) => !value)}
            disabled={!ready}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </IconButton>
        </div>
      </footer>
    </div>
  )
}

export default App
