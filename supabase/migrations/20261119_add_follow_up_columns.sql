-- ==============================================================================
-- Migración: Columnas de Seguimiento y Próxima Acción Comercial
-- Tabla: public.prospects
-- ==============================================================================

-- Añade la columna 'next_action' (texto descriptivo del siguiente paso con el cliente)
ALTER TABLE public.prospects 
ADD COLUMN IF NOT EXISTS next_action text;

-- Añade la columna 'follow_up_date' (fecha objetivo del próximo contacto/recordatorio)
ALTER TABLE public.prospects 
ADD COLUMN IF NOT EXISTS follow_up_date date;

-- Índice para optimizar consultas y filtros por fecha de seguimiento
CREATE INDEX IF NOT EXISTS idx_prospects_follow_up_date 
ON public.prospects(follow_up_date);

-- Comentario explicativo en el catálogo de PostgreSQL
COMMENT ON COLUMN public.prospects.next_action IS 'Descripción del siguiente paso o tarea comercial con el prospecto (ej: llamar para confirmar propuesta, reagendar reunión)';
COMMENT ON COLUMN public.prospects.follow_up_date IS 'Fecha límite programada para la siguiente acción de seguimiento comercial';
