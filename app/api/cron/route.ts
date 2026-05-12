import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

webpush.setVapidDetails(
  "mailto:" + process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Vercel cron calls this every hour; we filter by notification_time
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get current UTC hour:minute — simplified; for per-timezone this would need TZ stored on profile
  const now = new Date();
  const hhmm = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, push_subscription, notification_time")
    .eq("notification_time", hhmm)
    .not("push_subscription", "is", null);

if (!profiles || profiles.length === 0) return NextResponse.json({ sent: 0 });

  const payload = JSON.stringify({
    title: "Only3 — time to plan your day",
    body: "What are your 3 tasks for today?",
    url: "/",
  });

  let sent = 0;
  await Promise.allSettled(
    profiles.map(async (p) => {
      try {
        await webpush.sendNotification(p.push_subscription as webpush.PushSubscription, payload);
        sent++;
      } catch (e: unknown) {
        // Subscription expired — clean up
        if ((e as { statusCode?: number }).statusCode === 410) {
          await supabase.from("profiles").update({ push_subscription: null }).eq("id", p.id);
        }
      }
    })
  );

  return NextResponse.json({ sent });
}
