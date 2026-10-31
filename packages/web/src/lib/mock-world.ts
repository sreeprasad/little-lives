import { cellsForBox } from "./grid"
import type { Category, Entity, Mass } from "./types"

function entity(
  id: string,
  label: string,
  mythicName: string,
  category: Category,
  mass: Mass,
  box: [number, number, number, number],
): Entity {
  return {
    id,
    label,
    mythicName,
    category,
    mass,
    box,
    cells: cellsForBox(box),
    blocking: category !== "CREATURE_SPAWN",
  }
}

export const MOCK_ENTITIES: Entity[] = [
  // Spawns, sized small → large so roles become ghost, skeleton, zombie.
  entity("toy-ghost", "eraser", "The Pale Wisp", "CREATURE_SPAWN", "LIGHT", [500, 40, 560, 100]),
  entity("toy-skel", "dice", "The Rattling Bones", "CREATURE_SPAWN", "LIGHT", [720, 120, 800, 220]),
  entity("toy-zombie", "toy figure", "The Shambler", "CREATURE_SPAWN", "MEDIUM", [700, 700, 820, 820]),
  // Anchor.
  entity("mug", "coffee mug", "The Weeping Crypt", "ANCHOR", "HEAVY", [150, 700, 330, 860]),
  // Props.
  entity("notebook", "notebook", "The Leaning Tombstone", "PROP", "MEDIUM", [120, 80, 320, 330]),
  entity("sticky", "sticky notes", "The Cursed Altar", "PROP", "LIGHT", [830, 420, 930, 520]),
]

export const MOCK_COFFIN: Entity = entity(
  "pen",
  "pen",
  "The Fallen Coffin",
  "OBSTACLE",
  "MEDIUM",
  [470, 330, 560, 700],
)
