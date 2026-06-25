<?php
// backend/modules/alumnos/familias/familia_quitar_miembro.php
// Desvincula un alumno de una familia

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header('Vary: Origin');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Session');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

function fam_json(array $arr, int $code = 200): void {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

require_once __DIR__ . '/../../../config/db.php';

try {
  if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    fam_json(['exito' => false, 'mensaje' => 'Método no permitido. Usá POST.'], 405);
  }

  if (!isset($pdo) || !($pdo instanceof PDO)) {
    fam_json(['exito' => false, 'mensaje' => 'Conexión PDO no disponible. Revisá backend/config/db.php'], 500);
  }

  $raw = file_get_contents('php://input');
  $raw = ($raw === false) ? '' : $raw;
  $input = json_decode($raw, true);
  if (!is_array($input)) $input = [];

  $id_alumno = isset($input['id_alumno']) ? (int)$input['id_alumno'] : 0;
  if ($id_alumno <= 0) fam_json(['exito' => false, 'mensaje' => 'id_alumno inválido'], 400);

  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  $pdo->beginTransaction();

  // Validar que exista el alumno (opcional pero útil)
  $st = $pdo->prepare('SELECT id_alumno, id_familia FROM alumnos WHERE id_alumno = :id LIMIT 1');
  $st->execute([':id' => $id_alumno]);
  $row = $st->fetch(PDO::FETCH_ASSOC);

  if (!$row) {
    $pdo->rollBack();
    fam_json(['exito' => false, 'mensaje' => 'El socio no existe'], 404);
  }

  // Desvincular
  $st = $pdo->prepare('UPDATE alumnos SET id_familia = NULL WHERE id_alumno = :id');
  $st->execute([':id' => $id_alumno]);
  $affected = (int)$st->rowCount();

  $pdo->commit();

  fam_json([
    'exito' => true,
    'mensaje' => 'Miembro desvinculado',
    'desvinculados' => $affected,
    'id_alumno' => $id_alumno,
  ]);

} catch (Throwable $e) {
  if (isset($pdo) && ($pdo instanceof PDO) && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  error_log("familia_quitar_miembro ERROR: " . $e->getMessage());
  fam_json(['exito' => false, 'mensaje' => 'Error al quitar miembro', 'error' => $e->getMessage()], 500);
}