import { useSyncExternalStore } from 'react';

/**
 * Minimal hash router (spec §4.4): static hosts need no rewrite rules.
 *   #/  ·  #/solo  ·  #/shelf  ·  #/coach  ·  #/coach/read/:id  ·  #/parent/*
 */
function currentPath(): string {
  const hash = window.location.hash.replace(/^#/u, '');
  return hash.startsWith('/') ? hash : '/';
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

export function useRoute(): string {
  return useSyncExternalStore(subscribe, currentPath);
}

export function navigate(path: string): void {
  window.location.hash = path;
}

/** Match "/coach/read/:id" style patterns. Returns params, or undefined. */
export function matchRoute(pattern: string, path: string): Record<string, string> | undefined {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  const wildcard = patternParts[patternParts.length - 1] === '*';
  if (wildcard) patternParts.pop();
  if (
    wildcard ? pathParts.length < patternParts.length : pathParts.length !== patternParts.length
  ) {
    return undefined;
  }
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const expected = patternParts[i] ?? '';
    const actual = pathParts[i] ?? '';
    if (expected.startsWith(':')) params[expected.slice(1)] = decodeURIComponent(actual);
    else if (expected !== actual) return undefined;
  }
  if (wildcard) params.rest = pathParts.slice(patternParts.length).join('/');
  return params;
}
