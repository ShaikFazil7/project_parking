import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtINR, slotCellClass, slotStatusClass, type ParkingSlot, type SlotStatus, type SlotType } from "@/lib/parking";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/slots")({
  head: () => ({ meta: [{ title: "Slots — ParkSmart" }] }),
  component: SlotsPage,
});

const SLOT_TYPES: SlotType[] = ["COMPACT", "STANDARD", "LARGE", "HANDICAPPED", "EV_CHARGING"];
const STATUSES: SlotStatus[] = ["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"];

function SlotsPage() {
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("ALL");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [editing, setEditing] = useState<Partial<ParkingSlot> | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from("parking_slots").select("*").order("slot_number");
    if (error) { toast.error(error.message); return; }
    setSlots((data || []) as ParkingSlot[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = slots.filter((s) =>
    (filter === "ALL" || s.status === filter) &&
    (s.slot_number.toLowerCase().includes(search.toLowerCase()) || s.section.toLowerCase().includes(search.toLowerCase()))
  );

  const stats = {
    total: slots.length,
    available: slots.filter((s) => s.status === "AVAILABLE").length,
    occupied: slots.filter((s) => s.status === "OCCUPIED").length,
    other: slots.filter((s) => s.status !== "AVAILABLE" && s.status !== "OCCUPIED").length,
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.slot_number) { toast.error("Slot number required"); return; }
    const payload = {
      slot_number: editing.slot_number,
      slot_type: editing.slot_type ?? "STANDARD",
      status: editing.status ?? "AVAILABLE",
      floor_number: Number(editing.floor_number ?? 1),
      section: editing.section ?? "A",
      hourly_rate: Number(editing.hourly_rate ?? 50),
    };
    const { error } = editing.id
      ? await supabase.from("parking_slots").update(payload).eq("id", editing.id)
      : await supabase.from("parking_slots").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Slot saved");
    setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this slot?")) return;
    const { error } = await supabase.from("parking_slots").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  return (
    <>
      <div className="page-header"><h1 className="page-title">Parking Slots</h1></div>
      <div className="stat-grid">
        <MiniStat label="Total" value={stats.total} />
        <MiniStat label="Available" value={stats.available} cls="green" />
        <MiniStat label="Occupied" value={stats.occupied} cls="red" />
        <MiniStat label="Other" value={stats.other} cls="yellow" />
      </div>
      <div className="topbar">
        <div className="topbar-left">
          <input className="input search" placeholder="Search slot…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 180 }}>
            <option value="ALL">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="view-toggle">
            <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>Grid</button>
            <button className={view === "table" ? "active" : ""} onClick={() => setView("table")}>Table</button>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})}>+ Add Slot</button>
      </div>

      {view === "grid" ? (
        <div className="slot-grid">
          {filtered.map((s) => (
            <div key={s.id} className={`slot-cell ${slotCellClass(s.status)}`} onClick={() => setEditing(s)}>
              <div className="slot-num">{s.slot_number}</div>
              <div className="slot-meta">{s.slot_type} · F{s.floor_number}{s.section}</div>
              <span className={slotStatusClass(s.status)}>{s.status}</span>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty" style={{ gridColumn: "1/-1" }}>No slots</div>}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Slot</th><th>Type</th><th>Floor</th><th>Section</th><th>Rate</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.slot_number}</strong></td>
                  <td>{s.slot_type}</td><td>{s.floor_number}</td><td>{s.section}</td>
                  <td>{fmtINR(s.hourly_rate)}</td>
                  <td><span className={slotStatusClass(s.status)}>{s.status}</span></td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => setEditing(s)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(s.id)}>Del</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="empty">No slots</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal">
            <h2>{editing.id ? "Edit Slot" : "Add Slot"}</h2>
            <div className="form-grid">
              <div className="form-group"><label>Slot Number</label>
                <input className="input" value={editing.slot_number || ""} onChange={(e) => setEditing({ ...editing, slot_number: e.target.value })} />
              </div>
              <div className="form-group"><label>Floor</label>
                <input className="input" type="number" value={editing.floor_number ?? 1} onChange={(e) => setEditing({ ...editing, floor_number: Number(e.target.value) })} />
              </div>
              <div className="form-group"><label>Type</label>
                <select className="input" value={editing.slot_type || "STANDARD"} onChange={(e) => setEditing({ ...editing, slot_type: e.target.value as SlotType })}>
                  {SLOT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Section</label>
                <input className="input" value={editing.section || "A"} onChange={(e) => setEditing({ ...editing, section: e.target.value })} />
              </div>
              <div className="form-group"><label>Hourly Rate (₹)</label>
                <input className="input" type="number" value={editing.hourly_rate ?? 50} onChange={(e) => setEditing({ ...editing, hourly_rate: Number(e.target.value) })} />
              </div>
              <div className="form-group"><label>Status</label>
                <select className="input" value={editing.status || "AVAILABLE"} onChange={(e) => setEditing({ ...editing, status: e.target.value as SlotStatus })}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MiniStat({ label, value, cls = "" }: { label: string; value: any; cls?: string }) {
  return <div className={`stat-card ${cls}`}><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div>;
}
