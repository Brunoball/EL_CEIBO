<?php
// backend/modules/cuotas/registrar_pago.php
// Club: registra pagos individuales o de grupo familiar.
// Si se paga el grupo familiar, cada socio toma su propio monto de categoría
// y se aplica el descuento familiar global por porcentaje.

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

const PORCENTAJE_COBRADOR = 15;
const FACTOR_COOPERADORA = 0.85;
const DESCRIPCION_COBRADOR = 'COBRADOR';

function rp_json(array $data, int $status = 200): void {
  http_response_code($status);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function rp_table_exists(PDO $pdo, string $table): bool {
  $st = $pdo->prepare("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t LIMIT 1");
  $st->execute([':t' => $table]);
  return (bool)$st->fetchColumn();
}

function rp_column_exists(PDO $pdo, string $table, string $column): bool {
  $st = $pdo->prepare("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c LIMIT 1");
  $st->execute([':t' => $table, ':c' => $column]);
  return (bool)$st->fetchColumn();
}

function rp_asegurar_descuentos(PDO $pdo): void {
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

function rp_descuento(PDO $pdo, int $cantidad): float {
  // OJO: en MySQL un CREATE TABLE dentro de una transacción hace COMMIT implícito.
  // Por eso solo aseguramos la tabla fuera de transacciones; antes de beginTransaction()
  // ya se llama una vez a rp_asegurar_descuentos().
  if (!$pdo->inTransaction()) rp_asegurar_descuentos($pdo);
  if ($cantidad < 2) return 0.0;

  $st = $pdo->prepare("\n    SELECT porcentaje_descuento\n    FROM descuentos_hermanos\n    WHERE activo = 1 AND cantidad_hermanos = :cant\n    LIMIT 1\n  ");
  $st->execute([':cant' => $cantidad]);
  $pct = $st->fetchColumn();
  if ($pct === false) return 0.0;
  return max(0.0, min(100.0, (float)$pct));
}

function rp_family_count(PDO $pdo, int $idAlumno): int {
  if (!rp_column_exists($pdo, 'alumnos', 'id_familia')) return 1;
  $st = $pdo->prepare("SELECT id_familia FROM alumnos WHERE id_alumno = :id LIMIT 1");
  $st->execute([':id' => $idAlumno]);
  $idFamilia = (int)($st->fetchColumn() ?: 0);
  if ($idFamilia <= 0) return 1;

  $st = $pdo->prepare("SELECT COUNT(*) FROM alumnos WHERE id_familia = :idf AND COALESCE(activo, 1) = 1");
  $st->execute([':idf' => $idFamilia]);
  return max(1, (int)($st->fetchColumn() ?: 0));
}

function rp_montos_categoria(PDO $pdo, int $idAlumno, int $familyCount): array {
  $st = $pdo->prepare("\n    SELECT cm.monto_mensual, cm.monto_anual, cm.nombre_categoria\n    FROM alumnos a\n    INNER JOIN categoria_monto cm ON cm.id_cat_monto = a.id_cat_monto\n    WHERE a.id_alumno = :id\n    LIMIT 1\n  ");
  $st->execute([':id' => $idAlumno]);
  $row = $st->fetch(PDO::FETCH_ASSOC);
  if (!$row) {
    throw new RuntimeException("No se pudo obtener la categoría del socio ID {$idAlumno}.");
  }

  $baseMensual = max(0.0, (float)($row['monto_mensual'] ?? 0));
  $baseAnual = max(0.0, (float)($row['monto_anual'] ?? 0));
  $pct = rp_descuento($pdo, $familyCount);
  $factor = 1 - ($pct / 100);

  $mensual = (int)round($baseMensual * $factor);
  $anual = (int)round($baseAnual * $factor);

  $map = [];
  for ($m = 1; $m <= 12; $m++) $map[$m] = $mensual;
  $map[13] = $anual;
  $map[15] = (int)round($anual / 2);
  $map[16] = (int)round($anual / 2);

  return [
    'map' => $map,
    'categoria' => (string)($row['nombre_categoria'] ?? ''),
    'porcentaje_descuento' => $pct,
    'base_mensual' => $baseMensual,
    'base_anual' => $baseAnual,
  ];
}

function rp_id_descripcion_cobrador(PDO $pdo): int {
  $st = $pdo->prepare("SELECT id_cont_descripcion FROM contable_descripcion WHERE UPPER(TRIM(nombre_descripcion)) = :n LIMIT 1");
  $st->execute([':n' => DESCRIPCION_COBRADOR]);
  $id = (int)($st->fetchColumn() ?: 0);
  if ($id > 0) return $id;

  $st = $pdo->prepare("INSERT INTO contable_descripcion (nombre_descripcion) VALUES (:n)");
  $st->execute([':n' => DESCRIPCION_COBRADOR]);
  return (int)$pdo->lastInsertId();
}

function rp_es_cobrador(PDO $pdo, int $idAlumno): int {
  $st = $pdo->prepare("SELECT COALESCE(es_cobrador, 0) FROM alumnos WHERE id_alumno = :id LIMIT 1");
  $st->execute([':id' => $idAlumno]);
  $v = $st->fetchColumn();
  if ($v === false) throw new RuntimeException("No existe el socio con ID {$idAlumno}.");
  return (int)$v;
}

function rp_insertar_egreso_cobrador(PDO $pdo, int $idDesc, string $fecha, float $importe, ?int $idMedioPago, int $idAlumno, int $idPago): void {
  if ($importe <= 0) return;

  $cols = ['fecha','id_cont_categoria','id_cont_proveedor','comprobante','id_cont_descripcion','id_medio_pago','importe','comprobante_url'];
  $vals = [':fecha','NULL','NULL',':comprobante',':id_desc',':id_medio',':importe','NULL'];
  $params = [
    ':fecha' => $fecha,
    ':comprobante' => 'PAGO #' . $idPago,
    ':id_desc' => $idDesc,
    ':id_medio' => $idMedioPago,
    ':importe' => $importe,
  ];

  if (rp_column_exists($pdo, 'egresos', 'id_pago_origen')) {
    $cols[] = 'id_pago_origen'; $vals[] = ':id_pago_origen'; $params[':id_pago_origen'] = $idPago;
  }
  if (rp_column_exists($pdo, 'egresos', 'id_alumno_origen')) {
    $cols[] = 'id_alumno_origen'; $vals[] = ':id_alumno_origen'; $params[':id_alumno_origen'] = $idAlumno;
  }

  $sql = 'INSERT INTO egresos (' . implode(',', $cols) . ') VALUES (' . implode(',', $vals) . ')';
  $st = $pdo->prepare($sql);
  $st->execute($params);
}

try {
  if (!isset($pdo) || !($pdo instanceof PDO)) throw new RuntimeException('Conexión PDO no disponible');
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  $payload = json_decode(file_get_contents('php://input'), true) ?: [];

  $idAlumno = isset($payload['id_alumno']) ? (int)$payload['id_alumno'] : 0;
  $periodos = isset($payload['periodos']) && is_array($payload['periodos']) ? array_values($payload['periodos']) : [];
  $condonar = !empty($payload['condonar']);
  $anioAplicado = isset($payload['anio']) ? (int)$payload['anio'] : (int)date('Y');
  if ($anioAplicado < 2000 || $anioAplicado > 2100) $anioAplicado = (int)date('Y');

  $idMedioPago = isset($payload['id_medio_pago']) && $payload['id_medio_pago'] !== '' ? (int)$payload['id_medio_pago'] : null;
  $montoLibre = isset($payload['monto_libre']) ? (int)$payload['monto_libre'] : 0;
  $montoUI = isset($payload['monto_unitario']) ? (int)$payload['monto_unitario'] : null;

  $fechaPago = trim((string)($payload['fecha_pago'] ?? ''));
  if ($fechaPago === '') $fechaPago = (new DateTime())->format('Y-m-d');
  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaPago)) rp_json(['exito' => false, 'mensaje' => 'Fecha de pago inválida.']);
  [$yy, $mm, $dd] = array_map('intval', explode('-', $fechaPago));
  if (!checkdate($mm, $dd, $yy)) rp_json(['exito' => false, 'mensaje' => 'Fecha de pago inválida.']);

  if ($idAlumno <= 0) rp_json(['exito' => false, 'mensaje' => 'ID de socio inválido.']);
  if (empty($periodos)) rp_json(['exito' => false, 'mensaje' => 'No se enviaron períodos a registrar.']);
  if (!$condonar && (!$idMedioPago || $idMedioPago <= 0)) rp_json(['exito' => false, 'mensaje' => 'Debés seleccionar un medio de pago.']);

  $montosPayload = [];
  if (!empty($payload['montos_por_periodo']) && is_array($payload['montos_por_periodo'])) {
    foreach ($payload['montos_por_periodo'] as $k => $v) {
      $kk = (int)$k; $vv = (int)$v;
      if ($kk > 0) $montosPayload[$kk] = max(0, $vv);
    }
  }

  $aplicarFamilia = !empty($payload['aplicar_a_familia']);
  $idsFamilia = [];
  if ($aplicarFamilia && isset($payload['ids_familia']) && is_array($payload['ids_familia'])) {
    foreach ($payload['ids_familia'] as $idf) {
      $idf = (int)$idf;
      if ($idf > 0 && $idf !== $idAlumno) $idsFamilia[$idf] = true;
    }
  }

  $alumnosObjetivo = [$idAlumno];
  if ($aplicarFamilia && !empty($idsFamilia)) {
    foreach (array_keys($idsFamilia) as $idf) $alumnosObjetivo[] = (int)$idf;
    $alumnosObjetivo = array_values(array_unique(array_map('intval', $alumnosObjetivo)));
    sort($alumnosObjetivo);
  }

  $esPagoGrupo = count($alumnosObjetivo) > 1;
  $familyCountGrupo = $esPagoGrupo ? count($alumnosObjetivo) : rp_family_count($pdo, $idAlumno);

  $estadoRegistrar = $condonar ? 'condonado' : 'pagado';

  $stExist = $pdo->prepare("SELECT id_mes, estado FROM pagos WHERE id_alumno = :id AND anio_aplicado = :anio");
  $stIns = $pdo->prepare("\n    INSERT INTO pagos (id_alumno, id_mes, anio_aplicado, fecha_pago, estado, monto_pago, id_medio_pago)\n    VALUES (:id_alumno, :id_mes, :anio, :fecha, :estado, :monto, :medio)\n  ");

  // Importante: crear/verificar tablas auxiliares ANTES de iniciar la transacción.
  // Si se ejecuta CREATE TABLE después del beginTransaction(), MySQL corta la transacción
  // y luego commit() dispara: "There is no active transaction".
  rp_asegurar_descuentos($pdo);

  $pdo->beginTransaction();
  $idDescCobrador = rp_id_descripcion_cobrador($pdo);

  $totalInsertados = 0;
  $detalle = [];
  $totalBruto = 0;
  $totalNeto = 0;
  $totalComision = 0;

  foreach ($alumnosObjetivo as $idA) {
    $idA = (int)$idA;
    if ($idA <= 0) continue;

    $esCobrador = rp_es_cobrador($pdo, $idA);
    $familyCountUsado = $esPagoGrupo ? $familyCountGrupo : rp_family_count($pdo, $idA);

    // Si se paga grupo, cada integrante obtiene su propio monto según su deporte/categoría.
    // Si no es grupo, respetamos los montos que vinieron del frontend para no romper pagos libres/manuales.
    $montosBase = $montosPayload;
    $infoMonto = ['categoria' => '', 'porcentaje_descuento' => 0];
    if (!$condonar && $montoLibre <= 0 && ($esPagoGrupo || empty($montosBase))) {
      $infoMonto = rp_montos_categoria($pdo, $idA, $familyCountUsado);
      $montosBase = $infoMonto['map'];
    }

    $stExist->execute([':id' => $idA, ':anio' => $anioAplicado]);
    $ya = [];
    foreach ($stExist->fetchAll(PDO::FETCH_ASSOC) as $r) $ya[(int)$r['id_mes']] = (string)$r['estado'];

    $insertadosAlumno = 0;
    $yaRegistradosAlumno = [];
    $brutoAlumno = 0;
    $netoAlumno = 0;
    $comisionAlumno = 0;

    foreach ($periodos as $periodoRaw) {
      $idMes = (int)$periodoRaw;
      if ($idMes <= 0) continue;

      if (array_key_exists($idMes, $ya)) {
        $yaRegistradosAlumno[] = ['periodo' => $idMes, 'estado' => $ya[$idMes]];
        continue;
      }

      $montoBruto = 0;
      if (!$condonar) {
        if ($montoLibre > 0) $montoBruto = $montoLibre;
        elseif (isset($montosBase[$idMes])) $montoBruto = (int)$montosBase[$idMes];
        elseif ($montoUI && $montoUI > 0) $montoBruto = (int)$montoUI;
      }
      $montoBruto = max(0, (int)$montoBruto);

      $montoComision = 0;
      $montoNeto = $montoBruto;
      if (!$condonar && $esCobrador === 1 && $montoBruto > 0) {
        $montoComision = (int)round($montoBruto * (PORCENTAJE_COBRADOR / 100));
        $montoNeto = (int)round($montoBruto * FACTOR_COOPERADORA);
      }

      $stIns->execute([
        ':id_alumno' => $idA,
        ':id_mes' => $idMes,
        ':anio' => $anioAplicado,
        ':fecha' => $fechaPago,
        ':estado' => $estadoRegistrar,
        ':monto' => $montoNeto,
        ':medio' => (!$condonar && $idMedioPago && $idMedioPago > 0) ? $idMedioPago : null,
      ]);

      $idPago = (int)$pdo->lastInsertId();
      if (!$condonar && $esCobrador === 1 && $montoComision > 0) {
        rp_insertar_egreso_cobrador($pdo, $idDescCobrador, $fechaPago, (float)$montoComision, $idMedioPago, $idA, $idPago);
      }

      $insertadosAlumno++;
      $totalInsertados++;
      $brutoAlumno += $montoBruto;
      $netoAlumno += $montoNeto;
      $comisionAlumno += $montoComision;
      $totalBruto += $montoBruto;
      $totalNeto += $montoNeto;
      $totalComision += $montoComision;
    }

    $detalle[] = [
      'id_alumno' => $idA,
      'es_cobrador' => $esCobrador,
      'family_count_usado' => $familyCountUsado,
      'porcentaje_descuento_familiar' => (float)($infoMonto['porcentaje_descuento'] ?? 0),
      'categoria' => (string)($infoMonto['categoria'] ?? ''),
      'insertados' => $insertadosAlumno,
      'monto_bruto_original' => $brutoAlumno,
      'monto_neto_cooperadora' => $netoAlumno,
      'monto_comision_cobrador' => $comisionAlumno,
      'ya_registrados' => $yaRegistradosAlumno,
    ];
  }

  if ($pdo->inTransaction()) {
    $pdo->commit();
  }

  if ($totalInsertados > 0) {
    rp_json([
      'exito' => true,
      'mensaje' => 'Pago registrado correctamente.',
      'insertados_total' => $totalInsertados,
      'familia_aplicada' => $esPagoGrupo,
      'alumnos_procesados' => count($alumnosObjetivo),
      'family_count_usado' => $familyCountGrupo,
      'fecha_pago_usada' => $fechaPago,
      'id_medio_pago_seleccionado' => (!$condonar && $idMedioPago && $idMedioPago > 0) ? $idMedioPago : null,
      'monto_bruto_original' => $totalBruto,
      'monto_neto_cooperadora' => $totalNeto,
      'monto_comision_cobrador' => $totalComision,
      'porcentaje_cobrador' => PORCENTAJE_COBRADOR,
      'detalle_por_alumno' => $detalle,
    ]);
  }

  rp_json([
    'exito' => false,
    'mensaje' => 'No se insertaron registros (todos ya estaban cargados para ese año).',
    'familia_aplicada' => $esPagoGrupo,
    'alumnos_procesados' => count($alumnosObjetivo),
    'fecha_pago_usada' => $fechaPago,
    'detalle_por_alumno' => $detalle,
  ]);

} catch (Throwable $e) {
  if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
  rp_json(['exito' => false, 'mensaje' => 'Error al registrar pagos: ' . $e->getMessage()]);
}
