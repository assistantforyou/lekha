import type { FlexMessage } from "@/lib/line/client";
import type { UserSettings } from "@/lib/memory/settings";
import type { Fact } from "@/lib/memory/facts";

const ACCENT = "#5B6FF0";
const ACCENT_DARK = "#4A5BD8";
const OK = "#00B894";
const MUTED = "#9CA3AF";
const TEXT = "#333333";

const PRESET_TIMEZONES = ["Asia/Bangkok", "Asia/Singapore", "Asia/Tokyo", "Europe/London", "America/New_York"];
const PRESET_LOCATIONS = ["Bangkok, Thailand", "Singapore", "Tokyo, Japan", "London, UK", "New York, USA"];

function header(title: string): object {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: ACCENT,
    paddingAll: "14px",
    contents: [{ type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "lg" }],
  };
}

function body(contents: object[]): object {
  return {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    paddingAll: "16px",
    contents,
  };
}

function hint(text: string): object {
  return { type: "text", text, size: "xs", color: "#777777", wrap: true };
}

function separator(): object {
  return { type: "separator", margin: "md", color: "#f2f2f2" };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function postbackButton(
  label: string,
  data: string,
  style: "primary" | "secondary" = "primary",
  color?: string,
  displayText?: string,
): object {
  return {
    type: "button",
    style,
    color: color ?? (style === "primary" ? ACCENT : undefined),
    height: "sm",
    action: { type: "postback", label, data, displayText: displayText ?? label },
  };
}

function promptButton(label: string, promptKey: string, style: "primary" | "secondary" = "secondary"): object {
  return {
    type: "button",
    style,
    height: "sm",
    action: { type: "postback", label, data: `settings:prompt:${promptKey}` },
  };
}

function messageButton(label: string, text: string, style: "primary" | "secondary" = "secondary"): object {
  return {
    type: "button",
    style,
    height: "sm",
    action: { type: "message", label, text },
  };
}

function toggleRow(label: string, isOn: boolean, onData: string, offData: string): object {
  return {
    type: "box",
    layout: "horizontal",
    margin: "md",
    alignItems: "center",
    spacing: "md",
    contents: [
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [
          { type: "text", text: label, weight: "bold", size: "sm", color: TEXT, wrap: true, adjustMode: "shrink-to-fit" },
          { type: "text", text: isOn ? "On" : "Off", size: "xs", color: isOn ? OK : MUTED },
        ],
      },
      postbackButton(isOn ? "Turn off" : "Turn on", isOn ? offData : onData, isOn ? "secondary" : "primary", isOn ? undefined : OK),
    ],
  };
}

function chipRow(
  label: string,
  options: { label: string; data: string; on: boolean }[],
  perRow = 3,
): object {
  const buttons = options.map((o) =>
    postbackButton(o.label, o.data, o.on ? "primary" : "secondary", o.on ? ACCENT_DARK : undefined),
  );
  const rows = chunk(buttons, perRow).map((group) => ({ type: "box", layout: "horizontal", spacing: "sm", contents: group }));
  return {
    type: "box",
    layout: "vertical",
    margin: "md",
    spacing: "sm",
    contents: [{ type: "text", text: label, weight: "bold", size: "sm", color: TEXT }, ...rows],
  };
}

function sectionButton(icon: string, title: string, subtitle: string, section: string): object {
  return {
    type: "box",
    layout: "horizontal",
    margin: "md",
    alignItems: "center",
    spacing: "md",
    contents: [
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [
          { type: "text", text: `${icon}  ${title}`, weight: "bold", size: "sm", color: TEXT, wrap: true },
          { type: "text", text: subtitle, size: "xs", color: "#777777", wrap: true },
        ],
      },
      postbackButton("Edit", `settings:section:${section}`, "primary", ACCENT, `Edit ${title}`),
    ],
  };
}

function currentRow(label: string, value: string): object {
  return {
    type: "box",
    layout: "horizontal",
    margin: "sm",
    spacing: "sm",
    contents: [
      { type: "text", text: `${label}:`, size: "xs", color: "#777777", flex: 0 },
      { type: "text", text: value || "—", size: "xs", color: TEXT, weight: "bold", wrap: true },
    ],
  };
}

function wrap(...contents: object[]): object {
  return { type: "box", layout: "vertical", spacing: "sm", contents };
}

export function settingsMainFlex(settings: UserSettings): FlexMessage {
  const morning = settings.morningBriefingTime ? `${settings.morningBriefingTime}` : "Off";
  const evening = settings.eveningSummaryEnabled ? settings.eveningSummaryTime : "Off";
  const checkIn = settings.taskCheckInEnabled ? (settings.taskCheckInTime ?? "Auto") : "Off";
  const toolsOn = Object.values(settings.tools).filter(Boolean).length;
  const topicsOn = Object.values(settings.briefingTopics).filter(Boolean).length;

  return {
    type: "flex",
    altText: `Lekha settings: briefings ${morning}/${evening}, ${toolsOn} tools, ${topicsOn} topics. Tap to edit.`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header("⚙️ Settings"),
      body: body([
        hint("Tap a section to edit. Changes apply immediately inside LINE."),
        sectionButton("📰", "Briefings", `Morning ${morning} · Evening ${evening} · Check-in ${checkIn}`, "briefing"),
        sectionButton("🛠", "Tools", `${toolsOn}/5 surfaces enabled`, "tools"),
        sectionButton("🎭", "Persona", `${settings.personaTone} · ${settings.personaAddressing} · ${settings.personaPrimaryLang}`, "persona"),
        sectionButton("🧠", "Memory", `Compact every ${settings.memoryCompactAt} msgs · ${settings.memoryEnabled ? "on" : "off"}`, "memory"),
        sectionButton("📝", "Facts", "View, add, or delete memories", "facts"),
        sectionButton("🌐", "Language & Location", `${settings.language ?? "Auto"} · ${settings.location ?? "No location"} · ${settings.timezone}`, "locale"),
        separator(),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [
            postbackButton("Close", "settings:noop", "secondary"),
          ],
        },
      ]),
    },
  };
}

function timePresetRow(label: string, current: string | null, keyPrefix: string): object {
  const defaultPresets = ["06:00", "07:00", "08:00", "09:00"];
  const presets: Record<string, string[]> = {
    morning: defaultPresets,
    evening: ["18:00", "19:00", "20:00", "21:00"],
    checkin: ["16:00", "17:00", "18:00", "19:00"],
  };
  const options = (presets[keyPrefix] ?? defaultPresets).map((t) => ({
    label: t,
    data: `settings:briefing:set:${keyPrefix}Time:${t}`,
    on: current === t,
  }));
  const offOn = current === null ? "secondary" : "primary";
  const buttonRows = chunk(
    options.map((o) => postbackButton(o.label, o.data, o.on ? "primary" : "secondary", o.on ? ACCENT_DARK : undefined)),
    2,
  ).map((group) => ({ type: "box", layout: "horizontal", spacing: "sm", contents: group }));
  return {
    type: "box",
    layout: "vertical",
    margin: "md",
    spacing: "sm",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        alignItems: "center",
        contents: [
          { type: "text", text: label, weight: "bold", size: "sm", color: TEXT, flex: 1 },
          postbackButton(current === null ? "Off" : "Turn off", `settings:toggle:${keyPrefix}:off`, offOn, offOn === "primary" ? undefined : MUTED),
        ],
      },
      ...buttonRows,
      promptButton("Custom time…", keyPrefix, "secondary"),
    ],
  };
}

export function settingsBriefingFlex(settings: UserSettings): FlexMessage {
  const topicEntries = Object.entries(settings.briefingTopics);
  const topicRows = topicEntries.map(([id, on]) =>
    toggleRow(
      id.charAt(0).toUpperCase() + id.slice(1),
      on,
      `settings:briefing:set:briefingTopic:${id}:true`,
      `settings:briefing:set:briefingTopic:${id}:false`,
    ),
  );

  return {
    type: "flex",
    altText: `Briefing settings: morning ${settings.morningBriefingTime ?? "off"}, evening ${settings.eveningSummaryEnabled ? settings.eveningSummaryTime : "off"}.`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header("📰 Briefings"),
      body: body([
        hint("Toggle each briefing and pick a time. Tap Back when done."),
        timePresetRow("Morning", settings.morningBriefingTime, "morning"),
        timePresetRow("Evening", settings.eveningSummaryEnabled ? settings.eveningSummaryTime : null, "evening"),
        timePresetRow("Task check-in", settings.taskCheckInEnabled ? (settings.taskCheckInTime ?? "20:30") : null, "checkin"),
        separator(),
        toggleRow("Include unread Gmail", settings.inboxBriefingEnabled, "settings:briefing:set:inboxBriefingEnabled:true", "settings:briefing:set:inboxBriefingEnabled:false"),
        chipRow("Length", [
          { label: "Headlines", data: "settings:briefing:set:briefingLength:Headlines", on: settings.briefingLength === "Headlines" },
          { label: "Bullets", data: "settings:briefing:set:briefingLength:Bullets", on: settings.briefingLength === "Bullets" },
          { label: "Full", data: "settings:briefing:set:briefingLength:Full", on: settings.briefingLength === "Full" },
        ]),
        chipRow(
          "Language",
          [
            { label: "English", data: "settings:briefing:set:briefingLanguage:English", on: settings.briefingLanguage === "English" },
            { label: "ไทย", data: "settings:briefing:set:briefingLanguage:ไทย", on: settings.briefingLanguage === "ไทย" },
            { label: "EN + ไทย", data: "settings:briefing:set:briefingLanguage:EN + ไทย", on: settings.briefingLanguage === "EN + ไทย" },
          ],
          2,
        ),
        separator(),
        wrap(
          { type: "text", text: "Channels", weight: "bold", size: "sm", color: TEXT },
          hint("LINE chat sends the briefing here. Email sends it to your connected Gmail address."),
          toggleRow("LINE chat", settings.briefingChannels.line, "settings:briefing:set:briefingChannel:line:true", "settings:briefing:set:briefingChannel:line:false"),
          toggleRow("Email", settings.briefingChannels.email, "settings:briefing:set:briefingChannel:email:true", "settings:briefing:set:briefingChannel:email:false"),
          toggleRow("Push alert", settings.briefingChannels.push, "settings:briefing:set:briefingChannel:push:true", "settings:briefing:set:briefingChannel:push:false"),
        ),
        separator(),
        wrap({ type: "text", text: "Daily briefing topics", weight: "bold", size: "sm", color: TEXT }, ...topicRows),
        separator(),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [postbackButton("← Back", "settings:main", "secondary")],
        },
      ]),
    },
  };
}

export function settingsToolsFlex(settings: UserSettings): FlexMessage {
  const toolOrder = [
    { id: "todo", icon: "✅", name: "To-do list" },
    { id: "reminders", icon: "⏰", name: "Reminders" },
    { id: "calendar", icon: "📅", name: "Calendar" },
    { id: "email", icon: "📧", name: "Email" },
    { id: "drive", icon: "📁", name: "Drive" },
  ] as const;

  const rows = toolOrder.map((t) => {
    const on = !!settings.tools[t.id];
    return toggleRow(`${t.icon} ${t.name}`, on, `settings:tools:set:tool:${t.id}:true`, `settings:tools:set:tool:${t.id}:false`);
  });

  return {
    type: "flex",
    altText: `Tool settings: ${Object.values(settings.tools).filter(Boolean).length} of 5 enabled.`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header("🛠 Tools"),
      body: body([
        hint("Turn whole tool surfaces on or off. More options coming soon."),
        ...rows,
        separator(),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [
            postbackButton("← Back", "settings:main", "secondary"),
          ],
        },
      ]),
    },
  };
}

export function settingsPersonaFlex(settings: UserSettings): FlexMessage {
  return {
    type: "flex",
    altText: `Persona settings: ${settings.personaTone}, ${settings.personaAddressing}, ${settings.personaPrimaryLang}.`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header("🎭 Persona"),
      body: body([
        hint("How Lekha sounds when she replies to you."),
        chipRow(
          "Tone",
          [
            { label: "Warm", data: "settings:persona:set:personaTone:Warm", on: settings.personaTone === "Warm" },
            { label: "Professional", data: "settings:persona:set:personaTone:Professional", on: settings.personaTone === "Professional" },
            { label: "Playful", data: "settings:persona:set:personaTone:Playful", on: settings.personaTone === "Playful" },
          ],
          2,
        ),
        chipRow(
          "Address you as",
          [
            { label: "First name", data: "settings:persona:set:personaAddressing:First name", on: settings.personaAddressing === "First name" },
            { label: "Khun", data: "settings:persona:set:personaAddressing:Khun", on: settings.personaAddressing === "Khun" },
            { label: "Sir / Madam", data: "settings:persona:set:personaAddressing:Sir / Madam", on: settings.personaAddressing === "Sir / Madam" },
            { label: "No address", data: "settings:persona:set:personaAddressing:No address", on: settings.personaAddressing === "No address" },
          ],
          2,
        ),
        chipRow("Primary language", [
          { label: "English", data: "settings:persona:set:personaPrimaryLang:English", on: settings.personaPrimaryLang === "English" },
          { label: "Thai", data: "settings:persona:set:personaPrimaryLang:Thai", on: settings.personaPrimaryLang === "Thai" },
        ]),
        toggleRow("Match your writing voice", settings.personaVoiceMatch, "settings:persona:set:personaVoiceMatch:true", "settings:persona:set:personaVoiceMatch:false"),
        separator(),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [postbackButton("← Back", "settings:main", "secondary")],
        },
      ]),
    },
  };
}

export function settingsMemoryFlex(settings: UserSettings): FlexMessage {
  return {
    type: "flex",
    altText: `Memory settings: enabled ${settings.memoryEnabled}, compact every ${settings.memoryCompactAt} messages.`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header("🧠 Memory"),
      body: body([
        hint("Control long-term memory and fact extraction."),
        toggleRow("Memory enabled", settings.memoryEnabled, "settings:memory:set:memoryEnabled:true", "settings:memory:set:memoryEnabled:false"),
        chipRow("Auto-compact every", [
          { label: "5", data: "settings:memory:set:memoryCompactAt:5", on: settings.memoryCompactAt === 5 },
          { label: "10", data: "settings:memory:set:memoryCompactAt:10", on: settings.memoryCompactAt === 10 },
          { label: "15", data: "settings:memory:set:memoryCompactAt:15", on: settings.memoryCompactAt === 15 },
          { label: "20", data: "settings:memory:set:memoryCompactAt:20", on: settings.memoryCompactAt === 20 },
          { label: "30", data: "settings:memory:set:memoryCompactAt:30", on: settings.memoryCompactAt === 30 },
        ]),
        separator(),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [
            postbackButton("View facts", "settings:section:facts", "primary"),
            promptButton("Add fact…", "fact", "secondary"),
          ],
        },
        separator(),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [postbackButton("← Back", "settings:main", "secondary")],
        },
      ]),
    },
  };
}

export function settingsFactsFlex(facts: Fact[]): FlexMessage {
  const rows = facts.map((f) => ({
    type: "box",
    layout: "horizontal",
    margin: "md",
    alignItems: "center",
    spacing: "sm",
    contents: [
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [
          { type: "text", text: `[${f.category}] ${f.content.slice(0, 120)}${f.content.length > 120 ? "…" : ""}`, size: "xs", color: TEXT, wrap: true },
        ],
      },
      postbackButton("Delete", `settings:facts:del:${f.id}`, "secondary"),
    ],
  }));

  return {
    type: "flex",
    altText: `You have ${facts.length} stored facts. Tap to delete or add one.`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header("📝 Facts"),
      body: body([
        hint(`Showing all ${facts.length} fact${facts.length === 1 ? "" : "s"}. Deleting is immediate.`),
        ...(rows.length ? rows : [{ type: "text", text: "No facts yet. Tap Add fact to create one.", size: "sm", color: "#777777", wrap: true }]),
        separator(),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [
            postbackButton("← Back", "settings:section:memory", "secondary"),
            promptButton("Add fact…", "fact", "primary"),
          ],
        },
      ]),
    },
  };
}

export function settingsLocaleFlex(settings: UserSettings): FlexMessage {
  return {
    type: "flex",
    altText: `Language and location: ${settings.language ?? "Auto"}, ${settings.location ?? "No location"}, ${settings.timezone}.`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header("🌐 Language & Location"),
      body: body([
        hint("Pick presets or type a custom value."),
        chipRow("Reply language", [
          { label: "Auto", data: "settings:locale:set:language:auto", on: settings.language === null },
          { label: "English", data: "settings:locale:set:language:en", on: settings.language === "en" },
          { label: "ไทย", data: "settings:locale:set:language:th", on: settings.language === "th" },
        ]),
        currentRow("Current", settings.language ?? "Auto"),
        separator(),
        chipRow(
          "Timezone",
          PRESET_TIMEZONES.map((tz) => ({ label: tz.split("/")[1] ?? tz, data: `settings:locale:set:timezone:${tz}`, on: settings.timezone === tz })),
          3,
        ),
        currentRow("Timezone", settings.timezone),
        promptButton("Custom timezone…", "timezone", "secondary"),
        separator(),
        chipRow(
          "Location",
          PRESET_LOCATIONS.map((loc) => ({ label: loc, data: `settings:locale:set:location:${loc}`, on: settings.location === loc })),
          2,
        ),
        currentRow("Location", settings.location ?? "—"),
        promptButton("Custom location…", "location", "secondary"),
        separator(),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [postbackButton("← Back", "settings:main", "secondary")],
        },
      ]),
    },
  };
}
