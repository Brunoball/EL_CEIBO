<?php
declare(strict_types=1);

// backend/modules/categorias/guardar_descuentos_hermanos.php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

function dhg_json_out(array $data, int $status = 200): void {
  if (function_exists('json_out')) {
    json_out($data, $status);
  }
  http_response_code($status);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function dhg_asegurar_tabla(PDO $pdo): void {
  $pdo->exec("CREATE TABLE IF NOT EXISTS descuentos_hermanos (
      id_descuento_hermanos INT NOT NULL AUTO_INCREMENT,
      cantidad_hermanos INT NOT NULL,
      porcentaje_descuento DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id_descuento_hermanos),
      UNIQUE KEY uq_descuentos_hermanos_cantidad (cantidad_hermanos),
      KEY idx_descuentos_hermanos_activo_cantidad (activo, cantidad_hermanos)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function dhg_num($v): ?float {
  if ($v === null) return null;
  $s = trim((string)$v);
  if ($s === '') return null;
  $s = preg_replace('/[^0-9,.-]/', '', $s);
  if (strpos($s, ',') !== false && strpos($s, '.') !== false) {
    $s = str_replace('.', '', $s);
    $s = str_replace(',', '.', $s);
  } else {
    $s = str_replace(',', '.', $s);
  }
  if ($s === '' || !is_numeric($s)) return null;
  return (float)$s;
}

try {
  if (!isset($pdo) || !($pdo instanceof PDO)) {
    dhg_json_out(['exito' => false, 'mensaje' => 'Conexión PDO no disponible.'], 500);
  }

  if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
  }
  if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    dhg_json_out(['exito' => false, 'mensaje' => 'Método no permitido (usar POST).'], 405);
  }

  $raw = file_get_contents('php://input');
  $data = json_decode($raw ?: '', true);
  if (!is_array($data)) $data = $_POST;

  $descuentosRaw = $data['descuentos'] ?? null;
  if (is_string($descuentosRaw)) $descuentosRaw = json_decode($descuentosRaw, true);

  if (!is_array($descuentosRaw)) {
    // Compatibilidad: permite guardar una sola fila con cantidad_hermanos + porcentaje_descuento.
    if (isset($data['cantidad_hermanos']) || isset($data['porcentaje_descuento'])) {
      $descuentosRaw = [[
        'cantidad_hermanos' => $data['cantidad_hermanos'] ?? null,
        'porcentaje_descuento' => $data['porcentaje_descuento'] ?? null,
      ]];
    } else {
      dhg_json_out(['exito' => false, 'mensaje' => 'Campo descuentos inválido (debe ser un array).'], 400);
    }
  }

  $normalizados = [];
  $vistos = [];
  foreach ($descuentosRaw as $row) {
    if (!is_array($row)) continue;
    $cant = isset($row['cantidad_hermanos']) ? (int)$row['cantidad_hermanos'] : 0;
    $pct = array_key_exists('porcentaje_descuento', $row) ? dhg_num($row['porcentaje_descuento']) : null;

    if ($cant < 2) continue;
    if ($pct === null || $pct < 0 || $pct > 100) {
      dhg_json_out(['exito' => false, 'mensaje' => "Porcentaje inválido para {$cant} hermanos (0 a 100)."], 400);
    }
    if (isset($vistos[$cant])) {
      dhg_json_out(['exito' => false, 'mensaje' => "La cantidad {$cant} hermanos está repetida."], 400);
    }

    $vistos[$cant] = true;
    $normalizados[] = ['cantidad_hermanos' => $cant, 'porcentaje_descuento' => round($pct, 2)];
  }

  usort($normalizados, fn($a, $b) => $a['cantidad_hermanos'] <=> $b['cantidad_hermanos']);

  dhg_asegurar_tabla($pdo);
  $pdo->beginTransaction();

  // Guardado completo: lo que no viene queda inactivo.
  $pdo->exec("UPDATE descuentos_hermanos SET activo = 0");

  $st = $pdo->prepare("INSERT INTO descuentos_hermanos (cantidad_hermanos, porcentaje_descuento, activo)
                       VALUES (:cant, :pct, 1)
                       ON DUPLICATE KEY UPDATE
                         porcentaje_descuento = VALUES(porcentaje_descuento),
                         activo = 1,
                         actualizado_en = CURRENT_TIMESTAMP");

  foreach ($normalizados as $d) {
    $st->execute([
      ':cant' => $d['cantidad_hermanos'],
      ':pct' => $d['porcentaje_descuento'],
    ]);
  }

  $pdo->commit();
  dhg_json_out(['exito' => true, 'mensaje' => 'Descuentos familiares guardados.', 'items' => $normalizados]);
} catch (Throwable $e) {
  if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
  dhg_json_out([
    'exito' => false,
    'mensaje' => 'Error al guardar descuentos familiares.',
    'detalle' => $e->getMessage(),
  ], 500);
}
