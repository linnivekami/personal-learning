import { Check, Flame, Star, Coins, CalendarDays } from "lucide-react";
import type { AppUser, RewardState } from "../../../shared/types";
import { Page } from "../../ui/primitives";
import { post } from "../../lib/api";
type Tr = (a: string, b: string) => string;
export function GrowthPage({
  rewards,
  refresh,
  onError,
  tr,
  user,
}: {
  rewards: RewardState | null;
  refresh: () => Promise<unknown>;
  onError: (s: string) => void;
  tr: Tr;
  user: AppUser | null;
}) {
  const r = rewards ?? {
    xp: 0,
    level: 1,
    coins: 0,
    streak: 0,
    effectiveDays: [],
    badges: [],
    owned: ["forest", "seed"],
    equippedTheme: "forest",
    equippedAvatar: "seed",
  };
  const today = new Date();
  const days = Array.from({ length: 35 }, (_, i) =>
    new Date(
      Date.UTC(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - (34 - i),
      ),
    )
      .toISOString()
      .slice(0, 10),
  );
  const shop = [
    {
      id: "ocean",
      name: tr("海洋线路色", "Ocean line colour"),
      price: 40,
      icon: "🌊",
      type: "theme",
    },
    {
      id: "plum",
      name: tr("暮紫线路色", "Plum line colour"),
      price: 60,
      icon: "🌙",
      type: "theme",
    },
    {
      id: "amber",
      name: tr("琥珀线路色", "Amber line colour"),
      price: 80,
      icon: "☀️",
      type: "theme",
    },
    {
      id: "fox",
      name: tr("小狐狸头像", "Fox avatar"),
      price: 30,
      icon: "🦊",
      type: "avatar",
    },
    {
      id: "owl",
      name: tr("猫头鹰头像", "Owl avatar"),
      price: 60,
      icon: "🦉",
      type: "avatar",
    },
    {
      id: "planet",
      name: tr("探索者头像", "Explorer avatar"),
      price: 100,
      icon: "🪐",
      type: "avatar",
    },
  ];
  const badges = [
    ["first-step", "🌱", tr("迈出第一步", "First step")],
    ["seven-days", "🌿", tr("七次生长", "Seven growing days")],
    ["remember", "🧠", tr("记得住的理解", "Understanding that stays")],
    ["connector", "🔗", tr("跨域连接者", "Knowledge connector")],
    ["independent", "⭐", tr("独立思考者", "Independent thinker")],
  ];
  return (
    <Page
      title={tr("看见自己的生长", "See your own growth")}
      lead={tr(
        "奖励每一次真实投入，掌握度仍由学习证据决定。",
        "Celebrate real effort. Mastery still follows the evidence.",
      )}
    >
      <section className="growth-hero">
        <div className="growth-plant">
          {r.equippedAvatar === "fox"
            ? "🦊"
            : r.equippedAvatar === "owl"
              ? "🦉"
              : r.equippedAvatar === "planet"
                ? "🪐"
                : "🌿"}
        </div>
        <div>
          <span>
            {tr("学习者等级", "Learner level")} {r.level}
          </span>
          <h2>
            {r.xp === 0
              ? tr("每一个新连接，都是成长", "Every connection is growth")
              : tr("理解，正在扎下根", "Understanding is taking root")}
          </h2>
          <div className="xp-track">
            <i style={{ width: `${((r.xp % 150) / 150) * 100}%` }} />
          </div>
          <small>
            {r.xp % 150} / 150 XP · {tr("距离下一级", "toward your next level")}
          </small>
        </div>
        <div className="growth-numbers">
          <span>
            <Flame size={20} />
            <b>{r.streak}</b>
            {tr("连续学习", "day streak")}
          </span>
          <span>
            <Coins size={20} />
            <b>{r.coins}</b>
            {tr("学习币", "learning coins")}
          </span>
        </div>
      </section>
      <div className="growth-two">
        <section className="calendar-panel">
          <h2>{tr("你的学习足迹", "Your learning footprint")}</h2>
          <div className="learning-calendar">
            {days.map((day) => (
              <span
                key={day}
                className={r.effectiveDays.includes(day) ? "effective" : ""}
                title={`${day}${r.effectiveDays.includes(day) ? " ✓" : ""}`}
              >
                {Number(day.slice(-2))}
              </span>
            ))}
          </div>
          <p>
            {tr(
              "完成作答、复习或自主总结，会点亮这一天。断签后，随时继续。",
              "An attempt, review or reflection lights up a day. You can always resume after a break.",
            )}
          </p>
        </section>
        <section className="challenge-panel">
          <h2>{tr("小挑战，真进步", "Small challenges, real progress")}</h2>
          <div>
            <Check size={17} />
            <p>
              <strong>
                {tr(
                  "今日：独立尝试一道题",
                  "Today: attempt a task independently",
                )}
              </strong>
              <small>
                {tr(
                  r.challenges?.dailyComplete
                    ? "已完成 · 额外 15 XP / 5 学习币已入账"
                    : "完成作答或自主总结 · 额外 15 XP / 5 学习币",
                  r.challenges?.dailyComplete
                    ? "Completed · bonus 15 XP / 5 coins awarded"
                    : "Attempt or reflect · bonus 15 XP / 5 coins",
                )}
              </small>
            </p>
          </div>
          <div>
            <CalendarDays size={17} />
            <p>
              <strong>
                {tr(
                  `本周：让学习发生 ${r.challenges?.weeklyGoal ?? 5} 天`,
                  `This week: learn on ${r.challenges?.weeklyGoal ?? 5} days`,
                )}
              </strong>
              <small>
                {r.challenges?.weeklyProgress ?? 0} /{" "}
                {r.challenges?.weeklyGoal ?? 5}{" "}
                {tr("天已记录", "days recorded")}
              </small>
            </p>
          </div>
          <div>
            <Star size={17} />
            <p>
              <strong>
                {tr(
                  "连接挑战：完成一次迁移练习",
                  "Connect: complete a transfer task",
                )}
              </strong>
              <small>
                {tr(
                  "用不同情境检验同一个核心关系",
                  "Test the same principle in a new context",
                )}
              </small>
            </p>
          </div>
        </section>
      </div>
      <h2 className="section-title">{tr("成长徽章", "Milestones")}</h2>
      <div className="badge-grid">
        {badges.map(([id, icon, name]) => (
          <div
            key={id}
            className={`badge-card ${r.badges.includes(id) ? "earned" : ""}`}
          >
            <span>{icon}</span>
            <strong>{name}</strong>
            <small>
              {r.badges.includes(id)
                ? tr("已点亮", "Earned")
                : tr("等待下一次成长", "A milestone ahead")}
            </small>
          </div>
        ))}
      </div>
      <h2 className="section-title">
        {tr("给学习空间一点个性", "Make the workspace yours")}
      </h2>
      <div className="shop-grid">
        {shop.map((item) => (
          <div className="shop-item" key={item.id}>
            <span>{item.icon}</span>
            <h3>{item.name}</h3>
            <small>
              {item.price} {tr("学习币", "coins")}
            </small>
            <button
              className="button secondary small"
              disabled={!user}
              onClick={async () => {
                try {
                  if (r.owned.includes(item.id))
                    await post("/rewards/equip", {
                      type: item.type,
                      item: item.id,
                    });
                  else await post("/rewards/purchase", { item: item.id });
                  await refresh();
                  onError(
                    r.owned.includes(item.id)
                      ? tr("已使用此奖励。", "Reward equipped.")
                      : tr(
                          "奖励已解锁，可以点击使用。",
                          "Reward unlocked. Select it to equip.",
                        ),
                  );
                } catch (e) {
                  onError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              {r.owned.includes(item.id)
                ? tr("使用", "Equip")
                : tr("解锁", "Unlock")}
            </button>
          </div>
        ))}
      </div>
    </Page>
  );
}
