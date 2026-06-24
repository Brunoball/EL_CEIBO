export const emptyCampania = {
  id_campania: "",
  nombre: "",
  activo: 1,
  visible_menu: 1,
  tipo_persona: "vendedor",
  pregunta_persona: "Ingresá el DNI de la persona o socio que va a realizar la compra/pago.",
  mensaje_inicio: "Indicá la cantidad que querés comprar.",
  mensaje_aprobado: "Pago aprobado. Te enviamos el comprobante en PDF.",
  fecha_inicio: "",
  fecha_fin: "",
  id_producto_principal: "",
  producto_nombre: "",
  producto_descripcion: "",
  producto_precio: "",
  producto_precio_anticipada: "",
  producto_precio_puerta: "",
  producto_stock: "",
};

export const emptyProducto = {
  id_producto: "",
  nombre: "",
  descripcion: "",
  precio: "",
  precio_anticipada: "",
  precio_puerta: "",
  stock: "",
  activo: 1,
};

export const tiposPersona = [
  {
    value: "vendedor",
    label: "Pedir DNI de la persona/socio",
    shortLabel: "DNI persona/socio",
    menuLabel: "DNI persona/socio",
    pregunta: "Ingresá el DNI de la persona o socio que va a realizar la compra/pago.",
    mensajeInicio: "Indicá la cantidad que querés comprar.",
    ejemplo: "Todas las ventas: entradas, rifas, talitas, bonos o venta general.",
    resumen: "El bot siempre pide DNI, busca en socios y personas de ventas, confirma el nombre y luego pide cantidad.",
  },
];

export const estadosOrden = [
  { value: "", label: "Todos" },
  { value: "pendiente", label: "Pendientes" },
  { value: "aprobada", label: "Aprobadas" },
  { value: "fallida", label: "Fallidas" },
  { value: "cancelada", label: "Canceladas" },
  { value: "vencida", label: "Vencidas" },
];

export const money = (value) => {
  const n = Number(value || 0);
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
};

export const tiposPrecioProducto = [
  { value: "anticipada", label: "Anticipada" },
  { value: "puerta", label: "En puerta" },
];

const normalizarNumero = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const precioProductoAnticipada = (producto) => {
  if (!producto) return 0;
  return normalizarNumero(producto.precio_anticipada ?? producto.precio ?? 0);
};

export const precioProductoPuerta = (producto) => {
  if (!producto) return 0;
  return normalizarNumero(producto.precio_puerta ?? producto.precio_anticipada ?? producto.precio ?? 0);
};

export const normalizarTipoPrecio = (tipo) => (tipo === "puerta" ? "puerta" : "anticipada");

export const precioProductoPorTipo = (producto, tipo = "anticipada") => (
  normalizarTipoPrecio(tipo) === "puerta" ? precioProductoPuerta(producto) : precioProductoAnticipada(producto)
);

export const precioTipoLabel = (tipo) => (normalizarTipoPrecio(tipo) === "puerta" ? "En puerta" : "Anticipada");


export const asBool = (v) => Number(v) === 1 || v === true || v === "1";

export const toInputDate = (v) => {
  if (!v) return "";
  return String(v).slice(0, 10);
};

export const personaConfig = (value) => {
  return tiposPersona.find((t) => t.value === value) || tiposPersona[0];
};

export const personaLabel = (value) => {
  return personaConfig(value).shortLabel;
};

export const personaMenuLabel = (value) => {
  return personaConfig(value).menuLabel;
};

export const defaultPreguntaPersona = (tipo) => personaConfig(tipo).pregunta;

export const defaultMensajeInicio = (tipo) => personaConfig(tipo).mensajeInicio;


export const emptyOrden = {
  id_orden: "",
  id_campania: "",
  id_producto: "",
  producto_nombre: "",
  precio_unitario: "",
  precio_tipo: "anticipada",
  cantidad: 1,
  columna_codigo: "VEN",
  columna_nombre: "Venta",
  items: [],
  persona_tipo: "vendedor",
  persona_dni: "",
  dni: "",
  persona_nombre: "",
  persona_detalle: "",
  referencia_manual: "",
  comprador_telefono: "",
  estado: "aprobada",
  id_medio_pago: "",
  fecha_venta: "",
  observacion: "",
};

export const origenLabel = (value) => {
  if (value === "manual") return "Manual";
  if (value === "importado") return "Importado";
  return "Bot WhatsApp";
};
