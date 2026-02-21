-- =====================================================
-- FIX: Error al revocar poder - constraint UNIQUE
-- =====================================================
-- Problema: UNIQUE(asamblea_id, unidad_otorgante_id, estado)
-- impide tener varios poderes 'revocado' para la misma
-- unidad (ej. revocó → nuevo poder → revocar de nuevo).
--
-- Solución: Solo exigir unicidad para poderes ACTIVOS.
-- Ejecutar en Supabase → SQL Editor
-- =====================================================

-- 1. Eliminar la restricción UNIQUE actual
ALTER TABLE poderes DROP CONSTRAINT IF EXISTS poderes_asamblea_id_unidad_otorgante_id_estado_key;

-- 2. Crear índice único PARCIAL: solo para estado='activo'
-- Así una unidad solo puede tener UN poder activo por asamblea,
-- pero puede tener varios revocados (historial)
CREATE UNIQUE INDEX IF NOT EXISTS poderes_activo_por_unidad_asamblea
ON poderes(asamblea_id, unidad_otorgante_id)
WHERE estado = 'activo';
