"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { registerPush, unregisterPush } from "@/lib/push";
import { calcStreak, calcTotalDays, toDateStr, getWeekKey, QUOTES, CEL_MSGS, MILESTONES, isEntryComplete } from "@/lib/utils";
import type { Database } from "@/lib/database.types";
import styles from "./TodayView.module.css";
import { InsightsView } from "./InsightsView";

type Entry = Database["public"]["Tables"]["daily_entries"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];

interface Props {
  userId: string; userEmail: string;
  todayEntry: Entry; todayTasks: Task[];
  allEntries: Entry[]; allHistoryTasks: Task[];
  weekTheme: string | null; notificationTime: string;
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
    const freq = [349, 440, 523][index];
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = freq; o.type = "sine";
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    o.start(); o.stop(ctx.currentTime + 0.3);
  } catch {}
}

function playUncheck() {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 280; o.type = "sine";
    g.gain.setValueAtTime(0.07, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.start(); o.stop(ctx.currentTime + 0.15);
  } catch {}
}

function playFanfare() {
  try {
    const ctx = getCtx();
    // Major chord arpeggio: C4 E4 G4 C5 + shimmer
    const notes = [
      { freq: 261.6, t: 0, dur: 0.6, vol: 0.18 },
      { freq: 329.6, t: 0.1, dur: 0.55, vol: 0.16 },
      { freq: 392.0, t: 0.2, dur: 0.5, vol: 0.16 },
      { freq: 523.3, t: 0.3, dur: 0.7, vol: 0.2 },
      { freq: 1046.5, t: 0.35, dur: 0.8, vol: 0.08 },
    ];
    notes.forEach(({ freq, t, dur, vol }) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq; o.type = "triangle";
      const now = ctx.currentTime + t;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(vol, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      o.start(now); o.stop(now + dur);
    });
    // shimmer layer
    setTimeout(() => {
      try {
        [1200, 1600, 2000].forEach((freq, i) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = freq; o.type = "sine";
          const now = ctx.currentTime + i * 0.06;
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(0.04, now + 0.03);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          o.start(now); o.stop(now + 0.4);
        });
      } catch {}
    }, 400);
  } catch {}
}

function playMoodClick() {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 700; o.type = "sine";
    g.gain.setValueAtTime(0.07, ctx.currentTime);
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
  const colors = ["#7c6af7", "#9d8fff", "#ffffff", "#c4b9ff", "#5b4de0"];
  const pieces = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width, y: -10,
    w: 4 + Math.random() * 8, h: 8 + Math.random() * 8,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * 360, rotV: (Math.random() - 0.5) * 7,
    vx: (Math.random() - 0.5) * 5, vy: 3 + Math.random() * 5, alpha: 1,
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y); ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      p.x += p.vx; p.y += p.vy; p.rot += p.rotV; p.vy += 0.1;
      if (frame > 50) p.alpha = Math.max(0, p.alpha - 0.015);
    });
    frame++;
    if (frame < 200) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

// ── Countdown ─────────────────────────────────────────────
function getTimeUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { h, m, s };
}

// ── Main component ────────────────────────────────────────
export function TodayView({ userId, userEmail, todayEntry, todayTasks: initialTasks, allEntries, allHistoryTasks, weekTheme: initialWeekTheme, notificationTime: initialNotifTime, pushSubscription }: Props) {
  const supabase = createClient();
  const [tab, setTab] = useState<"today" | "insights">("today");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [mood, setMood] = useState<number | null>(todayEntry.mood);
  const [weekTheme, setWeekTheme] = useState(initialWeekTheme || "");
  const [notifTime, setNotifTime] = useState(initialNotifTime);
  const [pushEnabled, setPushEnabled] = useState(!!pushSubscription);
  const [showSettings, setShowSettings] = useState(false);
  const [countdown, setCountdown] = useState(getTimeUntilMidnight());
  const celebratedRef = useRef(isEntryComplete(initialTasks));

  const tasksByEntry: Record<string, Task[]> = {};
  allHistoryTasks.forEach((t) => { if (!tasksByEntry[t.entry_id]) tasksByEntry[t.entry_id] = []; tasksByEntry[t.entry_id].push(t); });
  tasksByEntry[todayEntry.id] = tasks;

  const streak = calcStreak(allEntries, tasksByEntry);
  const totalDays = calcTotalDays(allEntries, tasksByEntry);
  const doneCnt = tasks.filter((t) => t.done).length;
  const allDone = isEntryComplete(tasks);

  const dateObj = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const qi = Math.abs(dateObj.getDate() + dateObj.getMonth() * 31) % QUOTES.length;
  const quote = QUOTES[qi];

  // Countdown timer
  useEffect(() => {
    if (!allDone) return;
    const timer = setInterval(() => setCountdown(getTimeUntilMidnight()), 1000);
    return () => clearInterval(timer);
  }, [allDone]);

  // Celebration trigger
  useEffect(() => {
    if (allDone && !celebratedRef.current) {
      celebratedRef.current = true;
      setTimeout(() => { playFanfare(); launchConfetti(); }, 200);
    }
    if (!allDone) celebratedRef.current = false;
  }, [allDone]);

  const updateTask = useCallback(async (taskId: string, field: "text" | "done", value: string | boolean) => {
    setTasks((prev) => {
      const updated = prev.map((t) => t.id === taskId ? { ...t, [field]: value } : t);
      if (isEntryComplete(updated)) {
        supabase.from("daily_entries").update({ completed_at: new Date().toISOString() }).eq("id", todayEntry.id);
      }
      return updated;
    });
    await supabase.from("tasks").update({ [field]: value }).eq("id", taskId);
  }, [supabase, todayEntry.id]);

  const handleCheck = (task: Task, idx: number) => {
    if (!task.text.trim() || allDone) return;
    const checking = !task.done;
    if (checking) playTick(idx); else playUncheck();
    updateTask(task.id, "done", checking);
  };

  const handleMood = async (m: number) => {
    playMoodClick();
    const next = mood === m ? null : m;
    setMood(next);
    await supabase.from("daily_entries").update({ mood: next }).eq("id", todayEntry.id);
  };

  const handleThemeSave = async () => {
    await supabase.from("profiles").update({ weekly_theme: weekTheme, weekly_theme_set_at: getWeekKey() }).eq("id", userId);
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

  const handleSignOut = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };

  return (
    <>
      <canvas id="confetti-canvas" />
      <div className={styles.shell}>
        {tab === "today" ? (
          <div className={styles.scrollArea}>
            {/* Header */}
            <header className={styles.header}>
              <div className="o3-logo">O<span>3</span></div>
              <div className={styles.headerRight}>
                <span className={styles.dateLabel}>{dayNames[dateObj.getDay()]}, {monthNames[dateObj.getMonth()]} {dateObj.getDate()}</span>
                <button className={styles.settingsBtn} onClick={() => setShowSettings(!showSettings)} aria-label="Settings">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </button>
              </div>
            </header>

            {/* Settings */}
            {showSettings && (
              <div className={`card ${styles.settingsPanel}`}>
                <div className={styles.settingsRow}><span className={styles.settingsLabel}>Signed in as</span><span className={styles.settingsValue}>{userEmail}</span></div>
                <div className={styles.settingsRow}><span className={styles.settingsLabel}>Daily reminder</span><input type="time" value={notifTime} onChange={(e) => handleNotifTime(e.target.value)} className={styles.timeInput} /></div>
                <div className={styles.settingsRow}><span className={styles.settingsLabel}>Notifications</span><button className={`${styles.toggleBtn} ${pushEnabled ? styles.toggleOn : ""}`} onClick={handleTogglePush}>{pushEnabled ? "On" : "Off"}</button></div>
                <button className={styles.signOutBtn} onClick={handleSignOut}>Sign out</button>
              </div>
            )}

            {/* Rest mode OR normal view */}
            {allDone ? (
              <div className={styles.restMode}>
                <div className={styles.restLogo}>O<span>3</span></div>
                <div className={styles.restTitle}>{CEL_MSGS[dateObj.getDate() % CEL_MSGS.length].split(".")[0]}.</div>
                <p className={styles.restMsg}>Three tasks. Done. That&apos;s all it takes to move forward.</p>
                <div className={styles.countdown}>
                  <div className={styles.countUnit}><span className={styles.countNum}>{String(countdown.h).padStart(2,"0")}</span><span className={styles.countLabel}>hrs</span></div>
                  <span className={styles.countSep}>:</span>
                  <div className={styles.countUnit}><span className={styles.countNum}>{String(countdown.m).padStart(2,"0")}</span><span className={styles.countLabel}>min</span></div>
                  <span className={styles.countSep}>:</span>
                  <div className={styles.countUnit}><span className={styles.countNum}>{String(countdown.s).padStart(2,"0")}</span><span className={styles.countLabel}>sec</span></div>
                </div>
              </div>
            ) : (
              <>
                <div className={`card ${styles.quoteCard}`}>
                  <p className={styles.quoteText}>&ldquo;{quote.q}&rdquo;</p>
                  <p className={styles.quoteAuthor}>— {quote.a}</p>
                </div>
                <div className={`card ${styles.themeCard}`}>
                  <div className={styles.themeDot} />
                  <span className="label" style={{ flexShrink: 0 }}>This week</span>
                  <input className={styles.themeInput} placeholder="your intention..." value={weekTheme} maxLength={40} onChange={(e) => setWeekTheme(e.target.value)} onBlur={handleThemeSave} onKeyDown={(e) => e.key === "Enter" && handleThemeSave()} />
                </div>
              </>
            )}

            {/* Stats */}
            <div className={styles.statsRow}>
              <div className="card" style={{ textAlign: "center" }}>
                <div className={`${styles.statVal} ${styles.statAccent}`}>{streak}🔥</div>
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

            {/* Tasks */}
            <div className={`card ${styles.tasksCard}`}>
              <p className="label" style={{ marginBottom: "0.75rem" }}>today&rsquo;s three</p>
              {tasks.map((task, i) => (
                <div key={task.id} className={styles.taskRow}>
                  <span className={styles.taskNum}>{i + 1}</span>
                  <button className={`${styles.checkBtn} ${task.done ? styles.checkDone : ""}`} onClick={() => handleCheck(task, i)} aria-label={`Task ${i + 1}`}>
                    {task.done && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3" /></svg>}
                  </button>
                  <input
                    className={`${styles.taskInput} ${task.done ? styles.taskDone : ""} ${allDone ? styles.taskReadonly : ""}`}
                    placeholder={allDone ? "" : `task ${i + 1}...`}
                    value={task.text} maxLength={80} readOnly={allDone}
                    onChange={(e) => updateTask(task.id, "text", e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && i < 2) { const inputs = document.querySelectorAll<HTMLInputElement>(`.${styles.taskInput}`); inputs[i + 1]?.focus(); } }}
                  />
                </div>
              ))}
              <div className={styles.progressWrap}><div className={styles.progressBar} style={{ width: `${(doneCnt / 3) * 100}%` }} /></div>
              <p className={styles.progressLbl}>{doneCnt} of 3</p>
            </div>

            {/* Mood */}
            <div className={`card ${styles.moodCard}`}>
              <p className="label" style={{ marginBottom: "0.6rem" }}>How&rsquo;s today feeling?</p>
              <div className={styles.moodRow}>
                {["😤", "😐", "🙂", "😄", "🔥"].map((em, m) => (
                  <button key={m} className={`${styles.moodBtn} ${mood === m ? styles.moodSelected : ""}`} onClick={() => handleMood(m)}>{em}</button>
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
                    <div className={styles.mText}><p className={styles.mName}>{m.name}</p><p className={styles.mDesc}>{m.desc}</p></div>
                    <span className={`${styles.mBadge} ${unlocked ? styles.mBadgeUnlocked : ""}`}>{unlocked ? "✓" : "locked"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <InsightsView allEntries={allEntries} allHistoryTasks={allHistoryTasks} currentTasks={tasks} streak={streak} totalDays={totalDays} />
        )}

        {/* Bottom nav */}
        <nav className={styles.bottomNav}>
          <button className={`${styles.navBtn} ${tab === "today" ? styles.active : ""}`} onClick={() => setTab("today")}>
            <span className={styles.navIcon}>◎</span>today
          </button>
          <button className={`${styles.navBtn} ${tab === "insights" ? styles.active : ""}`} onClick={() => setTab("insights")}>
            <span className={styles.navIcon}>◈</span>insights
          </button>
        </nav>
      </div>
    </>
  );
}

function CalendarGrid({ allEntries, tasksByEntry }: { allEntries: Entry[]; tasksByEntry: Record<string, Task[]> }) {
  const today = toDateStr(new Date());
  const d = new Date();
  const year = d.getFullYear(), month = d.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  return (
    <div className={styles.calGrid}>
      {["S","M","T","W","T","F","S"].map((l, i) => <div key={i} className={styles.calLabel}>{l}</div>)}
      {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
      {Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const key = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
        const entry = allEntries.find((e) => e.date === key);
        const tasks = entry ? (tasksByEntry[entry.id] || []) : [];
        const full = entry && isEntryComplete(tasks);
        const partial = entry && tasks.some((t) => t.done);
        return <div key={key} className={`${styles.calDay} ${full ? styles.calFull : partial ? styles.calPartial : styles.calEmpty} ${key === today ? styles.calToday : ""}`} title={key} />;
      })}
    </div>
  );
}
