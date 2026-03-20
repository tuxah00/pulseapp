-- Classes: group class management for fitness/yoga sectors
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  instructor_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  day_of_week integer[] NOT NULL DEFAULT '{}',
  start_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  capacity integer NOT NULL DEFAULT 20 CHECK (capacity > 0),
  color text NOT NULL DEFAULT '#6366f1',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, session_date)
);

CREATE TABLE IF NOT EXISTS public.class_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS classes_business_idx ON public.classes (business_id, is_active);
CREATE INDEX IF NOT EXISTS class_sessions_class_date_idx ON public.class_sessions (class_id, session_date);
CREATE INDEX IF NOT EXISTS class_sessions_date_idx ON public.class_sessions (session_date);
CREATE INDEX IF NOT EXISTS class_attendance_session_idx ON public.class_attendance (session_id);

-- RLS for classes
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view classes" ON public.classes;
DROP POLICY IF EXISTS "Staff insert classes" ON public.classes;
DROP POLICY IF EXISTS "Staff update classes" ON public.classes;
DROP POLICY IF EXISTS "Staff delete classes" ON public.classes;
CREATE POLICY "Staff view classes" ON public.classes FOR SELECT TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "Staff insert classes" ON public.classes FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "Staff update classes" ON public.classes FOR UPDATE TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "Staff delete classes" ON public.classes FOR DELETE TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

-- RLS for class_sessions
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Staff insert sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Staff update sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Staff delete sessions" ON public.class_sessions;
CREATE POLICY "Staff view sessions" ON public.class_sessions FOR SELECT TO authenticated
  USING (class_id IN (SELECT id FROM public.classes WHERE business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true)));
CREATE POLICY "Staff insert sessions" ON public.class_sessions FOR INSERT TO authenticated
  WITH CHECK (class_id IN (SELECT id FROM public.classes WHERE business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true)));
CREATE POLICY "Staff update sessions" ON public.class_sessions FOR UPDATE TO authenticated
  USING (class_id IN (SELECT id FROM public.classes WHERE business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true)));
CREATE POLICY "Staff delete sessions" ON public.class_sessions FOR DELETE TO authenticated
  USING (class_id IN (SELECT id FROM public.classes WHERE business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true)));

-- RLS for class_attendance
ALTER TABLE public.class_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view attendance" ON public.class_attendance;
DROP POLICY IF EXISTS "Staff insert attendance" ON public.class_attendance;
DROP POLICY IF EXISTS "Staff update attendance" ON public.class_attendance;
DROP POLICY IF EXISTS "Staff delete attendance" ON public.class_attendance;
CREATE POLICY "Staff view attendance" ON public.class_attendance FOR SELECT TO authenticated
  USING (session_id IN (SELECT cs.id FROM public.class_sessions cs JOIN public.classes c ON c.id = cs.class_id WHERE c.business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true)));
CREATE POLICY "Staff insert attendance" ON public.class_attendance FOR INSERT TO authenticated
  WITH CHECK (session_id IN (SELECT cs.id FROM public.class_sessions cs JOIN public.classes c ON c.id = cs.class_id WHERE c.business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true)));
CREATE POLICY "Staff update attendance" ON public.class_attendance FOR UPDATE TO authenticated
  USING (session_id IN (SELECT cs.id FROM public.class_sessions cs JOIN public.classes c ON c.id = cs.class_id WHERE c.business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true)));
CREATE POLICY "Staff delete attendance" ON public.class_attendance FOR DELETE TO authenticated
  USING (session_id IN (SELECT cs.id FROM public.class_sessions cs JOIN public.classes c ON c.id = cs.class_id WHERE c.business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true)));
