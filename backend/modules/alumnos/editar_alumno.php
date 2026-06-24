<?php
// backend/modules/alumnos/editar_alumno.php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

function aMayus($v) {
    return (isset($v) && $v !== '' && $v !== null) ? mb_strtoupper(trim((string)$v), 'UTF-8') : null;
}

function normalizarFecha(?string $s): ?string {
    $s = trim((string)$s);
    if ($s === '') return null;

    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
        $dt = DateTime::createFromFormat('Y-m-d', $s);
        $err = DateTime::getLastErrors();
        if ($dt && empty($err['warning_count']) && empty($err['error_count'])) return $dt->format('Y-m-d');
    }
    if (preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $s)) {
        $dt = DateTime::createFromFormat('d/m/Y', $s);
        $err = DateTime::getLastErrors();
        if ($dt && empty($err['warning_count']) && empty($err['error_count'])) return $dt->format('Y-m-d');
    }
    return null;
}

try {
    if (!($pdo instanceof PDO)) throw new RuntimeException('Conexión PDO no disponible.');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if ($id <= 0) { echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado']); exit; }

        $sql = "
            SELECT 
                a.id_alumno,
                a.apellido,
                a.nombre,
                a.id_tipo_documento,
                a.num_documento,
                a.id_sexo,
                a.domicilio,
                a.localidad,
                a.telefono,
                a.`id_año`   AS id_anio,
                a.id_division,
                a.id_cat_monto AS id_categoria, -- alias de compatibilidad frontend
                a.id_cat_monto,
                a.ingreso,
                a.observaciones,
                an.`nombre_año`       AS anio_nombre,
                d.`nombre_division`   AS division_nombre,
                cm.`nombre_categoria` AS categoria_nombre,
                cm.`nombre_categoria` AS catm_nombre,
                cm.`monto_mensual`    AS catm_monto_mensual
            FROM alumnos a
            LEFT JOIN anio an             ON an.`id_año`      = a.`id_año`
            LEFT JOIN division d          ON d.`id_division`  = a.`id_division`
            LEFT JOIN categoria_monto cm  ON cm.`id_cat_monto`= a.`id_cat_monto`
            WHERE a.id_alumno = ?
            LIMIT 1
        ";
        $st = $pdo->prepare($sql);
        $st->execute([$id]);
        $alumno = $st->fetch(PDO::FETCH_ASSOC);

        if ($alumno) echo json_encode(['exito' => true, 'alumno' => $alumno], JSON_UNESCAPED_UNICODE);
        else        echo json_encode(['exito' => false, 'mensaje' => 'Socio no encontrado']);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents("php://input");
        $data = json_decode($raw, true) ?: [];

        $id = isset($data['id_alumno']) ? (int)$data['id_alumno'] : 0;
        if ($id <= 0) { echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado']); exit; }

        // Si llega id_categoria desde algún frontend viejo, lo convertimos a id_cat_monto.
        if ((!isset($data['id_cat_monto']) || $data['id_cat_monto'] === '') && isset($data['id_categoria'])) {
            $data['id_cat_monto'] = $data['id_categoria'];
        }
        unset($data['id_categoria']);

        // campos admitidos
        $admitidos = [
            'apellido','nombre','id_tipo_documento','num_documento','id_sexo',
            'domicilio','localidad','telefono',
            'id_anio','id_division','id_cat_monto',
            'ingreso','observaciones'
        ];

        $set = [];
        $val = [];

        foreach ($admitidos as $k) {
            if (!array_key_exists($k, $data)) continue;
            $v = $data[$k];
            if ($v === '') $v = null;

            if (in_array($k, ['apellido','nombre','domicilio','localidad'], true)) {
                $v = aMayus((string)$v);
            }

            if ($k === 'id_anio') {
                $set[] = "`id_año` = ?"; $val[] = ($v !== null ? (int)$v : null); continue;
            }

            if (in_array($k, ['id_tipo_documento','id_sexo','id_division','id_cat_monto'], true)) {
                if ($k === 'id_cat_monto' && $v !== null) {
                    $stCat = $pdo->prepare('SELECT 1 FROM categoria_monto WHERE id_cat_monto = ? LIMIT 1');
                    $stCat->execute([(int)$v]);
                    if (!$stCat->fetchColumn()) {
                        echo json_encode(['exito'=>false,'mensaje'=>'La categoría seleccionada no existe. Actualizá la página y volvé a intentar.'], JSON_UNESCAPED_UNICODE);
                        exit;
                    }
                }
                $set[] = "$k = ?"; $val[] = ($v !== null ? (int)$v : null); continue;
            }

            if ($k === 'ingreso') {
                if ($v === null) { http_response_code(422); echo json_encode(['exito'=>false,'mensaje'=>'La fecha de ingreso no puede quedar vacía.']); exit; }
                $ing = normalizarFecha((string)$v);
                if ($ing === null) { http_response_code(422); echo json_encode(['exito'=>false,'mensaje'=>'Formato de fecha de ingreso inválido.']); exit; }
                $set[] = "ingreso = ?"; $val[] = $ing; continue;
            }

            if ($k === 'observaciones') {
                $set[] = "observaciones = ?"; $val[] = ($v === null ? null : (string)$v); continue;
            }

            $set[] = "$k = ?"; $val[] = $v;
        }

        if (empty($set)) { echo json_encode(['exito' => false, 'mensaje' => 'Sin cambios para actualizar']); exit; }

        if (array_key_exists('num_documento', $data) && $data['num_documento'] !== '') {
            $chk = $pdo->prepare("SELECT 1 FROM alumnos WHERE num_documento = ? AND id_alumno <> ? LIMIT 1");
            $chk->execute([$data['num_documento'], $id]);
            if ($chk->fetchColumn()) {
                echo json_encode(['exito' => false, 'mensaje' => 'Ya existe un socio con ese Documento.']); exit;
            }
        }

        $val[] = $id;
        $sql = "UPDATE alumnos SET " . implode(', ', $set) . " WHERE id_alumno = ?";
        $st = $pdo->prepare($sql);
        $st->execute($val);

        echo json_encode(['exito' => true, 'mensaje' => 'Socio actualizado correctamente']);
        exit;
    }

    echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => 'Error: ' . $e->getMessage()]);
}
