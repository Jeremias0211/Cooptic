-- =====================================================================
-- CoopTIC · DATOS DE PRUEBA (ficticios) para Supabase
-- Ejecutar DESPUÉS de schema.sql, en Supabase → SQL Editor.
--
-- PARTE A: catálogo, tareas y actas (no necesita usuarios).
-- PARTE B: usuarios de prueba + préstamos simulados. Antes de ejecutarla,
--          crear las cuentas en Authentication → Users → "Add user" con el
--          correo DNI@cooptic.escuela (ej. 20111222@cooptic.escuela) y una
--          contraseña elegida por el grupo (no se escribe en ningún archivo).
--          Si una cuenta no existe, esa parte se saltea sin error.
-- =====================================================================

-- ---------------------------- PARTE A --------------------------------
insert into talleres (nombre, plazo_dias) values
  ('Electricidad', 7), ('Carpintería', 7), ('Mecánica', 5), ('Electrónica', 7);

insert into categorias (nombre) values
  ('Herramientas manuales'), ('Herramientas eléctricas'), ('Instrumentos de medición'),
  ('Materiales e insumos'), ('Elementos de seguridad');

insert into herramientas (codigo, nombre, tipo, categoria_id, taller_id, cantidad_total, cantidad_disponible, stock_minimo, estado_general, ubicacion)
select v.codigo, v.nombre, v.tipo, c.id, t.id, v.total, v.total, v.minimo, v.estado, v.ubicacion
from (values
  ('H-001', 'Taladro percutor', 'herramienta', 'Herramientas eléctricas', 'Electricidad', 4, 1, 'bueno', 'Estante A1'),
  ('H-002', 'Destornillador plano', 'herramienta', 'Herramientas manuales', 'Electricidad', 15, 4, 'bueno', 'Cajón B2'),
  ('H-003', 'Pinza universal', 'herramienta', 'Herramientas manuales', 'Electricidad', 12, 3, 'bueno', 'Cajón B3'),
  ('H-004', 'Multímetro digital', 'herramienta', 'Instrumentos de medición', 'Electrónica', 8, 2, 'bueno', 'Armario E1'),
  ('H-005', 'Calibre', 'herramienta', 'Instrumentos de medición', 'Mecánica', 6, 2, 'bueno', 'Armario M1'),
  ('H-006', 'Sierra caladora', 'herramienta', 'Herramientas eléctricas', 'Carpintería', 3, 1, 'regular', 'Estante C1'),
  ('H-007', 'Martillo', 'herramienta', 'Herramientas manuales', 'Carpintería', 10, 3, 'bueno', 'Panel C2'),
  ('H-008', 'Soldador de estaño', 'herramienta', 'Herramientas eléctricas', 'Electrónica', 8, 2, 'bueno', 'Armario E2'),
  ('H-009', 'Llave inglesa', 'herramienta', 'Herramientas manuales', 'Mecánica', 6, 2, 'bueno', 'Panel M2'),
  ('H-010', 'Amoladora angular', 'herramienta', 'Herramientas eléctricas', 'Mecánica', 2, 1, 'en_reparacion', 'Estante M3'),
  ('H-011', 'Pinza pelacables', 'herramienta', 'Herramientas manuales', 'Electricidad', 8, 2, 'bueno', 'Cajón B4'),
  ('H-012', 'Antiparras de seguridad', 'herramienta', 'Elementos de seguridad', 'Mecánica', 20, 6, 'bueno', 'Armario S1'),
  ('H-013', 'Cinta métrica 5 m', 'herramienta', 'Instrumentos de medición', 'Carpintería', 10, 3, 'bueno', 'Cajón C3'),
  ('H-014', 'Serrucho', 'herramienta', 'Herramientas manuales', 'Carpintería', 6, 2, 'bueno', 'Panel C4'),
  ('H-015', 'Pistola de calor', 'herramienta', 'Herramientas eléctricas', 'Electrónica', 2, 1, 'bueno', 'Armario E3'),
  ('H-016', 'Guantes de trabajo (par)', 'herramienta', 'Elementos de seguridad', 'Mecánica', 20, 6, 'bueno', 'Armario S2'),
  ('M-001', 'Cable unipolar 2,5 mm (rollo)', 'material', 'Materiales e insumos', 'Electricidad', 10, 3, 'bueno', 'Depósito D1'),
  ('M-002', 'Estaño (carrete)', 'material', 'Materiales e insumos', 'Electrónica', 12, 4, 'bueno', 'Depósito D2'),
  ('M-003', 'Lija grano 120 (pliego)', 'material', 'Materiales e insumos', 'Carpintería', 40, 10, 'bueno', 'Depósito D3'),
  ('M-004', 'Tornillos (caja x100)', 'material', 'Materiales e insumos', 'Carpintería', 25, 5, 'bueno', 'Depósito D4')
) as v(codigo, nombre, tipo, categoria, taller, total, minimo, estado, ubicacion)
join categorias c on c.nombre = v.categoria
join talleres t on t.nombre = v.taller;

insert into tareas (codigo_integrante, comision, descripcion, fecha_limite, fecha_completada, estado) values
  ('I-01', 'Relevamiento', 'Revisión física del estante A', current_date - 70, current_date - 72, 'completada'),
  ('I-02', 'Documentación y Comunicación', 'Cartel con normas de devolución', current_date - 68, current_date - 69, 'completada'),
  ('I-03', 'Desarrollo y Diseño', 'Pantalla de nuevo préstamo', current_date - 65, current_date - 60, 'completada'),
  ('I-04', 'Relevamiento', 'Etiquetar herramientas de carpintería', current_date - 62, current_date - 63, 'completada'),
  ('I-01', 'Relevamiento', 'Control de stock de materiales', current_date - 40, current_date - 41, 'completada'),
  ('I-05', 'Documentación y Comunicación', 'Manual de uso para pañoleros', current_date - 38, current_date - 38, 'completada'),
  ('I-03', 'Desarrollo y Diseño', 'Reporte de stock bajo', current_date - 36, current_date - 37, 'completada'),
  ('I-06', 'Desarrollo y Diseño', 'Pruebas en celulares', current_date - 33, current_date - 30, 'completada'),
  ('I-02', 'Documentación y Comunicación', 'Aviso de vencimientos por curso', current_date - 31, current_date - 32, 'completada'),
  ('I-04', 'Relevamiento', 'Inventario de taller de mecánica', current_date - 29, current_date - 29, 'completada'),
  ('I-01', 'Relevamiento', 'Revisión de herramientas dañadas', current_date - 8, current_date - 9, 'completada'),
  ('I-05', 'Documentación y Comunicación', 'Acta de la reunión mensual', current_date - 5, current_date - 5, 'completada'),
  ('I-03', 'Desarrollo y Diseño', 'Tablero de indicadores', current_date - 2, null, 'pendiente'),
  ('I-06', 'Desarrollo y Diseño', 'Conexión con Supabase', current_date + 6, null, 'pendiente'),
  ('I-04', 'Relevamiento', 'Control de fin de mes', current_date + 10, null, 'pendiente');

insert into actas (fecha, participantes, temas, decisiones, responsables) values
  (current_date - 75, 'Directivo (L. F.), 2 profesores, 6 alumnos de las comisiones', 'Organización del pañol y normas de préstamo.',
   'Se aprueba el plazo de 7 días para préstamos (5 en Mecánica). Se registran todas las roturas en el sistema.', 'Comisión de Documentación: cartel de normas (2 semanas).'),
  (current_date - 40, '2 profesores, 5 alumnos', 'Revisión de KPI del mes y herramientas dañadas.',
   'Se pide reponer una cinta métrica. Se acuerda avisar vencimientos un día antes.', 'Relevamiento: lista de herramientas a reparar (1 semana).'),
  (current_date - 8, 'Directivo, 3 profesores, 7 alumnos', 'Demanda de taladros y conexión del sistema con base de datos.',
   'Se evalúa comprar 2 taladros. Desarrollo comienza la conexión con Supabase.', 'Desarrollo y Diseño: primera versión conectada (fin de mes).');

-- ---------------------------- PARTE B --------------------------------
-- Asigna nombre, rol y curso a las cuentas de prueba (si existen) y las activa
update perfiles p set nombre = v.nombre, rol = v.rol, curso = v.curso, cursos = v.cursos, activo = v.activo,
  taller_id = (select id from talleres where nombre = v.taller)
from (values
  ('20111222', 'Laura Fernández', 'admin', null, '{}'::text[], null, true),
  ('25333444', 'Ricardo Gómez', 'panolero', null, '{}'::text[], 'Electricidad', true),
  ('26444555', 'Marta Sosa', 'panolero', null, '{}'::text[], 'Carpintería', true),
  ('28555666', 'Pablo Herrera', 'docente', null, '{5°1,5°2}'::text[], 'Electricidad', true),
  ('29666777', 'Silvia Ríos', 'docente', null, '{6°1,7°1}'::text[], 'Mecánica', true),
  ('47111222', 'Tomás Martínez', 'alumno', '5°1', '{}'::text[], null, true),
  ('47222333', 'Lucía Benítez', 'alumno', '5°2', '{}'::text[], null, true),
  ('46333444', 'Joaquín Pereyra', 'alumno', '6°1', '{}'::text[], null, true),
  ('45444555', 'Valentina Acosta', 'alumno', '7°1', '{}'::text[], null, true),
  ('46555666', 'Franco Díaz', 'alumno', '6°1', '{}'::text[], null, true),
  ('47666777', 'Camila Romero', 'alumno', '5°1', '{}'::text[], null, true),
  ('47777888', 'Mateo Ruiz', 'alumno', '5°2', '{}'::text[], null, false)
) as v(dni, nombre, rol, curso, cursos, taller, activo)
where p.dni = v.dni;

-- Préstamos simulados: (dni, código, cantidad, días atrás, plazo, días hasta devolver, estado al devolver, observaciones)
-- días hasta devolver = null → sigue activo; -1 → cancelado
do $$
declare
  r record;
  v_persona perfiles%rowtype;
  v_panolero uuid := (select id from perfiles where dni = '25333444');
  v_herr bigint;
  v_prestamo bigint;
  v_salida date;
begin
  if v_panolero is null then
    raise notice 'No existe la cuenta del pañolero (25333444): se omiten los préstamos de prueba.';
    return;
  end if;

  for r in select * from (values
    ('47111222', 'H-001', 1, 95, 7, 6, 'bueno', null),
    ('47222333', 'H-002', 3, 93, 7, 7, 'bueno', null),
    ('46333444', 'H-005', 1, 92, 5, 9, 'bueno', 'Devuelto tarde, sin daños.'),
    ('45444555', 'H-004', 2, 90, 7, 5, 'bueno', null),
    ('28555666', 'H-003', 6, 88, 7, 7, 'bueno', null),
    ('46555666', 'H-007', 2, 86, 7, 6, 'danado', 'Mango de un martillo partido.'),
    ('47666777', 'H-001', 1, 84, 7, 10, 'bueno', null),
    ('47111222', 'H-004', 1, 64, 7, 6, 'bueno', null),
    ('47222333', 'H-008', 2, 62, 7, 7, 'bueno', null),
    ('46333444', 'H-009', 1, 61, 5, 4, 'bueno', null),
    ('29666777', 'H-012', 10, 60, 5, 5, 'bueno', null),
    ('45444555', 'H-001', 1, 58, 7, 12, 'bueno', 'Devuelto con demora.'),
    ('46555666', 'H-013', 1, 57, 7, 7, 'perdido', 'El alumno no la encuentra.'),
    ('47666777', 'H-002', 2, 55, 7, 6, 'bueno', null),
    ('47111222', 'M-001', 1, 54, 7, 7, 'bueno', null),
    ('28555666', 'H-011', 4, 53, 7, 7, 'bueno', null),
    ('47222333', 'H-001', 1, 34, 7, 7, 'bueno', null),
    ('46333444', 'H-005', 2, 33, 5, 5, 'bueno', null),
    ('45444555', 'H-008', 1, 32, 7, 9, 'danado', 'Punta del soldador dañada.'),
    ('47111222', 'H-003', 2, 31, 7, 6, 'bueno', null),
    ('46555666', 'H-004', 1, 30, 7, 11, 'bueno', 'Devuelto fuera de término.'),
    ('47666777', 'H-014', 1, 29, 7, 7, 'bueno', null),
    ('29666777', 'H-016', 8, 28, 5, 5, 'bueno', null),
    ('47222333', 'H-002', 2, 27, 7, -1, null, null),
    ('46333444', 'H-001', 1, 26, 7, 7, 'bueno', null),
    ('28555666', 'M-002', 3, 25, 7, 6, 'bueno', null),
    ('47111222', 'H-001', 1, 12, 7, null, null, null),
    ('45444555', 'H-004', 1, 10, 7, 8, 'bueno', null),
    ('46555666', 'H-003', 1, 9, 5, null, null, null),
    ('47666777', 'H-007', 1, 6, 7, 5, 'bueno', null),
    ('47222333', 'H-008', 1, 5, 7, null, null, null),
    ('46333444', 'H-009', 1, 3, 5, null, null, null),
    ('28555666', 'H-002', 5, 2, 7, null, null, null),
    ('47111222', 'H-013', 1, 1, 7, null, null, null),
    ('45444555', 'H-005', 1, 0, 7, null, null, null)
  ) as t(dni, codigo, cantidad, atras, plazo, devolver, estado, obs)
  loop
    select * into v_persona from perfiles where dni = r.dni;
    continue when not found;
    v_herr := (select id from herramientas where codigo = r.codigo);
    v_salida := current_date - r.atras;

    insert into prestamos (persona_id, curso, herramienta_id, cantidad, fecha_salida, fecha_limite, estado_al_prestar, estado, panolero_id, motivo_cancelacion)
    values (v_persona.id, coalesce(v_persona.curso, v_persona.cursos[1]), v_herr, r.cantidad, v_salida, v_salida + r.plazo, 'bueno',
            case when r.devolver is null then 'activo' when r.devolver = -1 then 'cancelado' else 'devuelto' end,
            v_panolero, case when r.devolver = -1 then 'Error de carga: se registró dos veces.' end)
    returning id into v_prestamo;

    if r.devolver >= 0 then
      insert into devoluciones (prestamo_id, fecha_real, estado_al_devolver, observaciones, panolero_id)
      values (v_prestamo, v_salida + r.devolver, r.estado, r.obs, v_panolero);
      if r.estado <> 'bueno' then
        insert into incidencias (tipo, herramienta_id, prestamo_id, responsable_id, cantidad, fecha, descripcion)
        values (case when r.estado = 'danado' then 'rotura' else 'perdida' end, v_herr, v_prestamo, v_persona.id, r.cantidad, v_salida + r.devolver, r.obs);
      end if;
    end if;
  end loop;

  -- Martillo roto: resuelto con baja; amoladora con falla detectada en el pañol
  update incidencias set estado = 'resuelta', accion = 'baja', resolucion = 'Sin arreglo posible. Se repuso por compra.', fecha_resolucion = current_date - 79
  where herramienta_id = (select id from herramientas where codigo = 'H-007');
  -- (la baja de 2 martillos se compensa con la reposición recibida de 2: el total queda igual)
  insert into incidencias (tipo, herramienta_id, cantidad, fecha, descripcion)
  values ('rotura', (select id from herramientas where codigo = 'H-010'), 1, current_date - 51, 'Falla del motor detectada en revisión del pañol.');

  -- Solicitudes de docentes
  insert into solicitudes_prestamo (docente_id, herramienta_id, cantidad, fecha, fecha_clase, curso, motivo, estado, respuesta)
  select d.id, h.id, v.cantidad, current_date - v.atras, current_date - v.atras + 1, v.curso, 'Clase práctica', v.estado, v.respuesta
  from (values
    ('28555666', 'H-003', 6, 89, '5°1', 'atendida', null),
    ('29666777', 'H-012', 10, 61, '6°1', 'atendida', null),
    ('28555666', 'H-011', 4, 54, '5°2', 'atendida', null),
    ('29666777', 'H-010', 2, 50, '7°1', 'rechazada', 'Amoladoras en reparación.'),
    ('29666777', 'H-016', 8, 29, '6°1', 'atendida', null),
    ('28555666', 'M-002', 3, 26, '5°1', 'atendida', null),
    ('28555666', 'H-001', 4, 24, '5°2', 'rechazada', 'No hay stock suficiente de taladros.'),
    ('28555666', 'H-002', 5, 3, '5°1', 'atendida', null),
    ('29666777', 'H-005', 4, 2, '7°1', 'pendiente', null),
    ('29666777', 'H-015', 2, 1, '6°1', 'pendiente', null)
  ) as v(dni, codigo, cantidad, atras, curso, estado, respuesta)
  join perfiles d on d.dni = v.dni
  join herramientas h on h.codigo = v.codigo;

  -- Pedidos de ALUMNOS con autorización digital del docente
  -- (alumno, docente, código, cantidad, horas desde el pedido, estado, horas desde la respuesta,
  --  código de retiro, cantidad autorizada, motivo, respuesta)
  -- La 4.ª queda "autorizada" pero fue autorizada hace 72 h: la app la muestra como VENCIDA.
  insert into solicitudes_prestamo (alumno_id, docente_id, herramienta_id, cantidad, fecha, fecha_clase, curso, motivo, estado, respuesta,
                                    autorizado_por, fecha_autorizacion, vence, codigo_retiro, cantidad_autorizada, fecha_limite)
  select a.id, d.id, h.id, v.cantidad, (now() - v.horas_pedido * interval '1 hour')::date, (now() - v.horas_pedido * interval '1 hour')::date,
         a.curso, v.motivo, v.estado, v.respuesta,
         case when v.horas_resp is not null then d.id end,
         now() - v.horas_resp * interval '1 hour',
         case when v.estado in ('autorizada', 'retirada') then now() - v.horas_resp * interval '1 hour' + interval '48 hours' end,
         v.codigo, v.cant_aut,
         case when v.estado in ('autorizada', 'retirada') then current_date + 7 end
  from (values
    ('47111222', '28555666', 'H-011', 1, 3, 'esperando_autorizacion', null::int, null, null::int, 'Práctica de empalmes en el taller', null),
    ('47666777', '28555666', 'H-004', 1, 20, 'esperando_autorizacion', null, null, null, 'Medir tensión en el tablero didáctico', null),
    ('47222333', '28555666', 'H-002', 3, 5, 'autorizada', 2, 'K7MP', 2, 'Armado del tablero del trabajo práctico', null),
    ('46333444', '29666777', 'H-016', 2, 80, 'autorizada', 72, 'R4TX', 2, 'Práctica de ajuste en el banco de trabajo', null),
    ('46555666', '29666777', 'H-010', 1, 30, 'rechazada', 26, null, null, 'Corte de perfiles para el proyecto', 'La amoladora está en reparación. Usá la sierra de mano con supervisión.'),
    ('45444555', '29666777', 'H-005', 1, 26, 'retirada', 20, 'W8HB', 1, 'Medición de piezas torneadas', null)
  ) as v(alumno, docente, codigo_h, cantidad, horas_pedido, estado, horas_resp, codigo, cant_aut, motivo, respuesta)
  join perfiles a on a.dni = v.alumno
  join perfiles d on d.dni = v.docente
  join herramientas h on h.codigo = v.codigo_h;

  -- La retirada queda vinculada con el préstamo de hoy de Valentina (calibre)
  update solicitudes_prestamo s set prestamo_id = p.id
  from prestamos p
  where s.estado = 'retirada' and s.alumno_id is not null and p.persona_id = s.alumno_id
    and p.herramienta_id = s.herramienta_id and p.fecha_salida = current_date;
  update prestamos p set solicitud_id = s.id
  from solicitudes_prestamo s
  where s.prestamo_id = p.id and s.estado = 'retirada';

  -- Autorización de CLASE activa hoy: 6°1 puede retirar 1 par de antiparras por alumno (Prof. Silvia Ríos)
  insert into autorizaciones_clase (docente_id, curso, herramienta_id, cantidad_por_alumno, fecha)
  select d.id, '6°1', h.id, 1, current_date
  from perfiles d, herramientas h
  where d.dni = '29666777' and h.codigo = 'H-012';

  -- Pedidos de reposición
  insert into solicitudes_reposicion (herramienta_id, cantidad, solicitante_id, fecha, motivo, estado, respuesta)
  select h.id, v.cantidad, s.id, current_date - v.atras, v.motivo, v.estado, v.respuesta
  from (values
    ('H-007', 2, '26444555', 80, 'Reponer martillo roto.', 'recibida', 'Comprado con fondos de la cooperativa.'),
    ('H-013', 2, '28555666', 50, 'Falta una cinta métrica y hay mucha demanda.', 'aprobada', 'Se compra el mes próximo.'),
    ('H-001', 2, '25333444', 20, 'Los taladros no alcanzan para una clase completa.', 'pendiente', null),
    ('M-003', 20, '28555666', 6, 'Lijas para el trabajo práctico de 5° año.', 'pendiente', null)
  ) as v(codigo, cantidad, dni, atras, motivo, estado, respuesta)
  join herramientas h on h.codigo = v.codigo
  join perfiles s on s.dni = v.dni;
end $$;

-- Recalcula el stock disponible para que coincida con los préstamos activos
-- e incidencias abiertas cargadas arriba
update herramientas h set cantidad_disponible = greatest(0,
  h.cantidad_total
  - coalesce((select sum(cantidad) from prestamos p where p.herramienta_id = h.id and p.estado = 'activo'), 0)
  - coalesce((select sum(cantidad) from incidencias i where i.herramienta_id = h.id and i.estado = 'abierta'), 0)
);
