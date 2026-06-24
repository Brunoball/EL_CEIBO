<?php
declare(strict_types=1);

// backend/modules/categorias/eliminar_descuento_hermano.php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

function dhe_json_out(array $data, int $status = 200): void {
  if (function_exists('json_out')) {
    json_out($data, $status);
  }
  http_response_code($status);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

try {
  if (!isset($pdo) || !($pdo instanceof PDO)) {
    dhe_json_out(['exito' => false, 'mensaje' => 'Conexión PDO no disponible.'], 500);
  }
  if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    dhe_json_out(['exito' => false, 'mensaje' => 'Método no permitido.'], 405);
  }

  $raw = file_get_contents('php://input');
  $data = json_decode($raw ?: '', true);
  if (!is_array($data)) $data = $_POST;

  $id = isset($data['id_descuento_hermanos']) ? (int)$data['id_descuento_hermanos'] : 0;
  $cant = isset($data['cantidad_hermanos']) ? (int)$data['cantidad_hermanos'] : 0;

  if ($id <= 0 && $cant < 2) {
    dhe_json_out(['exito' => false, 'mensaje' => 'Falta id_descuento_hermanos o cantidad_hermanos.'], 400);
  }

  if ($id > 0) {
    $st = $pdo->prepare("UPDATE descuentos_hermanos SET activo = 0 WHERE id_descuento_hermanos = :id");
    $st->execute([':id' => $id]);
  } else {
    $st = $pdo->prepare("UPDATE descuentos_hermanos SET activo = 0 WHERE cantidad_hermanos = :cant");
    $st->execute([':cant' => $cant]);
  }

  dhe_json_out(['exito' => true, 'mensaje' => 'Descuento familiar eliminado.']);
} catch (Throwable $e) {
  dhe_json_out([
    'exito' => false,
    'mensaje' => 'Error al eliminar descuento familiar.',
    'detalle' => $e->getMessage(),
  ], 500);
}
