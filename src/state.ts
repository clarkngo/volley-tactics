import { PlayState } from './types';

/**
 * Serialize/deserialize play state to JSON files and URL hash
 * for seamless sharing on GitHub Pages.
 */
export function exportToJson(state: PlayState): string {
  return JSON.stringify(state, null, 2);
}

export function importFromJson(json: string): PlayState {
  const state = JSON.parse(json) as PlayState;
  if (state.version !== 1) throw new Error('Unsupported play version');
  if (!state.easing) state.easing = 'power2.inOut';
  state.players?.forEach((p) => {
    if (!p.action && p.pose) p.action = p.pose;
    if (!p.action) p.action = 'receiver';
    delete p.pose;
    p.keyframes?.forEach((kf) => {
      if ('pose' in kf) delete (kf as { pose?: unknown }).pose;
    });
  });
  state.ballPaths?.forEach((p, i) => {
    if (!p.label) p.label = `Ball ${i + 1}`;
    if (!p.color) p.color = [0xfacc15, 0x22d3ee, 0xa78bfa, 0x4ade80, 0xf472b6][i % 5];
  });
  return state;
}

export function downloadJson(state: PlayState, filename = 'play.json'): void {
  const blob = new Blob([exportToJson(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Encode play state into URL hash for sharing. */
export function encodeToHash(state: PlayState): string {
  const compressed = btoa(encodeURIComponent(exportToJson(state)));
  return `#play=${compressed}`;
}

/** Decode play state from URL hash. Returns null if no valid hash. */
export function decodeFromHash(): PlayState | null {
  const hash = window.location.hash;
  const match = hash.match(/^#play=(.+)$/);
  if (!match) return null;
  try {
    const json = decodeURIComponent(atob(match[1]));
    return importFromJson(json);
  } catch {
    return null;
  }
}

export function copyShareUrl(state: PlayState): void {
  const url = window.location.origin + window.location.pathname + encodeToHash(state);
  navigator.clipboard.writeText(url).catch(() => {
    // Fallback: prompt
    prompt('Copy this URL:', url);
  });
}
