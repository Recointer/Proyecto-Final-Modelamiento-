-- Índices para el listado, búsqueda y filtros de juntas (SC-006)
CREATE INDEX junta_nombre_lower_idx ON junta (lower(nombre) text_pattern_ops);
CREATE INDEX junta_ubicacion_idx ON junta (lower(provincia), lower(canton), lower(parroquia));
CREATE INDEX junta_estado_idx ON junta (estado);
