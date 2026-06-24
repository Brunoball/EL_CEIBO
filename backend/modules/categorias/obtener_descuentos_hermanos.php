<?php
declare(strict_types=1);

// backend/modules/categorias/obtener_descuentos_hermanos.php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

function dh_json_out(array $data, int $status = 200): void {
  if (function_exists('json_out')) {
    json_out($data, $status);
  }
  http_response_code($status);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function dh_asegurar_tabla(PDO $pdo): void {
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

try {
  if (!isset($pdo) || !($pdo instanceof PDO)) {
    dh_json_out(['exito' => false, 'mensaje' => 'Conexión PDO no disponible.'], 500);
  }

  dh_asegurar_tabla($pdo);

  $st = $pdo->query("SELECT id_descuento_hermanos, cantidad_hermanos, porcentaje_descuento, activo, creado_en, actualizado_en
                     FROM descuentos_hermanos
                     WHERE activo = 1
                     ORDER BY cantidad_hermanos ASC");
  $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];

  dh_json_out(['exito' => true, 'items' => $rows]);
} catch (Throwable $e) {
  dh_json_out([
    'exito' => false,
    'mensaje' => 'Error al obtener descuentos familiares.',
    'detalle' => $e->getMessage(),
  ], 500);
}
