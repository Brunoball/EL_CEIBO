<?php
/**
 * Endpoint: action=obtener_socio_comprobante&id={id_alumno}
 * Devuelve la ficha del alumno lista para el comprobante.
 * - Monto desde categoria_monto (monto_mensual)
 * - Nombres de AÑO (anio.nombre_año) y DIVISIÓN (division.nombre_division)
 */
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id <= 0) {
    echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado o inválido']);
    exit;
}

try {
    /**
     * Tablas según tu esquema:
     *  - alumnos (id_alumno, ..., id_año, id_division, id_cat_monto, ...)
     *  - division (id_division, nombre_division)
     *  - anio (id_año, nombre_año)
     *  - categoria_monto (id_cat_monto, nombre_categoria, monto_mensual, monto_anual)
     */
    $sql = "
        SELECT
            a.id_alumno,
            a.apellido,
            a.nombre,
            a.num_documento,
            a.domicilio,
            a.localidad,
            a.telefono,
            a.`id_año`           AS a_id_anio,
            a.id_division,
            a.id_cat_monto AS id_categoria,
            a.id_cat_monto,

            cm.nombre_categoria   AS cm_nombre_categoria,
            cm.monto_mensual      AS cm_monto_mensual,
            cm.monto_anual        AS cm_monto_anual,

            d.nombre_division     AS d_nombre_division,

            an.nombre_año         AS an_nombre_anio

        FROM alumnos a
        LEFT JOIN categoria_monto cm ON cm.id_cat_monto = a.id_cat_monto
        LEFT JOIN `division`     d   ON d.id_division   = a.id_division
        LEFT JOIN `anio`         an  ON an.`id_año`     = a.`id_año`
        WHERE a.id_alumno = :id
        LIMIT 1
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        echo json_encode(['exito' => false, 'mensaje' => 'Alumno no encontrado']);
        exit;
    }

    // Precio por categoría (si existe)
    $tieneCatMonto   = !empty($row['id_cat_monto']) && $row['cm_monto_mensual'] !== null;
    $categoriaNombre = $tieneCatMonto ? (string)($row['cm_nombre_categoria'] ?? '') : '';
    $montoMensual    = $tieneCatMonto ? (int)$row['cm_monto_mensual'] : 0;

    // Nombres human-friendly
    $nombreDivision  = (string)($row['d_nombre_division'] ?? '');
    $nombreAnio      = (string)($row['an_nombre_anio']   ?? '');

    $socio = [
        'id_alumno'        => (int)$row['id_alumno'],
        'id'               => (int)$row['id_alumno'], // alias
        'apellido'         => (string)($row['apellido'] ?? ''),
        'nombre'           => (string)($row['nombre'] ?? ''),
        'apellido_nombre'  => trim(($row['apellido'] ?? '') . ' ' . ($row['nombre'] ?? '')),
        'num_documento'    => (string)($row['num_documento'] ?? ''),
        'dni'              => (string)($row['num_documento'] ?? ''), // alias
        'domicilio'        => (string)($row['domicilio'] ?? ''),
        'localidad'        => (string)($row['localidad'] ?? ''),
        'telefono'         => (string)($row['telefono'] ?? ''),

        // IDs crudos
        'id_division'      => isset($row['id_division']) ? (int)$row['id_division'] : null,
        'id_categoria'     => isset($row['id_categoria']) ? (int)$row['id_categoria'] : null,
        'id_cat_monto'     => isset($row['id_cat_monto']) ? (int)$row['id_cat_monto'] : null,
        'id_año'           => isset($row['a_id_anio']) ? (int)$row['a_id_anio'] : null,

        // Nombres para el comprobante (y alias de compatibilidad)
        'nombre_division'  => $nombreDivision,
        'division'         => $nombreDivision,   // alias
        'nombre_año'       => $nombreAnio,
        'anio_nombre'      => $nombreAnio,       // alias
        'nombre_anio'      => $nombreAnio,       // alias

        // Precio efectivo
        'nombre_categoria' => $categoriaNombre,
        'monto_mensual'    => $montoMensual,
        'precio_categoria' => $montoMensual,
        'fuente_categoria' => $tieneCatMonto ? 'categoria_monto' : 'sin_categoria_monto'
    ];

    echo json_encode(['exito' => true, 'socio' => $socio], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error de servidor: ' . $e->getMessage()]);
}
