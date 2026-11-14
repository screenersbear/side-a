// Keeps the screen on while recording or making a file, so the phone doesn't lock part-way (a web app stops
// recording when it does). The phone lets go of it whenever the app is hidden, so it's asked for again on return.
// want(reason, on): 'recording' and 'export' each keep it on until they're done.
export function createStayAwake(nav = globalThis.navigator, doc = globalThis.document) {
  const reasons = new Set();
  let lock = null;
  let asking = false;

  function letGo() {
    if (lock) lock.release().catch(() => {});
    lock = null;
  }

  async function hold() {
    if (lock || asking || !reasons.size || !nav || !nav.wakeLock || doc.hidden) return;
    asking = true;
    try {
      const got = await nav.wakeLock.request('screen');
      lock = got;
      got.addEventListener('release', () => {
        if (lock === got) lock = null;
      });
    } catch {
      // Not allowed (low battery, say): the screen just follows its usual timer.
      lock = null;
    }
    asking = false;
    if (!reasons.size) letGo();
  }

  doc.addEventListener('visibilitychange', () => {
    if (!doc.hidden) hold();
  });

  return {
    want(reason, on) {
      if (on) reasons.add(reason);
      else reasons.delete(reason);
      if (reasons.size) hold();
      else letGo();
    },
  };
}
