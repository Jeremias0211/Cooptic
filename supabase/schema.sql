-- =====================================================================
-- CoopTIC · Sistema de gestión del pañol
-- Estructura de la base de datos para Supabase (PostgreSQL)
--
-- Cómo usarlo: Supabase → SQL Editor → pegar este archivo completo → Run.
-- Se puede volver a ejecutar: primero borra lo que existe (¡borra datos!).
--
-- Contenido:
--   1. Tablas, claves y relaciones
--   2. Funciones auxiliares de rol
--   3. Perfil automático al crear una cuenta
--   4. Operaciones con reglas de negocio (RPC)
--   5. KPI mensual (sin datos personales)
--   6. Políticas de acceso por rol (RLS)
--
-- Incluye la AUTORIZACIÓN DIGITAL DEL DOCENTE (reemplaza la notita en papel):
--   alumno pide → docente autoriza (código de 4 caracteres, vale 48 h) → pañolero entrega.
-- Para agregarla a una base que ya existe sin borrar datos: migracion_autorizacion_docente.sql
-- =====================================================================

drop table if exists actas, tareas, solicitudes_reposicion, solicitudes_prestamo,
  incidencias, devoluciones, prestamos, autorizaciones_clase, herramientas, perfiles, categorias, talleres cascade;

-- =====================================================================
-- 1. TABLAS
-- =====================================================================

create table talleres (
  id          bigint generated always as identity primary key,
  nombre      text not null unique,
  plazo_dias  int  not null default 7 check (plazo_dias between 1 and 60), -- plazo de devolución por defecto
  activo      boolean not null default true
);

create table categorias (
  id      bigint generated always as identity primary key,
  nombre  text not null unique,
  activo  boolean not null default true
);

-- Un perfil por cada cuenta de Supabase Auth (la contraseña la guarda Auth cifrada)
create table perfiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  nombre    text not null,
  dni       text unique check (dni ~ '^\d{7,8}$'),
  rol       text not null default 'alumno' check (rol in ('admin', 'panolero', 'docente', 'alumno')),
  curso     text,                         -- curso del alumno (ej. 5°1)
  cursos    text[] not null default '{}', -- cursos a cargo del docente
  taller_id bigint references talleres (id),
  activo    boolean not null default false, -- el administrador activa la cuenta
  creado    timestamptz not null default now()
);

create table herramientas (
  id                  bigint generated always as identity primary key,
  codigo              text not null unique check (codigo ~ '^[A-Z]{1,3}-\d{3}$'),
  nombre              text not null,
  tipo                text not null default 'herramienta' check (tipo in ('herramienta', 'material')),
  categoria_id        bigint not null references categorias (id),
  taller_id           bigint not null references talleres (id),
  cantidad_total      int not null check (cantidad_total >= 0),
  cantidad_disponible int not null,
  stock_minimo        int not null default 1 check (stock_minimo >= 0),
  estado_general      text not null default 'bueno' check (estado_general in ('bueno', 'regular', 'en_reparacion', 'fuera_de_servicio')),
  ubicacion           text,
  activo              boolean not null default true, -- baja lógica: no se borra para conservar el historial
  check (cantidad_disponible between 0 and cantidad_total)
);

-- Autorización de un docente para que TODA una clase retire una herramienta un día determinado.
-- Cada alumno del curso puede retirar una sola vez con ella (ver índice único en prestamos).
create table autorizaciones_clase (
  id                  bigint generated always as identity primary key,
  docente_id          uuid not null references perfiles (id),
  curso               text not null,
  herramienta_id      bigint not null references herramientas (id),
  cantidad_por_alumno int not null check (cantidad_por_alumno > 0),
  fecha               date not null, -- día en que vale
  estado              text not null default 'activa' check (estado in ('activa', 'cancelada')),
  creado              timestamptz not null default now()
);

-- Un préstamo NO se borra: solo cambia de estado (activo → devuelto / cancelado)
create table prestamos (
  id                 bigint generated always as identity primary key,
  numero             int generated always as identity (start with 101) unique,
  persona_id         uuid not null references perfiles (id),
  curso              text, -- se copia del perfil al prestar (sirve para filtrar por curso)
  herramienta_id     bigint not null references herramientas (id),
  cantidad           int not null check (cantidad > 0),
  fecha_salida       date not null default current_date,
  fecha_limite       date not null,
  estado_al_prestar  text not null check (estado_al_prestar in ('bueno', 'regular')),
  estado             text not null default 'activo' check (estado in ('activo', 'devuelto', 'cancelado')),
  panolero_id        uuid not null references perfiles (id),
  motivo_cancelacion text,
  solicitud_id       bigint,
  autorizacion_clase_id bigint references autorizaciones_clase (id), -- retiro con autorización de clase
  creado             timestamptz not null default now(),
  check (fecha_limite >= fecha_salida)
);

-- Una devolución por préstamo (relación 1 a 1)
create table devoluciones (
  id                 bigint generated always as identity primary key,
  prestamo_id        bigint not null unique references prestamos (id),
  fecha_real         date not null default current_date,
  estado_al_devolver text not null check (estado_al_devolver in ('bueno', 'danado', 'perdido')),
  observaciones      text,
  panolero_id        uuid not null references perfiles (id)
);

create table incidencias (
  id               bigint generated always as identity primary key,
  tipo             text not null check (tipo in ('rotura', 'perdida')),
  herramienta_id   bigint not null references herramientas (id),
  prestamo_id      bigint references prestamos (id),
  responsable_id   uuid references perfiles (id),
  cantidad         int not null check (cantidad > 0),
  fecha            date not null default current_date,
  descripcion      text,
  estado           text not null default 'abierta' check (estado in ('abierta', 'resuelta')),
  accion           text check (accion in ('reparada', 'repuesta', 'baja')),
  resolucion       text,
  fecha_resolucion date
);

-- Solicitudes de préstamo (fuente del KPI "solicitudes atendidas"). Dos tipos:
--   * de DOCENTE para su clase (alumno_id vacío): pendiente → atendida / rechazada / cancelada
--   * de ALUMNO con autorización digital del docente (reemplaza la notita en papel):
--     esperando_autorizacion → autorizada → retirada (o rechazada / cancelada).
--     "vencida" no se guarda: se calcula comparando "vence" con la fecha y hora actuales.
create table solicitudes_prestamo (
  id                  bigint generated always as identity primary key,
  docente_id          uuid not null references perfiles (id), -- quien pide (docente) o quien tiene que autorizar (alumno)
  alumno_id           uuid references perfiles (id),          -- vacío = solicitud de docente
  herramienta_id      bigint not null references herramientas (id),
  cantidad            int not null check (cantidad > 0),      -- lo que se pidió
  fecha               date not null default current_date,
  fecha_clase         date not null default current_date,
  curso               text not null,
  motivo              text,
  estado              text not null default 'pendiente' check (estado in (
                        'pendiente', 'atendida', 'rechazada', 'cancelada',               -- solicitudes de docentes
                        'esperando_autorizacion', 'autorizada', 'retirada', 'vencida')), -- solicitudes de alumnos
  respuesta           text,
  prestamo_id         bigint references prestamos (id),
  autorizado_por      uuid references perfiles (id),          -- docente que respondió (autorizó o rechazó)
  fecha_autorizacion  timestamptz,
  vence               timestamptz,                            -- autorización + 48 horas
  codigo_retiro       text check (codigo_retiro ~ '^[A-HJ-NP-Z2-9]{4}$'), -- sin 0/O ni 1/I
  cantidad_autorizada int check (cantidad_autorizada > 0),    -- el docente puede reducirla
  fecha_limite        date,                                   -- devolución fijada por el docente
  constraint solicitudes_estado_segun_tipo check (
    (alumno_id is null and estado in ('pendiente', 'atendida', 'rechazada', 'cancelada'))
    or (alumno_id is not null and estado in ('esperando_autorizacion', 'autorizada', 'retirada', 'rechazada', 'vencida', 'cancelada'))
  ),
  constraint solicitudes_autorizada_completa check (
    estado not in ('autorizada', 'retirada') or alumno_id is null
    or (autorizado_por is not null and vence is not null and codigo_retiro is not null and cantidad_autorizada is not null and fecha_limite is not null)
  ),
  constraint solicitudes_motivo_alumno check (
    alumno_id is null or (motivo is not null and char_length(trim(motivo)) between 5 and 200)
  )
);

alter table prestamos add constraint prestamos_solicitud_fk foreign key (solicitud_id) references solicitudes_prestamo (id);

create table solicitudes_reposicion (
  id             bigint generated always as identity primary key,
  herramienta_id bigint not null references herramientas (id),
  cantidad       int not null check (cantidad > 0),
  solicitante_id uuid not null references perfiles (id),
  fecha          date not null default current_date,
  motivo         text,
  estado         text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada', 'recibida')),
  respuesta      text
);

-- Tareas de las comisiones (KPI 4). Se usan códigos (I-01) en lugar de nombres.
create table tareas (
  id                bigint generated always as identity primary key,
  codigo_integrante text not null check (codigo_integrante ~ '^I-\d{2}$'),
  comision          text not null check (comision in ('Relevamiento', 'Documentación y Comunicación', 'Desarrollo y Diseño')),
  descripcion       text not null,
  fecha_limite      date not null,
  fecha_completada  date,
  estado            text not null default 'pendiente' check (estado in ('pendiente', 'completada', 'cancelada'))
);

-- Registro de acuerdos (Reglamento, Cap. VI)
create table actas (
  id            bigint generated always as identity primary key,
  fecha         date not null,
  participantes text not null,
  temas         text not null,
  decisiones    text not null,
  responsables  text
);

create index on prestamos (persona_id);
create index on prestamos (herramienta_id);
create index on prestamos (estado, fecha_limite);
create index on incidencias (herramienta_id, estado);
create index solicitudes_alumno on solicitudes_prestamo (alumno_id, estado);
-- El código de retiro es único entre las autorizadas (no se repite mientras se puede usar)
create unique index solicitudes_codigo_autorizada on solicitudes_prestamo (codigo_retiro) where estado = 'autorizada';
-- Cada alumno retira UNA sola vez por autorización de clase (los préstamos cancelados no cuentan)
create unique index prestamos_un_retiro_por_clase on prestamos (autorizacion_clase_id, persona_id)
  where autorizacion_clase_id is not null and estado <> 'cancelado';

-- =====================================================================
-- 2. FUNCIONES AUXILIARES DE ROL
-- security definer: leen perfiles sin quedar bloqueadas por RLS
-- =====================================================================

create or replace function mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid() and activo
$$;

create or replace function mis_cursos() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(cursos, '{}') from perfiles where id = auth.uid() and activo
$$;

create or replace function exigir_rol(variadic roles text[]) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if mi_rol() is null or not (mi_rol() = any (roles)) then
    raise exception 'No tenés permiso para realizar esta operación.';
  end if;
end $$;

create or replace function mi_curso() returns text
language sql stable security definer set search_path = public as $$
  select curso from perfiles where id = auth.uid() and activo
$$;

-- ¿Ese docente está activo y tiene a cargo ese curso?
create or replace function es_docente_del_curso(p_docente uuid, p_curso text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = p_docente and rol = 'docente' and activo and p_curso = any (cursos))
$$;

-- Nombres y cursos de los docentes activos (sin DNI). El alumno lo usa para elegir
-- quién lo autoriza y las pantallas para mostrar "Autorizó: Prof. X".
create or replace function listar_docentes() returns table (id uuid, nombre text, cursos text[])
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre, p.cursos from perfiles p
  where p.rol = 'docente' and p.activo and mi_rol() is not null
  order by p.nombre
$$;

-- =====================================================================
-- 3. PERFIL AUTOMÁTICO AL CREAR UNA CUENTA
-- Toda cuenta nueva nace como "alumno" INACTIVO. El administrador la activa
-- y le asigna rol desde la app. Así nadie puede darse permisos a sí mismo.
-- =====================================================================

create or replace function crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre, dni)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    case when split_part(new.email, '@', 1) ~ '^\d{7,8}$' then split_part(new.email, '@', 1) end
  );
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function crear_perfil();

-- =====================================================================
-- 4. OPERACIONES (RPC) — se llaman desde Vue con supabase.rpc(...)
-- Cada una valida el rol, bloquea la fila y mantiene el stock coherente.
-- =====================================================================

-- Registrar préstamo. Si la persona es ALUMNO exige una autorización digital vigente:
--   a) una solicitud "autorizada" a su nombre, no vencida, por esa herramienta y cantidad, o
--   b) una autorización de clase activa de hoy para su curso que todavía no usó.
-- Si no se indica cuál, se busca sola. Al prestar, la solicitud pasa a "retirada".
create or replace function registrar_prestamo(
  p_persona uuid, p_herramienta bigint, p_cantidad int, p_fecha_limite date,
  p_estado text, p_solicitud bigint default null, p_autorizacion_clase bigint default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  h herramientas%rowtype;
  per perfiles%rowtype;
  s solicitudes_prestamo%rowtype;
  a autorizaciones_clase%rowtype;
  v_solicitud bigint := p_solicitud;
  v_clase bigint := p_autorizacion_clase;
  v_id bigint;
  v_numero int;
begin
  perform exigir_rol('admin', 'panolero');

  select * into per from perfiles where id = p_persona;
  if not found or not per.activo then raise exception 'La persona no existe o está inactiva.'; end if;

  select * into h from herramientas where id = p_herramienta for update; -- bloquea para evitar dos préstamos a la vez
  if not found or not h.activo then raise exception 'La herramienta no existe o está dada de baja.'; end if;
  if p_cantidad is null or p_cantidad < 1 then raise exception 'La cantidad debe ser al menos 1.'; end if;
  if h.cantidad_disponible < p_cantidad then
    raise exception 'Stock insuficiente: hay % disponibles de "%".', h.cantidad_disponible, h.nombre;
  end if;
  if p_fecha_limite < current_date then raise exception 'La fecha de devolución no puede ser anterior a hoy.'; end if;
  if p_estado not in ('bueno', 'regular') then raise exception 'Estado al prestar no válido.'; end if;

  if per.rol = 'alumno' then
    if v_solicitud is not null then
      select * into s from solicitudes_prestamo where id = v_solicitud for update;
      if not found or s.alumno_id is distinct from p_persona then raise exception 'La autorización no corresponde a este alumno.'; end if;
      if s.estado <> 'autorizada' then raise exception 'Esa solicitud no está autorizada para retirar (estado: %).', s.estado; end if;
      if s.vence < now() then raise exception 'La autorización venció: pasaron más de 48 horas sin retirarla.'; end if;
      if s.herramienta_id <> p_herramienta then raise exception 'La autorización es para otra herramienta.'; end if;
      if p_cantidad > s.cantidad_autorizada then raise exception 'El docente autorizó como máximo % unidad(es).', s.cantidad_autorizada; end if;
    elsif v_clase is not null then
      select * into a from autorizaciones_clase where id = v_clase for update;
      if not found or a.estado <> 'activa' or a.fecha <> current_date then raise exception 'La autorización de clase no está vigente hoy.'; end if;
      if a.curso is distinct from per.curso then raise exception 'La autorización de clase es para otro curso (%).', a.curso; end if;
      if a.herramienta_id <> p_herramienta then raise exception 'La autorización de clase es para otra herramienta.'; end if;
      if p_cantidad > a.cantidad_por_alumno then raise exception 'La autorización de clase permite % unidad(es) por alumno.', a.cantidad_por_alumno; end if;
      if exists (select 1 from prestamos where autorizacion_clase_id = a.id and persona_id = p_persona and estado <> 'cancelado') then
        raise exception 'Este alumno ya retiró con esta autorización de clase.';
      end if;
    else
      -- No se indicó: se busca primero una solicitud autorizada y después una autorización de clase
      select * into s from solicitudes_prestamo
      where alumno_id = p_persona and estado = 'autorizada' and vence >= now()
        and herramienta_id = p_herramienta and cantidad_autorizada >= p_cantidad
      order by vence limit 1 for update;
      if found then
        v_solicitud := s.id;
      else
        select * into a from autorizaciones_clase ac
        where ac.estado = 'activa' and ac.fecha = current_date and ac.curso = per.curso
          and ac.herramienta_id = p_herramienta and ac.cantidad_por_alumno >= p_cantidad
          and not exists (select 1 from prestamos pr where pr.autorizacion_clase_id = ac.id and pr.persona_id = p_persona and pr.estado <> 'cancelado')
        order by ac.id limit 1 for update;
        if found then
          v_clase := a.id;
        else
          raise exception 'El alumno no tiene autorización vigente de un docente.';
        end if;
      end if;
    end if;
  else
    if v_clase is not null then raise exception 'Las autorizaciones de clase son solo para alumnos.'; end if;
    if v_solicitud is not null and exists (select 1 from solicitudes_prestamo where id = v_solicitud and alumno_id is not null) then
      raise exception 'Esa solicitud es de un alumno: el préstamo tiene que ser a su nombre.';
    end if;
  end if;

  insert into prestamos (persona_id, curso, herramienta_id, cantidad, fecha_limite, estado_al_prestar, panolero_id, solicitud_id, autorizacion_clase_id)
  values (p_persona, coalesce(per.curso, per.cursos[1]), p_herramienta, p_cantidad, p_fecha_limite, p_estado, auth.uid(), v_solicitud, v_clase)
  returning id, numero into v_id, v_numero;

  update herramientas set cantidad_disponible = cantidad_disponible - p_cantidad where id = p_herramienta;

  if v_solicitud is not null then
    -- docente: pendiente → atendida | alumno: autorizada → retirada
    update solicitudes_prestamo
    set estado = case when alumno_id is null then 'atendida' else 'retirada' end, prestamo_id = v_id
    where id = v_solicitud and estado in ('pendiente', 'autorizada');
  end if;

  return v_numero;
end $$;

create or replace function registrar_devolucion(p_prestamo bigint, p_estado text, p_observaciones text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare
  p prestamos%rowtype;
begin
  perform exigir_rol('admin', 'panolero');
  select * into p from prestamos where id = p_prestamo for update;
  if not found then raise exception 'El préstamo no existe.'; end if;
  if p.estado <> 'activo' then raise exception 'Este préstamo ya fue cerrado.'; end if;
  if p_estado not in ('bueno', 'danado', 'perdido') then raise exception 'Estado al devolver no válido.'; end if;
  if p_estado <> 'bueno' and coalesce(trim(p_observaciones), '') = '' then
    raise exception 'Describí qué ocurrió con el elemento.';
  end if;

  insert into devoluciones (prestamo_id, estado_al_devolver, observaciones, panolero_id)
  values (p_prestamo, p_estado, p_observaciones, auth.uid());

  update prestamos set estado = 'devuelto' where id = p_prestamo;

  if p_estado = 'bueno' then
    update herramientas set cantidad_disponible = cantidad_disponible + p.cantidad where id = p.herramienta_id;
  else
    -- No vuelve al stock: queda registrado para reposición a nombre de quien lo tenía
    insert into incidencias (tipo, herramienta_id, prestamo_id, responsable_id, cantidad, descripcion)
    values (case when p_estado = 'danado' then 'rotura' else 'perdida' end, p.herramienta_id, p.id, p.persona_id, p.cantidad, p_observaciones);
  end if;
end $$;

create or replace function cancelar_prestamo(p_prestamo bigint, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  p prestamos%rowtype;
begin
  perform exigir_rol('admin', 'panolero');
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Indicá el motivo de la cancelación.'; end if;
  select * into p from prestamos where id = p_prestamo for update;
  if not found or p.estado <> 'activo' then raise exception 'Solo se pueden cancelar préstamos activos.'; end if;
  update prestamos set estado = 'cancelado', motivo_cancelacion = p_motivo where id = p_prestamo;
  update herramientas set cantidad_disponible = cantidad_disponible + p.cantidad where id = p.herramienta_id;
end $$;

create or replace function registrar_incidencia(
  p_herramienta bigint, p_tipo text, p_cantidad int, p_responsable uuid, p_descripcion text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  h herramientas%rowtype;
begin
  perform exigir_rol('admin', 'panolero');
  select * into h from herramientas where id = p_herramienta for update;
  if not found then raise exception 'La herramienta no existe.'; end if;
  if p_tipo not in ('rotura', 'perdida') then raise exception 'Tipo de incidencia no válido.'; end if;
  if p_cantidad < 1 or p_cantidad > h.cantidad_disponible then
    raise exception 'No hay tantas unidades disponibles para marcar como rotas o perdidas.';
  end if;
  insert into incidencias (tipo, herramienta_id, responsable_id, cantidad, descripcion)
  values (p_tipo, p_herramienta, p_responsable, p_cantidad, p_descripcion);
  update herramientas set cantidad_disponible = cantidad_disponible - p_cantidad where id = p_herramienta;
end $$;

create or replace function resolver_incidencia(p_incidencia bigint, p_accion text, p_resolucion text) returns void
language plpgsql security definer set search_path = public as $$
declare
  i incidencias%rowtype;
begin
  perform exigir_rol('admin');
  select * into i from incidencias where id = p_incidencia for update;
  if not found or i.estado <> 'abierta' then raise exception 'La incidencia no existe o ya está resuelta.'; end if;
  if p_accion not in ('reparada', 'repuesta', 'baja') then raise exception 'Acción no válida.'; end if;

  if p_accion = 'baja' then
    update herramientas set cantidad_total = cantidad_total - i.cantidad where id = i.herramienta_id;
  else
    update herramientas set cantidad_disponible = cantidad_disponible + i.cantidad where id = i.herramienta_id;
  end if;

  update incidencias set estado = 'resuelta', accion = p_accion, resolucion = p_resolucion, fecha_resolucion = current_date
  where id = p_incidencia;
end $$;

create or replace function ajustar_stock(p_herramienta bigint, p_disponible int, p_estado text) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- El pañolero solo puede tocar stock disponible y estado (no código, nombre ni total)
  perform exigir_rol('admin', 'panolero');
  update herramientas set cantidad_disponible = p_disponible, estado_general = p_estado
  where id = p_herramienta and activo;
  if not found then raise exception 'La herramienta no existe o está dada de baja.'; end if;
end $$;

create or replace function actualizar_reposicion(p_reposicion bigint, p_estado text, p_respuesta text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare
  r solicitudes_reposicion%rowtype;
begin
  perform exigir_rol('admin');
  select * into r from solicitudes_reposicion where id = p_reposicion for update;
  if not found then raise exception 'El pedido no existe.'; end if;
  if not ((r.estado = 'pendiente' and p_estado in ('aprobada', 'rechazada'))
       or (r.estado = 'aprobada' and p_estado in ('recibida', 'rechazada'))) then
    raise exception 'Ese cambio de estado no está permitido.';
  end if;
  if p_estado = 'recibida' then
    update herramientas set cantidad_total = cantidad_total + r.cantidad, cantidad_disponible = cantidad_disponible + r.cantidad
    where id = r.herramienta_id;
  end if;
  update solicitudes_reposicion set estado = p_estado, respuesta = p_respuesta where id = p_reposicion;
end $$;

-- ---------- Autorización digital del docente ----------

-- Código de retiro: 4 caracteres, letras mayúsculas y números SIN 0/O ni 1/I (para no confundirlos).
-- Uso interno (no se da permiso de ejecución a los usuarios).
create or replace function generar_codigo_retiro() returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  letras constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v text;
begin
  loop
    v := '';
    for i in 1..4 loop
      v := v || substr(letras, 1 + floor(random() * length(letras))::int, 1);
    end loop;
    exit when not exists (select 1 from solicitudes_prestamo where codigo_retiro = v and estado = 'autorizada');
  end loop;
  return v;
end $$;

-- El docente autoriza el pedido de un alumno de SUS cursos. Puede bajar la cantidad y cambiar
-- el plazo de devolución. Genera el código de retiro y el vencimiento (48 horas).
create or replace function autorizar_solicitud(p_solicitud bigint, p_cantidad int, p_fecha_limite date)
returns text
language plpgsql security definer set search_path = public as $$
declare
  s solicitudes_prestamo%rowtype;
  v_codigo text;
begin
  perform exigir_rol('docente');
  select * into s from solicitudes_prestamo where id = p_solicitud for update;
  if not found or s.alumno_id is null then raise exception 'La solicitud no existe.'; end if;
  if not (s.curso = any (mis_cursos())) then raise exception 'Solo podés autorizar pedidos de alumnos de tus cursos.'; end if;
  if s.estado <> 'esperando_autorizacion' then raise exception 'Esta solicitud ya fue resuelta (estado: %).', s.estado; end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > s.cantidad then
    raise exception 'La cantidad autorizada debe estar entre 1 y % (lo que pidió el alumno).', s.cantidad;
  end if;
  if p_fecha_limite is null or p_fecha_limite < current_date then raise exception 'La fecha de devolución no puede ser anterior a hoy.'; end if;
  if p_fecha_limite > current_date + 60 then raise exception 'El plazo máximo de devolución es de 60 días.'; end if;

  v_codigo := generar_codigo_retiro();
  update solicitudes_prestamo
  set estado = 'autorizada', cantidad_autorizada = p_cantidad, fecha_limite = p_fecha_limite,
      autorizado_por = auth.uid(), fecha_autorizacion = now(), vence = now() + interval '48 hours',
      codigo_retiro = v_codigo
  where id = p_solicitud;
  return v_codigo;
end $$;

create or replace function rechazar_solicitud(p_solicitud bigint, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  s solicitudes_prestamo%rowtype;
begin
  perform exigir_rol('docente');
  if char_length(coalesce(trim(p_motivo), '')) not between 5 and 200 then
    raise exception 'Escribí el motivo del rechazo (entre 5 y 200 caracteres).';
  end if;
  select * into s from solicitudes_prestamo where id = p_solicitud for update;
  if not found or s.alumno_id is null then raise exception 'La solicitud no existe.'; end if;
  if not (s.curso = any (mis_cursos())) then raise exception 'Solo podés responder pedidos de alumnos de tus cursos.'; end if;
  if s.estado <> 'esperando_autorizacion' then raise exception 'Esta solicitud ya fue resuelta (estado: %).', s.estado; end if;
  -- autorizado_por / fecha_autorizacion guardan quién respondió y cuándo
  update solicitudes_prestamo
  set estado = 'rechazada', respuesta = trim(p_motivo), autorizado_por = auth.uid(), fecha_autorizacion = now()
  where id = p_solicitud;
end $$;

create or replace function crear_autorizacion_clase(p_curso text, p_herramienta bigint, p_cantidad int, p_fecha date)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  h herramientas%rowtype;
  v_id bigint;
begin
  perform exigir_rol('docente');
  if not (p_curso = any (mis_cursos())) then raise exception 'Solo podés autorizar a tus cursos.'; end if;
  select * into h from herramientas where id = p_herramienta for update;
  if not found or not h.activo then raise exception 'La herramienta no existe o está dada de baja.'; end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > h.cantidad_total then
    raise exception 'La cantidad por alumno debe estar entre 1 y %.', h.cantidad_total;
  end if;
  if p_cantidad > h.cantidad_disponible then
    raise exception 'Stock insuficiente: hay % disponibles de "%".', h.cantidad_disponible, h.nombre;
  end if;
  if p_fecha is null or p_fecha < current_date then raise exception 'La fecha no puede ser anterior a hoy.'; end if;
  if exists (select 1 from autorizaciones_clase where docente_id = auth.uid() and curso = p_curso
             and herramienta_id = p_herramienta and fecha = p_fecha and estado = 'activa') then
    raise exception 'Ya tenés una autorización de clase activa igual para ese día.';
  end if;
  insert into autorizaciones_clase (docente_id, curso, herramienta_id, cantidad_por_alumno, fecha)
  values (auth.uid(), p_curso, p_herramienta, p_cantidad, p_fecha)
  returning id into v_id;
  return v_id;
end $$;

create or replace function cancelar_autorizacion_clase(p_autorizacion bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  a autorizaciones_clase%rowtype;
begin
  perform exigir_rol('docente');
  select * into a from autorizaciones_clase where id = p_autorizacion for update;
  if not found or a.docente_id <> auth.uid() then raise exception 'La autorización no existe o no es tuya.'; end if;
  if a.estado <> 'activa' then raise exception 'La autorización ya estaba cancelada.'; end if;
  update autorizaciones_clase set estado = 'cancelada' where id = p_autorizacion;
end $$;

-- El alumno solo puede CANCELAR su solicitud: si intenta cambiar otro dato, se rechaza.
create or replace function proteger_solicitud_alumno() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if mi_rol() = 'alumno' and (to_jsonb(new) - 'estado') <> (to_jsonb(old) - 'estado') then
    raise exception 'Solo podés cancelar tu solicitud, no modificarla.';
  end if;
  return new;
end $$;

drop trigger if exists solicitud_alumno_solo_cancela on solicitudes_prestamo;
create trigger solicitud_alumno_solo_cancela before update on solicitudes_prestamo
  for each row execute function proteger_solicitud_alumno();

-- =====================================================================
-- 5. KPI MENSUAL (devuelve solo cantidades, nunca datos personales)
-- Misma lógica que src/services/kpi.js
-- =====================================================================

create or replace function kpi_mes(p_mes date) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  ini date := date_trunc('month', p_mes)::date;
  fin date := (date_trunc('month', p_mes) + interval '1 month - 1 day')::date;
  total int; no_operativas int;
  s_total int; s_atendidas int;
  d_total int; d_termino int;
  t_total int; t_ok int;
begin
  perform exigir_rol('admin', 'panolero', 'docente');

  select coalesce(sum(cantidad_total), 0) into total from herramientas where activo;
  select coalesce(sum(case when h.estado_general in ('en_reparacion', 'fuera_de_servicio') then h.cantidad_total
                           else (select coalesce(sum(i.cantidad), 0) from incidencias i where i.herramienta_id = h.id and i.estado = 'abierta') end), 0)
    into no_operativas from herramientas h where h.activo;

  -- Solicitudes de docentes y de alumnos. Atendidas: atendida (docente), autorizada o retirada (alumno).
  -- No se cuentan las canceladas por quien las pidió.
  select count(*), count(*) filter (where estado in ('atendida', 'autorizada', 'retirada')) into s_total, s_atendidas
    from solicitudes_prestamo where fecha between ini and fin and estado <> 'cancelada';

  select count(*), count(*) filter (where d.fecha_real <= p.fecha_limite) into d_total, d_termino
    from prestamos p left join devoluciones d on d.prestamo_id = p.id
    where p.estado <> 'cancelado' and p.fecha_limite between ini and fin and p.fecha_limite < current_date;

  select count(*), count(*) filter (where estado = 'completada' and fecha_completada <= fecha_limite) into t_total, t_ok
    from tareas where estado <> 'cancelada' and fecha_limite between ini and fin;

  return json_build_object(
    'k1', json_build_object('num', greatest(total - no_operativas, 0), 'den', total),
    'k2', json_build_object('num', s_atendidas, 'den', s_total),
    'k3', json_build_object('num', d_termino, 'den', d_total),
    'k4', json_build_object('num', t_ok, 'den', t_total)
  );
end $$;

-- Solo usuarios con sesión pueden ejecutar las funciones
-- (generar_codigo_retiro y proteger_solicitud_alumno son internas: nadie las llama directo)
revoke execute on all functions in schema public from anon, public;
grant execute on function mi_rol, mis_cursos, mi_curso, exigir_rol, es_docente_del_curso, listar_docentes,
  registrar_prestamo, registrar_devolucion, cancelar_prestamo, registrar_incidencia, resolver_incidencia,
  ajustar_stock, actualizar_reposicion, kpi_mes,
  autorizar_solicitud, rechazar_solicitud, crear_autorizacion_clase, cancelar_autorizacion_clase to authenticated;
-- Supabase da permiso a "authenticated" sobre toda función nueva: a las internas se lo sacamos
revoke execute on function generar_codigo_retiro, proteger_solicitud_alumno, crear_perfil from authenticated;

-- =====================================================================
-- 6. POLÍTICAS DE ACCESO (RLS)
-- Los permisos se aplican sobre los datos: aunque alguien modifique la
-- interfaz, la base de datos rechaza lo que su rol no puede hacer.
-- Sin política de DELETE en ninguna tabla → nada se borra desde la app.
-- =====================================================================

alter table talleres               enable row level security;
alter table categorias             enable row level security;
alter table perfiles               enable row level security;
alter table herramientas           enable row level security;
alter table prestamos              enable row level security;
alter table devoluciones           enable row level security;
alter table incidencias            enable row level security;
alter table solicitudes_prestamo   enable row level security;
alter table solicitudes_reposicion enable row level security;
alter table tareas                 enable row level security;
alter table actas                  enable row level security;
alter table autorizaciones_clase   enable row level security;

-- Talleres y categorías: todos consultan, solo el administrador modifica
create policy "talleres: consultar" on talleres for select to authenticated using (true);
create policy "talleres: admin crea" on talleres for insert to authenticated with check (mi_rol() = 'admin');
create policy "talleres: admin modifica" on talleres for update to authenticated using (mi_rol() = 'admin');
create policy "categorias: consultar" on categorias for select to authenticated using (true);
create policy "categorias: admin crea" on categorias for insert to authenticated with check (mi_rol() = 'admin');
create policy "categorias: admin modifica" on categorias for update to authenticated using (mi_rol() = 'admin');

-- Perfiles: cada uno ve el suyo; admin y pañolero ven todos (el pañolero necesita
-- buscar a la persona al prestar); el docente ve a los alumnos de sus cursos.
-- Solo el administrador modifica (rol, activo, curso).
create policy "perfiles: consultar" on perfiles for select to authenticated using (
  id = auth.uid() or mi_rol() in ('admin', 'panolero') or (mi_rol() = 'docente' and curso = any (mis_cursos()))
);
create policy "perfiles: admin modifica" on perfiles for update to authenticated using (mi_rol() = 'admin');

-- Herramientas: todos consultan; alta y modificación solo admin
-- (el pañolero cambia stock y estado mediante la función ajustar_stock)
create policy "herramientas: consultar" on herramientas for select to authenticated using (true);
create policy "herramientas: admin crea" on herramientas for insert to authenticated with check (mi_rol() = 'admin');
create policy "herramientas: admin modifica" on herramientas for update to authenticated using (mi_rol() = 'admin');

-- Préstamos: admin y pañolero todos; docente los de sus cursos; alumno los propios.
-- Se crean, devuelven y cancelan solo mediante funciones RPC.
create policy "prestamos: consultar" on prestamos for select to authenticated using (
  mi_rol() in ('admin', 'panolero')
  or persona_id = auth.uid()
  or (mi_rol() = 'docente' and curso = any (mis_cursos()))
);

-- Devoluciones: se ven si se puede ver el préstamo (hereda la regla anterior)
create policy "devoluciones: consultar" on devoluciones for select to authenticated using (
  exists (select 1 from prestamos p where p.id = devoluciones.prestamo_id)
);

-- Incidencias: admin y pañolero consultan; se crean/resuelven por RPC
create policy "incidencias: consultar" on incidencias for select to authenticated using (mi_rol() in ('admin', 'panolero'));

-- Solicitudes de préstamo. Hay dos tipos en la misma tabla:
--   * de DOCENTE (alumno_id vacío): pendiente → atendida / rechazada / cancelada.
--     El docente crea y cancela; pañolero y admin rechazan (atender = registrar_prestamo).
--   * de ALUMNO (alumno_id = el alumno): esperando_autorizacion → autorizada → retirada
--     (o rechazada / cancelada; "vencida" se calcula comparando "vence" con la hora actual).
--     El alumno crea y cancela las suyas; el docente del curso autoriza o rechaza SOLO por RPC;
--     el préstamo (retiro) lo registra el pañolero con registrar_prestamo.
create policy "solicitudes: consultar" on solicitudes_prestamo for select to authenticated using (
  mi_rol() in ('admin', 'panolero')
  or docente_id = auth.uid()
  or alumno_id = auth.uid()
  or (mi_rol() = 'docente' and alumno_id is not null and curso = any (mis_cursos()))
);
create policy "solicitudes: docente crea" on solicitudes_prestamo for insert to authenticated with check (
  mi_rol() = 'docente' and docente_id = auth.uid() and alumno_id is null and estado = 'pendiente' and fecha_clase >= current_date
);
create policy "solicitudes: alumno pide" on solicitudes_prestamo for insert to authenticated with check (
  mi_rol() = 'alumno' and alumno_id = auth.uid() and estado = 'esperando_autorizacion'
  and curso = mi_curso() and es_docente_del_curso(docente_id, curso)
  and cantidad <= (select h.cantidad_total from herramientas h where h.id = herramienta_id and h.activo)
  and autorizado_por is null and fecha_autorizacion is null and vence is null and codigo_retiro is null
  and cantidad_autorizada is null and prestamo_id is null
);
create policy "solicitudes: panol responde" on solicitudes_prestamo for update to authenticated
  using (mi_rol() in ('admin', 'panolero') and alumno_id is null and estado = 'pendiente')
  with check (alumno_id is null and estado in ('rechazada', 'pendiente'));
create policy "solicitudes: docente cancela" on solicitudes_prestamo for update to authenticated
  using (docente_id = auth.uid() and alumno_id is null and estado = 'pendiente')
  with check (docente_id = auth.uid() and alumno_id is null and estado = 'cancelada');
create policy "solicitudes: alumno cancela" on solicitudes_prestamo for update to authenticated
  using (alumno_id = auth.uid() and estado in ('esperando_autorizacion', 'autorizada') and (vence is null or vence > now()))
  with check (alumno_id = auth.uid() and estado = 'cancelada');

-- Autorizaciones de clase: el docente ve y crea las suyas (se cancelan por RPC);
-- pañolero y admin las ven para entregar.
create policy "autorizaciones clase: consultar" on autorizaciones_clase for select to authenticated using (
  mi_rol() in ('admin', 'panolero') or docente_id = auth.uid()
);
create policy "autorizaciones clase: docente crea" on autorizaciones_clase for insert to authenticated with check (
  mi_rol() = 'docente' and docente_id = auth.uid() and curso = any (mis_cursos()) and estado = 'activa' and fecha >= current_date
);

-- Reposición: docente y pañolero crean; docente ve las propias; admin aprueba por RPC
create policy "reposicion: consultar" on solicitudes_reposicion for select to authenticated using (
  mi_rol() in ('admin', 'panolero') or solicitante_id = auth.uid()
);
create policy "reposicion: crear" on solicitudes_reposicion for insert to authenticated with check (
  mi_rol() in ('admin', 'panolero', 'docente') and solicitante_id = auth.uid() and estado = 'pendiente'
);

-- Tareas y actas: consultan admin, pañolero y docentes; modifica el admin
create policy "tareas: consultar" on tareas for select to authenticated using (mi_rol() in ('admin', 'panolero', 'docente'));
create policy "tareas: admin crea" on tareas for insert to authenticated with check (mi_rol() = 'admin');
create policy "tareas: admin modifica" on tareas for update to authenticated using (mi_rol() = 'admin');
create policy "actas: consultar" on actas for select to authenticated using (mi_rol() in ('admin', 'panolero', 'docente'));
create policy "actas: admin crea" on actas for insert to authenticated with check (mi_rol() = 'admin');
create policy "actas: admin modifica" on actas for update to authenticated using (mi_rol() = 'admin');
