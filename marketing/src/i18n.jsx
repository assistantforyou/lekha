/* LEKHA — English → Thai translation layer + language toggle */
import React from 'react';

const TH = {
  /* ---- Nav ---- */
  "Features": "ฟีเจอร์",
  "Operations Layer": "ศูนย์ปฏิบัติการ",
  "Use Cases": "กรณีการใช้งาน",
  "Use cases": "กรณีการใช้งาน",
  "Pricing": "ราคา",
  "FAQ": "คำถามที่พบบ่อย",
  "Sign in": "เข้าสู่ระบบ",
  "Book a 1-on-1 session with us": "จองเซสชันส่วนตัวกับเรา",

  /* ---- Hero ---- */
  "AI Executive Assistant · Bilingual EN / ไทย": "ผู้ช่วยผู้บริหาร AI · สองภาษา EN / ไทย",
  "Meet": "พบกับ",
  "your AI Chief of Operations (COO).": "ประธานเจ้าหน้าที่ฝ่ายปฏิบัติการ AI ของคุณ",
  "LEKHA briefs you twice a day, runs your to-do list, watches your calendar, drafts replies, analyses stock markets, daily news brief, and a personal secretary that you can talk to - all in one chat. Built for executives and high performance workers who want their day on autopilot.": "LEKHA สรุปข้อมูลให้คุณวันละสองครั้ง จัดการรายการสิ่งที่ต้องทำ ดูแลปฏิทินของคุณ ร่างคำตอบ วิเคราะห์ตลาดหุ้น สรุปข่าวรายวัน และเป็นเลขาส่วนตัวที่คุณพูดคุยด้วยได้ — ทั้งหมดในแชทเดียว ออกแบบมาเพื่อผู้บริหารและคนทำงานประสิทธิภาพสูงที่อยากให้ทั้งวันทำงานแบบอัตโนมัติ",
  "Contact us on LINE": "ติดต่อเราทาง LINE",
  "Our Instagram": "อินสตาแกรมของเรา",
  "Online 24/7": "ออนไลน์ 24/7",
  "Online": "ออนไลน์",
  "Reminder": "การแจ้งเตือน",
  "Morning Meeting · 10:00 AM": "ประชุมเช้า · 10:00 น.",
  "Chat": "แชท",
  "Good morning. What can LEKHA help you with today?": "สวัสดีตอนเช้า วันนี้ LEKHA ช่วยอะไรคุณได้บ้าง?",
  "\"OUR PRODUCT HAS BEEN USED AND TRUSTED BY BUSINESS EXECUTIVES, DOCTORS, AND OTHER HIGH PERFORMANCE FIELDS\" - LEKHA ADMINS": "\"ผลิตภัณฑ์ของเราได้รับความไว้วางใจจากผู้บริหารธุรกิจ แพทย์ และผู้เชี่ยวชาญในสายงานประสิทธิภาพสูงอื่นๆ\" - ทีมงาน LEKHA",

  /* ---- Metrics ---- */
  "Response\nTime": "เวลา\nตอบกลับ",
  "Daily\nBriefings": "สรุปข่าว\nรายวัน",
  "Task\nMonitoring": "ติดตาม\nงาน",
  "Tools\nConnected": "เครื่องมือ\nที่เชื่อมต่อ",
  "EN / ไทย\nBilingual": "EN / ไทย\nสองภาษา",

  /* ---- Command Center ---- */
  "Live Operations Layer": "ศูนย์ปฏิบัติการเรียลไทม์",
  "Always on.": "ทำงานตลอดเวลา",
  "Always watching.": "เฝ้าดูเสมอ",
  "A continuous intelligence loop across every stream that matters.": "วงจรอัจฉริยะที่ทำงานต่อเนื่องครอบคลุมทุกข้อมูลที่สำคัญ",
  "MARKETS": "ตลาด",
  "Calendar": "ปฏิทิน",
  "Mon 26 May": "จ. 26 พ.ค.",
  "Board Prep": "เตรียมประชุมบอร์ด",
  "Helix Labs Call": "โทรหา Helix Labs",
  "Lunch — David": "มื้อเที่ยง — เดวิด",
  "Q3 Review": "รีวิว Q3",
  "Deep Work Block": "ช่วงโฟกัสงานลึก",
  "Internal": "ภายใน",
  "External": "ภายนอก",
  "Client": "ลูกค้า",
  "Protected": "ป้องกันเวลา",
  "NOW": "ตอนนี้",
  "Tasks": "งาน",
  "3 pending": "ค้าง 3 รายการ",
  "Send term sheet to David": "ส่ง term sheet ให้เดวิด",
  "Review legal MSA": "ตรวจสัญญา MSA",
  "Q3 board deck review": "รีวิวสไลด์บอร์ด Q3",
  "Call Khun Anan · before 5pm": "โทรหาคุณอนันต์ · ก่อน 17:00",
  "Market brief — SET opening": "สรุปตลาด — เปิด SET",
  "Email · 23 unread": "อีเมล · ยังไม่อ่าน 23",
  "Docs · Q3 deck updated": "เอกสาร · อัปเดตสไลด์ Q3",
  "Reminders · 5 pending": "แจ้งเตือน · ค้าง 5",
  "LEKHA Intelligence Network": "เครือข่ายอัจฉริยะ LEKHA",

  /* ---- Features section ---- */
  "What LEKHA does": "LEKHA ทำอะไรได้บ้าง",
  "One chat.": "แชทเดียว",
  "Endless superpowers.": "พลังที่ไม่สิ้นสุด",
  "Pick a capability. Watch LEKHA work. Every reply below is a real interaction pattern from the product.": "เลือกความสามารถ แล้วดู LEKHA ทำงาน ทุกคำตอบด้านล่างคือรูปแบบการโต้ตอบจริงจากผลิตภัณฑ์",
  "Chatting via LINE": "กำลังแชทผ่าน LINE",

  /* Feature: briefing */
  "Daily Briefing": "สรุปข่าวรายวัน",
  "News tuned to you": "ข่าวที่ปรับให้เหมาะกับคุณ",
  "Morning intel": "ข้อมูลยามเช้า",
  "Wake up to what actually matters — to you.": "ตื่นมาพบกับเรื่องที่สำคัญกับคุณจริงๆ",
  "Choose your categories — innovation, technology, wellness, self-care, markets, world. LEKHA scans 200+ trusted sources overnight and assembles a briefing only on the topics you care about, read in 90 seconds.": "เลือกหมวดที่คุณสนใจ — นวัตกรรม เทคโนโลยี สุขภาพ การดูแลตัวเอง ตลาด และโลก LEKHA สแกนแหล่งข่าวที่เชื่อถือได้กว่า 200 แห่งในชั่วข้ามคืน แล้วรวบรวมเป็นสรุปเฉพาะหัวข้อที่คุณสนใจ อ่านจบใน 90 วินาที",
  "Pick & re-mix categories anytime — innovation, tech, wellness, self-care, markets, world": "เลือกและปรับหมวดได้ทุกเมื่อ — นวัตกรรม เทคโนโลยี สุขภาพ การดูแลตัวเอง ตลาด โลก",
  "Cited sources, no hallucinated facts": "อ้างอิงแหล่งที่มา ไม่มีข้อมูลที่กุขึ้น",
  "Delivered to chat, email, or Line at the time you wake": "ส่งทางแชท อีเมล หรือ LINE ในเวลาที่คุณตื่น",

  /* Feature: tasks */
  "Tasks & Reminders": "งานและการแจ้งเตือน",
  "Todos that actually get done": "สิ่งที่ต้องทำที่เสร็จได้จริง",
  "Get it done": "ทำให้เสร็จ",
  "A todo list that nags you politely.": "รายการสิ่งที่ต้องทำที่คอยเตือนคุณอย่างสุภาพ",
  "Just tell LEKHA what needs doing. She remembers, prioritises, schedules nudges, and follows up after meetings to capture loose ends automatically.": "แค่บอก LEKHA ว่าต้องทำอะไร เธอจะจดจำ จัดลำดับความสำคัญ ตั้งการเตือน และติดตามหลังการประชุมเพื่อเก็บงานที่ค้างให้อัตโนมัติ",
  "Natural language input — type or speak": "สั่งงานด้วยภาษาธรรมชาติ — พิมพ์หรือพูด",
  "Smart prioritisation by deadline & energy": "จัดลำดับอัจฉริยะตามกำหนดเวลาและพลังงาน",
  "Recurring reminders, snooze, and follow-throughs": "เตือนซ้ำ เลื่อนเวลา และติดตามต่อเนื่อง",

  /* Feature: stocks */
  "Stock Analysis": "วิเคราะห์หุ้น",
  "Market read in plain English": "อ่านตลาดแบบเข้าใจง่าย",
  "Markets": "ตลาด",
  "A junior analyst on call.": "นักวิเคราะห์ผู้ช่วยที่พร้อมเสมอ",
  "Ask about any ticker, sector or macro event. LEKHA pulls live data, fundamentals and sentiment — then summarises the thesis in language you can act on.": "ถามเกี่ยวกับหุ้น กลุ่มอุตสาหกรรม หรือเหตุการณ์มหภาคใดก็ได้ LEKHA ดึงข้อมูลเรียลไทม์ ปัจจัยพื้นฐาน และความรู้สึกของตลาด แล้วสรุปเป็นภาษาที่คุณนำไปใช้ได้จริง",
  "Live quotes, fundamentals & earnings": "ราคาเรียลไทม์ ปัจจัยพื้นฐาน และผลประกอบการ",
  "Sentiment + news triangulation": "วิเคราะห์ความรู้สึกตลาดร่วมกับข่าว",
  "Watchlist alerts on price & headline events": "แจ้งเตือนรายการเฝ้าดูตามราคาและข่าวสำคัญ",

  /* Feature: inbox */
  "Email · Send & Receive": "อีเมล · รับและส่ง",
  "Writes & answers for you": "เขียนและตอบแทนคุณ",
  "Communication": "การสื่อสาร",
  "She writes — and replies — on your behalf.": "เธอเขียน — และตอบ — แทนคุณ",
  "Connect Gmail or Outlook and LEKHA receives incoming mail, triages it, and drafts (or sends) responses in your voice. Composing a new email? Just describe it in chat — she writes and sends.": "เชื่อมต่อ Gmail หรือ Outlook แล้ว LEKHA จะรับอีเมลเข้า คัดกรอง และร่าง (หรือส่ง) คำตอบในสไตล์ของคุณ อยากเขียนอีเมลใหม่? แค่บอกในแชท — เธอเขียนและส่งให้",
  "Sends emails on your behalf — dictate in chat, she writes and ships": "ส่งอีเมลแทนคุณ — สั่งในแชท เธอเขียนและส่งให้",
  "Receives & triages incoming mail — surfaces only what needs you": "รับและคัดกรองอีเมลเข้า — แสดงเฉพาะที่ต้องการคุณ",
  "Voice-cloned tone & signature · auto-replies when you're away": "เลียนแบบโทนเสียงและลายเซ็น · ตอบอัตโนมัติเมื่อคุณไม่อยู่",

  /* Feature: research */
  "Research & Insights": "ค้นคว้าและข้อมูลเชิงลึก",
  "Deep-dive in minutes": "เจาะลึกในไม่กี่นาที",
  "Research": "ค้นคว้า",
  "Deep research, citations included.": "ค้นคว้าเชิงลึก พร้อมแหล่งอ้างอิง",
  "Ask a hard question — competitive landscape, regulatory change, a company background — and LEKHA delivers a structured brief with sources.": "ถามคำถามยากๆ — ภูมิทัศน์การแข่งขัน การเปลี่ยนแปลงกฎระเบียบ หรือประวัติบริษัท — แล้ว LEKHA จะสรุปอย่างมีโครงสร้างพร้อมแหล่งอ้างอิง",
  "Multi-source synthesis": "สังเคราะห์จากหลายแหล่ง",
  "Tables, comparisons & charts": "ตาราง การเปรียบเทียบ และกราฟ",
  "Export to Docs, Notion or PDF": "ส่งออกเป็น Docs, Notion หรือ PDF",

  /* Feature: cal */
  "Scheduling on autopilot": "จัดตารางแบบอัตโนมัติ",
  "Stop playing meeting Tetris.": "เลิกเล่นเกมจัดตารางประชุม",
  "LEKHA negotiates times, prepares pre-reads, and protects deep-work blocks. She knows your timezone, your travel and when you'd rather walk the dog.": "LEKHA ช่วยนัดเวลา เตรียมเอกสารก่อนประชุม และปกป้องช่วงเวลาทำงานสำคัญ เธอรู้เขตเวลา การเดินทาง และเวลาที่คุณอยากพักของคุณ",
  "Cross-timezone scheduling": "จัดตารางข้ามเขตเวลา",
  "Auto-generated meeting briefs": "สรุปการประชุมอัตโนมัติ",
  "Deep-work protection & no-meeting days": "ปกป้องเวลางานสำคัญและวันปลอดประชุม",

  /* Feature: media */
  "Image Analysis": "วิเคราะห์รูปภาพ",
  "Drop a photo, get answers": "วางรูป แล้วได้คำตอบ",
  "Vision": "การมองเห็น",
  "Send her a picture — she reads it.": "ส่งรูปให้เธอ — เธออ่านให้",
  "Receipts, whiteboards, slides, screenshots, lab results, a menu in another language. LEKHA extracts the data, summarises what's in the frame, and files it where it belongs.": "ใบเสร็จ ไวท์บอร์ด สไลด์ ภาพหน้าจอ ผลแล็บ หรือเมนูภาษาอื่น LEKHA ดึงข้อมูล สรุปสิ่งที่อยู่ในภาพ และจัดเก็บให้ถูกที่",
  "Receipts → expense entries, instantly": "ใบเสร็จ → บันทึกค่าใช้จ่ายทันที",
  "Whiteboards & screenshots → typed notes": "ไวท์บอร์ดและภาพหน้าจอ → โน้ตที่พิมพ์ไว้",
  "Translate signs, menus & documents from a single photo": "แปลป้าย เมนู และเอกสารจากรูปเดียว",

  /* ---- Capabilities ---- */
  "Capabilities": "ความสามารถ",
  "Everything an assistant should do, but more.": "ทุกอย่างที่ผู้ช่วยควรทำได้ และมากกว่านั้น",
  "Customisable news brief": "สรุปข่าวที่ปรับแต่งได้",
  "Pick your categories — innovation, technology, wellness, self-care, markets, world. Re-mix anytime.": "เลือกหมวดของคุณ — นวัตกรรม เทคโนโลยี สุขภาพ การดูแลตัวเอง ตลาด โลก ปรับใหม่ได้ทุกเมื่อ",
  "Tasks & todos": "งานและสิ่งที่ต้องทำ",
  "Capture, prioritise and follow through. Recurring, snoozeable, accountable.": "บันทึก จัดลำดับ และติดตาม ทำซ้ำได้ เลื่อนได้ ตรวจสอบได้",
  "Smart reminders": "การแจ้งเตือนอัจฉริยะ",
  "Time, location and event-based nudges — never another missed birthday or board call.": "เตือนตามเวลา สถานที่ และเหตุการณ์ — ไม่พลาดวันเกิดหรือประชุมบอร์ดอีกต่อไป",
  "Stock & market analysis": "วิเคราะห์หุ้นและตลาด",
  "Live quotes, fundamentals and sentiment for any ticker — explained simply.": "ราคาเรียลไทม์ ปัจจัยพื้นฐาน และความรู้สึกตลาดของหุ้นใดก็ได้ — อธิบายง่ายๆ",
  "Calendar & scheduling": "ปฏิทินและการจัดตาราง",
  "Cross-timezone booking, deep-work protection, automatic meeting briefs.": "นัดข้ามเขตเวลา ปกป้องเวลางานสำคัญ สรุปการประชุมอัตโนมัติ",
  "Email · send & receive": "อีเมล · รับและส่ง",
  "Receives, triages and replies on your behalf — or writes & sends new emails on command.": "รับ คัดกรอง และตอบแทนคุณ — หรือเขียนและส่งอีเมลใหม่ตามคำสั่ง",
  "Image analysis": "วิเคราะห์รูปภาพ",
  "Drop a photo — receipts, whiteboards, screenshots, menus. She reads, extracts and files.": "วางรูป — ใบเสร็จ ไวท์บอร์ด ภาพหน้าจอ เมนู เธออ่าน ดึงข้อมูล และจัดเก็บให้",
  "Deep research": "ค้นคว้าเชิงลึก",
  "Multi-source synthesis with citations. From competitor scan to policy brief.": "สังเคราะห์จากหลายแหล่งพร้อมอ้างอิง ตั้งแต่สำรวจคู่แข่งจนถึงสรุปนโยบาย",
  "Document drafting": "ร่างเอกสาร",
  "Memos, emails, proposals, board updates — drafted in seconds, polished in minutes.": "บันทึก อีเมล ข้อเสนอ อัปเดตบอร์ด — ร่างในไม่กี่วินาที ขัดเกลาในไม่กี่นาที",
  "Customisable to you": "ปรับแต่งให้เป็นคุณ",
  "Pick the categories, channels, briefing times and tone that fit your life. Change anything, anytime.": "เลือกหมวด ช่องทาง เวลาสรุป และโทนที่เข้ากับชีวิตคุณ เปลี่ยนอะไรก็ได้ทุกเมื่อ",
  "Bilingual fluency": "สองภาษาอย่างคล่องแคล่ว",
  "Switch between English and ภาษาไทย mid-conversation. Translation and culture-aware.": "สลับระหว่างภาษาอังกฤษและภาษาไทยกลางบทสนทนา แปลและเข้าใจวัฒนธรรม",

  /* ---- How it works ---- */
  "How it works": "วิธีการทำงาน",
  "Set up in": "ตั้งค่าใน",
  "three minutes.": "สามนาที",
  "No prompt-crafting. No tutorials. Tell LEKHA what your day looks like... she takes it from there.": "ไม่ต้องเขียนพรอมต์ ไม่ต้องเรียนรู้ บอก LEKHA ว่าวันของคุณเป็นอย่างไร... จากนั้นเธอจัดการต่อเอง",
  "Connect your tools": "เชื่อมต่อเครื่องมือของคุณ",
  "Plug in Line and your Google account. Takes 90 seconds.": "เชื่อม LINE และบัญชี Google ของคุณ ใช้เวลา 90 วินาที",
  "Tell her your context": "บอกบริบทของคุณ",
  "A short onboarding chat: your role, your watchlist, your priorities, your day-to-day routine.": "แชทเริ่มต้นสั้นๆ: บทบาทของคุณ รายการเฝ้าดู สิ่งสำคัญ และกิจวัตรประจำวัน",
  "Let her run the day": "ให้เธอดูแลทั้งวัน",
  "LEKHA keeps you updated with two daily briefings at 7 AM and 9 PM. Chat with LEKHA to stay on top of your tasks, receive timely reminders, and get the information you need—when you need it.": "LEKHA อัปเดตคุณด้วยสรุปวันละสองครั้ง เวลา 7:00 และ 21:00 น. แชทกับ LEKHA เพื่อจัดการงาน รับการเตือนตรงเวลา และได้ข้อมูลที่ต้องการ—เมื่อคุณต้องการ",

  /* ---- Use cases ---- */
  "Built for": "ออกแบบมาเพื่อ",
  "However you run your day,": "ไม่ว่าคุณใช้ชีวิตแต่ละวันแบบไหน",
  "LEKHA adapts.": "LEKHA ปรับให้เข้ากับคุณ",
  "For founders": "สำหรับผู้ก่อตั้ง",
  "Your one-person chief of staff.": "หัวหน้าทีมงานในคนเดียวของคุณ",
  "Brief on competitors before every call. Draft investor updates. Never drop a follow-up again.": "สรุปคู่แข่งก่อนทุกการประชุม ร่างอัปเดตนักลงทุน ไม่พลาดการติดตามอีกต่อไป",
  "For executives": "สำหรับผู้บริหาร",
  "Reclaim the first hour of every day.": "ทวงคืนชั่วโมงแรกของทุกวัน",
  "Wake up to a briefing tuned to your portfolio, your team and your blockers.": "ตื่นมาพบสรุปที่ปรับให้เข้ากับพอร์ต ทีม และอุปสรรคของคุณ",
  "For analysts": "สำหรับนักวิเคราะห์",
  "Markets, news and research in one chat.": "ตลาด ข่าว และการค้นคว้าในแชทเดียว",
  "Live data, sentiment and instant deep-dives — show your working with cited sources.": "ข้อมูลเรียลไทม์ ความรู้สึกตลาด และการเจาะลึกทันที — แสดงที่มาพร้อมอ้างอิง",
  "For busy people": "สำหรับคนยุ่ง",
  "A todo list that finally sticks.": "รายการสิ่งที่ต้องทำที่ใช้ได้จริงสักที",
  "Plain-language input, smart prioritisation, polite but persistent nudges.": "สั่งด้วยภาษาง่ายๆ จัดลำดับอัจฉริยะ เตือนอย่างสุภาพแต่หนักแน่น",

  /* ---- Pricing ---- */
  "Simple, honest pricing.": "ราคาเรียบง่าย ตรงไปตรงมา",
  "Start free. Upgrade when LEKHA has saved you more time than the monthly fee — usually week one.": "เริ่มฟรี อัปเกรดเมื่อ LEKHA ประหยัดเวลาให้คุณมากกว่าค่ารายเดือน — มักเป็นสัปดาห์แรก",
  "MONTHLY": "รายเดือน",
  "YEARLY": "รายปี",
  "/month": "/เดือน",
  "/year": "/ปี",
  "Pay as you go. Cancel any time.": "จ่ายตามใช้ ยกเลิกได้ทุกเมื่อ",
  "Two months free. Best for daily users.": "ฟรีสองเดือน เหมาะกับผู้ใช้ประจำ",
  "SAVE 17%": "ประหยัด 17%",
  "Personalised briefing and much more": "สรุปข่าวเฉพาะบุคคล และอีกมากมาย",
  "Unlimited tasks & smart reminders": "งานและการแจ้งเตือนอัจฉริยะไม่จำกัด",
  "Live stock & market analysis": "วิเคราะห์หุ้นและตลาดเรียลไทม์",
  "Inbox triage & drafted replies": "คัดกรองอีเมลและร่างคำตอบ",
  "Deep research with citations": "ค้นคว้าเชิงลึกพร้อมอ้างอิง",
  "Everything in Monthly": "ทุกอย่างในแพ็กรายเดือน",
  "Equivalent to ฿499/month — 2 months free": "เทียบเท่า ฿499/เดือน — ฟรี 2 เดือน",
  "Priority response · under 3s average": "ตอบกลับก่อนใคร · เฉลี่ยต่ำกว่า 3 วินาที",
  "Early access to new capabilities": "เข้าถึงฟีเจอร์ใหม่ก่อนใคร",
  "Dedicated onboarding session": "เซสชันเริ่มต้นใช้งานส่วนตัว",
  "Start 7-day trial": "เริ่มทดลอง 7 วัน",

  /* ---- FAQ ---- */
  "Questions, answered.": "ทุกคำถาม มีคำตอบ",
  "Does LEKHA speak Thai?": "LEKHA พูดภาษาไทยได้ไหม?",
  "Yes — fully bilingual in English and ภาษาไทย. You can switch languages mid-conversation, and briefings can be delivered in either.": "ได้ — สองภาษาอย่างสมบูรณ์ทั้งอังกฤษและไทย คุณสลับภาษากลางบทสนทนาได้ และรับสรุปข่าวเป็นภาษาใดก็ได้",
  "What tools does LEKHA connect to?": "LEKHA เชื่อมต่อกับเครื่องมืออะไรบ้าง?",
  "LEKHA talks to you through LINE but by connecting to your Google account, it can work and draft emails for you. Setup takes approximately 90 seconds.": "LEKHA คุยกับคุณผ่าน LINE และเมื่อเชื่อมต่อบัญชี Google จะทำงานและร่างอีเมลให้คุณได้ ตั้งค่าใช้เวลาประมาณ 90 วินาที",
  "Where does my data live?": "ข้อมูลของฉันอยู่ที่ไหน?",
  "Your data is encrypted at rest and in transit. We never train on your messages, and you can export or delete everything with one click.": "ข้อมูลของคุณถูกเข้ารหัสทั้งขณะจัดเก็บและส่งผ่าน เราไม่นำข้อความของคุณไปฝึกระบบ และคุณส่งออกหรือลบทุกอย่างได้ด้วยคลิกเดียว",
  "Can I use LEKHA on mobile?": "ใช้ LEKHA บนมือถือได้ไหม?",
  "Yes — iOS, Android, web, and Line. Your context follows you across every surface.": "ได้ — iOS, Android, เว็บ และ LINE บริบทของคุณติดตามไปทุกอุปกรณ์",
  "How is this different from ChatGPT?": "ต่างจาก ChatGPT อย่างไร?",
  "LEKHA is a stateful executive assistant, not a chatbot. She remembers you, runs background jobs (briefing, reminders, monitoring), and connects to your real tools. Think of her as a personal executive secretary with AI engraved in her system.": "LEKHA เป็นผู้ช่วยผู้บริหารที่จดจำสถานะ ไม่ใช่แค่แชทบอท เธอจดจำคุณ ทำงานเบื้องหลัง (สรุปข่าว เตือนความจำ เฝ้าติดตาม) และเชื่อมต่อกับเครื่องมือจริงของคุณ มองเธอเป็นเลขาผู้บริหารส่วนตัวที่มี AI ฝังอยู่ในระบบ",

  /* ---- About ---- */
  "About us": "เกี่ยวกับเรา",
  "Built by people who've had": "สร้างโดยคนที่เคยอยู่ในสถานการณ์ที่",
  "no margin for error.": "ไม่มีที่ว่างให้พลาด",
  "LEKHA is an AI executive assistant built to help normal to high-performance people run their day with less friction. Created by a team with backgrounds in": "LEKHA คือผู้ช่วยผู้บริหาร AI ที่สร้างขึ้นเพื่อช่วยให้คนทั่วไปจนถึงผู้มีประสิทธิภาพสูงจัดการแต่ละวันได้อย่างราบรื่นขึ้น สร้างโดยทีมที่มีพื้นฐานด้าน",
  "aerospace and defense engineering, medicine, and business leadership": "วิศวกรรมการบินและการป้องกันประเทศ การแพทย์ และการบริหารธุรกิจ",
  ", we understand the pressure of fast decisions, packed schedules, and constant information flow.": " เราเข้าใจแรงกดดันของการตัดสินใจที่รวดเร็ว ตารางที่แน่น และข้อมูลที่ไหลเข้ามาตลอดเวลา",
  "LEKHA helps manage daily briefings, tasks, reminders, emails, calendar planning, research, document drafting, image analysis, and market insights — all in one chat.": "LEKHA ช่วยจัดการสรุปข่าวรายวัน งาน การแจ้งเตือน อีเมล การวางแผนปฏิทิน การค้นคว้า การร่างเอกสาร การวิเคราะห์รูปภาพ และข้อมูลเชิงลึกของตลาด — ทั้งหมดในแชทเดียว",
  "Our mission is simple: give busy professionals a reliable AI Chief of Operations that keeps life organised, focused, and moving forward.": "ภารกิจของเราเรียบง่าย: มอบประธานเจ้าหน้าที่ฝ่ายปฏิบัติการ AI ที่เชื่อถือได้ให้คนทำงานที่ยุ่ง เพื่อให้ชีวิตเป็นระเบียบ มีสมาธิ และก้าวไปข้างหน้า",

  /* ---- CTA band ---- */
  "Ready when you are": "พร้อมเมื่อคุณพร้อม",
  "Hand off your day to": "มอบหมายทั้งวันของคุณให้",
  "Free for 7 days. Cancel anytime — she won't take it personally.": "ฟรี 7 วัน ยกเลิกได้ทุกเมื่อ — เธอไม่ถือสาหรอก",
  "Start now": "เริ่มเลย",
  "Book a 1-on-1 session with the team": "จองเซสชันส่วนตัวกับทีมงาน",
  "Good morning. S&P500 opened green, you have 3 meetings today, and Pim is asking about the Q3 deck. Where do you want to start?": "สวัสดีตอนเช้า S&P500 เปิดบวก วันนี้คุณมี 3 ประชุม และพิมถามเรื่องสไลด์ Q3 อยากเริ่มตรงไหนดี?",
  "Show me the deck and reschedule my 11am to 2pm.": "ขอดูสไลด์ และเลื่อนนัด 11:00 ไปเป็น 14:00",
  "On it — moving Andrew to Thursday 2pm. Deck opening now.": "จัดให้ — ย้ายแอนดรูว์ไปวันพฤหัส 14:00 กำลังเปิดสไลด์",

  /* ---- Footer ---- */
  "\"I have been using Lekha and it has helped me organize my calendars and to-do list very well\" -  a Doctor": "\"ฉันใช้ Lekha มาตลอดและมันช่วยจัดระเบียบปฏิทินและรายการสิ่งที่ต้องทำได้ดีมาก\" - คุณหมอท่านหนึ่ง",
  "Product": "ผลิตภัณฑ์",
  "Company": "บริษัท",
  "Resources": "แหล่งข้อมูล",
  "Integrations": "การเชื่อมต่อ",
  "About": "เกี่ยวกับ",
  "Contact": "ติดต่อ",
  "Terms": "ข้อกำหนด",
  "Help center": "ศูนย์ช่วยเหลือ",
  "© 2026 LEKHA · เลขา. All rights reserved.": "© 2026 LEKHA · เลขา สงวนลิขสิทธิ์",
  "Made with care in Bangkok": "สร้างด้วยใจในกรุงเทพฯ",

  /* ---- Terms ---- */
  "Legal": "ข้อกฎหมาย",
  "Terms and Conditions": "ข้อกำหนดและเงื่อนไข",
  "Last updated: 20 May 2026 · By accessing or using LEKHA, you agree to these terms. If you do not agree, please do not use our service.": "อัปเดตล่าสุด: 20 พ.ค. 2026 · การเข้าถึงหรือใช้ LEKHA ถือว่าคุณยอมรับข้อกำหนดเหล่านี้ หากไม่ยอมรับ กรุณาอย่าใช้บริการของเรา",
  "Welcome to LEKHA. These Terms and Conditions govern your access to and use of LEKHA, an AI-powered chatbot and executive assistant service operated by Assistantforyou (“LEKHA,” “we,” “us,” or “our”).": "ยินดีต้อนรับสู่ LEKHA ข้อกำหนดและเงื่อนไขเหล่านี้ควบคุมการเข้าถึงและการใช้ LEKHA ซึ่งเป็นแชทบอทและบริการผู้ช่วยผู้บริหารที่ขับเคลื่อนด้วย AI ดำเนินการโดย Assistantforyou (“LEKHA”, “เรา”, หรือ “ของเรา”)",
  "Read full terms": "อ่านข้อกำหนดทั้งหมด",
  "Collapse terms": "ย่อข้อกำหนด",
  "1. About LEKHA": "1. เกี่ยวกับ LEKHA",
  "2. User Responsibility": "2. ความรับผิดชอบของผู้ใช้",
  "3. No Professional Advice": "3. ไม่ใช่คำแนะนำจากผู้เชี่ยวชาญ",
  "4. Account and Access": "4. บัญชีและการเข้าถึง",
  "5. Third-Party Integrations": "5. การเชื่อมต่อกับบุคคลที่สาม",
  "6. Email, Calendar, and Task Automation": "6. ระบบอัตโนมัติของอีเมล ปฏิทิน และงาน",
  "7. Image and Document Analysis": "7. การวิเคราะห์รูปภาพและเอกสาร",
  "8. User Content": "8. เนื้อหาของผู้ใช้",
  "9. Acceptable Use": "9. การใช้งานที่ยอมรับได้",
  "10. Payments and Subscriptions": "10. การชำระเงินและการสมัครสมาชิก",
  "11. Service Availability": "11. ความพร้อมของบริการ",
  "12. AI Limitations": "12. ข้อจำกัดของ AI",
  "13. Intellectual Property": "13. ทรัพย์สินทางปัญญา",
  "14. Privacy": "14. ความเป็นส่วนตัว",
  "15. Security": "15. ความปลอดภัย",
  "16. Termination": "16. การยุติการใช้งาน",
  "17. Disclaimer of Warranties": "17. การปฏิเสธการรับประกัน",
  "18. Limitation of Liability": "18. การจำกัดความรับผิด",
  "19. Indemnification": "19. การชดใช้ค่าเสียหาย",
};

const originals = new WeakMap();
let isThai = false;
let observer = null;
let root = null;

function inNoTranslate(node) {
  let el = node.nodeType === 1 ? node : node.parentElement;
  while (el) {
    if (el.nodeType === 1 && el.hasAttribute && el.hasAttribute('data-no-translate')) return true;
    el = el.parentElement;
  }
  return false;
}

function translateText(node, toThai) {
  if (node.nodeType !== 3 || !node.nodeValue) return;
  if (toThai) {
    const key = node.nodeValue.trim();
    if (!key) return;
    const th = TH[key];
    if (th) {
      if (!originals.has(node)) originals.set(node, node.nodeValue);
      const lead = (node.nodeValue.match(/^\s*/) || [''])[0];
      const trail = (node.nodeValue.match(/\s*$/) || [''])[0];
      node.nodeValue = lead + th + trail;
    }
  } else if (originals.has(node)) {
    node.nodeValue = originals.get(node);
    originals.delete(node);
  }
}

function walk(start, toThai) {
  if (start.nodeType === 3) {
    if (!inNoTranslate(start)) translateText(start, toThai);
    return;
  }
  if (start.nodeType !== 1) return;
  if (inNoTranslate(start)) return;
  const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT, {
    acceptNode(n) { return inNoTranslate(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
  });
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach((nd) => translateText(nd, toThai));
}

function startObserver() {
  if (!root) return;
  observer = new MutationObserver((muts) => {
    if (!isThai) return;
    const todo = [];
    for (const m of muts) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((nd) => {
          if ((nd.nodeType === 1 || nd.nodeType === 3) && !inNoTranslate(nd)) todo.push(nd);
        });
      } else if (m.type === 'characterData') {
        if (!inNoTranslate(m.target)) todo.push(m.target);
      }
    }
    if (!todo.length) return;
    observer.disconnect();
    todo.forEach((nd) => walk(nd, true));
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  });
}

function setLang(thai) {
  isThai = thai;
  document.body.classList.toggle('lang-th', thai);
  if (observer) observer.disconnect();
  if (!root) root = document.getElementById('root');
  if (root) walk(root, thai);
  if (thai && observer && root) {
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  }
}

function init() {
  root = document.getElementById('root');
  startObserver();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export function LangToggle() {
  const [thai, setThai] = React.useState(false);
  const choose = (t) => { setThai(t); setLang(t); };
  return (
    <div className="lang-toggle" data-no-translate="true" role="group" aria-label="Language">
      <button className={!thai ? 'lt-on' : ''} onClick={() => choose(false)}>EN</button>
      <button className={thai ? 'lt-on' : ''} onClick={() => choose(true)}>ไทย</button>
    </div>
  );
}
