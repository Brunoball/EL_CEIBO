<?php
// backend/modules/alumnos/familias/alumnos_sin_familia.php
// Lista alumnos activos sin familia (id_familia NULL)

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header('Vary: Origin');
header('Access-Control-Allow-Methods: GET, OPTIONS');
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
  if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    fam_json(['exito' => false, 'mensaje' => 'Método no permitido. Usá GET.'], 405);
  }

  if (!isset($pdo) || !($pdo instanceof PDO)) {
    fam_json(['exito' => false, 'mensaje' => 'Conexión PDO no disponible. Revisá backend/config/db.php'], 500);
  }

  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  // all=1 => incluir activos e inactivos (por si lo querés usar)
  $all = isset($_GET['all']) ? (int)$_GET['all'] : 0;

  // ✅ SQL limpio (sin "\")
  // Nota: uso (id_familia IS NULL OR id_familia=0) por si en tu tabla quedó 0 en vez de NULL.
  $sql = "
    SELECT
      id_alumno,
      apellido,
      nombre,
      num_documento,
      localidad,
      activo
    FROM alumnos
    WHERE (id_familia IS NULL OR id_familia = 0)
      AND (:all = 1 OR activo = 1)
    ORDER BY apellido ASC, nombre ASC
  ";

  $st = $pdo->prepare($sql);
  $st->execute([':all' => $all]);
  $rows = $st->fetchAll(PDO::FETCH_ASSOC);

  // Normalizamos para que el front tenga nombre_completo y dni
  $out = [];
  foreach ($rows as $r) {
    $apellido = (string)($r['apellido'] ?? '');
    $nombre   = (string)($r['nombre'] ?? '');
    $dni      = (string)($r['num_documento'] ?? '');

    $out[] = [
      'id_alumno' => (int)($r['id_alumno'] ?? 0),
      'apellido' => $apellido,
      'nombre' => $nombre,
      'nombre_completo' => trim($apellido . ' ' . $nombre),
      'dni' => $dni,
      'num_documento' => $dni,
      'localidad' => (string)($r['localidad'] ?? ''),
      'activo' => (int)($r['activo'] ?? 0),
    ];
  }

  fam_json(['exito' => true, 'alumnos' => $out]);

} catch (Throwable $e) {
  // 🔎 para ver el motivo exacto en la consola del php -S
  error_log("alumnos_sin_familia ERROR: " . $e->getMessage());
  fam_json([
    'exito' => false,
    'mensaje' => 'Error al listar socios sin familia',
    'error' => $e->getMessage(),
  ], 500);
}