# Autorización digital del docente

Reemplaza la notita en papel firmada por el profesor que el alumno llevaba al pañol.

## El flujo en 3 pasos

1. El ALUMNO pide (pantalla "Pedir herramienta"): elige herramienta, cantidad, motivo y el docente
   que lo autoriza. Solo aparecen los docentes que tienen su curso. Estado: "esperando autorización".
2. El DOCENTE responde (pantalla "Autorizar pedidos"): ve los pedidos de alumnos de SUS cursos.
   - Autorizar: puede bajar la cantidad y cambiar el plazo de devolución. El sistema genera un
     código de retiro de 4 caracteres (sin 0/O ni 1/I para no confundirlos) que vale 48 horas.
   - Rechazar: el motivo es obligatorio y lo ve el alumno.
3. El PAÑOLERO entrega (pantalla "Listas para retirar"): busca por DNI o por el código que muestra
   el alumno, ve qué docente autorizó y toca "Entregar". Se abre el formulario de préstamo ya
   completado; al confirmar, se registra el préstamo y la solicitud pasa a "retirada" (con el número
   de préstamo vinculado).

Autorización de clase: el docente puede autorizar a todo un curso a retirar una herramienta un día.
Cualquier alumno de ese curso retira sin pedir antes, una sola vez cada uno, mientras haya stock.

## Estados

esperando_autorizacion → autorizada → retirada
                       → rechazada
esperando_autorizacion / autorizada → cancelada (la cancela el alumno)
autorizada + pasaron 48 h → se MUESTRA "vencida"

"Vencida" no se guarda: se calcula comparando la columna "vence" con la fecha y hora actuales,
igual que "vencido" en los préstamos. Nada se borra: solo cambia el estado.

## Por qué es seguro (para defenderlo)

- La regla principal está en la base de datos: registrar_prestamo no deja prestarle a un alumno
  sin una autorización vigente (solicitud autorizada a su nombre, no vencida, misma herramienta y
  cantidad no mayor, o autorización de clase de hoy para su curso que no usó). Aunque alguien
  modifique la página, la base lo rechaza con "El alumno no tiene autorización vigente de un docente".
- El docente autoriza o rechaza SOLO con funciones (autorizar_solicitud, rechazar_solicitud), que
  controlan que el curso del alumno esté entre sus cursos y que el pedido no esté ya resuelto.
- El alumno solo puede crear pedidos a su nombre, con su curso y un docente de ese curso, y solo
  puede cancelarlos (un trigger rechaza cualquier otro cambio).
- Un índice único impide que un alumno retire dos veces con la misma autorización de clase.
- El código es único entre las autorizaciones vigentes y no hay políticas de borrado.

## Instalación en Supabase

- Base nueva: ejecutar supabase/schema.sql y después supabase/seed.sql (ya incluyen todo).
- Base que ya existe: ejecutar UNA vez supabase/migracion_autorizacion_docente.sql (no borra datos).

## Cómo probarlo en modo demo

Si ya habías usado el modo demo, la base de prueba se regenera sola (cambió a la versión v2).

Alumno · Tomás Martínez (DNI 47111222, 5°1)
1. Entrar → menú "Pedir herramienta".
2. Tocar "Enviar pedido" vacío → aparecen los errores de validación.
3. Pedir 2 × Pinza universal, motivo "Trabajo práctico de conexiones". Queda "Esperando autorización".

Docente · Pablo Herrera (DNI 28555666, 5°1 y 5°2)
4. En el panel aparece "Autorizaciones pendientes (3)".
5. "Autorizar pedidos" → Autorizar el de Tomás bajando la cantidad a 1 → confirmar → aparece el código.
6. Rechazar el de Camila: probar sin motivo (error) y después con motivo.
7. "Autorizaciones de clase" → crear una para 5°2, Pinza universal, 1 por alumno, hoy.

Alumno · Tomás otra vez
8. "Pedir herramienta" muestra el código en grande con el docente y hasta cuándo vale.

Pañolero · Ricardo Gómez (DNI 25333444)
9. Panel: tarjeta "Listas para retirar". Entrar a esa pantalla.
10. Buscar R4TX → avisa que venció (pasaron más de 48 h).
11. Buscar el código de Tomás → Entregar → el formulario viene completo → probar cantidad 2 (error)
    → dejar 1 → Confirmar entrega → confirmar. La solicitud queda "Retirada".
12. Buscar DNI 46333444 (Joaquín, 6°1) → "Autorizado por clase (Prof. Silvia Ríos)" → Entregar.
    Buscarlo de nuevo → avisa que ya retiró con esa autorización.
13. Buscar DNI 47222333 (Lucía) → aparecen su autorización individual (K7MP) y la de clase de 5°2.
14. "Nuevo préstamo" a mano para Camila (47666777) → el sistema no deja: no tiene autorización.

Docente · Silvia Ríos (DNI 29666777)
15. "Autorizaciones de clase" → ver la de 6°1 con 1 alumno que retiró → Cancelar.

Indicadores: el KPI 2 ahora cuenta también los pedidos de alumnos
(atendidas = atendidas + autorizadas + retiradas; total = todas menos canceladas).
