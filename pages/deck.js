// The deck screen in the look picked in Settings (logic/looks.js). The parts are the same in every look
// (components/deck-parts.js); the look file in pages/looks/ arranges them and adds its own moving part.
// Built once per look; update(view) changes only what the deck's state changed. view: logic/deck-view.js.
import { createDeckParts } from '../components/deck-parts.js';
import { lookFor } from '../logic/looks.js';
import { createPocketLook, POCKET_PARTS } from './looks/pocket.js';
import { createDeckLook, DECK_PARTS } from './looks/deck.js';
import { createSportLook, SPORT_PARTS } from './looks/sport.js';
import { createBoomboxLook, BOOMBOX_PARTS } from './looks/boombox.js';

const LAYOUTS = {
  pocket: [createPocketLook, POCKET_PARTS],
  deck: [createDeckLook, DECK_PARTS],
  sport: [createSportLook, SPORT_PARTS],
  boombox: [createBoomboxLook, BOOMBOX_PARTS],
};

export function createDeckPage(dispatch, lookId) {
  const look = lookFor(lookId);
  const [layout, options] = LAYOUTS[look.id];
  const parts = createDeckParts(dispatch, look, options);
  const screen = layout(parts);

  function update(v) {
    parts.update(v);
    screen.update(v);
    // The look's one moving part runs while sound plays.
    screen.live.classList.toggle('on', v.sounding);
  }

  return { node: screen.node, look: look.id, update };
}
