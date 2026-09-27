import { useMemo, useState } from "react";
import {
  WATER_TYPE_LABEL,
  formatDateTime,
  formatYuan,
} from "../foster/domain";
import { HEALTH_META, STATUS_META } from "../foster/labels";
import { tankNameById } from "./TankBoard";
import type { Admission, Tank } from "../foster/types";

interface HistoryPanelProps {
  admissions: Admission[];
  tanks: Tank[];
}

export function HistoryPanel({ admissions, tanks }: HistoryPanelProps) {
  const [keyword, setKeyword] = useState("");

  const history = useMemo(() => {
    const kw = keyword.trim();
    return admissions
      .filter((a) => a.status === "completed" || a.status === "cancelled")
      .filter(
        (a) =>
          !kw ||
          a.customer.includes(kw) ||
          a.phone.includes(kw) ||
          a.species.includes(kw),
      )
      .sort((a, b) => (a.endedAt && b.endedAt ? b.endedAt.localeCompare(a.endedAt) : 0));
  }, [admissions, keyword]);

  return (
    <section className="panel records">
      <div className="section-heading">
        <div>
          <p>寄养经历</p>
          <h2>按顾客查询历史</h2>
        </div>
      </div>

      <div className="history-toolbar">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="输入顾客姓名、电话或品种，查找这段寄养经历"
        />
        <span className="result-count">共 {history.length} 条</span>
      </div>

      {history.length === 0 ? (
        <div className="empty-state">
          {keyword ? "没有匹配的寄养经历，换个关键词试试" : "还没有回取或取消的寄养单"}
        </div>
      ) : (
        <div className="record-list history-list">
          {history.map((a) => {
            const meta = STATUS_META[a.status];
            return (
              <article key={a.id} className="record-card history-card">
                <div className={"record-index " + a.status}>
                  {a.status === "completed" ? "取" : "消"}
                </div>
                <div className="history-body">
                  <div className="history-head">
                    <h3>
                      {a.customer} · {a.species} × {a.count}
                    </h3>
                    <span className={"badge " + meta.cls}>{meta.label}</span>
                  </div>
                  <p>
                    {a.id} · {WATER_TYPE_LABEL[a.waterType]} · 原缸水温{" "}
                    {a.originTemp.toFixed(1)}℃
                    {a.phone ? ` · ${a.phone}` : ""}
                  </p>
                  <p>
                    登记 {a.registeredAt} · 约定回取 {a.expectedEnd}
                    {a.placedAt ? ` · 实际入缸 ${a.placedAt}` : ""} · 办结{" "}
                    {a.endedAt}
                  </p>
                  {a.tankId && <p>寄养缸：{tankNameById(tanks, a.tankId)}</p>}

                  {a.status === "completed" && a.health && (
                    <p>
                      回取健康：
                      <span className={"health-pill tone-" + HEALTH_META[a.health].tone}>
                        {HEALTH_META[a.health].label}
                      </span>
                      {a.healthNote ? `（${a.healthNote}）` : ""}
                    </p>
                  )}

                  {a.fee && (
                    <div className={"settle-box inline " + (a.fee.overdueDays > 0 ? "overdue" : "")}>
                      <div className="settle-row">
                        <span>
                          在缸 {a.fee.days} 天{a.fee.overdueDays > 0 ? `（超期 ${a.fee.overdueDays} 天）` : ""}
                        </span>
                        <span>
                          {formatYuan(a.fee.baseFee)}
                          {a.fee.overdueFee > 0 && (
                            <> + {formatYuan(a.fee.overdueFee)}</>
                          )}
                        </span>
                      </div>
                      <div className="settle-row total">
                        <span>结算合计</span>
                        <strong>{formatYuan(a.fee.total)}</strong>
                      </div>
                    </div>
                  )}

                  <ul className="event-list">
                    {[...a.events].reverse().map((ev, i) => (
                      <li key={i}>
                        <span className="event-time">{formatDateTime(ev.at)}</span>
                        <span>{ev.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
