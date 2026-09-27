import {
  OVERDUE_DAILY_RATE,
  WATER_TYPE_LABEL,
  dayDiff,
  feePreview,
  formatYuan,
  todayStr,
} from "../foster/domain";
import { STATUS_META } from "../foster/labels";
import type { Admission, Tank } from "../foster/types";

interface AdmissionCardProps {
  admission: Admission;
  tank?: Tank;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onPickup: (id: string) => void;
}

export function AdmissionCard({
  admission,
  tank,
  onRetry,
  onCancel,
  onPickup,
}: AdmissionCardProps) {
  const today = todayStr();
  const status = STATUS_META[admission.status];
  const overdue =
    admission.status === "housed" && dayDiff(admission.expectedEnd, today) > 0
      ? dayDiff(admission.expectedEnd, today)
      : 0;
  const preview =
    admission.status === "housed" && tank
      ? feePreview(admission, tank, today)
      : undefined;

  const tempGap = tank ? admission.originTemp - tank.temp : 0;
  const tempWarn = Math.abs(tempGap) >= 2;

  return (
    <article className="admission-card">
      <div className="admission-head">
        <div>
          <span className="admission-id">{admission.id}</span>
          <h3>
            {admission.customer} · {admission.species} × {admission.count}
          </h3>
        </div>
        <span className={"badge " + status.cls}>{status.label}</span>
      </div>

      <div className="admission-meta">
        <span>水质：{WATER_TYPE_LABEL[admission.waterType]}</span>
        <span>原缸水温：{admission.originTemp.toFixed(1)}℃</span>
        <span>登记日：{admission.registeredAt}</span>
        <span>约定回取：{admission.expectedEnd}</span>
        {admission.phone && <span>电话：{admission.phone}</span>}
      </div>

      {admission.status === "housed" && tank && (
        <>
          <div className="admission-meta housed">
            <span>
              寄养缸：<strong>{tank.name}</strong>
            </span>
            <span>入缸日：{admission.placedAt}</span>
            <span>缸温 {tank.temp.toFixed(1)}℃</span>
            <span className={tempWarn ? "warn-text" : "ok-text"}>
              {tempWarn
                ? `温差 ${tempGap > 0 ? "+" : ""}${tempGap.toFixed(1)}℃，需注意过温`
                : "水温接近，过温安全"}
            </span>
          </div>
          <div className={"fee-strip " + (overdue > 0 ? "overdue" : "")}>
            {overdue > 0 ? (
              <span>
                已超期 <strong>{overdue}</strong> 天，每天追加{" "}
                {formatYuan(admission.count * OVERDUE_DAILY_RATE)}（{OVERDUE_DAILY_RATE}
                元/尾·日）
              </span>
            ) : (
              <span>未到回取日，无超期追加</span>
            )}
            {preview && (
              <span>
                截至今天预估：基础 {formatYuan(preview.baseFee)}
                {preview.overdueFee > 0 && (
                  <> + 超期 {formatYuan(preview.overdueFee)}</>
                )}{" "}
                = <strong>{formatYuan(preview.total)}</strong>
              </span>
            )}
          </div>
        </>
      )}

      {admission.status === "pending" && (
        <div className="fee-strip pending">
          <span>鱼袋暂存待安排区，尚未入缸、不计寄养费、不占缸位</span>
        </div>
      )}

      <div className="admission-actions">
        {admission.status === "pending" && (
          <button className="primary-action" onClick={() => onRetry(admission.id)}>
            重新匹配缸位
          </button>
        )}
        {admission.status === "housed" && (
          <button className="primary-action" onClick={() => onPickup(admission.id)}>
            到店回取结算
          </button>
        )}
        {(admission.status === "pending" || admission.status === "housed") && (
          <button onClick={() => onCancel(admission.id)}>
            {admission.status === "housed" ? "提前取消（结算并释放）" : "取消登记"}
          </button>
        )}
      </div>
    </article>
  );
}
