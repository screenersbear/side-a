// The four looks the deck can wear (picked in Settings). Every look has the same controls; only the body changes.
// Colours are from the mockups (SIDE A mockup handoff, Skin*.dc.html and SettingsPanel.dc.html).

const INK = '#29323A';
const PAPER = '#FAFAF7';
const WINDOW = { win: INK, pack: '#7C868C', hub: PAPER };

export const LOOKS = [
  {
    id: 'pocket', name: 'Pocket', about: 'White Walkman, oval window', body: '#FAFAF7', bandBig: false,
    cassette: { shell: '#C9D0CC', label: PAPER, band: '#E8322B', ink: INK, ...WINDOW },
  },
  {
    id: 'deck', name: 'Deck', about: 'Home deck, wide keys', body: '#E3E8E4', bandBig: true,
    cassette: { shell: '#B9C1BC', label: PAPER, band: '#FF8A3D', ink: INK, ...WINDOW },
  },
  {
    id: 'sport', name: 'Sport', about: 'Yellow sport, EQ sliders', body: '#FFD100', bandBig: false,
    cassette: { shell: '#3A434B', label: PAPER, band: '#3DDC4A', ink: INK, ...WINDOW },
  },
  {
    id: 'boombox', name: 'Boombox', about: 'Pink boombox, dot speaker', body: '#FFAFAB', bandBig: false,
    cassette: { shell: PAPER, label: '#0A4FD6', band: '#FFAFAB', ink: PAPER, ...WINDOW },
  },
];

// The look with this id, or Pocket (the first) for anything unknown.
export function lookFor(id) {
  return LOOKS.find((look) => look.id === id) || LOOKS[0];
}
