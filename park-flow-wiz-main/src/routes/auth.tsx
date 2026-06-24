import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — ParkSmart" }] }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/dashboard" });
    });
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;
      }
      toast.success("Welcome to ParkSmart");
      router.navigate({ to: "/dashboard" });
    } catch (e: any) {
      setErr(e.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", position: "relative", overflow: "hidden" }}>
      <div className="bg-grid" />
      <div className="glow-orb cyan" />
      <div className="glow-orb blue" />
      <div className="card" style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div className="brand-icon" style={{ margin: "0 auto 12px", width: 56, height: 56, fontSize: 28 }}>🅿️</div>
          <h1 style={{ margin: 0, fontSize: 24 }}>ParkSmart</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Smart Parking Management</p>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
          </div>
          {err && <div style={{ color: "var(--red)", fontSize: 12 }}>{err}</div>}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: "center", padding: "11px" }}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
          <button type="button" className="btn" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(""); }} style={{ justifyContent: "center" }}>
            {mode === "signin" ? "Need an admin account? Create one" : "Already have an account? Sign in"}
          </button>
          <p style={{ color: "var(--muted)", fontSize: 11, textAlign: "center", margin: "8px 0 0" }}>
            New accounts are automatically granted admin access.
          </p>
        </form>
      </div>
    </div>
  );
}
