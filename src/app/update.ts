import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * Service worker registration with `registerType: 'prompt'` (spec §4.1): a
 * new version waits until the parent applies it from the panel, so the app
 * never changes underneath the learner mid-session.
 */
let updateReady = false;
let offlineReady = false;
let applyUpdate: ((reload?: boolean) => Promise<void>) | undefined;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true;
      emit();
    },
    onOfflineReady() {
      offlineReady = true;
      emit();
    },
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUpdateReady(): boolean {
  return useSyncExternalStore(subscribe, () => updateReady);
}

export function useOfflineReady(): boolean {
  return useSyncExternalStore(subscribe, () => offlineReady);
}

export function applyAppUpdate(): void {
  void applyUpdate?.(true);
}
