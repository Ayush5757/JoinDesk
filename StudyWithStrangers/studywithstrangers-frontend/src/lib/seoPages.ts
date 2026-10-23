/**
 * Content for the public, search-friendly guide pages (no login needed).
 * Each page targets one search intent. Rendered by components/studywithstrangers/SeoPage.tsx.
 */

export const SITE_URL = "https://www.studywithstrangers.com";
export const SITE_NAME = "StudyWithStrangers";
export const CONTENT_UPDATED = "2026-10-23";

export type SeoSection = {
  h2: string;
  paragraphs?: string[];
  /** Bulleted list shown under the paragraphs. */
  bullets?: string[];
  /** Numbered list shown under the paragraphs. */
  steps?: string[];
};

export type SeoPageData = {
  slug: string;
  path: string;
  /** <title> — keyword first, brand last. */
  title: string;
  /** meta description, ~150 characters. */
  description: string;
  keywords: string;
  h1: string;
  /** Short label used in "Related guides" links. */
  label: string;
  intro: string[];
  sections: SeoSection[];
  faq: { question: string; answer: string }[];
  ctaTitle: string;
  ctaText: string;
};

export const SEO_PAGES: SeoPageData[] = [
  // ------------------------------------------------------------------ 1
  {
    slug: "study-with-strangers",
    path: "/study-with-strangers",
    title: "Study With Strangers Online — Free Virtual Study Rooms | StudyWithStrangers",
    description:
      "Study with strangers online in free virtual study rooms. Join a live desk, keep your camera on or off, and stay focused with real people. Start in under a minute.",
    keywords:
      "study with strangers, study with strangers online, study with people online, online study with strangers, virtual study room, study with strangers free, find a study partner, study buddy online",
    h1: "Study With Strangers Online",
    label: "Study with strangers online",
    intro: [
      "Studying alone is hard. The phone is right there, the chapter is long, and nobody would notice if you stopped. Studying with strangers online fixes that in a simple way: you sit down with other people who are also working, and the quiet pressure of being in the same room keeps you going.",
      "StudyWithStrangers is a free place to do exactly that. You join a live desk (a video call room), say nothing if you don't want to, and work on your own subject while others work on theirs. No group chat to keep up with, no pressure to make friends, and nothing to install.",
    ],
    sections: [
      {
        h2: "What does it mean to study with strangers?",
        paragraphs: [
          "It means studying in a shared session with people you have never met: students, researchers, job seekers, and professionals who each bring their own work. Nobody needs to know the same subject. The only shared goal is to focus for a block of time.",
          "People often call this \"body doubling\", \"co-working\", or a \"study with me\" session. The idea is the same in every case: working next to someone else makes it easier to start and harder to quit.",
        ],
      },
      {
        h2: "Why studying with strangers helps you focus",
        bullets: [
          "It makes starting easier. Joining a room that is already quiet and busy lowers the effort of getting going.",
          "It adds gentle accountability. When others can see you, you are less likely to drift to your phone or switch tabs.",
          "It removes the loneliness of long study days, especially for self-study, exam preparation, and remote work.",
          "It costs nothing socially. Strangers have no expectations of you, so there is no small talk, no judgement, and no need to perform.",
          "It builds a routine. Seeing live desks every day turns \"I should study\" into \"I'll join a desk\".",
        ],
      },
      {
        h2: "How to study with strangers on StudyWithStrangers",
        steps: [
          "Sign in with your Google account. There is nothing to download.",
          "Browse the live desks. Each desk shows its topic, subject, and who opened it. Use search or the topic filter to find your field.",
          "Press Join. You are taken to the desk's video call link (Google Meet, Zoom, Teams, or similar).",
          "Turn your camera on or keep it off, mute yourself, and start working. Use the Focus Timer on the site to run focused blocks and breaks.",
          "No desk for your subject right now? Create your own in a few seconds. It stays live for 3 hours, and you can reopen it from your profile any time.",
        ],
      },
      {
        h2: "Tips for a great session with strangers",
        bullets: [
          "Decide what you will finish before you join. One clear goal per session works better than a vague \"study\".",
          "Stay muted unless the desk is meant for discussion. Most desks are silent co-working rooms.",
          "Use blocks of 25 to 50 minutes with a short break. The built-in Focus Timer is made for this.",
          "Keep personal details private. Never share your phone number, address, or social media in a public room.",
          "Come back at the same time each day. A regular slot is what turns a session into a habit.",
        ],
      },
      {
        h2: "Is it safe to study with strangers online?",
        paragraphs: [
          "You stay in control. Your camera is optional, you only share what you choose to, and you can leave a desk whenever you like. Desk creators can block people from their desks, and you can block anyone yourself. In Random Chat, people who are repeatedly reported are paused until an admin reviews them.",
          "As with any online space, use common sense: do not share private information, do not click links from people you don't know, and leave any room that makes you uncomfortable.",
        ],
      },
      {
        h2: "Who studies with strangers here?",
        paragraphs: [
          "School and college students, people preparing for competitive and entrance exams (JEE, NEET, UPSC, GATE, CA, GRE, IELTS and others), university researchers writing a thesis, freelancers and remote workers, language learners, and anyone who gets more done with other people around. People join from India and from many other countries, at all hours.",
        ],
      },
    ],
    faq: [
      {
        question: "How can I study with strangers online for free?",
        answer:
          "Sign in with Google on StudyWithStrangers, open a live desk that matches your topic, and join its video call. It is free to start and needs no download.",
      },
      {
        question: "Do I have to talk or turn my camera on?",
        answer:
          "No. Most people stay muted and many keep their camera off. You only speak if you want to, and the desk's creator sets the tone for the room.",
      },
      {
        question: "What if there is no desk for my subject?",
        answer:
          "Create one. Add a title, a subject, and a meeting link, and it appears in the list for 3 hours. You can reuse it from your profile whenever you want to study again.",
      },
      {
        question: "How is this different from study with me videos on YouTube?",
        answer:
          "A study with me video is something you watch. On StudyWithStrangers you join a live room with real people, so you are actually seen working, which makes the accountability stronger.",
      },
      {
        question: "Can I study with strangers from other countries?",
        answer:
          "Yes. Desks are open to everyone, so you can find people from different cities and time zones. Look for desks that are live at your usual study time.",
      },
      {
        question: "Is studying with strangers better than studying alone?",
        answer:
          "Many people find it easier to start and to keep going. It works best for tasks that need steady attention, like reading, revision, problem sets, and writing.",
      },
    ],
    ctaTitle: "Ready to study with strangers?",
    ctaText: "See the live desks and join one in under a minute.",
  },

  // ------------------------------------------------------------------ 2
  {
    slug: "talk-to-strangers",
    path: "/talk-to-strangers",
    title: "Talk to Strangers Online — Meet Study Partners Safely | StudyWithStrangers",
    description:
      "Want to talk to strangers online? Meet focused people through random 1-on-1 video chat or live study desks, with clear safety tools. Free to start, no download.",
    keywords:
      "talk to strangers, talk to strangers online, random video chat, meet new people online, make friends online, study partner online, chat with strangers safely, find a study buddy",
    h1: "Talk to Strangers Online — Safely and With a Purpose",
    label: "Talk to strangers online",
    intro: [
      "Most places to talk to strangers online are noisy, random, and sometimes unsafe. StudyWithStrangers is different: the people here are busy with something real (studying, writing, preparing for an exam), so conversations start from common ground instead of from nothing.",
      "You can chat one-on-one in Random Chat, or join a desk and talk to people before and after you work. Either way you decide how much to share, and the reporting and blocking tools are always one tap away.",
    ],
    sections: [
      {
        h2: "Two ways to talk to strangers here",
        bullets: [
          "Random Chat: a free 1-on-1 video chat in your browser. Press Start to be matched with someone, and press Next to move on whenever you like.",
          "Study desks: join a live room and say hello to the people studying with you. Many desks are silent, and some are open for a short chat during breaks.",
        ],
      },
      {
        h2: "Why talk to someone who is also studying?",
        paragraphs: [
          "Because you already have something in common. Asking \"what are you working on today?\" is an easy, friendly opener that needs no clever lines. People who study at the same hour as you also tend to share your time zone, your exams, or your goals.",
        ],
      },
      {
        h2: "Easy conversation starters",
        bullets: [
          "\"What are you studying today?\"",
          "\"How long is your session? Want to do a 25-minute block together?\"",
          "\"What helps you stay focused when the topic is boring?\"",
          "\"Which exam or deadline are you preparing for?\"",
          "\"Can we check in again after the break and share what we finished?\"",
        ],
      },
      {
        h2: "How to turn a stranger into a study buddy",
        steps: [
          "Study in the same desk a few times so you recognise each other.",
          "After a good session, say you enjoyed it and suggest the same time tomorrow.",
          "Follow the person who opened the desk to get a notification the next time they open one.",
          "Agree on a simple routine: same time, same length, short check-in at the end.",
        ],
      },
      {
        h2: "Stay safe when you talk to strangers online",
        bullets: [
          "Never share your phone number, home address, school, or social media with someone you just met.",
          "Do not click links or install anything a stranger sends you.",
          "Leave straight away if anyone is rude, pushy, or inappropriate, then report them so the team can act.",
          "Use Block to make sure someone never reaches you again.",
          "Keep your camera off if you prefer. You can always join a desk without showing your face.",
        ],
      },
      {
        h2: "Rules of the room",
        paragraphs: [
          "StudyWithStrangers is for studying and working, not for dating or harassment. Nudity, harassment, spam, and other abuse are reportable reasons, and people who are reported by several different users are paused until the team reviews them.",
        ],
      },
    ],
    faq: [
      {
        question: "Is random video chat on StudyWithStrangers free?",
        answer:
          "Random Chat is available to signed-in users and is free to start. Open the Random Chat page, press Start, and you are matched with another person.",
      },
      {
        question: "Is it safe to talk to strangers online?",
        answer:
          "It can be, if you stay careful. Share no personal details, keep your camera optional, and use the Report and Block tools if anything feels wrong.",
      },
      {
        question: "What if someone is rude or inappropriate?",
        answer:
          "Leave the call, report the person with a reason, and block them. People who are repeatedly reported are paused until an admin reviews the reports.",
      },
      {
        question: "Can I talk to strangers from other countries?",
        answer:
          "Yes. Random Chat and the desks are open to everyone, so you may meet people from different places and time zones.",
      },
      {
        question: "Do I have to keep talking the whole time?",
        answer:
          "No. You can say hello, work quietly side by side, and say goodbye. Press Next in Random Chat or leave a desk whenever you want.",
      },
    ],
    ctaTitle: "Meet someone new, then get some work done",
    ctaText: "Try Random Chat, or join a live desk and say hello.",
  },

  // ------------------------------------------------------------------ 3
  {
    slug: "how-to-study-better",
    path: "/how-to-study-better",
    title: "How to Study Better: 9 Habits to Improve Focus & Results | StudyWithStrangers",
    description:
      "Learn how to study better with 9 simple habits: Pomodoro, active recall, spaced repetition, tracking, and studying with others. Free tools included.",
    keywords:
      "how to study better, how to improve study, how to focus on studying, study tips, how to stop procrastinating, pomodoro technique, active recall, study consistently, study habits",
    h1: "How to Study Better: 9 Habits That Actually Improve Your Results",
    label: "How to study better",
    intro: [
      "Studying more hours does not always mean learning more. What changes your results is how you study and how consistently you show up. These nine habits are simple, free, and backed by how memory and attention work.",
      "You can use them on your own, and every one of them gets easier when other people are working next to you.",
    ],
    sections: [
      {
        h2: "1. Start with one clear goal per session",
        paragraphs: [
          "\"Study biology\" is vague. \"Finish chapter 4 questions and review the ones I got wrong\" is something you can complete. Write the goal down before you begin, and stop the session when it is done or the time is up.",
        ],
      },
      {
        h2: "2. Work in focused blocks (the Pomodoro method)",
        paragraphs: [
          "Study for a fixed block, usually 25 to 50 minutes, then take a short break. The break protects your attention and the fixed block makes starting less scary. The Focus Timer on StudyWithStrangers is built for this and counts your study time for you.",
        ],
      },
      {
        h2: "3. Test yourself instead of rereading",
        paragraphs: [
          "Active recall means closing the book and trying to remember. Answer questions, write down what you know, or explain the idea out loud. It feels harder than rereading, and that effort is exactly why it helps you remember.",
        ],
      },
      {
        h2: "4. Space your revision over days",
        paragraphs: [
          "Reviewing a topic again after a day, a few days, and a week keeps it in memory far better than one long cramming session. Put your revision dates in a calendar so you don't have to remember them.",
        ],
      },
      {
        h2: "5. Remove the phone",
        paragraphs: [
          "Put it in another room or turn on do-not-disturb. Even a phone you are not using on the desk pulls on your attention. If you need notes on your phone, close everything else.",
        ],
      },
      {
        h2: "6. Study alongside other people",
        paragraphs: [
          "Being in a room with others who are working is one of the easiest ways to start and keep going. Join a live desk, stay on mute, and work. You don't have to know anyone or talk to anyone.",
        ],
      },
      {
        h2: "7. Track your study time",
        paragraphs: [
          "What you measure, you tend to improve. A simple tracker shows how many days in a row you studied and how your hours change from week to week. Use the Study Tracker to set goals and see your history.",
        ],
      },
      {
        h2: "8. Protect sleep, food, and movement",
        paragraphs: [
          "Memory is stored and sorted while you sleep, and a tired brain studies slowly. A walk, water, and a regular sleep schedule often improve your study more than another hour at the desk.",
        ],
      },
      {
        h2: "9. Review your mistakes",
        paragraphs: [
          "After a test or a problem set, look at what you got wrong and why. Keep a short list of recurring mistakes and revisit it before the exam. This is usually the highest-value revision you can do.",
        ],
      },
      {
        h2: "A simple daily routine you can copy",
        steps: [
          "Pick one goal for the session and write it down.",
          "Join a live desk at the same time every day and start your Focus Timer.",
          "Study for one block, take a 5-minute break, then repeat.",
          "At the end, test yourself on what you just learned.",
          "Log your time in the Study Tracker and note what to do tomorrow.",
        ],
      },
    ],
    faq: [
      {
        question: "How can I improve my study habits?",
        answer:
          "Set one clear goal per session, study in timed blocks, test yourself instead of rereading, and study at the same time every day, ideally next to other people.",
      },
      {
        question: "How do I stop procrastinating and start studying?",
        answer:
          "Make starting tiny: join a live desk, set a 25-minute timer, and begin with the easiest task. Being around people who are already working makes the first minutes much easier.",
      },
      {
        question: "How many hours should I study in a day?",
        answer:
          "It depends on your goals and your level, so there is no single number. Focus on quality blocks with full attention and review, and increase the time gradually.",
      },
      {
        question: "How can I focus on studying at home?",
        answer:
          "Pick one place, remove your phone, use a focus timer, and study with others on a video call. A shared room, even an online one, gives the structure that home often lacks.",
      },
      {
        question: "Is the Pomodoro technique really effective?",
        answer:
          "Many students find it helpful because the short fixed blocks make it easier to begin and the breaks stop you burning out. Adjust the block length to what works for you.",
      },
    ],
    ctaTitle: "Put these habits into practice",
    ctaText: "Join a live desk, start your Focus Timer, and track your progress.",
  },

  // ------------------------------------------------------------------ 4
  {
    slug: "virtual-study-room",
    path: "/virtual-study-room",
    title: "Virtual Study Room — Study With Me Live Online | StudyWithStrangers",
    description:
      "Join a free virtual study room and study live with real people. Silent co-working desks, a Pomodoro focus timer, and a study tracker. No download needed.",
    keywords:
      "virtual study room, online study room, study with me live, study with me online, online study room free, virtual library, live study room, co-working online, silent study room",
    h1: "Virtual Study Room: Study With Me, Live",
    label: "Virtual study room",
    intro: [
      "A virtual study room is an online space where people study at the same time, so you feel the focus of a library without leaving home. It is the live version of a \"study with me\" video: instead of watching someone else, you are in the room too.",
      "StudyWithStrangers gives you free virtual study rooms (called desks), a Pomodoro focus timer, and a study tracker in one place.",
    ],
    sections: [
      {
        h2: "What is a virtual study room?",
        paragraphs: [
          "It is a shared online session where people work quietly together, usually over a video call with cameras optional. Some rooms are silent, some allow short chats during breaks, and some are built around a timer so everyone studies and rests at the same moments.",
        ],
      },
      {
        h2: "Types of online study rooms",
        bullets: [
          "Study-with-me livestreams: you watch a creator study. Good for ambience, but nobody sees you.",
          "Chat communities: servers and groups with voice or video rooms. Flexible, but they can be noisy.",
          "One-on-one coworking: you are paired with a single partner for a timed session.",
          "Open study desks: live rooms listed by topic that you can join and leave at any time. This is what StudyWithStrangers offers.",
        ],
      },
      {
        h2: "How a desk on StudyWithStrangers works",
        steps: [
          "A creator opens a desk with a topic, a subject, and a meeting link from any video platform.",
          "The desk appears in the live list for 3 hours, so what you see is always recent, never an old, empty room.",
          "You press Join and are taken to the call. Camera and microphone are your choice.",
          "When a desk's time is up the creator is notified, and they can reopen it from their profile if they are still studying.",
        ],
      },
      {
        h2: "Pick the right room",
        bullets: [
          "Choose a topic that matches your work, like exam preparation, coding, research, or languages.",
          "Look at the subject line and description to see if it is silent or open to discussion.",
          "Prefer desks that are live right now. Fresh desks have real people in them.",
          "Special desks are curated, always-on rooms for when you can't find anything else.",
        ],
      },
      {
        h2: "Make your online study room work for you",
        paragraphs: [
          "Pair the room with the Focus Timer to run clear blocks and breaks, and log your hours in the Study Tracker. Over a few weeks, the streak and the history show your progress, which keeps you coming back.",
        ],
      },
    ],
    faq: [
      {
        question: "Is the virtual study room free?",
        answer:
          "It is free to start. Sign in with Google, browse the live desks, and join one in a few seconds.",
      },
      {
        question: "Do I need to download an app?",
        answer:
          "No. StudyWithStrangers runs in your browser and sends you to a standard video call link, so there is nothing to install.",
      },
      {
        question: "Is a virtual study room silent?",
        answer:
          "Most are. You can stay muted for the whole session, and desks that allow talking say so in their description.",
      },
      {
        question: "What is the difference between a study room and a study with me video?",
        answer:
          "A study with me video is something you watch. A virtual study room is live, so other people can see you working, which makes it easier to stay accountable.",
      },
      {
        question: "Can I create my own virtual study room?",
        answer:
          "Yes. Create a desk with a title, subject, and meeting link. It stays listed for 3 hours and you can reuse it from your profile.",
      },
    ],
    ctaTitle: "Step into a live study room",
    ctaText: "Browse the desks that are live right now.",
  },
];

export const getSeoPage = (slug: string) => SEO_PAGES.find((p) => p.slug === slug)!;

/** <head> tags for one guide page: title, description, canonical, social tags and structured data. */
export function seoHead(page: SeoPageData) {
  const url = `${SITE_URL}${page.path}`;
  return {
    meta: [
      { title: page.title },
      { name: "description", content: page.description },
      { name: "keywords", content: page.keywords },
      { property: "og:type", content: "article" },
      { property: "og:title", content: page.title },
      { property: "og:description", content: page.description },
      { property: "og:url", content: url },
      { name: "twitter:title", content: page.title },
      { name: "twitter:description", content: page.description },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Article",
              headline: page.h1,
              description: page.description,
              url,
              mainEntityOfPage: url,
              inLanguage: "en",
              dateModified: CONTENT_UPDATED,
              image: `${SITE_URL}/og-image.png`,
              author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
              publisher: {
                "@type": "Organization",
                name: SITE_NAME,
                logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` },
              },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
                { "@type": "ListItem", position: 2, name: page.label, item: url },
              ],
            },
            {
              "@type": "FAQPage",
              mainEntity: page.faq.map((f) => ({
                "@type": "Question",
                name: f.question,
                acceptedAnswer: { "@type": "Answer", text: f.answer },
              })),
            },
          ],
        }),
      },
    ],
  };
}
