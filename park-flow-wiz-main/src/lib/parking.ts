import { supabase } from "@/integrations/supabase/client";

export type SlotType = "COMPACT" | "STANDARD" | "LARGE" | "HANDICAPPED" | "EV_CHARGING";
export type SlotStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";
export type VehicleType = "CAR" | "MOTORCYCLE" | "SUV" | "TRUCK" | "VAN" | "EV";

export interface ParkingSlot {
  id: string;
  slot_number: string;
  slot_type: SlotType;
  status: SlotStatus;
  floor_number: number;
  section: string;
  hourly_rate: number;
}

export interface Vehicle {
  id: string;
  license_plate: string;
  owner_name: string;
  owner_phone: string | null;
  owner_email: string | null;
  vehicle_type: VehicleType;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  current_slot_id: string | null;
  entry_time: string | null;
  is_parked: boolean;
}

export const fmtINR = (n: number) => `₹${Number(n).toFixed(2)}`;
export const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const slotStatusClass = (s: SlotStatus) => {
  return {
    AVAILABLE: "badge badge-green",
    OCCUPIED: "badge badge-red",
    RESERVED: "badge badge-yellow",
    MAINTENANCE: "badge badge-purple",
  }[s];
};

export const slotCellClass = (s: SlotStatus) =>
  ({ AVAILABLE: "available", OCCUPIED: "occupied", RESERVED: "reserved", MAINTENANCE: "maintenance" }[s]);

export const vehicleTypeBadge = (t: VehicleType) => {
  const m: Record<VehicleType, string> = {
    CAR: "badge-blue", SUV: "badge-purple", MOTORCYCLE: "badge-yellow",
    TRUCK: "badge-red", VAN: "badge-blue", EV: "badge-green",
  };
  return `badge ${m[t]}`;
};

export async function parkVehicle(vehicleId: string, slotId: string) {
  const now = new Date().toISOString();
  const { error: e1 } = await supabase.from("parking_slots").update({ status: "OCCUPIED" }).eq("id", slotId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("vehicles").update({
    current_slot_id: slotId, entry_time: now, is_parked: true,
  }).eq("id", vehicleId);
  if (e2) throw e2;
  await supabase.from("parking_records").insert({ vehicle_id: vehicleId, slot_id: slotId, entry_time: now });
}

export async function checkoutVehicle(vehicleId: string): Promise<{ duration: string; amount: number }> {
  const { data: v, error } = await supabase.from("vehicles").select("*, parking_slots:current_slot_id(hourly_rate)").eq("id", vehicleId).single();
  if (error || !v) throw error || new Error("Vehicle not found");
  if (!v.is_parked || !v.entry_time || !v.current_slot_id) throw new Error("Vehicle is not parked");
  const rate = Number((v as any).parking_slots?.hourly_rate ?? 0);
  const entry = new Date(v.entry_time).getTime();
  const exit = Date.now();
  const minutes = Math.max(30, Math.round((exit - entry) / 60000));
  const hours = minutes / 60;
  const amount = +(hours * rate).toFixed(2);

  await supabase.from("parking_slots").update({ status: "AVAILABLE" }).eq("id", v.current_slot_id);
  await supabase.from("vehicles").update({ current_slot_id: null, entry_time: null, is_parked: false }).eq("id", vehicleId);
  const { data: rec } = await supabase.from("parking_records")
    .select("id").eq("vehicle_id", vehicleId).is("exit_time", null).order("entry_time", { ascending: false }).limit(1).maybeSingle();
  if (rec) {
    await supabase.from("parking_records").update({
      exit_time: new Date(exit).toISOString(), duration_hours: +hours.toFixed(2),
      amount_charged: amount, payment_status: "PAID",
    }).eq("id", rec.id);
  }
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return { duration: `${h}h ${m}m`, amount };
}

export function liveDuration(entry: string | null): string {
  if (!entry) return "—";
  const diff = Date.now() - new Date(entry).getTime();
  const min = Math.max(0, Math.floor(diff / 60000));
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function estimateFee(entry: string | null, rate: number): number {
  if (!entry) return 0;
  const min = Math.max(30, Math.round((Date.now() - new Date(entry).getTime()) / 60000));
  return +(min / 60 * rate).toFixed(2);
}
