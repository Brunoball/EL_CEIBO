<?php
// ✅ REEMPLAZAR COMPLETO
// backend/modules/cuotas/meses_pagados.php

require_once __DIR__ . '/../../config/db.php';

// CORS (ajustá el origin si hace falta)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header("Vary: Origin");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
  exit;
}

// Validación básica
$id_alumno = isset($_GET['id_alumno']) ? (int)$_GET['id_alumno'] : 0;
$anio      = isset($_GET['anio']) ? (int)$_GET['anio'] : (int)date('Y');
if ($anio < 2000 || $anio > 2100) $anio = (int)date('Y');

if ($id_alumno <= 0) {
  echo json_encode(['exito' => false, 'mensaje' => 'id_alumno inválido'], JSON_UNESCAPED_UNICODE);
  exit;
}

// ✅ Año aplicado robusto (si anio_aplicado está vacío/0 -> cae a YEAR(fecha_pago))
const ANIO_SQL = "COALESCE(NULLIF(p.anio_aplicado,0), YEAR(p.fecha_pago))";

try {
  /* =========================
     PDO
  ========================= */
  if (isset($pdo) && $pdo instanceof PDO) {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sql = "
      SELECT p.id_mes, p.estado
        FROM pagos p
       WHERE p.id_alumno = :id_alumno
         AND " . ANIO_SQL . " = :anio
    ";

    $st = $pdo->prepare($sql);
    $st->execute([
      ':id_alumno' => $id_alumno,
      ':anio'      => $anio,
    ]);

    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    $detalles = [];
    $idsMeses = []; // 1..12
    $idsTodos = []; // 1..16

    foreach ($rows as $r) {
      $id_mes = (int)($r['id_mes'] ?? 0);
      if ($id_mes <= 0) continue;

      $estado = isset($r['estado']) ? strtolower((string)$r['estado']) : '';
      if ($estado === '') $estado = 'pagado';

      // detalles: incluir TODOS los períodos 1..16
      if ($id_mes >= 1 && $id_mes <= 16) {
        $detalles[] = [
          'id_mes' => $id_mes,
          'estado' => $estado,
        ];
        $idsTodos[$id_mes] = true;
      }

      // compat: meses comunes 1..12
      if ($id_mes >= 1 && $id_mes <= 12) {
        $idsMeses[$id_mes] = true;
      }
    }

    echo json_encode([
      'exito'            => true,
      'meses_pagados'    => array_values(array_map('intval', array_keys($idsMeses))),
      'periodos_pagados' => array_values(array_map('intval', array_keys($idsTodos))),
      'detalles'         => $detalles,
      'ingreso'          => null,
      // útil para debug:
      'anio_aplicado'    => $anio,
    ], JSON_UNESCAPED_UNICODE);
    exit;
  }

  /* =========================
     mysqli (fallback)
  ========================= */
  if (isset($conn) && $conn instanceof mysqli) {
    // OJO: en mysqli no puedo interpolar ANIO_SQL con placeholders, lo armo directo
    $sql = "SELECT p.id_mes, p.estado
              FROM pagos p
             WHERE p.id_alumno = ?
               AND " . ANIO_SQL . " = ?";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param('ii', $id_alumno, $anio);
    $stmt->execute();
    $result = $stmt->get_result();

    $detalles = [];
    $idsMeses = [];
    $idsTodos = [];

    while ($r = $result->fetch_assoc()) {
      $id_mes = (int)($r['id_mes'] ?? 0);
      if ($id_mes <= 0) continue;

      $estado = isset($r['estado']) ? strtolower((string)$r['estado']) : '';
      if ($estado === '') $estado = 'pagado';

      if ($id_mes >= 1 && $id_mes <= 16) {
        $detalles[] = [
          'id_mes' => $id_mes,
          'estado' => $estado,
        ];
        $idsTodos[$id_mes] = true;
      }

      if ($id_mes >= 1 && $id_mes <= 12) {
        $idsMeses[$id_mes] = true;
      }
    }
    $stmt->close();

    echo json_encode([
      'exito'            => true,
      'meses_pagados'    => array_values(array_map('intval', array_keys($idsMeses))),
      'periodos_pagados' => array_values(array_map('intval', array_keys($idsTodos))),
      'detalles'         => $detalles,
      'ingreso'          => null,
      'anio_aplicado'    => $anio,
    ], JSON_UNESCAPED_UNICODE);
    exit;
  }

  echo json_encode(['exito' => false, 'mensaje' => 'Conexión a BD no disponible'], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
  echo json_encode([
    'exito'   => false,
    'mensaje' => 'Error interno',
    'detalle' => $e->getMessage(),
  ], JSON_UNESCAPED_UNICODE);
}