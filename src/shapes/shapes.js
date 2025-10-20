// shapes.js
// Core shapes (original 10)
import { Square } from './Square.js'; // Status: Commplete *
import { Kite } from './Kite.js'; // Status: Commplete
import { Arrow } from './Arrow.js'; // Status: In Progress
import { Circle } from './Circle.js'; // Status: Commplete
import { Heart } from './Heart.js'; // Status: In Progress
import { Triangle } from './Triangle.js';
import { Ellipse } from './Ellipse.js';
import { CrescentMoon } from './CrescentMoon.js';
import { Pentagon } from './Pentagon.js'; // Status: In Progress
import { Octagon } from './Octagon.js';

// Unlockable shapes (additional 15)
import { SnowFlake } from './SnowFlake.js';
import { Butterfly } from './Butterfly.js';
import { Hourglass } from './Hourglass.js';
import { Check } from './Check.js';
import { Angel } from './Angel.js';
import { Gear } from './Gear.js';
import { IceCream } from './IceCream.js';
import { Key } from './Key.js';
import { Flower } from './Flower.js';
import { MusicNote } from './MusicNote.js';
import { PuzzlePiece } from './PuzzlePiece.js';
import { Star } from './Star.js';
import { Sun } from './Sun.js';
import { Spiral } from './Spiral.js';
import { Shapeless } from './Shapeless.js';

// Registry of all shapes
export const shapeRegistry = [
  // Original 10
  { name: 'Square', color: '#13af51ff', active: true, classRef: Square, type: 'sequence' },
  { name: 'Kite', color: '#2121a7ff', active: true, classRef: Kite, type: 'survival' },
  { name: 'Arrow', color: '#FF91A4', active: true, classRef: Arrow, type: 'survival' },
  { name: 'Circle', color: '#3399FF', active: true, classRef: Circle, type: 'survival' },
  { name: 'Heart', color: '#FF0000', active: true, classRef: Heart, type: 'sequence' },
  { name: 'Triangle', color: '#23a39b', active: true, classRef: Triangle, type: 'survival' },
  { name: 'Ellipse', color: '#00FFFF', active: true, classRef: Ellipse, type: 'objective' },
  {
    name: 'CrescentMoon',
    color: '#FFD700',
    active: true,
    classRef: CrescentMoon,
    type: 'objective',
  },
  { name: 'Pentagon', color: '#7CFC00', active: true, classRef: Pentagon, type: 'survival' },
  { name: 'Octagon', color: '#800020', active: true, classRef: Octagon, type: 'sequence' },

  // Unlockable 15
  { name: 'SnowFlake', color: '#7ad9ffff', active: true, classRef: SnowFlake, type: 'sequence' },
  { name: 'Butterfly', color: '#FF8C00', active: true, classRef: Butterfly, type: 'survival' },
  { name: 'Hourglass', color: '#9B59B6', active: true, classRef: Hourglass, type: 'objective' },
  { name: 'Check', color: '#808000', active: true, classRef: Check, type: 'sequence' },
  { name: 'Angel', color: '#FFFFFF', active: true, classRef: Angel, type: 'objective' },
  { name: 'Gear', color: '#8A8A8A', active: true, classRef: Gear, type: 'objective' },
  { name: 'IceCream', color: '#C290EC', active: true, classRef: IceCream, type: 'survival' },
  { name: 'Key', color: '#c07245ff', active: true, classRef: Key, type: 'objective' },
  { name: 'Flower', color: '#FF69B4', active: true, classRef: Flower, type: 'survival' },
  { name: 'MusicNote', color: '#000000', active: true, classRef: MusicNote, type: 'sequence' },
  {
    name: 'PuzzlePiece',
    color: '#ffbb00ff',
    active: true,
    classRef: PuzzlePiece,
    type: 'objective',
  },
  { name: 'Star', color: '#ffcf68ff', active: true, classRef: Star, type: 'survival' },
  { name: 'Sun', color: '#FF4500', active: true, classRef: Sun, type: 'sequence' },
  { name: 'Spiral', color: '#FF69B4', active: true, classRef: Spiral, type: 'survival' },
  { name: 'Shapeless', color: '#ffffff', active: true, classRef: Shapeless, type: 'survival' },
];

// Possible DLC

// Possible Event Shapes:
// Pumpkin - Halloween
// Tree - Christmas
// Turkey - Thanksgiving
// Bunny - Easter
// Candy - Valentine's Day
// Firework - Independence Day

export function getRandomShapeColor() {
  const allColors = shapeRegistry.map((s) => s.color).filter(Boolean);
  if (allColors.length === 0) return '#FFFFFF'; // fallback
  const idx = Math.floor(Math.random() * allColors.length);
  return allColors[idx];
}
