"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { registerPush, unregisterPush } from "@/lib/push";
import {
  calcStreak, calcTotalDays, toDateStr, getWeekKey,
  QUOTES, CEL_MSGS, MILESTONES, isEntryComplete,
} from "@/lib/utils";
import type { Database } from "@/lib/database.types";
import styles from "./TodayView.module.css";

type Entry = Database["public"]["Tables"]["daily_entries"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];

interface Props {
  userId: string;
  userEmail: string;
  todayEntry: Entry;
  todayTasks: Task[];
  allEntries: Entry[];
  allHistoryTasks: Task[];
  weekTheme: string | null;
  notificationTime: string;
  pushSubscription: unknown;
}

// ── Audio ─────────────────────────────────────────────────
let audioCtx: AudioContext | null = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return audioCtx;
}
function playTick(index: number) {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = [440, 523, 659][index] || 440;
    o.type = "sine";
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    o.start(); o.stop(ctx.currentTime + 0.22);
  } catch {}
}
function playUncheck() {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 300; o.type = "sine";
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.start(); o.stop(ctx.currentTime + 0.12);
  } catch {}
}
function playFanfare() {
  try {
    const ctx = getCtx();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const t = ctx.currentTime + i * 0.12;
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq; o.type = "triangle";
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.start(t); o.stop(t + 0.35);
    });
  } catch {}
}
function playMoodClick() {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 600; o.type = "sine";
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.start(); o.stop(ctx.currentTime + 0.1);
  } catch {}
}

// ── Confetti ──────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.getElementById("confetti-canvas") as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext("2d")!;
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const colors = ["#7c6af7", "#22c55e", "#f97316", "#ec4899", "#3b82f6", "#eab308"];
  const pieces = Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width, y: -10,
    w: 5 + Math.random() * 7, h: 9 + Math.random() * 7,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * 360, rotV: (Math.random() - 0.5) * 6,
    vx: (Math.random() - 0.5) * 4, vy: 3 + Math.random() * 4, alpha: 1,
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y); ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      p.x += p.vx; p.y += p.vy; p.rot += p.rotV; p.vy += 0.09;
      if (frame > 60) p.alpha = Math.max(0, p.alpha - 0.013);
    });
    frame++;
    if (frame < 180) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

// ── Main component ────────────────────────────────────────
export function TodayView({
  userId, userEmail, todayEntry, todayTasks: initialTasks,
  allEntries, allHistoryTasks, weekTheme: initialWeekTheme,
  notificationTime: initialNotifTime, pushSubscription,
}: Props) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [mood, setMood] = useState<number | null>(todayEntry.mood);
  const [weekTheme, setWeekTheme] = useState(initialWeekTheme || "");
  const [notifTime, setNotifTime] = useState(initialNotifTime);
  const [pushEnabled, setPushEnabled] = useState(!!pushSubscription);
  const [celebrated, setCelebrated] = useState(isEntryComplete(initialTasks));
  const [showSettings, setShowSettings] = useState(false);
  const celebratedRef = useRef(celebrated);

  const tasksByEntry: Record<string, Task[]> = {};
  allHistoryTasks.forEach((t) => {
    if (!tasksByEntry[t.entry_id]) tasksByEntry[t.entry_id] = [];
    tasksByEntry[t.entry_id].push(t);
  });
  tasksByEntry[todayEntry.id] = tasks;

  const streak = calcStreak(allEntries, tasksByEntry);
  const totalDays = calcTotalDays(allEntries, tasksByEntry);
  const doneCnt = tasks.filter((t) => t.done).length;
  const allDone = isEntryComplete(tasks);

  const dateObj = new Date();
  const qi = Math.abs(dateObj.getDate() + dateObj.getMonth() * 31) % QUOTES.length;
  const quote = QUOTES[qi];

  // Celebration trigger
  useEffect(() => {
    if (allDone && !celebratedRef.current) {
      celebratedRef.current = true;
      setCelebrated(true);
      setTimeout(() => { playFanfare(); launchConfetti(); }, 120);
    }
    if (!allDone) { celebratedRef.current = false; setCelebrated(false); }
  }, [allDone]);

  const updateTask = useCallback(async (taskId: string, field: "text" | "done", value: string | boolean) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, [field]: value } : t));
    await supabase.from("tasks").update({ [field]: value }).eq("id", taskId);
    // Check if completed after this update
    setTasks((prev) => {
      const updated = prev.map((t) => t.id === taskId ? { ...t, [field]: value } : t);
      if (isEntryComplete(updated)) {
        supabase.from("daily_entries").update({ completed_at: new Date().toISOString() }).eq("id", todayEntry.id);
      }
      return updated;
    });
  }, [supabase, todayEntry.id]);

  const handleCheck = (task: Task, idx: number) => {
    if (!task.text.trim()) return;
    const newDone = !task.done;
    if (newDone) playTick(idx); else playUncheck();
    updateTask(task.id, "done", newDone);
  };

  const handleMood = async (m: number) => {
    playMoodClick();
    const next = mood === m ? null : m;
    setMood(next);
    await supabase.from("daily_entries").update({ mood: next }).eq("id", todayEntry.id);
  };

  const handleThemeSave = async () => {
    const wk = getWeekKey();
    await supabase.from("profiles").update({
      weekly_theme: weekTheme,
      weekly_theme_set_at: wk,
    }).eq("id", userId);
  };

  const handleTogglePush = async () => {
    if (pushEnabled) {
      await unregisterPush();
      await fetch("/api/push", { method: "DELETE" });
      setPushEnabled(false);
    } else {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const sub = await registerPush();
      if (sub) {
        await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub }) });
        setPushEnabled(true);
      }
    }
  };

  const handleNotifTime = async (t: string) => {
    setNotifTime(t);
    await supabase.from("profiles").update({ notification_time: t }).eq("id", userId);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <>
      <canvas id="confetti-canvas" />
      <div className={styles.page}>
        {/* Header */}
        <header className={styles.header}>
          <div className="o3-logo">O<span>3</span></div>
          <button className={styles.settingsBtn} onClick={() => setShowSettings(!showSettings)} aria-label="Settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </header>

        {/* Settings panel */}
        {showSettings && (
          <div className={`card ${styles.settingsPanel}`}>
            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>Signed in as</span>
              <span className={styles.settingsValue}>{userEmail}</span>
            </div>
            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>Daily reminder</span>
              <input type="time" value={notifTime} onChange={(e) => handleNotifTime(e.target.value)} className={styles.timeInput} />
            </div>
            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>Notifications</span>
              <button className={`${styles.toggleBtn} ${pushEnabled ? styles.toggleOn : ""}`} onClick={handleTogglePush}>
                {pushEnabled ? "On" : "Off"}
              </button>
            </div>
            <button className={styles.signOutBtn} onClick={handleSignOut}>Sign out</button>
          </div>
        )}

        {/* Quote */}
        <div className={`card ${styles.quoteCard}`}>
          <p className={styles.quoteText}>&ldquo;{quote.q}&rdquo;</p>
          <p className={styles.quoteAuthor}>— {quote.a}</p>
        </div>

        {/* Weekly theme */}
        <div className={`card ${styles.themeCard}`}>
          <div className={styles.themeDot} />
          <span className="label" style={{ flexShrink: 0 }}>This week</span>
          <input
            className={styles.themeInput}
            placeholder="your intention..."
            value={weekTheme}
            maxLength={40}
            onChange={(e) => setWeekTheme(e.target.value)}
            onBlur={handleThemeSave}
            onKeyDown={(e) => e.key === "Enter" && handleThemeSave()}
          />
        </div>

        {/* Stats */}
        <div className={styles.statsRow}>
          <div className="card" style={{ textAlign: "center" }}>
            <div className={styles.statVal}>{streak}🔥</div>
            <div className="label">streak</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div className={styles.statVal}>{doneCnt}/3</div>
            <div className="label">today</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div className={styles.statVal}>{totalDays}</div>
            <div className="label">days done</div>
          </div>
        </div>

        {/* Celebration */}
        {allDone && (
          <div className={`card ${styles.celebCard}`}>
            <span style={{ fontSize: 20 }}>🎉</span>
            <div>
              <p className={styles.celebTitle}>All done!</p>
              <p className={styles.celebMsg}>{CEL_MSGS[dateObj.getDate() % CEL_MSGS.length]}</p>
            </div>
          </div>
        )}

        {/* Tasks */}
        <div className={`card ${styles.tasksCard}`}>
          <p className="label" style={{ marginBottom: "0.75rem" }}>today&rsquo;s three</p>
          {tasks.map((task, i) => (
            <div key={task.id} className={styles.taskRow}>
              <span className={styles.taskNum}>{i + 1}</span>
              <button
                className={`${styles.checkBtn} ${task.done ? styles.checkDone : ""}`}
                onClick={() => handleCheck(task, i)}
                aria-label={`Mark task ${i + 1} ${task.done ? "undone" : "done"}`}
              >
                {task.done && (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2,6 5,9 10,3" />
                  </svg>
                )}
              </button>
              <input
                className={`${styles.taskInput} ${task.done ? styles.taskDone : ""}`}
                placeholder={`task ${i + 1}...`}
                value={task.text}
                maxLength={80}
                onChange={(e) => updateTask(task.id, "text", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && i < 2) {
                    const inputs = document.querySelectorAll<HTMLInputElement>(`.${styles.taskInput}`);
                    inputs[i + 1]?.focus();
                  }
                }}
              />
            </div>
          ))}
          <div className={styles.progressWrap}>
            <div className={styles.progressBar} style={{ width: `${(doneCnt / 3) * 100}%` }} />
          </div>
          <p className={styles.progressLbl}>{doneCnt} of 3</p>
        </div>

        {/* Mood */}
        <div className={`card ${styles.moodCard}`}>
          <p className="label" style={{ marginBottom: "0.6rem" }}>How&rsquo;s today feeling?</p>
          <div className={styles.moodRow}>
            {["😤", "😐", "🙂", "😄", "🔥"].map((em, m) => (
              <button
                key={m}
                className={`${styles.moodBtn} ${mood === m ? styles.moodSelected : ""}`}
                onClick={() => handleMood(m)}
                aria-label={em}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <p className="label" style={{ marginBottom: "0.6rem" }}>This month</p>
        <CalendarGrid allEntries={allEntries} tasksByEntry={tasksByEntry} />

        {/* Milestones */}
        <p className="label" style={{ margin: "1.25rem 0 0.6rem" }}>Milestones</p>
        <div className={styles.milestones}>
          {MILESTONES.map((m) => {
            const unlocked = m.req({ streak, total: totalDays });
            return (
              <div key={m.id} className={`${styles.milestone} ${unlocked ? styles.milestoneUnlocked : ""}`}>
                <div className={styles.mText}>
                  <p className={styles.mName}>{m.name}</p>
                  <p className={styles.mDesc}>{m.desc}</p>
                </div>
                <span className={`${styles.mBadge} ${unlocked ? styles.mBadgeUnlocked : ""}`}>
                  {unlocked ? "✓" : "locked"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Calendar sub-component ────────────────────────────────
function CalendarGrid({ allEntries, tasksByEntry }: { allEntries: Entry[]; tasksByEntry: Record<string, Task[]> }) {
  const today = toDateStr(new Date());
  const d = new Date();
  const year = d.getFullYear(), month = d.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  return (
    <div className={styles.calGrid}>
      {["S", "M", "T", "W", "T", "F", "S"].map((l, i) => (
        <div key={i} className={styles.calLabel}>{l}</div>
      ))}
      {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
      {Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const entry = allEntries.find((e) => e.date === key);
        const tasks = entry ? (tasksByEntry[entry.id] || []) : [];
        const full = entry && isEntryComplete(tasks);
        const partial = entry && tasks.some((t) => t.done);
        return (
          <div
            key={key}
            className={`${styles.calDay} ${full ? styles.calFull : partial ? styles.calPartial : styles.calEmpty} ${key === today ? styles.calToday : ""}`}
          />
        );
      })}
    </div>
  );
}
