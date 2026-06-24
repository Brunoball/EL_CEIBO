<?php
// backend/modules/cuotas/obtener_monto_categoria.php
// Club: monto por categoría única + descuento familiar global por porcentaje.

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

function cuotas_json_out(array $data, int $status = 200): void {
  if (function_exists('json_out')) {
    json_out($data, $status);
  }
  http_response_code($status);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function cuotas_table_exists(PDO $pdo, string $table): bool {
  $st = $pdo->prepare("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t LIMIT 1");
  $st->execute([':t' => $table]);
  return (bool)$st->fetchColumn();
}

function cuotas_column_exists(PDO $pdo, string $table, string $column): bool {
  $st = $pdo->prepare("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c LIMIT 1");
  $st->execute([':t' => $table, ':c' => $column]);
  return (bool)$st->fetchColumn();
}

function cuotas_asegurar_descuentos(PDO $pdo): void {
  $pdo->exec("CREATE TABLE IF NOT EXISTS descuentos_hermanos (
      id_descuento_hermanos INT NOT NULL AUTO_INCREMENT,
      cantidad_hermanos INT NOT NULL,
      porcentaje_descuento DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id_descuento_hermanos),
      UNIQUE KEY uq_descuentos_hermanos_cantidad (cantidad_hermanos)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function cuotas_family_count(PDO $pdo, int $idAlumno): int {
  if (!cuotas_column_exists($pdo, 'alumnos', 'id_familia') || !cuotas_table_exists($pdo, 'familias')) return 1;

  $st = $pdo->prepare("SELECT id_familia FROM alumnos WHERE id_alumno = :id LIMIT 1");
  $st->execute([':id' => $idAlumno]);
  $idFamilia = (int)($st->fetchColumn() ?: 0);
  if ($idFamilia <= 0) return 1;

  $st = $pdo->prepare("SELECT COUNT(*) FROM alumnos WHERE id_familia = :idf AND COALESCE(activo, 1) = 1");
  $st->execute([':idf' => $idFamilia]);
  $count = (int)($st->fetchColumn() ?: 0);
  return max(1, $count);
}

function cuotas_descuento_por_cantidad(PDO $pdo, int $cantidad): array {
  cuotas_asegurar_descuentos($pdo);
  if ($cantidad < 2) {
    return ['porcentaje' => 0.0, 'cantidad_regla' => 0, 'id_descuento' => 0];
  }

  // Regla exacta: 2 hermanos usa la fila de 2, 3 usa la de 3, etc.
  $st = $pdo->prepare("\n    SELECT id_descuento_hermanos, cantidad_hermanos, porcentaje_descuento\n    FROM descuentos_hermanos\n    WHERE activo = 1\n      AND cantidad_hermanos = :cant\n    LIMIT 1\n  ");
  $st->execute([':cant' => $cantidad]);
  $row = $st->fetch(PDO::FETCH_ASSOC);
  if (!$row) return ['porcentaje' => 0.0, 'cantidad_regla' => 0, 'id_descuento' => 0];

  $pct = max(0.0, min(100.0, (float)$row['porcentaje_descuento']));
  return [
    'porcentaje' => $pct,
    'cantidad_regla' => (int)$row['cantidad_hermanos'],
    'id_descuento' => (int)$row['id_descuento_hermanos'],
  ];
}

try {
  if (!isset($pdo) || !($pdo instanceof PDO)) {
    cuotas_json_out(['exito' => false, 'mensaje' => 'Conexión PDO no disponible.'], 500);
  }

  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  $id_alumno = isset($_GET['id_alumno']) ? (int)$_GET['id_alumno'] : 0;
  if ($id_alumno <= 0) cuotas_json_out(['exito' => false, 'mensaje' => 'Falta id_alumno válido.'], 400);

  $anio = isset($_GET['anio']) ? (int)$_GET['anio'] : (int)date('Y');
  if ($anio < 2000 || $anio > 2100) $anio = (int)date('Y');

  $family_count = isset($_GET['family_count']) ? (int)$_GET['family_count'] : 0;
  if ($family_count <= 0) $family_count = cuotas_family_count($pdo, $id_alumno);
  if ($family_count < 1) $family_count = 1;

  if (!cuotas_table_exists($pdo, 'categoria_monto')) {
    cuotas_json_out(['exito' => false, 'mensaje' => "No existe la tabla 'categoria_monto'."], 500);
  }

  $catCol = null;
  foreach (['id_cat_monto', 'id_categoria_monto', 'idCatMonto'] as $c) {
    if (cuotas_column_exists($pdo, 'alumnos', $c)) { $catCol = $c; break; }
  }
  if (!$catCol) {
    cuotas_json_out(['exito' => false, 'mensaje' => "Falta alumnos.id_cat_monto para vincular socios con categorías."], 500);
  }

  $sql = "\n    SELECT\n      a.id_alumno,\n      a.`$catCol` AS id_cat_monto,\n      cm.nombre_categoria,\n      cm.monto_mensual AS base_monto_mensual,\n      cm.monto_anual AS base_monto_anual\n    FROM alumnos a\n    INNER JOIN categoria_monto cm ON cm.id_cat_monto = a.`$catCol`\n    WHERE a.id_alumno = :id\n    LIMIT 1\n  ";
  $st = $pdo->prepare($sql);
  $st->execute([':id' => $id_alumno]);
  $row = $st->fetch(PDO::FETCH_ASSOC);

  if (!$row) {
    cuotas_json_out(['exito' => false, 'mensaje' => 'No se encontró el socio o su categoría.'], 404);
  }

  $idCat = (int)$row['id_cat_monto'];
  $nombreCategoria = (string)($row['nombre_categoria'] ?? '');
  $baseMensual = max(0.0, (float)($row['base_monto_mensual'] ?? 0));
  $baseAnual = max(0.0, (float)($row['base_monto_anual'] ?? 0));

  $desc = cuotas_descuento_por_cantidad($pdo, $family_count);
  $porcentaje = (float)$desc['porcentaje'];
  $sinReglaDescuento = ($family_count >= 2 && (int)$desc['id_descuento'] <= 0);
  $factor = 1 - ($porcentaje / 100);

  $montoMensualFinal = (int)round($baseMensual * $factor);
  $montoAnualFinal = (int)round($baseAnual * $factor);

  $montosPorPeriodo = [];
  for ($mes = 1; $mes <= 12; $mes++) {
    $montosPorPeriodo[$mes] = $montoMensualFinal;
  }
  $montosPorPeriodo[13] = $montoAnualFinal;
  $montosPorPeriodo[15] = (int)round($montoAnualFinal / 2);
  $montosPorPeriodo[16] = (int)round($montoAnualFinal / 2);

  cuotas_json_out([
    'exito' => true,
    'id_alumno' => $id_alumno,
    'id_cat_monto' => $idCat,
    'categoria_nombre' => $nombreCategoria,
    'anio' => $anio,
    'family_count' => $family_count,

    'base_monto_mensual' => $baseMensual,
    'base_monto_anual' => $baseAnual,

    // Montos finales ya con descuento familiar aplicado.
    'monto_mensual' => $montoMensualFinal,
    'monto_anual' => $montoAnualFinal,
    'montos_por_periodo' => $montosPorPeriodo,

    'descuento_familiar_aplicado' => $porcentaje > 0,
    'porcentaje_descuento_hermanos' => $porcentaje,
    'cantidad_regla_descuento' => (int)$desc['cantidad_regla'],
    'id_descuento_hermanos' => (int)$desc['id_descuento'],
    'advertencia' => $sinReglaDescuento ? 'No hay configuración de descuento familiar para esa cantidad de hermanos.' : '',
  ]);

} catch (Throwable $e) {
  cuotas_json_out([
    'exito' => false,
    'mensaje' => 'Error al obtener monto por categoría.',
    'detalle' => $e->getMessage(),
  ], 500);
}
