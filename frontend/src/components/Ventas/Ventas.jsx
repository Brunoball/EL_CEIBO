import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faBoxesStacked,
  faChartLine,
  faEye,
  faTags,
  faClipboardList,
} from "@fortawesome/free-solid-svg-icons";

import BASE_URL from "../../config/config";
import Toast from "../Global/Toast";
import "../Global/roots.css";
import "./Ventas.css";

import CampaniasTab from "./tabs/CampaniasTab";
import ProductosTab from "./tabs/ProductosTab";
import OrdenesTab from "./tabs/OrdenesTab";
import PlanillasTab from "./tabs/PlanillasTab";

import ModalCampania from "./modales/ModalCampania";
import ModalProducto from "./modales/ModalProducto";
import ModalOrden from "./modales/ModalOrden";
import ModalPersonaVenta from "./modales/ModalPersonaVenta";
import ModalConfirmar from "./modales/ModalConfirmar";
import ModalRetiro from "./modales/ModalRetiro";

import {
  asBool,
  emptyCampania,
  emptyOrden,
  emptyProducto,
  money,
  toInputDate,
} from "./ventasConfig";

const API = `${BASE_URL}/api.php`;

function StatCard({ icon, label, value, small }) {

  return (
    <div className="ventas-stat-card">
      <div className="ventas-stat-icon">
        <FontAwesomeIcon icon={icon} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {small ? <span>{small}</span> : null}
      </div>
    </div>
  );
}

export default function Ventas() {
  const navigate = useNavigate();

  const [tab, setTab] = useState("campanias");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [dashboard, setDashboard] = useState(null);
  const [campanias, setCampanias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [productosCampaniaModal, setProductosCampaniaModal] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [mediosPago, setMediosPago] = useState([]);
  const [personasCatalogo, setPersonasCatalogo] = useState({ socios: [], personas: [] });
  const [personasCatalogoLoading, setPersonasCatalogoLoading] = useState(false);
  const [ordenCatalogosLoading, setOrdenCatalogosLoading] = useState(false);

  const [campaniaForm, setCampaniaForm] = useState(emptyCampania);
  const [productoForm, setProductoForm] = useState(emptyProducto);
  const [ordenForm, setOrdenForm] = useState(emptyOrden);
  const [personaVentaForm, setPersonaVentaForm] = useState({ dni: "", nombre_apellido: "", observacion: "" });

  const [modalCampania, setModalCampania] = useState(false);
  const [modalProducto, setModalProducto] = useState(false);
  const [modalOrden, setModalOrden] = useState(false);
  const [modalPersonaVenta, setModalPersonaVenta] = useState(false);
  const [modalRetiro, setModalRetiro] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);

  const [campaniaSeleccionada, setCampaniaSeleccionada] = useState("");
  const [ordenBusqueda, setOrdenBusqueda] = useState("");
  const [filtroRetiro, setFiltroRetiro] = useState("");
  const [retiroLoadingId, setRetiroLoadingId] = useState(null);

  const [toast, setToast] = useState({ mostrar: false, tipo: "", mensaje: "" });

  const showToast = useCallback((tipo, mensaje) => {
    setToast({ mostrar: true, tipo, mensaje });
  }, []);

  const request = useCallback(async (action, options = {}) => {
    const query = options.query ? `&${options.query}` : "";
    const res = await fetch(`${API}?action=${encodeURIComponent(action)}${query}`, {
      method: options.method || "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (!data || data.exito === false) {
      throw new Error(data?.mensaje || "No se pudo completar la operación.");
    }
    return data;
  }, []);

  const cargarDashboard = useCallback(async () => {
    const data = await request("ventas_dashboard");
    setDashboard(data.resumen || null);
  }, [request]);

  const cargarCampanias = useCallback(async () => {
    const data = await request("ventas_campanias");
    const rows = Array.isArray(data.items) ? data.items : [];
    setCampanias(rows);

    // En Ventas registradas el filtro debe quedar en "Todas las ventas" por defecto.
    // Antes se auto-seleccionaba la primera campaña y eso ocultaba ventas manuales
    // guardadas en otra venta/campaña, dando la sensación de que no se habían cargado.
    if (rows.length === 0) {
      setCampaniaSeleccionada("");
      return;
    }

    const seleccionExiste =
      campaniaSeleccionada === "" || rows.some((c) => String(c.id_campania) === String(campaniaSeleccionada));

    if (!seleccionExiste) {
      setCampaniaSeleccionada("");
    }
  }, [campaniaSeleccionada, request]);

  const cargarProductos = useCallback(async () => {
    const data = await request("ventas_productos");
    setProductos(Array.isArray(data.items) ? data.items : []);
  }, [request]);

  const cargarProductosCatalogo = useCallback(async () => {
    const data = await request("ventas_productos");
    return Array.isArray(data.items) ? data.items : [];
  }, [request]);

  const cargarMediosPago = useCallback(async () => {
    const data = await request("ventas_medios_pago");
    const rows = Array.isArray(data.items) ? data.items : [];
    setMediosPago(rows);
    return rows;
  }, [request]);

  const cargarPersonasCatalogo = useCallback(async () => {
    setPersonasCatalogoLoading(true);
    try {
      const data = await request("ventas_personas_catalogo");
      const catalogo = {
        socios: Array.isArray(data.alumnos) ? data.alumnos : (Array.isArray(data.socios) ? data.socios : []),
        personas: Array.isArray(data.personas) ? data.personas : [],
      };
      setPersonasCatalogo(catalogo);
      return catalogo;
    } finally {
      setPersonasCatalogoLoading(false);
    }
  }, [request]);

  const cargarOrdenes = useCallback(async (filtros = null) => {
    const params = new URLSearchParams();
    const idCampaniaFiltro =
      filtros && Object.prototype.hasOwnProperty.call(filtros, "idCampania")
        ? filtros.idCampania
        : campaniaSeleccionada;

    const retiroFiltroActual =
      filtros && Object.prototype.hasOwnProperty.call(filtros, "retiro")
        ? filtros.retiro
        : filtroRetiro;

    if (idCampaniaFiltro) params.set("id_campania", idCampaniaFiltro);
    // En Ventas registradas solo se listan ventas realmente pagadas/aprobadas.
    // Las intenciones de pago pendientes ya no deben mostrarse como ventas.
    params.set("estado", "aprobada");
    if (retiroFiltroActual) params.set("retiro", retiroFiltroActual);
    if (ordenBusqueda.trim()) params.set("q", ordenBusqueda.trim());

    const data = await request("ventas_ordenes", { query: params.toString() });
    setOrdenes(Array.isArray(data.items) ? data.items : []);
  }, [campaniaSeleccionada, ordenBusqueda, filtroRetiro, request]);

  const cargarTodo = useCallback(async () => {
    setLoading(true);
    try {
      const tareas = [cargarDashboard(), cargarCampanias()];
      if (tab === "productos") tareas.push(cargarProductos());
      if (tab === "ordenes") tareas.push(cargarOrdenes(), cargarMediosPago(), cargarPersonasCatalogo());
      await Promise.all(tareas);
    } catch (e) {
      showToast("error", e.message);
    } finally {
      setLoading(false);
    }
  }, [cargarCampanias, cargarDashboard, cargarMediosPago, cargarOrdenes, cargarPersonasCatalogo, cargarProductos, showToast, tab]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  useEffect(() => {
    if (tab === "productos") cargarProductos().catch((e) => showToast("error", e.message));
    if (tab === "ordenes") {
      cargarOrdenes().catch((e) => showToast("error", e.message));
      cargarMediosPago().catch((e) => showToast("error", e.message));
      cargarPersonasCatalogo().catch((e) => showToast("error", e.message));
    }
  }, [tab, campaniaSeleccionada, cargarMediosPago, cargarPersonasCatalogo, cargarProductos, cargarOrdenes, showToast]);

  const campaniaActual = useMemo(
    () => campanias.find((c) => String(c.id_campania) === String(campaniaSeleccionada)),
    [campanias, campaniaSeleccionada]
  );

  const cambiarCampaniaGlobal = (value) => {
    setCampaniaSeleccionada(value);
  };

  const recargarVistaActual = useCallback(async () => {
    const tareas = [cargarDashboard(), cargarCampanias()];

    // La acción puede afectar más de una pestaña: por ejemplo, eliminar un producto
    // impacta en Productos y también en Configuración si una venta lo usaba.
    if (tab === "productos") tareas.push(cargarProductos());
    if (tab === "ordenes") tareas.push(cargarOrdenes(), cargarMediosPago(), cargarPersonasCatalogo());

    await Promise.all(tareas);
  }, [cargarCampanias, cargarDashboard, cargarMediosPago, cargarOrdenes, cargarPersonasCatalogo, cargarProductos, tab]);

  const refrescarDespuesDeGuardar = async () => {
    await recargarVistaActual();
  };

  const abrirNuevaCampania = async () => {
    setProductosCampaniaModal([]);
    setCampaniaForm(emptyCampania);
    setModalCampania(true);

    try {
      const productosCatalogo = await cargarProductosCatalogo();
      setProductosCampaniaModal(productosCatalogo);
    } catch (err) {
      showToast("error", err.message);
    }
  };

  const abrirEditarCampania = async (c) => {
    setProductosCampaniaModal([]);
    setCampaniaForm({
      ...emptyCampania,
      ...c,
      id_campania: c.id_campania || "",
      fecha_inicio: toInputDate(c.fecha_inicio),
      fecha_fin: toInputDate(c.fecha_fin),
      activo: Number(c.activo || 0),
      visible_menu: Number(c.visible_menu || 0),
      tipo_persona: "vendedor",
      pregunta_persona: c.pregunta_persona || emptyCampania.pregunta_persona,
      mensaje_inicio: c.mensaje_inicio || emptyCampania.mensaje_inicio,
      mensaje_aprobado: c.mensaje_aprobado || emptyCampania.mensaje_aprobado,
      id_producto_principal: c.id_producto_principal || "",
      producto_nombre: c.producto_principal_nombre || "",
      producto_descripcion: c.producto_principal_descripcion || "",
      producto_precio: c.producto_principal_precio_anticipada ?? c.producto_principal_precio ?? "",
      producto_precio_anticipada: c.producto_principal_precio_anticipada ?? c.producto_principal_precio ?? "",
      producto_precio_puerta: c.producto_principal_precio_puerta ?? c.producto_principal_precio ?? "",
      producto_stock: c.producto_principal_stock ?? "",
    });
    setModalCampania(true);

    try {
      const productosCatalogo = await cargarProductosCatalogo();
      setProductosCampaniaModal(productosCatalogo);
    } catch (err) {
      showToast("error", err.message);
    }
  };

  const guardarCampania = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...campaniaForm,
        tipo_persona: "vendedor",
        id_producto_principal: campaniaForm.id_producto_principal || "",
      };
      await request("ventas_campania_guardar", { method: "POST", body: payload });
      showToast("exito", "Venta guardada correctamente.");
      setModalCampania(false);
      setCampaniaForm(emptyCampania);
      setProductosCampaniaModal([]);
      await refrescarDespuesDeGuardar();
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const abrirNuevoProducto = () => {
    setProductoForm({ ...emptyProducto });
    setModalProducto(true);
  };

  const abrirEditarProducto = (p) => {
    setProductoForm({
      ...emptyProducto,
      ...p,
      id_producto: p.id_producto || "",
      precio: p.precio_anticipada ?? p.precio ?? "",
      precio_anticipada: p.precio_anticipada ?? p.precio ?? "",
      precio_puerta: p.precio_puerta ?? p.precio_anticipada ?? p.precio ?? "",
      stock: p.stock ?? "",
      activo: Number(p.activo || 0),
    });
    setModalProducto(true);
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...productoForm };
      await request("ventas_producto_guardar", { method: "POST", body: payload });
      showToast("exito", "Producto guardado correctamente.");
      setModalProducto(false);
      setProductoForm({ ...emptyProducto });
      await Promise.all([cargarProductos(), cargarDashboard(), cargarCampanias()]);
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const pedirConfirmacion = useCallback(({ titulo, mensaje, confirmText, accion }) => {
    setConfirmacion({ titulo, mensaje, confirmText, accion });
  }, []);

  const ejecutarConfirmacion = async () => {
    if (!confirmacion?.accion) return;
    setSaving(true);
    try {
      await confirmacion.accion();
      setConfirmacion(null);
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const cambiarEstadoCampania = (c) => {
    const activar = !asBool(c.activo);
    pedirConfirmacion({
      titulo: activar ? "Activar venta" : "Dar de baja venta",
      mensaje: activar
        ? `¿Activar la venta "${c.nombre}"? Si queda activa, las demás ventas se darán de baja automáticamente.`
        : `¿Dar de baja la venta "${c.nombre}"? No se elimina, solo deja de mostrarse en el bot.`,
      confirmText: activar ? "Activar" : "Dar de baja",
      accion: async () => {
        await request("ventas_campania_estado", {
          method: "POST",
          body: { id_campania: c.id_campania, activo: activar ? 1 : 0 },
        });
        showToast("exito", activar ? "Venta activada." : "Venta dada de baja.");
        await recargarVistaActual();
      },
    });
  };

  const eliminarCampania = (c) => {
    pedirConfirmacion({
      titulo: "Eliminar venta",
      mensaje: `¿Eliminar definitivamente la venta "${c.nombre}"? Esta acción no es para dar de baja: borra el registro si no tiene ventas registradas.`,
      confirmText: "Eliminar",
      accion: async () => {
        await request("ventas_campania_eliminar", {
          method: "POST",
          body: { id_campania: c.id_campania },
        });
        showToast("exito", "Venta eliminada.");
        await recargarVistaActual();
      },
    });
  };

  const cambiarEstadoProducto = (p) => {
    const activar = !asBool(p.activo);
    pedirConfirmacion({
      titulo: activar ? "Activar producto" : "Dar de baja producto",
      mensaje: activar
        ? `¿Activar el producto "${p.nombre}"?`
        : `¿Dar de baja el producto "${p.nombre}"? No se elimina, solo deja de estar disponible para nuevas ventas.`,
      confirmText: activar ? "Activar" : "Dar de baja",
      accion: async () => {
        await request("ventas_producto_estado", {
          method: "POST",
          body: { id_producto: p.id_producto, activo: activar ? 1 : 0 },
        });
        showToast("exito", activar ? "Producto activado." : "Producto dado de baja.");
        await recargarVistaActual();
      },
    });
  };

  const eliminarProducto = (p) => {
    pedirConfirmacion({
      titulo: "Eliminar producto",
      mensaje: `¿Eliminar definitivamente el producto "${p.nombre}"? Si solo querés ocultarlo, usá el botón de dar de baja.`,
      confirmText: "Eliminar",
      accion: async () => {
        await request("ventas_producto_eliminar", {
          method: "POST",
          body: { id_producto: p.id_producto },
        });
        showToast("exito", "Producto eliminado.");
        await recargarVistaActual();
      },
    });
  };

  const obtenerMedioPorDefectoEnLista = useCallback((lista = [], preferido = "EFECTIVO") => {
    const normalizar = (txt) => String(txt || "").trim().toUpperCase();
    const rows = Array.isArray(lista) ? lista : [];
    const encontrado = rows.find((m) => normalizar(m.medio_pago) === preferido);
    return encontrado?.id_medio_pago || rows[0]?.id_medio_pago || "";
  }, []);

  const obtenerMedioPorDefecto = useCallback((preferido = "EFECTIVO") => (
    obtenerMedioPorDefectoEnLista(mediosPago, preferido)
  ), [mediosPago, obtenerMedioPorDefectoEnLista]);

  const hoyInput = () => new Date().toISOString().slice(0, 10);

  const referenciaDesdeDetalleVenta = (detalle = "") => {
    const txt = String(detalle || "").trim();
    if (!txt) return "";
    return txt
      .replace(/^Socio\s*-\s*/i, "")
      .replace(/^Referencia:\s*/i, "")
      .replace(/^Referencia\s*-\s*/i, "")
      .trim();
  };

  const cargarCatalogosOrdenEnSegundoPlano = useCallback((opciones = {}) => {
    const { idOrdenActual = null, completarMedio = null } = opciones;

    setOrdenCatalogosLoading(true);

    Promise.all([
      mediosPago.length ? Promise.resolve(mediosPago) : cargarMediosPago(),
      productos.length ? Promise.resolve(productos) : cargarProductosCatalogo(),
      cargarPersonasCatalogo(),
    ])
      .then(([medios, productosCatalogo]) => {
        if (!productos.length && Array.isArray(productosCatalogo)) {
          setProductos(productosCatalogo);
        }

        if (completarMedio) {
          setOrdenForm((prev) => {
            if (idOrdenActual !== null && String(prev.id_orden || "") !== String(idOrdenActual)) return prev;
            if (prev.id_medio_pago) return prev;

            return {
              ...prev,
              id_medio_pago: obtenerMedioPorDefectoEnLista(medios, completarMedio),
            };
          });
        }
      })
      .catch((err) => {
        showToast("error", err.message);
      })
      .finally(() => {
        setOrdenCatalogosLoading(false);
      });
  }, [cargarMediosPago, cargarPersonasCatalogo, cargarProductosCatalogo, mediosPago, obtenerMedioPorDefectoEnLista, productos, showToast]);

  const abrirNuevaOrden = useCallback(() => {
    const ventaBase =
      campaniaActual ||
      campanias.find((c) => asBool(c.activo)) ||
      campanias[0] ||
      null;

    const itemBase = {
      id_producto: ventaBase?.id_producto_principal || "",
      producto_nombre: ventaBase?.producto_principal_nombre || "",
      columna_codigo: "VEN",
      columna_nombre: ventaBase?.producto_principal_nombre || "Venta",
      cantidad: 1,
      precio_tipo: "anticipada",
      precio_unitario: ventaBase?.producto_principal_precio_anticipada ?? ventaBase?.producto_principal_precio ?? "",
    };

    setOrdenForm({
      ...emptyOrden,
      id_campania: ventaBase?.id_campania || "",
      id_producto: itemBase.id_producto,
      producto_nombre: itemBase.producto_nombre,
      precio_tipo: "anticipada",
      precio_unitario: itemBase.precio_unitario,
      columna_codigo: "VEN",
      columna_nombre: itemBase.columna_nombre,
      items: [itemBase],
      persona_tipo: "vendedor",
      id_medio_pago: obtenerMedioPorDefecto("EFECTIVO"),
      fecha_venta: hoyInput(),
      estado: "aprobada",
    });
    setModalOrden(true);

    cargarCatalogosOrdenEnSegundoPlano({ idOrdenActual: "", completarMedio: "EFECTIVO" });
  }, [campaniaActual, campanias, cargarCatalogosOrdenEnSegundoPlano, obtenerMedioPorDefecto]);

  const abrirEditarOrden = useCallback((o) => {
    const preferenciaMedio = o.origen === "manual" ? "EFECTIVO" : "TRANSFERENCIA";
    const itemsOrden = Array.isArray(o.items) && o.items.length
      ? o.items.map((item, index) => ({
          id_producto: item.id_producto || "",
          producto_nombre: item.producto_nombre || "",
          columna_codigo: item.columna_codigo || (index === 0 ? "VEN" : "ITEM"),
          columna_nombre: item.columna_nombre || item.producto_nombre || "",
          cantidad: item.cantidad || 1,
          precio_tipo: (() => {
            try {
              const metadata = typeof item.metadata_json === "string" && item.metadata_json.trim() !== "" ? JSON.parse(item.metadata_json) : item.metadata;
              return metadata?.precio_tipo === "puerta" ? "puerta" : "anticipada";
            } catch (_) {
              return "anticipada";
            }
          })(),
          precio_unitario: item.precio_unitario ?? "",
        }))
      : [{
          id_producto: o.id_producto || "",
          producto_nombre: o.producto_nombre || "",
          columna_codigo: o.columna_codigo || "VEN",
          columna_nombre: o.columna_nombre || o.producto_nombre || "Venta",
          cantidad: o.cantidad || 1,
          precio_tipo: "anticipada",
          precio_unitario: o.precio_unitario ?? "",
        }];

    setOrdenForm({
      ...emptyOrden,
      ...o,
      id_orden: o.id_orden || "",
      id_campania: o.id_campania || "",
      id_producto: o.id_producto || "",
      producto_nombre: o.producto_nombre || "",
      precio_tipo: "anticipada",
      precio_unitario: o.precio_unitario ?? "",
      cantidad: o.cantidad || 1,
      columna_codigo: o.columna_codigo || "VEN",
      columna_nombre: o.columna_nombre || o.producto_nombre || "Venta",
      items: itemsOrden,
      persona_tipo: "vendedor",
      persona_dni: o.persona_dni || o.dni || "",
      dni: o.persona_dni || o.dni || "",
      persona_nombre: o.persona_nombre || "",
      persona_detalle: o.persona_detalle || "",
      referencia_manual: o.referencia_manual || referenciaDesdeDetalleVenta(o.persona_detalle),
      comprador_telefono: o.comprador_telefono || "",
      estado: o.estado || "aprobada",
      id_medio_pago: o.id_medio_pago || obtenerMedioPorDefecto(preferenciaMedio),
      fecha_venta: String(o.aprobado_en || o.creado_en || hoyInput()).slice(0, 10),
      observacion: o.observacion || "",
    });
    setModalOrden(true);

    cargarCatalogosOrdenEnSegundoPlano({
      idOrdenActual: o.id_orden || "",
      completarMedio: preferenciaMedio,
    });
  }, [cargarCatalogosOrdenEnSegundoPlano, obtenerMedioPorDefecto]);

  const abrirNuevaPersonaVenta = useCallback((prefill = {}) => {
    setPersonaVentaForm({
      dni: String(prefill.dni || "").replace(/\D+/g, ""),
      nombre_apellido: String(prefill.nombre_apellido || "").toUpperCase(),
      observacion: "",
    });
    setModalPersonaVenta(true);
  }, []);

  const guardarPersonaVenta = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await request("ventas_persona_guardar", { method: "POST", body: personaVentaForm });
      const persona = data.persona || {};

      setPersonasCatalogo((prev) => {
        const actuales = Array.isArray(prev.personas) ? prev.personas : [];
        const sinDuplicado = actuales.filter((p) => String(p.id_persona) !== String(persona.id_persona));
        return {
          ...prev,
          personas: [persona, ...sinDuplicado],
        };
      });

      setOrdenForm((prev) => ({
        ...prev,
        id_venta_persona: persona.id_persona || "",
        persona_dni: persona.dni || "",
        dni: persona.dni || "",
        persona_nombre: persona.nombre_apellido || "",
        persona_detalle: persona.observacion || (persona.id_alumno ? "Persona de ventas - socio vinculado" : "Persona de ventas"),
      }));

      setModalPersonaVenta(false);
      setPersonaVentaForm({ dni: "", nombre_apellido: "", observacion: "" });
      showToast("exito", "Persona agregada y seleccionada correctamente.");

      cargarPersonasCatalogo().catch((err) => showToast("error", err.message));
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const guardarOrden = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await request("ventas_orden_guardar", { method: "POST", body: { ...ordenForm, persona_tipo: "vendedor" } });
      showToast("exito", ordenForm.id_orden ? "Venta actualizada correctamente." : "Venta manual agregada correctamente.");
      setModalOrden(false);
      setOrdenForm(emptyOrden);

      // Después de guardar una venta manual, mostramos el listado completo para que no quede
      // oculta por un filtro de campaña anterior.
      setCampaniaSeleccionada("");
      await Promise.all([cargarDashboard(), cargarOrdenes({ idCampania: "" }), cargarPersonasCatalogo()]);
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setSaving(false);
    }
  };


  const abrirModalRetiroOrden = useCallback((orden) => {
    setModalRetiro(orden || null);
  }, []);

  const guardarRetiroOrden = async (nuevoRetirado) => {
    const idOrden = Number(modalRetiro?.id_orden || 0);
    if (!idOrden) return;

    setRetiroLoadingId(idOrden);

    try {
      await request("ventas_orden_retiro", {
        method: "POST",
        body: { id_orden: idOrden, retirado: Number(nuevoRetirado) === 1 ? 1 : 0 },
      });

      showToast("exito", Number(nuevoRetirado) === 1 ? "Marcado como retirado." : "Marcado como pendiente de retiro.");
      setModalRetiro(null);
      await cargarOrdenes();
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setRetiroLoadingId(null);
    }
  };

  const eliminarOrden = useCallback((orden) => {
    const nombre = orden?.persona_nombre || orden?.codigo_orden || "esta venta";
    pedirConfirmacion({
      titulo: "Eliminar venta registrada",
      mensaje: `¿Eliminar definitivamente la venta de "${nombre}"? Se borrará el registro y sus conceptos asociados. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      accion: async () => {
        await request("ventas_orden_eliminar", {
          method: "POST",
          body: { id_orden: orden?.id_orden },
        });
        showToast("exito", "Venta eliminada correctamente.");
        await Promise.all([cargarDashboard(), cargarOrdenes()]);
      },
    });
  }, [cargarDashboard, cargarOrdenes, pedirConfirmacion, request, showToast]);


  const tabsControl = (
    <nav className="ventas-tabs ventas-tabs--in-card" aria-label="Cambiar tabla de ventas">
      <button type="button" className={tab === "campanias" ? "active" : ""} onClick={() => setTab("campanias")}>
        Configuración
      </button>
      <button type="button" className={tab === "productos" ? "active" : ""} onClick={() => setTab("productos")}>
        Productos
      </button>
      <button type="button" className={tab === "ordenes" ? "active" : ""} onClick={() => setTab("ordenes")}>
        Ventas registradas
      </button>
      <button type="button" className={tab === "planillas" ? "active" : ""} onClick={() => setTab("planillas")}>
        <FontAwesomeIcon icon={faClipboardList} /> Planillas
      </button>
    </nav>
  );

  return (
    <div className="ventas-page">
      <div className="ventas-shell">
        <header className="ventas-header ventas-header--section-title">
          <div className="ventas-title-block">
            <span className="ventas-kicker">Cooperadora IPET 50</span>
            <h1>Ventas generales</h1>
          </div>

          <button type="button" className="ventas-back" onClick={() => navigate("/panel")}>
            <FontAwesomeIcon icon={faArrowLeft} /> Volver
          </button>
        </header>

        <section className="ventas-stats">
          <StatCard icon={faTags} label="Venta activa" value={dashboard?.campanias_activas ?? "-"} small="máximo 1 para el bot" />
          <StatCard icon={faEye} label="Visible en bot" value={dashboard?.campanias_visibles_menu ?? "-"} small="activa, vigente y con producto" />
          <StatCard icon={faBoxesStacked} label="Producto activo" value={dashboard?.productos_activos ?? "-"} />
          <StatCard icon={faChartLine} label="Total aprobado" value={money(dashboard?.total_aprobado ?? 0)} small={`${dashboard?.ordenes_aprobadas ?? 0} ventas`} />
        </section>


        {tab === "campanias" ? (
          <CampaniasTab
            tableTabs={tabsControl}
            campanias={campanias}
            onAdd={abrirNuevaCampania}
            onEdit={abrirEditarCampania}
            onDelete={eliminarCampania}
            onToggleActivo={cambiarEstadoCampania}
            loading={loading}
          />
        ) : null}

        {tab === "productos" ? (
          <ProductosTab
            tableTabs={tabsControl}
            productos={productos}
            onAdd={abrirNuevoProducto}
            onEdit={abrirEditarProducto}
            onDelete={eliminarProducto}
            onToggleActivo={cambiarEstadoProducto}
            loading={loading}
          />
        ) : null}

        {tab === "ordenes" ? (
          <OrdenesTab
            tableTabs={tabsControl}
            ordenes={ordenes}
            busqueda={ordenBusqueda}
            setBusqueda={setOrdenBusqueda}
            onBuscar={() => cargarOrdenes()}
            onAdd={abrirNuevaOrden}
            onEdit={abrirEditarOrden}
            onOpenRetiro={abrirModalRetiroOrden}
            onDelete={eliminarOrden}
            loading={loading}
            campanias={campanias}
            campaniaSeleccionada={campaniaSeleccionada}
            onCambiarCampania={cambiarCampaniaGlobal}
            filtroRetiro={filtroRetiro}
            onCambiarFiltroRetiro={setFiltroRetiro}
            campaniaActual={campaniaActual}
          />
        ) : null}

        {tab === "planillas" ? (
          <PlanillasTab
            tableTabs={tabsControl}
            campanias={campanias}
            apiUrl={API}
          />
        ) : null}
      </div>

      <ModalCampania
        abierto={modalCampania}
        form={campaniaForm}
        setForm={setCampaniaForm}
        productos={productosCampaniaModal}
        saving={saving}
        onClose={() => setModalCampania(false)}
        onSubmit={guardarCampania}
      />

      <ModalProducto
        abierto={modalProducto}
        form={productoForm}
        setForm={setProductoForm}
        saving={saving}
        onClose={() => setModalProducto(false)}
        onSubmit={guardarProducto}
      />

      <ModalOrden
        abierto={modalOrden}
        form={ordenForm}
        setForm={setOrdenForm}
        campanias={campanias}
        productos={productos}
        mediosPago={mediosPago}
        sociosCatalogo={personasCatalogo.socios}
        personasCatalogo={personasCatalogo.personas}
        personasCatalogoLoading={personasCatalogoLoading}
        catalogosLoading={ordenCatalogosLoading}
        saving={saving}
        onClose={modalPersonaVenta ? undefined : () => setModalOrden(false)}
        onSubmit={guardarOrden}
        onOpenNuevaPersona={abrirNuevaPersonaVenta}
      />

      <ModalPersonaVenta
        abierto={modalPersonaVenta}
        form={personaVentaForm}
        setForm={setPersonaVentaForm}
        saving={saving}
        onClose={() => setModalPersonaVenta(false)}
        onSubmit={guardarPersonaVenta}
      />

      <ModalRetiro
        abierto={!!modalRetiro}
        orden={modalRetiro}
        saving={retiroLoadingId !== null}
        onClose={() => setModalRetiro(null)}
        onSubmit={guardarRetiroOrden}
      />

      <ModalConfirmar
        abierto={!!confirmacion}
        titulo={confirmacion?.titulo}
        mensaje={confirmacion?.mensaje}
        confirmText={confirmacion?.confirmText}
        saving={saving}
        onClose={() => setConfirmacion(null)}
        onConfirm={ejecutarConfirmacion}
      />

      {toast.mostrar ? (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          duracion={3000}
          onClose={() => setToast({ mostrar: false, tipo: "", mensaje: "" })}
        />
      ) : null}
    </div>
  );
}
