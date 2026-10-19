import { first, rows, run } from "./db";
import type { Env } from "./env";
import { localDay, policy } from "../shared/core";
import { now, json } from "./env";
export function weekStart(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function streakFor(days: string[], today: string) {
  let streak = 0,
    d = new Date(`${today}T12:00:00Z`);
  if (!days.includes(today)) d.setUTCDate(d.getUTCDate() - 1);
  while (days.includes(d.toISOString().slice(0, 10))) {
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}
export async function settleChallenges(env: Env, user: string) {
  const p = await first<{ timezone: string; reminders: string }>(
      env,
      "SELECT timezone,reminders FROM profiles WHERE user_id=?",
      user,
    ),
    day = localDay(new Date(), p?.timezone ?? "Asia/Singapore"),
    week = weekStart(day),
    goal = json<{ weeklyGoal?: number }>(p?.reminders, {}).weeklyGoal ?? 5;
  // Challenges use unique activity IDs, and challenge rewards never qualify as
  // learning participation themselves.
  await run(
    env,
    `INSERT OR IGNORE INTO activities(id,user_id,kind,day,xp,coins,created_at) SELECT ?,?,'daily-challenge',?,?,5,? WHERE EXISTS(SELECT 1 FROM activities WHERE user_id=? AND day=? AND kind IN ('attempt','reflection'))`,
    `daily:${user}:${day}`,
    user,
    day,
    policy.rewards.dailyChallengeXp,
    now(),
    user,
    day,
  );
  await run(
    env,
    `INSERT OR IGNORE INTO activities(id,user_id,kind,day,xp,coins,created_at) SELECT ?,?,'weekly-challenge',?,?,15,? WHERE (SELECT COUNT(DISTINCT day) FROM activities WHERE user_id=? AND day>=? AND day<=? AND kind IN ('attempt','reflection'))>=?`,
    `weekly:${user}:${week}`,
    user,
    day,
    policy.rewards.weeklyChallengeXp,
    now(),
    user,
    week,
    day,
    goal,
  );
  const activities = await rows<{ day: string; kind: string }>(
      env,
      "SELECT day,kind FROM activities WHERE user_id=?",
      user,
    ),
    days = [
      ...new Set(
        activities
          .filter((a) => ["attempt", "reflection"].includes(a.kind))
          .map((a) => a.day),
      ),
    ].sort();
  return {
    day,
    week,
    weeklyGoal: goal,
    weeklyProgress: days.filter((d) => d >= week && d <= day).length,
    dailyComplete: activities.some(
      (a) => a.kind === "daily-challenge" && a.day === day,
    ),
    weeklyComplete: activities.some(
      (a) => a.kind === "weekly-challenge" && a.day >= week,
    ),
    days,
    streak: streakFor(days, day),
  };
}
