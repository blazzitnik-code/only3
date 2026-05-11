import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase";
import { toDateStr, getWeekKey } from "@/lib/utils";
import { TodayView } from "@/components/TodayView";

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = toDateStr(new Date());
  const weekKey = getWeekKey();

  // Ensure profile exists
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    await supabase.from("profiles").insert({ id: user.id, notification_time: "08:00" });
  }

  // Get or create today's entry
  let { data: entry } = await supabase
    .from("daily_entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", today)
    .single();

  if (!entry) {
    const { data: newEntry } = await supabase
      .from("daily_entries")
      .insert({ user_id: user.id, date: today })
      .select()
      .single();
    entry = newEntry;
  }

  // Get tasks for today
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("entry_id", entry!.id)
    .order("position");

  // Ensure 3 task rows exist
  const existingPositions = (tasks || []).map((t) => t.position);
  const missing = [1, 2, 3].filter((p) => !existingPositions.includes(p));
  if (missing.length > 0) {
    await supabase.from("tasks").insert(
      missing.map((p) => ({ entry_id: entry!.id, user_id: user.id, position: p, text: "", done: false }))
    );
  }

  const { data: allTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("entry_id", entry!.id)
    .order("position");

  // Get all entries + tasks for streak/calendar
  const { data: allEntries } = await supabase
    .from("daily_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  const entryIds = (allEntries || []).map((e) => e.id);
  const { data: allHistoryTasks } = entryIds.length
    ? await supabase.from("tasks").select("*").in("entry_id", entryIds)
    : { data: [] };

  // Weekly theme
  const weekTheme = profile?.weekly_theme_set_at?.startsWith(weekKey)
    ? profile?.weekly_theme
    : null;

  return (
    <TodayView
      userId={user.id}
      userEmail={user.email!}
      todayEntry={entry!}
      todayTasks={allTasks || []}
      allEntries={allEntries || []}
      allHistoryTasks={allHistoryTasks || []}
      weekTheme={weekTheme}
      notificationTime={profile?.notification_time || "08:00"}
      pushSubscription={profile?.push_subscription}
    />
  );
}
