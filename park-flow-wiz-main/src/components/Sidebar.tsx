import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: "📊", section: "Overview" },
  { to: "/slots", label: "Parking Slots", icon: "🅿️", section: "Parking" },
  { to: "/vehicles", label: "Vehicles", icon: "🚗", section: "Parking" },
  { to: "/active", label: "Active Sessions", icon: "⏱️", section: "Parking" },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState("Admin");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  };

  const sections = ["Overview", "Parking"];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">🅿️</div>
        <div>
          <div className="brand-name">ParkSmart</div>
          <div className="brand-sub">Admin Console</div>
        </div>
      </div>
      {sections.map((sec) => (
        <div className="nav-section" key={sec}>
          <div className="nav-label">{sec}</div>
          {links.filter((l) => l.section === sec).map((l) => (
            <Link key={l.to} to={l.to} className={`nav-item ${pathname === l.to ? "active" : ""}`}>
              <span>{l.icon}</span>
              <span>{l.label}</span>
            </Link>
          ))}
        </div>
      ))}
      <div className="sidebar-footer">
        <div className="admin-info">
          <div className="admin-avatar">{email[0]?.toUpperCase()}</div>
          <div>
            <div className="admin-name" style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
            <div className="admin-role">Administrator</div>
          </div>
        </div>
        <button className="logout-btn" onClick={logout}>Sign Out</button>
      </div>
    </aside>
  );
}
