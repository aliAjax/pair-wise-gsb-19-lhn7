import {
  addDays,
  calcFee,
  todayStr,
} from "./domain";
import type { Admission, Tank } from "./types";

/** 寄养缸资源：水质类型、总位置、当前水温、每尾日价 */
export const SEED_TANKS: Tank[] = [
  { id: "FW-A", name: "淡水寄养缸 A", waterType: "fresh", capacity: 20, temp: 25.5, dailyRate: 2 },
  { id: "FW-B", name: "淡水寄养缸 B", waterType: "fresh", capacity: 12, temp: 26.0, dailyRate: 2 },
  { id: "SW-A", name: "海水寄养缸 A", waterType: "salt", capacity: 10, temp: 25.5, dailyRate: 6 },
  { id: "SW-B", name: "海水寄养缸 B", waterType: "salt", capacity: 6, temp: 25.0, dailyRate: 6 },
  { id: "RF-A", name: "三湖寄养缸 A", waterType: "rift", capacity: 15, temp: 27.0, dailyRate: 3 },
];

const ts = (text: string, at: string) => ({ at, text });

function buildSeeds(): Admission[] {
  const today = todayStr();
  const stamp = (daysAgo: number, hm: string) => `${addDays(today, -daysAgo)}T${hm}:00`;

  return [
    {
      id: "F-1001",
      customer: "王敏",
      phone: "13800001111",
      species: "七彩神仙",
      count: 4,
      waterType: "fresh",
      originTemp: 26.5,
      registeredAt: addDays(today, -5),
      expectedEnd: addDays(today, -1),
      status: "housed",
      tankId: "FW-A",
      placedAt: addDays(today, -4),
      events: [
        ts("登记寄养，自动分配到淡水寄养缸 A", stamp(5, "10:12")),
        ts("入缸寄养，占用 4 个位置", stamp(4, "09:30")),
      ],
    },
    {
      id: "F-1002",
      customer: "陈立",
      phone: "13900002222",
      species: "公子小丑鱼",
      count: 2,
      waterType: "salt",
      originTemp: 25.0,
      registeredAt: addDays(today, -2),
      expectedEnd: addDays(today, 3),
      status: "housed",
      tankId: "SW-A",
      placedAt: addDays(today, -2),
      events: [
        ts("登记寄养，自动分配到海水寄养缸 A", stamp(2, "14:05")),
        ts("入缸寄养，占用 2 个位置", stamp(2, "14:20")),
      ],
    },
    {
      id: "F-1003",
      customer: "赵凯",
      phone: "13700003333",
      species: "布隆迪六间",
      count: 6,
      waterType: "rift",
      originTemp: 27.5,
      registeredAt: addDays(today, -1),
      expectedEnd: addDays(today, 5),
      status: "housed",
      tankId: "RF-A",
      placedAt: addDays(today, -1),
      events: [
        ts("登记寄养，自动分配到三湖寄养缸 A", stamp(1, "11:40")),
        ts("入缸寄养，占用 6 个位置", stamp(1, "11:55")),
      ],
    },
    {
      id: "F-1004",
      customer: "林珊",
      phone: "13600004444",
      species: "海水神仙",
      count: 5,
      waterType: "salt",
      originTemp: 25.2,
      registeredAt: today,
      expectedEnd: addDays(today, 4),
      status: "pending",
      events: [ts("登记寄养：海水缸剩余位置不足，进入待安排", stamp(0, "09:15"))],
    },
    {
      id: "F-1005",
      customer: "周洁",
      phone: "13500005555",
      species: "孔雀鱼",
      count: 12,
      waterType: "fresh",
      originTemp: 24.5,
      registeredAt: addDays(today, -9),
      expectedEnd: addDays(today, -3),
      status: "completed",
      tankId: "FW-B",
      placedAt: addDays(today, -9),
      endedAt: addDays(today, -3),
      health: "good",
      healthNote: "食欲正常，鳞片完整",
      fee: calcFee(12, addDays(today, -9), addDays(today, -3), addDays(today, -3), 2),
      events: [
        ts("登记寄养，自动分配到淡水寄养缸 B", stamp(9, "16:00")),
        ts("入缸寄养，占用 12 个位置", stamp(9, "16:20")),
        ts("到店回取：健康状态良好，结算完成，位置已释放", `${addDays(today, -3)}T18:10:00`),
      ],
    },
    {
      id: "F-1006",
      customer: "孙浩",
      phone: "13400006666",
      species: "金鱼",
      count: 3,
      waterType: "fresh",
      originTemp: 23.0,
      registeredAt: addDays(today, -6),
      expectedEnd: addDays(today, 2),
      status: "cancelled",
      tankId: "FW-A",
      placedAt: addDays(today, -6),
      endedAt: addDays(today, -4),
      fee: calcFee(3, addDays(today, -6), addDays(today, 2), addDays(today, -4), 2),
      events: [
        ts("登记寄养，自动分配到淡水寄养缸 A", stamp(6, "10:00")),
        ts("入缸寄养，占用 3 个位置", stamp(6, "10:15")),
        ts("顾客提前取消，结算在缸费用，位置已释放", `${addDays(today, -4)}T15:30:00`),
      ],
    },
  ];
}

export const SEED_ADMISSIONS: Admission[] = buildSeeds();
