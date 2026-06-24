<?php
// backend/modules/alumnos/alumnos_baja.php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/db.php'; // Debe definir $pdo (PDO)

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    // Filtros opcionales (?q=texto | ?id=123)
    $q  = isset($_GET['q'])  ? trim((string)$_GET['q']) : '';
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    /**
     * Esquema actual de alumnos (columnas usadas):
     *  - id_alumno (PK)
     *  - apellido  (NOT NULL)
     *  - nombre    (NULL)
     *  - activo    (0 = dado de baja)
     *  - ingreso   (DATE)  -> usamos esta fecha como "Fecha de Baja"
     *  - motivo    (TEXT)  -> motivo de baja
     */
    $sql = "
        SELECT
            a.id_alumno,
            a.apellido,
            a.nombre,
            a.ingreso,
            a.motivo
        FROM alumnos a
        /**WHERE**/
        ORDER BY a.id_alumno ASC
    ";

    $where  = ["a.activo = 0"];  // Solo los dados de baja
    $params = [];

    if ($id > 0) {
        $where[]       = "a.id_alumno = :id";
        $params[':id'] = $id;
    } elseif ($q !== '') {
        // Búsqueda por combinación de apellido y nombre
        $where[]       = "CONCAT_WS(' ', a.apellido, a.nombre) LIKE :q";
        $params[':q']  = "%{$q}%";
    }

    // Armar WHERE final
    if (!empty($where)) {
        $sql = str_replace('/**WHERE**/', 'WHERE ' . implode(' AND ', $where), $sql);
    } else {
        $sql = str_replace('/**WHERE**/', '', $sql);
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $alumnos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'exito'   => true,
        'alumnos' => $alumnos
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al obtener socios dados de baja: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
