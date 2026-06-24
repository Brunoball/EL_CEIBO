// ✅ REEMPLAZAR COMPLETO
// src/components/Contable/EgresoContable.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import BASE_URL from "../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTrash,
  faEdit,
  faEye,
  faFileExcel,
  faSearch,
  faFilter,
  faChartPie,
  faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";
import ContableEgresoModal from "./modalcontable/ContableEgresoModal";
import Toast from "../Global/Toast";
import "./EgresoContable.css";
import * as XLSX from "xlsx";

/* ======================
   Constantes & helpers
====================== */
const hoy = new Date();
const Y = hoy.getFullYear();

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
};

const cap1 = (s = "") => s.charAt(0) + s.slice(1).toLowerCase();
const sfx = (n) => (n === 1 ? "" : "s");
const ymd = (d) => new Date(d).toISOString().slice(0, 10);

/* ✅ dd/mm/YYYY (visual + export) */
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

// ✅ SIEMPRE 2 DECIMALES
const fmtARS = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));

/* ===== Confirm ===== */
function ConfirmModal({
  open,
  title = "Eliminar egreso",
  message = "¿Seguro que querés eliminar este egreso? Esta acción no se puede deshacer.",
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
      onMouseDown={onCancel}
    >
      <div
        className="logout-modal-container logout-modal--danger"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="logout-modal__icon" aria-hidden="true">
          <FontAwesomeIcon icon={faTrash} />
        </div>
        <h3 className="logout-modal-title logout-modal-title--danger">{title}</h3>
        <p className="logout-modal-text">{message}</p>
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

/* ===== Celda Socio / Proveedor: botón Ver todo si el texto se corta ===== */
function SocioProveedorCell({ valor, onShow }) {
  const textRef = useRef(null);
  const [truncado, setTruncado] = useState(false);
  const texto = String(valor || "").trim() || "-";
  const puedeAbrir = texto !== "-";

  const chequearTruncado = () => {
    const el = textRef.current;
    if (!el) return;
    const desbordaH = el.scrollWidth > el.clientWidth;
    const desbordaV = el.scrollHeight > el.clientHeight;
    setTruncado(desbordaH || desbordaV);
  };

  useEffect(() => {
    chequearTruncado();
  }, [texto]);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return undefined;

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(chequearTruncado)
        : null;

    if (ro) ro.observe(el);

    const t = setTimeout(chequearTruncado, 0);
    window.addEventListener("resize", chequearTruncado);
    window.addEventListener("orientationchange", chequearTruncado);

    return () => {
      if (ro) ro.disconnect();
      clearTimeout(t);
      window.removeEventListener("resize", chequearTruncado);
      window.removeEventListener("orientationchange", chequearTruncado);
    };
  }, []);

  const abrirDetalle = () => {
    if (!puedeAbrir) return;
    onShow?.(texto);
  };

  return (
    <div
      className="eg-ap-cell"
      title={texto}
      onDoubleClick={abrirDetalle}
    >
      <span ref={textRef} className="eg-ap-cell__text">
        {texto}
      </span>

      {truncado && puedeAbrir && (
        <button
          type="button"
          className="eg-btn-ver-ap"
          onClick={abrirDetalle}
          title="Ver socio / proveedor completo"
          aria-label="Ver socio o proveedor completo"
        >
          <FontAwesomeIcon icon={faInfoCircle} />

        </button>
      )}
    </div>
  );
}

/* ===== Modal con la misma estética del motivo en Socios Baja ===== */
function SocioProveedorDetalleModal({ open, contenido, onClose }) {
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
      className="eg-modal-overlay-motivo"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eg-modal-ap-title"
      onMouseDown={onClose}
    >
      <div
        className="eg-modal-contenido-motivo"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="eg-modal-icono-motivo" aria-hidden="true">
          <FontAwesomeIcon icon={faInfoCircle} />
        </div>

        <h3 id="eg-modal-ap-title" className="eg-modal-titulo-motivo">
          Socio / Proveedor
        </h3>

        <div className="eg-modal-texto-motivo">
          {contenido || "No hay socio / proveedor especificado"}
        </div>

        <div className="eg-modal-botones-motivo">
          <button
            type="button"
            className="eg-boton-cerrar-motivo"
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


/* ===== helpers ===== */
const fetchJSON = async (url, options = {}) => {
  const sep = url.includes("?") ? "&" : "?";
  const finalUrl = `${url}${sep}ts=${Date.now()}`;

  const res = await fetch(finalUrl, {
    method: "GET",
    cache: "no-store",
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.exito === false) {
    const msg = data?.mensaje || `Error del servidor (HTTP ${res.status}).`;
    throw new Error(msg);
  }
  return data;
};

const arraysIguales = (a = [], b = []) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const limpiarComprobanteAutomaticoCobrador = (valor = "") => {
  const texto = String(valor || "").trim();
  // Los egresos automáticos generados desde pagos venían como "PAGO #123".
  // No se muestran en el front porque el id del pago no aporta al usuario.
  return /^pago\s*#\s*\d+$/i.test(texto) ? "" : texto;
};

/** Normaliza un row del backend a lo que usa el front */
const normalizeEgreso = (r = {}) => ({
  id_egreso: r.id_egreso,
  fecha: r.fecha || "",
  categoria: r.nombre_categoria || "-",
  descripcion: r.nombre_descripcion || "",
  medio_pago: r.medio_pago || "",
  medio_nombre: r.medio_pago || "",
  socio: r.socio_origen_nombre || r.alumno_origen_nombre || "",
  alumno: r.socio_origen_nombre || r.alumno_origen_nombre || "", // compatibilidad interna
  proveedor: r.socio_origen_nombre || r.alumno_origen_nombre || r.nombre_proveedor || "",
  socio_documento: r.socio_origen_documento || r.alumno_origen_documento || "",
  alumno_documento: r.socio_origen_documento || r.alumno_origen_documento || "", // compatibilidad interna
  id_pago_origen: r.id_pago_origen || null,
  id_socio_origen: r.id_socio_origen || r.id_alumno_origen || null,
  id_alumno_origen: r.id_socio_origen || r.id_alumno_origen || null, // compatibilidad interna
  numero_factura: limpiarComprobanteAutomaticoCobrador(r.comprobante),
  monto: Number.isFinite(parseFloat(r.importe)) ? parseFloat(r.importe) : 0,
  comprobante_url: r.comprobante_url || "",
});

export default function EgresoContable() {
  // Tabla (filtrada)
  const [egresos, setEgresos] = useState([]);
  const [loadingEgr, setLoadingEgr] = useState(false);

  // Sidebar (base para KPIs/categorías)
  const [egresosBase, setEgresosBase] = useState([]);
  const [mediosPago, setMediosPago] = useState([]);

  // Filtros (persistentes)
  const [anio, setAnio] = useState(() => {
    if (typeof window === "undefined") return "ALL";
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.year);
      return saved || "ALL";
    } catch {
      return "ALL";
    }
  });

  const [anios, setAnios] = useState([Y]);

  const [mes, setMes] = useState(() => {
    if (typeof window === "undefined") return "ALL";
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.month);
      return saved || "ALL";
    } catch {
      return "ALL";
    }
  });

  const [fCat, setFCat] = useState("");
  const [fMedio, setFMedio] = useState("");
  const [q, setQ] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDeleteId, setToDeleteId] = useState(null);

  const [modalAlumnoProveedorOpen, setModalAlumnoProveedorOpen] = useState(false);
  const [alumnoProveedorCompleto, setAlumnoProveedorCompleto] = useState("");

  // Toasts
  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(0);

  const addToast = (tipo, mensaje, duracion = 3000) => {
    const id = `${Date.now()}_${toastSeq.current++}`;
    setToasts((prev) => [...prev, { id, tipo, mensaje, duracion }]);
  };
  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // Animación cascada
  const [cascading, setCascading] = useState(false);
  useEffect(() => {
    setCascading(true);
    const t = setTimeout(() => setCascading(false), 500);
    return () => clearTimeout(t);
  }, [anio, mes, fCat, fMedio, q]);

  /* 🔐 Persistir filtros */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.year, anio);
    } catch {}
  }, [anio]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.month, mes);
    } catch {}
  }, [mes]);

  /* -------------
    Rango fechas
  ------------- */
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

  /* -----------------
        Cargas base (una sola vez)
  ------------------*/
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    (async () => {
      // Medios de pago
      try {
        const data = await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`);
        const list = Array.isArray(data?.listas?.medios_pago) ? data.listas.medios_pago : [];
        setMediosPago(
          list.map((m) => ({
            id: Number(m.id),
            nombre: String(m.nombre || m.medio_pago || ""),
          }))
        );
      } catch {
        addToast("error", "No se pudieron cargar los medios de pago.");
        setMediosPago([]);
      }

      // Años disponibles
      try {
        const j1 = await fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&op=list_years`);
        if (Array.isArray(j1?.anios_disponibles) && j1.anios_disponibles.length) {
          const list = [...j1.anios_disponibles].sort((a, b) => b - a).map(String);
          setAnios(list);
        } else {
          const j2 = await fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&op=list&meta=1`);
          if (Array.isArray(j2?.anios_disponibles) && j2.anios_disponibles.length) {
            const list = [...j2.anios_disponibles].sort((a, b) => b - a).map(String);
            setAnios(list);
          }
        }
      } catch {
        /* silencioso */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -----------------
        Carga de datos (tabla + base)
  ------------------*/
  useEffect(() => {
    const ac = new AbortController();
    const signal = ac.signal;

    (async () => {
      try {
        setLoadingEgr(true);

        const pTabla = new URLSearchParams({ op: "list" });
        if (rango.start && rango.end) {
          pTabla.set("start", rango.start);
          pTabla.set("end", rango.end);
        }
        if (fCat) pTabla.set("categoria", fCat);
        if (fMedio) pTabla.set("medio", fMedio);

        const pBase = new URLSearchParams({ op: "list" });
        if (rango.start && rango.end) {
          pBase.set("start", rango.start);
          pBase.set("end", rango.end);
        }

        const [rawTabla, rawBase] = await Promise.all([
          fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&${pTabla.toString()}`, { signal }),
          fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&${pBase.toString()}`, { signal }),
        ]);

        if (signal.aborted) return;

        const datosTabla = (rawTabla?.datos || []).map(normalizeEgreso);
        const datosBase = (rawBase?.datos || []).map(normalizeEgreso);

        setEgresos(datosTabla);
        setEgresosBase(datosBase);

        if (Array.isArray(rawTabla?.anios_disponibles) && rawTabla.anios_disponibles.length) {
          const list = [...rawTabla.anios_disponibles].sort((a, b) => b - a).map(String);
          setAnios((prev) => (arraysIguales(prev, list) ? prev : list));
        }
      } catch (e) {
        if (e?.name === "AbortError") return;
        addToast("error", "Error al cargar los egresos.");
        setEgresos([]);
        setEgresosBase([]);
      } finally {
        if (!signal.aborted) setLoadingEgr(false);
      }
    })();

    return () => ac.abort();
  }, [rango.start, rango.end, fCat, fMedio]);

  /* -----------------
         Derivados
  ------------------*/
  const egresosFiltrados = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return egresos;
    return egresos.filter((e) => {
      const src = [
        e.descripcion,
        e.categoria,
        e.numero_factura,
        e.medio_nombre || e.medio_pago,
        e.proveedor,
        e.alumno,
        e.alumno_documento,
        e.fecha,
      ]
        .join(" ")
        .toLowerCase();
      return src.includes(needle);
    });
  }, [egresos, q]);

  const catBreakdown = useMemo(() => {
    const map = new Map();
    for (const e of egresosBase) {
      const k = e.categoria || "-";
      const monto = Number.isFinite(e.monto) ? e.monto : 0;
      if (!map.has(k)) map.set(k, { label: k, total: 0, count: 0 });
      const obj = map.get(k);
      obj.total = Number((obj.total + monto).toFixed(2));
      obj.count += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [egresosBase]);

  /* -----------------
         Acciones
  ------------------*/
  const onCreateEgreso = () => {
    setEditRow(null);
    setModalOpen(true);
  };
  const onEditEgreso = (row) => {
    setEditRow(row);
    setModalOpen(true);
  };

  const normalizeUrl = (url = "") => {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    const clean = String(url).replace(/^\/+/, "");
    return `${BASE_URL}/${clean}`;
  };

  const onViewComprobante = (row) => {
    const candidate = row?.comprobante_url || row?.comprobante || row?.url || "";
    const finalUrl = normalizeUrl(candidate);
    if (!finalUrl) {
      addToast("advertencia", "Este egreso no tiene comprobante adjunto.");
      return;
    }
    try {
      window.open(finalUrl, "_blank", "noopener,noreferrer");
    } catch {
      window.location.href = finalUrl;
    }
  };

  const mostrarAlumnoProveedorCompleto = (valor) => {
    setAlumnoProveedorCompleto(valor || "No hay socio / proveedor especificado");
    setModalAlumnoProveedorOpen(true);
  };

  const cerrarAlumnoProveedorCompleto = () => {
    setModalAlumnoProveedorOpen(false);
    setAlumnoProveedorCompleto("");
  };

  const askDeleteEgreso = (id) => {
    setToDeleteId(id);
    setConfirmOpen(true);
  };
  const cancelDelete = () => {
    setConfirmOpen(false);
    setToDeleteId(null);
  };

  const confirmDelete = async () => {
    if (!toDeleteId) return;
    try {
      await fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&op=delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_egreso: toDeleteId }),
      });
      addToast("exito", "Egreso eliminado correctamente.");
    } catch {
      addToast("error", "No se pudo eliminar el egreso.");
    } finally {
      setConfirmOpen(false);
      setToDeleteId(null);

      // refrescar tabla
      try {
        const pTabla = new URLSearchParams({ op: "list" });
        if (rango.start && rango.end) {
          pTabla.set("start", rango.start);
          pTabla.set("end", rango.end);
        }
        if (fCat) pTabla.set("categoria", fCat);
        if (fMedio) pTabla.set("medio", fMedio);
        const raw = await fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&${pTabla.toString()}`);
        setEgresos((raw?.datos || []).map(normalizeEgreso));
      } catch {
        /* silencioso */
      }
    }
  };

  const onSavedEgreso = () => {
    setModalOpen(false);
    (async () => {
      try {
        const pTabla = new URLSearchParams({ op: "list" });
        if (rango.start && rango.end) {
          pTabla.set("start", rango.start);
          pTabla.set("end", rango.end);
        }
        if (fCat) pTabla.set("categoria", fCat);
        if (fMedio) pTabla.set("medio", fMedio);
        const raw = await fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&${pTabla.toString()}`);
        setEgresos((raw?.datos || []).map(normalizeEgreso));
      } catch {
        /* silencioso */
      }
    })();
  };

  /* ========= Exportar XLSX ========= */
  const exportarXLSX = () => {
    const rows = egresosFiltrados;
    if (!rows.length) {
      addToast("advertencia", "No hay datos para exportar.");
      return;
    }

    const headers = ["Fecha", "Categoría", "N° Factura", "Descripción", "Socio / Proveedor", "Medio", "Monto (ARS)"];
    const data = rows.map((e) => [
      formatFechaDMY(e.fecha || ""),
      e.categoria || "-",
      e.numero_factura || "",
      e.descripcion || "",
      e.proveedor || "",
      e.medio_nombre || e.medio_pago || "",
      Number(Number(e.monto || 0).toFixed(2)),
    ]);

    const aoa = [headers, ...data];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Forzar “Monto” como número
    for (let r = 2; r <= aoa.length; r++) {
      const addr = XLSX.utils.encode_cell({ r: r - 1, c: 6 });
      if (ws[addr]) ws[addr].t = "n";
    }

    ws["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 40 }, { wch: 30 }, { wch: 18 }, { wch: 14 }];

    const sheetName =
      anio === "ALL"
        ? "Todos_los_años"
        : mes === "ALL"
        ? `Año_${anio}`
        : `${cap1(MESES[Number(mes)])}_${anio}`;

    XLSX.utils.book_append_sheet(wb, ws, `Egresos_${sheetName}`);
    const d = new Date();
    const name = `Egresos_${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${d.getFullYear()}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}.xlsx`;
    XLSX.writeFile(wb, name);
    addToast("exito", "Exportado exitosamente.");
  };

  /* ==================
            UI
  ===================*/
  return (
    <div className="eg_layout">
      {/* Toasts */}
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

      <div className="eg_body">
        {/* Sidebar */}
        <aside className="eg_filters cardd">
          <div className="textcenterfiltros">
            <h2 className="eg_filters__title">
              <FontAwesomeIcon icon={faFilter} /> Filtros
            </h2>
            <h3>
              Detalle —{" "}
              {anio === "ALL"
                ? "Todos los años"
                : mes === "ALL"
                ? `${anio}`
                : `${cap1(MESES[Number(mes)])} ${anio}`}
            </h3>
          </div>

          <div className="paddingcenter">
            <div className="eg_row">
              <div className="eg_field eg-fl">
                <select value={anio} onChange={(e) => setAnio(e.target.value)} aria-label="Año">
                  <option value="ALL">TODOS</option>
                  {anios.map((a) => (
                    <option key={a} value={String(a)}>
                      {a}
                    </option>
                  ))}
                </select>
                <label>Año</label>
              </div>

              <div className="eg_field eg-fl">
                <select
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
                <label>Mes</label>
              </div>
            </div>

            <div className="eg_stats">
              <div className="eg_stat">
                <div className="eg_stat__icon">$</div>
                <div>
                  <p className="eg_stat__label">Total</p>
                  <p className="eg_stat__value">
                    {fmtARS(
                      egresosFiltrados.reduce(
                        (acc, e) => Number((acc + Number(e.monto || 0)).toFixed(2)),
                        0
                      )
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="eg_field eg-fl" style={{ marginTop: 8 }}>
              <select value={fMedio} onChange={(e) => setFMedio(e.target.value)} aria-label="Medio de pago">
                <option value="">(todas)</option>
                {mediosPago.map((m) => (
                  <option key={m.id} value={m.nombre}>
                    {m.nombre}
                  </option>
                ))}
              </select>
              <label>Medio de pago</label>
            </div>

            {fMedio && (
              <div className="ing-filterchip" style={{ marginTop: 8 }}>
                <span>
                  Medio: <strong>{fMedio}</strong>
                </span>
                <button
                  className="ing-filterchip__clear"
                  onClick={() => setFMedio("")}
                  title="Quitar medio"
                  type="button"
                >
                  Quitar
                </button>
              </div>
            )}

            <h3 className="eg_cats__header">
              <FontAwesomeIcon icon={faChartPie} /> Categorías
            </h3>

            <div className="eg_cats">
              {catBreakdown.map((c) => {
                const active = fCat && fCat === c.label;
                return (
                  <button
                    key={c.label}
                    className={`eg_catcard ${active ? "active" : ""}`}
                    onClick={() => setFCat(active ? "" : c.label)}
                    title={`${c.count} registro${sfx(c.count)}`}
                    aria-pressed={active}
                    type="button"
                  >
                    <div className="eg_catcard__left">
                      <div className="eg_catcard__title">{(c.label || "").toUpperCase()}</div>
                      <div className="eg_catcard__count">
                        {c.count} registro{sfx(c.count)}
                      </div>
                    </div>
                    <div className="eg_catcard__value">{fmtARS(c.total)}</div>
                  </button>
                );
              })}
              {!catBreakdown.length && <div className="eg_empty_side">Sin datos</div>}
            </div>
          </div>
        </aside>

        {/* ✅ Contenido */}
        <section className="eg_content">
          {/* ✅ Header FUERA de la caja de la tabla (no lo atraviesa el scroll) */}
          <header className="eg_topbar">
            <button className="seg-tabbb" type="button">
              Egresos
            </button>

            <div className="eg_header_actions">
              <div className="eg_search eg_search--redpill">
                <FontAwesomeIcon icon={faSearch} />
                <input
                  placeholder="Buscar..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Buscar egresos"
                />
              </div>

              <button type="button" className="eg_btn eg_btn--redpill" onClick={exportarXLSX}>
                <FontAwesomeIcon icon={faFileExcel} /> Exportar Excel
              </button>

              <button type="button" className="eg_btn eg_btn--whitepill" onClick={onCreateEgreso}>
                <FontAwesomeIcon icon={faPlus} /> Registrar egreso
              </button>
            </div>
          </header>

          {/* ✅ Caja SOLO tabla: acá vive el scroll */}
          <div className="eg_tableCard cardd">
                            <div className="gt_headerd" role="row">
                  <div className="gt_cell h center" role="columnheader">
                    Fecha
                  </div>
                  <div className="gt_cell h center" role="columnheader">
                    Categoría
                  </div>
                  <div className="gt_cell h center" role="columnheader">
                    N° Factura
                  </div>
                  <div className="gt_cell h center" role="columnheader">
                    Descripción
                  </div>
                  <div className="gt_cell h" role="columnheader">
                    Socio / Proveedor
                  </div>
                  <div className="gt_cell h center" role="columnheader">
                    Medio
                  </div>
                  <div className="gt_cell h center" role="columnheader">
                    Monto
                  </div>
                  <div className="gt_cell h center" role="columnheader">
                    Acciones
                  </div>
                </div>
            <div className="ec_table__wrap">
              {loadingEgr && (
                <div
                  className="ec_table_loader"
                  role="status"
                  aria-live="polite"
                  aria-label="Cargando egresos"
                >
                  <div className="ec_spinner" />
                  <span>Cargando…</span>
                </div>
              )}

              {/* 8 columnas */}
              <div
                className="gt_table gt_cols-8"
                role="table"
                aria-label="Listado de egresos"
                aria-busy={loadingEgr ? "true" : "false"}
              >

                {egresosFiltrados.map((e, idx) => {
                  const hasFile = Boolean(e?.comprobante_url || e?.comprobante || e?.url);
                  return (
                    <div
                      className={`gt_rowd ${cascading ? "casc" : ""}`}
                      style={{ "--i": idx }}
                      role="row"
                      key={e.id_egreso}
                    >
                      <div className="gt_cell center" role="cell">
                        {formatFechaDMY(e.fecha)}
                      </div>

                      <div className="gt_cell center" role="cell">
                        <span className="badge">{e.categoria || "-"}</span>
                      </div>

                      <div className="gt_cell center" role="cell">
                        {e.numero_factura || "-"}
                      </div>

                      <div className="gt_cell truncate center" role="cell" title={e.descripcion || "-"}>
                        {e.descripcion || "-"}
                      </div>

                      <div className="gt_cell" role="cell">
                        <SocioProveedorCell
                          valor={e.proveedor || "-"}
                          onShow={mostrarAlumnoProveedorCompleto}
                        />
                      </div>

                      <div className="gt_cell center" role="cell">
                        <span className="badge"> {e.medio_nombre || e.medio_pago || "-"}</span>
                       
                      </div>

                      <div className="gt_cell center" role="cell">
                        {fmtARS(e.monto)}
                      </div>

                      <div className="gt_cell" role="cell">
                        <div className="row_actions">
                          <button
                            className="icon_btn view"
                            title="Ver comprobante"
                            onClick={() => onViewComprobante(e)}
                            disabled={!hasFile}
                            type="button"
                          >
                            <FontAwesomeIcon icon={faEye} />
                          </button>
                          <button
                            className="icon_btn edit"
                            title="Editar"
                            onClick={() => onEditEgreso(e)}
                            type="button"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            className="icon_btn danger"
                            title="Eliminar"
                            onClick={() => askDeleteEgreso(e.id_egreso)}
                            type="button"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!egresosFiltrados.length && (
                  <div className="gt_empty">{loadingEgr ? "Cargando…" : "Sin egresos"}</div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <ContableEgresoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={onSavedEgreso}
        editRow={editRow}
        notify={addToast}
      />

      <SocioProveedorDetalleModal
        open={modalAlumnoProveedorOpen}
        contenido={alumnoProveedorCompleto}
        onClose={cerrarAlumnoProveedorCompleto}
      />

      <ConfirmModal
        open={confirmOpen}
        title="Eliminar egreso"
        message="¿Seguro que querés eliminar este egreso? Esta acción no se puede deshacer."
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}