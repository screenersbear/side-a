// The box that finds FM2 LOCAL's stations (HANDOFF "Bands"): the first time FM2 is asked for, and from Settings.
// It asks where the user is: the phone's location (kept to about 10 km), or a US ZIP code. Then it looks up the
// stations near there and hands them over: onFound({ where: { label }, stations }).
// A native <dialog>, like the tape menu: focus stays inside it, and Escape or Not now closes it.
import { el } from './el.js';
import { icon } from './icons.js';
import { whereAmI, placeOfZip, stationsNear } from '../data/find-local.js';
import { LOCAL_INTRO, localError } from '../logic/local-stations.js';

const LOOKING = 'Looking for stations near you…';

export function createLocalFinder({ onFound, find = { whereAmI, placeOfZip, stationsNear } }) {
  let busy = false;
  const said = el('p', { class: 'tm-said lf-said', role: 'status' });
  const here = el('button', { class: 'tm-act pri control', type: 'button', onclick: () => look(() => find.whereAmI()) }, 'Use my location');
  const zip = el('input', {
    class: 'tm-input', id: 'lf-zip', inputmode: 'numeric', autocomplete: 'postal-code', maxlength: '5',
    pattern: '[0-9]{5}', enterkeyhint: 'search', placeholder: '90210',
  });
  const go = el('button', { class: 'tm-act ink control', type: 'submit' }, 'Find');
  const form = el(
    'form',
    { class: 'lf-zip', novalidate: true, onsubmit: (e) => { e.preventDefault(); look(() => find.placeOfZip(zip.value)); } },
    el('label', { class: 'tm-q', for: 'lf-zip' }, 'Or a US ZIP code'),
    el('div', { class: 'tm-row lf-row' }, zip, go),
  );
  const later = el('button', { class: 'tm-act control', type: 'button', onclick: () => hide() }, 'Not now');
  const close = el('button', { class: 'tm-close', type: 'button', 'aria-label': 'Close', onclick: () => hide() }, icon('close'));
  const node = el(
    'dialog',
    { class: 'tape-menu local-finder', 'aria-labelledby': 'lf-title' },
    el(
      'div',
      { class: 'tm-card lf-card' },
      el('p', { class: 'lf-band control', 'aria-hidden': 'true' }, el('b', {}, 'FM2'), 'LOCAL'),
      el(
        'div',
        { class: 'tm-side' },
        el('h2', { class: 'tm-title', id: 'lf-title' }, 'Local stations'),
        el('p', { class: 'tm-meta' }, LOCAL_INTRO),
        el('div', { class: 'tm-body' }, el('div', { class: 'tm-row' }, here, later), form, said),
      ),
      close,
    ),
  );

  function hide() {
    if (node.open) node.close();
  }

  function setBusy(on) {
    busy = on;
    [here, go, zip].forEach((n) => { n.disabled = on; });
  }

  // Where first (the phone's location or the ZIP code's), then the stations near there.
  async function look(where) {
    if (busy) return;
    setBusy(true);
    said.textContent = LOOKING;
    try {
      const place = await where();
      const stations = await find.stationsNear(place);
      onFound({ where: { label: place.label }, stations });
      hide();
    } catch (error) {
      said.textContent = localError(error);
    } finally {
      setBusy(false);
    }
  }

  function open() {
    said.textContent = '';
    if (!node.open) node.showModal();
  }

  return { node, open };
}
