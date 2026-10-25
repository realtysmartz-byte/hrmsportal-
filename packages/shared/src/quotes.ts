import { getISTDateParts } from "./constants";

export type PunchTimingCategory = "EARLY" | "ON_TIME" | "LATE";

export const MOTIVATIONAL_QUOTES: Record<PunchTimingCategory, string[]> = {
  EARLY: [
    "Early bird sets the pace! Your punctuality sets the gold standard today.",
    "Starting ahead of time gives you the edge. Make today extraordinary!",
    "Discipline before the clock strikes is where champions are made. Have a stellar day!",
    "Early to arrive, ready to thrive! Your dedication is truly inspiring.",
    "The best preparation for tomorrow is doing your best today, starting bright and early!",
    "Punctuality is not just about being on time, it is about respecting your own goals and potential.",
    "Arriving early gives you the quiet focus before conquering big goals. Let's do this!",
    "You beat the clock today! Channel that winning momentum into everything you achieve.",
    "A proactive morning leads to a victorious day. Welcome ahead of schedule!",
    "Consistency and punctuality are quiet superpowers. Great job being ahead of time!",
    "Success begins with showing up early and ready to create value. Have an amazing day!",
    "Winning starts before the bell rings. Great job arriving early and prepared!",
    "Being early means you are in control of your day. Lead with confidence today!",
    "Your dedication to promptness inspires everyone around you. Have a productive day!",
    "Ahead of time and ahead of the game! Let's make today count.",
  ],
  ON_TIME: [
    "Right on time, right on target! Let's make today full of achievements.",
    "Punctual and ready to roll! Have a productive and energized day.",
    "Every day is a fresh canvas. Bring your best focus and create something remarkable!",
    "Great work begins with showing up prepared. Let's reach new milestones together!",
    "Focused minds create extraordinary results. Wishing you a high-impact workday!",
    "Welcome to a fresh day of opportunities! Let's build excellence together.",
    "Success is built one focused day at a time. Let's make every hour count!",
    "Your hard work and positive attitude drive Realty Smartz forward. Have a fantastic day!",
    "Stay positive, work hard, and make great things happen today!",
    "Small daily efforts multiply into massive achievements. Make today remarkable!",
    "Energy, focus, and determination — bring your best self to work today!",
    "Great things never come from comfort zones. Let's achieve something great today!",
  ],
  LATE: [
    "It's not about the start, it's about the finish. Bring your best energy and conquer today!",
    "Every moment is a fresh chance to turn things around. Let's make today truly count!",
    "A delayed start only means you finish stronger. Focus in and shine bright today!",
    "Keep your eyes on the goal, not the clock. Turn today into an impressive win!",
    "Dust off the morning rush and bring your positive power to work. You've got this!",
    "What matters most is what you achieve starting right now. Let's make it a great day!",
    "Every hour from now is an opportunity to create high impact. Dive in and make it happen!",
    "Focus forward! Your dedication today can turn any challenge into a triumph.",
    "Determination beats delay every single time. Bring your best game to the team today!",
    "Turn up the momentum and show what you're made of today. Let's crush our goals!",
    "The day is still full of possibilities. Focus your mind, take charge, and deliver excellence!",
    "Progress begins the moment you decide to give your 100%. Let's make today great!",
    "Leave the morning traffic behind and focus on creating value. Have a strong, productive day!",
    "A fresh start begins now. Channel your energy into high-impact results today!",
    "Focus on the finish line, not the starting time. Give it your all today!",
  ],
};

/**
 * Determines punch timing based on IST:
 * - Shift starts at 10:00 AM (600 minutes)
 * - Before 10:00 AM -> EARLY
 * - 10:00 AM to 10:15 AM -> ON_TIME
 * - After 10:15 AM -> LATE
 */
export function getPunchTimingCategory(date: Date = new Date()): PunchTimingCategory {
  const ist = getISTDateParts(date);
  const minutes = ist.hour * 60 + ist.minute;
  if (minutes < 600) return "EARLY";
  if (minutes <= 615) return "ON_TIME";
  return "LATE";
}

/**
 * Returns a random quote for the given punch timing category.
 * Every clock-in gets a fresh, randomized quote.
 */
export function getRandomMotivationalQuote(category: PunchTimingCategory): string {
  const list = MOTIVATIONAL_QUOTES[category] ?? MOTIVATIONAL_QUOTES.ON_TIME;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

/**
 * Returns a deterministic quote for display on reloads/card view
 * based on date and optional seed (e.g. employeeId).
 */
export function getDailyDeterministicQuote(date: Date, seedStr?: string): string {
  const category = getPunchTimingCategory(date);
  const list = MOTIVATIONAL_QUOTES[category] ?? MOTIVATIONAL_QUOTES.ON_TIME;
  const ist = getISTDateParts(date);
  const key = `${ist.year}-${ist.month}-${ist.day}:${seedStr || ""}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % list.length;
  return list[idx];
}
