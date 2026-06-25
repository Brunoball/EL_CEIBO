<?php
// backend/modules/alumnos/familias/eliminar_familia.php
// ✅ Sin _common.php

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

function fam_json($arr, $code = 200) {
  http_response_code((int)$code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

require_once __DIR__ . '/../../../config/db.php';

try {
  if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    fam_json(['exito' => false, 'mensaje' => 'Método no permitido'], 405);
  }

  if (!isset($pdo) || !($pdo instanceof PDO)) {
    fam_json(['exito' => false, 'mensaje' => 'Conexión PDO no disponible. Revisá backend/config/db.php'], 500);
  }

  $raw = file_get_contents('php://input');
  $raw = ($raw === false) ? '' : $raw;
  $input = json_decode($raw, true);
  if (!is_array($input)) $input = [];

  $id = isset($input['id_familia']) ? (int)$input['id_familia'] : 0;
  $forzar = isset($input['forzar']) ? (int)$input['forzar'] : 0;

  if ($id <= 0) fam_json(['exito' => false, 'mensaje' => 'id_familia inválido'], 400);

  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->beginTransaction();

  // existe?
  $st = $pdo->prepare('SELECT id_familia, nombre_familia FROM familias WHERE id_familia = :id LIMIT 1');
  $st->execute([':id' => $id]);
  $fam = $st->fetch(PDO::FETCH_ASSOC);
  if (!$fam) {
    $pdo->rollBack();
    fam_json(['exito' => false, 'mensaje' => 'La familia no existe'], 404);
  }

  // miembros?
  $st = $pdo->prepare('SELECT COUNT(*) FROM alumnos WHERE id_familia = :id');
  $st->execute([':id' => $id]);
  $cant = (int)($st->fetchColumn() ?: 0);

  if ($cant > 0 && !$forzar) {
    $pdo->rollBack();
    fam_json([
      'exito' => false,
      'mensaje' => 'La familia tiene socios vinculados. Activá "Forzar borrado" para desvincularlos y eliminarla.',
      'miembros' => $cant,
    ], 409);
  }

  if ($cant > 0 && $forzar) {
    // desvincular
    $st = $pdo->prepare('UPDATE alumnos SET id_familia = NULL WHERE id_familia = :id');
    $st->execute([':id' => $id]);
  }

  $st = $pdo->prepare('DELETE FROM familias WHERE id_familia = :id LIMIT 1');
  $st->execute([':id' => $id]);

  $pdo->commit();
  fam_json(['exito' => true, 'mensaje' => 'Familia eliminada']);

} catch (Throwable $e) {
  if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  fam_json(['exito' => false, 'mensaje' => 'Error al eliminar familia', 'error' => $e->getMessage()], 500);
}
