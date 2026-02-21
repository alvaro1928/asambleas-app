-- =====================================================
-- STORAGE: Bucket para documentos de poderes
-- =====================================================
-- Documentos opcionales (PDF o Word, máx 2MB) al registrar
-- o reemplazar poderes.
--
-- PASO 1: Crear el bucket en Supabase Dashboard
--   Storage → New bucket → nombre: poderes-docs
--   Public: true (para enlaces directos)
--   File size limit: 2 MB
--   Allowed MIME types: application/pdf, application/msword,
--     application/vnd.openxmlformats-officedocument.wordprocessingml.document
--
-- PASO 2: Ejecutar este script en SQL Editor (políticas RLS)
-- =====================================================

-- Políticas: usuarios autenticados pueden subir, leer y actualizar
DROP POLICY IF EXISTS "Authenticated users can upload poder docs" ON storage.objects;
CREATE POLICY "Authenticated users can upload poder docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'poderes-docs');

DROP POLICY IF EXISTS "Authenticated users can read poder docs" ON storage.objects;
CREATE POLICY "Authenticated users can read poder docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'poderes-docs');

DROP POLICY IF EXISTS "Authenticated users can update poder docs" ON storage.objects;
CREATE POLICY "Authenticated users can update poder docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'poderes-docs');

DROP POLICY IF EXISTS "Authenticated users can delete poder docs" ON storage.objects;
CREATE POLICY "Authenticated users can delete poder docs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'poderes-docs');
