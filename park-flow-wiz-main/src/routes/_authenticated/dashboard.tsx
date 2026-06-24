import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtINR } from "@/lib/parking";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ParkSmart" }] }),
  component: Dashboard,
});

function Dashboard() {
  const [stats, setStats] = useState({ total: 0, available: 0, occupied: 0, vehicles: 0, revenue: 0 });
  const [updated, setUpdated] = useState(new Date());

  const load = async () => {
    const [slots, vehicles, records] = await Promise.all([
      supabase.from("parking_slots").select("status"),
      supabase.from("vehicles").select("id", { count: "exact", head: true }),
      supabase.from("parking_records").select("amount_charged").eq("payment_status", "PAID"),
    ]);
    const all = slots.data || [];
    const revenue = (records.data || []).reduce((s, r) => s + Number(r.amount_charged || 0), 0);
    setStats({
      total: all.length,
      available: all.filter((s) => s.status === "AVAILABLE").length,
      occupied: all.filter((s) => s.status === "OCCUPIED").length,
      vehicles: vehicles.count || 0,
      revenue,
    });
    setUpdated(new Date());
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  const occPct = stats.total ? Math.round((stats.occupied / stats.total) * 100) : 0;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">Last updated {updated.toLocaleTimeString()}</p>
      </div>
      <div className="stat-grid">
        <Stat label="Total Slots" value={stats.total} icon="🅿️" />
        <Stat label="Available" value={stats.available} icon="✅" cls="green" />
        <Stat label="Occupied" value={stats.occupied} icon="🚗" cls="red" />
        <Stat label="Total Vehicles" value={stats.vehicles} icon="🚙" cls="yellow" />
        <Stat label="Revenue" value={fmtINR(stats.revenue)} icon="💰" cls="purple" />
      </div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
          <span style={{ color: "var(--muted)" }}>Occupancy</span>
          <strong>{occPct}%</strong>
        </div>
        <div className="progress"><div style={{ width: `${occPct}%` }} /></div>
      </div>
      <div className="quick-grid">
        <Link to="/slots" className="quick-card"><h3>🅿️ Manage Slots</h3><p>Add, edit and monitor parking slots</p></Link>
        <Link to="/vehicles" className="quick-card"><h3>🚗 Vehicles</h3><p>Register and park vehicles</p></Link>
        <Link to="/active" className="quick-card"><h3>⏱️ Active Sessions</h3><p>Track parked vehicles in real time</p></Link>
      </div>
    </>
  );
}

function Stat({ label, value, icon, cls = "" }: { label: string; value: any; icon: string; cls?: string }) {
  return (
    <div className={`stat-card ${cls}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-icon">{icon}</div>
    </div>
  );
}
