-- =============================================================
-- Odonto Gestión — Fix: re-crear vista por_cobrar + RPC + seed v4
--
-- La migración 12 falló parcialmente: el CREATE OR REPLACE VIEW
-- no permite cambiar el ORDEN de columnas (solo permite agregar
-- al final). Como inserté `patient_id` en el medio, Postgres tiró:
--   ERROR 42P16: cannot change name of view column "nombre_paciente"
--   to "patient_id"
--
-- Como el SQL Editor de Supabase corre el script en transacción
-- atómica, TODO de la mig 12 se rolleó (incluyendo el ALTER TABLE).
-- Esta mig 13 es autosuficiente: re-aplica el ALTER (idempotente
-- con IF NOT EXISTS), drop+create de la vista, y las dos funciones.
-- Se puede correr varias veces sin romper nada.
-- =============================================================

-- 1) Asegurar que la columna patient_id exista en deudas (idempotente)
ALTER TABLE deudas
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES pacientes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deudas_patient ON deudas(patient_id)
  WHERE patient_id IS NOT NULL;

-- 2) Re-crear la vista (DROP + CREATE porque cambió el orden de columnas)
DROP VIEW IF EXISTS por_cobrar CASCADE;

CREATE VIEW por_cobrar AS
SELECT
  d.id,
  d.clinic_id,
  d.sede_id,
  d.patient_id,
  d.paciente AS nombre_paciente,
  d.tratamiento AS nombre_tratamiento,
  d.monto_total,
  d.monto_cobrado,
  (d.monto_total - d.monto_cobrado) AS saldo,
  d.fecha_inicio,
  d.fecha_vencimiento,
  d.estado,
  d.notas,
  d.created_at
FROM deudas d
WHERE d.estado IN ('pendiente', 'parcial');

-- =============================================================
-- RPC aplicar_pago_deuda (idéntica a la mig 12)
-- =============================================================
CREATE OR REPLACE FUNCTION aplicar_pago_deuda(
  p_deuda_id UUID,
  p_monto NUMERIC
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_deuda RECORD;
  v_nuevo_cobrado NUMERIC;
  v_nuevo_estado estado_deuda;
  v_clinic UUID;
BEGIN
  v_clinic := get_user_clinic_id();
  IF v_clinic IS NULL AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'no_clinic_membership';
  END IF;

  SELECT * INTO v_deuda FROM deudas WHERE id = p_deuda_id;
  IF v_deuda IS NULL THEN
    RAISE EXCEPTION 'deuda_not_found';
  END IF;
  IF NOT is_super_admin() AND v_deuda.clinic_id <> v_clinic THEN
    RAISE EXCEPTION 'deuda_other_clinic';
  END IF;
  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'monto_must_be_positive';
  END IF;

  v_nuevo_cobrado := LEAST(v_deuda.monto_cobrado + p_monto, v_deuda.monto_total);
  IF v_nuevo_cobrado >= v_deuda.monto_total THEN
    v_nuevo_estado := 'pagado';
  ELSIF v_nuevo_cobrado > 0 THEN
    v_nuevo_estado := 'parcial';
  ELSE
    v_nuevo_estado := 'pendiente';
  END IF;

  UPDATE deudas
  SET monto_cobrado = v_nuevo_cobrado,
      estado = v_nuevo_estado
  WHERE id = p_deuda_id;

  RETURN format('deuda %s: cobrado %s → %s (%s)', p_deuda_id, v_deuda.monto_cobrado, v_nuevo_cobrado, v_nuevo_estado);
END;
$$;

-- =============================================================
-- seed_demo_data v4 (idéntica a la mig 12 — pobla patient_id en deudas)
-- =============================================================
CREATE OR REPLACE FUNCTION seed_demo_data(p_clinic_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sede_palermo UUID;
  v_sede_recoleta UUID;
  v_sede_belgrano UUID;
  v_sede_pilar UUID;

  v_prof_ids UUID[];
  v_prof_id UUID;
  v_paciente_ids UUID[];
  v_paciente_id UUID;
  v_prod_ids UUID[];
  v_prod_id UUID;
  v_lab_id UUID;

  v_today DATE := CURRENT_DATE;
  v_clinic_exists BOOLEAN;
  v_count_pac INT;
  v_count_turnos INT := 0;
  v_count_cobr INT := 0;
  v_count_gastos INT := 0;
  v_count_deudas INT := 0;
  i INT;
  j INT;
  k INT;
  v_pid UUID;
  v_sede_id UUID;
  v_fecha DATE;
  v_hora TIME;
  v_estado estado_turno;
  v_dur INT;
  v_mes_offset INT;

  v_nombres TEXT[] := ARRAY[
    'María','Juan','Laura','Diego','Sofía','Martín','Valentina','Lucas','Camila','Nicolás',
    'Julieta','Federico','Agustina','Matías','Florencia','Sebastián','Carolina','Tomás','Lucía','Alejandro',
    'Pedro','Ana','Gabriel','Romina','Hernán','Jimena','Pablo','Natalia','Marcelo','Daniela',
    'Gonzalo','Mariana','Iván','Vanesa','Ezequiel','Andrea','Joaquín','Patricia','Bruno','Gabriela',
    'Cristian','Alejandra','Damián','Silvina','Esteban','Verónica','Leandro','Marcela','Ariel','Sabrina'
  ];
  v_apellidos TEXT[] := ARRAY[
    'González','Pérez','Fernández','López','Rodríguez','García','Sánchez','Martínez','Torres','Díaz',
    'Romero','Ruiz','Silva','Castro','Morales','Núñez','Vega','Herrera','Ortiz','Ramos',
    'Suárez','Acosta','Molina','Vázquez','Aguirre','Medina','Benítez','Sosa','Domínguez','Giménez',
    'Cabrera','Rojas','Méndez','Ferreyra','Quiroga','Funes','Paredes','Carrizo','Mansilla','Luna'
  ];
  v_obras_sociales TEXT[] := ARRAY[
    'OSDE','Swiss Medical','Galeno','Medicus','Sancor Salud','OMINT','PAMI','IOMA','Particular','Particular'
  ];
  v_tratamientos TEXT[] := ARRAY[
    'Consulta','Limpieza','Ortodoncia','Implante','Conducto','Extracción',
    'Blanqueamiento','Prótesis','Corona','Carilla','Endodoncia','Periodoncia',
    'Restauración','Sellantes','Control'
  ];
  v_tipos_pago tipo_pago[] := ARRAY[
    'efectivo','transferencia','tarjeta_debito','tarjeta_credito','mercado_pago'
  ]::tipo_pago[];
  v_origenes origen_turno[] := ARRAY[
    'whatsapp','whatsapp','web','telefono','instagram','presencial'
  ]::origen_turno[];
  v_cats_gasto TEXT[] := ARRAY[
    'personal','laboratorio','sueldos','publicidad','limpieza',
    'implantes','insumos','alquiler','servicios','otros'
  ];
  v_conceptos_gasto TEXT[] := ARRAY[
    'Material laboratorio','Publicidad Instagram','Productos limpieza',
    'Kit implantes','Anestesia','Papelería','Guantes descartables',
    'Mantenimiento sillón','Radiografías','Cena equipo',
    'Servicio técnico autoclave','Detergente enzimático','Fresas y limas',
    'Cementos dentales','Folletos clínica','Capacitación staff'
  ];
  v_gastos_recurrentes_concepto TEXT[] := ARRAY[
    'Alquiler local Palermo','Alquiler local Recoleta','Sueldos quincena 1','Sueldos quincena 2',
    'Luz EDESUR','Internet Fibertel','Expensas Palermo','Lavandería ropa clínica','ABL CABA','Contador honorarios'
  ];
  v_gastos_recurrentes_cat TEXT[] := ARRAY[
    'alquiler','alquiler','sueldos','sueldos',
    'servicios','servicios','servicios','limpieza','servicios','otros'
  ];
  v_gastos_recurrentes_monto NUMERIC[] := ARRAY[
    850000, 920000, 480000, 480000,
    85000, 32000, 110000, 28000, 45000, 180000
  ];
  v_gastos_recurrentes_dia INT[] := ARRAY[
    5, 5, 10, 25,
    20, 15, 1, 8, 12, 28
  ];
  v_gastos_recurrentes_tipo tipo_gasto[] := ARRAY[
    'fijo','fijo','fijo','fijo',
    'variable','fijo','fijo','variable','fijo','fijo'
  ]::tipo_gasto[];

  v_productos TEXT[] := ARRAY[
    'Guantes nitrilo','Mascarillas N95','Anestesia carpule','Composite A2','Composite A3',
    'Ionómero vidrio','Hilo dental','Enjuague clorhexidina','Cepillos interdentales','Eyectores',
    'Fresas diamante','Limas K','Cemento provisional','Algodones','Servilletas papel'
  ];
  v_unidades TEXT[] := ARRAY[
    'caja x100','caja x50','ampolla','jeringa','jeringa',
    'unidad','rollo','frasco','caja x10','bolsa x100',
    'kit x6','caja x6','frasco','bolsa x500','rollo x250'
  ];
  v_lab_tipos TEXT[] := ARRAY['Corona','Prótesis removible','Carilla','Férula','Puente','Implante'];
  v_laboratorios TEXT[] := ARRAY['Lab Dentix','Lab Smile','Lab Precisión','Lab 3D','Lab Buenos Aires'];
  v_lab_estados estado_laboratorio[] := ARRAY[
    'escaneado','enviada','en_proceso','retirada','colocada','a_revisar'
  ]::estado_laboratorio[];

  v_color TEXT;
  v_dur_default INT;
BEGIN
  SELECT EXISTS (SELECT 1 FROM clinics WHERE id = p_clinic_id) INTO v_clinic_exists;
  IF NOT v_clinic_exists THEN
    RAISE EXCEPTION 'clinic % no existe', p_clinic_id;
  END IF;

  DELETE FROM laboratorio_historial WHERE clinic_id = p_clinic_id;
  DELETE FROM laboratorio_casos WHERE clinic_id = p_clinic_id;
  DELETE FROM stock_movimientos WHERE clinic_id = p_clinic_id;
  DELETE FROM stock_productos WHERE clinic_id = p_clinic_id;
  DELETE FROM deudas WHERE clinic_id = p_clinic_id;
  DELETE FROM gastos WHERE clinic_id = p_clinic_id;
  DELETE FROM cobranzas WHERE clinic_id = p_clinic_id;
  DELETE FROM turnos WHERE clinic_id = p_clinic_id;
  DELETE FROM bloqueos_recurrentes WHERE clinic_id = p_clinic_id;
  DELETE FROM agenda_bloqueos WHERE clinic_id = p_clinic_id;
  DELETE FROM horarios_atencion WHERE clinic_id = p_clinic_id;
  DELETE FROM profesional_sedes WHERE profesional_id IN (SELECT id FROM profesionales WHERE clinic_id = p_clinic_id);
  DELETE FROM profesionales WHERE clinic_id = p_clinic_id;
  DELETE FROM pacientes WHERE clinic_id = p_clinic_id;
  DELETE FROM sedes WHERE clinic_id = p_clinic_id;

  INSERT INTO sedes (clinic_id, nombre, direccion, activa) VALUES (p_clinic_id, 'Palermo', 'Av. Santa Fe 3450, CABA', true) RETURNING id INTO v_sede_palermo;
  INSERT INTO sedes (clinic_id, nombre, direccion, activa) VALUES (p_clinic_id, 'Recoleta', 'Av. Callao 1234, CABA', true) RETURNING id INTO v_sede_recoleta;
  INSERT INTO sedes (clinic_id, nombre, direccion, activa) VALUES (p_clinic_id, 'Belgrano', 'Av. Cabildo 2500, CABA', true) RETURNING id INTO v_sede_belgrano;
  INSERT INTO sedes (clinic_id, nombre, direccion, activa) VALUES (p_clinic_id, 'Pilar', 'Av. Las Magnolias 850, Pilar', true) RETURNING id INTO v_sede_pilar;

  v_paciente_ids := ARRAY[]::UUID[];
  v_count_pac := 0;
  FOR i IN 1..50 LOOP
    INSERT INTO pacientes (clinic_id, sede_id, nombre, apellido, dni, fecha_nacimiento, telefono, email, obra_social, notas)
    VALUES (
      p_clinic_id,
      (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (i % 4)],
      v_nombres[1 + ((i - 1) % array_length(v_nombres, 1))],
      v_apellidos[1 + ((i * 7 - 1) % array_length(v_apellidos, 1))],
      to_char(20000000 + (i * 487391) % 25000000, 'FM00000000'),
      ('1960-01-01'::DATE) + ((i * 731) % 18000),
      '+54 11 ' || lpad(((i * 1873) % 9000 + 1000)::text, 4, '0') || '-' || lpad(((i * 5471) % 9000 + 1000)::text, 4, '0'),
      lower(replace(v_nombres[1 + ((i - 1) % array_length(v_nombres, 1))], ' ', '.')) || '.' || lower(v_apellidos[1 + ((i * 7 - 1) % array_length(v_apellidos, 1))]) || (i % 99) || '@email.com',
      v_obras_sociales[1 + (i % array_length(v_obras_sociales, 1))],
      CASE WHEN i % 7 = 0 THEN 'Alergia a anestesia con vasoconstrictor' WHEN i % 11 = 0 THEN 'Hipertenso, requiere control de presión' ELSE NULL END
    )
    RETURNING id INTO v_paciente_id;
    v_paciente_ids := array_append(v_paciente_ids, v_paciente_id);
    v_count_pac := v_count_pac + 1;
  END LOOP;

  v_prof_ids := ARRAY[]::UUID[];
  FOR i IN 1..6 LOOP
    v_color := (ARRAY['#3b82f6','#8b5cf6','#ec4899','#f97316','#10b981','#06b6d4'])[i];
    v_dur_default := (ARRAY[30, 45, 30, 60, 30, 45])[i];
    INSERT INTO profesionales (clinic_id, nombre, apellido, color, duracion_default_min, matricula, email, telefono, activo)
    VALUES (
      p_clinic_id,
      (ARRAY['Lucía','Martín','Sofía','Federico','Valeria','Andrés'])[i],
      (ARRAY['Martínez','Fernández','Gómez','López','Sosa','Ramírez'])[i],
      v_color, v_dur_default,
      'MN ' || (10000 + i * 731)::TEXT,
      (ARRAY['lucia.martinez','martin.fernandez','sofia.gomez','federico.lopez','valeria.sosa','andres.ramirez'])[i] || '@odontogestion.demo',
      '+54 11 4' || lpad((1000 + i * 487)::text, 3, '0') || '-' || lpad((2000 + i * 397)::text, 4, '0'),
      true
    )
    RETURNING id INTO v_prof_id;
    v_prof_ids := array_append(v_prof_ids, v_prof_id);

    IF i % 2 = 0 THEN
      INSERT INTO profesional_sedes (profesional_id, sede_id) VALUES (v_prof_id, v_sede_palermo), (v_prof_id, v_sede_belgrano);
    ELSE
      INSERT INTO profesional_sedes (profesional_id, sede_id) VALUES (v_prof_id, v_sede_recoleta), (v_prof_id, v_sede_pilar);
    END IF;

    FOR j IN 1..5 LOOP
      INSERT INTO horarios_atencion (clinic_id, profesional_id, sede_id, dia_semana, hora_desde, hora_hasta)
      VALUES (p_clinic_id, v_prof_id, NULL, j, '09:00', '13:00'), (p_clinic_id, v_prof_id, NULL, j, '14:00', '19:00');
    END LOOP;
    IF i % 2 = 1 THEN
      INSERT INTO horarios_atencion (clinic_id, profesional_id, sede_id, dia_semana, hora_desde, hora_hasta)
      VALUES (p_clinic_id, v_prof_id, NULL, 6, '09:00', '13:00');
    END IF;
  END LOOP;

  INSERT INTO bloqueos_recurrentes (clinic_id, profesional_id, sede_id, dia_semana, hora_desde, hora_hasta, motivo) VALUES
    (p_clinic_id, NULL, NULL, 0, '00:00', '23:59', 'Domingo - cerrado'),
    (p_clinic_id, NULL, NULL, 3, '13:00', '14:00', 'Pausa mediodía miércoles');

  INSERT INTO agenda_bloqueos (clinic_id, profesional_id, sede_id, fecha_desde, fecha_hasta, motivo) VALUES (
    p_clinic_id, v_prof_ids[1], NULL,
    (v_today + 14)::TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires',
    (v_today + 21)::TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires',
    'Vacaciones'
  );

  FOR i IN 1..250 LOOP
    v_fecha := v_today + ((i * 13) % 180) - 90;
    IF EXTRACT(DOW FROM v_fecha) = 0 THEN CONTINUE; END IF;
    v_hora := (ARRAY['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30'])[1 + (i % 16)]::TIME;
    v_dur := (ARRAY[30, 30, 45, 30, 60, 30, 30, 45])[1 + (i % 8)];
    v_pid := v_paciente_ids[1 + (i % v_count_pac)];
    v_sede_id := (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (i % 4)];
    v_prof_id := v_prof_ids[1 + (i % 6)];
    IF v_fecha < v_today THEN
      v_estado := (ARRAY['atendido','atendido','atendido','atendido','atendido','atendido','atendido','no_asistio','no_asistio','cancelado','reprogramado','reprogramado'])[1 + (i % 12)]::estado_turno;
    ELSE
      v_estado := 'agendado'::estado_turno;
    END IF;
    INSERT INTO turnos (clinic_id, sede_id, fecha, hora, duracion_min, paciente, patient_id, profesional, profesional_id, estado, origen, notas)
    SELECT p_clinic_id, v_sede_id, v_fecha, v_hora, v_dur,
      p.nombre || ' ' || COALESCE(p.apellido, ''), p.id,
      pr.nombre || ' ' || COALESCE(pr.apellido, ''), pr.id,
      v_estado, v_origenes[1 + (i % array_length(v_origenes, 1))],
      CASE WHEN i % 9 = 0 THEN 'Primera consulta' WHEN i % 13 = 0 THEN 'Control post-tratamiento' ELSE NULL END
    FROM pacientes p, profesionales pr WHERE p.id = v_pid AND pr.id = v_prof_id;
    v_count_turnos := v_count_turnos + 1;
  END LOOP;

  FOR k IN 1..8 LOOP
    v_pid := v_paciente_ids[1 + ((k * 7) % v_count_pac)];
    v_prof_id := v_prof_ids[1 + (k % 6)];
    v_sede_id := (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (k % 4)];
    v_hora := (ARRAY['09:00','10:30','11:30','14:00','15:00','16:30','17:30','18:30'])[k]::TIME;
    INSERT INTO turnos (clinic_id, sede_id, fecha, hora, duracion_min, paciente, patient_id, profesional, profesional_id, estado, origen, notas)
    SELECT p_clinic_id, v_sede_id, v_today, v_hora, 30,
      p.nombre || ' ' || COALESCE(p.apellido, ''), p.id,
      pr.nombre || ' ' || COALESCE(pr.apellido, ''), pr.id,
      'agendado'::estado_turno, v_origenes[1 + (k % array_length(v_origenes, 1))],
      CASE WHEN k = 1 THEN 'Primera consulta del día' ELSE NULL END
    FROM pacientes p, profesionales pr WHERE p.id = v_pid AND pr.id = v_prof_id;
    v_count_turnos := v_count_turnos + 1;
  END LOOP;

  FOR i IN 0..89 LOOP
    v_fecha := v_today - i;
    IF EXTRACT(DOW FROM v_fecha) = 0 THEN CONTINUE; END IF;
    FOR k IN 1..(3 + (i % 3)) LOOP
      v_pid := v_paciente_ids[1 + (((i * 11) + k * 3) % v_count_pac)];
      v_sede_id := (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + ((i + k) % 4)];
      INSERT INTO cobranzas (clinic_id, sede_id, fecha, paciente, patient_id, tratamiento, tipo_pago, monto, es_cuota, notas)
      SELECT p_clinic_id, v_sede_id, v_fecha,
        p.nombre || ' ' || COALESCE(p.apellido, ''), p.id,
        v_tratamientos[1 + ((i + k) % array_length(v_tratamientos, 1))],
        v_tipos_pago[1 + ((i + k) % array_length(v_tipos_pago, 1))],
        (8000 + (k * 12000) + (i % 13) * 4500)::NUMERIC(12,2),
        ((i + k) % 5 = 0),
        CASE WHEN k = 1 AND i % 7 = 0 THEN 'Pago parcial' ELSE NULL END
      FROM pacientes p WHERE p.id = v_pid;
      v_count_cobr := v_count_cobr + 1;
    END LOOP;
  END LOOP;

  FOR k IN 1..8 LOOP
    v_pid := v_paciente_ids[1 + ((k * 13) % v_count_pac)];
    v_sede_id := (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (k % 4)];
    INSERT INTO cobranzas (clinic_id, sede_id, fecha, paciente, patient_id, tratamiento, tipo_pago, monto, es_cuota, notas)
    SELECT p_clinic_id, v_sede_id, v_today,
      p.nombre || ' ' || COALESCE(p.apellido, ''), p.id,
      v_tratamientos[1 + (k % array_length(v_tratamientos, 1))],
      v_tipos_pago[1 + (k % array_length(v_tipos_pago, 1))],
      (15000 + k * 18000)::NUMERIC(12,2),
      (k % 3 = 0),
      NULL
    FROM pacientes p WHERE p.id = v_pid;
    v_count_cobr := v_count_cobr + 1;
  END LOOP;

  FOR i IN 1..80 LOOP
    v_fecha := v_today - ((i * 4) % 90);
    INSERT INTO gastos (clinic_id, sede_id, fecha, fecha_vencimiento, concepto, categoria, monto, tipo, estado_pago, notas)
    VALUES (
      p_clinic_id,
      CASE WHEN i % 5 = 0 THEN NULL ELSE (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (i % 4)] END,
      v_fecha,
      CASE WHEN i % 4 = 0 THEN v_today + ((i % 20) - 10) ELSE NULL END,
      v_conceptos_gasto[1 + (i % array_length(v_conceptos_gasto, 1))],
      v_cats_gasto[1 + (i % array_length(v_cats_gasto, 1))],
      (3500 + (i * 2200) + (i % 9) * 5000)::NUMERIC(12,2),
      CASE WHEN i % 3 = 0 THEN 'fijo' ELSE 'variable' END::tipo_gasto,
      CASE WHEN i % 6 = 0 AND v_fecha >= v_today - 15 THEN 'pendiente' ELSE 'pagado' END::estado_pago_gasto,
      NULL
    );
    v_count_gastos := v_count_gastos + 1;
  END LOOP;

  FOR v_mes_offset IN 0..5 LOOP
    FOR i IN 1..array_length(v_gastos_recurrentes_concepto, 1) LOOP
      v_fecha := (DATE_TRUNC('month', v_today)::DATE + (v_mes_offset || ' months')::INTERVAL)::DATE
                 + (v_gastos_recurrentes_dia[i] - 1);
      IF v_fecha < v_today THEN CONTINUE; END IF;
      INSERT INTO gastos (clinic_id, sede_id, fecha, fecha_vencimiento, concepto, categoria, monto, tipo, estado_pago, notas)
      VALUES (
        p_clinic_id,
        CASE WHEN v_gastos_recurrentes_concepto[i] LIKE '%Palermo%' THEN v_sede_palermo
             WHEN v_gastos_recurrentes_concepto[i] LIKE '%Recoleta%' THEN v_sede_recoleta
             ELSE NULL END,
        v_fecha, v_fecha,
        v_gastos_recurrentes_concepto[i],
        v_gastos_recurrentes_cat[i],
        v_gastos_recurrentes_monto[i] * (1.0 + (v_mes_offset * 0.03))::NUMERIC,
        v_gastos_recurrentes_tipo[i],
        'pendiente'::estado_pago_gasto,
        'Gasto recurrente — pago programado'
      );
      v_count_gastos := v_count_gastos + 1;
    END LOOP;
  END LOOP;

  FOR i IN 1..30 LOOP
    v_pid := v_paciente_ids[1 + ((i - 1) % v_count_pac)];
    INSERT INTO deudas (clinic_id, sede_id, paciente, patient_id, tratamiento, monto_total, monto_cobrado, fecha_inicio, fecha_vencimiento, estado, notas)
    SELECT
      p_clinic_id,
      (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (i % 4)],
      p.nombre || ' ' || COALESCE(p.apellido, ''),
      p.id,
      (ARRAY['Ortodoncia 18 meses','Implante + corona','Tratamiento de conducto','Prótesis fija','Carillas estéticas','Blanqueamiento + limpieza','Implante simple','Endodoncia molar','Limpieza profunda + control'])[1 + (i % 9)],
      ((80000 + i * 18000))::NUMERIC(12,2),
      CASE
        WHEN i % 5 = 0 THEN 0::NUMERIC(12,2)
        WHEN i % 5 = 1 THEN ((80000 + i * 18000) * 0.25)::NUMERIC(12,2)
        WHEN i % 5 = 2 THEN ((80000 + i * 18000) * 0.5)::NUMERIC(12,2)
        WHEN i % 5 = 3 THEN ((80000 + i * 18000) * 0.7)::NUMERIC(12,2)
        ELSE ((80000 + i * 18000) * 0.9)::NUMERIC(12,2)
      END,
      v_today - (i * 8),
      CASE
        WHEN i <= 6 THEN v_today - (i * 2)
        WHEN i <= 12 THEN v_today + (i - 6)
        WHEN i <= 24 THEN v_today + (10 + (i - 12) * 2)
        ELSE NULL
      END,
      CASE WHEN i % 5 = 0 THEN 'pendiente' ELSE 'parcial' END::estado_deuda,
      'Plan en ' || (3 + (i % 9)) || ' cuotas mensuales'
    FROM pacientes p WHERE p.id = v_pid;
    v_count_deudas := v_count_deudas + 1;
  END LOOP;

  v_prod_ids := ARRAY[]::UUID[];
  FOR i IN 1..array_length(v_productos, 1) LOOP
    INSERT INTO stock_productos (clinic_id, sede_id, nombre, medida, categoria, unidad, stock_minimo, precio_compra, activo)
    VALUES (
      p_clinic_id,
      CASE WHEN i % 3 = 0 THEN NULL ELSE (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (i % 4)] END,
      v_productos[i],
      CASE WHEN i % 2 = 0 THEN 'mediano' ELSE 'chico' END,
      'Insumos', v_unidades[i], (5 + (i % 5) * 3),
      (1500 + i * 480)::NUMERIC(12,2), true
    )
    RETURNING id INTO v_prod_id;
    v_prod_ids := array_append(v_prod_ids, v_prod_id);
  END LOOP;

  FOR i IN 1..array_length(v_prod_ids, 1) LOOP
    INSERT INTO stock_movimientos (clinic_id, sede_id, producto_id, fecha, tipo, cantidad, motivo)
    VALUES (p_clinic_id, (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (i % 4)], v_prod_ids[i], v_today - 60, 'entrada', 80, 'Compra inicial');
    INSERT INTO stock_movimientos (clinic_id, sede_id, producto_id, fecha, tipo, cantidad, motivo)
    VALUES (p_clinic_id, (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (i % 4)], v_prod_ids[i], v_today - 25, 'entrada', 30, 'Reposición');
    INSERT INTO stock_movimientos (clinic_id, sede_id, producto_id, fecha, tipo, cantidad, motivo)
    VALUES (p_clinic_id, (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (i % 4)], v_prod_ids[i], v_today - (i % 15), 'salida',
      CASE WHEN i % 4 = 0 THEN 100 WHEN i % 4 = 1 THEN 95 ELSE (15 + i * 3) END, 'Uso en turnos');
  END LOOP;

  FOR i IN 1..20 LOOP
    v_pid := v_paciente_ids[1 + (i % v_count_pac)];
    INSERT INTO laboratorio_casos (clinic_id, sede_id, paciente, patient_id, profesional, profesional_id, tipo, laboratorio, estado, notas)
    SELECT p_clinic_id,
      (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (i % 4)],
      p.nombre || ' ' || COALESCE(p.apellido, ''), p.id,
      pr.nombre || ' ' || COALESCE(pr.apellido, ''), pr.id,
      v_lab_tipos[1 + (i % array_length(v_lab_tipos, 1))],
      v_laboratorios[1 + (i % array_length(v_laboratorios, 1))],
      v_lab_estados[1 + (i % array_length(v_lab_estados, 1))],
      CASE WHEN i % 5 = 0 THEN 'Color seleccionado: A2' WHEN i % 7 = 0 THEN 'Urgente, paciente viaja' ELSE NULL END
    FROM pacientes p, profesionales pr
    WHERE p.id = v_pid AND pr.id = v_prof_ids[1 + (i % 6)]
    RETURNING id INTO v_lab_id;
    INSERT INTO laboratorio_historial (clinic_id, caso_id, estado_anterior, estado_nuevo)
    VALUES (p_clinic_id, v_lab_id, NULL, 'escaneado');
  END LOOP;

  RETURN format(
    'Seed v4 OK clínica %s — 4 sedes · 6 profesionales · %s pacientes · %s turnos · %s cobranzas · %s gastos · %s deudas (con patient_id) · %s productos · 20 casos lab',
    p_clinic_id, v_count_pac, v_count_turnos, v_count_cobr, v_count_gastos, v_count_deudas, array_length(v_prod_ids, 1)
  );
END;
$$;
