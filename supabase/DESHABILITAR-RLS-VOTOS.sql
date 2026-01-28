-- =====================================================
-- DESHABILITAR RLS EN TABLAS DE VOTACIÓN
-- =====================================================
-- Esto asegura que los votos se puedan guardar sin restricciones

-- Verificar estado actual de RLS
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN 'RLS ACTIVO ❌'
    ELSE 'RLS DESHABILITADO ✅'
  END as estado_rls
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('votos', 'historial_votos', 'preguntas', 'opciones_pregunta', 'unidades');

-- Deshabilitar RLS en todas las tablas necesarias
ALTER TABLE votos DISABLE ROW LEVEL SECURITY;
ALTER TABLE historial_votos DISABLE ROW LEVEL SECURITY;
ALTER TABLE preguntas DISABLE ROW LEVEL SECURITY;
ALTER TABLE opciones_pregunta DISABLE ROW LEVEL SECURITY;
ALTER TABLE unidades DISABLE ROW LEVEL SECURITY;
ALTER TABLE asambleas DISABLE ROW LEVEL SECURITY;
ALTER TABLE poderes DISABLE ROW LEVEL SECURITY;

-- Verificar que se deshabilitó
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN 'RLS ACTIVO ❌'
    ELSE 'RLS DESHABILITADO ✅'
  END as estado_rls
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('votos', 'historial_votos', 'preguntas', 'opciones_pregunta', 'unidades', 'asambleas', 'poderes');

-- Resultado esperado: TODO debe decir "RLS DESHABILITADO ✅"
