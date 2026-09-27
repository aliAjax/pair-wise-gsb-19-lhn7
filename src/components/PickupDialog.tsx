import { useMemo, useState } from "react";
import {
  OVERDUE_DAILY_RATE,
  WATER_TYPE_LABEL,
  feePreview,
  formatYuan,
  todayStr,
} from "../foster/domain";
import { HEALTH_META } from "../foster/labels";
import type { Admission, HealthStatus, Tank } from "../foster/types";

interface PickupDialogProps {
  admission: Admission;
  tank: Tank;
  onCancel: () => void;
  onConfirm: (id: string, health: HealthStatus, note: string, endDate: string) => void;
}

export function PickupDialog({
  admission,
  tank,
  onCancel,
  onConfirm,
}: PickupDialogProps) {
  const today = todayStr();
  const [endDate, setEndDate] = useState(today);
  const [health, setHealth] = useState<HealthStatus>("good");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const fee = useMemo(
    () => feePreview(admission, tank, endDate),
    [admission, tank, endDate],
  );

  const handleConfirm = () => {
    if (admission.placedAt && endDate < admission.placedAt) {
      setError("回取日期不能早于入缸日期");
      return;
    }
    onConfirm(admission.id, health, note.trim(), endDate);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal panel"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="section-heading">
          <div>
            <p>到店回取 · 结算</p>
            <h2>
              {admission.customer} · {admission.species} × {admission.count}
            </h2>
          </div>
          <span className="badge badge-housed">{tank.name}</span>
        </div>

        <div className="dialog-meta">
          <span>水质：{WATER_TYPE_LABEL[admission.waterType]}</span>
          <span>入缸日：{admission.placedAt}</span>
          <span>约定回取：{admission.expectedEnd}</span>
        </div>

        <div className="dialog-grid">
          <label>
            <span>实际回取日期</span>
            <input
              type="date"
              min={admission.placedAt ?? today}
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setError("");
              }}
            />
          </label>
          <label>
            <span>回取健康状态</span>
            <select value={health} onChange={(e) => setHealth(e.target.value as HealthStatus)}>
              {(Object.keys(HEALTH_META) as HealthStatus[]).map((key) => (
                <option key={key} value={key}>
                  {HEALTH_META[key].label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className={"health-hint tone-" + HEALTH_META[health].tone}>
          {HEALTH_META[health].desc}
        </p>
        <label className="note-label">
          <span>健康备注（可留空，将记入寄养经历）</span>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="如：离缸前已停食半天，鱼只活力良好"
          />
        </label>

        <div className={"settle-box " + (fee.overdueDays > 0 ? "overdue" : "")}>
          <div className="settle-row">
            <span>
              在缸 {fee.days} 天 × {admission.count} 尾 × {fee.rate} 元/尾·日
            </span>
            <span>{formatYuan(fee.baseFee)}</span>
          </div>
          <div className="settle-row">
            <span>
              超期 {fee.overdueDays} 天 × {admission.count} 尾 × {OVERDUE_DAILY_RATE}
              元/尾·日
            </span>
            <span>{formatYuan(fee.overdueFee)}</span>
          </div>
          <div className="settle-row total">
            <span>应收合计</span>
            <strong>{formatYuan(fee.total)}</strong>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions right">
          <button onClick={onCancel}>再等等</button>
          <button className="primary-action" onClick={handleConfirm}>
            登记健康并完成结算
          </button>
        </div>
      </div>
    </div>
  );
}
