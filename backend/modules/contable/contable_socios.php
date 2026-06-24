<?php
/**
 * Agrupa pagos por el MES de la FECHA DE PAGO (MONTH(fecha_pago)),
 * pero en cada fila devuelve también el MES PAGADO (p.id_mes).
 *
 * Adaptado a club: la salida principal habla de SOCIOS.
 * Internamente soporta tanto estructura nueva (socios/id_socio)
 * como estructura legacy (alumnos/id_alumno) para no romper instalaciones existentes.
 */

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    $tableExists = function(PDO $pdo, string $table): bool {
        $st = $pdo->prepare("SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t LIMIT 1");
        $st->execute([':t' => $table]);
        return (bool)$st->fetchColumn();
    };
    $columnExists = function(PDO $pdo, string $table, string $column): bool {
        $st = $pdo->prepare("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c LIMIT 1");
        $st->execute([':t' => $table, ':c' => $column]);
        return (bool)$st->fetchColumn();
    };
    $firstColumn = function(string $table, array $candidates) use ($pdo, $columnExists): ?string {
        foreach ($candidates as $c) {
            if ($columnExists($pdo, $table, $c)) return $c;
        }
        return null;
    };

    if (!$tableExists($pdo, 'pagos')) {
        echo json_encode(['exito' => true, 'datos' => [], 'total_socios' => 0, 'total_alumnos' => 0], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $personaTable = $tableExists($pdo, 'socios') ? 'socios' : 'alumnos';
    $personaIdCol = $firstColumn($personaTable, ['id_socio', 'id_alumno', 'id']);
    if (!$personaIdCol) $personaIdCol = $personaTable === 'socios' ? 'id_socio' : 'id_alumno';
    $pagoPersonaCol = $columnExists($pdo, 'pagos', 'id_socio') ? 'id_socio' : 'id_alumno';

    $activoCol = $firstColumn($personaTable, ['activo', 'estado']);
    $whereActivos = '1=1';
    if ($activoCol === 'activo') {
        $whereActivos = "COALESCE(`$activoCol`, 1) = 1";
    } elseif ($activoCol === 'estado') {
        $whereActivos = "LOWER(TRIM(CAST(`$activoCol` AS CHAR))) NOT IN ('baja','inactivo','inactiva','0')";
    }

    $stmtTot = $pdo->query("SELECT COUNT(*) AS c FROM `$personaTable` WHERE $whereActivos");
    $rowTot  = $stmtTot->fetch(PDO::FETCH_ASSOC);
    $totalActivos = (int)($rowTot['c'] ?? 0);

    $nombreCol = $firstColumn($personaTable, ['nombre', 'nombres', 'nombre_socio', 'nombre_alumno', 'razon_social']);
    $apellidoCol = $firstColumn($personaTable, ['apellido', 'apellidos', 'apellido_socio', 'apellido_alumno']);
    $selectNombre   = $nombreCol   ? "a.`$nombreCol` AS nombre_socio"     : "NULL AS nombre_socio";
    $selectApellido = $apellidoCol ? "a.`$apellidoCol` AS apellido_socio" : "NULL AS apellido_socio";

    $catPersonaCol = $firstColumn($personaTable, ['id_cat_monto', 'id_categoria', 'id_categorias']);
    $joinCategoria = '';
    $selectIdCat = $catPersonaCol ? "a.`$catPersonaCol` AS id_categoria" : "NULL AS id_categoria";
    $selectCategoria = "NULL AS categoria_nombre";
    $selectMontoCategoria = "NULL AS categoria_monto";

    if ($catPersonaCol === 'id_cat_monto' && $tableExists($pdo, 'categoria_monto')) {
        $catNombreCol = $firstColumn('categoria_monto', ['nombre_categoria', 'nombre', 'categoria']);
        $catMontoCol = $firstColumn('categoria_monto', ['monto_mensual', 'monto', 'precio']);
        $joinCategoria = "LEFT JOIN categoria_monto cm ON cm.id_cat_monto = a.`$catPersonaCol`";
        $selectCategoria = $catNombreCol ? "cm.`$catNombreCol` AS categoria_nombre" : "NULL AS categoria_nombre";
        $selectMontoCategoria = $catMontoCol ? "cm.`$catMontoCol` AS categoria_monto" : "NULL AS categoria_monto";
    } elseif ($catPersonaCol && $tableExists($pdo, 'categorias')) {
        $catIdCol = $firstColumn('categorias', ['id_categoria', 'id_categorias', 'id']);
        $catNombreCol = $firstColumn('categorias', ['nombre_categoria', 'nombre', 'categoria', 'denominacion']);
        $catMontoCol = $firstColumn('categorias', ['monto_mensual', 'monto', 'precio']);
        if ($catIdCol) {
            $joinCategoria = "LEFT JOIN categorias cm ON cm.`$catIdCol` = a.`$catPersonaCol`";
            $selectCategoria = $catNombreCol ? "cm.`$catNombreCol` AS categoria_nombre" : "NULL AS categoria_nombre";
            $selectMontoCategoria = $catMontoCol ? "cm.`$catMontoCol` AS categoria_monto" : "NULL AS categoria_monto";
        }
    }

    $selectMontoPago = $columnExists($pdo, 'pagos', 'monto_pago') ? "p.monto_pago" : "NULL";
    $selectAnioAplicado = $columnExists($pdo, 'pagos', 'anio_aplicado') ? "p.anio_aplicado" : "YEAR(p.fecha_pago) AS anio_aplicado";

    $sql = "
        SELECT
            p.id_pago,
            p.`$pagoPersonaCol`                  AS id_socio,
            p.id_mes                              AS id_mes_pagado,
            $selectAnioAplicado,
            p.fecha_pago,
            $selectMontoPago                      AS monto_pago,
            $selectNombre,
            $selectApellido,
            $selectIdCat,
            $selectCategoria,
            $selectMontoCategoria,
            MONTH(p.fecha_pago)                   AS mes_id_cobro,
            m_cobro.nombre                        AS mes_nombre_cobro,
            m_pagado.nombre                       AS mes_nombre_pagado
        FROM pagos p
        LEFT JOIN `$personaTable` a ON a.`$personaIdCol` = p.`$pagoPersonaCol`
        $joinCategoria
        LEFT JOIN meses m_cobro  ON m_cobro.id_mes  = MONTH(p.fecha_pago)
        LEFT JOIN meses m_pagado ON m_pagado.id_mes = p.id_mes
        WHERE LOWER(TRIM(CAST(p.estado AS CHAR))) = 'pagado'
        ORDER BY p.fecha_pago ASC, p.id_pago ASC
    ";
    $stmt = $pdo->query($sql);
    $pagos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $porMes = [];
    $nombres = [1=>'ENERO',2=>'FEBRERO',3=>'MARZO',4=>'ABRIL',5=>'MAYO',6=>'JUNIO',7=>'JULIO',8=>'AGOSTO',9=>'SEPTIEMBRE',10=>'OCTUBRE',11=>'NOVIEMBRE',12=>'DICIEMBRE'];

    foreach ($pagos as $row) {
        $idSocio = (int)($row['id_socio'] ?? 0);
        $fecha = (string)($row['fecha_pago'] ?? '');
        $idMesCobro = (int)($row['mes_id_cobro'] ?? 0);
        $idMesPagado = (int)($row['id_mes_pagado'] ?? 0);
        $anioAplicado = (int)($row['anio_aplicado'] ?? 0);
        if ($anioAplicado <= 0 && preg_match('/^\d{4}/', $fecha)) $anioAplicado = (int)substr($fecha, 0, 4);

        $nombre = trim((string)($row['nombre_socio'] ?? ''));
        $apellido = trim((string)($row['apellido_socio'] ?? ''));

        $nomMesCobro = (string)($row['mes_nombre_cobro'] ?? '');
        $nomMesPagado = (string)($row['mes_nombre_pagado'] ?? '');
        if ($nomMesCobro === '')  $nomMesCobro  = $nombres[$idMesCobro] ?? "MES $idMesCobro";
        if ($nomMesPagado === '') $nomMesPagado = $nombres[$idMesPagado] ?? "MES $idMesPagado";

        $precio = $row['monto_pago'] !== null && $row['monto_pago'] !== ''
            ? (float)$row['monto_pago']
            : (float)($row['categoria_monto'] ?? 0);

        if (!isset($porMes[$idMesCobro])) {
            $porMes[$idMesCobro] = [
                'id_mes' => $idMesCobro,
                'nombre' => $nomMesCobro,
                'pagos'  => [],
            ];
        }

        $porMes[$idMesCobro]['pagos'][] = [
            'ID_Socio'         => $idSocio,
            'ID_Alumno'        => $idSocio, // compatibilidad legacy
            'Apellido'         => $apellido,
            'Nombre'           => $nombre,
            'Socio'            => trim(($nombre . ' ' . $apellido)) ?: trim(($apellido . ' ' . $nombre)),
            'Precio'           => $precio,
            'Nombre_Categoria' => (string)($row['categoria_nombre'] ?? ''),
            'fechaPago'        => $fecha,
            'Mes_Pagado'       => $nomMesPagado,
            'Mes_Cobro'        => $nomMesCobro,
            'Mes_Pagado_Anio'  => $anioAplicado,
        ];
    }

    ksort($porMes);
    echo json_encode([
        'exito'         => true,
        'datos'         => array_values($porMes),
        'total_socios'  => $totalActivos,
        'total_alumnos' => $totalActivos, // compatibilidad legacy
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
