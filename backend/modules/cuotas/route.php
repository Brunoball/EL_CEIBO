<?php
declare(strict_types=1);

// backend/modules/cuotas/route.php

function route_cuotas(string $action): bool
{
    switch ($action) {
        case 'cuotas':
            require __DIR__ . '/cuotas.php';
            return true;

        case 'meses_pagados':
            require __DIR__ . '/meses_pagados.php';
            return true;

        case 'registrar_pago':
            require __DIR__ . '/registrar_pago.php';
            return true;

        case 'eliminar_pago':
            require __DIR__ . '/eliminar_pago.php';
            return true;

        case 'obtener_socio_comprobante':
        case 'socio_comprobante':
            require __DIR__ . '/obtener_socio_comprobante.php';
            return true;

        case 'obtener_monto_categoria':
            require __DIR__ . '/obtener_monto_categoria.php';
            return true;
        case 'obtener_info_familia':
            require __DIR__ . '/obtener_info_familia.php';
            return true;

        case 'buscar_pago_eliminar':
            require __DIR__ . '/buscar_pago_eliminar.php';
            return true;
    }

    return false;
}