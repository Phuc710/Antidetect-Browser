import { describe, it, expect } from 'vitest';
import type { ProfileRuntimeEvent, ProfileRuntimeSnapshot } from 'shared';

function processRuntimeEvent(
  currentSnapshot: ProfileRuntimeSnapshot | undefined,
  event: ProfileRuntimeEvent
): ProfileRuntimeSnapshot {
  if (!currentSnapshot) {
    return {
      profileId: event.profileId,
      browserSessionId: event.browserSessionId,
      sequence: event.sequence,
      state: event.state,
      occurredAt: event.occurredAt,
      engine: 'chromium',
      distribution: 'chromium',
      channel: 'stable',
      browserVersion: 'latest',
      architecture: 'x64',
    };
  }

  // Reject out-of-order events with older sequence numbers
  if (event.sequence < currentSnapshot.sequence) {
    return currentSnapshot;
  }

  return {
    ...currentSnapshot,
    profileId: event.profileId,
    browserSessionId: event.browserSessionId,
    sequence: event.sequence,
    state: event.state,
    occurredAt: event.occurredAt,
  };
}

describe('Runtime Event Sequence Ordering Unit Tests', () => {
  it('should accept newer sequence events', () => {
    const initial: ProfileRuntimeSnapshot = {
      profileId: 'p1',
      browserSessionId: 's1',
      sequence: 2,
      state: 'starting',
      occurredAt: '2026-07-18T10:00:00Z',
      engine: 'chromium',
      distribution: 'chromium',
      channel: 'stable',
      browserVersion: 'latest',
      architecture: 'x64',
    };

    const nextEvent: ProfileRuntimeEvent = {
      profileId: 'p1',
      browserSessionId: 's1',
      sequence: 3,
      state: 'running',
      occurredAt: '2026-07-18T10:00:01Z',
    };

    const updated = processRuntimeEvent(initial, nextEvent);
    expect(updated.sequence).toBe(3);
    expect(updated.state).toBe('running');
  });

  it('should reject older out-of-order sequence events', () => {
    const initial: ProfileRuntimeSnapshot = {
      profileId: 'p1',
      browserSessionId: 's1',
      sequence: 5,
      state: 'running',
      occurredAt: '2026-07-18T10:00:05Z',
      engine: 'chromium',
      distribution: 'chromium',
      channel: 'stable',
      browserVersion: 'latest',
      architecture: 'x64',
    };

    const staleEvent: ProfileRuntimeEvent = {
      profileId: 'p1',
      browserSessionId: 's1',
      sequence: 2, // Stale sequence
      state: 'starting',
      occurredAt: '2026-07-18T10:00:01Z',
    };

    const updated = processRuntimeEvent(initial, staleEvent);
    expect(updated.sequence).toBe(5); // Retained newer sequence
    expect(updated.state).toBe('running'); // Retained running state
  });
});
