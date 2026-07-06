import { vi } from "vitest";
import type { LineMessage } from "@/lib/line/client";

type SentMessage = {
  userId: string;
  token?: string;
  messages: LineMessage[];
};

const sent: SentMessage[] = [];

export function resetLineMock() {
  sent.length = 0;
}

export function lastSent(): SentMessage | undefined {
  return sent[sent.length - 1];
}

export function allSent(): SentMessage[] {
  return [...sent];
}

export function createLineMock() {
  return {
    replyOrPush: vi.fn(async (userId: string, token: string, messages: LineMessage[]) => {
      sent.push({ userId, token, messages });
      return "sent";
    }),
    push: vi.fn(async (userId: string, messages: LineMessage[]) => {
      sent.push({ userId, messages });
      return "sent";
    }),
    text: (s: string) => ({ type: "text" as const, text: s }),
    showLoading: vi.fn(),
    withQuickReplies: (text: string, buttons: { label: string; text: string }[]) => ({
      type: "quick" as const,
      text,
      buttons,
    }),
  };
}
