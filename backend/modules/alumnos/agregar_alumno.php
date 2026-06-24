<?php
// backend/modules/alumnos/agregar_alumno.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config/db.php';

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");
    $pdo->exec("SET time_zone = '-03:00'");

    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);

    if (!$data || !is_array($data)) {
        echo json_encode(['exito' => false, 'mensaje' => 'Datos no válidos.']);
        exit;
    }

    $toUpper = function ($txt, $max = null) {
        if (!isset($txt) || trim((string)$txt) === '') return null;
        $val = mb_strtoupper(trim((string)$txt), 'UTF-8');
        if ($max !== null && mb_strlen($val, 'UTF-8') > $max) {
            $val = mb_substr($val, 0, $max, 'UTF-8');
        }
        return $val;
    };

    $errors = [];

    // ===== Campos =====
    $apellido          = $toUpper($data['apellido'] ?? '', 100);
    $nombre            = $toUpper($data['nombre']   ?? '', 100);
    $id_tipo_documento = isset($data['id_tipo_documento']) && $data['id_tipo_documento'] !== '' ? (int)$data['id_tipo_documento'] : null;
    $num_documento     = isset($data['num_documento']) ? trim((string)$data['num_documento']) : '';
    $id_sexo           = isset($data['id_sexo']) && $data['id_sexo'] !== '' ? (int)$data['id_sexo'] : null;
    $domicilio         = $toUpper($data['domicilio'] ?? '', 150);
    $localidad         = $toUpper($data['localidad'] ?? '', 100);
    $telefono          = isset($data['telefono']) ? trim((string)$data['telefono']) : '';

    // En el prototipo para club no se usa año/curso ni división.
    // Se dejan en NULL para compatibilidad con la base existente.
    $id_anio           = null;
    $id_division       = null;

    // ÚNICA categoría del club: categoria_monto.id_cat_monto.
    // Acepta id_cat_monto y también id_categoria como alias viejo del frontend.
    $id_cat_monto      = null;
    if (isset($data['id_cat_monto']) && $data['id_cat_monto'] !== '') {
        $id_cat_monto = (int)$data['id_cat_monto'];
    } elseif (isset($data['id_categoria']) && $data['id_categoria'] !== '') {
        $id_cat_monto = (int)$data['id_categoria'];
    }

    $observaciones     = isset($data['observaciones']) ? (string)$data['observaciones'] : null;
    if ($observaciones !== null) {
        $observaciones = trim($observaciones);
        if ($observaciones === '') $observaciones = null;
    }

    // ===== Validaciones =====
    if (!$apellido || !preg_match('/^[A-ZÑÁÉÍÓÚ\s.]+$/u', $apellido)) {
        $errors['apellido'] = 'Apellido es obligatorio. Solo letras, espacios y puntos.';
    }
    if ($nombre && !preg_match('/^[A-ZÑÁÉÍÓÚ\s.]+$/u', $nombre)) {
        $errors['nombre'] = 'Nombre con formato inválido.';
    }
    if ($num_documento === '' || !preg_match('/^[0-9]+$/', $num_documento)) {
        $errors['num_documento'] = 'Documento obligatorio y numérico.';
    } elseif (strlen($num_documento) > 20) {
        $errors['num_documento'] = 'Documento máximo 20 caracteres.';
    }
    if ($domicilio && !preg_match('/^[A-ZÑÁÉÍÓÚ0-9\s.,-]+$/u', $domicilio)) {
        $errors['domicilio'] = 'Domicilio con caracteres inválidos.';
    }
    if ($localidad && !preg_match('/^[A-ZÑÁÉÍÓÚ0-9\s.,-]+$/u', $localidad)) {
        $errors['localidad'] = 'Localidad con caracteres inválidos.';
    }
    if ($telefono && (!preg_match('/^[0-9+\-\s]+$/', $telefono) || strlen($telefono) > 20)) {
        $errors['telefono'] = 'Teléfono inválido (números, espacios y guiones, máx 20).';
    }
    if (!$id_cat_monto || !is_int($id_cat_monto)) {
        $errors['id_cat_monto'] = 'Categoría obligatoria.';
    }
    if ($id_tipo_documento !== null && !is_int($id_tipo_documento)) {
        $errors['id_tipo_documento'] = 'Tipo de documento inválido.';
    }
    if ($id_sexo !== null && !is_int($id_sexo)) {
        $errors['id_sexo'] = 'Sexo inválido.';
    }

    if (!empty($errors)) {
        echo json_encode(['exito' => false, 'errores' => $errors, 'mensaje' => 'Revisá los campos obligatorios.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Verificar que la categoría exista en la única tabla de categorías.
    $stCat = $pdo->prepare('SELECT 1 FROM categoria_monto WHERE id_cat_monto = ? LIMIT 1');
    $stCat->execute([$id_cat_monto]);
    if (!$stCat->fetchColumn()) {
        echo json_encode(['exito' => false, 'mensaje' => 'La categoría seleccionada no existe. Actualizá la página y volvé a intentar.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Normalizar vacíos a null
    $nombre    = ($nombre && trim($nombre) !== '') ? $nombre : null;
    $domicilio = $domicilio ?: null;
    $localidad = $localidad ?: null;
    $telefono  = $telefono  ?: null;

    // ===== INSERT =====
    $sql = "INSERT INTO `alumnos`
            (`apellido`, `nombre`, `id_tipo_documento`, `num_documento`, `id_sexo`,
             `domicilio`, `localidad`, `telefono`, `id_año`, `id_division`,
             `id_cat_monto`, `observaciones`, `ingreso`)
            VALUES
            (:apellido, :nombre, :id_tipo_documento, :num_documento, :id_sexo,
             :domicilio, :localidad, :telefono, :id_anio, :id_division,
             :id_cat_monto, :observaciones, CURDATE())";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':apellido'          => $apellido,
        ':nombre'            => $nombre,
        ':id_tipo_documento' => $id_tipo_documento,
        ':num_documento'     => $num_documento,
        ':id_sexo'           => $id_sexo,
        ':domicilio'         => $domicilio,
        ':localidad'         => $localidad,
        ':telefono'          => $telefono,
        ':id_anio'           => $id_anio,
        ':id_division'       => $id_division,
        ':id_cat_monto'      => $id_cat_monto,
        ':observaciones'     => $observaciones
    ]);

    echo json_encode(['exito' => true, 'mensaje' => '✅ Socio registrado correctamente.'], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    if ($e->getCode() === '23000' && strpos($e->getMessage(), '1062') !== false) {
        echo json_encode([
            'exito' => false,
            'mensaje' => 'El Documento ya existe en el sistema.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => '❌ Error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => '❌ Error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
