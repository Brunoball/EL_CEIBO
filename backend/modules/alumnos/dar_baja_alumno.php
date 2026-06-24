<?php
// backend/modules/alumnos/dar_baja_alumno.php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/db.php'; // Debe exponer $pdo (PDO)

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    // Cuerpo JSON
    $raw     = file_get_contents('php://input');
    $payload = json_decode($raw, true) ?: [];

    $id_alumno = isset($payload['id_alumno']) ? (int)$payload['id_alumno'] : 0;
    $motivo    = isset($payload['motivo']) ? trim((string)$payload['motivo']) : '';

    if ($id_alumno <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID de socio inválido']);
        exit;
    }
    if ($motivo === '') {
        echo json_encode(['exito' => false, 'mensaje' => 'El motivo es obligatorio']);
        exit;
    }

    // Normalizo motivo en MAYÚSCULAS respetando tildes/ñ.
    $motivo = mb_strtoupper($motivo, 'UTF-8');

    // Fecha de baja (guardada en columna `ingreso` según tu modelo actual)
    $tz = new DateTimeZone('America/Argentina/Cordoba');
    $fecha = (new DateTime('now', $tz))->format('Y-m-d');

    // Actualiza: activo=0, motivo=<texto>, ingreso=<fecha de baja>
    $sql = "UPDATE `alumnos`
            SET `activo` = 0,
                `motivo` = :motivo,
                `ingreso` = :fecha
            WHERE `id_alumno` = :id";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':motivo' => $motivo,
        ':fecha'  => $fecha,
        ':id'     => $id_alumno,
    ]);

    if ($stmt->rowCount() === 0) {
        // No encontró el alumno o ya estaba en ese estado
        echo json_encode([
            'exito'   => false,
            'mensaje' => 'No se actualizó ningún registro. Verificá el ID.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode([
        'exito'   => true,
        'mensaje' => 'Alumno dado de baja correctamente',
        'fecha'   => $fecha, // para que el front actualice sin re-consultar
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al dar de baja: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
