const CREW = {
  me: {
    id: "me",
    name: "你",
    role: "主驾",
    note: "从出发一直单刷到第一次进入喀什，是全程的主推进手。",
    avatar: "/avatars/driver-poop.svg",
    accent: "from-amber-500/30 to-orange-500/10"
  },
  mom: {
    id: "mom",
    name: "妈妈",
    role: "副驾",
    note: "在喀什加入后，主要负责陪伴、拍照和副驾节奏。",
    avatar: "/avatars/mom.svg",
    accent: "from-pink-500/25 to-fuchsia-500/10"
  },
  dad: {
    id: "dad",
    name: "爸爸",
    role: "后半程加入",
    note: "第二次回到喀什后加入，后段从单兵推进切到家庭编队。",
    avatar: "/avatars/dad.svg",
    accent: "from-sky-500/25 to-cyan-500/10"
  }
};

export function getCrewForDay(dayNumber) {
  if (dayNumber <= 17) return [CREW.me];
  if (dayNumber <= 21) return [CREW.me, CREW.mom];
  return [CREW.me, CREW.mom, CREW.dad];
}

export function getCrewEventLabel(dayNumber) {
  if (dayNumber <= 17) return "单人推进阶段";
  if (dayNumber === 18) return "妈妈在喀什加入";
  if (dayNumber <= 21) return "妈妈同行，爸爸待会合";
  return "爸爸会合后转为三人同行";
}
