import { useMemo, useState, type FormEvent } from "react";
import {
  WATER_TYPES,
  selectTank,
  tankFree,
  todayStr,
  addDays,
  formatYuan,
} from "../foster/domain";
import type { Admission, RegisterInput, Tank, WaterTypeId } from "../foster/types";

interface RegisterFormProps {
  tanks: Tank[];
  admissions: Admission[];
  onSubmit: (input: RegisterInput) => void;
}

interface FormState {
  customer: string;
  phone: string;
  species: string;
  count: string;
  waterType: WaterTypeId;
  originTemp: string;
  expectedEnd: string;
}

function initialForm(): FormState {
  return {
    customer: "",
    phone: "",
    species: "",
    count: "",
    waterType: "fresh",
    originTemp: "",
    expectedEnd: addDays(todayStr(), 3),
  };
}

export function RegisterForm({ tanks, admissions, onSubmit }: RegisterFormProps) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState("");

  const count = Number(form.count);
  const validCount = Number.isInteger(count) && count >= 1;

  const recommendation = useMemo(() => {
    if (!validCount) return undefined;
    return selectTank(form.waterType, count, tanks, admissions);
  }, [validCount, count, form.waterType, tanks, admissions]);

  const sameTypeTanks = tanks
    .filter((t) => t.waterType === form.waterType)
    .map((t) => ({ name: t.name, free: tankFree(t, admissions) }));

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.customer.trim()) return setError("请填写顾客姓名");
    if (!form.species.trim()) return setError("请填写鱼只品种");
    if (!validCount) return setError("鱼只数量需为大于 0 的整数");
    const temp = Number(form.originTemp);
    if (!form.originTemp.trim() || Number.isNaN(temp) || temp < 0 || temp > 40) {
      return setError("请填写有效的原缸水温（0–40℃）");
    }
    if (!form.expectedEnd || form.expectedEnd < todayStr()) {
      return setError("约定回取日不能早于今天");
    }
    onSubmit({
      customer: form.customer.trim(),
      phone: form.phone.trim(),
      species: form.species.trim(),
      count,
      waterType: form.waterType,
      originTemp: temp,
      expectedEnd: form.expectedEnd,
    });
    setForm(initialForm());
    setError("");
  };

  return (
    <form className="panel register-panel" onSubmit={handleSubmit}>
      <div className="section-heading">
        <div>
          <p>寄养登记</p>
          <h2>新到鱼袋登记</h2>
        </div>
      </div>

      <div className="field-grid register-grid">
        <label>
          <span>顾客姓名 *</span>
          <input
            value={form.customer}
            onChange={(e) => update("customer", e.target.value)}
            placeholder="如：李女士"
          />
        </label>
        <label>
          <span>联系电话</span>
          <input
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="便于回取时联系"
          />
        </label>
        <label>
          <span>鱼只品种 *</span>
          <input
            value={form.species}
            onChange={(e) => update("species", e.target.value)}
            placeholder="如：金龙鱼"
          />
        </label>
        <label>
          <span>鱼只数量（尾） *</span>
          <input
            type="number"
            min={1}
            step={1}
            value={form.count}
            onChange={(e) => update("count", e.target.value)}
            placeholder="如：3"
          />
        </label>
        <label>
          <span>水质类型 *</span>
          <select
            value={form.waterType}
            onChange={(e) => update("waterType", e.target.value)}
          >
            {WATER_TYPES.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}（{w.hint}）
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>原缸水温（℃） *</span>
          <input
            type="number"
            min={0}
            max={40}
            step={0.1}
            value={form.originTemp}
            onChange={(e) => update("originTemp", e.target.value)}
            placeholder="顾客原缸温度"
          />
        </label>
        <label>
          <span>约定回取日 *</span>
          <input
            type="date"
            min={todayStr()}
            value={form.expectedEnd}
            onChange={(e) => update("expectedEnd", e.target.value)}
          />
        </label>
      </div>

      <div
        className={
          "match-hint " +
          (!validCount ? "muted" : recommendation ? "ok" : "warn")
        }
      >
        {!validCount ? (
          <span>填写数量后将自动按水质与空位匹配寄养缸</span>
        ) : recommendation ? (
          <span>
            ✓ 将自动入缸：<strong>{recommendation.name}</strong>，剩余{" "}
            {tankFree(recommendation, admissions) - count} 位空位，每尾每日{" "}
            {formatYuan(recommendation.dailyRate)}
          </span>
        ) : (
          <span>
            ⚠ 同水质缸均无 {count} 个连续空位，本单将先留在<strong>待安排</strong>
            ，缸位释放后可一键重新匹配
          </span>
        )}
        <small>
          {sameTypeTanks.map((t) => `${t.name}剩${t.free}位`).join("　")}
        </small>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="submit" className="primary-action">
          登记并匹配缸位
        </button>
      </div>
    </form>
  );
}
