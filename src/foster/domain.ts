import type {
  Admission,
  FeeBreakdown,
  Tank,
  WaterType,
  WaterTypeId,
} from "./types";

/** 超期后每尾鱼每天追加的费用（元） */
export const OVERDUE_DAILY_RATE = 2;

export const WATER_TYPES: WaterType[] = [
  { id: "fresh", label: "淡水", hint: "常见淡水鱼，如锦鲤、神仙鱼、孔雀鱼" },
  { id: "salt", label: "海水", hint: "小丑鱼、倒吊等海水观赏鱼" },
  { id: "rift", label: "三湖弱碱", hint: "三湖慈鲷等弱碱性硬水鱼只" },
];

export const WATER_TYPE_LABEL: Record<WaterTypeId, string> = {
  fresh: "淡水",
  salt: "海水",
  rift: "三湖弱碱",
};

export function todayStr(): string {
  const d = new Date();
  return formatDate(d);
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 整日差值：b - a（按本地日历日，忽略时分秒） */
export function dayDiff(a: string, b: string): number {
  const ms = parseDate(b).getTime() - parseDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function addDays(base: string, days: number): string {
  const d = parseDate(base);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 当前在缸鱼只占用的位置数（按寄养单计，待安排/已结束不占位置） */
export function occupancyByTank(admissions: Admission[]): Record<string, number> {
  const used: Record<string, number> = {};
  for (const a of admissions) {
    if (a.status === "housed" && a.tankId) {
      used[a.tankId] = (used[a.tankId] ?? 0) + a.count;
    }
  }
  return used;
}

/**
 * 按水质类型与剩余空间挑选寄养缸：
 * 1. 水质必须一致；2. 剩余位置放得下这批鱼；
 * 3. 在满足条件的缸中选剩余位置最少的（best-fit，避免浪费大缸）。
 */
export function selectTank(
  waterType: WaterTypeId,
  count: number,
  tanks: Tank[],
  admissions: Admission[],
): Tank | undefined {
  const used = occupancyByTank(admissions);
  return tanks
    .filter((t) => t.waterType === waterType)
    .map((t) => ({ tank: t, free: t.capacity - (used[t.id] ?? 0) }))
    .filter((x) => x.free >= count)
    .sort((a, b) => a.free - b.free || a.tank.id.localeCompare(b.tank.id))[0]?.tank;
}

export function tankFree(tank: Tank, admissions: Admission[]): number {
  return tank.capacity - (occupancyByTank(admissions)[tank.id] ?? 0);
}

/**
 * 结算费用（元）。
 * 当天入缸当天回取也按 1 天计；超出约定回取日的天数按尾/天追加。
 */
export function calcFee(
  count: number,
  placedAt: string,
  expectedEnd: string,
  endDate: string,
  dailyRate: number,
  overdueRate: number = OVERDUE_DAILY_RATE,
): FeeBreakdown {
  const days = Math.max(1, dayDiff(placedAt, endDate) + 1);
  const overdueDays = Math.max(0, dayDiff(expectedEnd, endDate));
  const baseFee = count * days * dailyRate;
  const overdueFee = count * overdueDays * overdueRate;
  return {
    placedAt,
    endDate,
    days,
    rate: dailyRate,
    baseFee,
    overdueDays,
    overdueRate,
    overdueFee,
    total: baseFee + overdueFee,
  };
}

export function feePreview(
  admission: Admission,
  tank: Tank,
  endDate: string,
): FeeBreakdown {
  return calcFee(
    admission.count,
    admission.placedAt ?? todayStr(),
    admission.expectedEnd,
    endDate,
    tank.dailyRate,
  );
}

export function formatYuan(n: number): string {
  return `¥${n.toLocaleString("zh-CN")}`;
}
