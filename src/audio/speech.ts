/**
 * Device-voice fallback for WHOLE WORDS AND PROMPTS ONLY (spec §12). It is
 * never used for single sounds: synthesized phonemes teach the wrong sound.
 * Enabled in development builds, or when the parent opts in for clips that
 * have not been recorded yet.
 */
const SPEECH_TIMEOUT_MS = 6000;

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string): Promise<void> {
  if (!canSpeak()) return Promise.resolve();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.lang = 'en-US';
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    // Some engines never fire "end"; the timeout keeps the app moving.
    const timer = window.setTimeout(finish, SPEECH_TIMEOUT_MS);
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
