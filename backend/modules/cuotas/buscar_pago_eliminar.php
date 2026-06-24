<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

try {
  if (!isset($pdo) || !($pdo instanceof PDO)) {
    json_out(['exito' => false, 'mensaje' => 'Conexión PDO no disponible.'], 500);
  }

  $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

  if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
  }

  if ($method !== 'POST') {
    json_out(['exito' => false, 'mensaje' => 'Método no permitido (usar POST).'], 405);
  }

  $raw = file_get_contents('php://input');
  $body = json_decode($raw ?: '{}', true);
  if (!is_array($body)) $body = [];

  $id_alumno = (int)($body['id_alumno'] ?? 0);
  $id_mes    = (int)($body['id_mes'] ?? 0);
  $anio      = (int)($body['anio'] ?? 0);

  if ($id_alumno <= 0 || $id_mes <= 0 || $anio <= 0) {
    json_out([
      'exito' => false,
      'mensaje' => 'Parámetros inválidos. Requiere id_alumno, id_mes y anio.',
      'debug' => [
        'id_alumno' => $id_alumno,
        'id_mes' => $id_mes,
        'anio' => $anio,
      ],
    ], 400);
  }

  /*
    IMPORTANTE:
    Buscar por anio_aplicado, NO por YEAR(fecha_pago).
    Ejemplo real:
    id_alumno 823 tiene id_mes 15, anio_aplicado 2026,
    pero fecha_pago 2025-12-28.
  */

  // 1) Buscar pago exacto del período seleccionado
  $sqlExacto = "
    SELECT 
      p.id_pago,
      p.id_alumno,
      p.id_mes,
      p.anio_aplicado,
      p.fecha_pago,
      p.estado,
      p.monto_pago,
      p.id_medio_pago,
      m.nombre AS nombre_mes
    FROM pagos p
    LEFT JOIN meses m ON m.id_mes = p.id_mes
    WHERE p.id_alumno = :id_alumno
      AND p.id_mes = :id_mes
      AND p.anio_aplicado = :anio
    ORDER BY p.id_pago DESC
    LIMIT 1
  ";

  $st = $pdo->prepare($sqlExacto);
  $st->execute([
    ':id_alumno' => $id_alumno,
    ':id_mes' => $id_mes,
    ':anio' => $anio,
  ]);

  $row = $st->fetch(PDO::FETCH_ASSOC);

  if ($row) {
    $nombreMes = strtoupper((string)($row['nombre_mes'] ?? ''));

    $esEspecial = (
      str_contains(strtolower($nombreMes), 'anual') ||
      str_contains(strtolower($nombreMes), 'contado') ||
      str_contains(strtolower($nombreMes), 'mitad') ||
      str_contains(strtolower($nombreMes), 'h1') ||
      str_contains(strtolower($nombreMes), 'h2')
    );

    json_out([
      'exito' => true,
      'mensaje' => 'Pago encontrado.',
      'id_pago' => (int)$row['id_pago'],
      'id_mes_real' => (int)$row['id_mes'],
      'id_mes_solicitado' => $id_mes,
      'anio_aplicado' => (int)$row['anio_aplicado'],
      'fecha_pago' => $row['fecha_pago'],
      'estado' => $row['estado'],
      'monto_pago' => (float)$row['monto_pago'],
      'nombre_mes' => $nombreMes,
      'warning' => $esEspecial,
      'warning_text' => $esEspecial
        ? '⚠️ Este pago corresponde a ' . $nombreMes . '. Si lo eliminás, eliminás ese período completo.'
        : '',
    ], 200);
  }

  /*
    2) Fallback:
    Si el usuario hizo clic en un mes común pero ese mes está cubierto por:
    - CONTADO ANUAL id 13
    - 1ERA MITAD id 15
    - 2DA MITAD id 16

    Entonces buscamos el pago real asociado.
  */

  $idsCandidatos = [];

  if ($id_mes >= 1 && $id_mes <= 6) {
    // Enero a Junio: anual completo o primera mitad
    $idsCandidatos = [15, 13];
  } elseif ($id_mes >= 7 && $id_mes <= 12) {
    // Julio a Diciembre: anual completo o segunda mitad
    $idsCandidatos = [16, 13];
  } else {
    // Otros períodos: buscar especiales por nombre
    $idsCandidatos = [13, 15, 16];
  }

  $placeholders = implode(',', array_fill(0, count($idsCandidatos), '?'));

  $sqlFallback = "
    SELECT 
      p.id_pago,
      p.id_alumno,
      p.id_mes,
      p.anio_aplicado,
      p.fecha_pago,
      p.estado,
      p.monto_pago,
      p.id_medio_pago,
      m.nombre AS nombre_mes
    FROM pagos p
    LEFT JOIN meses m ON m.id_mes = p.id_mes
    WHERE p.id_alumno = ?
      AND p.anio_aplicado = ?
      AND p.id_mes IN ($placeholders)
    ORDER BY 
      CASE p.id_mes
        WHEN 15 THEN 1
        WHEN 16 THEN 2
        WHEN 13 THEN 3
        ELSE 99
      END,
      p.id_pago DESC
    LIMIT 1
  ";

  $params = [$id_alumno, $anio, ...$idsCandidatos];

  $st2 = $pdo->prepare($sqlFallback);
  $st2->execute($params);

  $row2 = $st2->fetch(PDO::FETCH_ASSOC);

  if ($row2) {
    $nombreMes = strtoupper((string)($row2['nombre_mes'] ?? ''));

    json_out([
      'exito' => true,
      'mensaje' => 'Pago especial encontrado.',
      'id_pago' => (int)$row2['id_pago'],
      'id_mes_real' => (int)$row2['id_mes'],
      'id_mes_solicitado' => $id_mes,
      'anio_aplicado' => (int)$row2['anio_aplicado'],
      'fecha_pago' => $row2['fecha_pago'],
      'estado' => $row2['estado'],
      'monto_pago' => (float)$row2['monto_pago'],
      'nombre_mes' => $nombreMes,
      'warning' => true,
      'warning_text' => '⚠️ Este pago corresponde a ' . $nombreMes . '. Si lo eliminás, eliminás ese período completo.',
    ], 200);
  }

  json_out([
    'exito' => false,
    'mensaje' => 'No se encontró un pago para eliminar en ' . $anio . '.',
    'debug' => [
      'id_alumno' => $id_alumno,
      'id_mes_solicitado' => $id_mes,
      'anio_aplicado' => $anio,
      'ids_candidatos' => $idsCandidatos,
    ],
  ], 404);

} catch (Throwable $e) {
  json_out([
    'exito' => false,
    'mensaje' => 'Error buscando pago para eliminar: ' . $e->getMessage(),
  ], 500);
}