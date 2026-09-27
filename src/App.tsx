import { useEffect, useMemo, useState, type FormEvent } from "react";
import "./styles.css";

/* ================= 领域模型 ================= */

type WaterType = "淡水" | "海水" | "汽水";
type OrderStatus = "pending" | "boarding" | "completed" | "cancelled";

interface Tank {
  id: string;
  name: string;
  waterType: WaterType;
  temperature: number;
  capacity: number; // 可容纳鱼只总数
}

interface Settlement {
  actualDays: number;
  plannedDays: number;
  overdueDays: number;
  baseFee: number;
  overdueFee: number;
  total: number;
  health: string;
  note: string;
  settledAt: string;
}

interface BoardingOrder {
  id: string;
  customer: string;
  phone: string;
  species: string; // 品种
  fishCount: number; // 鱼只数量
  sourceTemp: number; // 原缸水温
  waterType: WaterType;
  plannedDays: number;
  checkIn: string; // 登记日期 yyyy-mm-dd
  createdAt: number; // 排队序号（时间戳）
  tankId: string | null;
  status: OrderStatus;
  closedAt?: string;
  settlement?: Settlement;
}

/* ================= 常量与纯函数 ================= */

const DAILY_RATE = 5; // 寄养费：元 / 鱼 / 天
const OVERDUE_RATE = 3; // 超期追加：元 / 鱼 / 天
const STORAGE_KEY = "hxwl05-boarding-orders";

const TANKS: Tank[] = [
  { id: "t1", name: "1号淡水缸", waterType: "淡水", temperature: 24, capacity: 20 },
  { id: "t2", name: "2号草缸", waterType: "淡水", temperature: 23, capacity: 10 },
  { id: "t3", name: "3号海水缸", waterType: "海水", temperature: 25, capacity: 8 },
  { id: "t4", name: "4号汽水缸", waterType: "汽水", temperature: 26, capacity: 6 },
];

const WATER_TYPES: WaterType[] = ["淡水", "海水", "汽水"];
const HEALTH_OPTIONS = ["健康活泼", "状态平稳", "偏弱需观察", "异常（已告知顾客）"];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "待安排",
  boarding: "寄养中",
  completed: "已完成",
  cancelled: "已取消",
};

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: "warn",
  boarding: "ok",
  completed: "info",
  cancelled: "muted",
};

function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

function diffDays(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
}

/** 寄养天数：入缸当天计为第 1 天 */
function actualDaysOf(o: { checkIn: string }, end: string): number {
  return Math.max(1, diffDays(o.checkIn, end) + 1);
}

function overdueDaysOf(o: { checkIn: string; plannedDays: number }, end: string): number {
  return Math.max(0, actualDaysOf(o, end) - o.plannedDays);
}

function computeSettlement(
  o: { checkIn: string; plannedDays: number; fishCount: number },
  endDate: string
) {
  const actualDays = actualDaysOf(o, endDate);
  const overdueDays = Math.max(0, actualDays - o.plannedDays);
  const baseFee = actualDays * DAILY_RATE * o.fishCount;
  const overdueFee = overdueDays * OVERDUE_RATE * o.fishCount;
  return {
    actualDays,
    plannedDays: o.plannedDays,
    overdueDays,
    baseFee,
    overdueFee,
    total: baseFee + overdueFee,
    settledAt: endDate,
  };
}

/** 统计各寄养缸被占用的位置（仅寄养中的订单占位） */
function occupiedByTank(orders: BoardingOrder[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const o of orders) {
    if (o.status === "boarding" && o.tankId) {
      map[o.tankId] = (map[o.tankId] ?? 0) + o.fishCount;
    }
  }
  return map;
}

/** 按水质类型与剩余空间挑缸：同水质、空位足够，优先选剩余空间最紧的缸（保留大缸给大单） */
function pickTank(
  occupied: Record<string, number>,
  waterType: WaterType,
  fishCount: number
): Tank | null {
  let best: { tank: Tank; free: number } | null = null;
  for (const tank of TANKS) {
    if (tank.waterType !== waterType) continue;
    const free = tank.capacity - (occupied[tank.id] ?? 0);
    if (free < fishCount) continue;
    if (!best || free < best.free) best = { tank, free };
  }
  return best?.tank ?? null;
}

/** 空位释放后，按登记顺序尝试让待安排订单入缸 */
function autoAssign(list: BoardingOrder[]): { next: BoardingOrder[]; assigned: BoardingOrder[] } {
  const occupied = occupiedByTank(list);
  const assigned: BoardingOrder[] = [];
  const next = list.map((o) => {
    if (o.status !== "pending") return o;
    const tank = pickTank(occupied, o.waterType, o.fishCount);
    if (!tank) return o;
    occupied[tank.id] = (occupied[tank.id] ?? 0) + o.fishCount;
    const moved: BoardingOrder = { ...o, status: "boarding", tankId: tank.id };
    assigned.push(moved);
    return moved;
  });
  return { next, assigned };
}

function nextId(orders: BoardingOrder[]): string {
  const max = orders.reduce((m, o) => {
    const n = Number(o.id.replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 1000);
  return `B-${max + 1}`;
}

function seedOrders(): BoardingOrder[] {
  return [
    { id: "B-1001", customer: "王建国", phone: "13800001111", species: "金鱼", fishCount: 4, sourceTemp: 22, waterType: "淡水", plannedDays: 7, checkIn: daysAgo(2), createdAt: 1, tankId: "t1", status: "boarding" },
    { id: "B-1002", customer: "李婷", phone: "13900002222", species: "孔雀鱼", fishCount: 6, sourceTemp: 25, waterType: "淡水", plannedDays: 5, checkIn: daysAgo(9), createdAt: 2, tankId: "t2", status: "boarding" },
    { id: "B-1003", customer: "陈海", phone: "13700003333", species: "小丑鱼", fishCount: 5, sourceTemp: 26, waterType: "海水", plannedDays: 10, checkIn: daysAgo(1), createdAt: 3, tankId: "t3", status: "boarding" },
    { id: "B-1004", customer: "周洁", phone: "13600004444", species: "宝莲灯", fishCount: 12, sourceTemp: 24, waterType: "淡水", plannedDays: 14, checkIn: daysAgo(3), createdAt: 4, tankId: "t1", status: "boarding" },
    { id: "B-1005", customer: "孙强", phone: "13500005555", species: "七彩神仙", fishCount: 8, sourceTemp: 28, waterType: "淡水", plannedDays: 4, checkIn: daysAgo(0), createdAt: 5, tankId: null, status: "pending" },
    {
      id: "B-1006", customer: "赵敏", phone: "13400006666", species: "泰国斗鱼", fishCount: 1, sourceTemp: 26, waterType: "淡水", plannedDays: 3, checkIn: daysAgo(6), createdAt: 6, tankId: "t2", status: "completed", closedAt: daysAgo(3),
      settlement: { ...computeSettlement({ checkIn: daysAgo(6), plannedDays: 3, fishCount: 1 }, daysAgo(3)), health: "健康活泼", note: "" },
    },
    { id: "B-1007", customer: "吴凡", phone: "13300007777", species: "血鹦鹉", fishCount: 3, sourceTemp: 26, waterType: "淡水", plannedDays: 6, checkIn: daysAgo(1), createdAt: 7, tankId: "t1", status: "cancelled", closedAt: daysAgo(0) },
  ];
}

function loadOrders(): BoardingOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as BoardingOrder[];
    }
  } catch {
    // 缓存损坏时回退到示例数据
  }
  return seedOrders();
}

/* ================= 小组件 ================= */

function MetricCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
      <i className={tone} />
    </article>
  );
}

function TankCard({ tank, used, guests }: { tank: Tank; used: number; guests: BoardingOrder[] }) {
  const free = tank.capacity - used;
  const pct = Math.min(100, Math.round((used / tank.capacity) * 100));
  return (
    <article className="tank-card">
      <div className="tank-head">
        <strong>{tank.name}</strong>
        <span className="badge info">{tank.waterType} · {tank.temperature}°C</span>
      </div>
      <div className={`tank-bar ${free === 0 ? "full" : ""}`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="tank-meta">
        <span>已占 {used} / 共 {tank.capacity} 位</span>
        <strong className={free === 0 ? "danger-text" : ""}>{free === 0 ? "已满" : `空闲 ${free} 位`}</strong>
      </div>
      {guests.length > 0 && (
        <ul className="tank-guests">
          {guests.map((g) => (
            <li key={g.id}>{g.customer} · {g.species}×{g.fishCount}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function OrderCard({
  order,
  tank,
  today,
  onPickup,
  onCancel,
  onRetry,
}: {
  order: BoardingOrder;
  tank: Tank | null;
  today: string;
  onPickup: (o: BoardingOrder) => void;
  onCancel: (o: BoardingOrder) => void;
  onRetry: (o: BoardingOrder) => void;
}) {
  const actualDays = actualDaysOf(order, today);
  const overdueDays = overdueDaysOf(order, today);
  const tempDiff = tank ? Math.abs(tank.temperature - order.sourceTemp) : 0;

  return (
    <article className="order-card">
      <div className="order-head">
        <div>
          <div className="order-title">
            <strong>{order.customer}</strong>
            <span className="order-id">{order.id}</span>
          </div>
          <p className="order-meta">{order.phone}</p>
        </div>
        <div className="badge-row">
          {order.status === "boarding" && overdueDays > 0 && (
            <span className="badge danger">已超期 {overdueDays} 天</span>
          )}
          {order.status === "boarding" && overdueDays === 0 && actualDays === order.plannedDays && (
            <span className="badge warn">今日到期</span>
          )}
          {order.status === "boarding" && actualDays < order.plannedDays && (
            <span className="badge muted">剩余 {order.plannedDays - actualDays} 天</span>
          )}
          <span className={`badge ${STATUS_TONE[order.status]}`}>{STATUS_LABEL[order.status]}</span>
        </div>
      </div>

      <p className="order-meta">
        {order.species} × {order.fishCount} · {order.waterType} · 原缸水温 {order.sourceTemp}°C ·
        计划 {order.plannedDays} 天 · {order.checkIn} 登记
        {tank && ` · 寄养缸：${tank.name}（${tank.temperature}°C）`}
      </p>

      {order.status === "pending" && (
        <p className="order-meta">等待{order.waterType}寄养缸空位（需 {order.fishCount} 位），有缸释放时自动入缸。</p>
      )}

      {order.status === "boarding" && (
        <p className="order-meta">
          已寄养 {actualDays} 天
          {overdueDays > 0
            ? `，超期 ${overdueDays} 天，回取时追加 ¥${overdueDays * OVERDUE_RATE * order.fishCount}`
            : "，暂未超期"}
          {tempDiff >= 3 && ` · 与原缸温差 ${tempDiff}°C，注意过温过水`}
        </p>
      )}

      {order.status === "completed" && order.settlement && (
        <p className="order-meta">
          {order.closedAt} 回取 · 实养 {order.settlement.actualDays} 天 · 健康状态：{order.settlement.health} ·
          结算 ¥{order.settlement.total}
          {order.settlement.overdueDays > 0 && `（含超期追加 ¥${order.settlement.overdueFee}）`}
          {order.settlement.note && ` · 备注：${order.settlement.note}`}
        </p>
      )}

      {order.status === "cancelled" && (
        <p className="order-meta">{order.closedAt} 提前取消，寄养位已释放。</p>
      )}

      {(order.status === "pending" || order.status === "boarding") && (
        <div className="order-actions">
          {order.status === "pending" && (
            <button className="primary-action" onClick={() => onRetry(order)}>尝试入缸</button>
          )}
          {order.status === "boarding" && (
            <button className="primary-action" onClick={() => onPickup(order)}>回取结算</button>
          )}
          <button className="danger-action" onClick={() => onCancel(order)}>
            {order.status === "pending" ? "取消登记" : "提前取消"}
          </button>
        </div>
      )}
    </article>
  );
}

function SettlementModal({
  order,
  tankName,
  today,
  onClose,
  onConfirm,
}: {
  order: BoardingOrder;
  tankName: string;
  today: string;
  onClose: () => void;
  onConfirm: (health: string, note: string) => void;
}) {
  const [health, setHealth] = useState(HEALTH_OPTIONS[0]);
  const [note, setNote] = useState("");
  const s = computeSettlement(order, today);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>回取结算 · {order.id}</h2>
        <p className="order-meta">
          {order.customer} · {order.species}×{order.fishCount} · 寄养缸 {tankName} · {order.checkIn} 入缸
        </p>

        <div className="fee-lines">
          <div>
            <span>寄养天数（入缸当天计 1 天）</span>
            <strong>{s.actualDays} 天（计划 {s.plannedDays} 天）</strong>
          </div>
          <div>
            <span>寄养费 ¥{DAILY_RATE}/鱼/天 × {order.fishCount} 鱼 × {s.actualDays} 天</span>
            <strong>¥{s.baseFee}</strong>
          </div>
          <div>
            <span>超期追加 ¥{OVERDUE_RATE}/鱼/天 × {order.fishCount} 鱼 × {s.overdueDays} 天</span>
            <strong className={s.overdueDays > 0 ? "danger-text" : ""}>
              {s.overdueDays > 0 ? `¥${s.overdueFee}` : "无超期"}
            </strong>
          </div>
          <div className="total">
            <span>应收合计</span>
            <strong>¥{s.total}</strong>
          </div>
        </div>

        <label>
          <span>回取时健康状态</span>
          <select value={health} onChange={(e) => setHealth(e.target.value)}>
            {HEALTH_OPTIONS.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </label>
        <label>
          <span>备注（可选）</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="如：体表轻微擦伤，已告知顾客护理方法"
          />
        </label>

        <div className="form-actions">
          <button className="primary-action" onClick={() => onConfirm(health, note)}>
            确认结算并释放寄养位
          </button>
          <button onClick={onClose}>再想想</button>
        </div>
      </div>
    </div>
  );
}

/* ================= 主界面 ================= */

function App() {
  const todayStr = toISODate(new Date());
  const [orders, setOrders] = useState<BoardingOrder[]>(loadOrders);
  const [tab, setTab] = useState<OrderStatus>("boarding");
  const [pickupId, setPickupId] = useState<string | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [notice, setNotice] = useState<{ type: "ok" | "warn"; text: string } | null>(null);
  const [form, setForm] = useState({
    customer: "",
    phone: "",
    species: "",
    fishCount: "2",
    sourceTemp: "25",
    waterType: "淡水" as WaterType,
    plannedDays: "7",
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch {
      // 存储不可用时仅保留内存状态
    }
  }, [orders]);

  const occupied = useMemo(() => occupiedByTank(orders), [orders]);
  const tankById = useMemo(() => new Map(TANKS.map((t) => [t.id, t])), []);

  const stats = useMemo(() => {
    const boarding = orders.filter((o) => o.status === "boarding");
    const overdue = boarding.filter((o) => overdueDaysOf(o, todayStr) > 0);
    const freeSlots = TANKS.reduce((sum, t) => sum + (t.capacity - (occupied[t.id] ?? 0)), 0);
    return {
      boardingCount: boarding.length,
      fishInCare: boarding.reduce((s, o) => s + o.fishCount, 0),
      pendingCount: orders.filter((o) => o.status === "pending").length,
      overdueCount: overdue.length,
      freeSlots,
    };
  }, [orders, occupied, todayStr]);

  const counts = useMemo(() => {
    const c: Record<OrderStatus, number> = { pending: 0, boarding: 0, completed: 0, cancelled: 0 };
    orders.forEach((o) => c[o.status]++);
    return c;
  }, [orders]);

  const tabOrders = useMemo(
    () => orders.filter((o) => o.status === tab).sort((a, b) => b.createdAt - a.createdAt),
    [orders, tab]
  );

  const q = historyQuery.trim();
  const historyMatches = useMemo(() => {
    if (!q) return [];
    const digits = q.replace(/\s/g, "");
    return orders
      .filter((o) => o.customer.includes(q) || o.phone.replace(/\s/g, "").includes(digits))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [orders, q]);
  const historySpend = historyMatches.reduce((s, o) => s + (o.settlement?.total ?? 0), 0);

  const pickupOrder = orders.find((o) => o.id === pickupId) ?? null;

  /* ---------- 事件处理 ---------- */

  function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fishCount = Number(form.fishCount);
    const plannedDays = Number(form.plannedDays);
    const sourceTemp = Number(form.sourceTemp);

    if (!form.customer.trim() || !form.phone.trim() || !form.species.trim()) {
      setNotice({ type: "warn", text: "请填写顾客姓名、联系电话和品种。" });
      return;
    }
    if (!Number.isFinite(fishCount) || fishCount < 1) {
      setNotice({ type: "warn", text: "鱼只数量至少为 1。" });
      return;
    }
    if (!Number.isFinite(plannedDays) || plannedDays < 1) {
      setNotice({ type: "warn", text: "计划寄养天数至少为 1 天。" });
      return;
    }
    if (!Number.isFinite(sourceTemp) || sourceTemp < 0 || sourceTemp > 40) {
      setNotice({ type: "warn", text: "请填写合理的原缸水温（0–40°C）。" });
      return;
    }

    const order: BoardingOrder = {
      id: nextId(orders),
      customer: form.customer.trim(),
      phone: form.phone.trim(),
      species: form.species.trim(),
      fishCount,
      sourceTemp,
      plannedDays,
      waterType: form.waterType,
      checkIn: todayStr,
      createdAt: Date.now(),
      tankId: null,
      status: "pending",
    };

    const tank = pickTank(occupied, order.waterType, fishCount);
    const placed: BoardingOrder = tank ? { ...order, status: "boarding", tankId: tank.id } : order;
    setOrders((prev) => [...prev, placed]);
    setNotice(
      tank
        ? { type: "ok", text: `${order.customer} 的 ${order.species}×${fishCount} 已登记并入缸 ${tank.name}。` }
        : { type: "warn", text: `暂无能容纳 ${fishCount} 条鱼的${order.waterType}寄养缸，${order.customer} 的寄养单已留在待安排。` }
    );
    setForm({ customer: "", phone: "", species: "", fishCount: "2", sourceTemp: "25", waterType: form.waterType, plannedDays: "7" });
    setTab(tank ? "boarding" : "pending");
  }

  function handleCancel(o: BoardingOrder) {
    const wasBoarding = o.status === "boarding";
    const updated = orders.map((x) =>
      x.id === o.id ? { ...x, status: "cancelled" as const, closedAt: todayStr } : x
    );
    const { next, assigned } = autoAssign(updated);
    setOrders(next);
    setNotice({
      type: "ok",
      text: [
        `${o.customer} 的寄养单已取消${wasBoarding ? "，寄养位已立即释放" : ""}。`,
        ...assigned.map((a) => `${a.customer} 的寄养单已自动入缸 ${tankNameOf(a)}。`),
      ].join(" "),
    });
  }

  function handleSettle(health: string, note: string) {
    if (!pickupOrder) return;
    const settlement: Settlement = { ...computeSettlement(pickupOrder, todayStr), health, note: note.trim() };
    const updated = orders.map((x) =>
      x.id === pickupOrder.id ? { ...x, status: "completed" as const, closedAt: todayStr, settlement } : x
    );
    const { next, assigned } = autoAssign(updated);
    setOrders(next);
    setPickupId(null);
    setNotice({
      type: "ok",
      text: [
        `${pickupOrder.customer} 已回取结算，合计 ¥${settlement.total}，寄养位已释放。`,
        ...assigned.map((a) => `${a.customer} 的寄养单已自动入缸 ${tankNameOf(a)}。`),
      ].join(" "),
    });
  }

  function handleRetry(o: BoardingOrder) {
    const tank = pickTank(occupiedByTank(orders), o.waterType, o.fishCount);
    if (!tank) {
      setNotice({ type: "warn", text: `仍没有能容纳 ${o.fishCount} 条鱼的${o.waterType}寄养缸，继续等待空位。` });
      return;
    }
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: "boarding", tankId: tank.id } : x)));
    setNotice({ type: "ok", text: `${o.customer} 的 ${o.species}×${o.fishCount} 已入缸 ${tank.name}。` });
    setTab("boarding");
  }

  function tankNameOf(o: BoardingOrder): string {
    return (o.tankId && tankById.get(o.tankId)?.name) || "寄养缸";
  }

  /* ---------- 渲染 ---------- */

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-05 · port 5105</p>
          <h1>观赏鱼寄养登记台</h1>
          <p className="subtitle">
            假期寄养高峰，登记顾客、鱼只数量、品种与原缸水温，按水质类型与剩余空间分配寄养缸；
            回取时登记健康状态并完成结算，超期自动追加费用，寄养经历随时按顾客查回。
          </p>
        </div>
        <div className="stack-card">
          <span>今日 · {todayStr}</span>
          <strong>
            寄养费 ¥{DAILY_RATE}/鱼/天
            <br />
            超期追加 ¥{OVERDUE_RATE}/鱼/天
          </strong>
          <span>入缸占位置 · 取消或回取立即释放</span>
        </div>
      </section>

      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

      <section className="metrics-grid">
        <MetricCard label="寄养中" value={`${stats.boardingCount} 单`} sub={`在养 ${stats.fishInCare} 条鱼`} tone="status-ok" />
        <MetricCard label="待安排" value={`${stats.pendingCount} 单`} sub="等待合适寄养缸" tone="status-watch" />
        <MetricCard label="已超期" value={`${stats.overdueCount} 单`} sub="回取时追加超期费" tone="status-danger" />
        <MetricCard label="剩余空位" value={`${stats.freeSlots} 位`} sub={`共 ${TANKS.reduce((s, t) => s + t.capacity, 0)} 个寄养位`} tone="status-ok" />
      </section>

      <section className="boarding-layout">
        <aside className="panel">
          <div className="section-heading">
            <div>
              <p>寄养登记</p>
              <h2>新寄养单</h2>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleRegister}>
            <label>
              <span>顾客姓名</span>
              <input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="如：王建国" />
            </label>
            <label>
              <span>联系电话</span>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="用于回取核对与档案查询" />
            </label>
            <label>
              <span>品种</span>
              <input value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })} placeholder="如：孔雀鱼" />
            </label>
            <div className="field-grid">
              <label>
                <span>鱼只数量</span>
                <input type="number" min="1" value={form.fishCount} onChange={(e) => setForm({ ...form, fishCount: e.target.value })} />
              </label>
              <label>
                <span>原缸水温 °C</span>
                <input type="number" step="0.5" value={form.sourceTemp} onChange={(e) => setForm({ ...form, sourceTemp: e.target.value })} />
              </label>
            </div>
            <div className="field-grid">
              <label>
                <span>水质类型</span>
                <select value={form.waterType} onChange={(e) => setForm({ ...form, waterType: e.target.value as WaterType })}>
                  {WATER_TYPES.map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>计划寄养天数</span>
                <input type="number" min="1" value={form.plannedDays} onChange={(e) => setForm({ ...form, plannedDays: e.target.value })} />
              </label>
            </div>
            <button className="primary-action" type="submit">登记并分配寄养缸</button>
            <p className="form-hint">
              按水质类型与剩余空间自动匹配寄养缸；没有合适位置时留在待安排，空位释放后自动入缸。
              寄养费 ¥{DAILY_RATE}/鱼/天，超期每天追加 ¥{OVERDUE_RATE}/鱼。
            </p>
          </form>
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>寄养缸余位</p>
              <h2>寄养缸使用状态</h2>
            </div>
          </div>
          <div className="tank-grid">
            {TANKS.map((t) => (
              <TankCard
                key={t.id}
                tank={t}
                used={occupied[t.id] ?? 0}
                guests={orders.filter((o) => o.status === "boarding" && o.tankId === t.id)}
              />
            ))}
          </div>
        </section>
      </section>

      <section className="panel records">
        <div className="section-heading">
          <div>
            <p>寄养台账</p>
            <h2>寄养单</h2>
          </div>
        </div>
        <div className="tabs">
          {(["boarding", "pending", "completed", "cancelled"] as OrderStatus[]).map((s) => (
            <button key={s} className={tab === s ? "active" : ""} onClick={() => setTab(s)}>
              {STATUS_LABEL[s]}（{counts[s]}）
            </button>
          ))}
        </div>
        <div className="record-list">
          {tabOrders.length === 0 && <p className="empty">暂无{STATUS_LABEL[tab]}的寄养单</p>}
          {tabOrders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              tank={o.tankId ? tankById.get(o.tankId) ?? null : null}
              today={todayStr}
              onPickup={(order) => setPickupId(order.id)}
              onCancel={handleCancel}
              onRetry={handleRetry}
            />
          ))}
        </div>
      </section>

      <section className="panel records">
        <div className="section-heading">
          <div>
            <p>寄养档案</p>
            <h2>按顾客查询寄养经历</h2>
          </div>
        </div>
        <label>
          <span>顾客姓名或电话</span>
          <input value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} placeholder="输入姓名或电话，如：赵敏 / 134" />
        </label>
        {q && historyMatches.length === 0 && <p className="empty">没有找到「{q}」的寄养记录</p>}
        {q && historyMatches.length > 0 && (
          <>
            <div className="chips history-summary">
              <span>{historyMatches.length} 次寄养</span>
              <span>累计结算 ¥{historySpend}</span>
            </div>
            <div className="record-list">
              {historyMatches.map((o) => (
                <article key={o.id} className="record-card">
                  <div className="record-index">{o.id.replace("B-", "")}</div>
                  <div>
                    <h3>
                      {o.customer} · {o.species}×{o.fishCount}{" "}
                      <span className={`badge ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                    </h3>
                    <p>
                      {o.checkIn} 登记 · 计划 {o.plannedDays} 天
                      {o.status === "completed" && o.settlement &&
                        ` · ${o.closedAt} 回取 · 实养 ${o.settlement.actualDays} 天 · 健康状态：${o.settlement.health} · 结算 ¥${o.settlement.total}`}
                      {o.status === "cancelled" && ` · ${o.closedAt} 提前取消`}
                      {o.status === "boarding" && ` · 寄养中（${tankNameOf(o)}）`}
                      {o.status === "pending" && " · 等待安排寄养缸"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {pickupOrder && (
        <SettlementModal
          order={pickupOrder}
          tankName={tankNameOf(pickupOrder)}
          today={todayStr}
          onClose={() => setPickupId(null)}
          onConfirm={handleSettle}
        />
      )}
    </main>
  );
}

export default App;
