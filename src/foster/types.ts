export type WaterTypeId = "fresh" | "salt" | "rift";

export interface WaterType {
  id: WaterTypeId;
  label: string;
  hint: string;
}

export interface Tank {
  id: string;
  name: string;
  waterType: WaterTypeId;
  /** 缸位总数（1 条鱼占 1 个位置） */
  capacity: number;
  /** 寄养缸当前水温 ℃ */
  temp: number;
  /** 每条鱼每天的寄养费（元） */
  dailyRate: number;
}

export type AdmissionStatus = "pending" | "housed" | "completed" | "cancelled";

export type HealthStatus = "good" | "fair" | "poor";

export interface FeeBreakdown {
  placedAt: string;
  endDate: string;
  /** 实际在缸天数（当天回取至少计 1 天） */
  days: number;
  rate: number;
  baseFee: number;
  /** 超过约定回取日的天数 */
  overdueDays: number;
  overdueRate: number;
  overdueFee: number;
  total: number;
}

export interface FosterEvent {
  at: string;
  text: string;
}

export interface Admission {
  id: string;
  customer: string;
  phone: string;
  species: string;
  count: number;
  waterType: WaterTypeId;
  /** 顾客原缸水温 ℃ */
  originTemp: number;
  registeredAt: string;
  /** 约定回取日期 */
  expectedEnd: string;
  status: AdmissionStatus;
  tankId?: string;
  /** 实际入缸日期，入缸才开始计费、占缸位 */
  placedAt?: string;
  endedAt?: string;
  health?: HealthStatus;
  healthNote?: string;
  fee?: FeeBreakdown;
  events: FosterEvent[];
}

/** 登记表单提交的数据 */
export type RegisterInput = Pick<
  Admission,
  "customer" | "phone" | "species" | "count" | "waterType" | "originTemp" | "expectedEnd"
>;
