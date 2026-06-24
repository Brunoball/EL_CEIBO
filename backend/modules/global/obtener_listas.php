<?php
// backend/modules/listas/obtener_listas.php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    $listas = [
        'anios'                    => [],
        'categorias'               => [],   // única categoría del club: viene de categoria_monto
        'categorias_monto'         => [],   // alias de compatibilidad
        'divisiones'               => [],
        'meses'                    => [],
        'sexos'                    => [],
        'tipos_documentos'         => [],
        'medios_pago'              => [],

        // NUEVAS LISTAS CONTABLES
        'contable_categorias'      => [],
        'contable_descripciones'   => [],
        'contable_proveedores'     => [],

        // Alias de compatibilidad con código previo
        'egreso_categorias'        => [],
        'egreso_descripciones'     => [],
        'proveedores'              => [],
        'egreso_proveedores'       => [],
    ];

    /* ----------- AÑOS ----------- */
    $sql = "SELECT `id_año` AS id, `nombre_año` AS nombre
            FROM `anio`
            ORDER BY `nombre_año`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['anios'][] = [
            'id'     => (int) $row['id'],
            'nombre' => (string) $row['nombre'],
        ];
    }

    /* -------- CATEGORÍAS (desde categoria_monto) -------- */
    $sql = "SELECT 
                `id_cat_monto` AS id, 
                `nombre_categoria` AS nombre,
                `monto_mensual`,
                `monto_anual`,
                DATE_FORMAT(`fecha_creacion`, '%Y-%m-%d') AS fecha_creacion
            FROM `categoria_monto`
            ORDER BY `nombre_categoria`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $cat = [
            'id'              => (int) $row['id'],
            'id_cat_monto'    => (int) $row['id'],
            'nombre'          => (string) $row['nombre'],
            'nombre_categoria'=> (string) $row['nombre'],
            'monto_mensual'   => (int) $row['monto_mensual'],
            'monto_anual'     => (int) $row['monto_anual'],
            'fecha_creacion'  => (string) $row['fecha_creacion'],
        ];
        $listas['categorias'][] = $cat;
        $listas['categorias_monto'][] = $cat;
    }

    /* --------- DIVISIONES -------- */
    $sql = "SELECT `id_division` AS id, `nombre_division` AS nombre
            FROM `division`
            ORDER BY `nombre_division`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['divisiones'][] = [
            'id'     => (int) $row['id'],
            'nombre' => (string) $row['nombre'],
        ];
    }

    /* ----------- MESES ----------- */
    $sql = "SELECT `id_mes` AS id, `nombre`
            FROM `meses`
            ORDER BY `id_mes`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['meses'][] = [
            'id'     => (int) $row['id'],
            'nombre' => (string) $row['nombre'],
        ];
    }

    /* ------------ SEXO ------------ */
    $sql = "SELECT `id_sexo` AS id, `sexo`
            FROM `sexo`
            ORDER BY `sexo`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['sexos'][] = [
            'id'   => (int) $row['id'],
            'sexo' => (string) $row['sexo'],
        ];
    }

    /* ----- TIPOS DE DOCUMENTOS ----- */
    $sql = "SELECT `id_tipo_documento` AS id, `descripcion`, `sigla`
            FROM `tipos_documentos`
            ORDER BY `descripcion`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['tipos_documentos'][] = [
            'id'          => (int) $row['id'],
            'descripcion' => (string) $row['descripcion'],
            'sigla'       => (string) $row['sigla'],
        ];
    }

    /* ----- MEDIOS DE PAGO ----- */
    $sql = "SELECT `id_medio_pago` AS id, `medio_pago` AS nombre
            FROM `medio_pago`
            ORDER BY `medio_pago`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['medios_pago'][] = [
            'id'     => (int) $row['id'],
            'nombre' => (string) $row['nombre'],
        ];
    }

    /* ===== LISTAS CONTABLES (nuevos nombres de tablas/columnas) ===== */

    // Categorías contables
    $sql = "SELECT id_cont_categoria AS id, nombre_categoria AS nombre
            FROM contable_categoria
            ORDER BY nombre_categoria";
    $contCategorias = [];
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $contCategorias[] = [
            'id'     => (int)$row['id'],
            'nombre' => (string)$row['nombre'],
        ];
    }
    $listas['contable_categorias'] = $contCategorias;
    $listas['egreso_categorias']   = $contCategorias; // alias compat.

    // Descripciones contables
    $sql = "SELECT id_cont_descripcion AS id, nombre_descripcion AS nombre
            FROM contable_descripcion
            ORDER BY nombre_descripcion";
    $contDescripciones = [];
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $contDescripciones[] = [
            'id'     => (int)$row['id'],
            'nombre' => (string)$row['nombre'],
        ];
    }
    $listas['contable_descripciones'] = $contDescripciones;
    $listas['egreso_descripciones']   = $contDescripciones; // alias compat.

    // Proveedores contables
    $sql = "SELECT id_cont_proveedor AS id, nombre_proveedor AS nombre
            FROM contable_proveedor
            ORDER BY nombre_proveedor";
    $contProveedores = [];
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $contProveedores[] = [
            'id'     => (int)$row['id'],
            'nombre' => (string)$row['nombre'],
        ];
    }
    $listas['contable_proveedores'] = $contProveedores;
    $listas['proveedores']          = $contProveedores; // alias compat.
    $listas['egreso_proveedores']   = $contProveedores; // alias compat.

    echo json_encode([
        'exito'  => true,
        'listas' => $listas,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
