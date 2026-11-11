import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useDesignerStore } from '../model/store'
import { camWorldX } from '../model/types'
import { useChannels } from './useChannels'
import { CrankDriver } from './CrankDriver'
import { FrameBox } from './FrameBox'
import { Camshaft } from './mechanism/Camshaft'
import { Crank } from './mechanism/Crank'
import { Cam } from './mechanism/Cam'
import { GearTrain } from './mechanism/GearTrain'
import { Pushrod } from './mechanism/Pushrod'
import { Rocker } from './mechanism/Rocker'
import { Spinner } from './mechanism/Spinner'
import { Linkage } from './mechanism/Linkage'
import { FigureBlock } from './character/FigureBlock'
import { ArticulatedFigure } from './character/ArticulatedFigure'
import { SilhouetteFigure } from './character/SilhouetteFigure'
import { Prop } from './scenery/Prop'
import { FlyerFigure } from './character/FlyerFigure'
import { Workbench, WoodFinish } from './Workshop'
import { SoundDriver } from './SoundDriver'
import { GeometryJanitor, Rig, StudioLight, ZoomBridge } from './Studio'

/**
 * The 3D view, composed as the two zones joined by the frame:
 * mechanism group below the stage, character group above it.
 */
export function AutomatonScene({ studio = false }: { studio?: boolean }) {
  const spec = useDesignerStore((s) => s.spec)
  const channels = useChannels()
  // bounding radius of the toy, for the opening shot and the zoom limits
  const [radius] = useState(() => {
    const f = spec.frame
    return Math.hypot(f.width / 2 + 45, (f.height + 90) / 2, f.depth / 2 + 20)
  })
  const [target] = useState<[number, number, number]>(() => [0, (spec.frame.height + 60) / 2, 0])
  // flyers are top-view creatures: open looking down on them (the camera
  // is only placed on mount, so orbiting is never overridden)
  const [startCamera] = useState<[number, number, number]>(() => {
    if (!studio)
      return spec.characters.some((c) => c.kind === 'flyer') ? [150, 330, 215] : [215, 185, 250]
    // studio: about 3.2 × R out, tilted slightly down, whole toy on screen
    const flyer = spec.characters.some((c) => c.kind === 'flyer')
    const dir = flyer ? [0.38, 0.72, 0.58] : [0.56, 0.42, 0.72]
    const len = Math.hypot(dir[0], dir[1], dir[2])
    const d = 3.2 * radius
    return [(dir[0] / len) * d, target[1] + (dir[1] / len) * d, (dir[2] / len) * d]
  })

  const content = (
    <>
      <CrankDriver />
      <SoundDriver signals={channels} />
      <group name="frame">
        <FrameBox />
      </group>

      {/* mechanism zone — inside the box */}
      <group name="mechanism">
        <Camshaft />
        <Crank />
        {spec.mechanism.gearTrain && (
          <GearTrain
            gear={spec.mechanism.gearTrain}
            x={camWorldX(spec.frame, spec.mechanism.gearTrain.position)}
          />
        )}
        {spec.mechanism.cams.map((cam) => (
          <Cam key={cam.id} cam={cam} x={camWorldX(spec.frame, cam.position)} />
        ))}
        {channels.map((signal) => {
          switch (signal.kind) {
            case 'lift':
              return <Pushrod key={signal.channel.id} signal={signal} />
            case 'tilt':
              return <Rocker key={signal.channel.id} signal={signal} />
            case 'spin':
              return <Spinner key={signal.channel.id} signal={signal} />
            case 'path':
              return <Linkage key={signal.channel.id} signal={signal} />
          }
        })}
      </group>

      {/* character zone — above the stage; figures sharing a channel fan out in Z */}
      <group name="characters">
        {spec.characters.map((character) => {
          const signal = channels.find((c) => c.channel.id === character.channelId)
          if (!signal) return null
          const siblings = spec.characters.filter((c) => c.channelId === character.channelId)
          const index = siblings.indexOf(character)
          const zOffset = (index - (siblings.length - 1) / 2) * (character.depth + 4)
          if (character.kind === 'flyer') {
            return <FlyerFigure key={character.id} character={character} signals={channels} />
          }
          if (character.kind === 'silhouette') {
            return (
              <SilhouetteFigure
                key={character.id}
                character={character}
                signal={signal}
                zOffset={zOffset}
              />
            )
          }
          if (character.kind === 'articulated') {
            return (
              <ArticulatedFigure
                key={character.id}
                character={character}
                signals={channels}
                zOffset={zOffset}
              />
            )
          }
          return (
            <FigureBlock
              key={character.id}
              character={character}
              signal={signal}
              zOffset={zOffset}
            />
          )
        })}
      </group>

      {/* scenery — static plates in the front/back rows of the stage */}
      <group name="scenery">
        {(spec.props ?? []).map((prop) => (
          <Prop key={prop.id} prop={prop} />
        ))}
      </group>

    </>
  )

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: startCamera, fov: 40, near: 5, far: 6000 }}
      style={{ userSelect: 'none' }}
    >
      <color attach="background" args={[studio ? '#e7e8ea' : '#231a13']} />
      {studio ? <StudioLight /> : <Workbench />}
      <WoodFinish shadeSides={studio} />
      {studio && <GeometryJanitor />}
      {studio && <ZoomBridge home={3.2 * radius} />}
      {studio ? <Rig>{content}</Rig> : content}
      {studio ? (
        <OrbitControls
          target={target}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={1.2 * radius}
          maxDistance={8 * radius}
          maxPolarAngle={Math.PI * 0.5 - 0.02}
        />
      ) : (
        <OrbitControls
          target={[0, 72, 0]}
          makeDefault
          maxPolarAngle={Math.PI / 2 - 0.03}
          minDistance={120}
          maxDistance={900}
        />
      )}
    </Canvas>
  )
}
