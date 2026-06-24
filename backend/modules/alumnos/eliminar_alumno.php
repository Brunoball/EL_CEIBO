<?php
// modules/alumnos/eliminar_alumno.php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
        exit;
    }

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?: [];
    $id = isset($data['id_alumno']) ? (int)$data['id_alumno'] : 0;

    if ($id <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado o inválido']);
        exit;
    }

    $pdo->beginTransaction();

    $stExiste = $pdo->prepare('SELECT id_alumno FROM alumnos WHERE id_alumno = ? LIMIT 1');
    $stExiste->execute([$id]);
    if (!$stExiste->fetch(PDO::FETCH_ASSOC)) {
        $pdo->rollBack();
        echo json_encode(['exito' => false, 'mensaje' => 'El socio no existe o ya fue eliminado']);
        exit;
    }

    // Primero se eliminan los pagos asociados para evitar el error de clave foránea:
    // fk_pagos_alumno -> pagos.id_alumno referencia alumnos.id_alumno.
    $stPagos = $pdo->prepare('DELETE FROM pagos WHERE id_alumno = ?');
    $stPagos->execute([$id]);
    $pagosEliminados = $stPagos->rowCount();

    $st = $pdo->prepare('DELETE FROM alumnos WHERE id_alumno = ?');
    $st->execute([$id]);
    $alumnosEliminados = $st->rowCount();

    if ($alumnosEliminados <= 0) {
        $pdo->rollBack();
        echo json_encode(['exito' => false, 'mensaje' => 'No se pudo eliminar el socio']);
        exit;
    }

    $pdo->commit();

    echo json_encode([
        'exito' => true,
        'mensaje' => $pagosEliminados > 0
            ? "Socio eliminado correctamente. También se eliminaron {$pagosEliminados} pago(s) asociado(s)."
            : 'Socio eliminado correctamente',
        'pagos_eliminados' => $pagosEliminados,
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error: ' . $e->getMessage(),
    ]);
}
