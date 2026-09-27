import { occupancyByTank, tankFree, WATER_TYPE_LABEL } from "../foster/domain";
import type { Admission, Tank } from "../foster/types";

interface TankBoardProps {
  tanks: Tank[];
  admissions: Admission[];
}

export function TankBoard({ tanks, admissions }: TankBoardProps) {
  const used = occupancyByTank(admissions);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>寄养缸一览</p>
          <h2>缸位占用</h2>
        </div>
      </div>
      <div className="tank-grid">
        {tanks.map((tank) => {
          const taken = used[tank.id] ?? 0;
          const free = tank.capacity - taken;
          const pct = Math.round((taken / tank.capacity) * 100);
          const full = free === 0;
          return (
            <article key={tank.id} className={"tank-card " + (full ? "is-full" : "")}>
              <div className="tank-head">
                <strong>{tank.name}</strong>
                <span className="water-tag">{WATER_TYPE_LABEL[tank.waterType]}</span>
              </div>
              <div className="tank-bar" title={`已占 ${taken} / ${tank.capacity}`}>
                <i style={{ width: `${pct}%` }} />
              </div>
              <div className="tank-meta">
                <span className={full ? "danger-text" : "ok-text"}>
                  {full ? "已满" : `剩 ${free} 位`}
                </span>
                <span>
                  已占 {taken}/{tank.capacity}
                </span>
              </div>
              <div className="tank-meta sub">
                <span>水温 {tank.temp.toFixed(1)}℃</span>
                <span>{tank.dailyRate} 元/尾·日</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** 给寄养单卡片展示的缸信息小工具 */
export function tankNameById(tanks: Tank[], id?: string): string {
  if (!id) return "";
  return tanks.find((t) => t.id === id)?.name ?? id;
}

export function tankFreeById(tanks: Tank[], admissions: Admission[], id: string): number {
  const tank = tanks.find((t) => t.id === id);
  return tank ? tankFree(tank, admissions) : 0;
}
