import type { FlexMessage } from "@/lib/line/client";
import type { UserSettings } from "@/lib/memory/settings";
import type { Fact } from "@/lib/memory/facts";
import { deriveCheckInTime } from "@/lib/time-utils";
import { t, uiLang, type UiLang } from "@/lib/i18n";

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

function toggleRow(label: string, isOn: boolean, onData: string, offData: string, lang: UiLang): object {
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
          { type: "text", text: isOn ? t(lang, "on") : t(lang, "off"), size: "xs", color: isOn ? OK : MUTED },
        ],
      },
      postbackButton(isOn ? t(lang, "turnOff") : t(lang, "turnOn"), isOn ? offData : onData, isOn ? "secondary" : "primary", isOn ? undefined : OK),
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
    contents: [{ type: "text", text: label, weight: "bold", size: "sm", color: TEXT, wrap: true }, ...rows],
  };
}

function sectionButton(icon: string, title: string, subtitle: string, section: string, lang: UiLang): object {
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
      postbackButton(t(lang, "edit"), `settings:section:${section}`, "primary", ACCENT, `${t(lang, "edit")} ${title}`),
    ],
  };
}

function currentRow(label: string, value: string, lang: UiLang): object {
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
  const lang = uiLang(settings.language);
  const morning = settings.morningBriefingTime ? `${settings.morningBriefingTime}` : t(lang, "off");
  const evening = settings.eveningSummaryEnabled ? settings.eveningSummaryTime : t(lang, "off");
  const checkIn = settings.taskCheckInEnabled
    ? (settings.taskCheckInTime ?? deriveCheckInTime(settings.eveningSummaryTime))
    : t(lang, "off");
  const toolsOn = Object.values(settings.tools).filter(Boolean).length;
  const topicsOn = Object.values(settings.briefingTopics).filter(Boolean).length;

  return {
    type: "flex",
    altText: `Lekha settings: briefings ${morning}/${evening}, ${toolsOn} tools, ${topicsOn} topics. Tap to edit.`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header(t(lang, "settingsTitle")),
      body: body([
        hint(t(lang, "settingsHint")),
        sectionButton("📰", t(lang, "briefingTitle"), `${t(lang, "morningLabel")} ${morning} · ${t(lang, "eveningLabel")} ${evening} · ${t(lang, "checkinLabel")} ${checkIn}`, "briefing", lang),
        sectionButton("🛠", t(lang, "toolsTitle"), `${t(lang, "toolsHint")} · ${toolsOn}/5 ${t(lang, "on")}`, "tools", lang),
        sectionButton("🎭", t(lang, "personaTitle"), `${t(lang, "toneLabel")} · ${t(lang, "addressYouAsLabel")} · ${t(lang, "languageLabel")} · ${t(lang, "matchVoiceLabel")}`, "persona", lang),
        sectionButton("🧠", t(lang, "memoryTitle"), `${t(lang, "autoCompactLabel")} ${settings.memoryCompactAt} msgs · ${settings.memoryEnabled ? t(lang, "on") : t(lang, "off")}`, "memory", lang),
        sectionButton("📝", t(lang, "factsTitle"), t(lang, "factsTitle"), "facts", lang),
        sectionButton("🌐", t(lang, "localeTitle"), `${t(lang, "timezoneLabel")} · ${t(lang, "locationLabel")} · ${t(lang, "replyLanguageLabel")}`, "locale", lang),
        separator(),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [
            postbackButton(t(lang, "close"), "settings:noop", "secondary"),
          ],
        },
      ]),
    },
  };
}

function timePresetRow(label: string, current: string | null, keyPrefix: string, lang: UiLang): object {
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
          { type: "text", text: label, weight: "bold", size: "sm", color: TEXT, flex: 1, wrap: true },
          postbackButton(current === null ? t(lang, "off") : t(lang, "turnOff"), `settings:toggle:${keyPrefix}:off`, offOn, offOn === "primary" ? undefined : MUTED),
        ],
      },
      ...buttonRows,
      promptButton(t(lang, "customTime"), keyPrefix, "secondary"),
    ],
  };
}

export function settingsBriefingFlex(settings: UserSettings): FlexMessage {
  const lang = uiLang(settings.language);
  const topicEntries = Object.entries(settings.briefingTopics);
  const topicRows = topicEntries.map(([id, on]) =>
    toggleRow(
      id.charAt(0).toUpperCase() + id.slice(1),
      on,
      `settings:briefing:set:briefingTopic:${id}:true`,
      `settings:briefing:set:briefingTopic:${id}:false`,
      lang,
    ),
  );

  return {
    type: "flex",
    altText: `Briefing settings: morning ${settings.morningBriefingTime ?? t(lang, "off")}, evening ${settings.eveningSummaryEnabled ? settings.eveningSummaryTime : t(lang, "off")}.`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header(t(lang, "briefingTitle")),
      body: body([
        hint(t(lang, "briefingHint")),
        timePresetRow(t(lang, "morningLabel"), settings.morningBriefingTime, "morning", lang),
        timePresetRow(t(lang, "eveningLabel"), settings.eveningSummaryEnabled ? settings.eveningSummaryTime : null, "evening", lang),
        timePresetRow(t(lang, "checkinLabel"), settings.taskCheckInEnabled ? (settings.taskCheckInTime ?? deriveCheckInTime(settings.eveningSummaryTime)) : null, "checkin", lang),
        separator(),
        wrap(
          { type: "text", text: t(lang, "preMeetingAlertsTitle"), weight: "bold", size: "sm", color: TEXT, wrap: true },
          hint(t(lang, "preMeetingAlertsHint")),
          chipRow(
            "",
            [
              { label: t(lang, "lead15min"), data: "settings:briefing:set:preMeetingLead:15:true", on: settings.preMeetingLeads.includes(15) },
              { label: t(lang, "lead1hour"), data: "settings:briefing:set:preMeetingLead:60:true", on: settings.preMeetingLeads.includes(60) },
              { label: t(lang, "lead1day"), data: "settings:briefing:set:preMeetingLead:1440:true", on: settings.preMeetingLeads.includes(1440) },
            ],
            3,
          ),
        ),
        separator(),
        toggleRow(t(lang, "includeUnreadGmail"), settings.inboxBriefingEnabled, "settings:briefing:set:inboxBriefingEnabled:true", "settings:briefing:set:inboxBriefingEnabled:false", lang),
        chipRow(t(lang, "lengthLabel"), [
          { label: "Headlines", data: "settings:briefing:set:briefingLength:Headlines", on: settings.briefingLength === "Headlines" },
          { label: "Bullets", data: "settings:briefing:set:briefingLength:Bullets", on: settings.briefingLength === "Bullets" },
          { label: "Full", data: "settings:briefing:set:briefingLength:Full", on: settings.briefingLength === "Full" },
        ]),
        chipRow(
          t(lang, "languageLabel"),
          [
            { label: "English", data: "settings:briefing:set:briefingLanguage:English", on: settings.briefingLanguage === "English" },
            { label: "ไทย", data: "settings:briefing:set:briefingLanguage:ไทย", on: settings.briefingLanguage === "ไทย" },
            { label: "EN + ไทย", data: "settings:briefing:set:briefingLanguage:EN + ไทย", on: settings.briefingLanguage === "EN + ไทย" },
          ],
          2,
        ),
        separator(),
        wrap(
          { type: "text", text: t(lang, "channelsLabel"), weight: "bold", size: "sm", color: TEXT, wrap: true },
          hint(t(lang, "briefingChannelHint")),
          toggleRow(t(lang, "lineChat"), settings.briefingChannels.line, "settings:briefing:set:briefingChannel:line:true", "settings:briefing:set:briefingChannel:line:false", lang),
          toggleRow(t(lang, "emailChannel"), settings.briefingChannels.email, "settings:briefing:set:briefingChannel:email:true", "settings:briefing:set:briefingChannel:email:false", lang),
        ),
        separator(),
        wrap({ type: "text", text: t(lang, "dailyTopics"), weight: "bold", size: "sm", color: TEXT, wrap: true }, ...topicRows),
        separator(),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [postbackButton(t(lang, "back"), "settings:main", "secondary")],
        },
      ]),
    },
  };
}

function toolRow(
  label: string,
  on: boolean,
  toolId: string,
  expanded: boolean,
  lang: UiLang,
): object {
  const toggleDataOn = `settings:tools:set:tool:${toolId}:true`;
  const toggleDataOff = `settings:tools:set:tool:${toolId}:false`;
  const expandData = `settings:tools:expand:${toolId}`;
  const collapseData = `settings:tools:collapse:${toolId}`;
  return {
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
          { type: "text", text: label, weight: "bold", size: "sm", color: TEXT, wrap: true, adjustMode: "shrink-to-fit" },
          { type: "text", text: on ? t(lang, "on") : t(lang, "off"), size: "xs", color: on ? OK : MUTED },
        ],
      },
      ...(on
        ? [
            postbackButton(expanded ? t(lang, "toolCollapse") : t(lang, "toolExpand"), expanded ? collapseData : expandData, "secondary"),
            postbackButton(t(lang, "turnOff"), toggleDataOff, "secondary"),
          ]
        : [postbackButton(t(lang, "turnOn"), toggleDataOn, "primary", OK)]),
    ],
  };
}

function toolSettingsRows(toolId: string, settings: UserSettings, lang: UiLang): object[] {
  const ts = settings.toolSettings[toolId] ?? {};
  if (toolId === "todo") {
    return [
      toggleRow(
        t(lang, "todoFollowupLabel"),
        !!ts.followup,
        `settings:tools:set:todo:followup:true`,
        `settings:tools:set:todo:followup:false`,
        lang,
      ),
    ];
  }
  if (toolId === "reminders") {
    const preempt = (ts.preempt as number) ?? 15;
    return [
      chipRow(t(lang, "reminderPreemptLabel"), [
        { label: "15", data: "settings:tools:set:reminders:preempt:15", on: preempt === 15 },
        { label: "30", data: "settings:tools:set:reminders:preempt:30", on: preempt === 30 },
        { label: "60", data: "settings:tools:set:reminders:preempt:60", on: preempt === 60 },
      ]),
    ];
  }
  if (toolId === "calendar") {
    return [
      toggleRow(
        t(lang, "calendarPrebriefLabel"),
        !!ts.prebrief,
        `settings:tools:set:calendar:prebrief:true`,
        `settings:tools:set:calendar:prebrief:false`,
        lang,
      ),
    ];
  }
  if (toolId === "email") {
    const tone = (ts.tone as string) ?? "Warm";
    const autosend = (ts.autosend as string) ?? "Always confirm";
    return [
      chipRow(t(lang, "emailToneLabel"), [
        { label: t(lang, "toneWarm"), data: "settings:tools:set:email:tone:Warm", on: tone === "Warm" },
        { label: t(lang, "toneProfessional"), data: "settings:tools:set:email:tone:Professional", on: tone === "Professional" },
        { label: t(lang, "tonePlayful"), data: "settings:tools:set:email:tone:Playful", on: tone === "Playful" },
      ]),
      chipRow(
        t(lang, "emailAutosendLabel"),
        [
          { label: t(lang, "autosendAlwaysConfirm"), data: "settings:tools:set:email:autosend:Always confirm", on: autosend === "Always confirm" },
          { label: t(lang, "autosendConfirmOnce"), data: "settings:tools:set:email:autosend:Confirm first time only", on: autosend === "Confirm first time only" },
          { label: t(lang, "autosendAlwaysSend"), data: "settings:tools:set:email:autosend:Always send", on: autosend === "Always send" },
        ],
        1,
      ),
    ];
  }
  return [];
}

export function settingsToolsFlex(settings: UserSettings, expandedTool?: string): FlexMessage {
  const lang = uiLang(settings.language);
  const toolOrder = [
    { id: "todo", icon: "✅", key: "toolTodo" as const },
    { id: "reminders", icon: "⏰", key: "toolReminders" as const },
    { id: "calendar", icon: "📅", key: "toolCalendar" as const },
    { id: "email", icon: "📧", key: "toolEmail" as const },
    { id: "drive", icon: "📁", key: "toolDrive" as const },
  ];

  const contents: object[] = [];
  for (const tool of toolOrder) {
    const on = !!settings.tools[tool.id];
    contents.push(toolRow(`${tool.icon} ${t(lang, tool.key)}`, on, tool.id, expandedTool === tool.id, lang));
    if (expandedTool === tool.id && on) {
      contents.push(
        {
          type: "box",
          layout: "vertical",
          margin: "sm",
          paddingStart: "lg",
          spacing: "sm",
          contents: toolSettingsRows(tool.id, settings, lang),
        },
      );
    }
  }

  return {
    type: "flex",
    altText: `Tool settings: ${Object.values(settings.tools).filter(Boolean).length} of 5 enabled.`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header(t(lang, "toolsTitle")),
      body: body([
        hint(t(lang, "toolsHint")),
        ...contents,
        separator(),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [
            postbackButton(t(lang, "back"), "settings:main", "secondary"),
          ],
        },
      ]),
    },
  };
}

export function settingsPersonaFlex(settings: UserSettings): FlexMessage {
  const lang = uiLang(settings.language);
  return {
    type: "flex",
    altText: `Persona settings: ${settings.personaTone}, ${settings.personaAddressing}, ${settings.personaPrimaryLang}.`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header(t(lang, "personaTitle")),
      body: body([
        hint(t(lang, "personaHint")),
        currentRow(t(lang, "preferredNameLabel"), settings.personaPreferredName || "LINE display name", lang),
        promptButton(settings.personaPreferredName?.trim() ? t(lang, "changePreferredName") : t(lang, "setPreferredName"), "preferredName", "secondary"),
        chipRow(
          t(lang, "toneLabel"),
          [
            { label: t(lang, "toneWarm"), data: "settings:persona:set:personaTone:Warm", on: settings.personaTone === "Warm" },
            { label: t(lang, "toneProfessional"), data: "settings:persona:set:personaTone:Professional", on: settings.personaTone === "Professional" },
            { label: t(lang, "tonePlayful"), data: "settings:persona:set:personaTone:Playful", on: settings.personaTone === "Playful" },
          ],
          2,
        ),
        chipRow(
          t(lang, "addressYouAsLabel"),
          [
            { label: t(lang, "addressingFirstName"), data: "settings:persona:set:personaAddressing:First name", on: settings.personaAddressing === "First name" },
            { label: t(lang, "addressingKhun"), data: "settings:persona:set:personaAddressing:Khun", on: settings.personaAddressing === "Khun" },
            { label: t(lang, "addressingSirMadam"), data: "settings:persona:set:personaAddressing:Sir / Madam", on: settings.personaAddressing === "Sir / Madam" },
            { label: t(lang, "addressingNoAddress"), data: "settings:persona:set:personaAddressing:No address", on: settings.personaAddressing === "No address" },
          ],
          2,
        ),
        chipRow(t(lang, "primaryLanguageLabel"), [
          { label: "English", data: "settings:persona:set:personaPrimaryLang:English", on: settings.personaPrimaryLang === "English" },
          { label: "Thai", data: "settings:persona:set:personaPrimaryLang:Thai", on: settings.personaPrimaryLang === "Thai" },
        ]),
        toggleRow(t(lang, "matchVoiceLabel"), settings.personaVoiceMatch, "settings:persona:set:personaVoiceMatch:true", "settings:persona:set:personaVoiceMatch:false", lang),
        separator(),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [postbackButton(t(lang, "back"), "settings:main", "secondary")],
        },
      ]),
    },
  };
}

export function settingsMemoryFlex(settings: UserSettings): FlexMessage {
  const lang = uiLang(settings.language);
  return {
    type: "flex",
    altText: `Memory settings: enabled ${settings.memoryEnabled}, compact every ${settings.memoryCompactAt} messages.`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header(t(lang, "memoryTitle")),
      body: body([
        hint(t(lang, "memoryHint")),
        toggleRow(t(lang, "memoryEnabledLabel"), settings.memoryEnabled, "settings:memory:set:memoryEnabled:true", "settings:memory:set:memoryEnabled:false", lang),
        chipRow(t(lang, "autoCompactLabel"), [
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
            postbackButton(t(lang, "viewFacts"), "settings:section:facts", "primary"),
            promptButton(t(lang, "addFact"), "fact", "secondary"),
          ],
        },
        separator(),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [postbackButton(t(lang, "back"), "settings:main", "secondary")],
        },
      ]),
    },
  };
}

function factCategoryLabel(lang: UiLang, category: string): string {
  const key = `factCategory${category.charAt(0).toUpperCase() + category.slice(1)}`;
  return t(lang, key as never);
}

export function settingsFactsFlex(facts: Fact[], language?: string | null): FlexMessage {
  const lang = uiLang(language);
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
          { type: "text", text: `[${factCategoryLabel(lang, f.category)}] ${f.content}`, size: "xs", color: TEXT, wrap: true },
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
      header: header(t(lang, "factsTitle")),
      body: body([
        hint(t(lang, "factsHint", { count: String(facts.length), s: facts.length === 1 ? "" : "s" })),
        ...(rows.length ? rows : [{ type: "text", text: t(lang, "noFacts"), size: "sm", color: "#777777", wrap: true }]),
        separator(),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [
            postbackButton(t(lang, "back"), "settings:section:memory", "secondary"),
            promptButton(t(lang, "addFact"), "fact", "primary"),
          ],
        },
      ]),
    },
  };
}

export function settingsLocaleFlex(settings: UserSettings): FlexMessage {
  const lang = uiLang(settings.language);
  return {
    type: "flex",
    altText: `Language and location: ${settings.language ?? "Auto"}, ${settings.location ?? "No location"}, ${settings.timezone}.`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header(t(lang, "localeTitle")),
      body: body([
        hint(t(lang, "localeHint")),
        chipRow(t(lang, "replyLanguageLabel"), [
          { label: t(lang, "auto"), data: "settings:locale:set:language:auto", on: settings.language === null },
          { label: "English", data: "settings:locale:set:language:en", on: settings.language === "en" },
          { label: "ไทย", data: "settings:locale:set:language:th", on: settings.language === "th" },
        ]),
        currentRow(t(lang, "currentLabel"), settings.language ?? "Auto", lang),
        separator(),
        chipRow(
          t(lang, "timezoneLabel"),
          PRESET_TIMEZONES.map((tz) => ({ label: tz.split("/")[1] ?? tz, data: `settings:locale:set:timezone:${tz}`, on: settings.timezone === tz })),
          3,
        ),
        currentRow(t(lang, "timezoneLabel"), settings.timezone, lang),
        promptButton(t(lang, "customTimezone"), "timezone", "secondary"),
        separator(),
        chipRow(
          t(lang, "locationLabel"),
          PRESET_LOCATIONS.map((loc) => ({ label: loc, data: `settings:locale:set:location:${loc}`, on: settings.location === loc })),
          2,
        ),
        currentRow(t(lang, "locationLabel"), settings.location ?? "—", lang),
        promptButton(t(lang, "customLocation"), "location", "secondary"),
        separator(),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [postbackButton(t(lang, "back"), "settings:main", "secondary")],
        },
      ]),
    },
  };
}
