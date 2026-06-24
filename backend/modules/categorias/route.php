<?php
declare(strict_types=1);

// backend/modules/categorias/route.php

function route_categorias(string $action): bool
{
    switch ($action) {
        case 'cat_listar':
            require __DIR__ . '/obtener_categorias.php';
            return true;

        case 'cat_crear':
            require __DIR__ . '/agregar_categoria.php';
            return true;

        case 'cat_actualizar':
            require __DIR__ . '/editar_categoria.php';
            return true;

        case 'cat_eliminar':
            require __DIR__ . '/eliminar_categoria.php';
            return true;

        case 'cat_historial':
            require __DIR__ . '/obtener_historial.php';
            return true;


        /* === Descuento familiar GENERAL por porcentaje === */
        case 'descuentos_hermanos_listar':
        case 'cat_descuentos_hermanos_listar':
            require __DIR__ . '/obtener_descuentos_hermanos.php';
            return true;

        case 'descuentos_hermanos_guardar':
        case 'cat_descuentos_hermanos_guardar':
            require __DIR__ . '/guardar_descuentos_hermanos.php';
            return true;

        case 'descuentos_hermanos_eliminar':
        case 'cat_descuentos_hermanos_eliminar':
            require __DIR__ . '/eliminar_descuento_hermano.php';
            return true;

        /* === Hermanos (dinámico) === */
        case 'cat_hermanos_listar':
            require __DIR__ . '/obtener_cat_hermanos.php';
            return true;

        case 'cat_hermanos_eliminar':
            require __DIR__ . '/eliminar_cat_hermano.php';
            return true;

        case 'cat_hermanos_historial':
            require __DIR__ . '/obtener_historial_hermanos.php';
            return true;
    }

    return false;
}