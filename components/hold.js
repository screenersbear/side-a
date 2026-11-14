// A button that does one thing when tapped and another when held down for a second, like a car radio's preset
// keys. Works with a finger, a mouse, and Enter or Space held down.
export const HOLD_MS = 1000;

// onTap(): a quick press. onHold(): held for `ms`; letting go afterwards does nothing more.
export function makeHoldable(button, { onTap, onHold, ms = HOLD_MS }) {
  let timer = 0;
  let held = false; // the hold went off, so the click that ends it isn't a tap
  let keyTapped = false; // a key just tapped it, so a click the browser adds isn't a second tap

  function start() {
    clearTimeout(timer);
    held = false;
    timer = setTimeout(() => {
      timer = 0;
      held = true;
      onHold();
    }, ms);
  }

  // Let go: true if it was let go before the hold went off.
  function release() {
    const early = timer !== 0;
    clearTimeout(timer);
    timer = 0;
    return early;
  }

  button.addEventListener('pointerdown', (e) => {
    if (e.button === 0) start();
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) button.addEventListener(type, release);
  // A long press would otherwise open the phone's menu for the button.
  button.addEventListener('contextmenu', (e) => e.preventDefault());
  button.addEventListener('click', () => {
    if (held || keyTapped) {
      held = false;
      keyTapped = false;
      return;
    }
    onTap();
  });

  // Keys press it when they're let go, so holding one can be told from a tap.
  const pressKey = (e) => e.key === 'Enter' || e.key === ' ';
  button.addEventListener('keydown', (e) => {
    if (!pressKey(e)) return;
    e.preventDefault();
    if (!e.repeat) start();
  });
  button.addEventListener('keyup', (e) => {
    if (!pressKey(e)) return;
    e.preventDefault();
    if (!release()) return;
    keyTapped = true;
    setTimeout(() => {
      keyTapped = false;
    });
    onTap();
  });
}
