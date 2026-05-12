import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createServerSupabaseClient } from "@/lib/supabase-server";

webpush.setVapidDetails(
  "mailto:" + process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// POST /api/push — save subscription
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscription } = await req.json();
  await supabase.from("profiles").update({ push_subscription: subscription }).eq("id", user.id);
  return NextResponse.json({ ok: true });
}

// DELETE /api/push — remove subscription
export async function DELETE() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await supabase.from("profiles").update({ push_subscription: null }).eq("id", user.id);
  return NextResponse.json({ ok: true });
}
