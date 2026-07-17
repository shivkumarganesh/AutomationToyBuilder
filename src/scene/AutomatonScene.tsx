import { Canvas } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import { useDesignerStore } from '../model/store'
import { useChannels } from './useChannels'
import { CrankDriver } from './CrankDriver'
import { FrameBox } from './FrameBox'
import { Camshaft } from './mechanism/Camshaft'
import { Crank } from './mechanism/Crank'
import { Cam } from './mechanism/Cam'
import { Pushrod } from './mechanism/Pushrod'
import { FigureBlock } from './character/FigureBlock'

/**
 * The 3D view, composed as the two zones joined by the frame:
 * mechanism group below the stage, character group above it.
 */
export function AutomatonScene() {
  const spec = useDesignerStore((s) => s.spec)
  const channels = useChannels()

  return (
    <Canvas shadows camera={{ position: [190, 160, 210], fov: 40 }}>
      <color attach="background" args={['#191d24']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[120, 220, 140]} intensity={1.4} />
      <directionalLight position={[-140, 90, -100]} intensity={0.4} />

      <CrankDriver />
      <FrameBox />

      {/* mechanism zone — inside the box */}
      <group name="mechanism">
        <Camshaft />
        <Crank />
        {channels.map(({ channel }) => (
          <Cam key={channel.cam.id} cam={channel.cam} x={channel.x} />
        ))}
        {channels.map((signal) => (
          <Pushrod key={signal.channel.id} signal={signal} />
        ))}
      </group>

      {/* character zone — above the stage; figures sharing a channel fan out in Z */}
      <group name="characters">
        {spec.characters.map((character) => {
          const signal = channels.find((c) => c.channel.id === character.channelId)
          if (!signal) return null
          const siblings = spec.characters.filter((c) => c.channelId === character.channelId)
          const index = siblings.indexOf(character)
          const zOffset = (index - (siblings.length - 1) / 2) * (character.depth + 4)
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

      <Grid
        position={[0, -0.01, 0]}
        args={[600, 600]}
        cellSize={20}
        cellColor="#2c333f"
        sectionSize={100}
        sectionColor="#3a4250"
        fadeDistance={550}
        infiniteGrid
      />
      <OrbitControls target={[0, 60, 0]} makeDefault />
    </Canvas>
  )
}
