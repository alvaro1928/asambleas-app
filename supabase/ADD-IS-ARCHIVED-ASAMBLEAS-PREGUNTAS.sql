-- =====================================================
-- Archivado de Asambleas y Preguntas
-- =====================================================
-- is_archived en asambleas: mueve la asamblea al panel "Archivadas" en la UI.
-- is_archived en preguntas: no se incluyen en el acta PDF ni en reportes consolidados.
-- =====================================================

-- asambleas
ALTER TABLE asambleas
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN asambleas.is_archived IS 'True = asamblea archivada; se muestra en panel Archivadas y puede desarchivarse.';

CREATE INDEX IF NOT EXISTS idx_asambleas_is_archived ON asambleas(is_archived) WHERE is_archived = true;

-- preguntas
ALTER TABLE preguntas
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN preguntas.is_archived IS 'True = pregunta archivada; no se incluye en el acta final ni en reportes consolidados.';

CREATE INDEX IF NOT EXISTS idx_preguntas_is_archived ON preguntas(is_archived) WHERE is_archived = true;
