import { vi } from "vitest";

let messageIdCounter = 0;

export function resetQstashMock() {
  messageIdCounter = 0;
}

export function nextMessageId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
}

export function createQstashMock() {
  return {
    Client: vi.fn().mockImplementation(() => ({
      publishJSON: vi.fn().mockResolvedValue({ messageId: nextMessageId() }),
      messages: {
        delete: vi.fn().mockResolvedValue(undefined),
      },
      schedules: {
        create: vi.fn().mockResolvedValue({ scheduleId: `sched-${nextMessageId()}` }),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    })),
  };
}
