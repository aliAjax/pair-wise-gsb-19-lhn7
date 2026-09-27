import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import { RegisterForm } from "./components/RegisterForm";
import { TankBoard } from "./components/TankBoard";
import { AdmissionCard } from "./components/AdmissionCard";
import { PickupDialog } from "./components/PickupDialog";
import { HistoryPanel } from "./components/HistoryPanel";
import { SEED_ADMISSIONS, SEED_TANKS } from "./foster/seed";
import {
  OVERDUE_DAILY_RATE,
  calcFee,
  dayDiff,
  formatDateTime,
  formatYuan,
  occupancyByTank,
  selectTank,
  todayStr,
} from "./foster/domain";
import type {
  Admission,
  HealthStatus,
  RegisterInput,
} from "./foster/types";

const STORAGE_KEY = "hxwl-05-foster-admissions-v1";

function loadAdmissions(): Admission[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Admission[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // 本地数据损坏时回退到示例数据
  }
  return SEED_ADMISSIONS;
}

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${todayStr()}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function nextId(admissions: Admission[]): string {
  const max = admissions.reduce((acc, a) => {
    const n = Number(a.id.replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 1000);
  return `F-${max + 1}`;
}

interface Toast {
  text: string;
  kind: "ok" | "warn";
}

function App() {
  const [admissions, setAdmissions] = useState<Admission[]>(loadAdmissions);
  const [toast, setToast] = useState<Toast | null>(null);
  const [pickupId, setPickupId] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(admissions));
  }, [admissions]);

  const showToast = (text: string, kind: Toast["kind"] = "ok") => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, kind });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };

  const tanks = SEED_TANKS;
  const used = occupancyByTank(admissions);

  const stats = useMemo(() => {
    const pending = admissions.filter((a) => a.status === "pending").length;
    const housed = admissions.filter((a) => a.status === "housed");
    const occupiedSlots = housed.reduce((sum, a) => sum + a.count, 0);
    const totalSlots = tanks.reduce((sum, t) => sum + t.capacity, 0);
    const today = todayStr();
    const overdueHoused = housed.filter(
      (a) => dayDiff(a.expectedEnd, today) > 0,
    ).length;
    return {
      pending,
      housedCount: housed.length,
      occupied: `${occupiedSlots}/${totalSlots}`,
      overdue: overdueHoused,
    };
  }, [admissions, tanks]);

  const active = useMemo(
    () =>
      admissions
        .filter((a) => a.status === "pending" || a.status === "housed")
        .sort((a, b) =>
          a.status === b.status
            ? b.registeredAt.localeCompare(a.registeredAt)
            : a.status === "pending"
              ? -1
              : 1,
        ),
    [admissions],
  );

  const pickupAdmission = pickupId
    ? admissions.find((a) => a.id === pickupId)
    : undefined;
  const pickupTank = pickupAdmission?.tankId
    ? tanks.find((t) => t.id === pickupAdmission.tankId)
    : undefined;

  /** 登记：能匹配到缸立即入缸占位置，否则留在待安排 */
  const handleRegister = (input: RegisterInput) => {
    const today = todayStr();
    const id = nextId(admissions);
    const tank = selectTank(input.waterType, input.count, tanks, admissions);
    const base: Admission = {
      id,
      ...input,
      registeredAt: today,
      status: tank ? "housed" : "pending",
      tankId: tank?.id,
      placedAt: tank ? today : undefined,
      events: [],
    };
    if (tank) {
      base.events = [
        {
          at: nowStamp(),
          text: `登记寄养，按水质与空位分配到 ${tank.name}，入缸占用 ${input.count} 个位置`,
        },
      ];
      showToast(`已登记 ${id}，鱼只入缸 ${tank.name}，位置已占用`);
    } else {
      base.events = [
        { at: nowStamp(), text: "登记寄养：暂无合适寄养缸，留在待安排，未计费不占缸位" },
      ];
      showToast(`已登记 ${id}，暂无合适缸位，已列入待安排`, "warn");
    }
    setAdmissions((prev) => [base, ...prev]);
  };

  /** 待安排单重新匹配缸位 */
  const handleRetry = (id: string) => {
    const target = admissions.find((a) => a.id === id);
    if (!target) return;
    const tank = selectTank(target.waterType, target.count, tanks, admissions);
    if (!tank) {
      showToast("仍然没有同水质且空位足够的寄养缸，继续待安排", "warn");
      return;
    }
    const today = todayStr();
    setAdmissions((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: "housed",
              tankId: tank.id,
              placedAt: today,
              events: [
                ...a.events,
                {
                  at: nowStamp(),
                  text: `缸位释放后重新匹配，入缸 ${tank.name}，占用 ${a.count} 个位置，今日起计费`,
                },
              ],
            }
          : a,
      ),
    );
    showToast(`已入缸 ${tank.name}，开始计费，缸位已占用`);
  };

  /** 提前取消：在缸的先结算在缸费用，随后立即释放位置 */
  const handleCancel = (id: string) => {
    const target = admissions.find((a) => a.id === id);
    if (!target) return;

    if (target.status === "pending") {
      if (!window.confirm("确认取消该待安排登记？取消后可在寄养经历中查看。")) return;
      setAdmissions((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status: "cancelled",
                endedAt: todayStr(),
                events: [
                  ...a.events,
                  { at: nowStamp(), text: "顾客取消登记（尚未入缸，无寄养费用）" },
                ],
              }
            : a,
        ),
      );
      showToast("登记已取消");
      return;
    }

    const tank = tanks.find((t) => t.id === target.tankId);
    if (!tank) return;
    const today = todayStr();
    const fee = calcFee(
      target.count,
      target.placedAt ?? today,
      target.expectedEnd,
      today,
      tank.dailyRate,
    );
    const msg =
      `提前取消将立即释放 ${tank.name} 的 ${target.count} 个位置。\n` +
      `在缸 ${fee.days} 天，结算在缸费用 ${formatYuan(fee.total)}` +
      (fee.overdueFee > 0 ? `（含超期追加 ${formatYuan(fee.overdueFee)}）` : "") +
      "。\n确认继续？";
    if (!window.confirm(msg)) return;

    setAdmissions((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: "cancelled",
              endedAt: today,
              fee,
              events: [
                ...a.events,
                {
                  at: nowStamp(),
                  text: `顾客提前取消，结算在缸费用 ${formatYuan(fee.total)}，${tank.name} 的位置已释放`,
                },
              ],
            }
          : a,
      ),
    );
    showToast(`已提前取消并结算 ${formatYuan(fee.total)}，缸位立即释放`);
  };

  /** 到店回取：登记健康状态并完成结算，立即释放位置 */
  const handlePickupConfirm = (
    id: string,
    health: HealthStatus,
    note: string,
    endDate: string,
  ) => {
    const target = admissions.find((a) => a.id === id);
    if (!target || !target.tankId) return;
    const tank = tanks.find((t) => t.id === target.tankId);
    if (!tank) return;

    const fee = calcFee(
      target.count,
      target.placedAt ?? endDate,
      target.expectedEnd,
      endDate,
      tank.dailyRate,
    );

    setAdmissions((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: "completed",
              endedAt: endDate,
              health,
              healthNote: note,
              fee,
              events: [
                ...a.events,
                {
                  at: nowStamp(),
                  text:
                    `到店回取，健康状态登记为「${
                      health === "good" ? "状态良好" : health === "fair" ? "一般需观察" : "状态不佳"
                    }」，结算 ${formatYuan(fee.total)}` +
                    (fee.overdueFee > 0 ? `（含超期追加 ${formatYuan(fee.overdueFee)}）` : "") +
                    `，${tank.name} 的位置已释放`,
                },
              ],
            }
          : a,
      ),
    );
    setPickupId(null);
    showToast(`回取结算完成：${formatYuan(fee.total)}，缸位已释放`);
  };

  const handleReset = () => {
    if (!window.confirm("确认清空当前寄养数据并恢复为示例数据？")) return;
    setAdmissions(SEED_ADMISSIONS);
    showToast("已恢复示例数据");
  };

  const statCards = [
    { label: "待安排鱼袋", value: String(stats.pending), index: 1 },
    { label: "在缸寄养单", value: String(stats.housedCount), index: 0 },
    { label: "已占缸位", value: stats.occupied, index: 0 },
    { label: "已超期寄养单", value: String(stats.overdue), index: stats.overdue > 0 ? 2 : 1 },
  ];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-05 · 假期寄养 · 开发端口 5105</p>
          <h1>观赏鱼寄养登记台</h1>
          <p className="subtitle">
            顾客送来的鱼袋先登记品种、数量与原缸水温，系统按水质类型和剩余空位自动分配寄养缸；
            放不下就留在待安排，回取或取消立即释放缸位，超期费用每日自动追加，结算记录可按顾客随时找回。
          </p>
        </div>
        <div className="stack-card">
          <span>寄养规则</span>
          <strong>
            超期追加 {OVERDUE_DAILY_RATE} 元/尾·日 · 入缸起计费
          </strong>
          <span className="stack-hint">数据保存在本机浏览器（localStorage）</span>
        </div>
      </section>

      <section className="metrics-grid">
        {statCards.map((card) => (
          <article className="metric-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <i className={["status-ok", "status-watch", "status-danger"][card.index]} />
          </article>
        ))}
      </section>

      <section className="workspace foster-workspace">
        <RegisterForm tanks={tanks} admissions={admissions} onSubmit={handleRegister} />
        <TankBoard tanks={tanks} admissions={admissions} />
      </section>

      <section className="panel records">
        <div className="section-heading">
          <div>
            <p>进行中</p>
            <h2>待安排与在缸寄养单（{active.length}）</h2>
          </div>
        </div>
        {active.length === 0 ? (
          <div className="empty-state">
            当前没有待安排或在缸的鱼袋，假期高峰可从上方开始登记
          </div>
        ) : (
          <div className="admission-list">
            {active.map((a) => (
              <AdmissionCard
                key={a.id}
                admission={a}
                tank={tanks.find((t) => t.id === a.tankId)}
                onRetry={handleRetry}
                onCancel={handleCancel}
                onPickup={setPickupId}
              />
            ))}
          </div>
        )}
      </section>

      <HistoryPanel admissions={admissions} tanks={tanks} />

      <section className="panel reset-row">
        <button onClick={handleReset}>恢复示例数据</button>
        <span>缸位空闲概览：{tanks.map((t) => `${t.name} 剩${t.capacity - (used[t.id] ?? 0)}位`).join("　·　")}</span>
      </section>

      {pickupAdmission && pickupTank && (
        <PickupDialog
          admission={pickupAdmission}
          tank={pickupTank}
          onCancel={() => setPickupId(null)}
          onConfirm={handlePickupConfirm}
        />
      )}

      {toast && (
        <div className={"toast " + toast.kind}>
          <span className="toast-time">{formatDateTime(nowStamp())}</span>
          {toast.text}
        </div>
      )}
    </main>
  );
}

export default App;
