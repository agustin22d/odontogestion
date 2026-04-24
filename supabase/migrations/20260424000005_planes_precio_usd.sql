-- Actualiza el precio_mensual de Starter y Pro a valores USD (300 y 500).
-- La columna `plans.precio_mensual` se interpreta de ahora en adelante como USD.
-- El UI usa USD también (PLAN_TIERS.precio_usd y PlanClient.tsx).

UPDATE plans SET precio_mensual = 300 WHERE nombre = 'Starter';
UPDATE plans SET precio_mensual = 500 WHERE nombre = 'Pro';
