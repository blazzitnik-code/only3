import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { LoginButton } from "@/components/LoginButton";

export default async function LoginPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      gap: "2rem",
    }}>
      <div style={{ textAlign: "center" }}>
        <div className="o3-logo" style={{ fontSize: 42, marginBottom: "0.5rem" }}>
          O<span>3</span>
        </div>
        <p style={{ color: "var(--text-2)", fontSize: 15, lineHeight: 1.6 }}>
          Three tasks a day.<br />That&apos;s it.
        </p>
      </div>
      <LoginButton />
      <p style={{ color: "var(--text-3)", fontSize: 12, textAlign: "center", maxWidth: 240 }}>
        Based on the idea that three focused tasks<br />beats a hundred scattered ones.
      </p>
    </div>
  );
}
