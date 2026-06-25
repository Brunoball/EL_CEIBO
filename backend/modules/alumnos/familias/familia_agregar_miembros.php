<?php
// backend/modules/alumnos/familias/familia_agregar_miembros.php
// Vincula alumnos a una familia

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

  $id_familia = isset($input['id_familia']) ? (int)$input['id_familia'] : 0;

  // ✅ Compatibilidad con el front:
  // - ModalMiembros manda ids_alumno
  // - otros módulos podrían mandar ids_alumnos / alumnos
  $alumnos = $input['ids_alumno'] ?? $input['ids_alumnos'] ?? $input['alumnos'] ?? [];
  if (!is_array($alumnos)) $alumnos = [];

  $ids = [];
  foreach ($alumnos as $v) {
    $iv = (int)$v;
    if ($iv > 0) $ids[] = $iv;
  }
  $ids = array_values(array_unique($ids));

  if ($id_familia <= 0) fam_json(['exito' => false, 'mensaje' => 'id_familia inválido'], 400);
  if (count($ids) === 0) fam_json(['exito' => false, 'mensaje' => 'No se recibieron socios'], 422);

  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  $pdo->beginTransaction();

  // Validar que familia existe
  $st = $pdo->prepare('SELECT id_familia FROM familias WHERE id_familia = :id LIMIT 1');
  $st->execute([':id' => $id_familia]);
  if (!$st->fetch(PDO::FETCH_ASSOC)) {
    $pdo->rollBack();
    fam_json(['exito' => false, 'mensaje' => 'La familia no existe'], 404);
  }

  // UPDATE con IN (seguro porque los placeholders los generamos nosotros)
  $in = implode(',', array_fill(0, count($ids), '?'));
  $sql = "UPDATE alumnos SET id_familia = ? WHERE id_alumno IN ($in)";
  $params = array_merge([$id_familia], $ids);

  $st = $pdo->prepare($sql);
  $st->execute($params);
  $affected = (int)$st->rowCount();

  $pdo->commit();

  fam_json([
    'exito' => true,
    'mensaje' => 'Miembros agregados',
    'vinculados' => $affected,
    'ids' => $ids,
  ]);

} catch (Throwable $e) {
  if (isset($pdo) && ($pdo instanceof PDO) && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  error_log("familia_agregar_miembros ERROR: " . $e->getMessage());
  fam_json(['exito' => false, 'mensaje' => 'Error al agregar miembros', 'error' => $e->getMessage()], 500);
}