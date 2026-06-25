<?php
// backend/modules/alumnos/dar_alta_alumno.php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    require_once __DIR__ . '/../../config/db.php'; // Debe definir $pdo (PDO)
    if (!($pdo instanceof PDO)) {
        http_response_code(500);
        echo json_encode(['exito' => false, 'mensaje' => 'Conexión PDO no disponible']);
        exit;
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
        exit;
    }

    // ==== Leer parámetros (x-www-form-urlencoded o JSON) ====
    $id_alumno = 0;
    $fechaIngresada = '';

    if (!empty($_POST)) {
        $id_alumno      = isset($_POST['id_alumno']) ? (int)$_POST['id_alumno'] : 0;
        $fechaIngresada = isset($_POST['fecha_ingreso']) ? trim((string)$_POST['fecha_ingreso']) : '';
    } else {
        $raw  = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (is_array($data)) {
            $id_alumno      = isset($data['id_alumno']) ? (int)$data['id_alumno'] : 0;
            $fechaIngresada = isset($data['fecha_ingreso']) ? trim((string)$data['fecha_ingreso']) : '';
        }
    }

    if ($id_alumno <= 0) {
        http_response_code(422);
        echo json_encode(['exito' => false, 'mensaje' => 'ID de socio inválido']);
        exit;
    }

    // ==== Normalizar fecha a Y-m-d (acepta Y-m-d o d/m/Y). Si no es válida, usamos ahora (Córdoba) ====
    $fechaValida = normalizarFecha($fechaIngresada);

    $tz = new DateTimeZone('America/Argentina/Cordoba');
    $fechaUsar = $fechaValida ?? (new DateTime('now', $tz))->format('Y-m-d');

    // ==== UPDATE: activo=1, motivo=NULL, ingreso=:fecha ====
    $sql = "UPDATE `alumnos`
               SET `activo`  = 1,
                   `motivo`  = NULL,
                   `ingreso` = :fecha
             WHERE `id_alumno` = :id
             LIMIT 1";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':fecha' => $fechaUsar,
        ':id'    => $id_alumno,
    ]);

    // Si no afectó filas, verificar existencia (pudo estar ya en ese estado)
    if ($stmt->rowCount() === 0) {
        $chk = $pdo->prepare("SELECT `id_alumno` FROM `alumnos` WHERE `id_alumno` = :id LIMIT 1");
        $chk->execute([':id' => $id_alumno]);
        if (!$chk->fetch()) {
            http_response_code(404);
            echo json_encode(['exito' => false, 'mensaje' => 'Socio no encontrado']);
            exit;
        }
        // Existe pero sin cambios; lo tomamos como éxito igualmente
    }

    echo json_encode([
        'exito'       => true,
        'mensaje'     => 'Socio dado de alta correctamente',
        'fecha_usada' => $fechaUsar
    ], JSON_UNESCAPED_UNICODE);
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al dar de alta al socio: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Convierte una fecha string a 'Y-m-d' si es válida.
 * Acepta 'Y-m-d' o 'd/m/Y'. Devuelve null si no es válida o cadena vacía.
 */
function normalizarFecha(string $s): ?string {
    $s = trim($s);
    if ($s === '') return null;

    // YYYY-MM-DD
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
        $dt  = DateTime::createFromFormat('Y-m-d', $s);
        $err = DateTime::getLastErrors();
        if ($dt && empty($err['warning_count']) && empty($err['error_count'])) {
            return $dt->format('Y-m-d');
        }
    }

    // DD/MM/YYYY
    if (preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $s)) {
        $dt  = DateTime::createFromFormat('d/m/Y', $s);
        $err = DateTime::getLastErrors();
        if ($dt && empty($err['warning_count']) && empty($err['error_count'])) {
            return $dt->format('Y-m-d');
        }
    }

    return null;
}
