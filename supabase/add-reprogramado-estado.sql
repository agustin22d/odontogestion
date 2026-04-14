-- Agregar 'reprogramado' al enum estado_turno
-- Ejecutar en Supabase SQL Editor (produccion)
-- Los turnos con "Cambio de fecha" en Dentalink se mapean a este estado

ALTER TYPE estado_turno ADD VALUE IF NOT EXISTS 'reprogramado';
