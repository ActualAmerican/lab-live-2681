// src/minigames/miniGames.js
import SimonSays from './SimonSays.js';
import SilhouetteMatch from './SilhouetteMatch.js';
import TargetPractice from './TargetPractice.js';
import Match2 from './Match2.js';
import SpinStop from './SpinStop.js';

export const miniGameRegistry = [
  { name: 'SimonSays', classRef: SimonSays, active: true },
  { name: 'SilhouetteMatch', classRef: SilhouetteMatch, active: true },
  { name: 'TargetPractice', classRef: TargetPractice, active: true },
  { name: 'Match2', classRef: Match2, active: true },
  { name: 'SpinStop', classRef: SpinStop, active: true },
];
