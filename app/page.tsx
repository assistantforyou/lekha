import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  LockKeyhole,
  Mail,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { buttonVariantsForLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const capabilities = [
  {
    icon: CalendarDays,
    title: "Keeps your schedule in view",
    body: "See what is coming up, get helpful reminders, and stay prepared for the next thing on your day.",
  },
  {
    icon: Mail,
    title: "Helps with email before you send",
    body: "Draft replies, prepare follow-ups, and double-check the message before anything goes out.",
  },
  {
    icon: Search,
    title: "Finds what you need quickly",
    body: "Pull up past notes, tasks, files, contacts, and useful details without digging through everything yourself.",
  },
  {
    icon: Bell,
    title: "Checks in without being noisy",
    body: "Morning summaries and timely nudges show up when they are useful, not all day long.",
  },
];

const stack = [
  "Works inside LINE",
  "Private by default",
  "Connects with Google",
  "Your approval comes first",
  "Reminders that arrive on time",
  "Keeps track of helpful details",
];

const flow = [
  {
    time: "07:25",
    label: "Morning briefing",
    text: "Two meetings, one flight receipt, and rain likely after 16:00.",
  },
  {
    time: "09:10",
    label: "Draft prepared",
    text: "Reply to Mali with the updated invoice and next Tuesday options.",
  },
  {
    time: "09:11",
    label: "Approval required",
    text: "Send from james@…? The exact message is shown before anything leaves Gmail.",
  },
];

const principles = [
  "Your conversations stay personal to you, not mixed into someone else's account.",
  "Anything important can be reviewed before it is sent or scheduled.",
  "If something goes wrong, Lekha says so clearly instead of pretending everything is fine.",
  "Connecting your account is simple, and Lekha picks back up once you are done.",
];

function MiniMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-l border-white/12 pl-4">
      <div className="text-lg font-semibold tracking-[-0.01em] text-white">{value}</div>
      <div className="mt-1 text-xs leading-5 text-[#a8a29a]">{label}</div>
    </div>
  );
}

function ChatPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <div className="absolute -inset-5 rounded-[2rem] border border-white/[0.04] bg-white/[0.025]" />
      <div className="glass-panel relative overflow-hidden rounded-[1.75rem]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#8de3c2]/14 text-[#8de3c2]">
              <MessageCircle size={20} />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Lekha in LINE</div>
              <div className="text-xs text-[#a8a29a]">Private assistant, online</div>
            </div>
          </div>
          <div className="rounded-full border border-[#8de3c2]/25 bg-[#8de3c2]/10 px-2.5 py-1 text-[11px] font-medium text-[#d7fff1]">
            gated
          </div>
        </div>

        <div className="space-y-4 px-4 py-5">
          <div className="max-w-[78%] rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.055] px-4 py-3 text-sm leading-6 text-[#ebe7df]">
            Brief me before my next call and draft the follow-up email.
          </div>
          <div className="ml-auto max-w-[86%] rounded-2xl rounded-tr-md bg-[#d7fff1] px-4 py-3 text-sm leading-6 text-[#07100c] shadow-[0_16px_42px_rgba(141,227,194,0.16)]">
            Your call with Ari starts at 10:30. I found the last thread, the proposal in Drive, and two open tasks.
          </div>
          <div className="ml-auto max-w-[86%] rounded-2xl rounded-tr-md border border-[#8de3c2]/22 bg-[#8de3c2]/10 px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#d7fff1]">
              <ShieldCheck size={14} />
              Confirmation
            </div>
            <p className="text-sm leading-6 text-[#ebe7df]">
              Draft ready. I’ll only send after you approve the exact body.
            </p>
            <div className="mt-3 flex gap-2">
              <span className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#090a0a]">Approve</span>
              <span className="rounded-md border border-white/12 px-3 py-1.5 text-xs font-semibold text-[#d7d0c6]">
                Edit
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/18 px-5 py-4">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/22 px-3 py-2 text-sm text-[#a8a29a]">
            <Sparkles size={15} className="text-[#8de3c2]" />
            Message Lekha…
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <a href="#top" className="flex items-center gap-3" aria-label="Lekha home">
          <div className="flex size-9 items-center justify-center rounded-lg border border-white/12 bg-white/[0.055] text-sm font-semibold text-white">
            L
          </div>
          <span className="text-sm font-semibold tracking-[0.18em] text-white/90">LEKHA</span>
        </a>
        <nav className="hidden items-center gap-6 text-sm text-[#bdb6ad] md:flex">
          <a className="transition hover:text-white" href="#capabilities">
            Capabilities
          </a>
          <a className="transition hover:text-white" href="#trust">
            Trust
          </a>
          <a className="transition hover:text-white" href="#rhythm">
            Rhythm
          </a>
        </nav>
        <a
          href="https://line.me/"
          className={buttonVariantsForLink({ variant: "secondary", size: "sm" })}
        >
          Open LINE
          <ArrowRight size={14} />
        </a>
      </header>

      <section id="top" className="mx-auto grid w-full max-w-7xl gap-12 px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-10">
        <Reveal className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.045] px-3 py-1.5 text-xs font-medium text-[#cfc8bd]">
            <span className="size-1.5 rounded-full bg-[#8de3c2]" />
            Personal assistant for LINE
          </div>
          <h1 className="text-balance text-5xl font-semibold tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
            Lekha
            <span className="serif block pt-2 text-[#d8d1c6]">keeps the day moving.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-[#bdb6ad] sm:text-xl">
            A calm assistant inside LINE that helps you remember things, prepare messages,
            stay on top of your schedule, and handle everyday tasks with less effort.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#capabilities" className={buttonVariantsForLink({ size: "lg" })}>
              See the product
              <ChevronRight size={16} />
            </a>
            <a href="#trust" className={buttonVariantsForLink({ variant: "secondary", size: "lg" })}>
              Review safeguards
            </a>
          </div>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-4">
            <MiniMetric value="Private" label="built for personal use" />
            <MiniMetric value="Helpful" label="checks in at the right time" />
            <MiniMetric value="Careful" label="asks before big actions" />
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <ChatPreview />
        </Reveal>
      </section>

      <div className="hairline mx-auto h-px max-w-6xl" />

      <section id="capabilities" className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:px-10">
        <Reveal className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8de3c2]">
              What It Helps With
            </p>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">
              Built for the small tasks that quietly take up your day.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {capabilities.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="rounded-xl border border-white/10 bg-white/[0.035] p-5 transition duration-200 hover:border-white/18 hover:bg-white/[0.055]"
                >
                  <div className="mb-5 flex size-10 items-center justify-center rounded-lg border border-white/10 bg-black/18 text-[#8de3c2]">
                    <Icon size={19} />
                  </div>
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#aaa39a]">{item.body}</p>
                </article>
              );
            })}
          </div>
        </Reveal>
      </section>

      <section id="trust" className="mx-auto w-full max-w-7xl px-5 pb-16 sm:px-8 sm:pb-24 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal className="glass-panel rounded-2xl p-6 sm:p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#e7c88d]">
                  Peace of Mind
                </p>
                <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">
                  Helpful, careful, and respectful of your personal space.
                </h2>
              </div>
              <div className="hidden size-12 items-center justify-center rounded-xl border border-white/12 bg-white/[0.045] text-[#e7c88d] sm:flex">
                <LockKeyhole size={22} />
              </div>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {principles.map((principle) => (
                <div key={principle} className="flex gap-3 rounded-xl border border-white/10 bg-black/16 p-4">
                  <Check className="mt-0.5 shrink-0 text-[#8de3c2]" size={17} />
                  <p className="text-sm leading-6 text-[#d6d0c7]">{principle}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.08} className="rounded-2xl border border-white/10 bg-[#0f100f] p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8de3c2]">
              Works With Your Day
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {stack.map((item) => (
                <span
                  key={item}
                  className="rounded-md border border-white/10 bg-white/[0.045] px-3 py-2 text-sm text-[#d6d0c7]"
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-8 space-y-4">
              {[
                ["Messages and email", "Helps you draft replies, prepare follow-ups, and keep conversations moving."],
                ["Calendar and files", "Brings together your schedule, documents, and important context when you need them."],
                ["Reminders and check-ins", "Can nudge you at the right moment so fewer things slip through the cracks."],
              ].map(([title, body]) => (
                <div key={title} className="border-t border-white/10 pt-4">
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="mt-1 text-sm leading-6 text-[#a8a29a]">{body}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section id="rhythm" className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8 sm:pb-28 lg:px-10">
        <Reveal className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8de3c2]">
              Daily Rhythm
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">
              Assistance that feels timely instead of noisy.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#b4ada4]">
              Lekha is most useful when it helps you feel a little more prepared:
              fewer loose ends, less backtracking, and gentle support at the moments that matter.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            {flow.map((item, index) => (
              <div
                key={item.label}
                className={cn(
                  "grid gap-4 rounded-xl p-4 sm:grid-cols-[92px_1fr]",
                  index === 1 && "bg-white/[0.055]",
                )}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-[#e7c88d]">
                  <Clock3 size={15} />
                  {item.time}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{item.label}</div>
                  <p className="mt-1 text-sm leading-6 text-[#aaa39a]">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-white/10 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-[#8f887f] sm:flex-row sm:items-center sm:justify-between">
          <div>Lekha is a private personal assistant that lives in LINE.</div>
          <div className="flex items-center gap-2">
            <FileText size={15} />
            Designed to be helpful without taking over.
          </div>
        </div>
      </footer>
    </main>
  );
}
