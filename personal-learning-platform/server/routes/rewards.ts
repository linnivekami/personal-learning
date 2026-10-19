import type { Hono } from "hono";
import type { HonoEnv } from "../env";
import { z } from "zod";
import { ApiError, now, json } from "../env";
import { first, rows, run } from "../db";
import { rewardState } from "../../shared/core";
import type { LearningEvent } from "../../shared/types";
import { settleChallenges } from "../growth";

const shop: Record<string, number> = {
  ocean: 40,
  plum: 60,
  amber: 80,
  fox: 30,
  owl: 60,
  planet: 100,
};
export function installRewardRoutes(app: Hono<HonoEnv>) {
  app.get("/api/v1/rewards", async (c) => {
    const u = c.get("user");
    const challenges = await settleChallenges(c.env, u.id);
    const events = (
      await rows<{ event: string }>(
        c.env,
        "SELECT event FROM events WHERE user_id=? ORDER BY occurred_at",
        u.id,
      )
    ).map((r) => json<LearningEvent>(r.event, {} as LearningEvent));
    const activities = await rows<{ day: string; xp: number; coins: number }>(
      c.env,
      "SELECT day,xp,coins FROM activities WHERE user_id=?",
      u.id,
    );
    const purchases = await rows<{ item: string; price: number }>(
      c.env,
      "SELECT item,price FROM purchases WHERE user_id=?",
      u.id,
    );
    const p = await first<{ timezone: string; preferences: string }>(
      c.env,
      "SELECT timezone,preferences FROM profiles WHERE user_id=?",
      u.id,
    );
    const pref = json<Record<string, string>>(p?.preferences, {});
    const reward = rewardState(
      events,
      p?.timezone,
      purchases.map((p) => p.item),
      pref.theme ?? "forest",
      pref.avatar ?? "seed",
    );
    reward.xp = activities.reduce((n, a) => n + a.xp, 0);
    reward.level = 1 + Math.floor(reward.xp / 150);
    reward.coins =
      activities.reduce((n, a) => n + a.coins, 0) -
      purchases.reduce((n, p) => n + p.price, 0);
    reward.effectiveDays = challenges.days;
    reward.streak = challenges.streak;
    reward.challenges = challenges;
    return c.json({ rewards: reward, activities });
  });
  app.post("/api/v1/rewards/purchase", async (c) => {
    const { item } = z.object({ item: z.string() }).parse(await c.req.json());
    if (!(item in shop)) throw new ApiError(400, "ITEM", "奖励不存在。");
    const u = c.get("user");
    const result = await run(
      c.env,
      "INSERT OR IGNORE INTO purchases(user_id,item,price,created_at) SELECT ?,?,?,? WHERE (SELECT COALESCE(SUM(coins),0) FROM activities WHERE user_id=?)-(SELECT COALESCE(SUM(price),0) FROM purchases WHERE user_id=?)>=?",
      u.id,
      item,
      shop[item],
      now(),
      u.id,
      u.id,
      shop[item],
    );
    if (!result.meta.changes)
      throw new ApiError(409, "COINS", "学习币不足，或已拥有此奖励。");
    return c.json({ ok: true });
  });
  app.post("/api/v1/rewards/equip", async (c) => {
    const d = z
      .object({ type: z.enum(["theme", "avatar"]), item: z.string() })
      .parse(await c.req.json());
    const u = c.get("user");
    if (
      !["forest", "seed"].includes(d.item) &&
      !(await first(
        c.env,
        "SELECT item FROM purchases WHERE user_id=? AND item=?",
        u.id,
        d.item,
      ))
    )
      throw new ApiError(403, "NOT_OWNED", "尚未解锁此奖励。");
    const p = await first<{ preferences: string }>(
      c.env,
      "SELECT preferences FROM profiles WHERE user_id=?",
      u.id,
    );
    await run(
      c.env,
      "UPDATE profiles SET preferences=? WHERE user_id=?",
      JSON.stringify({ ...json(p?.preferences, {}), [d.type]: d.item }),
      u.id,
    );
    return c.json({ ok: true });
  });
}
