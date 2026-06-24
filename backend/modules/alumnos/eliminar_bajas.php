<?php
// modules/alumnos/eliminar_bajas.php
require_once __DIR__ . '/../../config/db.php'; // Debe exponer $pdo (PDO)
header('Content-Type: application/json; charset=utf-8');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
        exit;
    }

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?: [];

    // Puede venir un único id o un array de ids
    $id  = isset($data['id_alumno']) ? (int)$data['id_alumno'] : 0;
    $ids = isset($data['ids']) && is_array($data['ids']) ? $data['ids'] : [];

    // Normalizo
    if ($id > 0 && empty($ids)) {
        $ids = [$id];
    }
    $ids = array_values(array_unique(array_map('intval', $ids)));
    $ids = array_values(array_filter($ids, fn($v) => $v > 0));

    if (empty($ids)) {
        echo json_encode(['exito' => false, 'mensaje' => 'Debe enviar id_alumno o ids válidos']);
        exit;
    }

    $pdo->beginTransaction();

    // IMPORTANTE: este endpoint SOLO elimina inactivos.
    // Primero resolvemos cuáles IDs realmente están dados de baja para no tocar activos por error.
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stIds = $pdo->prepare("SELECT id_alumno FROM alumnos WHERE activo = 0 AND id_alumno IN ($placeholders)");
    $stIds->execute($ids);
    $idsInactivos = array_map('intval', $stIds->fetchAll(PDO::FETCH_COLUMN));

    if (empty($idsInactivos)) {
        $pdo->rollBack();
        echo json_encode([
            'exito' => false,
            'mensaje' => 'No se eliminaron registros. Verifique que los IDs existan y estén inactivos.'
        ]);
        exit;
    }

    $phInactivos = implode(',', array_fill(0, count($idsInactivos), '?'));

    // Primero se eliminan los pagos asociados para evitar el error de clave foránea:
    // fk_pagos_alumno -> pagos.id_alumno referencia alumnos.id_alumno.
    $stPagos = $pdo->prepare("DELETE FROM pagos WHERE id_alumno IN ($phInactivos)");
    $stPagos->execute($idsInactivos);
    $pagosEliminados = $stPagos->rowCount();

    $stmt = $pdo->prepare("DELETE FROM alumnos WHERE activo = 0 AND id_alumno IN ($phInactivos)");
    $stmt->execute($idsInactivos);
    $eliminados = $stmt->rowCount();

    if ($eliminados <= 0) {
        $pdo->rollBack();
        echo json_encode([
            'exito' => false,
            'mensaje' => 'No se eliminaron registros. Verifique que los IDs existan y estén inactivos.'
        ]);
        exit;
    }

    $pdo->commit();

    $mensaje = "Se eliminaron definitivamente {$eliminados} registro(s) inactivo(s).";
    if ($pagosEliminados > 0) {
        $mensaje .= " También se eliminaron {$pagosEliminados} pago(s) asociado(s).";
    }

    echo json_encode([
        'exito' => true,
        'eliminados' => $eliminados,
        'pagos_eliminados' => $pagosEliminados,
        'mensaje' => $mensaje,
    ]);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error al eliminar definitivamente.',
        'detalle' => $e->getMessage()
    ]);
}
