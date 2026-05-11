import type { Database } from "./database.types";

type Entry = Database["public"]["Tables"]["daily_entries"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];

export function isEntryComplete(tasks: Task[]): boolean {
  return tasks.length === 3 && tasks.every((t) => t.done && t.text.trim());
}

export function calcStreak(entries: Entry[], tasksByEntry: Record<string, Task[]>): number {
  const today = toDateStr(new Date());
  let streak = 0;
  const d = new Date();

  for (let i = 0; i < 365; i++) {
    const key = toDateStr(d);
    const entry = entries.find((e) => e.date === key);
    const tasks = entry ? (tasksByEntry[entry.id] || []) : [];
    const complete = entry && isEntryComplete(tasks);

    if (complete) {
      streak++;
    } else if (key !== today) {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function calcTotalDays(entries: Entry[], tasksByEntry: Record<string, Task[]>): number {
  return entries.filter((e) => isEntryComplete(tasksByEntry[e.id] || [])).length;
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getWeekKey(d: Date = new Date()): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  return toDateStr(mon);
}

export const QUOTES = [
  { q: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", a: "Stephen Covey" },
  { q: "It's not about ideas. It's about making ideas happen.", a: "Scott Belsky" },
  { q: "Focus on being productive instead of busy.", a: "Tim Ferriss" },
  { q: "One day or day one. You decide.", a: "—" },
  { q: "You don't have to be great to start, but you have to start to be great.", a: "Zig Ziglar" },
  { q: "Action is the foundational key to all success.", a: "Pablo Picasso" },
  { q: "The secret of getting ahead is getting started.", a: "Mark Twain" },
  { q: "Small daily improvements are the key to staggering long-term results.", a: "Robin Sharma" },
  { q: "Concentrate all your thoughts upon the work at hand.", a: "Alexander Graham Bell" },
  { q: "Do the hard jobs first. The easy jobs will take care of themselves.", a: "Dale Carnegie" },
  { q: "You can do anything, but not everything.", a: "David Allen" },
  { q: "What we fear doing most is usually what we most need to do.", a: "Tim Ferriss" },
];

export const CEL_MSGS = [
  "Three down. You showed up today. That's everything.",
  "Clean sweep. The best version of you just had a great day.",
  "Done and done. Consistency is your superpower.",
  "Three for three. That's how legends are built.",
  "You didn't just finish tasks — you built a habit.",
];

export const MILESTONES = [
  { id: "first", name: "First day", desc: "Complete your first Big 3", req: (s: { streak: number; total: number }) => s.total >= 1 },
  { id: "week", name: "Full week", desc: "7-day streak", req: (s: { streak: number; total: number }) => s.streak >= 7 },
  { id: "half_month", name: "Half month", desc: "15-day streak", req: (s: { streak: number; total: number }) => s.streak >= 15 },
  { id: "month", name: "One month", desc: "30-day streak", req: (s: { streak: number; total: number }) => s.streak >= 30 },
  { id: "ten", name: "10 perfect days", desc: "10 total days completed", req: (s: { streak: number; total: number }) => s.total >= 10 },
  { id: "fifty", name: "50 perfect days", desc: "50 total days completed", req: (s: { streak: number; total: number }) => s.total >= 50 },
];
