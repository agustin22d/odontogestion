-- =============================================================
-- Odonto Gestión — Vista por_cobrar + seed v3 (demo viva)
--
-- Cambios:
--   1. Crea la vista `por_cobrar` derivada de `deudas` que el front
--      ya consultaba (FinanzasClient.tsx, tab "Por Cobrar"). Antes
--      mostraba "Sin datos" porque la vista no existía.
--   2. seed_demo_data v3:
--      - Cobranzas: 3-5 por día durante los últimos 90 días + 8 adicionales HOY
--        (así cualquier día que se abra la app hay datos del día actual).
--      - Gastos futuros recurrentes: 6 conceptos (alquiler, sueldos, internet,
--        luz, expensas, lavandería) replicados los próximos 6 meses con
--        estado_pago='pendiente' y fecha_vencimiento poblado.
--      - Deudas: 30 (era 15) con vencimientos repartidos pasado/hoy/futuro/sin fecha.
-- =============================================================

CREATE OR REPLACE VIEW por_cobrar AS
SELECT
  d.id,
  d.clinic_id,
  d.sede_id,
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

-- La vista hereda el RLS de `deudas` (Postgres aplica las policies
-- de la tabla base al consultar la vista). No hace falta GRANT extra.

-- =============================================================
-- seed_demo_data v3
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
  -- Gastos recurrentes que se replican mes a mes (próximos 6 meses)
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

  -- ============= SEDES (4) =============
  INSERT INTO sedes (clinic_id, nombre, direccion, activa)
  VALUES (p_clinic_id, 'Palermo', 'Av. Santa Fe 3450, CABA', true)
  RETURNING id INTO v_sede_palermo;
  INSERT INTO sedes (clinic_id, nombre, direccion, activa)
  VALUES (p_clinic_id, 'Recoleta', 'Av. Callao 1234, CABA', true)
  RETURNING id INTO v_sede_recoleta;
  INSERT INTO sedes (clinic_id, nombre, direccion, activa)
  VALUES (p_clinic_id, 'Belgrano', 'Av. Cabildo 2500, CABA', true)
  RETURNING id INTO v_sede_belgrano;
  INSERT INTO sedes (clinic_id, nombre, direccion, activa)
  VALUES (p_clinic_id, 'Pilar', 'Av. Las Magnolias 850, Pilar', true)
  RETURNING id INTO v_sede_pilar;

  -- ============= PACIENTES (50) =============
  v_paciente_ids := ARRAY[]::UUID[];
  v_count_pac := 0;
  FOR i IN 1..50 LOOP
    INSERT INTO pacientes (
      clinic_id, sede_id, nombre, apellido, dni, fecha_nacimiento,
      telefono, email, obra_social, notas
    )
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

  -- ============= PROFESIONALES (6) =============
  v_prof_ids := ARRAY[]::UUID[];
  FOR i IN 1..6 LOOP
    v_color := (ARRAY['#3b82f6','#8b5cf6','#ec4899','#f97316','#10b981','#06b6d4'])[i];
    v_dur_default := (ARRAY[30, 45, 30, 60, 30, 45])[i];
    INSERT INTO profesionales (
      clinic_id, nombre, apellido, color, duracion_default_min,
      matricula, email, telefono, activo
    )
    VALUES (
      p_clinic_id,
      (ARRAY['Lucía','Martín','Sofía','Federico','Valeria','Andrés'])[i],
      (ARRAY['Martínez','Fernández','Gómez','López','Sosa','Ramírez'])[i],
      v_color,
      v_dur_default,
      'MN ' || (10000 + i * 731)::TEXT,
      (ARRAY['lucia.martinez','martin.fernandez','sofia.gomez','federico.lopez','valeria.sosa','andres.ramirez'])[i] || '@odontogestion.demo',
      '+54 11 4' || lpad((1000 + i * 487)::text, 3, '0') || '-' || lpad((2000 + i * 397)::text, 4, '0'),
      true
    )
    RETURNING id INTO v_prof_id;
    v_prof_ids := array_append(v_prof_ids, v_prof_id);

    IF i % 2 = 0 THEN
      INSERT INTO profesional_sedes (profesional_id, sede_id) VALUES
        (v_prof_id, v_sede_palermo),
        (v_prof_id, v_sede_belgrano);
    ELSE
      INSERT INTO profesional_sedes (profesional_id, sede_id) VALUES
        (v_prof_id, v_sede_recoleta),
        (v_prof_id, v_sede_pilar);
    END IF;

    FOR j IN 1..5 LOOP
      INSERT INTO horarios_atencion (clinic_id, profesional_id, sede_id, dia_semana, hora_desde, hora_hasta)
      VALUES
        (p_clinic_id, v_prof_id, NULL, j, '09:00', '13:00'),
        (p_clinic_id, v_prof_id, NULL, j, '14:00', '19:00');
    END LOOP;
    IF i % 2 = 1 THEN
      INSERT INTO horarios_atencion (clinic_id, profesional_id, sede_id, dia_semana, hora_desde, hora_hasta)
      VALUES (p_clinic_id, v_prof_id, NULL, 6, '09:00', '13:00');
    END IF;
  END LOOP;

  INSERT INTO bloqueos_recurrentes (clinic_id, profesional_id, sede_id, dia_semana, hora_desde, hora_hasta, motivo)
  VALUES
    (p_clinic_id, NULL, NULL, 0, '00:00', '23:59', 'Domingo - cerrado'),
    (p_clinic_id, NULL, NULL, 3, '13:00', '14:00', 'Pausa mediodía miércoles');

  INSERT INTO agenda_bloqueos (clinic_id, profesional_id, sede_id, fecha_desde, fecha_hasta, motivo)
  VALUES (
    p_clinic_id, v_prof_ids[1], NULL,
    (v_today + 14)::TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires',
    (v_today + 21)::TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires',
    'Vacaciones'
  );

  -- ============= TURNOS (~250: ±90 días) + 8 turnos HOY =============
  FOR i IN 1..250 LOOP
    v_fecha := v_today + ((i * 13) % 180) - 90;
    IF EXTRACT(DOW FROM v_fecha) = 0 THEN CONTINUE; END IF;

    v_hora := (ARRAY['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30'])[1 + (i % 16)]::TIME;
    v_dur := (ARRAY[30, 30, 45, 30, 60, 30, 30, 45])[1 + (i % 8)];
    v_pid := v_paciente_ids[1 + (i % v_count_pac)];
    v_sede_id := (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (i % 4)];
    v_prof_id := v_prof_ids[1 + (i % 6)];

    IF v_fecha < v_today THEN
      v_estado := (ARRAY[
        'atendido','atendido','atendido','atendido','atendido','atendido','atendido',
        'no_asistio','no_asistio',
        'cancelado',
        'reprogramado','reprogramado'
      ])[1 + (i % 12)]::estado_turno;
    ELSE
      v_estado := 'agendado'::estado_turno;
    END IF;

    INSERT INTO turnos (
      clinic_id, sede_id, fecha, hora, duracion_min, paciente, patient_id,
      profesional, profesional_id, estado, origen, notas
    )
    SELECT
      p_clinic_id, v_sede_id, v_fecha, v_hora, v_dur,
      p.nombre || ' ' || COALESCE(p.apellido, ''), p.id,
      pr.nombre || ' ' || COALESCE(pr.apellido, ''), pr.id,
      v_estado,
      v_origenes[1 + (i % array_length(v_origenes, 1))],
      CASE WHEN i % 9 = 0 THEN 'Primera consulta' WHEN i % 13 = 0 THEN 'Control post-tratamiento' ELSE NULL END
    FROM pacientes p, profesionales pr
    WHERE p.id = v_pid AND pr.id = v_prof_id;
    v_count_turnos := v_count_turnos + 1;
  END LOOP;

  -- Garantizar turnos HOY (8 turnos en horarios variados, varios doctores/sedes)
  FOR k IN 1..8 LOOP
    v_pid := v_paciente_ids[1 + ((k * 7) % v_count_pac)];
    v_prof_id := v_prof_ids[1 + (k % 6)];
    v_sede_id := (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (k % 4)];
    v_hora := (ARRAY['09:00','10:30','11:30','14:00','15:00','16:30','17:30','18:30'])[k]::TIME;
    INSERT INTO turnos (
      clinic_id, sede_id, fecha, hora, duracion_min, paciente, patient_id,
      profesional, profesional_id, estado, origen, notas
    )
    SELECT
      p_clinic_id, v_sede_id, v_today, v_hora, 30,
      p.nombre || ' ' || COALESCE(p.apellido, ''), p.id,
      pr.nombre || ' ' || COALESCE(pr.apellido, ''), pr.id,
      'agendado'::estado_turno,
      v_origenes[1 + (k % array_length(v_origenes, 1))],
      CASE WHEN k = 1 THEN 'Primera consulta del día' ELSE NULL END
    FROM pacientes p, profesionales pr
    WHERE p.id = v_pid AND pr.id = v_prof_id;
    v_count_turnos := v_count_turnos + 1;
  END LOOP;

  -- ============= COBRANZAS: ~4 por día durante últimos 90 días + 8 HOY =============
  -- Loop denso: para cada día desde -90 hasta -1, 3-5 cobranzas
  FOR i IN 0..89 LOOP
    v_fecha := v_today - i;
    -- Saltar domingos (no atienden)
    IF EXTRACT(DOW FROM v_fecha) = 0 THEN CONTINUE; END IF;
    -- 3-5 cobranzas por día (varía con el día)
    FOR k IN 1..(3 + (i % 3)) LOOP
      v_pid := v_paciente_ids[1 + (((i * 11) + k * 3) % v_count_pac)];
      v_sede_id := (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + ((i + k) % 4)];
      INSERT INTO cobranzas (
        clinic_id, sede_id, fecha, paciente, patient_id, tratamiento,
        tipo_pago, monto, es_cuota, notas
      )
      SELECT
        p_clinic_id, v_sede_id, v_fecha,
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

  -- 8 cobranzas adicionales del día HOY (varios pacientes / sedes / tipos)
  FOR k IN 1..8 LOOP
    v_pid := v_paciente_ids[1 + ((k * 13) % v_count_pac)];
    v_sede_id := (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (k % 4)];
    INSERT INTO cobranzas (
      clinic_id, sede_id, fecha, paciente, patient_id, tratamiento,
      tipo_pago, monto, es_cuota, notas
    )
    SELECT
      p_clinic_id, v_sede_id, v_today,
      p.nombre || ' ' || COALESCE(p.apellido, ''), p.id,
      v_tratamientos[1 + (k % array_length(v_tratamientos, 1))],
      v_tipos_pago[1 + (k % array_length(v_tipos_pago, 1))],
      (15000 + k * 18000)::NUMERIC(12,2),
      (k % 3 = 0),
      NULL
    FROM pacientes p WHERE p.id = v_pid;
    v_count_cobr := v_count_cobr + 1;
  END LOOP;

  -- ============= GASTOS: pasados (~80) + recurrentes futuros (60) =============
  -- Pasados: ~80 distribuidos en últimos 90 días
  FOR i IN 1..80 LOOP
    v_fecha := v_today - ((i * 4) % 90);
    INSERT INTO gastos (
      clinic_id, sede_id, fecha, fecha_vencimiento, concepto, categoria,
      monto, tipo, estado_pago, notas
    )
    VALUES (
      p_clinic_id,
      CASE WHEN i % 5 = 0 THEN NULL
           ELSE (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (i % 4)]
      END,
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

  -- Gastos recurrentes futuros: cada uno de los 10 conceptos × próximos 6 meses
  -- Estado 'pendiente' (es lo que vencerá) — el admin los irá marcando como pagado.
  FOR v_mes_offset IN 0..5 LOOP
    FOR i IN 1..array_length(v_gastos_recurrentes_concepto, 1) LOOP
      v_fecha := (DATE_TRUNC('month', v_today)::DATE + (v_mes_offset || ' months')::INTERVAL)::DATE
                 + (v_gastos_recurrentes_dia[i] - 1);
      -- Si la fecha cae antes de hoy en este mes, salteamos (es del mes corriente ya vencido)
      IF v_fecha < v_today THEN CONTINUE; END IF;
      INSERT INTO gastos (
        clinic_id, sede_id, fecha, fecha_vencimiento, concepto, categoria,
        monto, tipo, estado_pago, notas
      )
      VALUES (
        p_clinic_id,
        CASE WHEN v_gastos_recurrentes_concepto[i] LIKE '%Palermo%' THEN v_sede_palermo
             WHEN v_gastos_recurrentes_concepto[i] LIKE '%Recoleta%' THEN v_sede_recoleta
             ELSE NULL END,
        v_fecha,                                   -- fecha del gasto = vencimiento
        v_fecha,                                   -- fecha_vencimiento explícito
        v_gastos_recurrentes_concepto[i],
        v_gastos_recurrentes_cat[i],
        v_gastos_recurrentes_monto[i] * (1.0 + (v_mes_offset * 0.03))::NUMERIC,  -- inflación 3%/mes
        v_gastos_recurrentes_tipo[i],
        'pendiente'::estado_pago_gasto,
        'Gasto recurrente — pago programado'
      );
      v_count_gastos := v_count_gastos + 1;
    END LOOP;
  END LOOP;

  -- ============= DEUDAS (30 con vencimientos repartidos) =============
  FOR i IN 1..30 LOOP
    v_pid := v_paciente_ids[1 + ((i - 1) % v_count_pac)];
    INSERT INTO deudas (
      clinic_id, sede_id, paciente, tratamiento,
      monto_total, monto_cobrado, fecha_inicio, fecha_vencimiento,
      estado, notas
    )
    SELECT
      p_clinic_id,
      (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (i % 4)],
      p.nombre || ' ' || COALESCE(p.apellido, ''),
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
      -- Vencimientos: 6 vencidos, 6 hoy/próximos días, 12 a 30 días, 6 sin fecha
      CASE
        WHEN i <= 6 THEN v_today - (i * 2)                       -- vencidos
        WHEN i <= 12 THEN v_today + (i - 6)                       -- vencen esta semana
        WHEN i <= 24 THEN v_today + (10 + (i - 12) * 2)           -- 10-34 días
        ELSE NULL                                                  -- sin fecha
      END,
      CASE
        WHEN i % 5 = 0 THEN 'pendiente'
        ELSE 'parcial'
      END::estado_deuda,
      'Plan en ' || (3 + (i % 9)) || ' cuotas mensuales'
    FROM pacientes p WHERE p.id = v_pid;
    v_count_deudas := v_count_deudas + 1;
  END LOOP;

  -- ============= STOCK PRODUCTOS + MOVIMIENTOS =============
  v_prod_ids := ARRAY[]::UUID[];
  FOR i IN 1..array_length(v_productos, 1) LOOP
    INSERT INTO stock_productos (
      clinic_id, sede_id, nombre, medida, categoria, unidad,
      stock_minimo, precio_compra, activo
    )
    VALUES (
      p_clinic_id,
      CASE WHEN i % 3 = 0 THEN NULL
           ELSE (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (i % 4)] END,
      v_productos[i],
      CASE WHEN i % 2 = 0 THEN 'mediano' ELSE 'chico' END,
      'Insumos',
      v_unidades[i],
      (5 + (i % 5) * 3),
      (1500 + i * 480)::NUMERIC(12,2),
      true
    )
    RETURNING id INTO v_prod_id;
    v_prod_ids := array_append(v_prod_ids, v_prod_id);
  END LOOP;

  FOR i IN 1..array_length(v_prod_ids, 1) LOOP
    INSERT INTO stock_movimientos (clinic_id, sede_id, producto_id, fecha, tipo, cantidad, motivo)
    VALUES (
      p_clinic_id,
      (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (i % 4)],
      v_prod_ids[i], v_today - 60, 'entrada', 80, 'Compra inicial'
    );
    INSERT INTO stock_movimientos (clinic_id, sede_id, producto_id, fecha, tipo, cantidad, motivo)
    VALUES (
      p_clinic_id,
      (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (i % 4)],
      v_prod_ids[i], v_today - 25, 'entrada', 30, 'Reposición'
    );
    INSERT INTO stock_movimientos (clinic_id, sede_id, producto_id, fecha, tipo, cantidad, motivo)
    VALUES (
      p_clinic_id,
      (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano, v_sede_pilar])[1 + (i % 4)],
      v_prod_ids[i], v_today - (i % 15), 'salida',
      CASE WHEN i % 4 = 0 THEN 100
           WHEN i % 4 = 1 THEN 95
           ELSE (15 + i * 3) END,
      'Uso en turnos'
    );
  END LOOP;

  -- ============= LABORATORIO (~20 casos) =============
  FOR i IN 1..20 LOOP
    v_pid := v_paciente_ids[1 + (i % v_count_pac)];
    INSERT INTO laboratorio_casos (
      clinic_id, sede_id, paciente, patient_id, profesional, profesional_id,
      tipo, laboratorio, estado, notas
    )
    SELECT
      p_clinic_id,
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
    'Seed v3 OK clínica %s — 4 sedes · 6 profesionales · %s pacientes · %s turnos · %s cobranzas (incl. %s HOY) · %s gastos (incl. recurrentes próximos 6 meses) · %s deudas · %s productos · 20 casos lab',
    p_clinic_id, v_count_pac, v_count_turnos, v_count_cobr, 8, v_count_gastos, v_count_deudas, array_length(v_prod_ids, 1)
  );
END;
$$;

-- =============================================================
-- BONUS: función `seed_demo_today()` — solo agrega cobranzas y
-- turnos del día actual SIN borrar nada. Útil para correr antes
-- de cada demo si el seed ya está cargado pero quedaron viejos.
--
-- Uso: SELECT seed_demo_today('TU_CLINIC_ID');
-- =============================================================
CREATE OR REPLACE FUNCTION seed_demo_today(p_clinic_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_paciente_ids UUID[];
  v_prof_ids UUID[];
  v_sede_ids UUID[];
  v_count INT := 0;
  k INT;
  v_pid UUID;
  v_prof_id UUID;
  v_sede_id UUID;
  v_hora TIME;
BEGIN
  SELECT array_agg(id ORDER BY created_at) INTO v_paciente_ids FROM pacientes WHERE clinic_id = p_clinic_id;
  SELECT array_agg(id ORDER BY created_at) INTO v_prof_ids FROM profesionales WHERE clinic_id = p_clinic_id AND activo = true;
  SELECT array_agg(id ORDER BY created_at) INTO v_sede_ids FROM sedes WHERE clinic_id = p_clinic_id AND activa = true;

  IF v_paciente_ids IS NULL OR array_length(v_paciente_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No hay pacientes en clínica %. Corré primero seed_demo_data().', p_clinic_id;
  END IF;

  -- 8 turnos HOY
  FOR k IN 1..8 LOOP
    v_pid := v_paciente_ids[1 + ((k * 7) % array_length(v_paciente_ids, 1))];
    v_prof_id := v_prof_ids[1 + (k % array_length(v_prof_ids, 1))];
    v_sede_id := v_sede_ids[1 + (k % array_length(v_sede_ids, 1))];
    v_hora := (ARRAY['09:00','10:30','11:30','14:00','15:00','16:30','17:30','18:30'])[k]::TIME;
    INSERT INTO turnos (
      clinic_id, sede_id, fecha, hora, duracion_min, paciente, patient_id,
      profesional, profesional_id, estado, origen
    )
    SELECT
      p_clinic_id, v_sede_id, v_today, v_hora, 30,
      p.nombre || ' ' || COALESCE(p.apellido, ''), p.id,
      pr.nombre || ' ' || COALESCE(pr.apellido, ''), pr.id,
      'agendado'::estado_turno, 'whatsapp'::origen_turno
    FROM pacientes p, profesionales pr
    WHERE p.id = v_pid AND pr.id = v_prof_id;
    v_count := v_count + 1;
  END LOOP;

  -- 8 cobranzas HOY
  FOR k IN 1..8 LOOP
    v_pid := v_paciente_ids[1 + ((k * 13) % array_length(v_paciente_ids, 1))];
    v_sede_id := v_sede_ids[1 + (k % array_length(v_sede_ids, 1))];
    INSERT INTO cobranzas (
      clinic_id, sede_id, fecha, paciente, patient_id, tratamiento,
      tipo_pago, monto, es_cuota
    )
    SELECT
      p_clinic_id, v_sede_id, v_today,
      p.nombre || ' ' || COALESCE(p.apellido, ''), p.id,
      (ARRAY['Consulta','Limpieza','Ortodoncia','Implante','Conducto','Blanqueamiento','Corona','Carilla'])[k],
      (ARRAY['efectivo','transferencia','tarjeta_debito','tarjeta_credito','mercado_pago','efectivo','transferencia','tarjeta_credito'])[k]::tipo_pago,
      (15000 + k * 18000)::NUMERIC(12,2),
      (k % 3 = 0)
    FROM pacientes p WHERE p.id = v_pid;
    v_count := v_count + 1;
  END LOOP;

  RETURN format('seed_demo_today: %s registros agregados al día %s', v_count, v_today);
END;
$$;
