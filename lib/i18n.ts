/**
 * Minimal UI translations for bot-owned strings. Dynamic replies come from the
 * LLM and are governed by the system prompt; this file covers hard-coded
 * buttons, acknowledgements, errors, and settings labels.
 */

export type UiLang = "en" | "th";

export function uiLang(language: string | null | undefined): UiLang {
  return language === "th" ? "th" : "en";
}

export function dateLocale(language: string | null | undefined): "th-TH" | "en-US" {
  return uiLang(language) === "th" ? "th-TH" : "en-US";
}

/** Detect the language of an incoming message so replies match the asker. */
export function detectMessageLanguage(text: string): "th" | "en" | null {
  if (typeof text !== "string") return null;
  if (/[\u0E00-\u0E7F]/.test(text)) return "th";
  if (/[a-zA-Z]/.test(text)) return "en";
  return null;
}

const UI = {
  en: {
    fallbackNoCatch: "I didn't catch that — could you rephrase?",

    docAck: "Got your document ({name}) — reading it now. What would you like to know?",
    docsAck: "Got your {count} files. Ask me what you'd like to do with them.",
    imageAck: "Got your image. Ask me to read text from it, describe it, or scan it as a receipt.",
    imagesAck: "Got your {count} images. Ask me to read text from them, describe them, or scan them as receipts.",
    zipAck: "Got your zip file ({name}) — I can attach it to emails but I can't open or extract the contents.",
    audioAck: "Got your voice memo — want me to transcribe or summarize it?",
    voiceMemoAck: "🎙 Got your voice memo{duration}. I've transcribed and saved it — just ask me to summarize, search, or pull quotes from it.",
    voiceMemoNoSpeech: "🎙 Got your voice memo{duration}, but I didn't detect any speech.",
    genericMediaAck: "Got your {kind} ({name}) — it's ready. What would you like to do with it?",

    settingsClosed: "Settings closed. Type /settings anytime.",
    deletedFact: "Deleted that fact.",
    gotItRemember: "Got it — I’ll remember that.",
    gotItCallYou: "Got it — I'll call you that from now on.",
    cancelled: "Cancelled.",
    unknownSetting: 'Unknown setting key "{key}". Type /settings to see the menu.',
    timeFormatError: "Please use HH:MM (e.g. 07:30) or 'off'.",
    compactError: "Compact interval must be a whole number between 1 and 1000 messages.",
    rememberUsage: "What should I remember? Type /remember <fact>.",
    whatShouldIRemember: "What should I remember? Type your fact.",
    timezonePrompt: "What timezone should I use? (e.g. Asia/Bangkok)",
    locationPrompt: "What location should I use? (e.g. Bangkok, Thailand)",
    factPrompt: "What fact should I remember?",
    preferredNamePrompt: "What should I call you?",
    pickTimePrompt: "Pick a time, or type your own (e.g. 21:30).",
    customPromptFallback: "What value?",
    auto: "Auto",

    connectGoogleReauth: "Your Google connection expired and needs to be refreshed.",
    connectGoogleNeeded: "I need access to your Google account to do that.",
    connectGoogleHint: 'Tap "Connect Google" below to reconnect — it only takes a few seconds.',
    googleApiDisabled: "Google says the {api} isn't enabled in your Cloud project.",
    googleApiEnableUrl: "Enable it here:",
    googleApiEnableConsole: "Enable it in Google Cloud Console → APIs & Services → Library.",
    googleApiWait: "Give it ~1 min to propagate after enabling, then try again.",
    googleErr: "Google API error{status}: {message}",

    agentErrConnect: 'To do that I need access to your Google account. Tap "Connect Google" below to connect it.',
    agentErrRateLimit: "I'm being rate-limited. Try again in ~{sec}s.",
    agentErrTimeout: "That took longer than I expected — try again in a moment.",
    agentErrUnavailable: "Temporarily unavailable — please try again in a moment.",
    agentErrQuota:
      "I'm out of LLM quota for the moment (monthly spending cap hit). Please check the Gemini project spend cap, or try again later.",
    agentErrGeneric: "Something went wrong. Try again in a moment.",

    done: "Done.",

    rateLimitMessage: "Easy there — give me a sec. Try again in ~{sec}s.",
    pendingCancelledOne: "Cancelled that.",
    pendingCancelledMany: "Cancelled all {count}.",
    stickerReply: "Cute sticker. Send me text, a photo, or a file if you'd like me to do something with it.",
    unknownMessageType: "I didn't recognize that message type. Try text, a photo, video, audio, or a file.",

    // Settings flex
    settingsTitle: "⚙️ Settings",
    settingsHint: "Tap a section to edit. Changes apply immediately inside LINE.",
    briefingTitle: "📰 Briefings",
    briefingHint: "Choose when and how Lekha briefs you each day. Times are in your timezone.",
    toolsTitle: "🛠 Tools",
    toolsHint: "Enable or disable whole tool surfaces. Tap a tool to expand its options.",
    personaTitle: "🎭 Persona",
    personaHint: "Choose Lekha's tone, how she addresses you, and her primary language.",
    memoryTitle: "🧠 Memory",
    memoryHint: "Lekha auto-extracts durable facts every N messages. Turn off to stop auto-extraction.",
    factsTitle: "📝 Facts",
    factsHint: "Showing all {count} fact{s}. Deleting is immediate.",
    noFacts: "No facts yet. Tap Add fact to create one.",
    localeTitle: "🌐 Language & Location",
    localeHint: "Set your timezone, location, and preferred reply language.",
    close: "Close",
    back: "← Back",
    edit: "Edit",
    turnOn: "Turn on",
    turnOff: "Turn off",
    on: "On",
    off: "Off",
    custom: "Custom",
    customTime: "Custom time…",
    customTimezone: "Custom timezone…",
    customLocation: "Custom location…",
    viewFacts: "View facts",
    addFact: "Add fact…",
    morningLabel: "Morning",
    eveningLabel: "Evening",
    checkinLabel: "Task check-in",
    includeUnreadGmail: "Include unread Gmail",
    lengthLabel: "Length",
    languageLabel: "Language",
    channelsLabel: "Channels",
    lineChat: "LINE chat",
    emailChannel: "Email",
    pushAlert: "Push alert",
    dailyTopics: "Daily briefing topics",
    timezoneLabel: "Timezone",
    locationLabel: "Location",
    replyLanguageLabel: "Reply language",
    currentLabel: "Current",
    preferredNameLabel: "Preferred name",
    setPreferredName: "Set name",
    changePreferredName: "Change",
    toneLabel: "Tone",
    addressYouAsLabel: "Address you as",
    primaryLanguageLabel: "Primary language",
    matchVoiceLabel: "Match your writing voice",
    memoryEnabledLabel: "Memory enabled",
    autoCompactLabel: "Auto-compact every",

    toolTodo: "To-do list",
    toolReminders: "Reminders",
    toolCalendar: "Calendar",
    toolEmail: "Email",
    toolDrive: "Drive",

    toneWarm: "Warm",
    toneProfessional: "Professional",
    tonePlayful: "Playful",
    addressingFirstName: "First name",
    addressingKhun: "Khun",
    addressingSirMadam: "Sir / Madam",
    addressingNoAddress: "No address",

    // Empty states
    noTasks: "Nothing on your list. 🎉",
    noFactsYet: "Nothing saved yet.",

    // Tasks
    taskAddError: "Couldn't save the task right now. Please try again in a moment.",
    taskUpdateError: "Couldn't update the task right now. Please try again in a moment.",
    taskDeleteError: "Couldn't delete the task right now. Please try again in a moment.",
    taskNotFound: "Task not found.",
    taskNoOpenMatch: 'No open task matching "{title}".',
    taskNoCompletedMatch: 'No completed task matching "{title}".',
    taskNoMatch: 'No task matching "{title}".',
    taskInvalidDueAt: "Invalid dueAt date.",
    taskAddItemError: 'Couldn\'t save "{title}" right now.',
    dueToday: "today",
    dueTomorrow: "tomorrow",

    // Reminders
    reminderScheduleError: "Couldn't schedule the reminder right now. Please try again in a moment.",

    // Briefings
    morningGreeting: "Good morning! ☀️ {date}",
    eveningGreeting: "Good evening. Here's your wrap-up: {date}",
    today: "Today",
    tomorrow: "Tomorrow",
    overdueTitle: "⚠️ Overdue",
    agendaTitle: "🗓 Your agenda",
    agendaEmpty: "• Nothing scheduled for today or tomorrow.",
    otherTasksTitle: "📋 Other tasks ({count})",
    otherTasksEmpty: "• No open tasks without a due date.",
    recommendationsTitle: "💡 Recommendations",
    recOverdueOne: '⚠️ "{title}" is overdue — tackle it first.',
    recOverdueMany: "⚠️ Overdue: {names}{more}. Start with the oldest.",
    recDueTodayOne: '📋 "{title}" is due today.',
    recDueTodayTwo: '📋 Due today: "{title0}" and "{title1}".',
    recDueTodayMany: "📋 {count} tasks due today: {names}{more}. Start with the hardest.",
    recCalendarOne: '📅 You have "{title}" on the calendar today — any prep needed?',
    recCalendarMany: "📅 Busy schedule: {names}{more}. Block buffer time between meetings.",
    recReminderOne: '⏰ Reminder: "{title}".',
    recReminderMany: "⏰ Reminders today: {names}{more}. Bundle them into one block.",
    recClearOne: '💡 Clear day — perfect time to knock out "{title}".',
    recClearMany: '💡 Nothing scheduled today. How about "{title}"?',
    recFiller: '💡 No due tasks today, but you have "{title}" open. Good filler between events.',
    recPacked: "🔥 Packed day. Consider deferring non-urgent items.",
    doneTodayTitle: "✅ Done today",
    doneTodayEmpty: "• Nothing completed today.",
    stillOpenTitle: "📋 Still open",
    stillOpenEmpty: "• All clear — nothing left.",
    aheadTitle: "🗓 Tomorrow & ahead",
    overdueItemLabel: "[overdue]",
    duePrefix: "due {when}",
    evRecNoDone: "No tasks completed today. Start tomorrow with your highest-priority item.",
    evRecOverdue: "You still have {count} overdue task(s). Address them first thing tomorrow.",
    evRecBusy: "Tomorrow looks busy. Prep tonight so you start ahead.",
    evRecLight: "Tomorrow looks light. Use the morning to clear your open tasks.",
    evRecManyOpen: "{count} tasks still open. Review which ones actually matter this week.",
    evRecMeetingsNoTasks: "Lots of meetings tomorrow but no tasks due. Add any prep or follow-ups.",

    // Flex surfaces
    morningBriefingTitle: "☀️  Morning briefing",
    eveningSummaryTitle: "🌙  Evening summary",
    morningCalendarBtn: "What's on my calendar?",
    morningTasksBtn: "Show my tasks",
    morningInboxBtn: "Check my inbox",
    morningCalendarAction: "what's on my calendar today",
    morningTasksAction: "list my tasks",
    morningInboxAction: "summarize my recent unread email",

    taskCheckinTitle: "✅  Quick check-in",
    taskCheckinSubtitle: "Which of these did you finish today?",
    taskCheckinDoneAll: "Done all",
    taskCheckinDoneAllDisplay: "Done all — confirm first",
    doneAllConfirmTitle: "Mark all {count} open tasks done?",
    doneAllConfirmHint: "This cannot be undone.",
    yesDoneAll: "Yes, done all",
    yesMarkAllDone: "Yes, mark all done",

    tasksTitle: "Your tasks",
    taskHeader: "✅  Tasks",
    taskAllDone: "All done 🎉",
    taskDoneBtn: "Done",
    taskReopenBtn: "Reopen",
    taskOpenCount: "{open} open  ·  {done} done",
    taskOverduePrefix: "Overdue · ",

    helpTitle: "Lekha Help",
    helpHint: "Here's what I can do. Tap a green button to see how I reply:",
    helpTryIt: "Try it",

    googleConnectTitle: "Google Connect",
    googleConnectDefaultReason: "Connect your Google account for email, calendar, and Drive.",
    googleConnectButton: "Connect Google Account",
    googleConnectExpires: "Link expires in 10 minutes.",

    confirmQuestion: "Confirm?",
    confirmYesSend: "Yes, send",
    cancel: "Cancel",

    groupGateTitle: "Lekha in groups",
    groupGateBody: "A Team plan is needed to use Lekha inside group chats.",
    groupGateMonthly: "Team Monthly — ฿800/mo",
    groupGateYearly: "Team Yearly — ฿8,000/yr",
    newGroupAdminTitle: "Bot added to a group",
    newGroupAdminIgnore: "🗑 Ignore",
    newGroupAdminAllow: "✓ Allow",

    groupWelcome:
      "Hi everyone! I'm Lekha 👋\n\nMention me (@Lekha) or reply to my messages when you want my help. I can answer questions, search the web, check weather and stocks, read photos, and more.",

    briefingChannelHint: "Briefings are sent here in LINE chat. Email delivery coming soon.",

    unknownPostback: "I didn't understand that button. Try typing your request instead.",

    // Help categories
    helpCatMemoryTitle: "Memory",
    helpCatMemoryDesc: "remember facts, recall what I know, update memories",
    helpCatMemoryDemo:
      "I can remember your preferences, routines, and important details so I don't have to ask twice. Try telling me anything — I'll store it.",
    helpCatTasksTitle: "Tasks",
    helpCatTasksDesc: "add tasks, mark done, list open work",
    helpCatTasksDemo:
      "Here's what I'd do: add a task 'call the plumber'. ✅\n\n(Demo only — no task was created.)",
    helpCatRemindersTitle: "Reminders",
    helpCatRemindersDesc: "one-shot or recurring LINE pushes",
    helpCatRemindersDemo:
      "I'd set a reminder: stretch in 5 minutes. ⏰\n\n(Demo only — no reminder was set.)",
    helpCatListsTitle: "Lists",
    helpCatListsDesc: "grocery, packing, or any named list",
    helpCatListsDemo:
      "I'd add milk to your grocery list. 🥛\n\n(Demo only — list unchanged.)",
    helpCatEmailTitle: "Email & Inbox",
    helpCatEmailDesc: "draft/send/search Gmail (Google needed)",
    helpCatEmailDemo:
      "With Google connected, I can search your inbox, draft replies, and send emails. Say 'connect google' to link an account.",
    helpCatCalendarTitle: "Calendar",
    helpCatCalendarDesc: "schedule events, list upcoming (Google needed)",
    helpCatCalendarDemo:
      "With Google connected, I can check your schedule and draft events. I can also warn you before meetings if you want.",
    helpCatDriveTitle: "Drive & Docs",
    helpCatDriveDesc: "search, upload, read files (Google needed)",
    helpCatDriveDemo:
      "I can search Drive, get share links, read text files, and upload photos or documents you send me.",
    helpCatMediaTitle: "Media",
    helpCatMediaDesc: "photos, voice notes, PDFs, Office files",
    helpCatMediaDemo:
      "Send me a photo and I'll read text or describe it. Send a PDF and I'll summarize it. Voice notes work too.",
    helpCatReceiptsTitle: "Receipts",
    helpCatReceiptsDesc: "scan, list, search expense receipts",
    helpCatReceiptsDemo:
      "Send a receipt photo and say 'scan this'. I'll save the merchant, amount, date, and items so you can search them later. 🧾",
    helpCatSearchTitle: "Search & Info",
    helpCatSearchDesc: "web search, weather, stocks, news",
    helpCatSearchDemo:
      "I can search the web, check weather, look up stocks/crypto, and get news. I always cite sources with a timestamp.",
    helpCatSettingsTitle: "Settings",
    helpCatSettingsDesc: "timezone, location, language, briefings",
    helpCatSettingsDemo:
      "I'd set your timezone to Asia/Bangkok. 🌏\n\n(Demo only — settings unchanged.)",

    // Fact categories
    factCategoryPreferences: "preferences",
    factCategoryPeople: "people",
    factCategoryHabits: "habits",
    factCategoryDeadlines: "deadlines",
    factCategoryContext: "context",
    factCategoryHealth: "health",
    factCategoryWork: "work",
    factCategoryOther: "other",
  },

  th: {
    fallbackNoCatch: "ฉันไม่เข้าใจ ช่วยพูดใหม่ได้ไหมคะ",

    docAck: "ได้เอกสาร ({name}) แล้ว กำลังอ่านอยู่ อยากรู้อะไรคะ",
    docsAck: "ได้ไฟล์ {count} ไฟล์แล้ว บอกฉันว่าอยากทำอะไร",
    imageAck: "ได้รูปแล้ว ให้ฉันอ่านตัวอักษร อธิบาย หรือสแกนใบเสร็จคะ",
    imagesAck: "ได้รูป {count} รูปแล้ว ให้ฉันอ่านตัวอักษร อธิบาย หรือสแกนใบเสร็จคะ",
    zipAck: "ได้ไฟล์ zip ({name}) แล้ว ฉันสามารถแนบในอีเมลได้ แต่เปิดหรือแตกไฟล์ไม่ได้",
    audioAck: "ได้ข้อความเสียงแล้ว ให้ฉันเขียนเป็นข้อความหรือสรุปคะ",
    voiceMemoAck: "🎙 ได้ข้อความเสียง{duration}แล้ว เขียนเป็นข้อความและบันทึกไว้แล้ว บอกฉันให้สรุป ค้นหา หรือดึงคำพูดได้เลย",
    voiceMemoNoSpeech: "🎙 ได้ข้อความเสียง{duration}แล้ว แต่ไม่พบเสียงพูด",
    genericMediaAck: "ได้{kind} ({name}) แล้ว อยากทำอะไรคะ",

    settingsClosed: "ปิดการตั้งค่าแล้ว พิมพ์ /settings ได้ทุกเวลา",
    deletedFact: "ลบความจำนั้นแล้ว",
    gotItRemember: "ได้เลย ฉันจะจำไว้",
    gotItCallYou: "ได้เลย ฉันจะเรียกคุณอย่างนั้นต่อไป",
    cancelled: "ยกเลิกแล้ว",
    unknownSetting: 'ไม่รู้จักคำสั่ง "{key}" พิมพ์ /settings เพื่อดูเมนู',
    timeFormatError: "กรุณาใช้ ชม:นาที (เช่น 07:30) หรือ 'off'",
    compactError: "ช่วง compact ต้องเป็นตัวเลขเต็ม 1-1000 ข้อความ",
    rememberUsage: "ควรจำอะไร? พิมพ์ /remember <เรื่อง>",
    whatShouldIRemember: "ควรจำอะไร? พิมพ์ความจำของคุณ",
    timezonePrompt: "ใช้เขตเวลาอะไร? (เช่น Asia/Bangkok)",
    locationPrompt: "ใช้สถานที่อะไร? (เช่น กรุงเทพฯ, ประเทศไทย)",
    factPrompt: "ควรจำอะไร?",
    preferredNamePrompt: "ฉันควรเรียกคุณว่าอะไร?",
    pickTimePrompt: "เลือกเวลา หรือพิมพ์เอง (เช่น 21:30)",
    customPromptFallback: "ค่าอะไร?",
    auto: "อัตโนมัติ",

    connectGoogleReauth: "การเชื่อมต่อ Google ของคุณหมดอายุแล้ว ต้องเชื่อมใหม่",
    connectGoogleNeeded: "ฉันต้องใช้สิทธิ์ Google ของคุณเพื่อทำรายการนี้",
    connectGoogleHint: 'แตะ "เชื่อม Google" ด้านล่างเพื่อเชื่อมใหม่ ใช้เวลาไม่กี่วินาที',
    googleApiDisabled: "Google แจ้งว่า {api} ยังไม่ได้เปิดใช้งานในโปรเจกต์ของคุณ",
    googleApiEnableUrl: "เปิดใช้งานได้ที่:",
    googleApiEnableConsole: "เปิดใช้งานใน Google Cloud Console → APIs & Services → Library",
    googleApiWait: "รอประมาณ 1 นาทีหลังเปิดใช้งาน แล้วลองใหม่",
    googleErr: "ข้อผิดพลาด Google API{status}: {message}",

    agentErrConnect: 'ฉันต้องใช้สิทธิ์ Google ของคุณเพื่อทำรายการนี้ แตะ "เชื่อม Google" ด้านล่าง',
    agentErrRateLimit: "ตอนนี้ถูกจำกัดอัตรา ลองใหม่ในอีก ~{sec} วินาที",
    agentErrTimeout: "ใช้เวลานานกว่าที่คิด ลองใหม่ในอีกสักครู่",
    agentErrUnavailable: "ชั่วคราวไม่พร้อมใช้งาน ลองใหม่ในอีกสักครู่",
    agentErrQuota:
      "LLM quota หมดชั่วคราว (spending cap เดือนนี้) กรุณาตรวจสอบ spend cap ของโปรเจกต์ Gemini หรือลองใหม่ภายหลัง",
    agentErrGeneric: "มีบางอย่างผิดพลาด ลองใหม่ในอีกสักครู่",

    done: "เสร็จแล้ว",

    rateLimitMessage: "ช้าก่อนค่ะ รอสักครู่ ลองใหม่ในอีก ~{sec} วินาที",
    pendingCancelledOne: "ยกเลิกรายการนั้นแล้ว",
    pendingCancelledMany: "ยกเลิกทั้ง {count} รายการแล้ว",
    stickerReply: "สติกเกอร์น่ารัก ส่งข้อความ รูป หรือไฟล์มาได้เลยค่ะ",
    unknownMessageType: "ฉันไม่รู้จักประเภทข้อความนี้ ลองส่งข้อความ รูป วิดีโอ เสียง หรือไฟล์ค่ะ",

    // Settings flex
    settingsTitle: "⚙️ ตั้งค่า",
    settingsHint: "แตะหัวข้อเพื่อแก้ไข การเปลี่ยนแปลงมีผลทันทีใน LINE",
    briefingTitle: "📰 สรุปประจำวัน",
    briefingHint: "เลือกเวลาและวิธีที่ Lekha สรุปให้คุณทุกวัน เวลาตามเขตเวลาของคุณ",
    toolsTitle: "🛠 เครื่องมือ",
    toolsHint: "เปิด/ปิดเครื่องมือทั้งหมด แตะเครื่องมือเพื่อดูตัวเลือก",
    personaTitle: "🎭 บุคลิก",
    personaHint: "เลือกโทน วิธีเรียก และภาษาหลักของ Lekha",
    memoryTitle: "🧠 ความจำ",
    memoryHint: "Lekha สกัดข้อเท็จจริงอัตโนมัติทุก N ข้อความ ปิดเพื่อหยุด",
    factsTitle: "📝 ความจำ",
    factsHint: "แสดงความจำ {count} รายการ การลบมีผลทันที",
    noFacts: "ยังไม่มีความจำ แตะ เพิ่มความจำ เพื่อสร้าง",
    localeTitle: "🌐 ภาษาและตำแหน่งที่ตั้ง",
    localeHint: "ตั้งค่าเขตเวลา สถานที่ และภาษาตอบกลับ",
    close: "ปิด",
    back: "← กลับ",
    edit: "แก้ไข",
    turnOn: "เปิด",
    turnOff: "ปิด",
    on: "เปิด",
    off: "ปิด",
    custom: "กำหนดเอง",
    customTime: "กำหนดเวลา…",
    customTimezone: "กำหนดเขตเวลา…",
    customLocation: "กำหนดสถานที่…",
    viewFacts: "ดูความจำ",
    addFact: "เพิ่มความจำ…",
    morningLabel: "เช้า",
    eveningLabel: "เย็น",
    checkinLabel: "เช็คงาน",
    includeUnreadGmail: "รวม Gmail ที่ยังไม่ได้อ่าน",
    lengthLabel: "ความยาว",
    languageLabel: "ภาษา",
    channelsLabel: "ช่องทาง",
    lineChat: "LINE chat",
    emailChannel: "Email",
    pushAlert: "แจ้งเตือน",
    dailyTopics: "หัวข้อสรุปรายวัน",
    timezoneLabel: "เขตเวลา",
    locationLabel: "สถานที่",
    replyLanguageLabel: "ภาษาตอบกลับ",
    currentLabel: "ปัจจุบัน",
    preferredNameLabel: "ชื่อที่ใช้เรียก",
    setPreferredName: "ตั้งชื่อ",
    changePreferredName: "เปลี่ยน",
    toneLabel: "โทน",
    addressYouAsLabel: "วิธีเรียกคุณ",
    primaryLanguageLabel: "ภาษาหลัก",
    matchVoiceLabel: "ปรับให้เหมือนสไตล์การเขียนของคุณ",
    memoryEnabledLabel: "เปิดใช้ความจำ",
    autoCompactLabel: "บีบอัดอัตโนมัติทุก",

    toolTodo: "รายการสิ่งต้องทำ",
    toolReminders: "การแจ้งเตือน",
    toolCalendar: "ปฏิทิน",
    toolEmail: "อีเมล",
    toolDrive: "ไดรฟ์",

    toneWarm: "เป็นกันเอง",
    toneProfessional: "ทางการ",
    tonePlayful: "สนุกสนาน",
    addressingFirstName: "ชื่อจริง",
    addressingKhun: "คุณ",
    addressingSirMadam: "ท่าน",
    addressingNoAddress: "ไม่เรียก",

    // Empty states
    noTasks: "ไม่มีรายการค้าง 🎉",
    noFactsYet: "ยังไม่มีข้อมูล",

    // Tasks
    taskAddError: "บันทึกงานไม่ได้ตอนนี้ ลองใหม่ในอีกสักครู่",
    taskUpdateError: "อัปเดตงานไม่ได้ตอนนี้ ลองใหม่ในอีกสักครู่",
    taskDeleteError: "ลบงานไม่ได้ตอนนี้ ลองใหม่ในอีกสักครู่",
    taskNotFound: "ไม่พบงาน",
    taskNoOpenMatch: 'ไม่พบงานที่เปิดอยู่ตรงกับ "{title}"',
    taskNoCompletedMatch: 'ไม่พบงานที่เสร็จแล้วตรงกับ "{title}"',
    taskNoMatch: 'ไม่พบงานตรงกับ "{title}"',
    taskInvalidDueAt: "วันที่กำหนดไม่ถูกต้อง",
    taskAddItemError: 'บันทึก "{title}" ไม่ได้ตอนนี้',
    dueToday: "วันนี้",
    dueTomorrow: "พรุ่งนี้",

    // Reminders
    reminderScheduleError: "ตั้งเตือนความจำไม่ได้ตอนนี้ ลองใหม่ในอีกสักครู่",

    // Briefings
    morningGreeting: "อรุณสวัสดีค่ะ! ☀️ {date}",
    eveningGreeting: "สวัสดีตอนเย็นค่ะ นี่คือสรุปของคุณ: {date}",
    today: "วันนี้",
    tomorrow: "พรุ่งนี้",
    overdueTitle: "⚠️ เลยกำหนด",
    agendaTitle: "🗓 กำหนดการของคุณ",
    agendaEmpty: "• ไม่มีกำหนดการวันนี้และพรุ่งนี้",
    otherTasksTitle: "📋 งานอื่น ๆ ({count})",
    otherTasksEmpty: "• ไม่มีงานค้างที่ไม่มีกำหนดส่ง",
    recommendationsTitle: "💡 คำแนะนำ",
    recOverdueOne: '⚠️ "{title}" เลยกำหนดแล้ว — จัดการอันนี้ก่อนนะคะ',
    recOverdueMany: "⚠️ เลยกำหนด: {names}{more} เริ่มจากรายการเก่าสุดก่อนค่ะ",
    recDueTodayOne: '📋 "{title}" กำหนดวันนี้',
    recDueTodayTwo: '📋 กำหนดวันนี้: "{title0}" และ "{title1}"',
    recDueTodayMany: "📋 มี {count} งานกำหนดวันนี้: {names}{more} เริ่มจากงานยากก่อนค่ะ",
    recCalendarOne: '📅 วันนี้คุณมี "{title}" ในปฏิทิน — ต้องเตรียมอะไรไหมคะ',
    recCalendarMany: "📅 ตารางแน่น: {names}{more} เว้นช่วงพักระหว่างประชุมนะคะ",
    recReminderOne: '⏰ เตือนความจำ: "{title}"',
    recReminderMany: "⏰ เตือนความจำวันนี้: {names}{more} รวมไว้ในช่วงเดียวกันเลยค่ะ",
    recClearOne: '💡 วันนี้ว่าง — เหมาะจะจัดการ "{title}"',
    recClearMany: '💡 วันนี้ไม่มีกำหนดการ ลองทำ "{title}" ไหมคะ',
    recFiller: '💡 วันนี้ไม่มีงานกำหนดส่ง แต่คุณยังมี "{title}" ค้างอยู่ เหมาะทำช่วงว่างระหว่างนัดหมายค่ะ',
    recPacked: "🔥 วันนี้แน่นมาก พิจารณาเลื่อนรายการที่ไม่เร่งด่วนนะคะ",
    doneTodayTitle: "✅ เสร็จแล้ววันนี้",
    doneTodayEmpty: "• วันนี้ยังไม่มีงานที่เสร็จ",
    stillOpenTitle: "📋 ยังค้างอยู่",
    stillOpenEmpty: "• โล่งแล้ว — ไม่เหลืออะไรค่ะ",
    aheadTitle: "🗓 พรุ่งนี้และต่อไป",
    overdueItemLabel: "[เลยกำหนด]",
    duePrefix: "กำหนด {when}",
    evRecNoDone: "วันนี้ยังไม่ได้ทำงานเลย เริ่มพรุ่งนี้ด้วยงานที่สำคัญที่สุดก่อนนะคะ",
    evRecOverdue: "คุณยังมี {count} งานที่เลยกำหนด จัดการก่อนเป็นอันดับแรกพรุ่งนี้เลยค่ะ",
    evRecBusy: "พรุ่งนี้ดูแน่น เตรียมตัวค่ำนี้เพื่อให้เริ่มต้นได้ดี",
    evRecLight: "พรุ่งนี้ว่าง ใช้เช้าจัดการงานค้างให้หมดเลยค่ะ",
    evRecManyOpen: "ยังมี {count} งานค้างอยู่ ทบทวนว่าอันไหนสำคัญจริง ๆ ในสัปดาห์นี้",
    evRecMeetingsNoTasks: "พรุ่งนี้มีประชุมเยอะ แต่ไม่มีงานกำหนดส่ง เพิ่มรายการเตรียมตัวหรือติดตามผลได้ค่ะ",

    // Flex surfaces
    morningBriefingTitle: "☀️  สรุปประจำเช้า",
    eveningSummaryTitle: "🌙  สรุปประจำเย็น",
    morningCalendarBtn: "ปฏิทินวันนี้มีอะไร?",
    morningTasksBtn: "แสดงงานของฉัน",
    morningInboxBtn: "เช็คอีเมล",
    morningCalendarAction: "ปฏิทินวันนี้มีอะไร",
    morningTasksAction: "แสดงงานของฉัน",
    morningInboxAction: "สรุปอีเมลที่ยังไม่ได้อ่านล่าสุด",

    taskCheckinTitle: "✅  เช็คงานวันนี้",
    taskCheckinSubtitle: "อันไหนที่ทำเสร็จแล้วคะ",
    taskCheckinDoneAll: "เสร็จทั้งหมด",
    taskCheckinDoneAllDisplay: "เสร็จทั้งหมด — ยืนยันก่อน",
    doneAllConfirmTitle: "ทำเครื่องหมาย {count} งานค้างว่าเสร็จ?",
    doneAllConfirmHint: "ทำแล้วย้อนกลับไม่ได้",
    yesDoneAll: "ใช่ เสร็จทั้งหมด",
    yesMarkAllDone: "ใช่ ทำเครื่องหมายทั้งหมด",

    tasksTitle: "งานของคุณ",
    taskHeader: "✅  งาน",
    taskAllDone: "เสร็จหมดแล้ว 🎉",
    taskDoneBtn: "เสร็จ",
    taskReopenBtn: "เปิดใหม่",
    taskOpenCount: "ค้าง {open} · เสร็จ {done}",
    taskOverduePrefix: "เลยกำหนด · ",

    helpTitle: "ความช่วยเหลือ Lekha",
    helpHint: "นี่คือสิ่งที่ฉันทำได้ แตะปุ่มสีเขียวเพื่อดูตัวอย่างคำตอบ:",
    helpTryIt: "ลองเลย",

    googleConnectTitle: "เชื่อมต่อ Google",
    googleConnectDefaultReason: "เชื่อมบัญชี Google เพื่อใช้อีเมล ปฏิทิน และไดรฟ์",
    googleConnectButton: "เชื่อมบัญชี Google",
    googleConnectExpires: "ลิงก์หมดอายุใน 10 นาที",

    confirmQuestion: "ยืนยัน?",
    confirmYesSend: "ใช่ ส่งเลย",
    cancel: "ยกเลิก",

    groupGateTitle: "Lekha ในกลุ่ม",
    groupGateBody: "ต้องใช้แผน Team เพื่อใช้ Lekha ในแชทกลุ่ม",
    groupGateMonthly: "Team รายเดือน — ฿800/เดือน",
    groupGateYearly: "Team รายปี — ฿8,000/ปี",
    newGroupAdminTitle: "บอทถูกเพิ่มในกลุ่ม",
    newGroupAdminIgnore: "🗑 ละเว้น",
    newGroupAdminAllow: "✓ อนุญาต",

    groupWelcome:
      "สวัสดีทุกคน ฉันคือ Lekha 👋\n\nพิมพ์ @Lekha หรือตอบข้อความฉันเมื่อต้องการให้ช่วยเหลือ ฉันสามารถตอบคำถาม ค้นหา ตรวจสอบสภาพอากาศและหุ้น อ่านรูปภาพ และอื่น ๆ ได้",

    briefingChannelHint: "สรุปประจำวันจะส่งที่นี่ในแชท LINE การส่งทางอีเมลจะมาเร็ว ๆ นี้",

    unknownPostback: "ฉันไม่เข้าใจปุ่มนั้น ลองพิมพ์คำขอของคุณแทนนะคะ",

    // Help categories
    helpCatMemoryTitle: "ความจำ",
    helpCatMemoryDesc: "จำข้อเท็จจริง เรียกคืนสิ่งที่รู้ อัปเดตความจำ",
    helpCatMemoryDemo:
      "ฉันจำความชอบ กิจวัตร และรายละเอียดสำคัญของคุณได้ เพื่อไม่ต้องถามซ้ำ บอกอะไรมาก็ได้ — ฉันจะจำไว้",
    helpCatTasksTitle: "งาน",
    helpCatTasksDesc: "เพิ่มงาน ทำเครื่องหมายเสร็จ ดูงานค้าง",
    helpCatTasksDemo:
      "ฉันจะเพิ่มงาน 'โทรหาช่างประปา' ✅\n\n(ตัวอย่างเท่านั้น — ยังไม่ได้สร้างงานจริง)",
    helpCatRemindersTitle: "การแจ้งเตือน",
    helpCatRemindersDesc: "แจ้งเตือนครั้งเดียวหรือซ้ำใน LINE",
    helpCatRemindersDemo:
      "ฉันจะตั้งเตือน: ยืดเส้นยืดสายใน 5 นาที ⏰\n\n(ตัวอย่างเท่านั้น — ยังไม่ได้ตั้งเตือนจริง)",
    helpCatListsTitle: "รายการ",
    helpCatListsDesc: "รายการซื้อของ ของใช้ หรือรายการที่ตั้งชื่อเอง",
    helpCatListsDemo:
      "ฉันจะเพิ่มนมในรายการซื้อของ 🥛\n\n(ตัวอย่างเท่านั้น — รายการยังไม่เปลี่ยน)",
    helpCatEmailTitle: "อีเมลและกล่องจดหมาย",
    helpCatEmailDesc: "เขียน/ส่ง/ค้นหา Gmail (ต้องใช้ Google)",
    helpCatEmailDemo:
      "เมื่อเชื่อม Google แล้ว ฉันสามารถค้นหากล่องจดหมาย เขียนตอบกลับ และส่งอีเมลได้ พิมพ์ 'connect google' เพื่อเชื่อมบัญชี",
    helpCatCalendarTitle: "ปฏิทิน",
    helpCatCalendarDesc: "จัดกำหนดการ ดูนัดหมายที่จะถึง (ต้องใช้ Google)",
    helpCatCalendarDemo:
      "เมื่อเชื่อม Google แล้ว ฉันสามารถตรวจสอบตารางและร่างกำหนดการได้ หากต้องการ ฉันยังเตือนก่อนประชุมได้",
    helpCatDriveTitle: "ไดรฟ์และเอกสาร",
    helpCatDriveDesc: "ค้นหา อัปโหลด อ่านไฟล์ (ต้องใช้ Google)",
    helpCatDriveDemo:
      "ฉันสามารถค้นหาไดรฟ์ รับลิงก์แชร์ อ่านไฟล์ข้อความ และอัปโหลดรูปหรือเอกสารที่คุณส่งมา",
    helpCatMediaTitle: "สื่อ",
    helpCatMediaDesc: "รูปภาพ ข้อความเสียง PDF ไฟล์ Office",
    helpCatMediaDemo:
      "ส่งรูปมาให้อ่านตัวอักษรหรืออธิบายได้ ส่ง PDF มาสรุปให้ได้ ข้อความเสียงก็ได้ค่ะ",
    helpCatReceiptsTitle: "ใบเสร็จ",
    helpCatReceiptsDesc: "สแกน ดู ค้นหาใบเสร็จค่าใช้จ่าย",
    helpCatReceiptsDemo:
      "ส่งรูปใบเสร็จแล้วพิมพ์ 'scan this' ฉันจะบันทึกร้านค้า จำนวนเงิน วันที่ และรายการ เพื่อให้ค้นหาทีหลังได้ 🧾",
    helpCatSearchTitle: "ค้นหาและข้อมูล",
    helpCatSearchDesc: "ค้นหาเว็บ สภาพอากาศ หุ้น ข่าว",
    helpCatSearchDemo:
      "ฉันสามารถค้นหาเว็บ เช็คสภาพอากาศ เช็คราคาหุ้น/คริปโต และหาข่าวได้ ฉันอ้างอิงแหล่งที่มาพร้อมเวลาเสมอ",
    helpCatSettingsTitle: "ตั้งค่า",
    helpCatSettingsDesc: "เขตเวลา สถานที่ ภาษา สรุปประจำวัน",
    helpCatSettingsDemo:
      "ฉันจะตั้งเขตเวลาเป็น Asia/Bangkok 🌏\n\n(ตัวอย่างเท่านั้น — การตั้งค่ายังไม่เปลี่ยน)",

    // Fact categories
    factCategoryPreferences: "ความชอบ",
    factCategoryPeople: "คน",
    factCategoryHabits: "กิจวัตร",
    factCategoryDeadlines: "กำหนดส่ง",
    factCategoryContext: "บริบท",
    factCategoryHealth: "สุขภาพ",
    factCategoryWork: "งาน",
    factCategoryOther: "อื่น ๆ",
  },
};

export type UiKey = keyof typeof UI.en;

export function t(language: string | null | undefined, key: UiKey, vars: Record<string, string> = {}): string {
  const dict = UI[uiLang(language)] ?? UI.en;
  const template = dict[key] ?? UI.en[key] ?? String(key);
  return template.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
}
