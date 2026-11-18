import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioService, PROMPT_GAP_MS } from '@/audio/AudioService';

describe('pause between a direction and its target audio', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits a clear gap after the direction before playing the target', async () => {
    vi.useFakeTimers();
    const service = new AudioService();
    const events: string[] = [];
    vi.spyOn(service, 'playPrompt').mockImplementation(async () => {
      events.push('prompt');
      return true;
    });
    const done = service.playPromptThen('pr_build_word', async () => {
      events.push('target');
    });

    await vi.advanceTimersByTimeAsync(PROMPT_GAP_MS - 1);
    expect(events).toEqual(['prompt']); // still silent just before the gap ends
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(events).toEqual(['prompt', 'target']);
    expect(PROMPT_GAP_MS).toBeGreaterThanOrEqual(600);
  });

  it('plays the target at once when no direction could be played', async () => {
    vi.useFakeTimers();
    const service = new AudioService();
    vi.spyOn(service, 'playPrompt').mockResolvedValue(false);
    const target = vi.fn(async () => undefined);
    await service.playPromptThen('pr_build_word', target);
    expect(target).toHaveBeenCalledOnce();
  });
});
