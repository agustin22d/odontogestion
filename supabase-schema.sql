-- =============================================
-- BA Dental Studio — Schema completo
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'rolA', 'rolB', 'rolC');
CREATE TYPE tipo_pago AS ENUM ('efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito');
CREATE TYPE estado_deuda AS ENUM ('pendiente', 'parcial', 'pagado');
CREATE TYPE estado_turno AS ENUM ('agendado', 'atendido', 'no_asistio', 'cancelado');
CREATE TYPE origen_turno AS ENUM ('web', 'whatsapp', 'telefono', 'instagram');
CREATE TYPE estado_hora AS ENUM ('pendiente', 'aprobada', 'pagada');
CREATE TYPE tipo_gasto AS ENUM ('fijo', 'variable');
CREATE TYPE tipo_pago_empleado AS ENUM ('fijo', 'comision', 'fijo_bono', 'por_hora');
CREATE TYPE tipo_movimiento_stock AS ENUM ('entrada', 'salida');

-- 2. SEDES
CREATE TABLE sedes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  activa BOOLEAN DEFAULT true
);

INSERT INTO sedes (nombre, direccion) VALUES
  ('Saavedra', 'Av. Ruiz Huidobro 3059, CABA'),
  ('Caballito', 'Senillosa 174, CABA'),
  ('San Isidro', 'Blanco Encalada 197, GBA'),
  ('Ramos Mejía', 'Av. Rivadavia 14340, GBA'),
  ('Moreno', 'Av. Pagano 2690, GBA'),
  ('Banfield', 'Cochabamba 220, GBA');

-- 3. USERS (perfil extendido vinculado a auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  rol user_role NOT NULL DEFAULT 'rolC',
  sede_id UUID REFERENCES sedes(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. COBRANZAS
CREATE TABLE cobranzas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  sede_id UUID NOT NULL REFERENCES sedes(id),
  user_id UUID NOT NULL REFERENCES users(id),
  paciente TEXT NOT NULL,
  tratamiento TEXT NOT NULL,
  tipo_pago tipo_pago NOT NULL,
  monto DECIMAL(12,2) NOT NULL CHECK (monto > 0),
  es_cuota BOOLEAN DEFAULT false,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. DEUDAS (POR COBRAR)
CREATE TABLE deudas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente TEXT NOT NULL,
  tratamiento TEXT NOT NULL,
  monto_total DECIMAL(12,2) NOT NULL CHECK (monto_total > 0),
  monto_cobrado DECIMAL(12,2) DEFAULT 0 CHECK (monto_cobrado >= 0),
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  sede_id UUID NOT NULL REFERENCES sedes(id),
  estado estado_deuda DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TURNOS
CREATE TABLE turnos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  sede_id UUID NOT NULL REFERENCES sedes(id),
  paciente TEXT NOT NULL,
  profesional TEXT,
  estado estado_turno DEFAULT 'agendado',
  origen origen_turno DEFAULT 'whatsapp',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. TAREAS
CREATE TABLE tareas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  asignado_a UUID NOT NULL REFERENCES users(id),
  sede_id UUID REFERENCES sedes(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  completada BOOLEAN DEFAULT false,
  completada_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. HORAS
CREATE TABLE horas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  fecha DATE NOT NULL,
  horas DECIMAL(4,2) NOT NULL CHECK (horas > 0 AND horas <= 24),
  es_domingo BOOLEAN DEFAULT false,
  es_feriado BOOLEAN DEFAULT false,
  estado estado_hora DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, fecha)
);

-- 9. GASTOS
CREATE TABLE gastos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  sede_id UUID REFERENCES sedes(id),
  user_id UUID NOT NULL REFERENCES users(id),
  concepto TEXT NOT NULL,
  categoria TEXT NOT NULL,
  monto DECIMAL(12,2) NOT NULL CHECK (monto > 0),
  tipo tipo_gasto NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. EMPLEADOS CONFIG
CREATE TABLE empleados_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
  rol user_role NOT NULL,
  sede_id UUID REFERENCES sedes(id),
  tipo_pago tipo_pago_empleado NOT NULL DEFAULT 'fijo',
  detalle_pago JSONB DEFAULT '{}',
  activo BOOLEAN DEFAULT true
);

-- 11. STOCK — PRODUCTOS
CREATE TABLE productos_stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'General',
  sede_id UUID NOT NULL REFERENCES sedes(id),
  cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  stock_minimo INTEGER NOT NULL DEFAULT 0,
  unidad TEXT NOT NULL DEFAULT 'unidad',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. STOCK — MOVIMIENTOS
CREATE TABLE movimientos_stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id UUID NOT NULL REFERENCES productos_stock(id) ON DELETE CASCADE,
  sede_id UUID NOT NULL REFERENCES sedes(id),
  tipo tipo_movimiento_stock NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  motivo TEXT,
  user_id UUID NOT NULL REFERENCES users(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobranzas ENABLE ROW LEVEL SECURITY;
ALTER TABLE deudas ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE horas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT rol FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's sede_id
CREATE OR REPLACE FUNCTION get_user_sede_id()
RETURNS UUID AS $$
  SELECT sede_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- SEDES: everyone can read
CREATE POLICY "Sedes: lectura para todos" ON sedes FOR SELECT USING (true);
CREATE POLICY "Sedes: admin puede modificar" ON sedes FOR ALL USING (get_user_role() = 'admin');

-- USERS: admin ve todo, otros solo su propio perfil
CREATE POLICY "Users: admin ve todos" ON users FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Users: ver propio perfil" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users: admin puede modificar" ON users FOR ALL USING (get_user_role() = 'admin');

-- COBRANZAS: admin ve todo, rolC ve solo su sede
CREATE POLICY "Cobranzas: admin ve todo" ON cobranzas FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Cobranzas: rolC ve su sede" ON cobranzas FOR SELECT USING (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);
CREATE POLICY "Cobranzas: admin inserta" ON cobranzas FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "Cobranzas: rolC inserta en su sede" ON cobranzas FOR INSERT WITH CHECK (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);
CREATE POLICY "Cobranzas: admin actualiza" ON cobranzas FOR UPDATE USING (get_user_role() = 'admin');

-- DEUDAS: admin ve todo, rolC ve su sede
CREATE POLICY "Deudas: admin ve todo" ON deudas FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Deudas: rolC ve su sede" ON deudas FOR SELECT USING (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);
CREATE POLICY "Deudas: admin gestiona" ON deudas FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "Deudas: rolC inserta en su sede" ON deudas FOR INSERT WITH CHECK (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);

-- TURNOS: admin ve todo, rolA ve los que agendó, rolC ve su sede
CREATE POLICY "Turnos: admin ve todo" ON turnos FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Turnos: rolC ve su sede" ON turnos FOR SELECT USING (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);
CREATE POLICY "Turnos: rolA ve todos (lectura)" ON turnos FOR SELECT USING (get_user_role() = 'rolA');
CREATE POLICY "Turnos: admin inserta" ON turnos FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "Turnos: rolC inserta en su sede" ON turnos FOR INSERT WITH CHECK (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);
CREATE POLICY "Turnos: rolA inserta" ON turnos FOR INSERT WITH CHECK (get_user_role() = 'rolA');
CREATE POLICY "Turnos: admin actualiza" ON turnos FOR UPDATE USING (get_user_role() = 'admin');
CREATE POLICY "Turnos: rolC actualiza su sede" ON turnos FOR UPDATE USING (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);

-- TAREAS: admin ve todo, otros solo las suyas
CREATE POLICY "Tareas: admin ve todo" ON tareas FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Tareas: ver propias" ON tareas FOR SELECT USING (asignado_a = auth.uid());
CREATE POLICY "Tareas: admin gestiona" ON tareas FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "Tareas: completar propias" ON tareas FOR UPDATE USING (asignado_a = auth.uid());

-- HORAS: admin ve todo, cada uno ve las suyas
CREATE POLICY "Horas: admin ve todo" ON horas FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Horas: ver propias" ON horas FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Horas: insertar propias" ON horas FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Horas: admin gestiona" ON horas FOR ALL USING (get_user_role() = 'admin');

-- GASTOS: solo admin
CREATE POLICY "Gastos: solo admin" ON gastos FOR ALL USING (get_user_role() = 'admin');

-- EMPLEADOS_CONFIG: solo admin
CREATE POLICY "Empleados config: solo admin" ON empleados_config FOR ALL USING (get_user_role() = 'admin');

-- STOCK PRODUCTOS: admin ve todo, rolC ve su sede
CREATE POLICY "Stock: admin ve todo" ON productos_stock FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Stock: rolC ve su sede" ON productos_stock FOR SELECT USING (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);
CREATE POLICY "Stock: admin gestiona" ON productos_stock FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "Stock: rolC actualiza su sede" ON productos_stock FOR UPDATE USING (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);

-- MOVIMIENTOS STOCK: admin ve todo, rolC ve su sede
CREATE POLICY "Mov stock: admin ve todo" ON movimientos_stock FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Mov stock: rolC ve su sede" ON movimientos_stock FOR SELECT USING (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);
CREATE POLICY "Mov stock: admin inserta" ON movimientos_stock FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "Mov stock: rolC inserta en su sede" ON movimientos_stock FOR INSERT WITH CHECK (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX idx_cobranzas_sede_fecha ON cobranzas(sede_id, fecha);
CREATE INDEX idx_cobranzas_fecha ON cobranzas(fecha);
CREATE INDEX idx_deudas_sede ON deudas(sede_id);
CREATE INDEX idx_deudas_estado ON deudas(estado);
CREATE INDEX idx_turnos_sede_fecha ON turnos(sede_id, fecha);
CREATE INDEX idx_turnos_fecha ON turnos(fecha);
CREATE INDEX idx_tareas_asignado ON tareas(asignado_a, fecha);
CREATE INDEX idx_tareas_fecha ON tareas(fecha);
CREATE INDEX idx_horas_user ON horas(user_id, fecha);
CREATE INDEX idx_gastos_sede_fecha ON gastos(sede_id, fecha);
CREATE INDEX idx_gastos_fecha ON gastos(fecha);
CREATE INDEX idx_stock_sede ON productos_stock(sede_id);
CREATE INDEX idx_mov_stock_producto ON movimientos_stock(producto_id);
CREATE INDEX idx_mov_stock_fecha ON movimientos_stock(fecha);
