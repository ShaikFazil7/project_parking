import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  checkoutVehicle, estimateFee, fmtDate, fmtINR, liveDuration, vehicleTypeBadge,
  type ParkingSlot, type Vehicle,
} from "@/lib/parking";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/active")({
  head: () => ({ meta: [{ title: "Active Sessions — ParkSmart" }] }),
  component: ActivePage,
});

function ActivePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [, setTick] = useState(0);

  const load = async () => {
    const [v, s] = await Promise.all([
      supabase.from("vehicles").select("*").eq("is_parked", true),
      supabase.from("parking_slots").select("*"),
    ]);
    setVehicles((v.data || []) as Vehicle[]);
    setSlots((s.data || []) as ParkingSlot[]);
  };

  useEffect(() => {
    load();
    const refresh = setInterval(load, 60000);
    const tick = setInterval(() => setTick((t) => t + 1), 30000);
    return () => { clearInterval(refresh); clearInterval(tick); };
  }, []);

  const slotFor = (id: string | null) => slots.find((s) => s.id === id);

  const doCheckout = async (v: Vehicle) => {
    if (!confirm(`Checkout ${v.license_plate}?`)) return;
    try {
      const r = await checkoutVehicle(v.id);
      toast.success(`${v.license_plate} · ${r.duration} · ${fmtINR(r.amount)}`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><h1 className="page-title">Active Sessions</h1><p className="page-sub">{vehicles.length} vehicles currently parked</p></div>
        <button className="btn" onClick={load}>↻ Refresh</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>Plate</th><th>Owner</th><th>Slot</th><th>Type</th><th>Entry</th><th>Duration</th><th>Est. Fee</th><th></th>
          </tr></thead>
          <tbody>
            {vehicles.map((v) => {
              const slot = slotFor(v.current_slot_id);
              const fee = estimateFee(v.entry_time, slot?.hourly_rate || 0);
              return (
                <tr key={v.id}>
                  <td style={{ fontFamily: "ui-monospace", fontWeight: 700 }}>{v.license_plate}</td>
                  <td><div>{v.owner_name}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{v.owner_phone || ""}</div></td>
                  <td>{slot ? <span className="badge badge-blue">{slot.slot_number}</span> : "—"}</td>
                  <td><span className={vehicleTypeBadge(v.vehicle_type)}>{v.vehicle_type}</span></td>
                  <td style={{ fontSize: 12 }}>{fmtDate(v.entry_time)}</td>
                  <td style={{ color: "var(--yellow)", fontWeight: 700 }}>{liveDuration(v.entry_time)}</td>
                  <td style={{ color: "var(--green)", fontWeight: 700 }}>{fmtINR(fee)}</td>
                  <td><button className="btn btn-sm btn-warning" onClick={() => doCheckout(v)}>Checkout</button></td>
                </tr>
              );
            })}
            {vehicles.length === 0 && <tr><td colSpan={8} className="empty">No active sessions</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
