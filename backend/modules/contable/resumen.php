<?php
/**
 * /api.php?action=contable_resumen&year=YYYY
 *
 * Criterio único y consistente con Ingresos:
 * ingresos del mes = pagos de socios + ingresos reales + ventas faltantes de respaldo.
 *
 * Importante:
 * - NO se borran ni se ocultan registros de ingresos por parecer ventas.
 * - Si una venta ya impactó en ingresos, no se suma otra vez.
 * - Antes de calcular, las ventas aprobadas se sincronizan con ingresos de forma idempotente.
 * - Si una venta aprobada no pudo impactar todavía, se suma como virtual de respaldo.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

try {
    if (!isset($pdo)) {
        require_once __DIR__ . '/../../config/db.php';
    }
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    // Reutilizamos la sincronización segura del módulo Ventas para que Resumen
    // y la pestaña Ingresos usen la misma fuente real: la tabla ingresos.
    $ventasHelpers = __DIR__ . '/../ventas/helpers.php';
    if (is_file($ventasHelpers)) {
        require_once $ventasHelpers;
    }

    $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
    if ($year < 2000 || $year > 2100) {
        $year = (int)date('Y');
    }

    $tableExists = function(PDO $pdo, string $table): bool {
        try {
            $st = $pdo->prepare("SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t LIMIT 1");
            $st->execute([':t' => $table]);
            return (bool)$st->fetchColumn();
        } catch (Throwable $e) {
            return false;
        }
    };

    $columnExists = function(PDO $pdo, string $table, string $column): bool {
        try {
            $st = $pdo->prepare("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c LIMIT 1");
            $st->execute([':t' => $table, ':c' => $column]);
            return (bool)$st->fetchColumn();
        } catch (Throwable $e) {
            return false;
        }
    };

    $sumPorMes = function(PDOStatement $st): array {
        $out = [];
        while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
            $m = (int)($r['m'] ?? 0);
            if ($m >= 1 && $m <= 12) {
                $out[$m] = (float)($r['total'] ?? 0);
            }
        }
        return $out;
    };

    $warnings = [];

    if ($tableExists($pdo, 'ventas_ordenes') && function_exists('ventas_sincronizar_contable_ventas_aprobadas')) {
        try {
            ventas_sincronizar_contable_ventas_aprobadas($pdo);
        } catch (Throwable $e) {
            $warnings[] = 'No se pudo sincronizar ventas aprobadas con ingresos: ' . $e->getMessage();
        }
    }

    $allYears = [(int)date('Y')];

    foreach ([
        ['tabla' => 'pagos',    'fecha' => 'fecha_pago'],
        ['tabla' => 'ingresos', 'fecha' => 'fecha'],
        ['tabla' => 'egresos',  'fecha' => 'fecha'],
    ] as $src) {
        try {
            if (!$tableExists($pdo, $src['tabla'])) continue;
            $sqlY = "SELECT DISTINCT YEAR(`{$src['fecha']}`) AS y FROM `{$src['tabla']}` WHERE `{$src['fecha']}` IS NOT NULL";
            $stY = $pdo->query($sqlY);
            while ($r = $stY->fetch(PDO::FETCH_ASSOC)) {
                if (!empty($r['y'])) $allYears[] = (int)$r['y'];
            }
        } catch (Throwable $e) {
            $warnings[] = 'No se pudieron leer años de ' . $src['tabla'] . ': ' . $e->getMessage();
        }
    }

    $hayVentasOrdenes = $tableExists($pdo, 'ventas_ordenes');
    $fechaVentaExpr = null;
    if ($hayVentasOrdenes) {
        try {
            $parts = [];
            if ($columnExists($pdo, 'ventas_ordenes', 'aprobado_en')) $parts[] = 'aprobado_en';
            if ($columnExists($pdo, 'ventas_ordenes', 'actualizado_en')) $parts[] = 'actualizado_en';
            if ($columnExists($pdo, 'ventas_ordenes', 'creado_en')) $parts[] = 'creado_en';
            $fechaVentaExpr = count($parts) ? 'COALESCE(' . implode(', ', $parts) . ')' : null;
            if ($fechaVentaExpr !== null) {
                $excluidoYears = $columnExists($pdo, 'ventas_ordenes', 'contable_excluido') ? 'AND COALESCE(contable_excluido, 0) = 0' : '';
                $stY = $pdo->query("SELECT DISTINCT YEAR($fechaVentaExpr) AS y FROM ventas_ordenes WHERE LOWER(TRIM(CAST(estado AS CHAR))) = 'aprobada' $excluidoYears");
                while ($r = $stY->fetch(PDO::FETCH_ASSOC)) {
                    if (!empty($r['y'])) $allYears[] = (int)$r['y'];
                }
            }
        } catch (Throwable $e) {
            $warnings[] = 'No se pudieron leer años de ventas: ' . $e->getMessage();
        }
    }

    $allYears = array_values(array_unique(array_filter($allYears)));
    rsort($allYears);

    /* 1) PAGOS DE SOCIOS */
    $ingresosPagosMes = [];
    if ($tableExists($pdo, 'pagos')) {
        try {
            $st = $pdo->prepare(" 
                SELECT MONTH(fecha_pago) AS m,
                       SUM(COALESCE(monto_pago,0)) AS total
                FROM pagos
                WHERE YEAR(fecha_pago) = :y
                  AND LOWER(TRIM(CAST(estado AS CHAR))) = 'pagado'
                GROUP BY m
                ORDER BY m
            ");
            $st->execute([':y' => $year]);
            $ingresosPagosMes = $sumPorMes($st);
        } catch (Throwable $e) {
            $warnings[] = 'No se pudieron sumar pagos de socios: ' . $e->getMessage();
        }
    }

    /* 2) INGRESOS REALES: se suma todo lo que está en la tabla ingresos */
    $ingresosRegistrosMes = [];
    if ($tableExists($pdo, 'ingresos')) {
        try {
            $st = $pdo->prepare(" 
                SELECT MONTH(fecha) AS m,
                       SUM(COALESCE(importe,0)) AS total
                FROM ingresos
                WHERE YEAR(fecha) = :y
                GROUP BY m
                ORDER BY m
            ");
            $st->execute([':y' => $year]);
            $ingresosRegistrosMes = $sumPorMes($st);
        } catch (Throwable $e) {
            $warnings[] = 'No se pudieron sumar ingresos reales: ' . $e->getMessage();
        }
    }

    /* 3) VENTAS APROBADAS FALTANTES: solo las que no tengan ingreso equivalente */
    $ingresosVentasFaltantesMes = [];
    if ($hayVentasOrdenes && $fechaVentaExpr !== null) {
        try {
            $hayIngresos = $tableExists($pdo, 'ingresos');
            $hayCategoria = $tableExists($pdo, 'contable_categoria');
            $hayProveedor = $tableExists($pdo, 'contable_proveedor');
            $hayDescripcion = $tableExists($pdo, 'contable_descripcion');
            $tieneIdIngreso = $columnExists($pdo, 'ventas_ordenes', 'id_ingreso');
            $tieneContableExcluido = $columnExists($pdo, 'ventas_ordenes', 'contable_excluido');

            $notLinked = $tieneIdIngreso ? "AND (vo.id_ingreso IS NULL OR vo.id_ingreso = 0)" : "";
            $notExcluded = $tieneContableExcluido ? "AND COALESCE(vo.contable_excluido, 0) = 0" : "";

            if ($hayIngresos) {
                $joinCat = $hayCategoria ? "LEFT JOIN contable_categoria cc2 ON cc2.id_cont_categoria = i2.id_cont_categoria" : "";
                $joinProv = $hayProveedor ? "LEFT JOIN contable_proveedor cp2 ON cp2.id_cont_proveedor = i2.id_cont_proveedor" : "";
                $joinDesc = $hayDescripcion ? "LEFT JOIN contable_descripcion cd2 ON cd2.id_cont_descripcion = i2.id_cont_descripcion" : "";
                $catExpr = $hayCategoria ? "COALESCE(cc2.nombre_categoria,'')" : "''";
                $provExpr = $hayProveedor ? "COALESCE(cp2.nombre_proveedor,'')" : "''";
                $descExpr = $hayDescripcion ? "COALESCE(cd2.nombre_descripcion,'')" : "''";

                $notExistsIngreso = "
                    AND NOT EXISTS (
                        SELECT 1
                        FROM ingresos i2
                        $joinCat
                        $joinProv
                        $joinDesc
                        WHERE DATE(i2.fecha) = DATE($fechaVentaExpr)
                          AND ABS(COALESCE(i2.importe,0) - COALESCE(vo.total,0)) < 0.01
                          AND (
                            UPPER(TRIM($provExpr)) = UPPER(TRIM(COALESCE(vo.persona_nombre,'')))
                            OR UPPER(TRIM($catExpr)) LIKE 'VENTA%'
                            OR UPPER(TRIM($descExpr)) LIKE 'VENTA%'
                          )
                        LIMIT 1
                    )";
            } else {
                $notExistsIngreso = "";
            }

            $st = $pdo->prepare(" 
                SELECT MONTH($fechaVentaExpr) AS m,
                       SUM(COALESCE(vo.total,0)) AS total
                FROM ventas_ordenes vo
                WHERE YEAR($fechaVentaExpr) = :y
                  AND LOWER(TRIM(CAST(vo.estado AS CHAR))) = 'aprobada'
                  $notLinked
                  $notExcluded
                  $notExistsIngreso
                GROUP BY m
                ORDER BY m
            ");
            $st->execute([':y' => $year]);
            $ingresosVentasFaltantesMes = $sumPorMes($st);
        } catch (Throwable $e) {
            $warnings[] = 'No se pudieron sumar ventas faltantes: ' . $e->getMessage();
        }
    }

    /* 4) EGRESOS */
    $egresosMes = [];
    if ($tableExists($pdo, 'egresos')) {
        try {
            $st = $pdo->prepare(" 
                SELECT MONTH(fecha) AS m,
                       SUM(COALESCE(importe,0)) AS total
                FROM egresos
                WHERE YEAR(fecha) = :y
                GROUP BY m
                ORDER BY m
            ");
            $st->execute([':y' => $year]);
            $egresosMes = $sumPorMes($st);
        } catch (Throwable $e) {
            $warnings[] = 'No se pudieron sumar egresos: ' . $e->getMessage();
        }
    }

    $MESES = [
        1 => 'ENERO', 2 => 'FEBRERO', 3 => 'MARZO', 4 => 'ABRIL',
        5 => 'MAYO', 6 => 'JUNIO', 7 => 'JULIO', 8 => 'AGOSTO',
        9 => 'SEPTIEMBRE', 10 => 'OCTUBRE', 11 => 'NOVIEMBRE', 12 => 'DICIEMBRE'
    ];

    $out = [];
    for ($m = 1; $m <= 12; $m++) {
        $ingPagos = (float)($ingresosPagosMes[$m] ?? 0);
        $ingReg   = (float)($ingresosRegistrosMes[$m] ?? 0);
        $ingVenF  = (float)($ingresosVentasFaltantesMes[$m] ?? 0);
        $egr      = (float)($egresosMes[$m] ?? 0);
        $ingTot   = $ingPagos + $ingReg + $ingVenF;

        $out[] = [
            'anio' => $year,
            'mes' => $m,
            'nombre_mes' => $MESES[$m],
            'ingresos' => (float)number_format($ingTot, 2, '.', ''),
            'egresos' => (float)number_format($egr, 2, '.', ''),
            'saldo' => (float)number_format($ingTot - $egr, 2, '.', ''),
            'ingresos_pagos' => (float)number_format($ingPagos, 2, '.', ''),
            'ingresos_registros' => (float)number_format($ingReg, 2, '.', ''),
            'ingresos_ventas_faltantes' => (float)number_format($ingVenF, 2, '.', ''),
        ];
    }

    echo json_encode([
        'exito' => true,
        'year' => $year,
        'resumen' => $out,
        'anios_disponibles' => $allYears,
        'warnings' => $warnings,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error: ' . $e->getMessage(),
        'resumen' => [],
        'anios_disponibles' => [(int)date('Y')],
    ], JSON_UNESCAPED_UNICODE);
}
