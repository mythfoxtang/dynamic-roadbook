const CREW = {
  me: {
    id: "me",
    name: "你",
    role: "Lead Driver",
    note: "从出发一路单刷到第一次到喀什。",
    avatar: "/avatars/driver-poop.svg",
    accent: "from-amber-500/30 to-orange-500/10"
  },
  mom: {
    id: "mom",
    name: "妈妈",
    role: "Co-Pilot",
    note: "第一次到喀什后加入，负责陪伴和副驾节奏。",
    avatar: "/avatars/mom.svg",
    accent: "from-pink-500/25 to-fuchsia-500/10"
  },
  dad: {
    id: "dad",
    name: "爸爸",
    role: "Late Joiner",
    note: "第二次回到喀什后加入，后半程编队完成。",
    avatar: "/avatars/dad.svg",
    accent: "from-sky-500/25 to-cyan-500/10"
  }
};

export function getCrewForDay(dayNumber) {
  if (dayNumber <= 17) return [CREW.me];
  if (dayNumber <= 20) return [CREW.me, CREW.mom];
  return [CREW.me, CREW.mom, CREW.dad];
}

export function getCrewEventLabel(dayNumber) {
  if (dayNumber <= 17) return "Solo stage";
  if (dayNumber <= 20) return "Mom joined at Kashgar";
  return "Dad joined after 2nd Kashgar return";
}
