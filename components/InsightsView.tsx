"use client";

import { useMemo } from "react";
import type { Database } from "@/lib/database.types";
import { isEntryComplete, toDateStr } from "@/lib/utils";
import styles from "./TodayView.module.css";

type Entry = Database["public"]["Tables"]["daily_entries"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];

interface Props {
  allEntries: Entry[];
  allHistoryTasks: Task[];
  currentTasks: Task[];
  streak: number;
  totalDays: number;
}

const STOPWORDS = new Set(["a","an","the","and","or","to","do","for","in","on","at","with","my","i","it","of","is","be","by","up","re","get","set","add","fix","use","run","via","per","so","as","no","go"]);

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
}

export function InsightsView({ allEntries, allHistoryTasks, currentTasks, streak, totalDays }: Props) {
  const tasksByEntry = useMemo(() => {
    const map: Record<string, Task[]> = {};
    allHistoryTasks.forEach((t) => { if (!map[t.entry_id]) map[t.entry_id] = []; map[t.entry_id].push(t); });
    return map;
  }, [allHistoryTasks]);

  // All completed task texts
  const allTaskTexts = useMemo(() => {
    return allHistoryTasks.concat(currentTasks).filter(t => t.text.trim()).map(t => t.text.trim());
  }, [allHistoryTasks, currentTasks]);

  // Word frequency
  const wordFreq = useMemo(() => {
    const freq: Record<string, number> = {};
    allTaskTexts.forEach(text => tokenize(text).forEach(w => { freq[w] = (freq[w] || 0) + 1; }));
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [allTaskTexts]);

  // Last 30 days bar data
  const last30 = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (29 - i));
      const key = toDateStr(d);
      const entry = allEntries.find(e => e.date === key);
      const tasks = entry ? (tasksByEntry[entry.id] || []) : [];
      if (!entry) return "empty";
      if (isEntryComplete(tasks)) return "full";
      if (tasks.some(t => t.done)) return "partial";
      return "empty";
    });
  }, [allEntries, tasksByEntry]);

  // Mood trend (last 14 days)
  const moodTrend = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      const key = toDateStr(d);
      const entry = allEntries.find(e => e.date === key);
      return entry?.mood ?? null;
    });
  }, [allEntries]);

  // Best day of week
  const dayStats = useMemo(() => {
    const counts = Array(7).fill(0);
    const totals = Array(7).fill(0);
    allEntries.forEach(e => {
      const tasks = tasksByEntry[e.id] || [];
      const dow = new Date(e.date + "T12:00:00").getDay();
      totals[dow]++;
      if (isEntryComplete(tasks)) counts[dow]++;
    });
    return counts.map((c, i) => ({ pct: totals[i] ? Math.round((c / totals[i]) * 100) : 0, total: totals[i] }));
  }, [allEntries, tasksByEntry]);

  // Completion rate
  const completionRate = totalDays && allEntries.length ? Math.round((totalDays / allEntries.length) * 100) : 0;
  const avgMood = useMemo(() => {
    const moods = allEntries.map(e => e.mood).filter(m => m !== null) as number[];
    if (!moods.length) return null;
    return (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1);
  }, [allEntries]);

  const moodEmoji = (m: number | null) => m === null ? "" : ["😤","😐","🙂","😄","🔥"][Math.round(m)] || "";
  const dayLabels = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const maxFreq = wordFreq[0]?.[1] || 1;

  if (allEntries.length === 0) {
    return (
      <div className={styles.insightsScroll}>
        <div className={styles.insightSection}>
          <p className={styles.insightTitle}>Insights</p>
          <p className={styles.emptyState}>Complete a few days first — patterns will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.insightsScroll}>
      {/* Header */}
      <div style={{ paddingBottom: "1rem" }}>
        <p className={styles.insightTitle}>Insights</p>
        <p className={styles.insightSub}>Patterns from your {allEntries.length} logged days</p>
      </div>

      {/* Key stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statCardVal}>{streak}🔥</div>
          <div className={styles.statCardLbl}>Current streak</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardVal}>{completionRate}%</div>
          <div className={styles.statCardLbl}>Completion rate</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardVal}>{totalDays}</div>
          <div className={styles.statCardLbl}>Perfect days</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardVal}>{avgMood ? `${avgMood} ${moodEmoji(parseFloat(avgMood))}` : "—"}</div>
          <div className={styles.statCardLbl}>Avg mood</div>
        </div>
      </div>

      {/* 30-day activity */}
      <div className={styles.insightSection}>
        <p className="label" style={{ marginBottom: "0.75rem" }}>Last 30 days</p>
        <div className={`card`} style={{ padding: "1rem" }}>
          <div className={styles.streakBar30}>
            {last30.map((status, i) => (
              <div key={i} className={`${styles.streakBarItem} ${status === "full" ? styles.streakBarFull : status === "partial" ? styles.streakBarPartial : styles.streakBarEmpty}`}
                style={{ height: status === "full" ? "100%" : status === "partial" ? "50%" : "15%" }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="label">30 days ago</span>
            <span className="label">today</span>
          </div>
        </div>
      </div>

      {/* Mood trend */}
      {moodTrend.some(m => m !== null) && (
        <div className={styles.insightSection}>
          <p className="label" style={{ marginBottom: "0.75rem" }}>Mood — last 14 days</p>
          <div className="card" style={{ padding: "1rem" }}>
            <div className={styles.moodChart}>
              {moodTrend.map((m, i) => (
                <div key={i} className={styles.moodBar} style={{ height: m !== null ? `${((m + 1) / 5) * 100}%` : "5%", opacity: m !== null ? 0.4 + m * 0.15 : 0.15 }} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="label">14 days ago</span>
              <span className="label">today</span>
            </div>
          </div>
        </div>
      )}

      {/* Best day of week */}
      <div className={styles.insightSection}>
        <p className="label" style={{ marginBottom: "0.75rem" }}>Best day of week</p>
        <div className="card" style={{ padding: "1rem" }}>
          <div className={styles.dayGrid}>
            {dayStats.map((s, i) => (
              <div key={i} className={styles.dayCell}>
                <div className={styles.dayCellLabel}>{dayLabels[i]}</div>
                <div className={styles.dayCellVal} style={{ color: s.pct > 70 ? "var(--accent)" : s.pct > 40 ? "var(--text-2)" : "var(--text-3)" }}>{s.total > 0 ? `${s.pct}%` : "—"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Task patterns */}
      {wordFreq.length > 0 && (
        <div className={styles.insightSection}>
          <p className="label" style={{ marginBottom: "0.75rem" }}>Task patterns</p>
          <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: "0.75rem" }}>Most repeated words across all your tasks</p>
          <div className={styles.patternList}>
            {wordFreq.map(([word, count]) => (
              <div key={word} className={styles.patternItem}>
                <div style={{ flex: 1 }}>
                  <div className={styles.patternWord}>{word}</div>
                  <div className={styles.patternBar} style={{ width: `${(count / maxFreq) * 100}%` }} />
                </div>
                <span className={styles.patternCount}>×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
