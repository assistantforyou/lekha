"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";

// ── Constants ────────────────────────────────────────────────────────────────

const LINE_URL = "https://line.me/R/ti/p/%40737gfqnj";
const HERO_FRAMES = ["screenshot-1a.png", "screenshot-1b.png", "screenshot-1c.png"] as const;

// ── Copy ─────────────────────────────────────────────────────────────────────

type Lang = "en" | "th";

interface SceneData {
  num: string;
  heading: string;
  body: string;
  shot: string;
  reverse?: boolean;
}

interface FaqItem {
  q: string;
  a: string;
}

interface TrustItem {
  head: string;
  body: string;
}

interface PeaceItem {
  head: string;
  body: string;
}

interface CopyData {
  navPricing: string;
  navFaq: string;
  headline: string;
  subhead: string;
  cta: string;
  heroCta2: string;
  heroTagline: string;
  trust: TrustItem[];
  scenesIntro: string;
  scenes: SceneData[];
  scene4: { num: string; heading: string; body: string; shot: string };
  capHeading: string;
  capLeft: string[];
  capRight: string[];
  capFootnote: string;
  pricingHeading: string;
  periodYearly: string;
  periodMonthly: string;
  plusName: string;
  plusSubtitle: string;
  plusSavings: string;
  plusBullets: string[];
  plusCta: string;
  bizName: string;
  bizSubtitle: string;
  bizSavings: string;
  bizBullets: string[];
  bizCta: string;
  pricingNote: string;
  pricingNote2: string;
  peaceItems: PeaceItem[];
  pdpaHead: string;
  pdpaBody: string;
  pdpaCaption: string;
  whatDoesntHeading: string;
  whatDoesnt: string[];
  howHeading: string;
  howSteps: string[];
  faqHeading: string;
  faq: FaqItem[];
  emailHeading: string;
  emailSubhead: string;
  emailPlaceholder: string;
  emailCta: string;
  emailSuccess: string;
  emailError: string;
  footerTagline: string;
  footerLinks: string[];
  builtIn: string;
  mostPopular: string;
}

const COPY: Record<Lang, CopyData> = {
  en: {
    navPricing: "Pricing",
    navFaq: "FAQ",
    headline: "A secretary who lives in your LINE.",
    subhead:
      "She drafts your email, sends it, watches your calendar, and remembers what matters.",
    cta: "Start free for 7 days",
    heroCta2: "See how she works",
    heroTagline: "No setup. Works inside the LINE you already have.",
    trust: [
      { head: "Inside LINE.", body: "No new app to download." },
      {
        head: "Asks first.",
        body: "She drafts and confirms. Nothing sends without you.",
      },
      {
        head: "Remembers what matters.",
        body: "Your people, your projects, your preferences.",
      },
    ],
    scenesIntro: "A few moments from a normal day with Lekha.",
    scenes: [
      {
        num: "01",
        heading: "Receipts handle themselves",
        body: "Send Lekha a photo of a receipt and tell her where it goes. She reads the photo, writes the email, attaches the file, and waits for your okay. After you say yes, she sends it and files a copy in your Drive. The kind of small task that quietly eats your afternoons — gone.",
        shot: "screenshot-1b.png",
        reverse: false,
      },
      {
        num: "02",
        heading: "Mornings, briefly",
        body: "At 7am, one short message. What's on your calendar, what's still open, anything you asked her to flag. Then she's quiet until you need her. Lekha doesn't notify you all day — she notifies you at the moments that actually matter.",
        shot: "screenshot-2.png",
        reverse: true,
      },
      {
        num: "03",
        heading: "She remembers",
        body: "Tell her once that you prefer Sarnies for lunch meetings, or that Khun Mali handles your invoices, or that Tuesdays are blocked for deep work. She'll bring it up next time it's relevant — without you having to repeat yourself.",
        shot: "screenshot-6.png",
        reverse: false,
      },
    ],
    scene4: {
      num: "04",
      heading: "And in Thai, naturally.",
      body: "Message her in Thai, English, or both. She'll match you.",
      shot: "screenshot-5.png",
    },
    capHeading: "Things Lekha handles for you",
    capLeft: [
      "Drafts and sends your emails",
      "Manages your calendar",
      "Sets reminders that arrive on time",
      "Searches and reads your Drive",
    ],
    capRight: [
      "Reads photos, receipts, PDFs",
      "Transcribes voice notes",
      "Sends a quiet morning briefing",
      "Speaks naturally in Thai and English",
    ],
    capFootnote: "All gated by your approval. She drafts, you confirm.",
    pricingHeading: "Two plans. Both start free.",
    periodYearly: "Yearly",
    periodMonthly: "Monthly",
    plusName: "Lekha Plus",
    plusSubtitle: "For one person and one busy life.",
    plusSavings: "Save 1,180 ฿ — 2 months free",
    plusBullets: [
      "Email drafts and sends",
      "Calendar management",
      "Reminders and morning briefings",
      "Photo and PDF reading",
      "Drive search",
      "1 Google account",
    ],
    plusCta: "Start Plus free for 7 days",
    bizName: "Lekha Business",
    bizSubtitle: "For people running things.",
    bizSavings: "Save 2,980 ฿ — 2 months free",
    bizBullets: [
      "Everything in Plus",
      "Up to 3 Google accounts",
      "Priority responses",
      "Strict-privacy mode",
      "Free 30-min setup call with the maker",
    ],
    bizCta: "Start Business free for 7 days",
    pricingNote:
      "7-day free trial on every plan. Cancel anytime by messaging Lekha 'cancel'.",
    pricingNote2: "PromptPay auto-debit, credit card, QR, or bank transfer.",
    peaceItems: [
      { head: "Your chat is yours.", body: "Each person's data is isolated and private." },
      {
        head: "Nothing leaves without your okay.",
        body: "She drafts. You confirm. Then she acts.",
      },
      {
        head: "Connecting Google takes one tap.",
        body: "Sign in once. Disconnect anytime.",
      },
    ],
    pdpaHead: "PDPA-compliant. Your data stays in Asia.",
    pdpaBody:
      "Encrypted at rest. Never used to train any model. Never shared. Business adds strict-privacy mode: 24-hour retention max, audit log access, on-demand deletion.",
    pdpaCaption: "One tap to connect. One tap to leave.",
    whatDoesntHeading: "What Lekha doesn't do.",
    whatDoesnt: [
      "We don't train any model on your messages.",
      "We don't read your inbox or files in the background.",
      "We don't sell or share your data.",
      "We don't keep what you delete.",
    ],
    howHeading: "How it works.",
    howSteps: [
      "Add Lekha as a LINE friend.",
      "Connect your Google account in one tap.",
      "Message her like you'd message a friend.",
    ],
    faqHeading: "Questions.",
    faq: [
      { q: "Do I need to install anything?", a: "No. Lekha is just a contact in LINE." },
      {
        q: "Does Lekha speak Thai?",
        a: "Yes — in Thai, English, or both. She matches how you write.",
      },
      {
        q: "Is my data safe?",
        a: "Encrypted at rest, never used for training, never shared. Business plan adds strict-privacy mode with 24-hour retention.",
      },
      {
        q: "What if I want to stop?",
        a: "Block or remove Lekha in LINE anytime. Your data goes with you.",
      },
      {
        q: "Can I connect more than one Google account?",
        a: "Up to 3 on Business. Plus supports 1.",
      },
      {
        q: "How does the free trial work?",
        a: "Start any plan. You're not charged for 7 days. Cancel anytime by messaging Lekha 'cancel'.",
      },
      {
        q: "Who built Lekha?",
        a: "A solo developer in Bangkok. You can email me directly — link in the footer.",
      },
    ],
    emailHeading: "Not ready yet?",
    emailSubhead:
      "One short email a month. New ways Lekha is helping people. Nothing else.",
    emailPlaceholder: "your@email.com",
    emailCta: "Send me updates",
    emailSuccess: "Got it, talk soon.",
    emailError: "Something went wrong. Please try again.",
    footerTagline: "A quiet hand for your busy day.",
    footerLinks: ["Privacy", "Terms", "PDPA", "Contact", "GitHub"],
    builtIn: "สร้างในประเทศไทย · Built in Bangkok",
    mostPopular: "Most popular",
  },

  th: {
    navPricing: "[TH: ราคา]",
    navFaq: "[TH: คำถาม]",
    headline: "[TH: เลขาส่วนตัวอยู่ใน LINE ของคุณ]",
    subhead: "[TH: เธอร่างอีเมล ส่ง ดูแลปฏิทิน และจำสิ่งสำคัญให้คุณ]",
    cta: "[TH: เริ่มฟรี 7 วัน]",
    heroCta2: "[TH: ดูวิธีทำงาน]",
    heroTagline: "[TH: ไม่ต้องติดตั้ง ทำงานใน LINE ที่คุณมีอยู่แล้ว]",
    trust: [
      { head: "[TH: อยู่ใน LINE]", body: "[TH: ไม่ต้องดาวน์โหลดแอปใหม่]" },
      {
        head: "[TH: ถามก่อนเสมอ]",
        body: "[TH: เธอร่างและยืนยัน ไม่ส่งโดยไม่ได้รับอนุมัติ]",
      },
      {
        head: "[TH: จำสิ่งสำคัญ]",
        body: "[TH: ผู้คน โปรเจกต์ และความชอบของคุณ]",
      },
    ],
    scenesIntro: "[TH: ช่วงเวลาจากวันทำงานกับเลขา]",
    scenes: [
      {
        num: "01",
        heading: "[TH: ใบเสร็จจัดการเอง]",
        body: "[TH: ส่งรูปใบเสร็จให้เลขาและบอกว่าจะส่งไปไหน เธอจะอ่านรูป เขียนอีเมล แนบไฟล์ และรอการยืนยันจากคุณ]",
        shot: "screenshot-1b.png",
        reverse: false,
      },
      {
        num: "02",
        heading: "[TH: เช้าสั้นๆ]",
        body: "[TH: ตี 7 ข้อความสั้นหนึ่งข้อ บอกสิ่งที่อยู่ในปฏิทิน งานที่ค้างอยู่ และสิ่งที่คุณขอให้แจ้งเตือน]",
        shot: "screenshot-2.png",
        reverse: true,
      },
      {
        num: "03",
        heading: "[TH: เธอจำ]",
        body: "[TH: บอกเธอครั้งเดียวว่าคุณชอบ Sarnies สำหรับมื้อเที่ยง หรือว่าคุณมาลีจัดการใบแจ้งหนี้]",
        shot: "screenshot-6.png",
        reverse: false,
      },
    ],
    scene4: {
      num: "04",
      heading: "[TH: และเป็นภาษาไทย โดยธรรมชาติ]",
      body: "[TH: ส่งข้อความเป็นภาษาไทย อังกฤษ หรือทั้งสอง เธอจะตอบตามคุณ]",
      shot: "screenshot-5.png",
    },
    capHeading: "[TH: สิ่งที่เลขาจัดการให้คุณ]",
    capLeft: [
      "[TH: ร่างและส่งอีเมล]",
      "[TH: จัดการปฏิทิน]",
      "[TH: ตั้งการแจ้งเตือนที่ตรงเวลา]",
      "[TH: ค้นหาและอ่านไฟล์ใน Drive]",
    ],
    capRight: [
      "[TH: อ่านรูปภาพ ใบเสร็จ PDF]",
      "[TH: ถอดความบันทึกเสียง]",
      "[TH: ส่งสรุปตอนเช้าอย่างเงียบๆ]",
      "[TH: พูดภาษาไทยและอังกฤษได้อย่างเป็นธรรมชาติ]",
    ],
    capFootnote: "[TH: ทั้งหมดต้องผ่านการอนุมัติ เธอร่าง คุณยืนยัน]",
    pricingHeading: "[TH: สองแผน ทั้งคู่เริ่มฟรี]",
    periodYearly: "[TH: รายปี]",
    periodMonthly: "[TH: รายเดือน]",
    plusName: "Lekha Plus",
    plusSubtitle: "[TH: สำหรับหนึ่งคนและชีวิตที่ยุ่ง]",
    plusSavings: "ประหยัด 1,180 ฿",
    plusBullets: [
      "[TH: ร่างและส่งอีเมล]",
      "[TH: จัดการปฏิทิน]",
      "[TH: การแจ้งเตือนและสรุปตอนเช้า]",
      "[TH: อ่านรูปภาพและ PDF]",
      "[TH: ค้นหาใน Drive]",
      "[TH: 1 บัญชี Google]",
    ],
    plusCta: "[TH: เริ่มทดลอง Plus ฟรี 7 วัน]",
    bizName: "Lekha Business",
    bizSubtitle: "[TH: สำหรับคนที่บริหารงาน]",
    bizSavings: "ประหยัด 2,980 ฿",
    bizBullets: [
      "[TH: ทุกอย่างใน Plus]",
      "[TH: สูงสุด 3 บัญชี Google]",
      "[TH: การตอบสนองที่ให้ความสำคัญ]",
      "[TH: โหมดความเป็นส่วนตัวเข้มงวด]",
      "[TH: โทรเซ็ตอัพฟรี 30 นาที]",
    ],
    bizCta: "[TH: เริ่มทดลอง Business ฟรี 7 วัน]",
    pricingNote:
      "[TH: ทดลองฟรี 7 วันทุกแผน ยกเลิกได้โดยส่ง 'cancel' ถึงเลขา]",
    pricingNote2: "[TH: พร้อมเพย์ บัตรเครดิต QR หรือโอนเงิน]",
    peaceItems: [
      {
        head: "[TH: แชทของคุณเป็นของคุณ]",
        body: "[TH: ข้อมูลของแต่ละคนถูกแยกและเป็นส่วนตัว]",
      },
      {
        head: "[TH: ไม่มีอะไรออกไปโดยไม่ได้รับอนุมัติ]",
        body: "[TH: เธอร่าง คุณยืนยัน แล้วเธอจึงดำเนินการ]",
      },
      {
        head: "[TH: เชื่อมต่อ Google ด้วยแตะเดียว]",
        body: "[TH: ลงชื่อเข้าใช้ครั้งเดียว ยกเลิกได้ทุกเมื่อ]",
      },
    ],
    pdpaHead: "[TH: สอดคล้อง PDPA ข้อมูลอยู่ในเอเชีย]",
    pdpaBody:
      "[TH: เข้ารหัสที่จัดเก็บ ไม่เคยใช้ฝึกโมเดลใดๆ ไม่เคยแบ่งปัน Business เพิ่มโหมดความเป็นส่วนตัวเข้มงวด: การเก็บข้อมูลสูงสุด 24 ชั่วโมง]",
    pdpaCaption: "[TH: แตะเดียวเชื่อมต่อ แตะเดียวออก]",
    whatDoesntHeading: "[TH: สิ่งที่เลขาไม่ทำ]",
    whatDoesnt: [
      "[TH: เราไม่ฝึกโมเดลใดๆ ด้วยข้อความของคุณ]",
      "[TH: เราไม่อ่านกล่องจดหมายหรือไฟล์ของคุณในพื้นหลัง]",
      "[TH: เราไม่ขายหรือแบ่งปันข้อมูลของคุณ]",
      "[TH: เราไม่เก็บสิ่งที่คุณลบ]",
    ],
    howHeading: "[TH: วิธีการทำงาน]",
    howSteps: [
      "[TH: เพิ่มเลขาเป็นเพื่อน LINE]",
      "[TH: เชื่อมต่อบัญชี Google ด้วยแตะเดียว]",
      "[TH: ส่งข้อความหาเธอเหมือนส่งถึงเพื่อน]",
    ],
    faqHeading: "[TH: คำถาม]",
    faq: [
      {
        q: "[TH: ต้องติดตั้งอะไรไหม?]",
        a: "[TH: ไม่ เลขาเป็นแค่ผู้ติดต่อใน LINE]",
      },
      {
        q: "[TH: เลขาพูดภาษาไทยได้ไหม?]",
        a: "[TH: ได้ ทั้งไทย อังกฤษ หรือทั้งสอง]",
      },
      {
        q: "[TH: ข้อมูลของฉันปลอดภัยไหม?]",
        a: "[TH: เข้ารหัสที่จัดเก็บ ไม่เคยใช้ฝึก ไม่เคยแบ่งปัน]",
      },
      {
        q: "[TH: ถ้าต้องการหยุดใช้ทำอย่างไร?]",
        a: "[TH: บล็อกหรือลบเลขาใน LINE เมื่อใดก็ได้]",
      },
      {
        q: "[TH: เชื่อมต่อหลายบัญชีได้ไหม?]",
        a: "[TH: สูงสุด 3 บัญชีใน Business Plus รองรับ 1]",
      },
      {
        q: "[TH: การทดลองฟรีทำงานอย่างไร?]",
        a: "[TH: เริ่มแผนใดก็ได้ ไม่เสียค่าใช้จ่าย 7 วัน]",
      },
      {
        q: "[TH: ใครสร้างเลขา?]",
        a: "[TH: นักพัฒนาคนเดียวในกรุงเทพฯ อีเมลได้โดยตรง]",
      },
    ],
    emailHeading: "[TH: ยังไม่พร้อม?]",
    emailSubhead:
      "[TH: อีเมลสั้นหนึ่งฉบับต่อเดือน วิธีใหม่ที่เลขากำลังช่วยผู้คน ไม่มีอื่น]",
    emailPlaceholder: "[TH: อีเมลของคุณ]",
    emailCta: "[TH: ส่งอัปเดต]",
    emailSuccess: "[TH: Got it, talk soon.]",
    emailError: "[TH: เกิดข้อผิดพลาด กรุณาลองใหม่]",
    footerTagline: "[TH: มือเงียบสำหรับวันที่ยุ่งของคุณ]",
    footerLinks: ["[TH: นโยบาย]", "[TH: ข้อกำหนด]", "PDPA", "[TH: ติดต่อ]", "GitHub"],
    builtIn: "สร้างในประเทศไทย · Built in Bangkok",
    mostPopular: "Most popular",
  },
};

// ── Page component ────────────────────────────────────────────────────────────

export default function HomePage() {
  const [lang, setLang] = useState<Lang>("en");
  const [period, setPeriod] = useState<"yearly" | "monthly">("yearly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [heroGone, setHeroGone] = useState(false);
  const [heroFrame, setHeroFrame] = useState(1); // start at 1b (index 1) for reduced-motion
  const [scrolled, setScrolled] = useState(false);
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "success" | "error">("idle");
  const heroAnchorRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useRef(false);

  const c = COPY[lang];

  // Detect reduced motion preference
  useEffect(() => {
    reducedMotion.current =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion.current) {
      setHeroFrame(0); // start at 1a when motion is allowed
    }
  }, []);

  // Hero crossfade loop — 4s hold per frame, 600ms CSS crossfade
  useEffect(() => {
    if (reducedMotion.current) return;

    const tick = () => {
      if (document.visibilityState === "hidden") return;
      setHeroFrame((f) => (f + 1) % HERO_FRAMES.length);
    };
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, []);

  // Scroll state for nav frosting
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // IntersectionObserver for mobile CTA sentinel
  useEffect(() => {
    const el = heroAnchorRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setHeroGone(!entry!.isIntersecting),
      { rootMargin: "-60px 0px 0px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleEmailSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!email.includes("@")) return;
      try {
        const res = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        setEmailStatus(res.ok ? "success" : "error");
      } catch {
        setEmailStatus("error");
      }
    },
    [email],
  );

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1F1B16]">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav
        className={[
          "fixed top-0 left-0 right-0 z-[1000] h-[60px]",
          "flex items-center justify-between",
          "px-5 sm:px-[clamp(20px,5vw,48px)]",
          "transition-all duration-300",
          scrolled
            ? "bg-[rgba(250,247,242,0.96)] backdrop-blur-[20px] saturate-[180%] border-b border-[rgba(221,208,195,0.55)]"
            : "bg-transparent border-b border-transparent",
        ].join(" ")}
      >
        <button
          onClick={() => scrollTo("hero")}
          className="flex-shrink-0"
          aria-label="Back to top"
        >
          <Wordmark />
        </button>

        <div className="hidden md:flex items-center gap-7">
          <button
            onClick={() => scrollTo("pricing")}
            className="text-[14px] text-[#6B5E52] hover:text-[#1F1B16] transition-colors duration-150"
          >
            {c.navPricing}
          </button>
          <button
            onClick={() => scrollTo("faq")}
            className="text-[14px] text-[#6B5E52] hover:text-[#1F1B16] transition-colors duration-150"
          >
            {c.navFaq}
          </button>
          <button
            onClick={() => setLang((l) => (l === "en" ? "th" : "en"))}
            className="flex items-center gap-[3px] text-[13px] bg-transparent border-none cursor-pointer p-0"
          >
            <span
              className={`transition-colors duration-150 ${lang === "th" ? "text-[#1F1B16] font-semibold" : "text-[#9E8E82] font-normal"}`}
            >
              TH
            </span>
            <span className="text-[#C8BAB0] font-light mx-[2px]">|</span>
            <span
              className={`transition-colors duration-150 ${lang === "en" ? "text-[#1F1B16] font-semibold" : "text-[#9E8E82] font-normal"}`}
            >
              EN
            </span>
          </button>
        </div>

        <BtnPrimary href="#pricing" size="sm" onClick={() => scrollTo("pricing")}>
          {c.cta}
        </BtnPrimary>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        id="hero"
        className="bg-[#FAF7F2] pt-[60px]"
      >
        <div
          className="max-w-[1100px] mx-auto px-5 sm:px-[clamp(20px,5vw,48px)]"
          style={{ paddingTop: "52px", paddingBottom: "72px" }}
        >
          {/* Two-col on md+, stacked on mobile */}
          <div className="flex flex-col gap-12 md:grid md:grid-cols-[55fr_45fr] md:gap-16 md:items-center md:min-h-[72vh]">

            {/* Text */}
            <div className="flex flex-col items-start gap-6">
              <h1
                className="[font-family:var(--font-display)] text-[2.5rem] sm:text-[clamp(2.75rem,4vw,3.75rem)] leading-[1.08] tracking-[-0.025em] text-[#1F1B16] font-normal max-w-[560px]"
                style={{ textWrap: "balance" } as React.CSSProperties}
              >
                {c.headline}
              </h1>

              <p
                className="text-[16px] sm:text-[18px] leading-[1.65] text-[#6B5E52] font-light max-w-[460px]"
                style={{ textWrap: "pretty" } as React.CSSProperties}
              >
                {c.subhead}
              </p>

              <div className="flex flex-wrap gap-3 items-center">
                <BtnPrimary href={LINE_URL} size="lg">
                  {c.cta}
                </BtnPrimary>
                <BtnGhost
                  onClick={() => scrollTo("scenes")}
                  size="lg"
                >
                  {c.heroCta2}
                </BtnGhost>
              </div>

              <p className="text-[13px] text-[#9E8E82] -mt-1">{c.heroTagline}</p>
            </div>

            {/* Crossfade phone */}
            <div className="flex justify-center md:justify-end md:pt-2">
              <div className="relative flex-shrink-0" style={{ width: 268 }}>
                <PhoneFrameCrossfade
                  frames={HERO_FRAMES}
                  activeFrame={heroFrame}
                  width={268}
                  priority
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Sentinel for mobile CTA */}
      <div ref={heroAnchorRef} style={{ height: 0 }} />

      {/* ── Trust Band ───────────────────────────────────────────────────── */}
      <div className="bg-[#F3EDE4] border-t border-b border-[#DDD0C3]">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-[clamp(20px,5vw,48px)]">
          <div className="flex flex-col sm:flex-row">
            {c.trust.map((item, i) => (
              <div
                key={i}
                className={[
                  "flex-1 py-7 sm:py-7",
                  i < c.trust.length - 1
                    ? "border-b sm:border-b-0 sm:border-r border-[#DDD0C3]"
                    : "",
                  i === 0 ? "sm:pr-7" : i === c.trust.length - 1 ? "sm:pl-7" : "sm:px-7",
                ].join(" ")}
              >
                <div className="text-[15px] font-semibold text-[#1F1B16] mb-1.5">
                  {item.head}
                </div>
                <div className="text-[14px] text-[#6B5E52] leading-[1.6]">{item.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scenes ───────────────────────────────────────────────────────── */}
      <section id="scenes" className="bg-[#FAF7F2]">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-[clamp(20px,5vw,48px)]">

          {/* Intro */}
          <div className="pt-12 sm:pt-[72px]">
            <p className="[font-family:var(--font-display)] italic text-[15px] sm:text-[17px] text-[#9E8E82] tracking-[0.01em]">
              {c.scenesIntro}
            </p>
          </div>

          {/* Scene rows */}
          {c.scenes.map((scene, i) => (
            <div
              key={i}
              className={[
                "flex flex-col gap-7 py-11 sm:py-[72px] border-b border-[#DDD0C3]",
                "sm:flex-row sm:items-center sm:gap-20",
                scene.reverse ? "sm:flex-row-reverse" : "",
              ].join(" ")}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-[#9E8E82] tracking-[0.1em] uppercase mb-4">
                  {scene.num}
                </div>
                <h3
                  className="[font-family:var(--font-display)] text-[1.625rem] sm:text-[2rem] font-normal text-[#1F1B16] leading-[1.2] tracking-[-0.02em] mb-5"
                >
                  {scene.heading}
                </h3>
                <p
                  className="text-[16px] leading-[1.8] text-[#6B5E52] font-light"
                  style={{ textWrap: "pretty" } as React.CSSProperties}
                >
                  {scene.body}
                </p>
              </div>
              <div className="flex-shrink-0 self-center sm:self-auto">
                <PhoneFrame src={scene.shot} width={240} />
              </div>
            </div>
          ))}

          {/* Scene 4 — Thai */}
          <div className="flex flex-col gap-7 py-11 sm:py-16 sm:flex-row sm:items-center sm:gap-14">
            <div className="flex-1">
              <div className="text-[11px] font-semibold text-[#9E8E82] tracking-[0.1em] uppercase mb-4">
                {c.scene4.num}
              </div>
              <h3 className="[font-family:var(--font-display)] text-[1.5rem] sm:text-[1.875rem] font-normal text-[#1F1B16] leading-[1.2] tracking-[-0.02em] mb-4">
                {c.scene4.heading}
              </h3>
              <p className="text-[16px] leading-[1.75] text-[#6B5E52] font-light">
                {c.scene4.body}
              </p>
            </div>
            <div className="flex-shrink-0 self-center sm:self-auto">
              <PhoneFrame src={c.scene4.shot} width={176} />
            </div>
          </div>

        </div>
      </section>

      {/* ── Capabilities ─────────────────────────────────────────────────── */}
      <section className="bg-[#FAF7F2] py-16 sm:py-20 border-t border-[#DDD0C3]">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-[clamp(20px,5vw,48px)]">
          <h2 className="[font-family:var(--font-display)] text-[1.75rem] sm:text-[2.25rem] font-normal text-[#1F1B16] tracking-[-0.025em] mb-8 sm:mb-12 max-w-[520px]">
            {c.capHeading}
          </h2>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 max-w-[700px] border-t border-[#DDD0C3]"
            style={{ gap: "0 56px" }}
          >
            <div className="border-r-0 sm:border-r border-[#DDD0C3] pr-0 sm:pr-7">
              {c.capLeft.map((text, i) => (
                <div
                  key={i}
                  className={`py-3.5 text-[15px] text-[#1F1B16] leading-[1.4] ${i < c.capLeft.length - 1 ? "border-b border-[#DDD0C3]" : ""}`}
                >
                  {text}
                </div>
              ))}
            </div>
            <div className="border-t sm:border-t-0 border-[#DDD0C3] pl-0 sm:pl-7">
              {c.capRight.map((text, i) => (
                <div
                  key={i}
                  className={`py-3.5 text-[15px] text-[#1F1B16] leading-[1.4] ${i < c.capRight.length - 1 ? "border-b border-[#DDD0C3]" : ""}`}
                >
                  {text}
                </div>
              ))}
            </div>
          </div>

          <p className="text-[13px] italic text-[#9E8E82] mt-6">{c.capFootnote}</p>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="bg-[#F3EDE4] py-16 sm:py-20 border-t border-[#DDD0C3]">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-[clamp(20px,5vw,48px)]">

          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="[font-family:var(--font-display)] text-[2rem] sm:text-[2.75rem] font-normal text-[#1F1B16] tracking-[-0.025em] mb-8">
              {c.pricingHeading}
            </h2>

            {/* Toggle */}
            <div className="inline-flex bg-[#EDE5DA] rounded-full p-[3px] gap-0">
              {(["yearly", "monthly"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={[
                    "text-[14px] px-[22px] py-2 rounded-full border-none cursor-pointer transition-all duration-200",
                    period === p
                      ? "bg-white text-[#1F1B16] font-semibold shadow-sm"
                      : "bg-transparent text-[#6B5E52] font-normal",
                  ].join(" ")}
                >
                  {p === "yearly" ? c.periodYearly : c.periodMonthly}
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-[780px] mx-auto">
            <PricingCard
              name={c.plusName}
              subtitle={c.plusSubtitle}
              period={period}
              yearly={492}
              monthly={590}
              yearlyTotal={5900}
              savings={c.plusSavings}
              bullets={c.plusBullets}
              cta={c.plusCta}
              accent={false}
              mostPopular={c.mostPopular}
            />
            <PricingCard
              name={c.bizName}
              subtitle={c.bizSubtitle}
              period={period}
              yearly={1242}
              monthly={1490}
              yearlyTotal={14900}
              savings={c.bizSavings}
              bullets={c.bizBullets}
              cta={c.bizCta}
              accent={true}
              mostPopular={c.mostPopular}
            />
          </div>

          {/* Fine print */}
          <div className="text-center mt-8">
            <p className="text-[13px] italic text-[#9E8E82] mb-1.5">{c.pricingNote}</p>
            <p className="text-[12px] text-[#C8BAB0]">{c.pricingNote2}</p>
          </div>
        </div>
      </section>

      {/* ── Peace of Mind ────────────────────────────────────────────────── */}
      <section className="bg-[#FAF7F2] py-16 sm:py-20 border-t border-[#DDD0C3]">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-[clamp(20px,5vw,48px)]">

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-16 mb-14">
            {c.peaceItems.map((item, i) => (
              <div key={i}>
                <div className="text-[15px] font-semibold text-[#1F1B16] mb-2 leading-[1.35]">
                  {item.head}
                </div>
                <div className="text-[14px] text-[#6B5E52] leading-[1.7]">{item.body}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-6 sm:gap-12 items-start sm:items-center pt-10 border-t border-[#DDD0C3]">
            <div className="flex-1">
              <div className="text-[14px] font-semibold text-[#1F1B16] mb-2">{c.pdpaHead}</div>
              <p className="text-[13px] text-[#9E8E82] leading-[1.75] max-w-[560px]">
                {c.pdpaBody}
              </p>
            </div>
            <div className="flex-shrink-0 flex flex-col items-center gap-2.5">
              <PhoneFrame src="screenshot-7.png" width={148} />
              <span className="text-[11px] text-[#9E8E82] text-center max-w-[148px]">
                {c.pdpaCaption}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── What Lekha Doesn't Do ────────────────────────────────────────── */}
      <section className="bg-[#F3EDE4] py-16 sm:py-20 border-t border-[#DDD0C3]">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-[clamp(20px,5vw,48px)]">
          <h2 className="[font-family:var(--font-display)] text-[1.75rem] sm:text-[2.25rem] font-normal text-[#1F1B16] tracking-[-0.025em] mb-8 sm:mb-12 max-w-[560px]">
            {c.whatDoesntHeading}
          </h2>

          <div className="flex flex-col max-w-[660px]">
            {c.whatDoesnt.map((item, i) => (
              <div
                key={i}
                className={[
                  "flex gap-[18px] items-baseline py-4 sm:py-5",
                  i < c.whatDoesnt.length - 1 ? "border-b border-[#DDD0C3]" : "",
                ].join(" ")}
              >
                <span className="text-[#C5714B] text-[18px] flex-shrink-0 leading-[1.45] font-normal">
                  —
                </span>
                <span className="text-[16px] text-[#1F1B16] leading-[1.55]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="bg-[#FAF7F2] py-16 sm:py-20 border-t border-[#DDD0C3]">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-[clamp(20px,5vw,48px)]">
          <h2 className="[font-family:var(--font-display)] text-[1.75rem] sm:text-[2.25rem] font-normal text-[#1F1B16] tracking-[-0.025em] mb-10 sm:mb-14">
            {c.howHeading}
          </h2>

          <div className="flex flex-col gap-9 sm:gap-11">
            {c.howSteps.map((step, i) => (
              <div key={i} className="flex gap-5 sm:gap-7 items-start">
                <span
                  className="[font-family:var(--font-display)] text-[#DDD0C3] flex-shrink-0 select-none tracking-[-0.03em] leading-[0.88]"
                  style={{ fontSize: i === 0 ? 68 : 68 }}
                >
                  {i + 1}.
                </span>
                <div className="pt-[10px]">
                  <p className="text-[17px] sm:text-[20px] text-[#1F1B16] leading-[1.5] font-normal">
                    {step}
                  </p>
                  {i === 1 && (
                    <div className="mt-5">
                      <PhoneFrame src="screenshot-7.png" width={138} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="bg-[#FAF7F2] py-16 sm:py-20 border-t border-[#DDD0C3]">
        <div className="max-w-[680px] mx-auto px-5 sm:px-[clamp(20px,5vw,48px)]">
          <h2 className="[font-family:var(--font-display)] text-[1.75rem] sm:text-[2.25rem] font-normal text-[#1F1B16] tracking-[-0.025em] mb-8 sm:mb-12">
            {c.faqHeading}
          </h2>

          {c.faq.map((item, i) => (
            <div key={i} className="border-b border-[#DDD0C3]">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left flex justify-between items-center py-[18px] gap-4 bg-transparent border-none cursor-pointer"
              >
                <span
                  className={`text-[15px] text-[#1F1B16] ${openFaq === i ? "font-semibold" : "font-normal"}`}
                  style={{ textWrap: "pretty" } as React.CSSProperties}
                >
                  {item.q}
                </span>
                <span
                  className="text-[22px] text-[#9E8E82] font-light flex-shrink-0 leading-none transition-transform duration-200"
                  style={{ transform: openFaq === i ? "rotate(45deg)" : "none" }}
                >
                  +
                </span>
              </button>
              <div
                className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
                style={{ maxHeight: openFaq === i ? "300px" : "0" }}
              >
                <p className="text-[14px] text-[#6B5E52] leading-[1.7] pb-5 pr-9">
                  {item.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Email Capture ─────────────────────────────────────────────────── */}
      <section className="bg-[#F3EDE4] py-16 sm:py-20 border-t border-[#DDD0C3]">
        <div className="max-w-[480px] mx-auto px-5 sm:px-[clamp(20px,5vw,48px)] text-center">
          <h2 className="[font-family:var(--font-display)] text-[1.75rem] sm:text-[2rem] font-normal text-[#1F1B16] tracking-[-0.025em] mb-3">
            {c.emailHeading}
          </h2>
          <p className="text-[15px] text-[#6B5E52] leading-[1.6] mb-7">{c.emailSubhead}</p>

          {emailStatus === "success" ? (
            <p className="text-[15px] text-[#5E8B73] font-medium">{c.emailSuccess}</p>
          ) : (
            <form
              onSubmit={handleEmailSubmit}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={c.emailPlaceholder}
                required
                className="flex-1 px-4 py-3 rounded-full border border-[#C4B5A6] border-[1.5px] bg-white text-[14px] text-[#1F1B16] outline-none focus:border-[#C5714B] transition-colors duration-150 placeholder:text-[#9E8E82]"
              />
              <BtnPrimary type="submit" size="md">
                {c.emailCta}
              </BtnPrimary>
            </form>
          )}

          {emailStatus === "error" && (
            <p className="text-[13px] text-[#C5714B] mt-3">{c.emailError}</p>
          )}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-[#FAF7F2] border-t border-[#DDD0C3] py-10 sm:py-12">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-[clamp(20px,5vw,48px)]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
            <div>
              <Wordmark />
              <div className="text-[12px] text-[#9E8E82] mt-1.5">{c.footerTagline}</div>
            </div>
            <div className="flex flex-wrap gap-5">
              {c.footerLinks.map((link, i) => (
                <a
                  key={i}
                  href="#"
                  className="text-[13px] text-[#9E8E82] no-underline hover:text-[#6B5E52] transition-colors duration-150"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
          <div className="text-center border-t border-[#DDD0C3] pt-6">
            <span className="text-[12px] text-[#C8BAB0]">{c.builtIn}</span>
          </div>
        </div>
      </footer>

      {/* ── Mobile CTA pill ──────────────────────────────────────────────── */}
      {heroGone && (
        <div className="fixed bottom-5 right-5 z-[900] md:hidden">
          <BtnPrimary href={LINE_URL} size="md">
            {c.cta}
          </BtnPrimary>
        </div>
      )}

    </div>
  );
}

// ── Internal components ───────────────────────────────────────────────────────

function Wordmark({ light = false }: { light?: boolean }) {
  const dotSize = 4;
  return (
    <div className="flex items-baseline select-none flex-shrink-0">
      <span
        className={`[font-family:var(--font-display)] text-[22px] leading-none tracking-[-0.02em] ${light ? "text-[#FAF7F2]" : "text-[#1F1B16]"}`}
      >
        Lekha
      </span>
      <div
        className={`rounded-full self-end flex-shrink-0 ml-[3px] mb-[3px] ${light ? "bg-[rgba(255,255,255,0.65)]" : "bg-[#C5714B]"}`}
        style={{ width: dotSize, height: dotSize }}
      />
    </div>
  );
}

interface PhoneFrameProps {
  src: string;
  width: number;
  priority?: boolean;
}

function PhoneFrame({ src, width, priority = false }: PhoneFrameProps) {
  const bw = Math.max(6, Math.round(width * 0.022));
  const br = Math.round(width * 0.145);
  const imgWidth = width - bw * 2;
  const imgHeight = Math.round(imgWidth * (19.5 / 9));

  return (
    <div
      className="flex-shrink-0 overflow-hidden"
      style={{
        width,
        borderRadius: br,
        border: `${bw}px solid #1C1C1E`,
        background: "#1C1C1E",
        boxShadow:
          "0 28px 72px rgba(31,27,22,0.16), 0 6px 20px rgba(31,27,22,0.08)",
      }}
    >
      <div
        className="relative w-full bg-[#DDD0C3]"
        style={{ aspectRatio: "9/19.5" }}
      >
        {/* Placeholder glyph */}
        <div className="absolute inset-0 flex items-center justify-center z-0">
          <span
            className="[font-family:var(--font-display)] text-[#C4B5A6] opacity-70"
            style={{ fontSize: Math.round(width * 0.22) }}
          >
            L
          </span>
        </div>
        {/* Screenshot */}
        <Image
          src={`/screenshots/${src}`}
          alt=""
          width={imgWidth}
          height={imgHeight}
          className="absolute inset-0 w-full h-full object-cover z-10"
          priority={priority}
          unoptimized
        />
      </div>
    </div>
  );
}

interface PhoneFrameCrossfadeProps {
  frames: readonly string[];
  activeFrame: number;
  width: number;
  priority?: boolean;
}

function PhoneFrameCrossfade({
  frames,
  activeFrame,
  width,
  priority = false,
}: PhoneFrameCrossfadeProps) {
  const bw = Math.max(6, Math.round(width * 0.022));
  const br = Math.round(width * 0.145);
  const imgWidth = width - bw * 2;
  const imgHeight = Math.round(imgWidth * (19.5 / 9));

  return (
    <div
      className="flex-shrink-0 overflow-hidden"
      style={{
        width,
        borderRadius: br,
        border: `${bw}px solid #1C1C1E`,
        background: "#1C1C1E",
        boxShadow:
          "0 28px 72px rgba(31,27,22,0.16), 0 6px 20px rgba(31,27,22,0.08)",
      }}
    >
      <div
        className="relative w-full bg-[#DDD0C3]"
        style={{ aspectRatio: "9/19.5" }}
      >
        {/* Placeholder glyph */}
        <div className="absolute inset-0 flex items-center justify-center z-0">
          <span
            className="[font-family:var(--font-display)] text-[#C4B5A6] opacity-70"
            style={{ fontSize: Math.round(width * 0.22) }}
          >
            L
          </span>
        </div>
        {/* Crossfade frames */}
        {frames.map((src, i) => (
          <Image
            key={src}
            src={`/screenshots/${src}`}
            alt=""
            width={imgWidth}
            height={imgHeight}
            className="absolute inset-0 w-full h-full object-cover z-10"
            style={{
              opacity: i === activeFrame ? 1 : 0,
              transition: "opacity 600ms ease-in-out",
            }}
            priority={priority && i === 0}
            unoptimized
          />
        ))}
      </div>
    </div>
  );
}

interface BtnPrimaryProps {
  href?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  type?: "button" | "submit";
  style?: React.CSSProperties;
}

function BtnPrimary({
  href,
  children,
  size = "md",
  onClick,
  type = "button",
  style: sx,
}: BtnPrimaryProps) {
  const pad = size === "sm" ? "8px 18px" : size === "lg" ? "15px 32px" : "12px 26px";
  const fs = size === "sm" ? 13 : size === "lg" ? 16 : 15;

  const className =
    "inline-flex items-center justify-center rounded-full font-medium leading-none whitespace-nowrap no-underline cursor-pointer border-none transition-all duration-150 bg-[#C5714B] text-white hover:bg-[#A85C38] hover:-translate-y-px";

  const commonStyle: React.CSSProperties = {
    padding: pad,
    fontSize: fs,
    boxShadow: "0 1px 4px rgba(197,113,75,0.28)",
    ...sx,
  };

  if (href) {
    return (
      <a href={href} className={className} style={commonStyle} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <button
      type={type}
      className={className}
      style={commonStyle}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface BtnGhostProps {
  href?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

function BtnGhost({ href, children, size = "md", onClick }: BtnGhostProps) {
  const pad = size === "sm" ? "7px 17px" : size === "lg" ? "14px 30px" : "11px 24px";
  const fs = size === "sm" ? 13 : size === "lg" ? 16 : 15;

  const className =
    "inline-flex items-center justify-center rounded-full font-medium leading-none whitespace-nowrap no-underline cursor-pointer transition-all duration-150 bg-transparent text-[#1F1B16] border border-[#C4B5A6] hover:bg-[#F3EDE4]";

  const commonStyle: React.CSSProperties = { padding: pad, fontSize: fs };

  if (href) {
    return (
      <a href={href} className={className} style={commonStyle} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={className} style={commonStyle} onClick={onClick}>
      {children}
    </button>
  );
}

interface PricingCardProps {
  name: string;
  subtitle: string;
  period: "yearly" | "monthly";
  yearly: number;
  monthly: number;
  yearlyTotal: number;
  savings: string;
  bullets: string[];
  cta: string;
  accent: boolean;
  mostPopular: string;
}

function PricingCard({
  name,
  subtitle,
  period,
  yearly,
  monthly,
  yearlyTotal,
  savings,
  bullets,
  cta,
  accent,
  mostPopular,
}: PricingCardProps) {
  const price = period === "yearly" ? yearly : monthly;

  return (
    <div
      className={[
        "relative bg-white rounded-[20px] flex flex-col transition-all duration-250 cursor-default",
        "hover:-translate-y-0.5",
        accent ? "border-2 border-[#C5714B]" : "border border-[#DDD0C3]",
      ].join(" ")}
      style={{
        padding: "36px 32px",
        boxShadow: "0 2px 8px rgba(197,113,75,0.08), 0 1px 3px rgba(31,27,22,0.05)",
      }}
    >
      {accent && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bg-[#C5714B] text-white rounded-full text-[11px] font-semibold tracking-[0.04em] whitespace-nowrap px-3.5 py-[3px]"
          style={{ top: -13 }}
        >
          {mostPopular}
        </div>
      )}

      <div className="[font-family:var(--font-display)] text-[22px] text-[#1F1B16] mb-1.5">
        {name}
      </div>
      <div className="text-[13px] text-[#6B5E52] mb-6 leading-[1.45]">{subtitle}</div>

      <div className="flex items-baseline gap-1 mb-1.5">
        <span className="[font-family:var(--font-display)] text-[52px] leading-none text-[#1F1B16] tracking-[-0.03em]">
          {price.toLocaleString()}
        </span>
        <span className="text-[14px] text-[#9E8E82]">฿ / mo</span>
      </div>

      {period === "yearly" ? (
        <div className="flex gap-2 items-center mb-7 flex-wrap">
          <span className="text-[12px] text-[#9E8E82]">
            billed yearly · {yearlyTotal.toLocaleString()} ฿
          </span>
          <span className="bg-[#EDF5F1] text-[#5E8B73] px-2 py-[2px] rounded-full text-[11px] font-semibold">
            {savings}
          </span>
        </div>
      ) : (
        <div className="h-5 mb-7" />
      )}

      <div className="flex flex-col gap-2.5 mb-7 flex-1">
        {bullets.map((b, i) => (
          <div key={i} className="flex gap-2.5 items-start">
            <span className="text-[#5E8B73] text-[13px] flex-shrink-0 mt-[2px]">✓</span>
            <span className="text-[14px] text-[#6B5E52] leading-[1.45]">{b}</span>
          </div>
        ))}
      </div>

      <BtnPrimary href={LINE_URL} size="md" style={{ width: "100%", justifyContent: "center" }}>
        {cta}
      </BtnPrimary>
    </div>
  );
}
