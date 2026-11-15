import { describe, it, expect } from 'vitest';
import { parseMapCommand } from '../cortex-globe';

describe('parseMapCommand — cctv-place', () => {
  it.each([
    ['find a live cctv camera near duluth georgia', 'duluth georgia'],
    ['open my cct camera on the globe in duluth georgia', 'duluth georgia'],
    ['show me a live camera around tokyo', 'tokyo'],
    ['camera near duluth georgia', 'duluth georgia'],
    ['cctv in london', 'london'],
    ['near paris france camera', 'paris france'],
    ['open the webcam by the eiffel tower', 'eiffel tower'],
  ])('"%s" → cctv-place "%s"', (text, place) => {
    const cmd = parseMapCommand(text);
    expect(cmd?.type).toBe('cctv-place');
    if (cmd?.type === 'cctv-place') expect(cmd.place).toBe(place);
  });

  it.each([
    'nearest camera',
    'closest cam',
    'next camera',
    'previous cctv',
    'focus the camera',
    'camera named Times Square',
    'show camera coverage',
  ])('"%s" stays a plain cctv command', (text) => {
    const cmd = parseMapCommand(text);
    expect(cmd?.type).toBe('cctv');
  });

  it('parses "go back" variants as back, not close/place', () => {
    for (const t of ['go back', 'back to the map', 'return to the previous view', 'take me back']) {
      expect(parseMapCommand(t)?.type).toBe('back');
    }
    // "back to the core" still closes the globe.
    expect(parseMapCommand('back to the core')?.type).toBe('close');
  });

  it('does not treat bare places as cctv-place', () => {
    expect(parseMapCommand('fly to duluth georgia')?.type).not.toBe('cctv-place');
    expect(parseMapCommand('open the map')?.type).not.toBe('cctv-place');
  });
});

describe('parseMapCommand — hardening', () => {
  it.each([
    'go to sleep',
    'where is the bathroom',
    'zoom to 50%',
    'where is the file',
    'pin the blame on the intern',
  ])('"%s" is NOT a map command', (text) => {
    expect(parseMapCommand(text)).toBeNull();
  });

  it('parses "go forward" as forward', () => {
    expect(parseMapCommand('go forward')?.type).toBe('forward');
    expect(parseMapCommand('move forward')?.type).toBe('forward');
  });

  it('"nearest camera near duluth georgia" resolves the place qualifier', () => {
    const cmd = parseMapCommand('nearest camera near duluth georgia');
    expect(cmd?.type).toBe('cctv-place');
    if (cmd?.type === 'cctv-place') expect(cmd.place).toBe('duluth georgia');
  });

  it('explicit camera commands beat place parsing', () => {
    expect(parseMapCommand('focus the camera in the kitchen')?.type).toBe('cctv');
    expect(parseMapCommand('camera named lobby-cam')?.type).toBe('cctv');
  });

  it('strips trailing politeness from cctv-place', () => {
    const cmd = parseMapCommand('camera near duluth please');
    expect(cmd?.type).toBe('cctv-place');
    if (cmd?.type === 'cctv-place') expect(cmd.place).toBe('duluth');
  });

  it('real places still parse after the non-geo guard', () => {
    expect(parseMapCommand('go to tokyo')?.type).toBe('open');
    expect(parseMapCommand('where is paris')?.type).toBe('open');
  });

  it('artifact intents never geocode as pin-place', () => {
    expect(parseMapCommand('pin a stat panel that says TEST VALUE 42')).toBeNull();
    expect(parseMapCommand('pin a stat panel that says VISUAL CHECK 99')).toBeNull();
    expect(parseMapCommand('pin a chart of my week')).toBeNull();
    // "drop a pin on the dashboard" may still bare-pin the globe view, but
    // it must never geocode "the dashboard" as a destination.
    expect(parseMapCommand('drop a pin on the dashboard')?.type).not.toBe('pin-place');
    expect(parseMapCommand('pin a panel that shows my score')).toBeNull();
  });

  it('parses bare map open commands with conversational prefixes', () => {
    for (const t of [
      'open the map',
      'I can go ahead and open up the map',
      'can you open up the map',
      'go ahead and open the map',
      'can we open the map',
      'lets open the map',
      'let\'s open the map',
      'bring up the globe',
    ]) {
      const cmd = parseMapCommand(t);
      expect(cmd?.type).toBe('open-blank');
    }
  });

  it('real pin-place commands still parse', () => {
    const cmd = parseMapCommand('drop a pin on tokyo');
    expect(cmd?.type).toBe('pin-place');
    if (cmd?.type === 'pin-place') expect(cmd.place).toBe('tokyo');
    expect(parseMapCommand('pin duluth georgia')?.type).toBe('pin-place');
  });

  it('exact address parsing & view altitude scaling', () => {
    const cmd1 = parseMapCommand('fly to 350 5th Ave, New York, NY');
    expect(cmd1?.type).toBe('open');
    if (cmd1?.type === 'open') expect(cmd1.place).toContain('350 5th Ave');

    const cmd2 = parseMapCommand('take me to 1600 Pennsylvania Ave NW, Washington DC');
    expect(cmd2?.type).toBe('open');
    if (cmd2?.type === 'open') expect(cmd2.place).toContain('1600 Pennsylvania');

    const cmd3 = parseMapCommand('where is 10 Downing Street, London');
    expect(cmd3?.type).toBe('open');
    if (cmd3?.type === 'open') expect(cmd3.place).toContain('10 Downing Street');
  });
});
