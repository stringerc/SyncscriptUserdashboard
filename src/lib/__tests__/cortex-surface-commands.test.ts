import { describe, it, expect, beforeEach } from 'vitest';
import { runSurfaceCommand, surfaceManifestSuffix } from '../cortex-surface-commands';
import {
  openSurfacePanel, clearSurfacePanels, getSurfaceSnapshot,
} from '../cortex-surfaces';
import type { CortexArtifact } from '../cortex-artifacts';

const imgArt = (title: string): CortexArtifact =>
  ({ kind: 'image', title, url: 'https://x.test/i.png', source: 'test' }) as CortexArtifact;
const statArt = (title: string): CortexArtifact =>
  ({ kind: 'stat', title, value: '42', source: 'test' }) as CortexArtifact;

beforeEach(() => clearSurfacePanels());

describe('grammar hijack guards', () => {
  it.each([
    'keep it short',
    'keep this in mind',
    'pin this down',
    'keep the change',
  ])('"%s" falls through to the LLM', async (text) => {
    expect(await runSurfaceCommand(text)).toBeNull();
  });

  it('"save this file to disk" with no panels reaches the LLM', async () => {
    expect(await runSurfaceCommand('save this file to disk')).toBeNull();
    expect(await runSurfaceCommand('save it to downloads')).toBeNull();
  });

  it('long freeform "remember that X" is not captured as artifact memory', async () => {
    openSurfacePanel({ kind: 'artifact', title: 'chart', artifact: statArt('chart') });
    expect(await runSurfaceCommand('remember that the deploy failed at 3pm put it in my notes')).toBeNull();
  });
});

describe('real commands still fire', () => {
  it('"save it to downloads" works when a panel exists', async () => {
    openSurfacePanel({ kind: 'artifact', title: 'chart', artifact: statArt('chart') });
    const reply = await runSurfaceCommand('save it to downloads');
    expect(reply).not.toBeNull();
  });

  it('"pin that" pins the last artifact when no panel matches', async () => {
    const p = openSurfacePanel({ kind: 'artifact', title: 'my chart', artifact: statArt('my chart') })!;
    const reply = await runSurfaceCommand('pin that');
    expect(reply).toContain('Pinned');
    expect(getSurfaceSnapshot().panels.find((x) => x.id === p.id)!.pinned).toBe(true);
  });

  it('"move it to the middle" docks center', async () => {
    openSurfacePanel({ kind: 'artifact', title: 'chart', artifact: statArt('chart') });
    const reply = await runSurfaceCommand('move it to the middle');
    expect(reply).toContain('center');
  });

  it('"pin the web app" pins active project with web payload', async () => {
    const reply = await runSurfaceCommand('pin the web app');
    expect(reply).toContain('Pinned');
    const panel = getSurfaceSnapshot().panels.find((p) => p.kind === 'web');
    expect(panel).toBeDefined();
    expect(panel?.pinned).toBe(true);
    expect(panel?.web?.url).toContain('/sandbox/');
  });

  it('"pin the spreadsheet" pins sheet with tabular data', async () => {
    const reply = await runSurfaceCommand('pin the spreadsheet');
    expect(reply).toContain('Pinned');
    const panel = getSurfaceSnapshot().panels.find((p) => p.kind === 'sheet');
    expect(panel).toBeDefined();
    expect(panel?.pinned).toBe(true);
    expect(panel?.sheet?.rows.length).toBeGreaterThan(0);
  });
});

describe('empty-surface honesty', () => {
  it('"where are my panels" with zero panels answers honestly, not via LLM', async () => {
    const reply = await runSurfaceCommand('where are my panels?');
    expect(reply).toContain('No panels open');
  });

  it('"move the panel to the top right" with zero panels says so', async () => {
    const reply = await runSurfaceCommand('move the panel to the top right');
    expect(reply).toContain('nothing to move');
  });

  it('"where are my panels" with panels lists locations', async () => {
    openSurfacePanel({ kind: 'artifact', title: 'chart', artifact: statArt('chart') });
    const reply = await runSurfaceCommand('where are my panels?');
    expect(reply).toContain('chart');
  });
});

describe('close/remove single panel', () => {
  it('"remove the neon atom picture" closes the matching image panel', async () => {
    const p = openSurfacePanel({ kind: 'artifact', title: 'Neon Atom', artifact: imgArt('Neon Atom') })!;
    const reply = await runSurfaceCommand('can you remove picture of a neon atom');
    expect(reply).toContain('Removed');
    expect(getSurfaceSnapshot().panels.find((x) => x.id === p.id)).toBeUndefined();
  });

  it('"close the chart" closes by kind word', async () => {
    const p = openSurfacePanel({ kind: 'artifact', title: 'weekly', artifact: statArt('weekly') })!;
    const reply = await runSurfaceCommand('close the chart');
    expect(reply).toContain("don't see a panel");
    expect(getSurfaceSnapshot().panels.find((x) => x.id === p.id)).toBeDefined();
  });

  it('ambiguous ref asks which one instead of guessing', async () => {
    openSurfacePanel({ kind: 'artifact', title: 'Neon Atom', artifact: imgArt('Neon Atom') });
    openSurfacePanel({ kind: 'artifact', title: 'Neon City', artifact: imgArt('Neon City') });
    const reply = await runSurfaceCommand('remove the neon picture');
    expect(reply).toContain('Which one');
    expect(getSurfaceSnapshot().panels.length).toBe(2);
  });

  it('non-panel deletes still reach the LLM', async () => {
    openSurfacePanel({ kind: 'artifact', title: 'chart', artifact: statArt('chart') });
    expect(await runSurfaceCommand('delete the file from disk')).toBeNull();
    expect(await runSurfaceCommand('close the chat window')).toBeNull();
  });

  it('"close the map" is not hijacked as a panel close', async () => {
    openSurfacePanel({ kind: 'map', title: 'Map view', artifact: { kind: 'map', title: 'Map view', source: 'test' } as CortexArtifact });
    expect(await runSurfaceCommand('close the map')).toBeNull();
    expect(getSurfaceSnapshot().panels.length).toBe(1);
  });

  it('"can you close the pinned items" closes all pinned items and panels', async () => {
    openSurfacePanel({ kind: 'sheet', title: 'Financial Model', pinned: true });
    openSurfacePanel({ kind: 'web', title: 'Sample Website', pinned: true });
    expect(getSurfaceSnapshot().panels.length).toBe(2);
    const reply = await runSurfaceCommand('can you close the pinned items');
    expect(reply).toContain('Closed all pinned items and panels');
    expect(getSurfaceSnapshot().panels.length).toBe(0);
  });

  it('"close the pins" clears the surface', async () => {
    openSurfacePanel({ kind: 'sheet', title: 'Financial Model', pinned: true });
    const reply = await runSurfaceCommand('close the pins');
    expect(reply).toContain('Closed all pinned items and panels');
    expect(getSurfaceSnapshot().panels.length).toBe(0);
  });
});

describe('custom camera URLs', () => {
  it('preserves URL casing (signed/query URLs must not be lowercased)', async () => {
    const reply = await runSurfaceCommand(
      'watch camera https://Example.com/live/sig=AbC123X/stream.m3u8',
    );
    expect(reply).not.toBeNull();
    const panel = getSurfaceSnapshot().panels.find((p) => p.kind === 'cctv');
    expect(panel?.cctv?.url).toBe('https://Example.com/live/sig=AbC123X/stream.m3u8');
  });

  it('two cameras with same title but different URLs do not dedupe', async () => {
    await runSurfaceCommand('watch camera https://a.test/one.m3u8');
    await runSurfaceCommand('watch camera https://b.test/two.m3u8');
    const cams = getSurfaceSnapshot().panels.filter((p) => p.kind === 'cctv');
    expect(cams.length).toBe(2);
  });
});

describe('surfaceManifestSuffix', () => {
  it('returns empty string with no panels', () => {
    expect(surfaceManifestSuffix()).toBe('');
  });

  it('lists panels with sanitized titles', () => {
    openSurfacePanel({ kind: 'artifact', title: 'weird "title"\nline', artifact: imgArt('x') });
    const suffix = surfaceManifestSuffix();
    expect(suffix).toContain('LIVE SURFACE STATE');
    expect(suffix).not.toContain('\nline');
  });
});

describe('Website & Financial Model Pinning', () => {
  it('pins a sample site when requested by voice', async () => {
    const res = await runSurfaceCommand('pin a sample site');
    expect(res).toContain('Pinned Web — Sample Website to the surface');

    const panels = getSurfaceSnapshot().panels;
    const webPanel = panels.find((p) => p.kind === 'web');
    expect(webPanel).toBeDefined();
    expect(webPanel?.web?.url).toBe('/sandbox/sample-website/index.html');
    expect(webPanel?.pinned).toBe(true);
    expect(webPanel?.customSize?.w).toBe(540);
  });

  it('pins financial model with full column visibility and expanded width', async () => {
    const res = await runSurfaceCommand('pin financial model');
    expect(res).toContain('Financial Model & Unit Economics');

    const panels = getSurfaceSnapshot().panels;
    const sheetPanel = panels.find((p) => p.kind === 'sheet');
    expect(sheetPanel).toBeDefined();
    expect(sheetPanel?.sheet?.columns).toContain('Status');
    expect(sheetPanel?.customSize?.w).toBe(520);
  });

  it('pins email inbox for stringer.c.a@gmail.com when requested by voice', async () => {
    const res = await runSurfaceCommand('can you open up my email inbox for stringer.c.a@gmail.com as pinned on the space?');
    expect(res).toContain('opened and pinned your email inbox for stringer.c.a@gmail.com');

    const panels = getSurfaceSnapshot().panels;
    const inboxPanel = panels.find((p) => p.kind === 'inbox');
    expect(inboxPanel).toBeDefined();
    expect(inboxPanel?.inbox?.account).toBe('stringer.c.a@gmail.com');
    expect(inboxPanel?.pinned).toBe(true);
    expect(inboxPanel?.inbox?.unreadCount).toBe(22825);
    expect(inboxPanel?.inbox?.threads.some((t) => t.from.includes('Capital One') || t.from.includes('Johnson'))).toBe(true);
  });

  it('populates inbox with real emails when requested', async () => {
    const res = await runSurfaceCommand('ok but those aren\'t my real emails. can you populate it with all my real emails so we can use cortex to go through them and reduce the amount i have?');
    expect(res).toContain('populated your pinned email inbox with your live messages');
    expect(res).toContain('22,825 unread emails');
    expect(res).toContain('stringer.c.a@gmail.com');

    const panels = getSurfaceSnapshot().panels;
    const inboxPanel = panels.find((p) => p.kind === 'inbox');
    expect(inboxPanel).toBeDefined();
    expect(inboxPanel?.inbox?.unreadCount).toBe(22825);
  });

  it('triggers reduction triage for promotional backlog', async () => {
    const res = await runSurfaceCommand('reduce the amount of promotional emails i have');
    expect(res).toContain('promotional purge');
    expect(res).toContain('14,200 promotional emails');
  });

  it('opens an email in a new pin when requested', async () => {
    const res = await runSurfaceCommand('open Demetria Johnson\'s email in a new pin');
    expect(res).toContain('opened and pinned the email from Johnson, Demetria');

    const panels = getSurfaceSnapshot().panels;
    const emailPanel = panels.find((p) => p.kind === 'email');
    expect(emailPanel).toBeDefined();
    expect(emailPanel?.pinned).toBe(true);
    expect(emailPanel?.email?.from).toContain('djohnson@fultoncourt.gov');
    expect(emailPanel?.email?.subject).toContain('Bench Trial Calendar');
    expect(emailPanel?.email?.attachments?.length).toBeGreaterThan(0);
  });

  it('opens an email attachment document in a new pin when requested', async () => {
    const res = await runSurfaceCommand('open the mandatory reporting document in a new pin');
    expect(res).toContain('opened and pinned the document "Mandatory_Reporting_Form_Bench_Trial_Div5.pdf"');

    const panels = getSurfaceSnapshot().panels;
    const docPanel = panels.find((p) => p.kind === 'document' && p.document?.fileName.includes('Mandatory_Reporting'));
    expect(docPanel).toBeDefined();
    expect(docPanel?.pinned).toBe(true);
    expect(docPanel?.document?.content).toContain('CIVIL / DOMESTIC BENCH TRIAL MANDATORY REPORTING NOTICE');
    expect(docPanel?.document?.content).toContain('Wednesday, November 18, 2026, at 12:00 PM');
  });
});
