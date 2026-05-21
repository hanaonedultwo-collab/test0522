import { calculateSaju, calculateSajuSimple, lunarToSolar, type SajuResult } from "@fullstackfamily/manseryeok";

type CalendarType = "solar" | "lunar";
type YinYang = "양" | "음";
type Element = "목" | "화" | "토" | "금" | "수";

type StemInfo = {
  element: Element;
  yinYang: YinYang;
};

type BranchInfo = {
  element: Element;
  animal: string;
};

export type BirthInput = {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  birthTimeUnknown?: boolean;
  calendarType: CalendarType;
  isLeapMonth?: boolean;
  longitude?: number;
};

export type PillarToken = {
  text: string;
  stem: string;
  branch: string;
};

export type ChartComputationResult = {
  solarDate: { year: number; month: number; day: number };
  saju: SajuResult;
  pillars: {
    year: PillarToken;
    month: PillarToken;
    day: PillarToken;
    hour: PillarToken | null;
  };
  fiveElements: Record<Element, number>;
  tenGods: {
    yearStem: string;
    monthStem: string;
    dayStem: string;
    hourStem: string | null;
  };
  advanced: {
    hiddenStems: Record<string, string[]>;
    sinsal: string[];
    daeun: Array<{ age: number; pillar: string }>;
    saeun: Array<{ year: number; pillar: string }>;
  };
};

const STEM_MAP: Record<string, StemInfo> = {
  갑: { element: "목", yinYang: "양" },
  을: { element: "목", yinYang: "음" },
  병: { element: "화", yinYang: "양" },
  정: { element: "화", yinYang: "음" },
  무: { element: "토", yinYang: "양" },
  기: { element: "토", yinYang: "음" },
  경: { element: "금", yinYang: "양" },
  신: { element: "금", yinYang: "음" },
  임: { element: "수", yinYang: "양" },
  계: { element: "수", yinYang: "음" },
};

const BRANCH_MAP: Record<string, BranchInfo> = {
  자: { element: "수", animal: "쥐" },
  축: { element: "토", animal: "소" },
  인: { element: "목", animal: "호랑이" },
  묘: { element: "목", animal: "토끼" },
  진: { element: "토", animal: "용" },
  사: { element: "화", animal: "뱀" },
  오: { element: "화", animal: "말" },
  미: { element: "토", animal: "양" },
  신: { element: "금", animal: "원숭이" },
  유: { element: "금", animal: "닭" },
  술: { element: "토", animal: "개" },
  해: { element: "수", animal: "돼지" },
};

const HIDDEN_STEMS: Record<string, string[]> = {
  자: ["계"],
  축: ["기", "계", "신"],
  인: ["갑", "병", "무"],
  묘: ["을"],
  진: ["무", "을", "계"],
  사: ["병", "무", "경"],
  오: ["정", "기"],
  미: ["기", "정", "을"],
  신: ["경", "임", "무"],
  유: ["신"],
  술: ["무", "신", "정"],
  해: ["임", "갑"],
};

const SIXTY_CYCLE = [
  "갑자",
  "을축",
  "병인",
  "정묘",
  "무진",
  "기사",
  "경오",
  "신미",
  "임신",
  "계유",
  "갑술",
  "을해",
  "병자",
  "정축",
  "무인",
  "기묘",
  "경진",
  "신사",
  "임오",
  "계미",
  "갑신",
  "을유",
  "병술",
  "정해",
  "무자",
  "기축",
  "경인",
  "신묘",
  "임진",
  "계사",
  "갑오",
  "을미",
  "병신",
  "정유",
  "무술",
  "기해",
  "경자",
  "신축",
  "임인",
  "계묘",
  "갑진",
  "을사",
  "병오",
  "정미",
  "무신",
  "기유",
  "경술",
  "신해",
  "임자",
  "계축",
  "갑인",
  "을묘",
  "병진",
  "정사",
  "무오",
  "기미",
  "경신",
  "신유",
  "임술",
  "계해",
];

const GENERATES: Record<Element, Element> = {
  목: "화",
  화: "토",
  토: "금",
  금: "수",
  수: "목",
};

const CONTROLS: Record<Element, Element> = {
  목: "토",
  화: "금",
  토: "수",
  금: "목",
  수: "화",
};

function splitPillar(raw: string | null): PillarToken | null {
  if (!raw) {
    return null;
  }

  return {
    text: raw,
    stem: raw[0] ?? "",
    branch: raw[1] ?? "",
  };
}

function getTenGod(dayStem: string, targetStem: string): string {
  const day = STEM_MAP[dayStem];
  const target = STEM_MAP[targetStem];

  if (!day || !target) {
    return "미정";
  }

  const samePolarity = day.yinYang === target.yinYang;

  if (day.element === target.element) {
    return samePolarity ? "비견" : "겁재";
  }

  if (GENERATES[day.element] === target.element) {
    return samePolarity ? "식신" : "상관";
  }

  if (CONTROLS[day.element] === target.element) {
    return samePolarity ? "편재" : "정재";
  }

  if (CONTROLS[target.element] === day.element) {
    return samePolarity ? "편관" : "정관";
  }

  if (GENERATES[target.element] === day.element) {
    return samePolarity ? "편인" : "정인";
  }

  return "미정";
}

function countElements(pillars: Array<PillarToken | null>): Record<Element, number> {
  const counts: Record<Element, number> = {
    목: 0,
    화: 0,
    토: 0,
    금: 0,
    수: 0,
  };

  pillars.forEach((pillar) => {
    if (!pillar) {
      return;
    }

    const stemInfo = STEM_MAP[pillar.stem];
    const branchInfo = BRANCH_MAP[pillar.branch];

    if (stemInfo) {
      counts[stemInfo.element] += 1;
    }

    if (branchInfo) {
      counts[branchInfo.element] += 1;
    }
  });

  return counts;
}

function normalizeToSolarDate(input: BirthInput): { year: number; month: number; day: number } {
  if (input.calendarType === "solar") {
    return {
      year: input.year,
      month: input.month,
      day: input.day,
    };
  }

  const converted = lunarToSolar(input.year, input.month, input.day, input.isLeapMonth ?? false);
  return converted.solar;
}

function getCycleNext(base: string, offset: number) {
  const index = SIXTY_CYCLE.indexOf(base);
  if (index < 0) {
    return base;
  }

  return SIXTY_CYCLE[(index + offset + SIXTY_CYCLE.length) % SIXTY_CYCLE.length];
}

function buildAdvancedData(params: {
  monthPillar: string;
  dayPillar: string;
  yearPillar: string;
  hourPillar: string | null;
  solarYear: number;
}) {
  const monthBranch = params.monthPillar[1] ?? "";
  const dayBranch = params.dayPillar[1] ?? "";
  const yearBranch = params.yearPillar[1] ?? "";
  const hourBranch = params.hourPillar?.[1] ?? "";

  const hiddenStems = {
    년지: HIDDEN_STEMS[yearBranch] ?? [],
    월지: HIDDEN_STEMS[monthBranch] ?? [],
    일지: HIDDEN_STEMS[dayBranch] ?? [],
    시지: hourBranch ? HIDDEN_STEMS[hourBranch] ?? [] : [],
  };

  const sinsal = [
    monthBranch === "인" || monthBranch === "오" || monthBranch === "술" ? "문창귀인" : "천을귀인",
    dayBranch === "자" || dayBranch === "오" ? "도화" : "역마",
    yearBranch === "진" || yearBranch === "술" ? "괴강" : "화개",
  ];

  const daeun = Array.from({ length: 8 }).map((_, idx) => ({
    age: 10 + idx * 10,
    pillar: getCycleNext(params.monthPillar, idx + 1),
  }));

  const saeun = Array.from({ length: 10 }).map((_, idx) => ({
    year: params.solarYear + idx,
    pillar: getCycleNext(params.yearPillar, idx),
  }));

  return {
    hiddenStems,
    sinsal,
    daeun,
    saeun,
  };
}

export function computeChart(input: BirthInput): ChartComputationResult {
  const solarDate = normalizeToSolarDate(input);

  const saju = input.birthTimeUnknown
    ? calculateSajuSimple(solarDate.year, solarDate.month, solarDate.day)
    : calculateSaju(solarDate.year, solarDate.month, solarDate.day, input.hour, input.minute, {
        longitude: input.longitude ?? 127,
        applyTimeCorrection: true,
      });

  const year = splitPillar(saju.yearPillar);
  const month = splitPillar(saju.monthPillar);
  const day = splitPillar(saju.dayPillar);
  const hour = splitPillar(saju.hourPillar);

  if (!year || !month || !day) {
    throw new Error("사주 원국을 파싱할 수 없습니다.");
  }

  return {
    solarDate,
    saju,
    pillars: { year, month, day, hour },
    fiveElements: countElements([year, month, day, hour]),
    tenGods: {
      yearStem: getTenGod(day.stem, year.stem),
      monthStem: getTenGod(day.stem, month.stem),
      dayStem: "일원",
      hourStem: hour ? getTenGod(day.stem, hour.stem) : null,
    },
    advanced: buildAdvancedData({
      monthPillar: saju.monthPillar,
      dayPillar: saju.dayPillar,
      yearPillar: saju.yearPillar,
      hourPillar: saju.hourPillar,
      solarYear: solarDate.year,
    }),
  };
}