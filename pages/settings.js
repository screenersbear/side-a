// Settings: pick the look the deck wears. One card per look (a small cassette on the look's body colour);
// the one in use is ringed in mango. Picking one changes the deck at once; Deck goes back to it.
import { el, setPressed } from '../components/el.js';
import { icon } from '../components/icons.js';
import { createCassette } from '../components/cassette.js';
import { LOOKS } from '../logic/looks.js';

function lookCard(look, onPick) {
  const cassette = createCassette(look.cassette, { bandBig: look.bandBig });
  cassette.update({ title: 'SIDE A' });
  const inUse = el('span', { class: 'in-use' });
  const node = el(
    'button',
    { class: 'look-card', type: 'button', 'aria-pressed': 'false', onclick: () => onPick(look.id) },
    el('span', { class: 'swatch', 'aria-hidden': 'true', style: { background: look.body } }, el('span', { class: 'swatch-tape' }, cassette.node)),
    el('span', { class: 'look-name-row' }, el('span', { class: 'look-name control' }, look.name), inUse),
    el('span', { class: 'look-about' }, look.about),
  );
  return { id: look.id, node, inUse };
}

export function createSettingsPage({ onPick }) {
  const cards = LOOKS.map((look) => lookCard(look, onPick));

  const node = el(
    'section',
    { class: 'screen settings', 'aria-label': 'Settings', hidden: true },
    el(
      'div',
      { class: 'settings-top' },
      el('a', { class: 'back control', href: '#/' }, icon('back'), 'Deck'),
      el('h1', { class: 'screen-title' }, 'Settings'),
    ),
    el(
      'div',
      { class: 'settings-body' },
      el('h2', { class: 'control settings-label', id: 'look-label' }, 'Look'),
      el('p', { class: 'settings-note' }, 'Pick the player your tapes go in. Everything works the same in each.'),
      el('div', { class: 'looks', role: 'group', 'aria-labelledby': 'look-label' }, cards.map((c) => c.node)),
    ),
  );

  // Marks the look in use.
  function show(lookId) {
    for (const card of cards) {
      const on = card.id === lookId;
      setPressed(card.node, on);
      card.inUse.textContent = on ? 'In use' : '';
    }
  }

  return { node, show };
}
