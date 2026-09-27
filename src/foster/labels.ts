import type { AdmissionStatus, HealthStatus } from "./types";

export const STATUS_META: Record<AdmissionStatus, { label: string; cls: string }> = {
  pending: { label: "待安排", cls: "badge-pending" },
  housed: { label: "在缸寄养", cls: "badge-housed" },
  completed: { label: "已回取", cls: "badge-completed" },
  cancelled: { label: "已取消", cls: "badge-cancelled" },
};

export const HEALTH_META: Record<
  HealthStatus,
  { label: string; tone: "ok" | "warn" | "danger"; desc: string }
> = {
  good: { label: "状态良好", tone: "ok", desc: "活跃、进食正常、体表无伤" },
  fair: { label: "一般需观察", tone: "warn", desc: "活跃度一般或有轻微应激" },
  poor: { label: "状态不佳", tone: "danger", desc: "存在伤病、拒食等情况，需告知顾客" },
};
