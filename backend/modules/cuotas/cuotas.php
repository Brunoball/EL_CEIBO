<?php
// backend/modules/cuotas/cuotas.php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

const ID_MES_ANUAL        = 13; // CONTADO ANUAL
const ID_MES_1ER_MITAD    = 15; // 1ER MITAD
const ID_MES_2DA_MITAD    = 16; // 2DA MITAD

// Rangos de meses cubiertos por mitades
const MITAD1_DESDE = 1;  // ENERO
const MITAD1_HASTA = 6;  // JUNIO
const MITAD2_DESDE = 7;  // JULIO
const MITAD2_HASTA = 12; // DICIEMBRE

/**
 * ✅ Regla corregida:
 * - Si activo=1 => SIEMPRE elegible (no se excluye por ingreso)
 * - Si activo=0 => si lo incluimos por pagos, se puede aplicar ingreso como filtro suave
 */
function alumnoElegible(array $a, int $mesPeriodo, int $anioPeriodo): bool {
  if ((int)($a['activo'] ?? 0) === 1) return true;

  $ingreso = $a['ingreso'] ?? null;
  if (!$ingreso) return true;

  try {
    $f = new DateTime((string)$ingreso);
  } catch (Throwable $e) {
    return true;
  }

  $mesIng  = (int)$f->format('m');
  $anioIng = (int)$f->format('Y');

  return ($anioIng < $anioPeriodo) || ($anioIng === $anioPeriodo && $mesIng <= $mesPeriodo);
}

/* === Endpoint: listar años con pagos (solo años existentes) ===
   GET ...?action=cuotas&listar_anios=1
*/
if (isset($_GET['listar_anios'])) {
  try {
    if (!($pdo instanceof PDO)) throw new RuntimeException('Conexión PDO no disponible.');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // ✅ Nuevo: años por anio_aplicado (y fallback por si quedaron 0 viejos)
    $st = $pdo->query("
      SELECT DISTINCT
        CASE
          WHEN anio_aplicado IS NOT NULL AND anio_aplicado > 0 THEN anio_aplicado
          ELSE YEAR(fecha_pago)
        END AS anio
      FROM pagos
      WHERE estado IN ('pagado','condonado')
      ORDER BY anio DESC
    ");
    $rows = $st->fetchAll(PDO::FETCH_COLUMN);

    $anios = [];
    foreach ($rows ?: [] as $y) {
      $y = (int)$y;
      if ($y > 0) $anios[] = ['id' => $y, 'nombre' => (string)$y];
    }

    echo json_encode(['exito' => true, 'anios' => $anios], JSON_UNESCAPED_UNICODE);
    exit;
  } catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'No se pudieron obtener los años'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}

try {
  if (!($pdo instanceof PDO)) throw new RuntimeException('Conexión PDO no disponible.');
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  // == Parámetros ==
  // ✅ ahora "anio" es AÑO APLICADO (no fecha_pago)
  $anioFiltro  = isset($_GET['anio']) ? max(1900, (int)$_GET['anio']) : (int)date('Y');
  $idMesFiltro = isset($_GET['id_mes']) ? (int)$_GET['id_mes'] : 0;

  $soloPagados = isset($_GET['pagados']);
  $soloCondon  = isset($_GET['condonados']);

  // ✅ filtro "solo cobrador"
  $soloCobrador = (isset($_GET['solo_cobrador']) && (int)$_GET['solo_cobrador'] === 1);

  // == Meses ==
  $stMes = $pdo->query("SELECT id_mes, nombre FROM meses ORDER BY id_mes");
  $mesesRows = $stMes->fetchAll(PDO::FETCH_ASSOC);

  $meses = [];
  foreach ($mesesRows as $m) {
    $idMesCatalogo = (int)$m['id_mes'];
    $meses[$idMesCatalogo] = (string)$m['nombre'];
  }

  // fallback por si faltan en tabla (seguridad)
  if (!isset($meses[ID_MES_ANUAL]))      $meses[ID_MES_ANUAL]      = 'CONTADO ANUAL';
  if (!isset($meses[ID_MES_1ER_MITAD]))  $meses[ID_MES_1ER_MITAD]  = '1ER MITAD';
  if (!isset($meses[ID_MES_2DA_MITAD]))  $meses[ID_MES_2DA_MITAD]  = '2DA MITAD';

  // ✅ Mitad asociada al mes consultado
  $mesMitadConsulta = 0;
  if ($idMesFiltro >= MITAD1_DESDE && $idMesFiltro <= MITAD1_HASTA) $mesMitadConsulta = ID_MES_1ER_MITAD;
  if ($idMesFiltro >= MITAD2_DESDE && $idMesFiltro <= MITAD2_HASTA) $mesMitadConsulta = ID_MES_2DA_MITAD;
  if ($idMesFiltro === ID_MES_1ER_MITAD) $mesMitadConsulta = ID_MES_1ER_MITAD;
  if ($idMesFiltro === ID_MES_2DA_MITAD) $mesMitadConsulta = ID_MES_2DA_MITAD;

  // ✅ ¿Incluimos inactivos?
  $incluirInactivos = ($idMesFiltro > 0) && ($soloPagados || $soloCondon);

  // == Alumnos ==
  $sqlAlu = "
    SELECT
      a.id_alumno, a.apellido, a.nombre, a.num_documento,
      a.domicilio, a.localidad, a.telefono,
      a.id_año, a.id_division, a.id_cat_monto AS id_categoria, a.id_cat_monto, a.activo, a.ingreso,
      a.es_cobrador
    FROM alumnos a
  ";

  $where = [];
  $bind  = [];

  if ($soloCobrador) {
    $where[] = "a.es_cobrador = 1";
  }

  if ($incluirInactivos) {
    // ✅ ahora busca pagos por anio_aplicado y estado, no por fecha_pago
    $where[] = "
      (
        a.activo = 1
        OR EXISTS (
          SELECT 1
            FROM pagos p
           WHERE p.id_alumno = a.id_alumno
             AND p.id_mes IN (:mes_consulta, :mes_anual, :mes_mitad)
             AND p.estado IN ('pagado','condonado')
             AND p.anio_aplicado = :anio_aplicado
        )
      )
    ";
    $bind[':mes_consulta']   = (int)($idMesFiltro ?: 0);
    $bind[':mes_anual']      = (int)ID_MES_ANUAL;
    $bind[':mes_mitad']      = (int)($mesMitadConsulta ?: 0);
    $bind[':anio_aplicado']  = (int)$anioFiltro;
  } else {
    $where[] = "a.activo = 1";
  }

  if (!empty($where)) {
    $sqlAlu .= " WHERE " . implode(" AND ", $where) . " ";
  }

  $sqlAlu .= " ORDER BY a.apellido ASC, a.nombre ASC ";

  $stAlu = $pdo->prepare($sqlAlu);
  foreach ($bind as $k => $v) {
    $stAlu->bindValue($k, $v, PDO::PARAM_INT);
  }
  $stAlu->execute();
  $alumnos = $stAlu->fetchAll(PDO::FETCH_ASSOC);

  // == Pagos del año aplicado ==
  $paramsPagos = [':anio' => (int)$anioFiltro];

  $mostrarSoloAnual      = ($idMesFiltro === ID_MES_ANUAL);
  $mostrarSoloMitad1     = ($idMesFiltro === ID_MES_1ER_MITAD);
  $mostrarSoloMitad2     = ($idMesFiltro === ID_MES_2DA_MITAD);

  $debeFiltrarPorMes = ($idMesFiltro > 0 && $idMesFiltro !== ID_MES_ANUAL);

    if ($debeFiltrarPorMes) {
      $sqlPag = "
        SELECT id_alumno, id_mes, estado
          FROM pagos
         WHERE estado IN ('pagado','condonado')
           AND anio_aplicado = :anio
           AND id_mes IN (:mes, :anual, :mitad)
      ";
      $paramsPagos[':mes']   = (int)$idMesFiltro;
      $paramsPagos[':anual'] = (int)ID_MES_ANUAL;
      $paramsPagos[':mitad'] = (int)($mesMitadConsulta ?: 0);
    } else {
      $sqlPag = "
        SELECT id_alumno, id_mes, estado
          FROM pagos
         WHERE estado IN ('pagado','condonado')
           AND anio_aplicado = :anio
      ";
  }

  $stPag = $pdo->prepare($sqlPag);
  foreach ($paramsPagos as $k => $v) {
    $stPag->bindValue($k, $v, PDO::PARAM_INT);
  }
  $stPag->execute();
  $pagos = $stPag->fetchAll(PDO::FETCH_ASSOC);

  // Indexación de pagos
  $pagoDirecto   = [];
  $pagoAnual     = [];
  $pagoMitad1    = [];
  $pagoMitad2    = [];

  foreach ($pagos as $p) {
    $ida = (int)$p['id_alumno'];
    $idm = (int)$p['id_mes'];
    $est = ($p['estado'] === 'condonado') ? 'condonado' : 'pagado';

    if ($idm === ID_MES_ANUAL)       { $pagoAnual[$ida] = $est; continue; }
    if ($idm === ID_MES_1ER_MITAD)   { $pagoMitad1[$ida] = $est; continue; }
    if ($idm === ID_MES_2DA_MITAD)   { $pagoMitad2[$ida] = $est; continue; }

    $pagoDirecto[$ida][$idm] = $est;
  }

  $cuotas = [];

  foreach ($alumnos as $a) {
    $idAlu = (int)$a['id_alumno'];

    $apellido = trim((string)($a['apellido'] ?? ''));
    $nombre   = trim((string)($a['nombre'] ?? ''));
    $nombreCompleto = trim($apellido . ', ' . $nombre, ', ');

    // ==========================
    // ✅ ANUAL (id_mes = 13)
    // ==========================
    if ($mostrarSoloAnual) {
      if (!alumnoElegible($a, 12, $anioFiltro)) continue;

      $estado = isset($pagoAnual[$idAlu]) ? $pagoAnual[$idAlu] : 'deudor';
      if ($soloPagados && $estado !== 'pagado') continue;
      if ($soloCondon  && $estado !== 'condonado') continue;

      $cuotas[] = [
        'id_alumno'    => $idAlu,
        'nombre'       => $nombreCompleto,
        'dni'          => (string)($a['num_documento'] ?? ''),
        'domicilio'    => (string)($a['domicilio'] ?? ''),
        'estado'       => ((int)($a['activo'] ?? 0) === 1 ? 'ACTIVO' : 'INACTIVO'),
        'medio_pago'   => '',
        'mes'          => $meses[ID_MES_ANUAL],
        'id_mes'       => ID_MES_ANUAL,
        'id_año'       => (int)($a['id_año'] ?? 0),
        'id_anio'      => (int)($a['id_año'] ?? 0),
        'id_division'  => (int)($a['id_division'] ?? 0),
        'id_categoria' => (int)($a['id_categoria'] ?? 0),
        'estado_pago'  => $estado,
        'origen_anual' => isset($pagoAnual[$idAlu]) ? 1 : 0,
        'es_cobrador'  => (int)($a['es_cobrador'] ?? 0),
        'anio_aplicado'=> (int)$anioFiltro,
      ];
      continue;
    }

    // ==========================
    // ✅ 1ER MITAD (id_mes = 15)
    // ==========================
    if ($mostrarSoloMitad1) {
      if (!alumnoElegible($a, MITAD1_HASTA, $anioFiltro)) continue;

      $estado = isset($pagoMitad1[$idAlu]) ? $pagoMitad1[$idAlu] : 'deudor';
      if ($soloPagados && $estado !== 'pagado') continue;
      if ($soloCondon  && $estado !== 'condonado') continue;

      $cuotas[] = [
        'id_alumno'    => $idAlu,
        'nombre'       => $nombreCompleto,
        'dni'          => (string)($a['num_documento'] ?? ''),
        'domicilio'    => (string)($a['domicilio'] ?? ''),
        'estado'       => ((int)($a['activo'] ?? 0) === 1 ? 'ACTIVO' : 'INACTIVO'),
        'medio_pago'   => '',
        'mes'          => $meses[ID_MES_1ER_MITAD],
        'id_mes'       => ID_MES_1ER_MITAD,
        'id_año'       => (int)($a['id_año'] ?? 0),
        'id_anio'      => (int)($a['id_año'] ?? 0),
        'id_division'  => (int)($a['id_division'] ?? 0),
        'id_categoria' => (int)($a['id_categoria'] ?? 0),
        'estado_pago'  => $estado,
        'origen_anual' => 0,
        'es_cobrador'  => (int)($a['es_cobrador'] ?? 0),
        'anio_aplicado'=> (int)$anioFiltro,
      ];
      continue;
    }

    // ==========================
    // ✅ 2DA MITAD (id_mes = 16)
    // ==========================
    if ($mostrarSoloMitad2) {
      if (!alumnoElegible($a, MITAD2_HASTA, $anioFiltro)) continue;

      $estado = isset($pagoMitad2[$idAlu]) ? $pagoMitad2[$idAlu] : 'deudor';
      if ($soloPagados && $estado !== 'pagado') continue;
      if ($soloCondon  && $estado !== 'condonado') continue;

      $cuotas[] = [
        'id_alumno'    => $idAlu,
        'nombre'       => $nombreCompleto,
        'dni'          => (string)($a['num_documento'] ?? ''),
        'domicilio'    => (string)($a['domicilio'] ?? ''),
        'estado'       => ((int)($a['activo'] ?? 0) === 1 ? 'ACTIVO' : 'INACTIVO'),
        'medio_pago'   => '',
        'mes'          => $meses[ID_MES_2DA_MITAD],
        'id_mes'       => ID_MES_2DA_MITAD,
        'id_año'       => (int)($a['id_año'] ?? 0),
        'id_anio'      => (int)($a['id_año'] ?? 0),
        'id_division'  => (int)($a['id_division'] ?? 0),
        'id_categoria' => (int)($a['id_categoria'] ?? 0),
        'estado_pago'  => $estado,
        'origen_anual' => 0,
        'es_cobrador'  => (int)($a['es_cobrador'] ?? 0),
        'anio_aplicado'=> (int)$anioFiltro,
      ];
      continue;
    }

    // ==========================
    // ✅ Meses 1..12 (normal)
    // ==========================
    $listaMeses = range(1, 12);
    if ($idMesFiltro > 0 && $idMesFiltro !== ID_MES_ANUAL) {
      $listaMeses = [$idMesFiltro];
    }

    foreach ($listaMeses as $idm) {
      $idm = (int)$idm;
      if ($idm < 1 || $idm > 12) continue;

      if (!alumnoElegible($a, $idm, $anioFiltro)) continue;

      if (isset($pagoDirecto[$idAlu][$idm])) {
        $estado = $pagoDirecto[$idAlu][$idm];
        $fromAnual = 0;
      } elseif (isset($pagoAnual[$idAlu])) {
        $estado = $pagoAnual[$idAlu];
        $fromAnual = 1;
      } elseif ($idm >= MITAD1_DESDE && $idm <= MITAD1_HASTA && isset($pagoMitad1[$idAlu])) {
        $estado = $pagoMitad1[$idAlu];
        $fromAnual = 0;
      } elseif ($idm >= MITAD2_DESDE && $idm <= MITAD2_HASTA && isset($pagoMitad2[$idAlu])) {
        $estado = $pagoMitad2[$idAlu];
        $fromAnual = 0;
      } else {
        $estado = 'deudor';
        $fromAnual = 0;
      }

      if ($soloPagados && $estado !== 'pagado') continue;
      if ($soloCondon  && $estado !== 'condonado') continue;

      $cuotas[] = [
        'id_alumno'    => $idAlu,
        'nombre'       => $nombreCompleto,
        'dni'          => (string)($a['num_documento'] ?? ''),
        'domicilio'    => (string)($a['domicilio'] ?? ''),
        'estado'       => ((int)($a['activo'] ?? 0) === 1 ? 'ACTIVO' : 'INACTIVO'),
        'medio_pago'   => '',
        'mes'          => $meses[$idm] ?? (string)$idm,
        'id_mes'       => $idm,
        'id_año'       => (int)($a['id_año'] ?? 0),
        'id_anio'      => (int)($a['id_año'] ?? 0),
        'id_division'  => (int)($a['id_division'] ?? 0),
        'id_categoria' => (int)($a['id_categoria'] ?? 0),
        'estado_pago'  => $estado,
        'origen_anual' => $fromAnual,
        'es_cobrador'  => (int)($a['es_cobrador'] ?? 0),
        'anio_aplicado'=> (int)$anioFiltro,
      ];
    }
  }

  echo json_encode([
    'exito' => true,
    'cuotas' => $cuotas,
    'solo_cobrador' => $soloCobrador ? 1 : 0
  ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(200);
  echo json_encode(['exito' => false, 'mensaje' => 'Error al obtener cuotas: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}