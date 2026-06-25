// src/utils/imprimirRecibosExternos.js
// Compatibilidad: los externos usan el mismo diseño global que todos los comprobantes.
import { imprimirRecibos as imprimirRecibosGlobal } from './imprimirRecibos';

export const imprimirRecibosExternos = imprimirRecibosGlobal;
export default imprimirRecibosGlobal;
