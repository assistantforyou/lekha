import { z } from "zod";

const Source = z.object({
  type: z.enum(["user", "group", "room"]),
  userId: z.string().optional(),
  groupId: z.string().optional(),
  roomId: z.string().optional(),
});

const Mention = z.object({
  mentionees: z.array(
    z.object({
      index: z.number(),
      length: z.number(),
      userId: z.string().optional(),
    }),
  ),
});

const TextMessage = z.object({
  type: z.literal("text"),
  id: z.string(),
  text: z.string(),
  mention: Mention.optional(),
  quoteToken: z.string().optional(),
});

const ImageMessage = z.object({
  type: z.literal("image"),
  id: z.string(),
  contentProvider: z.object({ type: z.string() }).optional(),
  quoteToken: z.string().optional(),
});

const VideoMessage = z.object({
  type: z.literal("video"),
  id: z.string(),
  duration: z.number().optional(),
  contentProvider: z.object({ type: z.string() }).optional(),
  quoteToken: z.string().optional(),
});

const AudioMessage = z.object({
  type: z.literal("audio"),
  id: z.string(),
  duration: z.number().optional(),
  contentProvider: z.object({ type: z.string() }).optional(),
  quoteToken: z.string().optional(),
});

const FileMessage = z.object({
  type: z.literal("file"),
  id: z.string(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  quoteToken: z.string().optional(),
});

const StickerMessage = z.object({
  type: z.literal("sticker"),
  id: z.string(),
  packageId: z.string(),
  stickerId: z.string(),
  quoteToken: z.string().optional(),
});

const OtherMessage = z.object({
  type: z.string(),
  id: z.string().optional(),
});

const Message = z.union([
  TextMessage,
  ImageMessage,
  VideoMessage,
  AudioMessage,
  FileMessage,
  StickerMessage,
  OtherMessage,
]);

export const LineMessageEvent = z.object({
  type: z.literal("message"),
  webhookEventId: z.string(),
  timestamp: z.number(),
  source: Source,
  replyToken: z.string(),
  message: Message,
  mode: z.string().optional(),
});

export const FollowEvent = z.object({
  type: z.literal("follow"),
  webhookEventId: z.string(),
  timestamp: z.number(),
  source: Source,
  replyToken: z.string(),
});

export const UnfollowEvent = z.object({
  type: z.literal("unfollow"),
  webhookEventId: z.string(),
  timestamp: z.number(),
  source: Source,
});

export const PostbackEvent = z.object({
  type: z.literal("postback"),
  webhookEventId: z.string(),
  timestamp: z.number(),
  source: Source,
  replyToken: z.string(),
  postback: z.object({
    data: z.string(),
    params: z.record(z.string(), z.string()).optional(),
  }),
});

export const JoinEvent = z.object({
  type: z.literal("join"),
  webhookEventId: z.string(),
  timestamp: z.number(),
  source: Source,
  replyToken: z.string(),
});

export const LeaveEvent = z.object({
  type: z.literal("leave"),
  webhookEventId: z.string(),
  timestamp: z.number(),
  source: Source,
});

export const MemberJoinedEvent = z.object({
  type: z.literal("memberJoined"),
  webhookEventId: z.string(),
  timestamp: z.number(),
  source: Source,
  replyToken: z.string(),
  joined: z.object({
    members: z.array(
      z.object({
        type: z.enum(["user"]),
        userId: z.string(),
      }),
    ),
  }),
});

export const MemberLeftEvent = z.object({
  type: z.literal("memberLeft"),
  webhookEventId: z.string(),
  timestamp: z.number(),
  source: Source,
  left: z.object({
    members: z.array(
      z.object({
        type: z.enum(["user"]),
        userId: z.string(),
      }),
    ),
  }),
});

export const OtherEvent = z.object({
  type: z.string(),
  webhookEventId: z.string().optional(),
  timestamp: z.number().optional(),
  source: Source.optional(),
});

export type LineTextMessage = z.infer<typeof TextMessage>;
export type LineImageMessage = z.infer<typeof ImageMessage>;
export type LineVideoMessage = z.infer<typeof VideoMessage>;
export type LineAudioMessage = z.infer<typeof AudioMessage>;
export type LineFileMessage = z.infer<typeof FileMessage>;
export type LineStickerMessage = z.infer<typeof StickerMessage>;

export type LineMessageEvent = z.infer<typeof LineMessageEvent>;
export type JoinEvent = z.infer<typeof JoinEvent>;
export type LeaveEvent = z.infer<typeof LeaveEvent>;
export type MemberJoinedEvent = z.infer<typeof MemberJoinedEvent>;
export type MemberLeftEvent = z.infer<typeof MemberLeftEvent>;

export const LineEvent = z.union([
  LineMessageEvent,
  FollowEvent,
  UnfollowEvent,
  PostbackEvent,
  JoinEvent,
  LeaveEvent,
  MemberJoinedEvent,
  MemberLeftEvent,
  OtherEvent,
]);
export type LineEvent = z.infer<typeof LineEvent>;

export const Webhook = z.object({
  destination: z.string(),
  events: z.array(LineEvent),
});
