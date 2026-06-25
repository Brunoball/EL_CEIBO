// src/utils/imprimirRecibosExternosRotados.js
// Compatibilidad: los externos rotados usan el mismo diseño global que todos los comprobantes.
import { imprimirRecibos as imprimirRecibosGlobal } from './imprimirRecibos';

export const imprimirRecibosExternos = imprimirRecibosGlobal;
export default imprimirRecibosGlobal;
