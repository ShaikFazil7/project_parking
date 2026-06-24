import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  checkoutVehicle, fmtINR, parkVehicle, vehicleTypeBadge,
  type ParkingSlot, type Vehicle, type VehicleType,
} from "@/lib/parking";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vehicles")({
  head: () => ({ meta: [{ title: "Vehicles — ParkSmart" }] }),
  component: VehiclesPage,
});

const V_TYPES: VehicleType[] = ["CAR", "MOTORCYCLE", "SUV", "TRUCK", "VAN", "EV"];

function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PARKED" | "FREE">("ALL");
  const [editing, setEditing] = useState<Partial<Vehicle> | null>(null);
  const [parking, setParking] = useState<{ vehicle: Vehicle; slotId: string } | null>(null);

  const load = async () => {
    const [v, s] = await Promise.all([
      supabase.from("vehicles").select("*").order("registered_at", { ascending: false }),
      supabase.from("parking_slots").select("*").order("slot_number"),
    ]);
    setVehicles((v.data || []) as Vehicle[]);
    setSlots((s.data || []) as ParkingSlot[]);
  };
  useEffect(() => { load(); }, []);

  const slotById = (id: string | null) => slots.find((s) => s.id === id);
  const filtered = vehicles.filter((v) => {
    if (filter === "PARKED" && !v.is_parked) return false;
    if (filter === "FREE" && v.is_parked) return false;
    const q = search.toLowerCase();
    return !q || v.license_plate.toLowerCase().includes(q) || v.owner_name.toLowerCase().includes(q);
  });

  const stats = {
    total: vehicles.length,
    parked: vehicles.filter((v) => v.is_parked).length,
    free: vehicles.filter((v) => !v.is_parked).length,
  };

  const save = async () => {
    if (!editing?.license_plate || !editing.owner_name) { toast.error("License plate & owner required"); return; }
    const payload: any = {
      license_plate: editing.license_plate.toUpperCase(),
      owner_name: editing.owner_name, owner_phone: editing.owner_phone || null,
      owner_email: editing.owner_email || null, vehicle_type: editing.vehicle_type || "CAR",
      vehicle_make: editing.vehicle_make || null, vehicle_model: editing.vehicle_model || null,
      vehicle_color: editing.vehicle_color || null,
    };
    const { error } = editing.id
      ? await supabase.from("vehicles").update(payload).eq("id", editing.id)
      : await supabase.from("vehicles").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Vehicle saved");
    setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete vehicle?")) return;
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  const doPark = async () => {
    if (!parking || !parking.slotId) { toast.error("Pick a slot"); return; }
    try {
      await parkVehicle(parking.vehicle.id, parking.slotId);
      toast.success("Vehicle parked");
      setParking(null); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const doCheckout = async (v: Vehicle) => {
    if (!confirm(`Checkout ${v.license_plate}?`)) return;
    try {
      const r = await checkoutVehicle(v.id);
      toast.success(`Checked out · ${r.duration} · ${fmtINR(r.amount)}`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const availableSlots = slots.filter((s) => s.status === "AVAILABLE");

  return (
    <>
      <div className="page-header"><h1 className="page-title">Vehicles</h1></div>
      <div className="stat-grid">
        <MiniStat label="Total" value={stats.total} />
        <MiniStat label="Parked" value={stats.parked} cls="red" />
        <MiniStat label="Free" value={stats.free} cls="green" />
      </div>
      <div className="topbar">
        <div className="topbar-left">
          <input className="input search" placeholder="Search plate or owner…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input" value={filter} onChange={(e) => setFilter(e.target.value as any)} style={{ width: 160 }}>
            <option value="ALL">All</option><option value="PARKED">Parked</option><option value="FREE">Free</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})}>+ Register Vehicle</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>Plate</th><th>Owner</th><th>Phone</th><th>Type</th><th>Vehicle</th><th>Status</th><th>Slot</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map((v) => {
              const slot = slotById(v.current_slot_id);
              return (
                <tr key={v.id}>
                  <td style={{ fontFamily: "ui-monospace", fontWeight: 700 }}>{v.license_plate}</td>
                  <td><div>{v.owner_name}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{v.owner_email || "—"}</div></td>
                  <td>{v.owner_phone || "—"}</td>
                  <td><span className={vehicleTypeBadge(v.vehicle_type)}>{v.vehicle_type}</span></td>
                  <td style={{ fontSize: 12 }}>{[v.vehicle_make, v.vehicle_model, v.vehicle_color].filter(Boolean).join(" · ") || "—"}</td>
                  <td><span className={`badge ${v.is_parked ? "badge-red" : "badge-green"}`}>{v.is_parked ? "Parked" : "Available"}</span></td>
                  <td>{slot ? <span className="badge badge-blue">{slot.slot_number}</span> : "—"}</td>
                  <td style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {v.is_parked
                      ? <button className="btn btn-sm btn-warning" onClick={() => doCheckout(v)}>Checkout</button>
                      : <button className="btn btn-sm btn-success" onClick={() => setParking({ vehicle: v, slotId: "" })}>Park</button>}
                    <button className="btn btn-sm" onClick={() => setEditing(v)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(v.id)}>Del</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={8} className="empty">No vehicles</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal">
            <h2>{editing.id ? "Edit Vehicle" : "Register Vehicle"}</h2>
            <div className="form-grid">
              <div className="form-group full"><label>License Plate</label>
                <input className="input" style={{ textTransform: "uppercase" }} value={editing.license_plate || ""} onChange={(e) => setEditing({ ...editing, license_plate: e.target.value })} />
              </div>
              <div className="form-group"><label>Owner Name</label>
                <input className="input" value={editing.owner_name || ""} onChange={(e) => setEditing({ ...editing, owner_name: e.target.value })} />
              </div>
              <div className="form-group"><label>Phone</label>
                <input className="input" value={editing.owner_phone || ""} onChange={(e) => setEditing({ ...editing, owner_phone: e.target.value })} />
              </div>
              <div className="form-group full"><label>Email</label>
                <input className="input" type="email" value={editing.owner_email || ""} onChange={(e) => setEditing({ ...editing, owner_email: e.target.value })} />
              </div>
              <div className="form-group"><label>Type</label>
                <select className="input" value={editing.vehicle_type || "CAR"} onChange={(e) => setEditing({ ...editing, vehicle_type: e.target.value as VehicleType })}>
                  {V_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Color</label>
                <input className="input" value={editing.vehicle_color || ""} onChange={(e) => setEditing({ ...editing, vehicle_color: e.target.value })} />
              </div>
              <div className="form-group"><label>Make</label>
                <input className="input" value={editing.vehicle_make || ""} onChange={(e) => setEditing({ ...editing, vehicle_make: e.target.value })} />
              </div>
              <div className="form-group"><label>Model</label>
                <input className="input" value={editing.vehicle_model || ""} onChange={(e) => setEditing({ ...editing, vehicle_model: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}

      {parking && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setParking(null)}>
          <div className="modal">
            <h2>Park {parking.vehicle.license_plate}</h2>
            <div className="form-group"><label>Select an available slot</label>
              <select className="input" value={parking.slotId} onChange={(e) => setParking({ ...parking, slotId: e.target.value })}>
                <option value="">— choose —</option>
                {availableSlots.map((s) => (
                  <option key={s.id} value={s.id}>{s.slot_number} · {s.slot_type} · {fmtINR(s.hourly_rate)}/hr</option>
                ))}
              </select>
            </div>
            {availableSlots.length === 0 && <p style={{ color: "var(--yellow)", fontSize: 12 }}>No available slots.</p>}
            <div className="modal-footer">
              <button className="btn" onClick={() => setParking(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={doPark}>Park Now</button>
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
