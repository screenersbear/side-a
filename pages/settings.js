// Settings: pick the look the deck wears. One card per look (a small cassette on the look's body colour);
// the one in use is ringed in mango. Picking one changes the deck at once; Deck goes back to it.
// Key clicks: On / Off (HANDOFF "Depth pass"; on by default). Local stations: where FM2 LOCAL finds its stations,
// and a key to change it (HANDOFF "Bands").
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

// The local stations row says where FM2's stations are from.
function whereText(label) {
  if (label === null) return 'FM2 plays the stations near you. Not set up yet.';
  return label ? `FM2 plays the stations near ${label}.` : 'FM2 plays the stations near your location.';
}

export function createSettingsPage({ onPick, onClicks, onLocal }) {
  const cards = LOOKS.map((look) => lookCard(look, onPick));
  const choice = (on, text) => el('button', { class: 'choice control', type: 'button', 'aria-pressed': 'false', onclick: () => onClicks(on) }, text);
  const clicksOn = choice(true, 'On');
  const clicksOff = choice(false, 'Off');
  const whereNote = el('p', { class: 'settings-note' }, whereText(null));
  const whereKey = el('button', { class: 'choice control', type: 'button', onclick: () => onLocal() }, 'Set up');

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
      // Key clicks and Local stations side by side, so Settings fits a phone held sideways.
      el(
        'div',
        { class: 'settings-rows' },
        el(
          'div',
          { class: 'clicks-row' },
          el(
            'div',
            {},
            el('h2', { class: 'control settings-label', id: 'clicks-label' }, 'Key clicks'),
            el('p', { class: 'settings-note' }, 'A short mechanical click when you press a key, like a real deck.'),
          ),
          el('div', { class: 'choices', role: 'group', 'aria-labelledby': 'clicks-label' }, clicksOn, clicksOff),
        ),
        el(
          'div',
          { class: 'clicks-row' },
          el('div', {}, el('h2', { class: 'control settings-label' }, 'Local stations'), whereNote),
          el('div', { class: 'choices' }, whereKey),
        ),
      ),
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

  // Marks whether keys click.
  function showClicks(on) {
    setPressed(clicksOn, on);
    setPressed(clicksOff, !on);
  }

  // Where FM2's stations are from: a place's name, '' for the phone's location, null before it's set up.
  function showLocal(label) {
    whereNote.textContent = whereText(label);
    whereKey.textContent = label === null ? 'Set up' : 'Change';
  }

  return { node, show, showClicks, showLocal };
}
