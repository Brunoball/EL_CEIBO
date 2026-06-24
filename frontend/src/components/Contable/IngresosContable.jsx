// ✅ REEMPLAZAR COMPLETO
// src/components/Contable/IngresosContable.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faFilter,
  faChartPie,
  faBars,
  faPlus,
  faFileExcel,
  faTrash,
  faEdit,
  faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";
import BASE_URL from "../../config/config";
import Toast from "../Global/Toast";
import "./IngresosContable.css";
import { IngresoCrearModal, IngresoEditarModal } from "./modalcontable/IngresoModal";

/* === Utilidades === */
const hoy = new Date();
const Y = hoy.getFullYear();
const MES_ACTUAL_INDEX = hoy.getMonth(); // 0 = ENERO, 11 = DICIEMBRE
const DEFAULT_YEAR = String(Y);
const DEFAULT_MONTH = String(MES_ACTUAL_INDEX);
const MESES = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

const STORAGE_KEYS = {
  year: "contable_year",
  month: "contable_month",
  especial: "contable_especial",
};

const cap1 = (s = "") => s.charAt(0) + s.slice(1).toLowerCase();
const ymd = (d) => new Date(d).toISOString().slice(0, 10);

/* ✅ dd/mm/YYYY */
const formatFechaDMY = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return "-";

  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const yyyy = m[1];
    const mm = String(Number(m[2])).padStart(2, "0");
    const dd = String(Number(m[3])).padStart(2, "0");
    return `${dd}/${mm}/${yyyy}`;
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  return s;
};

const fmtMonto = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

/* ===== helpers export ===== */
function toCSV(rows, headers) {
  const esc = (v) => {
    const s = String(v ?? "");
    const needs = /[",\n;]/.test(s);
    const withQ = s.replace(/"/g, '""');
    return needs ? `"${withQ}"` : withQ;
  };
  const head = headers.map(esc).join(",");
  const body = rows
    .map((r) => headers.map((h) => esc(r[h])).join(","))
    .join("\n");
  return `\uFEFF${head}\n${body}`;
}

async function exportToExcelLike({ workbookName, sheetName, rows }) {
  const safeDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!rows || !rows.length) return;

  try {
    const maybe = await import("xlsx");
    const XLSX = maybe.default || maybe;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || "Datos");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    safeDownload(blob, `${workbookName}.xlsx`);
    return;
  } catch {
    /* fallback CSV */
  }

  const headers = Object.keys(rows[0] || {});
  const csv = toCSV(rows, headers);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  safeDownload(blob, `${workbookName}.csv`);
}

/* ===========================================================
   ConfirmModal
   =========================================================== */
function ConfirmModal({
  open,
  title = "Eliminar ingreso",
  message = "¿Seguro que querés eliminar este ingreso? Esta acción no se puede deshacer.",
  onCancel,
  onConfirm,
  confirmText = "Eliminar",
  cancelText = "Cancelar",
}) {
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    cancelBtnRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="logout-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ingdel-title"
      aria-describedby="ingdel-desc"
      onMouseDown={onCancel}
    >
      <div
        className="logout-modal-container logout-modal--danger"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="logout-modal__icon" aria-hidden="true">
          <FontAwesomeIcon icon={faTrash} />
        </div>

        <h3 id="ingdel-title" className="logout-modal-title logout-modal-title--danger">
          {title}
        </h3>

        <p id="ingdel-desc" className="logout-modal-text">
          {message}
        </p>

        <div className="logout-modal-buttons">
          <button
            type="button"
            className="logout-btn logout-btn--ghost"
            onClick={onCancel}
            ref={cancelBtnRef}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="logout-btn logout-btn--solid-danger"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================
   Modal para ver contenido completo en columnas de Ingresos
   =========================================================== */
function IngresoDetalleCell({ valor, titulo, onShow }) {
  const texto = String(valor ?? "").trim() || "-";
  const puedeAbrir = texto !== "-";

  const abrirDetalle = () => {
    if (!puedeAbrir) return;
    onShow?.(titulo || "Detalle", texto);
  };

  return (
    <div
      className={`ing-motivo-cell ${!puedeAbrir ? "is-empty" : ""}`}
      title={texto}
      onDoubleClick={abrirDetalle}
    >
      <span className="ing-motivo-cell__text">{texto}</span>

      {puedeAbrir && (
        <button
          type="button"
          className="ing-btn-ver-motivo"
          onClick={abrirDetalle}
          title={`Ver ${String(titulo || "detalle").toLowerCase()} completo`}
          aria-label={`Ver ${String(titulo || "detalle").toLowerCase()} completo`}
        >
          <FontAwesomeIcon icon={faInfoCircle} />
        </button>
      )}
    </div>
  );
}

function IngresoDetalleModal({ open, titulo, contenido, onClose }) {
  const cerrarBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    cerrarBtnRef.current?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="ing-modal-overlay-motivo"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ing-modal-motivo-title"
      onMouseDown={onClose}
    >
      <div
        className="ing-modal-contenido-motivo"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ing-modal-icono-motivo" aria-hidden="true">
          <FontAwesomeIcon icon={faInfoCircle} />
        </div>

        <h3 id="ing-modal-motivo-title" className="ing-modal-titulo-motivo">
          {titulo || "Detalle de ingreso"}
        </h3>

        <div className="ing-modal-texto-motivo">
          {contenido || "No hay información para mostrar."}
        </div>

        <div className="ing-modal-botones-motivo">
          <button
            type="button"
            className="ing-boton-cerrar-motivo"
            onClick={onClose}
            ref={cerrarBtnRef}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========= Componente principal ========= */
export default function IngresosContable() {
  // Al entrar a Contable siempre arranca en el mes y año actual.
  // No se restaura "TODOS" desde localStorage para evitar vistas mezcladas al volver.
  const [anio, setAnio] = useState(DEFAULT_YEAR);

  const [anios, setAnios] = useState([Y]);

  const [mes, setMes] = useState(DEFAULT_MONTH);

  // ✅ filtro especial (id_mes > 12)
  const [mesEspecial, setMesEspecial] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.especial) || "";
    } catch {
      return "";
    }
  });

  // ✅ IMPORTANTÍSIMO: acá dejamos fijo, sin pegar a meses_list (evita 404)
  const [mesesEspeciales, setMesesEspeciales] = useState([]);

  const [query, setQuery] = useState("");

  const [filas, setFilas] = useState([]); // socios
  const [filasIngresos, setFilasIngresos] = useState([]); // ingresos manuales
  const [cargando, setCargando] = useState(false);

  const [sideOpen, setSideOpen] = useState(true);
  const [cascading, setCascading] = useState(false);
  const [innerTab, setInnerTab] = useState("socios"); // "socios" | "manuales"

  const [catFiltro, setCatFiltro] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(0);
  const addToast = (tipo, mensaje, duracion = 3000) => {
    const id = `${Date.now()}_${toastSeq.current++}`;
    setToasts((prev) => [...prev, { id, tipo, mensaje, duracion }]);
  };
  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [detalleIngreso, setDetalleIngreso] = useState(null);

  const abrirDetalleIngreso = useCallback((titulo, contenido) => {
    setDetalleIngreso({ titulo, contenido });
  }, []);

  const cerrarDetalleIngreso = useCallback(() => {
    setDetalleIngreso(null);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.especial, mesEspecial);
    } catch {}
  }, [mesEspecial]);

  /* ====== Rango de fechas ====== */
  const rango = useMemo(() => {
    if (anio === "ALL") return { start: null, end: null, label: "Todos los años" };
    const y = Number(anio);

    if (mes === "ALL") {
      const start = `${y}-01-01`;
      const end = `${y}-12-31`;
      return { start, end, label: `Enero–Diciembre ${y}` };
    }

    const m = Number(mes);
    const first = new Date(Date.UTC(y, m, 1));
    const last = new Date(Date.UTC(y, m + 1, 0));
    return { start: ymd(first), end: ymd(last), label: `${cap1(MESES[m])} ${y}` };
  }, [anio, mes]);

  /* ====== fetch helper ====== */
  const fetchJSON = useCallback(async (url, options = {}) => {
    const sep = url.includes("?") ? "&" : "?";
    const finalUrl = `${url}${sep}ts=${Date.now()}`;
    const res = await fetch(finalUrl, { method: "GET", cache: "no-store", ...options });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.exito === false) {
      const msg = data?.mensaje || `Error del servidor (HTTP ${res.status}).`;
      throw new Error(msg);
    }
    return data;
  }, []);

  const esPagoSocioValido = useCallback((r) => {
    if (!r || typeof r !== "object") return false;

    // Defensa: si el backend viejo mezcla ingresos/ventas dentro del detalle de socios,
    // no los dejamos entrar a la pestaña Socios.
    const tieneCamposIngreso =
      r.id_ingreso != null ||
      r.id_venta_orden != null ||
      r.venta_codigo != null ||
      r.origen_contable === "venta" ||
      r.proveedor != null ||
      r.descripcion != null ||
      r.importe != null;
    if (tieneCamposIngreso) return false;

    const socio = String(r.Socio ?? r.Alumno ?? "").trim();
    const fecha = String(r.fecha_pago ?? "").trim();
    const monto = Number(r.Monto ?? 0);

    return Boolean(socio && fecha && Number.isFinite(monto) && monto > 0);
  }, []);

  /* ✅ Cargar meses especiales (FIJO, sin backend) */
  const loadMesesEspeciales = useCallback(() => {
    // Esto evita el 404 de /api.php?action=meses_list y mantiene Contable estable.
    setMesesEspeciales([
      { id_mes: 13, nombre: "CONTADO ANUAL" },
      { id_mes: 14, nombre: "MATRICULA" },
      { id_mes: 15, nombre: "1ERA MITAD" },
      { id_mes: 16, nombre: "2DA MITAD" },
    ]);
  }, []);

  const loadPagosSocios = useCallback(async () => {
    setCargando(true);
    try {
      let url = `${BASE_URL}/api.php?action=contable_ingresos&detalle=1`;
      if (rango.start && rango.end) {
        url += `&start=${rango.start}&end=${rango.end}`;
      } else if (anio === "ALL") {
        url += `&all=1`;
      } else {
        url += `&year=${anio}`;
      }
      const raw = await fetchJSON(url);

      if (Array.isArray(raw?.anios_disponibles) && raw.anios_disponibles.length) {
        setAnios(raw.anios_disponibles);
      }

      const detalleCompleto = raw?.detalle || {};
      const todosLosDatos = [];
      Object.keys(detalleCompleto).forEach((key) => {
        const grupo = Array.isArray(detalleCompleto[key])
          ? detalleCompleto[key].filter(esPagoSocioValido)
          : [];

        if (anio === "ALL") {
          todosLosDatos.push(...grupo);
        } else if (key.startsWith(`${anio}-`)) {
          if (mes !== "ALL") {
            const mesIdx = Number(mes);
            const mm = String(mesIdx + 1).padStart(2, "0");
            if (key.endsWith(`-${mm}`)) {
              todosLosDatos.push(...grupo);
            }
          } else {
            todosLosDatos.push(...grupo);
          }
        }
      });

      // ✅ Orden: más nuevo arriba (fecha DESC)
      todosLosDatos.sort((a, b) => {
        const ta = new Date(a?.fecha_pago || 0).getTime();
        const tb = new Date(b?.fecha_pago || 0).getTime();
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
      });

      const rows = todosLosDatos.map((r, i) => ({
        id: `${r?.fecha_pago || ""}|${r?.Socio || r?.Alumno || ""}|${r?.Monto || 0}|${i}`,
        fecha: r?.fecha_pago ?? "",
        socio: r?.Socio ?? r?.Alumno ?? "",
        categoria: r?.Categoria ?? "-",
        monto: Number(r?.Monto ?? 0),
        mesPagado: r?.Mes_pagado || MESES[Number(r?.Mes_pagado_id || 0) - 1] || "-",
        mesPagadoId: Number(r?.Mes_pagado_id || r?.id_mes || 0),
        medio: r?.Medio || r?.medio || "—",
        tipo: "socio",
      }));

      setFilas(rows);
    } catch (e) {
      console.error("Error al cargar ingresos socios:", e);
      setFilas([]);
    } finally {
      setCargando(false);
    }
  }, [anio, mes, rango, fetchJSON, esPagoSocioValido]);

  const loadIngresos = useCallback(async () => {
    setCargando(true);
    try {
      let url = `${BASE_URL}/api.php?action=ingresos_list`;
      if (rango.start && rango.end) {
        url += `&start=${rango.start}&end=${rango.end}`;
      } else if (anio === "ALL") {
        url += `&all=1`;
      } else {
        url += `&year=${anio}`;
      }
      const data = await fetchJSON(url);
      if (Array.isArray(data?.anios_disponibles) && data.anios_disponibles.length) {
        setAnios(data.anios_disponibles.map(String));
      }

      // El backend ya devuelve una lista única:
      // ingresos reales de la tabla ingresos + ventas aprobadas faltantes como virtuales.
      // No consultamos ventas_ordenes desde el front para no duplicar ni esconder registros.
      const list = Array.isArray(data?.items) ? data.items : [];

      let filteredList = list;
      if (anio !== "ALL" && mes !== "ALL") {
        filteredList = list.filter((item) => {
          if (!item.fecha) return false;
          const partes = String(item.fecha).slice(0, 10).split("-").map(Number);
          const itemAnio = partes[0];
          const itemMesIndex = Number(partes[1] || 0) - 1;
          return itemAnio === Number(anio) && itemMesIndex === Number(mes);
        });
      }

      // ✅ Orden: más nuevo arriba (fecha DESC)
      filteredList = [...filteredList].sort((a, b) => {
        const ta = new Date(a?.fecha || 0).getTime();
        const tb = new Date(b?.fecha || 0).getTime();
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
      });

      let rows = filteredList.map((r, idx) => {
        const origen = r.origen_contable || (r.id_venta_orden ? "venta" : "manual");
        const idIngreso = r.id_ingreso ? Number(r.id_ingreso) : null;
        const idVentaOrden = r.id_venta_orden ? Number(r.id_venta_orden) : null;
        const categoriaText = origen === "venta" ? "VENTAS" : (r.categoria || r.denominacion || "-");
        const medioText = r.medio || r.medio_pago || "";
        const proveedorText = r.proveedor || r.nombre_proveedor || "";
        const imputacionText = r.imputacion || r.descripcion || r.descripcion_texto || "";

        return {
          id: idIngreso ? `I|${idIngreso}` : `V|${idVentaOrden || r.venta_codigo || idx}`,
          id_ingreso: idIngreso,
          id_medio_pago: Number(r.id_medio_pago || 0),
          fecha: r.fecha,
          categoria: categoriaText,
          imputacion: imputacionText,
          proveedor: proveedorText,
          importe: Number(r.importe || 0),
          medio: medioText,
          denominacion: categoriaText,
          descripcion: imputacionText,
          origenContable: origen,
          idVentaOrden,
          ventaCodigo: r.venta_codigo || "",
          tipo: "ingreso",
        };
      });

      // Si quedó algún ingreso legacy generado por ventas sin id_venta_orden,
      // priorizamos la fila virtual de Ventas y ocultamos ese duplicado manual.
      const clavesVentas = new Set(
        rows
          .filter((r) => r.origenContable === "venta")
          .map((r) => `${String(r.fecha).slice(0, 10)}|${Math.round(Number(r.importe || 0) * 100)}|${String(r.proveedor || "").trim().toUpperCase()}`)
      );
      rows = rows.filter((r) => {
        if (r.origenContable === "venta") return true;
        const pareceVenta =
          String(r.categoria || "").trim().toUpperCase().startsWith("VENTA") ||
          String(r.imputacion || r.descripcion || "").trim().toUpperCase().startsWith("VENTA");
        if (!pareceVenta) return true;
        const clave = `${String(r.fecha).slice(0, 10)}|${Math.round(Number(r.importe || 0) * 100)}|${String(r.proveedor || "").trim().toUpperCase()}`;
        return !clavesVentas.has(clave);
      });

      setFilasIngresos(rows);
    } catch (e) {
      console.error("Error al cargar tabla ingresos:", e);
      setFilasIngresos([]);
    } finally {
      setCargando(false);
    }
  }, [anio, mes, rango, fetchJSON]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadPagosSocios(), loadIngresos()]);
  }, [loadPagosSocios, loadIngresos]);

  useEffect(() => {
    const loadAnios = async () => {
      try {
        const data = await fetchJSON(`${BASE_URL}/api.php?action=contable_ingresos&meta=1`);
        if (Array.isArray(data?.anios_disponibles) && data.anios_disponibles.length) {
          const list = [...data.anios_disponibles]
            .sort((a, b) => b - a)
            .map(String);
          setAnios(list);
        }
      } catch (e) {
        console.error("Error al cargar años:", e);
      }
    };
    loadAnios();
  }, [fetchJSON]);

  // ✅ cargar meses especiales 1 vez (sin backend)
  useEffect(() => {
    loadMesesEspeciales();
  }, [loadMesesEspeciales]);

  useEffect(() => {
    loadAll();
  }, [anio, mes, loadAll]);

  useEffect(() => {
    setCatFiltro("");
  }, [innerTab, anio, mes]);

  useEffect(() => {
    if (innerTab !== "socios") setMesEspecial("");
  }, [innerTab]);

  useEffect(() => {
    setCascading(true);
    const t = setTimeout(() => setCascading(false), 500);
    return () => clearTimeout(t);
  }, [anio, mes, query, innerTab, catFiltro, mesEspecial]);

  const filasFiltradasAlu = useMemo(() => {
    const q = query.trim().toLowerCase();

    const soloSocios = filas.filter((f) => f?.tipo === "socio" && !f?.origenContable && !f?.id_ingreso && !f?.idVentaOrden);

    let base = !q
      ? soloSocios
      : soloSocios.filter((f) =>
          (f.socio || "").toLowerCase().includes(q) ||
          (f.categoria || "").toLowerCase().includes(q) ||
          (f.fecha || "").toLowerCase().includes(q) ||
          (f.mesPagado || "").toLowerCase().includes(q) ||
          (f.medio || "").toLowerCase().includes(q)
        );

    if (catFiltro) base = base.filter((f) => (f.categoria || "-") === catFiltro);

    if (mesEspecial) {
      const idSel = Number(mesEspecial);
      base = base.filter((f) => Number(f.mesPagadoId || 0) === idSel);
    }

    return base;
  }, [filas, query, catFiltro, mesEspecial]);

  const filasFiltradasIng = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = !q
      ? filasIngresos
      : filasIngresos.filter((f) =>
          (f.categoria || "").toLowerCase().includes(q) ||
          (f.imputacion || f.descripcion || "").toLowerCase().includes(q) ||
          (f.proveedor || "").toLowerCase().includes(q) ||
          (f.ventaCodigo || "").toLowerCase().includes(q) ||
          (f.fecha || "").toLowerCase().includes(q) ||
          (String(f.importe) || "").toLowerCase().includes(q) ||
          (f.medio || "").toLowerCase().includes(q)
        );
    return catFiltro ? base.filter((f) => (f.categoria || "-") === catFiltro) : base;
  }, [filasIngresos, query, catFiltro]);

  const resumen = useMemo(() => {
    const base = innerTab === "socios" ? filasFiltradasAlu : filasFiltradasIng;
    const total = base.reduce((acc, f) => acc + Number((f.monto ?? f.importe) || 0), 0);
    return { total, cantidad: base.length };
  }, [filasFiltradasAlu, filasFiltradasIng, innerTab]);

  const categoriasMes = useMemo(() => {
    const base = innerTab === "socios"
      ? filas.filter((f) => f?.tipo === "socio" && !f?.id_ingreso && !f?.idVentaOrden)
      : filasIngresos.filter((f) => f?.tipo === "ingreso");
    const map = new Map();
    base.forEach((f) => {
      const key = (f.categoria || "-").toString();
      const prev = map.get(key) || { nombre: key, cantidad: 0, monto: 0 };
      prev.cantidad += 1;
      prev.monto += Number((f.monto ?? f.importe) || 0);
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.monto - a.monto);
  }, [filas, filasIngresos, innerTab]);

  const sideClass = ["ing-side", sideOpen ? "is-open" : "is-closed"].join(" ");

  const onExport = async () => {
    const isAlu = innerTab === "socios";
    const base = isAlu ? filasFiltradasAlu : filasFiltradasIng;
    if (!base.length) {
      addToast("advertencia", "No hay datos para exportar.");
      return;
    }

    let rows;
    if (isAlu) {
      rows = base.map((r) => ({
        Fecha: formatFechaDMY(r.fecha),
        Socio: r.socio,
        Categoría: r.categoria,
        Monto: r.monto,
        "Mes pagado": r.mesPagado,
        Medio: r.medio,
      }));
    } else {
      rows = base.map((r) => ({
        Fecha: formatFechaDMY(r.fecha),
        "Persona / Proveedor": r.proveedor || "",
        Categoría: r.categoria || "-",
        Imputación: r.imputacion || r.descripcion || "",
        Importe: r.importe,
        Medio: r.medio,
        Origen: r.origenContable === "venta" ? "Venta" : "Ingreso manual",
      }));
    }

    const wbName = `Ingresos_${
      anio === "ALL"
        ? "Todos_los_años"
        : mes === "ALL"
        ? `Año_${anio}`
        : `${cap1(MESES[Number(mes)])}_${anio}`
    }_${isAlu ? "Socios" : "Ingresos"}`;

    await exportToExcelLike({ workbookName: wbName, sheetName: "Datos", rows });
    addToast("exito", "Exportado exitosamente.");
  };

  const onClickCreate = () => setOpenCreate(true);
  const onEdit = (row) => {
    setEditRow(row);
    setOpenEdit(true);
  };

  const askDelete = (row) => {
    if (!row?.id_ingreso) {
      addToast("advertencia", "Esa venta viene del módulo Ventas. No se borra desde ingresos para evitar inconsistencias.");
      return;
    }
    setToDelete(row);
    setConfirmOpen(true);
  };

  const cancelDelete = () => {
    setConfirmOpen(false);
    setToDelete(null);
  };

  const confirmDelete = async () => {
    if (!toDelete?.id_ingreso) return;
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=eliminar_ingresos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_ingreso: Number(toDelete.id_ingreso) }),
      });
      const data = await res.json();
      if (!res.ok || !data?.exito) throw new Error(data?.mensaje || `HTTP ${res.status}`);
      addToast("exito", "Ingreso eliminado correctamente.");
      await loadIngresos();
    } catch (e) {
      addToast("error", `No se pudo eliminar: ${e.message}`);
    } finally {
      cancelDelete();
    }
  };

  return (
    <div className="ing-wrap">
      <div className="toast-stack">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            tipo={t.tipo}
            mensaje={t.mensaje}
            duracion={t.duracion}
            onClose={() => removeToast(t.id)}
          />
        ))}
      </div>

      <div className="ing-layout">
        <aside className={sideClass} aria-label="Barra lateral">
          <div className="ing-side__inner">
            <div className="ing-side__row ing-side__row--top gradient--brand-red">
              <div className="ing-sectiontitle">
                <FontAwesomeIcon icon={faFilter} />
                <span>Filtros</span>
              </div>
              <div className="ing-detail-inline">
                <small className="muted">
                  Detalle —{" "}
                  {anio === "ALL"
                    ? "Todos los años"
                    : mes === "ALL"
                    ? `${anio}`
                    : `${cap1(MESES[Number(mes)])} ${anio}`}
                </small>
              </div>
            </div>

            <div className="ing-fieldrow">
              <div className={`ing-field fl ${anio !== "ALL" ? "has-value" : ""}`}>
                <select id="anio" value={anio} onChange={(e) => setAnio(e.target.value)} aria-label="Año">
                  <option value="ALL">TODOS</option>
                  {anios.map((a) => (
                    <option key={a} value={String(a)}>
                      {a}
                    </option>
                  ))}
                </select>
                <label htmlFor="anio">Año</label>
              </div>

              <div
                className={`ing-field fl ${mes !== "ALL" ? "has-value" : ""} ${
                  anio === "ALL" ? "is-disabled" : ""
                }`}
              >
                <select
                  id="mes"
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  disabled={anio === "ALL"}
                  aria-label="Mes"
                >
                  <option value="ALL">TODOS</option>
                  {MESES.map((m, i) => (
                    <option key={m} value={String(i)}>
                      {m}
                    </option>
                  ))}
                </select>
                <label htmlFor="mes">Mes</label>
              </div>
            </div>

            {innerTab === "socios" && (
              <div className="ing-fieldrow">
                <div className={`ing-field ing-Especial fl ${mesEspecial ? "has-value" : ""}`}>
                  <select
                    id="especial"
                    value={mesEspecial}
                    onChange={(e) => setMesEspecial(e.target.value)}
                    aria-label="Especial"
                  >
                    <option value="">TODOS</option>
                    {mesesEspeciales.map((m) => (
                      <option key={m.id_mes} value={String(m.id_mes)}>
                        {String(m.nombre || "").toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="especial">Especial</label>
                </div>
              </div>
            )}

            <div className="ing-kpi-cards">
              <div className="kpi-card">
                <div className="kpi-card__icon" aria-hidden>
                  $
                </div>
                <div className="kpi-card__text">
                  <div className="kpi-card__label">Total</div>
                  <div className="kpi-card__value num">{fmtMonto(resumen.total)}</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card__icon" aria-hidden>
                  #
                </div>
                <div className="kpi-card__text">
                  <div className="kpi-card__label">Registros</div>
                  <div className="kpi-card__value num">{resumen.cantidad}</div>
                </div>
              </div>
            </div>


            <div className="ing-sectiontitle">
              <FontAwesomeIcon icon={faChartPie} />
              <span>{innerTab === "socios" ? "Categorías (socios)" : "Categorías (ingresos)"}</span>
            </div>

            {categoriasMes.length === 0 ? (
              <div className="ing-empty">Sin datos</div>
            ) : (
              <ul className="ing-catlist" role="list">
                {categoriasMes.map((c, i) => {
                  const active = c.nombre === catFiltro;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        className={`ing-catitem-btn ${active ? "active" : ""}`}
                        onClick={() => setCatFiltro(active ? "" : c.nombre)}
                        title={`${c.cantidad} ${c.cantidad === 1 ? "registro" : "registros"}`}
                        aria-pressed={active}
                      >
                        <div className="ing-catline">
                          <span className="ing-catname">{(c.nombre || "-").toString().toUpperCase()}</span>
                          <span className="ing-catamount num">{fmtMonto(c.monto)}</span>
                        </div>
                        <div className="ing-catmeta">
                          {c.cantidad} {c.cantidad === 1 ? "registro" : "registros"}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <main className="ing-main">
          <section className="ing-stack cards">
            <div className="ing-head ing-stack__head">
              <button className="ghost-btn show-on-mobile" onClick={() => setSideOpen(true)}>
                <FontAwesomeIcon icon={faBars} />
                <span>Filtros</span>
              </button>
            </div>

            <div className="ing-page ing-stack__body">
              <div className="seg-tabs gradient--brand-red" role="tablist" aria-label="Vista de tabla">
                <div className="seg-tabs-left">
                  <button
                    role="tab"
                    aria-selected={innerTab === "socios"}
                    className={`seg-tab ${innerTab === "socios" ? "active" : ""}`}
                    onClick={() => setInnerTab("socios")}
                  >
                    Socios
                  </button>
                  <button
                    role="tab"
                    aria-selected={innerTab === "manuales"}
                    className={`seg-tab ${innerTab === "manuales" ? "active" : ""}`}
                    onClick={() => setInnerTab("manuales")}
                  >
                    Ingresos
                  </button>
                </div>

                <div className="seg-tabs-actions">
                  <div className="seg-search">
                    <FontAwesomeIcon icon={faSearch} />
                    <input
                      type="text"
                      placeholder="Buscar…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="Buscar en la tabla"
                    />
                  </div>

                  <button className="btn sm ghost btn-invert" onClick={onExport} title="Exportar Excel/CSV">
                    <FontAwesomeIcon icon={faFileExcel} />
                    <span>Exportar Excel</span>
                  </button>

                  <button className="btn sm solid btn-invert" onClick={onClickCreate} title="Registrar ingreso">
                    <FontAwesomeIcon icon={faPlus} />
                    <span>Registrar ingreso</span>
                  </button>
                </div>
              </div>

              {innerTab === "socios" ? (
                <div
                  key="tabla-socios"
                  className={`ing-tablewrap ${cargando ? "is-loading" : ""}`}
                  role="table"
                  aria-label="Listado de ingresos (socios)"
                >
                  {cargando && (
                    <div className="ing-tableloader" role="status" aria-live="polite">
                      <div className="ing-spinner" />
                      <span>Cargando…</span>
                    </div>
                  )}

                  <div className="ing-row h" role="row">
                    <div className="c-fecha">Fecha</div>
                    <div className="c-socio">Socio</div>
                    <div className="c-cat c-cat-aling">Categoría</div>
                    <div className="c-monto t-right">Monto</div>
                    <div className="c-medio">Medio</div>
                    <div className="c-mes">Mes pagado</div>
                  </div>

                  {filasFiltradasAlu.map((f, idx) => (
                    <div
                      className={`ing-row data ${cascading ? "casc" : ""}`}
                      role="row"
                      key={f.id}
                      style={{ "--i": idx }}
                    >
                      <div className="c-fecha">{formatFechaDMY(f.fecha)}</div>
                      <div className="c-socio">
                        <div className="ing-socio">
                          <div className="ing-socio__text">
                            <div className="strong name-small">{f.socio}</div>
                          </div>
                        </div>
                      </div>
                      <div className="c-cat c-cat-aling">
                        <span className="pill">{f.categoria}</span>
                      </div>
                      <div className="c-monto t-right">
                        <span className="num strong-amount">{fmtMonto(f.monto)}</span>
                      </div>
                      <div className="c-medio">{f.medio || "—"}</div>
                      <div className="c-mes">{f.mesPagado}</div>
                    </div>
                  ))}

                  {!filasFiltradasAlu.length && !cargando && (
                    <div className="ing-empty big">
                      Sin pagos para{" "}
                      {anio === "ALL"
                        ? "todos los años"
                        : mes === "ALL"
                        ? `año ${anio}`
                        : `${cap1(MESES[Number(mes)])} ${anio}`}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  key="tabla-ingresos"
                  className={`ing-tablewrap is-manuales ${cargando ? "is-loading" : ""}`}
                  role="table"
                  aria-label="Listado de ingresos (tabla ingresos)"
                >
                  {cargando && (
                    <div className="ing-tableloader" role="status" aria-live="polite">
                      <div className="ing-spinner" />
                      <span>Cargando…</span>
                    </div>
                  )}

                  <div className="ing-row h" role="row">
                    <div className="c-fecha">Fecha</div>
                    <div className="c-medio">Medio</div>
                    <div className="c-proveedor">Persona / Proveedor</div>
                    <div className="c-cat c-cat-aling">Categoría</div>
                    <div className="c-imputacion">Imputación</div>
                    <div className="c-importe">Importe</div>
                    <div className="c-actions center">Acciones</div>
                  </div>

                  {filasFiltradasIng.map((f, idx) => (
                    <div
                      className={`ing-row data ${cascading ? "casc" : ""}`}
                      role="row"
                      key={f.id}
                      style={{ "--i": idx }}
                    >
                      <div className="c-fecha">{formatFechaDMY(f.fecha)}</div>
                      <div className="c-medio">{f.medio || "-"}</div>
                      <div className="c-proveedor">
                        <IngresoDetalleCell
                          valor={f.proveedor || "-"}
                          titulo="Persona / Proveedor"
                          onShow={abrirDetalleIngreso}
                        />
                      </div>
                      <div className="c-cat c-cat-aling">
                        <span className="pill">{f.categoria || "-"}</span>
                      </div>
                      <div className="c-imputacion">{f.imputacion || f.descripcion || "-"}</div>
                      <div className="c-importe">
                        <span className="num strong-amount">{fmtMonto(f.importe)}</span>
                      </div>
                      <div className="c-actions center">
                        {f.origenContable !== "venta" && (
                          <button className="act-btn is-edit" title="Editar" onClick={() => onEdit(f)}>
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                        )}
                        {f.id_ingreso && (
                          <button className="act-btn is-del" title="Eliminar" onClick={() => askDelete(f)}>
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {!filasFiltradasIng.length && !cargando && (
                    <div className="ing-empty big">
                      Sin ingresos para{" "}
                      {anio === "ALL"
                        ? "todos los años"
                        : mes === "ALL"
                        ? `año ${anio}`
                        : `${cap1(MESES[Number(mes)])} ${anio}`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      {sideOpen && (
        <button
          className="ing-layout__overlay"
          onClick={() => setSideOpen(false)}
          aria-label="Cerrar panel"
        />
      )}

      <IngresoCrearModal
        open={openCreate}
        defaultDate={new Date().toISOString().slice(0, 10)}
        onClose={() => setOpenCreate(false)}
        onSaved={async () => {
          addToast("exito", "Ingreso creado correctamente.");
          await loadIngresos();
        }}
      />

      <IngresoEditarModal
        open={openEdit}
        editRow={editRow}
        onClose={() => {
          setOpenEdit(false);
          setEditRow(null);
        }}
        onSaved={async () => {
          addToast("exito", "Ingreso actualizado correctamente.");
          await loadIngresos();
        }}
      />

      <IngresoDetalleModal
        open={Boolean(detalleIngreso)}
        titulo={detalleIngreso?.titulo}
        contenido={detalleIngreso?.contenido}
        onClose={cerrarDetalleIngreso}
      />

      <ConfirmModal
        open={confirmOpen}
        title="Eliminar ingreso"
        message="¿Seguro que querés eliminar este ingreso? Esta acción no se puede deshacer."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}