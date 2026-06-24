
-- Enums
CREATE TYPE public.slot_type AS ENUM ('COMPACT','STANDARD','LARGE','HANDICAPPED','EV_CHARGING');
CREATE TYPE public.slot_status AS ENUM ('AVAILABLE','OCCUPIED','RESERVED','MAINTENANCE');
CREATE TYPE public.vehicle_type AS ENUM ('CAR','MOTORCYCLE','SUV','TRUCK','VAN','EV');
CREATE TYPE public.payment_status AS ENUM ('PENDING','PAID','WAIVED');
CREATE TYPE public.app_role AS ENUM ('admin','user');

-- Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-assign admin role to any new user (single-tenant admin tool)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Parking slots
CREATE TABLE public.parking_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_number TEXT UNIQUE NOT NULL,
  slot_type public.slot_type NOT NULL DEFAULT 'STANDARD',
  status public.slot_status NOT NULL DEFAULT 'AVAILABLE',
  floor_number INT NOT NULL DEFAULT 1,
  section TEXT NOT NULL DEFAULT 'A',
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parking_slots TO authenticated;
GRANT ALL ON public.parking_slots TO service_role;
ALTER TABLE public.parking_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage slots" ON public.parking_slots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Vehicles
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_plate TEXT UNIQUE NOT NULL,
  owner_name TEXT NOT NULL,
  owner_phone TEXT,
  owner_email TEXT,
  vehicle_type public.vehicle_type NOT NULL DEFAULT 'CAR',
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_color TEXT,
  current_slot_id UUID REFERENCES public.parking_slots(id) ON DELETE SET NULL,
  entry_time TIMESTAMPTZ,
  is_parked BOOLEAN NOT NULL DEFAULT FALSE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage vehicles" ON public.vehicles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Parking records
CREATE TABLE public.parking_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  slot_id UUID REFERENCES public.parking_slots(id) ON DELETE SET NULL,
  entry_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  exit_time TIMESTAMPTZ,
  duration_hours NUMERIC(10,2),
  amount_charged NUMERIC(10,2),
  payment_status public.payment_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parking_records TO authenticated;
GRANT ALL ON public.parking_records TO service_role;
ALTER TABLE public.parking_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage records" ON public.parking_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER slots_touch BEFORE UPDATE ON public.parking_slots FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER vehicles_touch BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed slots
INSERT INTO public.parking_slots (slot_number, slot_type, floor_number, section, hourly_rate) VALUES
('A101','COMPACT',1,'A',30),('A102','COMPACT',1,'A',30),('A103','STANDARD',1,'A',50),
('A104','STANDARD',1,'A',50),('A105','LARGE',1,'A',75),('A106','HANDICAPPED',1,'A',30),
('B201','STANDARD',2,'B',50),('B202','STANDARD',2,'B',50),('B203','EV_CHARGING',2,'B',75),
('B204','EV_CHARGING',2,'B',75),('B205','LARGE',2,'B',75),('B206','COMPACT',2,'B',30);

-- Seed vehicles
INSERT INTO public.vehicles (license_plate, owner_name, owner_phone, owner_email, vehicle_type, vehicle_make, vehicle_model, vehicle_color) VALUES
('KA01AB1234','Rahul Sharma','+919876543210','rahul@example.com','CAR','Maruti','Swift','Red'),
('MH02CD5678','Priya Patel','+919876543211','priya@example.com','SUV','Hyundai','Creta','White'),
('DL03EF9012','Amit Singh','+919876543212','amit@example.com','MOTORCYCLE','Honda','CB350','Black');
