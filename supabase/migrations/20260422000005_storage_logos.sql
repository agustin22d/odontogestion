-- =============================================================
-- Odonto Gestión — Bucket de Storage para logos de clínicas
-- Crea un bucket público 'clinic-logos' con políticas que permiten a los
-- admins de cada clínica subir archivos bajo una carpeta con su clinic_id.
-- Es público para lectura (los logos se muestran sin auth en la UI).
-- =============================================================

-- Crear bucket (solo si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinic-logos', 'clinic-logos', true,
  2097152, -- 2 MB
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas de storage.objects para este bucket.
-- Convención de path: "<clinic_id>/<filename>"
-- Lectura pública (el bucket ya es público, pero igual declaramos explícito).
DROP POLICY IF EXISTS "clinic_logos_public_read" ON storage.objects;
CREATE POLICY "clinic_logos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'clinic-logos');

-- Upload: solo si es admin de la clínica cuyo id aparece como primer path segment.
DROP POLICY IF EXISTS "clinic_logos_insert_own_clinic" ON storage.objects;
CREATE POLICY "clinic_logos_insert_own_clinic" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'clinic-logos'
    AND (storage.foldername(name))[1] = get_user_clinic_id()::text
    AND has_permission('settings.clinic')
  );

DROP POLICY IF EXISTS "clinic_logos_update_own_clinic" ON storage.objects;
CREATE POLICY "clinic_logos_update_own_clinic" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'clinic-logos'
    AND (storage.foldername(name))[1] = get_user_clinic_id()::text
    AND has_permission('settings.clinic')
  );

DROP POLICY IF EXISTS "clinic_logos_delete_own_clinic" ON storage.objects;
CREATE POLICY "clinic_logos_delete_own_clinic" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'clinic-logos'
    AND (storage.foldername(name))[1] = get_user_clinic_id()::text
    AND has_permission('settings.clinic')
  );
