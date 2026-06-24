// ✅ REEMPLAZAR COMPLETO
// src/components/Cuotas/modales/ModalPagos.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { FaCoins, FaCalendarAlt, FaPen, FaCheck, FaTimes, FaInfoCircle, FaSave } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalPagos.css';
import '../../Global/roots.css';

// Normal (no rotado)
import { imprimirRecibos } from '../../../utils/imprimirRecibos.jsx';

// 🔧 ROTADO → alias porque el archivo exporta `imprimirRecibos`
import { imprimirRecibos as imprimirRecibosRotado } from '../../../utils/imprimirRecibosRotado.jsx';

// Externos rotados
import { imprimirRecibosExternos as imprimirRecibosExternosRotados } from '../../../utils/imprimirRecibosExternosRotados.jsx';

// PDF
import { generarComprobanteAlumnoPDF } from '../../../utils/ComprobanteExternoPDF.jsx';

/* ====== Constantes ====== */
const MIN_YEAR = 2025;
const esPeriodoVisiblePagos = (mes) => {
  const id = Number(mes?.id ?? mes?.id_mes ?? 0);
  // Club: cuotas mensuales completas de enero a diciembre.
  // Se conservan los períodos especiales: contado anual, 1era mitad y 2da mitad.
  return (id >= 1 && id <= 12) || [13, 15, 16].includes(id);
};
const ID_CONTADO_ANUAL = 13;
// Mitades de contado anual
const ID_CONTADO_ANUAL_H1 = 15; // Ene–Jun
const ID_CONTADO_ANUAL_H2 = 16; // Jul–Dic

// Constantes para cobrador
const PORCENTAJE_COBRADOR = 15;

/* ====== Helpers ====== */
const normalizar = (s = '') =>
  String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const construirListaAnios = (nowYear) => {
  const start = MIN_YEAR;
  const end = nowYear + 4;
  const arr = [];
  for (let y = start; y <= end; y++) arr.push(y);
  return arr;
};

const capitalizar = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');

// ✅ NEW: hoy -> YYYY-MM-DD para input type="date"
const toYMD = (d = new Date()) => {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ✅ NEW: valida YYYY-MM-DD real
const isValidYMD = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (y < 2000 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};

// Cambiá este flag a true para mostrar siempre el CONTADO ANUAL
const FORZAR_VENTANA_ANUAL = true;

const dentroVentanaAnual = (hoy = new Date()) => {
  if (FORZAR_VENTANA_ANUAL) return true;

  // 15-Dic (y) a 01-Abr (y+1)
  const y = hoy.getFullYear();
  const inicio = new Date(y, 11, 15);
  const fin = new Date(y + 1, 3, 1);
  if (hoy >= inicio && hoy < fin) return true;

  const finEsteAnio = new Date(y, 3, 1);
  const inicioAnterior = new Date(y - 1, 11, 15);
  return hoy >= inicioAnterior && hoy < finEsteAnio;
};

// Redondeo a centenas
const roundToHundreds = (n) => {
  const v = Math.round((Number(n) || 0) / 100) * 100;
  return v < 0 ? 0 : v;
};

const ModalPagos = ({ socio, onClose }) => {
  const now = new Date();
  const nowYear = now.getFullYear();
  const ventanaAnualActiva = dentroVentanaAnual(now);

  const [meses, setMeses] = useState([]);
  const [periodosPagados, setPeriodosPagados] = useState([]);
  const [periodosEstado, setPeriodosEstado] = useState({});
  const [seleccionados, setSeleccionados] = useState([]);
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState(null);
  const [todosSeleccionados, setTodosSeleccionados] = useState(false);

  // ✅ NEW: fecha de pago seleccionable (por defecto hoy)
  const [fechaPagoSeleccionada, setFechaPagoSeleccionada] = useState(toYMD(now));

  // Éxito + modo comprobante
  const [pagoExitoso, setPagoExitoso] = useState(false);
  const [modoComprobante, setModoComprobante] = useState('imprimir'); // 'imprimir' | 'pdf'

  // Condonar + selector de año
  const [condonar, setCondonar] = useState(false);
  const [anioTrabajo, setAnioTrabajo] = useState(Math.max(nowYear, MIN_YEAR));
  const [showYearPicker, setShowYearPicker] = useState(false);
  const yearOptions = useMemo(() => construirListaAnios(nowYear), [nowYear]);

  // ===== Precio por categoría (DINÁMICO según DB descuentos_hermanos + HISTORIAL) =====
  const [precioMensual, setPrecioMensual] = useState(0); // referencial para UI
  const [montoAnual, setMontoAnual] = useState(0);
  const [nombreCategoria, setNombreCategoria] = useState('');

  // ✅ precios mensuales por mes (1..12) según histórico
  const [preciosPorPeriodoDB, setPreciosPorPeriodoDB] = useState({}); // {1:4000, 2:4000, 3:5000...}

  // ✅ Montos por integrante cuando se paga grupo familiar con categorías distintas
  const [montosFamilia, setMontosFamilia] = useState({}); // { [id_alumno]: {monto_mensual, monto_anual, montos_por_periodo, categoria_nombre} }

  // ✅ Aviso persistente cuando falta config en descuentos_hermanos
  const [avisoHermanos, setAvisoHermanos] = useState('');

  // ✅ Porcentaje familiar general aplicado para mostrarlo en el total del grupo
  const [porcentajeDescuentoHermanos, setPorcentajeDescuentoHermanos] = useState(0);

  // ===== Extras =====
  const [anualSeleccionado, setAnualSeleccionado] = useState(false);
    // ===== Anual editable (monto manual solo para esta operación) =====
  const [anualEditando, setAnualEditando] = useState(false);
  const [anualManualActivo, setAnualManualActivo] = useState(false);
  const [montoAnualManual, setMontoAnualManual] = useState('');

  // ===== Modo libre =====
  const [libreActivo, setLibreActivo] = useState(false);
  const [libreValor, setLibreValor] = useState('');

  // ===== Estado para controlar modo activo =====
  const [modoActivo, setModoActivo] = useState('meses'); // 'meses' | 'anual'

  // ===== Info de familia =====
  const [familiaInfo, setFamiliaInfo] = useState({
    tieneFamilia: false,
    id_familia: null,
    nombre_familia: '',
    miembros_total: 0,
    miembros_activos: 0,
    miembros: []
  });
  const [mostrarMiembros, setMostrarMiembros] = useState(false);

  // aplicar a grupo familiar
  const [aplicarFamilia, setAplicarFamilia] = useState(false);

  // mitades de anual
  const [anualH1, setAnualH1] = useState(false); // Ene–Jun
  const [anualH2, setAnualH2] = useState(false); // Jul–Dic

  // ===== medios de pago =====
  const [mediosPago, setMediosPago] = useState([]); // [{id, nombre}]
  const [medioSeleccionado, setMedioSeleccionado] = useState(''); // id como string
  const fechaPagoRef = React.useRef(null);

  const mostrarToast = (tipo, mensaje, duracion = 3000) => setToast({ tipo, mensaje, duracion });

  // ID tolerante
  const idAlumno = socio?.id_alumno ?? socio?.id_socio ?? socio?.id ?? null;

  // ✅ Verificar si el alumno es cobrador (desde DB, más seguro)
  const esAlumnoCobrador = useMemo(() => {
    return Number(socio?.es_cobrador ?? 0) === 1;
  }, [socio]);

  /* ================= Helpers ================= */
  const formatearFecha = (f) => {
    if (!f) return '—';
    const parts = String(f).split('-');
    if (parts.length !== 3) return f;
    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatearARS = (monto) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(monto);

  const formatearPorcentaje = (valor) => {
    const n = Number(valor || 0);
    if (!Number.isFinite(n)) return '0%';
    const maxDecimals = Number.isInteger(n) ? 0 : 2;
    return `${n.toLocaleString('es-AR', { maximumFractionDigits: maxDecimals })}%`;
  };

  const mesesGrid = useMemo(() => meses.filter((m) => Number(m.id) >= 1 && Number(m.id) <= 12), [meses]);

  const esExterno = useMemo(() => {
    const raw = nombreCategoria || socio?.categoria_nombre || socio?.nombre_categoria || socio?.categoria || '';
    return normalizar(raw).includes('extern');
  }, [nombreCategoria, socio]);

  /* ========= Cantidad familia (para aplicar descuentos_hermanos globales) ========= */
  const familyCount = useMemo(() => {
    const mA = Number(familiaInfo.miembros_activos || 0);
    const mT = Number(familiaInfo.miembros_total || 0);
    const base = Math.max(mA, mT, 0);
    return familiaInfo.tieneFamilia ? Math.max(1, base) : 1;
  }, [familiaInfo]);

  // ===== Monto mensual FINAL (referencial UI) =====
  const precioMensualFinal = useMemo(() => {
    if (condonar) return 0;
    if (libreActivo) {
      const v = Number(libreValor);
      return Number.isFinite(v) && v > 0 ? v : 0;
    }
    return Math.max(0, Math.round(Number(precioMensual || 0)));
  }, [condonar, libreActivo, libreValor, precioMensual]);

  // ===== Monto anual FINAL (sin % descuento: lo define la DB) =====
  const montoAnualFinal = useMemo(() => {
    if (condonar) return 0;
    const base = Number(montoAnual || 0);
    return Math.max(0, Math.round(base));
  }, [condonar, montoAnual]);

  // ====== AUX: estados ya registrados para extras ======
  const estadoAnualFull = periodosEstado[ID_CONTADO_ANUAL]; // 13
  const estadoAnualH1 = periodosEstado[ID_CONTADO_ANUAL_H1]; // 15
  const estadoAnualH2 = periodosEstado[ID_CONTADO_ANUAL_H2]; // 16
  const bloqueadoAnual = !!(estadoAnualFull || (estadoAnualH1 && estadoAnualH2));

  // ====== cálculo de anual considerando monto manual, mitades y lo YA pagado ======
  const anualConfig = useMemo(() => {
    if (!anualSeleccionado) return { tipo: null, idPeriodo: null, importe: 0, etiqueta: '' };

    const baseAnual = Math.max(
      0,
      Math.round(anualManualActivo ? Number(montoAnualManual || 0) : Number(montoAnualFinal || 0))
    );

    if (!estadoAnualFull) {
      if (estadoAnualH1 && !estadoAnualH2) {
        return {
          tipo: 'h2',
          idPeriodo: ID_CONTADO_ANUAL_H2,
          importe: Math.max(0, Math.round(baseAnual / 2)),
          etiqueta: 'CONTADO ANUAL (2ª mitad)'
        };
      }
      if (!estadoAnualH1 && estadoAnualH2) {
        return {
          tipo: 'h1',
          idPeriodo: ID_CONTADO_ANUAL_H1,
          importe: Math.max(0, Math.round(baseAnual / 2)),
          etiqueta: 'CONTADO ANUAL (1ª mitad)'
        };
      }
    }

    const halfSelectedCount = (anualH1 ? 1 : 0) + (anualH2 ? 1 : 0);
    if (halfSelectedCount === 0 || halfSelectedCount === 2) {
      return { tipo: 'full', idPeriodo: ID_CONTADO_ANUAL, importe: baseAnual, etiqueta: 'CONTADO ANUAL' };
    }
    if (anualH1)
      return { tipo: 'h1', idPeriodo: ID_CONTADO_ANUAL_H1, importe: Math.max(0, Math.round(baseAnual / 2)), etiqueta: 'CONTADO ANUAL (1ª mitad)' };
    return { tipo: 'h2', idPeriodo: ID_CONTADO_ANUAL_H2, importe: Math.max(0, Math.round(baseAnual / 2)), etiqueta: 'CONTADO ANUAL (2ª mitad)' };
  }, [anualSeleccionado, anualH1, anualH2, anualManualActivo, montoAnualManual, montoAnualFinal, estadoAnualH1, estadoAnualH2, estadoAnualFull]);

  const RANGO_H1 = useMemo(() => new Set([1, 2, 3, 4, 5, 6]), []);
  const RANGO_H2 = useMemo(() => new Set([7, 8, 9, 10, 11, 12]), []);

  const mesesBloqueadosPorAnual = useMemo(() => {
    const blocked = new Set();

    if (estadoAnualFull) {
      for (const m of RANGO_H1) blocked.add(m);
      for (const m of RANGO_H2) blocked.add(m);
      return blocked;
    }

    if (estadoAnualH1) for (const m of RANGO_H1) blocked.add(m);
    if (estadoAnualH2) for (const m of RANGO_H2) blocked.add(m);

    if (anualSeleccionado) {
      if (anualConfig?.tipo === 'full') {
        for (const m of RANGO_H1) blocked.add(m);
        for (const m of RANGO_H2) blocked.add(m);
      } else if (anualConfig?.tipo === 'h1') {
        for (const m of RANGO_H1) blocked.add(m);
      } else if (anualConfig?.tipo === 'h2') {
        for (const m of RANGO_H2) blocked.add(m);
      }
    }

    return blocked;
  }, [estadoAnualFull, estadoAnualH1, estadoAnualH2, anualSeleccionado, anualConfig?.tipo, RANGO_H1, RANGO_H2]);

  const isMesBloqueado = (idMes) => mesesBloqueadosPorAnual.has(Number(idMes));


  const periodosMesesOrdenados = useMemo(() => [...seleccionados].map(Number).sort((a, b) => a - b), [seleccionados]);

  // ✅ Precio por mes real (histórico) para un periodo
  const getPrecioMes = (idMes) => {
    if (condonar) return 0;
    if (libreActivo) {
      const v = Number(libreValor);
      return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
    }
    const v = Number(preciosPorPeriodoDB?.[Number(idMes)]);
    if (Number.isFinite(v) && v > 0) return Math.round(v);
    return Math.round(Number(precioMensualFinal || 0));
  };

  // ✅ Totales (por persona) usando precio real por mes
  const totalMeses = useMemo(() => {
    if (condonar) return 0;
    return periodosMesesOrdenados.reduce((acc, id) => acc + getPrecioMes(id), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condonar, periodosMesesOrdenados, libreActivo, libreValor, preciosPorPeriodoDB, precioMensualFinal]);

  const totalExtras = useMemo(() => {
    const anualImp = anualSeleccionado ? Number(anualConfig.importe || 0) : 0;
    return anualImp;
  }, [anualSeleccionado, anualConfig.importe]);

  const total = totalMeses + totalExtras; // POR persona

  const periodoTextoFinal = useMemo(() => {
    if (anualSeleccionado && anualConfig?.etiqueta) {
      const base = anualConfig.etiqueta;
      const partes = [base];
      if (periodosMesesOrdenados.length > 0) {
        const mapById = new Map(meses.map((m) => [Number(m.id), String(m.nombre).trim()]));
        const nombresMeses = periodosMesesOrdenados.map((id) => mapById.get(Number(id)) || String(id));
        partes.push(...nombresMeses);
      }
      return `${partes.join(' / ')} ${anioTrabajo}`;
    }

    const mapById = new Map(meses.map((m) => [Number(m.id), String(m.nombre).trim()]));
    const ids = [...periodosMesesOrdenados];
    if (ids.length === 0) return '';
    const nombres = ids.map((id) => mapById.get(Number(id)) || String(id));
    return `${nombres.join(' / ')} ${anioTrabajo}`;
  }, [meses, periodosMesesOrdenados, anualSeleccionado, anualConfig?.etiqueta, anioTrabajo]);

  /* ===== Orden de miembros para UI ===== */
  const miembrosOrdenados = useMemo(() => {
    const arr = Array.isArray(familiaInfo.miembros) ? [...familiaInfo.miembros] : [];
    return arr.sort((a, b) => {
      const isAActual = a.id_alumno === idAlumno ? -1 : 0;
      const isBActual = b.id_alumno === idAlumno ? -1 : 0;
      if (isAActual !== isBActual) return isAActual - isBActual;
      if ((b.activo ? 1 : 0) !== (a.activo ? 1 : 0)) return (b.activo ? 1 : 0) - (a.activo ? 1 : 0);
      const na = `${a.apellido ?? ''} ${a.nombre ?? ''}`.trim().toLowerCase();
      const nb = `${b.apellido ?? ''} ${b.nombre ?? ''}`.trim().toLowerCase();
      return na.localeCompare(nb);
    });
  }, [familiaInfo.miembros, idAlumno]);

  // ✅ si por anual se bloquean meses, y estaban seleccionados, los sacamos
  useEffect(() => {
    if (!seleccionados.length) return;
    const next = seleccionados.filter((id) => !isMesBloqueado(id));
    if (next.length !== seleccionados.length) setSeleccionados(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesesBloqueadosPorAnual]);

  const puedeConfirmarPago = useMemo(() => {
    const tienePeriodosSeleccionados = seleccionados.length > 0 || anualSeleccionado;
    const tieneMedioPagoSeleccionado = !!medioSeleccionado;
    const fechaOk = isValidYMD(fechaPagoSeleccionada);
    return tienePeriodosSeleccionados && tieneMedioPagoSeleccionado && !cargando && fechaOk;
  }, [seleccionados.length, anualSeleccionado, medioSeleccionado, cargando, fechaPagoSeleccionada]);

  /* ================= Efectos ================= */

  const buildAvisoHermanos = (catName, cant) => {
    const n = Number(cant || 0);
    if (!Number.isFinite(n) || n <= 1) return '';
    const nombre = (catName || '').toString().trim().toUpperCase();
    return `No existe descuento familiar configurado para ${n} integrantes. Configuralo en Categorías → Descuento familiar general.`;
  };

  const isMensajeFaltaHermanos = (txt) => {
    const s = String(txt || '');
    return /no\s+hay\s+configuraci[oó]n\s+de\s+hermanos/i.test(s) || /descuentos_hermanos/i.test(s) || /cantidad_hermanos/i.test(s);
  };

  const fetchMontoAlumno = async (idA, count) => {
    const url = `${BASE_URL}/api.php?action=obtener_monto_categoria&id_alumno=${encodeURIComponent(
      idA
    )}&family_count=${encodeURIComponent(count)}&anio=${encodeURIComponent(anioTrabajo)}`;

    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`obtener_monto_categoria HTTP ${res.status}`);
    const data = await res.json().catch(() => ({}));
    if (!data?.exito) throw new Error(data?.mensaje || 'No se pudo obtener monto de categoría.');

    return {
      id_alumno: Number(idA),
      categoria_nombre: (data?.categoria_nombre ?? '').toString().toUpperCase(),
      monto_mensual: Number(data?.monto_mensual ?? 0),
      monto_anual: Number(data?.monto_anual ?? 0),
      montos_por_periodo:
        data?.montos_por_periodo && typeof data.montos_por_periodo === 'object'
          ? data.montos_por_periodo
          : {},
      porcentaje_descuento_hermanos: Number(data?.porcentaje_descuento_hermanos ?? 0),
      advertencia: data?.advertencia ?? '',
    };
  };

  // ✅ Cargar monto mensual/anual + PRECIOS POR PERIODO según año (histórico)
  useEffect(() => {
    const cargarMontoCategoria = async () => {
      try {
        if (!idAlumno) {
          setPrecioMensual(0);
          setNombreCategoria('');
          setMontoAnual(0);
          setAvisoHermanos('');
          setPorcentajeDescuentoHermanos(0);
          setPreciosPorPeriodoDB({});
          return;
        }

        const url = `${BASE_URL}/api.php?action=obtener_monto_categoria&id_alumno=${encodeURIComponent(
          idAlumno
        )}&family_count=${encodeURIComponent(familyCount)}&anio=${encodeURIComponent(anioTrabajo)}`;

        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) throw new Error(`obtener_monto_categoria HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));

        const warnRaw =
          data?.advertencia ??
          data?.warning ??
          data?.aviso ??
          data?.mensaje_advertencia ??
          '';

        const mensaje = data?.mensaje ?? '';
        const hayFaltaHermanos = isMensajeFaltaHermanos(warnRaw) || isMensajeFaltaHermanos(mensaje);

        if (data?.exito) {
          const montoMensual = Number(data?.monto_mensual ?? 0); // referencial
          const anual = Number(data?.monto_anual ?? 0);
          const nombre = (data?.categoria_nombre ?? '').toString();
          const mapPeriodos =
            data?.montos_por_periodo && typeof data.montos_por_periodo === 'object'
              ? data.montos_por_periodo
              : {};

          setPrecioMensual(Number.isFinite(montoMensual) ? montoMensual : 0);
          setMontoAnual(Number.isFinite(anual) ? anual : 0);
          setNombreCategoria(nombre ? nombre.toUpperCase() : '');
          setPreciosPorPeriodoDB(mapPeriodos || {});
          setPorcentajeDescuentoHermanos(Number(data?.porcentaje_descuento_hermanos ?? 0) || 0);

          if (hayFaltaHermanos) setAvisoHermanos(buildAvisoHermanos(nombre, familyCount));
          else setAvisoHermanos('');

          return;
        }

        // fallback
        const montoMensual = Number(data?.monto_mensual ?? data?.monto_base_mensual ?? 0);
        const anual = Number(data?.monto_anual ?? data?.monto_base_anual ?? 0);
        const nombre = (data?.categoria_nombre ?? '').toString();

        setPrecioMensual(Number.isFinite(montoMensual) ? montoMensual : 0);
        setMontoAnual(Number.isFinite(anual) ? anual : 0);
        setNombreCategoria(nombre ? nombre.toUpperCase() : '');
        setPreciosPorPeriodoDB({});
        setPorcentajeDescuentoHermanos(Number(data?.porcentaje_descuento_hermanos ?? 0) || 0);

        if (hayFaltaHermanos) setAvisoHermanos(buildAvisoHermanos(nombre, familyCount));
        else {
          setAvisoHermanos('');
          if (data?.mensaje) mostrarToast('advertencia', data.mensaje);
        }
      } catch (e) {
        console.error('Error al obtener monto por categoría del alumno:', e);
        setPrecioMensual(0);
        setNombreCategoria('');
        setMontoAnual(0);
        setAvisoHermanos('');
        setPorcentajeDescuentoHermanos(0);
        setPreciosPorPeriodoDB({});
        mostrarToast('error', 'No se pudo obtener el monto de la categoría del alumno.');
      }
    };

    cargarMontoCategoria();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAlumno, familyCount, anioTrabajo]);


  // Cargar info de familia + miembros
  useEffect(() => {
    const cargarFamilia = async () => {
      try {
        if (!idAlumno) return;
        const url = `${BASE_URL}/api.php?action=obtener_info_familia&id_alumno=${encodeURIComponent(idAlumno)}`;
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) throw new Error(`obtener_info_familia HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        if (data?.exito) {
          const info = {
            tieneFamilia: !!data.tiene_familia,
            id_familia: data.id_familia ?? null,
            nombre_familia: data.nombre_familia ?? '',
            miembros_total: Number(data.miembros_total || 0),
            miembros_activos: Number(data.miembros_activos || 0),
            miembros: Array.isArray(data.miembros) ? data.miembros : []
          };
          setFamiliaInfo(info);
          const activos = (info.miembros || []).filter((m) => m.activo);
          setAplicarFamilia(info.tieneFamilia && activos.length > 0);
        } else {
          setFamiliaInfo({ tieneFamilia: false, id_familia: null, nombre_familia: '', miembros_total: 0, miembros_activos: 0, miembros: [] });
          setAplicarFamilia(false);
        }
      } catch (e) {
        console.error('cargarFamilia()', e);
        setFamiliaInfo({ tieneFamilia: false, id_familia: null, nombre_familia: '', miembros_total: 0, miembros_activos: 0, miembros: [] });
        setAplicarFamilia(false);
      }
    };
    cargarFamilia();
  }, [idAlumno]);

  // ✅ al cambiar alumno reset básico
  const prevIdAlumnoKey = useMemo(() => String(idAlumno ?? ''), [idAlumno]);
  useEffect(() => {
    setSeleccionados([]);
    setAnualSeleccionado(false);
    setAnualH1(false);
    setAnualH2(false);
    setModoActivo('meses');
    setAnualEditando(false);
    setAnualManualActivo(false);
    setMontoAnualManual('');
    setAvisoHermanos('');
    // ✅ NEW: reset fecha a hoy cuando cambia alumno
    setFechaPagoSeleccionada(toYMD(new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevIdAlumnoKey]);

  useEffect(() => {
    if (anualSeleccionado) setModoActivo('anual');
    else setModoActivo('meses');
  }, [anualSeleccionado, seleccionados.length]);

  // Actualizar "Seleccionar todos"
  useEffect(() => {
    const idsDisponibles = mesesGrid
      .map((m) => Number(m.id))
      .filter((id) => {
        if (id < 1 || id > 12) return false;
        if (periodosEstado[id]) return false;
        if (periodosPagados.includes(Number(id))) return false;
        if (isMesBloqueado(id)) return false;
        return true;
      });

    const all = idsDisponibles.length > 0 && idsDisponibles.every((id) => seleccionados.includes(Number(id)));
    setTodosSeleccionados(all);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionados, mesesGrid, periodosPagados, periodosEstado, mesesBloqueadosPorAnual]);

  // Cargar meses/estado + medios de pago
  useEffect(() => {
    const cargar = async () => {
      if (!idAlumno) {
        console.error('ModalPagos: idAlumno inválido ->', idAlumno, socio);
        mostrarToast('error', 'No se recibió el ID del alumno.');
        return;
      }
      setCargando(true);
      try {
        const urlListas = `${BASE_URL}/api.php?action=obtener_listas`;
        const urlPagados = `${BASE_URL}/api.php?action=meses_pagados&id_alumno=${encodeURIComponent(idAlumno)}&anio=${encodeURIComponent(anioTrabajo)}`;

        const [resListas, resPagados] = await Promise.all([fetch(urlListas), fetch(urlPagados)]);

        if (!resListas.ok) throw new Error(`obtener_listas HTTP ${resListas.status}`);
        if (!resPagados.ok) throw new Error(`meses_pagados HTTP ${resPagados.status}`);

        const [dataListas, dataPagados] = await Promise.all([resListas.json(), resPagados.json()]);

        if (dataListas?.exito) {
          const arrMeses = Array.isArray(dataListas?.listas?.meses) ? dataListas.listas.meses : [];
          const norm = arrMeses
            .map((m) => ({ id: Number(m.id), nombre: m.nombre }))
            .filter(esPeriodoVisiblePagos)
            .sort((a, b) => a.id - b.id);
          setMeses(norm);

          const arrMedios = Array.isArray(dataListas?.listas?.medios_pago) ? dataListas.listas.medios_pago : [];
          const med = arrMedios.map((m) => ({ id: Number(m.id), nombre: String(m.nombre) })).sort((a, b) => a.nombre.localeCompare(b.nombre));
          setMediosPago(med);

          setMedioSeleccionado((prev) => (med.some((m) => String(m.id) === String(prev)) ? prev : ''));
        } else {
          setMeses([]);
          setMediosPago([]);
          setMedioSeleccionado('');
          mostrarToast('advertencia', dataListas?.mensaje || 'No se pudieron cargar las listas.');
        }

        if (dataPagados?.exito) {
          let detalles = [];
          if (Array.isArray(dataPagados?.detalles)) detalles = dataPagados.detalles;
          else if (Array.isArray(dataPagados?.items)) detalles = dataPagados.items;
          else if (Array.isArray(dataPagados?.rows)) detalles = dataPagados.rows;
          else if (Array.isArray(dataPagados?.data)) detalles = dataPagados.data;

          const mapEstado = {};
          for (const d of detalles) {
            const id = Number(d?.id_mes ?? d?.id ?? d?.mes ?? d?.periodo);
            if (!id) continue;
            const est = String(d?.estado ?? '').toLowerCase();
            if (est) mapEstado[id] = est;
          }
          setPeriodosEstado(mapEstado);

          let ids = Object.keys(mapEstado).map(Number);
          if (ids.length === 0) {
            const arrIds = Array.isArray(dataPagados.meses_pagados)
              ? dataPagados.meses_pagados
              : Array.isArray(dataPagados.periodos_pagados)
                ? dataPagados.periodos_pagados
                : [];
            ids = arrIds.map(Number);
          }
          setPeriodosPagados(ids);
          setFechaIngreso(dataPagados.ingreso || '');
        } else {
          setPeriodosEstado({});
          setPeriodosPagados([]);
          mostrarToast('advertencia', dataPagados?.mensaje || 'No se pudo cargar el estado de pagos.');
        }
      } catch (e) {
        console.error('ModalPagos cargar() error:', e);
        mostrarToast('error', String(e.message || e));
      } finally {
        setCargando(false);
      }
    };

    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAlumno, anioTrabajo]);

  /* ================= Acciones ================= */

  const togglePeriodo = (id) => {
    const idNum = Number(id);
    if (idNum < 1 || idNum > 12) return;
    if (isMesBloqueado(idNum)) return;
    if (periodosEstado[idNum] || periodosPagados.includes(idNum)) return;

    setSeleccionados((prev) => (prev.includes(idNum) ? prev.filter((x) => x !== idNum) : [...prev, idNum]));
  };

  const toggleSeleccionarTodos = () => {
    const idsDisponibles = mesesGrid
      .map((m) => Number(m.id))
      .filter((id) => {
        if (id < 1 || id > 12) return false;
        if (periodosEstado[id]) return false;
        if (periodosPagados.includes(id)) return false;
        if (isMesBloqueado(id)) return false;
        return true;
      });

    if (todosSeleccionados) setSeleccionados([]);
    else setSeleccionados(idsDisponibles);
  };

  const toggleAnual = (checked) => {
    if (checked) {
      if (estadoAnualH1 && !estadoAnualH2) { setAnualH1(false); setAnualH2(true); }
      else if (!estadoAnualH1 && estadoAnualH2) { setAnualH1(true); setAnualH2(false); }
      else { setAnualH1(false); setAnualH2(false); }
      setAnualSeleccionado(true);
    } else {
      setAnualSeleccionado(false);
      setAnualH1(false);
      setAnualH2(false);
    }
  };


  const onToggleLibre = (checked) => {
    setLibreActivo(checked);
    if (!checked) setLibreValor('');
    if (checked) setCondonar(false);
  };

  const handleLibreChange = (e) => {
    const raw = e.target.value;
    if (raw === '') { setLibreValor(''); return; }
    let n = Number(raw);
    if (!Number.isFinite(n)) return;
    if (n < 0) n = 0;
    setLibreValor(String(n));
  };


  // ids de familia activos (excluye al actual para evitar duplicar)
  const idsFamiliaActivos = useMemo(() => {
    if (!familiaInfo?.tieneFamilia) return [];
    const activos = (familiaInfo.miembros || [])
      .filter((m) => m.activo && m.id_alumno !== idAlumno)
      .map((m) => Number(m.id_alumno))
      .filter(Boolean);
    return Array.from(new Set(activos));
  }, [familiaInfo, idAlumno]);

  const personasFamiliaActivas = useMemo(() => {
    if (!familiaInfo?.tieneFamilia) return [];
    return (familiaInfo.miembros || []).filter((m) => m.activo);
  }, [familiaInfo]);

  const listaParaOperar = useMemo(() => {
    const alumnoBaseMin = {
      id_alumno: Number(idAlumno),
      apellido_nombre: socio?.apellido_nombre || socio?.nombre || `#${idAlumno}`,
      categoria_nombre: nombreCategoria || ''
    };

    const lista = [alumnoBaseMin];

    if (aplicarFamilia && personasFamiliaActivas.length > 0) {
      const idsYa = new Set([Number(idAlumno)]);
      for (const m of personasFamiliaActivas) {
        const idm = Number(m.id_alumno);
        if (!m.activo) continue;
        if (!idm || idsYa.has(idm)) continue;
        lista.push({
          id_alumno: idm,
          apellido_nombre: `${m.apellido ?? ''} ${m.nombre ?? ''}`.trim() || `#${idm}`,
          categoria_nombre: nombreCategoria || ''
        });
        idsYa.add(idm);
      }
    }
    return lista;
  }, [aplicarFamilia, personasFamiliaActivas, idAlumno, socio?.apellido_nombre, socio?.nombre, nombreCategoria]);

  const esPagoGrupo = aplicarFamilia && listaParaOperar.length > 1;
  const cantidadRegistrosLista = listaParaOperar.length;

  // Carga el monto real de cada integrante con el mismo porcentaje familiar general.
  useEffect(() => {
    let cancelado = false;

    const cargarMontosGrupo = async () => {
      if (condonar || libreActivo || listaParaOperar.length === 0) {
        setMontosFamilia({});
        return;
      }

      const count = esPagoGrupo ? listaParaOperar.length : familyCount;
      const next = {};

      await Promise.all(
        listaParaOperar.map(async (p) => {
          try {
            const info = await fetchMontoAlumno(p.id_alumno, count);
            next[String(p.id_alumno)] = info;
          } catch (e) {
            console.error('Error cargando monto de integrante familiar:', e);
          }
        })
      );

      if (!cancelado) setMontosFamilia(next);
    };

    cargarMontosGrupo();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaParaOperar, esPagoGrupo, familyCount, anioTrabajo, condonar, libreActivo]);

  const getMontoInfoPersona = (idA) => {
    const key = String(idA);
    const fromMap = montosFamilia[key];
    if (fromMap) return fromMap;

    if (Number(idA) === Number(idAlumno)) {
      return {
        id_alumno: Number(idAlumno),
        categoria_nombre: nombreCategoria || '',
        monto_mensual: Number(precioMensual || 0),
        monto_anual: Number(montoAnual || 0),
        montos_por_periodo: preciosPorPeriodoDB || {},
      };
    }

    return {
      id_alumno: Number(idA),
      categoria_nombre: '',
      monto_mensual: Number(precioMensual || 0),
      monto_anual: Number(montoAnual || 0),
      montos_por_periodo: preciosPorPeriodoDB || {},
    };
  };

  const getPrecioMesPersona = (idA, idMes) => {
    if (condonar) return 0;
    if (libreActivo) {
      const v = Number(libreValor);
      return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
    }

    const info = getMontoInfoPersona(idA);
    const map = info?.montos_por_periodo || {};
    const v = Number(map?.[Number(idMes)] ?? map?.[String(idMes)]);
    if (Number.isFinite(v) && v > 0) return Math.round(v);

    const mensual = Number(info?.monto_mensual);
    if (Number.isFinite(mensual) && mensual >= 0) return Math.round(mensual);

    return Math.round(Number(precioMensualFinal || 0));
  };

  const getImporteAnualPersona = (idA) => {
    if (!anualSeleccionado || condonar) return 0;
    if (anualManualActivo) return Math.max(0, Math.round(Number(anualConfig.importe || 0)));

    const info = getMontoInfoPersona(idA);
    const full = Math.max(0, Math.round(Number(info?.monto_anual || 0)));

    if (anualConfig?.tipo === 'h1' || anualConfig?.tipo === 'h2') return Math.round(full / 2);
    return full;
  };

  const getTotalPersona = (idA) => {
    if (condonar) return 0;
    const totalMesesPersona = periodosMesesOrdenados.reduce((acc, id) => acc + getPrecioMesPersona(idA, id), 0);
    const totalAnualPersona = anualSeleccionado ? getImporteAnualPersona(idA) : 0;
    return totalMesesPersona + totalAnualPersona;
  };

  const totalGrupoReal = esPagoGrupo
    ? listaParaOperar.reduce((acc, p) => acc + getTotalPersona(p.id_alumno), 0)
    : Number(total || 0);

  const totalParaMostrar = roundToHundreds(totalGrupoReal);

  // ✅ Cálculo de comisión para cobrador (solo visual)
  const montoComisionCobradorVista = useMemo(() => {
    if (condonar || !esAlumnoCobrador) return 0;
    return Math.round(Number(totalParaMostrar || 0) * (PORCENTAJE_COBRADOR / 100));
  }, [condonar, esAlumnoCobrador, totalParaMostrar]);

  // ✅ Resto visible: total cobrado sin restar menos comisión 15%
  const montoNetoCooperadoraVista = useMemo(() => {
    const totalBase = Number(totalParaMostrar || 0);
    if (condonar || !esAlumnoCobrador) return totalBase;
    return Math.max(0, totalBase - Number(montoComisionCobradorVista || 0));
  }, [condonar, esAlumnoCobrador, totalParaMostrar, montoComisionCobradorVista]);

  const etiquetaTotal = esPagoGrupo ? `Total grupo (${cantidadRegistrosLista})` : 'Total';

  const porcentajeDescuentoFamiliarVista = useMemo(() => {
    if (!esPagoGrupo || condonar || libreActivo) return 0;

    const desdeIntegrantes = Object.values(montosFamilia || {})
      .map((info) => Number(info?.porcentaje_descuento_hermanos ?? 0))
      .find((pct) => Number.isFinite(pct) && pct > 0);

    if (Number.isFinite(desdeIntegrantes) && desdeIntegrantes > 0) return desdeIntegrantes;

    const desdeAlumnoActual = Number(porcentajeDescuentoHermanos || 0);
    return Number.isFinite(desdeAlumnoActual) && desdeAlumnoActual > 0 ? desdeAlumnoActual : 0;
  }, [esPagoGrupo, condonar, libreActivo, montosFamilia, porcentajeDescuentoHermanos]);

  const mostrarDescuentoFamiliarFooter =
    esPagoGrupo && !condonar && !libreActivo && Number(porcentajeDescuentoFamiliarVista || 0) > 0;

  const confirmarPago = async () => {
    if (!idAlumno) return mostrarToast('error', 'Falta ID del alumno.');
    if (!medioSeleccionado) return mostrarToast('error', 'Debés seleccionar un medio de pago antes de continuar.');

    // ✅ validar fecha de pago
    if (!isValidYMD(fechaPagoSeleccionada)) {
      return mostrarToast('error', 'La fecha de pago es inválida.');
    }

    const periodosSeleccionados = [
      ...periodosMesesOrdenados,
      ...(anualSeleccionado ? [anualConfig.idPeriodo] : [])
    ].filter(Boolean);

    if (periodosSeleccionados.length === 0)
      return mostrarToast('advertencia', 'Seleccioná al menos un período (mes o anual).');

    // ✅ montos reales por período (mes a mes)
    const montosPorPeriodo = {};
    for (const id of periodosMesesOrdenados) {
      montosPorPeriodo[id] = Math.round(getPrecioMes(id));
    }
    if (anualSeleccionado && anualConfig?.idPeriodo) {
      montosPorPeriodo[anualConfig.idPeriodo] = Math.round(Number(anualConfig.importe || 0));
    }

    setCargando(true);
    try {
      const payload = {
        id_alumno: Number(idAlumno),
        periodos: periodosSeleccionados,
        anio: Number(anioTrabajo),
        condonar: !!condonar,
        // ✅ fecha_pago elegida
        fecha_pago: fechaPagoSeleccionada,

        // compatibilidad (pero backend debería usar montos_por_periodo si existe)
        monto_unitario: Math.round(getPrecioMes(periodosMesesOrdenados[0] || 1)),
        montos_por_periodo: montosPorPeriodo,
        aplicar_a_familia: !!(aplicarFamilia && idsFamiliaActivos.length > 0),
        ids_familia: idsFamiliaActivos,
        id_medio_pago: Number(medioSeleccionado),
        meta_anual: anualSeleccionado
          ? { tipo: anualConfig.tipo, id_periodo: anualConfig.idPeriodo, importe: anualConfig.importe, manual: anualManualActivo ? 1 : 0 }
          : null
};

      if (libreActivo && !condonar) payload.monto_libre = Math.round(Number(libreValor) || 0);

      const res = await fetch(`${BASE_URL}/api.php?action=registrar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`registrar_pago HTTP ${res.status}`);

      const data = await res.json().catch(() => ({}));
      if (data?.exito) {
        setPagoExitoso(true);
        setPeriodosPagados((prev) => {
          const set = new Set(prev);
          periodosMesesOrdenados.forEach((id) => set.add(Number(id)));
          if (anualSeleccionado && anualConfig?.idPeriodo) set.add(anualConfig.idPeriodo);
          return Array.from(set);
        });
      } else {
        if (Array.isArray(data?.ya_registrados) && data.ya_registrados.length > 0) {
          const txt = data.ya_registrados.map((x) => `${x.periodo} (${(x.estado || '').toUpperCase()})`).join(', ');
          mostrarToast('advertencia', `Ya registrados: ${txt}`);
        } else {
          mostrarToast('error', data?.mensaje || 'No se pudo registrar.');
        }
      }
    } catch (e) {
      console.error('ModalPagos confirmarPago() error:', e);
      mostrarToast('error', String(e.message || e));
    } finally {
      setCargando(false);
    }
  };

  const buildListaCompleta = () => {
    const periodos = [
      ...periodosMesesOrdenados,
      ...(anualSeleccionado && anualConfig?.idPeriodo ? [anualConfig.idPeriodo] : [])
    ];
    const periodoCodigo = periodos[0] || 0;

    const buildMontosBasePersona = (idA) => ({
      ...Object.fromEntries(periodosMesesOrdenados.map((id) => [id, Math.round(getPrecioMesPersona(idA, id))])),
      ...(anualSeleccionado && anualConfig?.idPeriodo ? { [anualConfig.idPeriodo]: Math.round(getImporteAnualPersona(idA)) } : {})
    });

    const periodoTextoCustom =
      anualSeleccionado && anualConfig?.etiqueta
        ? `${anualConfig.etiqueta}${
            periodosMesesOrdenados.length > 0
              ? ' / ' +
                periodosMesesOrdenados
                  .map((id) => {
                    const mapById = new Map(meses.map((m) => [Number(m.id), String(m.nombre).trim()]));
                    return mapById.get(Number(id)) || String(id);
                  })
                  .join(' / ')
              : ''
          } ${anioTrabajo}`
        : (() => {
            const mapById = new Map(meses.map((m) => [Number(m.id), String(m.nombre).trim()]));
            const names = [
              ...periodosMesesOrdenados.map((id) => mapById.get(Number(id)) || String(id)),
            ];
            return names.length ? `${names.join(' / ')} ${anioTrabajo}` : '';
          })();

    const lista = listaParaOperar.map((p) => {
      const idPersona = Number(p.id_alumno);
      const montosBasePersona = buildMontosBasePersona(idPersona);
      const infoPersona = getMontoInfoPersona(idPersona);
      const totalPersona = periodos.reduce((acc, id) => acc + Number(montosBasePersona[id] || 0), 0);

      return {
        ...socio,
        id_alumno: idPersona,
        nombre: p.apellido_nombre,
        apellido_nombre: p.apellido_nombre,
        id_periodo: periodoCodigo,
        periodos,
        periodo_texto: periodoTextoCustom,
        // precio_unitario queda como referencial; montos_por_periodo tiene los importes reales por persona.
        precio_unitario: Math.round(Number(montosBasePersona[periodosMesesOrdenados[0] || periodoCodigo] || 0)),
        importe_total: totalPersona,
        precio_total: totalPersona,
        anio: anioTrabajo,
        categoria_nombre: libreActivo ? 'LIBRE' : infoPersona?.categoria_nombre || p.categoria_nombre || nombreCategoria || '',
        montos_por_periodo: { ...montosBasePersona }
      };
    });

    return { lista, periodos, periodoCodigo, periodoTextoCustom };
  };

  const handleComprobante = async () => {
    const { lista, periodos, periodoCodigo, periodoTextoCustom } = buildListaCompleta();

    if (modoComprobante === 'pdf') {
      try {
        if (aplicarFamilia && lista.length > 1) {
          const nombres = lista.map((p) => p.apellido_nombre || p.nombre || `#${p.id_alumno}`).join(' / ');
          const totalGrupo = roundToHundreds(lista.reduce((acc, p) => acc + (Number(p.precio_total) || 0), 0));

          const montosGrupo = {};
          for (const p of lista) {
            for (const [periodo, monto] of Object.entries(p.montos_por_periodo || {})) {
              montosGrupo[periodo] = (Number(montosGrupo[periodo] || 0) + Number(monto || 0));
            }
          }

          const combinado = {
            ...lista[0],
            id_alumno: lista[0].id_alumno,
            nombre: nombres,
            apellido_nombre: nombres,
            importe_total: totalGrupo,
            precio_total: totalGrupo,
            precio_unitario: 0,
            periodos,
            periodo_texto: periodoTextoCustom,
            montos_por_periodo: montosGrupo
          };

          await generarComprobanteAlumnoPDF(combinado, {
            anio: combinado.anio,
            periodoId: combinado.id_periodo,
            periodoTexto: combinado.periodo_texto,
            importeTotal: totalGrupo,
            precioUnitario: 0,
            periodos: combinado.periodos
          });
        } else {
          const p = lista[0];
          const totalRedondeado = roundToHundreds(Number(p.precio_total) || 0);
          const personaPDF = { ...p, precio_total: totalRedondeado, importe_total: totalRedondeado };
          await generarComprobanteAlumnoPDF(personaPDF, {
            anio: personaPDF.anio,
            periodoId: personaPDF.id_periodo,
            periodoTexto: personaPDF.periodo_texto,
            importeTotal: totalRedondeado,
            precioUnitario: Number(personaPDF.precio_unitario) || 0,
            periodos: personaPDF.periodos
          });
        }
      } catch (e) {
        console.error('Error al generar PDF:', e);
        mostrarToast('error', 'No se pudo generar el PDF.');
      }
      return;
    }

    const win = window.open('', '_blank');
    if (!win) return alert('Habilitá ventanas emergentes para imprimir los comprobantes.');

    const opciones = { anioPago: anioTrabajo };

    if (esExterno) {
      await imprimirRecibosExternosRotados(lista, periodoCodigo, win, opciones);
    } else {
      await imprimirRecibosRotado(lista, periodoCodigo, win, opciones);
    }
  };

  if (!socio) return null;

  const textoFamilia = familiaInfo.tieneFamilia
    ? `Fam: Sí (${Math.max(familiaInfo.miembros_total, familiaInfo.miembros_activos || 0)})`
    : 'Fam: No';

  /* ================= VISTA: ÉXITO ================= */
  if (pagoExitoso) {
    const tituloExito = condonar ? '¡Condonación registrada!' : '¡Pago registrado!';
    const subExito = condonar ? 'El período seleccionado quedó marcado como Condonado.' : 'Generá o imprimí los comprobantes cuando quieras.';
    const etiquetaAnualResumen = anualSeleccionado && anualConfig?.etiqueta ? anualConfig.etiqueta : null;
    const medioNombre = mediosPago.find((m) => String(m.id) === String(medioSeleccionado))?.nombre || '—';

    return (
      <>
        {toast && <Toast tipo={toast.tipo} mensaje={toast.mensaje} duracion={toast.duracion} onClose={() => setToast(null)} />}

        <div className="modal-pagos-overlay">
          <div className="modal-pagos-contenido success-elevated">
            <div className="modal-header success-header">
              <div className="modal-header-content">
                <div className="modal-icon-circle success-icon">
                  <FaCoins size={20} />
                </div>
                <h2 className="modal-title">{tituloExito}</h2>
              </div>
              <button className="modal-close-btn" onClick={() => onClose?.(true)} disabled={cargando} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="modal-body success-body">
              <div className="success-panel success-panel--full">
                <div className="success-left success-left--full">
                  <div className="success-check">
                    <span className="checkmark-giant" aria-hidden="true">✓</span>
                  </div>
                  <div className="success-texts">
                    <h3 className="success-title">{socio?.nombre || socio?.apellido_nombre || 'Alumno'}</h3>
                    <p className="success-sub">{subExito}</p>
                    <ul className="summary-list" aria-label="Resumen de pago">
                      <li><span>Familia</span><strong>{textoFamilia}</strong></li>
                      <li><span>Fecha de pago</span><strong>{formatearFecha(fechaPagoSeleccionada)}</strong></li>
                      <li><span>Valor mensual (referencial)</span><strong>{formatearARS(precioMensualFinal)}</strong></li>
                      <li><span>Meses</span><strong>{periodosMesesOrdenados.length}</strong></li>
                      {etiquetaAnualResumen && <li><span>Contado anual</span><strong>{etiquetaAnualResumen}</strong></li>}
                      <li><span>Medio de pago</span><strong>{medioNombre}</strong></li>
                      <li><span>{etiquetaTotal}</span><strong>{formatearARS(totalParaMostrar)}</strong></li>
                      {esAlumnoCobrador && !condonar && totalParaMostrar > 0 && (
                        <>
                          <li><span>{PORCENTAJE_COBRADOR}% cobrador</span><strong>- {formatearARS(montoComisionCobradorVista)}</strong></li>
                          <li><span>Resto cooperadora</span><strong>{formatearARS(montoNetoCooperadoraVista)}</strong></li>
                        </>
                      )}
                      <li><span>Registros</span><strong>{cantidadRegistrosLista}</strong></li>
                      {periodoTextoFinal && <li className="full-row"><span>Período</span><strong>{periodoTextoFinal}</strong></li>}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="success-actions">
                <div className="segmented" role="tablist" aria-label="Modo de comprobante">
                  <button role="tab" aria-selected={modoComprobante === 'imprimir'} className={`segmented-item ${modoComprobante === 'imprimir' ? 'active' : ''}`} onClick={() => setModoComprobante('imprimir')}>
                    Imprimir
                  </button>
                  <button role="tab" aria-selected={modoComprobante === 'pdf'} className={`segmented-item ${modoComprobante === 'pdf' ? 'active' : ''}`} onClick={() => setModoComprobante('pdf')}>
                    PDF
                  </button>
                </div>
                <div className="hint">
                  {modoComprobante === 'pdf'
                    ? 'Generará un único PDF si pagó el grupo familiar.'
                    : 'Abrirá la vista de impresión con un comprobante por persona.'}
                </div>
              </div>
            </div>

            <div className="modal-footer success-footer">
              <div className="footer-left footer-left--chips">
                <span className={`total-badge ${condonar ? 'total-badge-warning' : ''}`}>
                  {etiquetaTotal}: {formatearARS(totalParaMostrar)}
                </span>

                {mostrarDescuentoFamiliarFooter && (
                  <span className="total-badge total-badge-family">
                    Descuento familiar {formatearPorcentaje(porcentajeDescuentoFamiliarVista)}
                  </span>
                )}

                {esAlumnoCobrador && !condonar && totalParaMostrar > 0 && (
                  <div className="cobrador-footer-chips" aria-label="Detalle de cobrador">
                    <span className="cobrador-footer-chip cobrador-footer-chip--comision">
                      {PORCENTAJE_COBRADOR}% cobrador: - {formatearARS(montoComisionCobradorVista)}
                    </span>
                    <span className="cobrador-footer-chip cobrador-footer-chip--neto">
                      Resto cooperadora: {formatearARS(montoNetoCooperadoraVista)}
                    </span>
                  </div>
                )}
              </div>
              <div className="footer-actions">
                <button className="btn btn-secondary" onClick={() => onClose?.(true)} type="button">Listo</button>
                <button className="btn btn-danger" onClick={handleComprobante} type="button">
                  {modoComprobante === 'pdf' ? 'Descargar PDF' : 'Abrir impresión'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ================= VISTA: NORMAL ================= */
  return (
    <>
      {toast && <Toast tipo={toast.tipo} mensaje={toast.mensaje} duracion={toast.duracion} onClose={() => setToast(null)} />}

      <div className="modal-pagos-overlay">
        <div className="modal-pagos-contenido">
          <div className="modal-header danger-header">
            <div className="modal-header-content">
              <div className="modal-icon-circle"><FaCoins size={20} /></div>
              <h2 className="modal-title">Registro de Pagos / Condonar</h2>
            </div>
            <button className="modal-close-btn" onClick={() => onClose?.(false)} disabled={cargando} aria-label="Cerrar">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="modal-body">
            <div className="socio-info-card socio-info-card--danger">
              <div className="socio-info-header">
                <div className="sep_header">
                  <h3 className="socio-nombre">{socio?.nombre || socio?.apellido_nombre || 'Alumno'}</h3>

                  <span className="valor-mes valor-mes--danger">
                    <strong>Valor mensual</strong>{' '}
                    {libreActivo ? '(LIBRE)' : nombreCategoria ? `(${nombreCategoria})` : ''}: {formatearARS(precioMensualFinal)}
                    {avisoHermanos ? (
                      <span style={{ marginLeft: 8, fontWeight: 600 }}>
                        {' '} - <span style={{ fontWeight: 600 }}>{avisoHermanos}</span>
                      </span>
                    ) : null}
                  </span>
                </div>

                <div className="sep_headeric">
                  <span className="badge-info" title={familiaInfo.nombre_familia ? `Familia: ${familiaInfo.nombre_familia}` : 'Sin familia'}>
                    {familiaInfo.tieneFamilia
                      ? `Fam: Sí (${Math.max(familiaInfo.miembros_total, familiaInfo.miembros_activos || 0)})`
                      : 'Fam: No'}
                  </span>
                </div>

                {fechaIngreso && (
                  <div className="socio-fecha">
                    <span className="fecha-label">Ingreso:</span>
                    <span className="fecha-valor">{formatearFecha(fechaIngreso)}</span>
                  </div>
                )}
              </div>

              {familiaInfo.tieneFamilia && (
                <div className="centrar-familia">
                  <label className="condonar-check family-toggle">
                    <input type="checkbox" checked={aplicarFamilia} onChange={(e) => setAplicarFamilia(e.target.checked)} disabled={cargando} />
                    <span className="switch"><span className="switch-thumb" /></span>
                    <span className="switch-label"><strong>Aplicar pago al grupo familiar</strong></span>
                  </label>

                  <div className="family-dropdown">
                    <button type="button" className="btn btn-small btn-terciario" aria-expanded={mostrarMiembros} aria-controls="family-members-panel" onClick={() => setMostrarMiembros((v) => !v)}>
                      {mostrarMiembros ? 'Ocultar miembros' : 'Ver miembros'}
                    </button>

                    {mostrarMiembros && (
                      <div id="family-members-panel" className="family-members-panel" role="region" aria-label="Miembros del grupo familiar">
                        {miembrosOrdenados.length === 0 ? (
                          <div className="no-members">Sin integrantes cargados.</div>
                        ) : (
                          <ul className="members-list">
                            {miembrosOrdenados.map((m) => {
                              const esActual = m.id_alumno === idAlumno;
                              const etiqueta = `${m.apellido ?? ''} ${m.nombre ?? ''}`.trim() || `#${m.id_alumno}`;
                              return (
                                <li key={m.id_alumno} className={`member-item ${esActual ? 'current-member' : ''}`}>
                                  <span className="member-name">{etiqueta}{esActual ? ' (actual)' : ''}</span>
                                  <span className={`chip ${m.activo ? 'chip-success' : 'chip-muted'}`}>{m.activo ? 'Activo' : 'Inactivo'}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ✅ FECHA + AÑO — fila refinada */}
            <div className="fecha-anio-row">
              <div className="field-card field-card--fecha">
                {/* Ícono como botón: SOLO esto abre el calendario */}
                <button
                  type="button"
                  className="field-card__icon-wrap fecha-icon-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (cargando) return;

                    const el = fechaPagoRef.current;
                    if (!el) return;

                    // gesto del usuario = OK
                    el.focus({ preventScroll: true });

                    if (typeof el.showPicker === 'function') {
                      try {
                        el.showPicker();
                        return;
                      } catch (_) {
                        // fallback
                      }
                    }

                    // fallback: algunos browsers abren con click
                    try { el.click(); } catch (_) {}
                  }}
                  aria-label="Abrir calendario"
                  disabled={cargando}
                >
                  <FaCalendarAlt />
                </button>

                <div className="field-card__body">
                  <label className="field-card__label" htmlFor="fecha-pago-input">
                    Fecha de pago
                    <span className="field-card__required">*</span>
                  </label>

                  <input
                    ref={fechaPagoRef}
                    id="fecha-pago-input"
                    type="date"
                    className={`field-card__input ${!isValidYMD(fechaPagoSeleccionada) ? 'field-card__input--error' : ''}`}
                    value={fechaPagoSeleccionada}
                    onChange={(e) => setFechaPagoSeleccionada(e.target.value)}
                    disabled={cargando}

                    // ✅ 1) marcamos "user gesture" REAL
                    onPointerDown={() => {
                      if (!fechaPagoRef.current) return;
                      fechaPagoRef.current.dataset.userGesture = '1';
                    }}

                    // ✅ 2) al enfocarse, abrimos el picker (si venimos del gesto)
                    onFocus={(e) => {
                      if (cargando) return;
                      const el = e.currentTarget;

                      if (el.dataset.userGesture !== '1') return;
                      el.dataset.userGesture = '0';

                      if (typeof el.showPicker === 'function') {
                        try {
                          el.showPicker();
                        } catch (_) {
                          // fallback: no hacemos nada para evitar errores/loops
                          // en algunos browsers ya se abre igual
                        }
                      }
                    }}
                  />

                  {!isValidYMD(fechaPagoSeleccionada) ? (
                    <span className="field-card__hint field-card__hint--error">Fecha inválida</span>
                  ) : (
                    <span className="field-card__hint">Por defecto hoy · podés cambiarla</span>
                  )}
                </div>
              </div>

              {/* —— Año de trabajo —— */}
              <div className="field-card field-card--anio">
                <div className="field-card__icon-wrap">
                  <FaCalendarAlt />
                </div>
                <div className="field-card__body">
                  <label className="field-card__label">
                    Año
                    <span className="field-card__required">*</span>
                  </label>

                  <div className="year-pill-picker" style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className={`year-pill-btn ${showYearPicker ? 'year-pill-btn--open' : ''}`}
                      onClick={() => setShowYearPicker((s) => !s)}
                      disabled={cargando}
                      title="Cambiar año"
                    >
                      <span className="year-pill-btn__year">{anioTrabajo}</span>
                      <svg className={`year-pill-btn__chevron ${showYearPicker ? 'rotated' : ''}`}
                        width="14" height="14" viewBox="0 0 20 20" fill="none">
                        <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    {showYearPicker && (
                      <div className="year-pill-popover" onMouseLeave={() => setShowYearPicker(false)}>
                        {yearOptions.map((y) => (
                          <button
                            key={y}
                            type="button"
                            className={`year-pill-option ${y === anioTrabajo ? 'year-pill-option--active' : ''}`}
                            onClick={() => { setAnioTrabajo(y); setShowYearPicker(false); }}
                          >
                            {y}
                            {y === nowYear && <span className="year-pill-option__tag">Hoy</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <span className="field-card__hint">Período a registrar</span>
                </div>
              </div>
            </div>

            {/* Condonar + Libre (ya SIN el selector de año acá) */}
            <div className="condonarAño-montoLibre">
              <div className={`condonar-box ${condonar ? 'is-active' : ''}`}>
                <label className="condonar-check">
                  <input type="checkbox" checked={condonar} onChange={(e) => setCondonar(e.target.checked)} disabled={cargando} />
                  <span className="switch"><span className="switch-thumb" /></span>
                  <span className="switch-label">Marcar como <strong>Condonado</strong>(no genera cobro)</span>
                </label>
              </div>

              {/* Modo libre */}
              <div className={`condonar-box ${libreActivo ? 'is-active' : ''}`}>
                <label className="condonar-check">
                  <input type="checkbox" checked={libreActivo} onChange={(e) => onToggleLibre(e.target.checked)} disabled={cargando} />
                  <span className="switch"><span className="switch-thumb" /></span>
                  <span className="switch-label">Usar <strong>monto libre por mes</strong></span>
                </label>

                <div className="year-picker libre-input-container">
                  <input
                    type="number"
                    min="0"
                    step="500"
                    inputMode="numeric"
                    placeholder="Ingresá el monto libre por mes"
                    value={libreValor}
                    onChange={handleLibreChange}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'Minus') e.preventDefault(); }}
                    disabled={!libreActivo || cargando}
                    className="libre-input"
                  />
                </div>
              </div>
            </div>

            {/* ===== EXTRAS: CONTADO ANUAL ===== */}
            {ventanaAnualActiva && (
              <div className={`condonar-box ${anualSeleccionado ? 'is-active' : ''} ${bloqueadoAnual ? 'is-disabled' : ''}`}>
                <label className="condonar-check">
                  <input type="checkbox" checked={anualSeleccionado} onChange={(e) => toggleAnual(e.target.checked)} disabled={cargando || libreActivo || bloqueadoAnual} />
                  <span className="switch"><span className="switch-thumb" /></span>

                  <div className="dis-newedit">
                    <span className="switch-label">
                      <span className="sitch-labes">
                        <span className={`anual-text ${anualSeleccionado ? 'stack' : 'row'}`}>
                          <strong>CONTADO ANUAL</strong>
                          <span className="subline">
                            {(() => {
                              const base = anualManualActivo ? Number(montoAnualManual || 0) : Number(montoAnualFinal || 0);
                              const txtBase = formatearARS(Math.max(0, Math.round(base)));
                              if (anualManualActivo) return `(${txtBase} • monto manual)`;
                              return `(${txtBase})`;
                            })()}
                          </span>
                        </span>
                      </span>
                    </span>

                    {!bloqueadoAnual && !anualEditando && (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          title="Editar monto anual"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAnualSeleccionado(true); setAnualEditando(true); }}
                          style={{ marginLeft: 8 }}
                        >
                          <FaPen />
                        </button>

                        {anualManualActivo && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            title="Quitar monto manual"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAnualManualActivo(false); setMontoAnualManual(''); setAnualSeleccionado(true); }}
                            style={{ marginLeft: 6 }}
                          >
                            <FaTimes />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </label>

                {anualSeleccionado && !bloqueadoAnual && (
                  <>
                    {anualEditando && (
                      <div className="edit-inline anual-edit" id="btn-editanual">
                        <input
                          id="input-editanual"
                          type="number"
                          min="0"
                          step="500"
                          inputMode="numeric"
                          value={montoAnualManual}
                          onChange={(e) => setMontoAnualManual(e.target.value)}
                          className="anual-input"
                        />
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            let v = Math.max(0, Math.round(Number(montoAnualManual) || 0));
                            if (!Number.isFinite(v)) v = 0;
                            setMontoAnualManual(v);
                            setAnualManualActivo(true);
                            setAnualEditando(false);
                            setAnualSeleccionado(true);
                          }}
                          title="Guardar monto anual"
                          aria-label="Guardar monto anual"
                        >
                          <FaCheck />
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAnualEditando(false); setAnualSeleccionado(true); }} title="Cancelar edición" aria-label="Cancelar edición">
                          <FaTimes />
                        </button>
                      </div>
                    )}

                    <div className="edit-inline anual-mitades">
                      <label className={`condonar-check ${estadoAnualH1 ? 'is-disabled' : ''}`}>
                        <input type="checkbox" checked={anualH1} onChange={(e) => setAnualH1(e.target.checked)} disabled={cargando || !!estadoAnualH1} />
                        <span className="switch"><span className="switch-thumb" /></span>
                        <span className="switch-label">
                          <strong>1ª mitad</strong> (Ene–Jun)
                          {estadoAnualH1 && <span className={`chip ${estadoAnualH1 === 'condonado' ? 'chip-muted' : 'chip-success'}`} style={{ marginLeft: 6 }}>{capitalizar(estadoAnualH1)}</span>}
                        </span>
                      </label>

                      <label className={`condonar-check ${estadoAnualH2 ? 'is-disabled' : ''}`}>
                        <input type="checkbox" checked={anualH2} onChange={(e) => setAnualH2(e.target.checked)} disabled={cargando || !!estadoAnualH2} />
                        <span className="switch"><span className="switch-thumb" /></span>
                        <span className="switch-label">
                          <strong>2ª mitad</strong> (Jul–Dic)
                          {estadoAnualH2 && <span className={`chip ${estadoAnualH2 === 'condonado' ? 'chip-muted' : 'chip-success'}`} style={{ marginLeft: 6 }}>{capitalizar(estadoAnualH2)}</span>}
                        </span>
                      </label>

                      <div className="anual-mitades-info">
                        <span className="anual-mitades-importe">Importe: {formatearARS(Math.round(anualConfig?.importe || 0))}</span>

                        <button type="button" className="info-icon" aria-label="Ver información sobre mitades">
                          <FaInfoCircle aria-hidden="true" />
                          <span className="tip" role="tooltip">
                            Si no se eligen mitades, se considera todo el año. Si ya hay una mitad pagada, se selecciona automáticamente la restante.
                          </span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {bloqueadoAnual && <div className="hint" style={{ marginTop: 8 }}>Ya existe un registro de contado anual completo (o ambas mitades) para este año.</div>}
              </div>
            )}
            {/* Medio de pago */}
            <div className="condonar-box">
              <div className="medio-pago-inline">
                <label className="medio-pago-inline-label" htmlFor="medio-pago-select">Medio de pago *</label>
                <div className="medio-pago-input">
                  <select
                    id="medio-pago-select"
                    className="medio-pago-select"
                    value={medioSeleccionado || ''}
                    onChange={(e) => setMedioSeleccionado(e.target.value)}
                    disabled={cargando}
                    required
                  >
                    <option value="" disabled>Seleccionar...</option>
                    {mediosPago.length === 0 && <option value="">(Sin datos)</option>}
                    {mediosPago.map((mp) => (
                      <option key={mp.id} value={String(mp.id)}>{mp.nombre}</option>
                    ))}
                  </select>
                  {!medioSeleccionado && (
                    <div className="hint" style={{ marginTop: 4, color: 'var(--danger)' }}>
                      * Campo obligatorio para registrar el pago
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Selección de meses */}
            <div className="periodos-section">
              <div className="section-header">
                <h4 className="section-title">Meses disponibles</h4>
                <div className="section-header-actions">
                  <button className="btn btn-small btn-terciario" onClick={toggleSeleccionarTodos} disabled={cargando || mesesGrid.length === 0} type="button">
                    {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'} ({seleccionados.length})
                  </button>
                </div>
              </div>

              {cargando && mesesGrid.length === 0 ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <span>Cargando meses...</span>
                </div>
              ) : (
                <div className="periodos-grid-container">
                  <div className="periodos-grid">
                    {mesesGrid.map((m) => {
                      const idMes = Number(m.id);
                      const estado = periodosEstado[idMes];
                      const bloqueadoPorAnual = isMesBloqueado(idMes);
                      const yaOcupado = !!estado || periodosPagados.includes(idMes) || bloqueadoPorAnual;
                      const sel = seleccionados.includes(idMes);

                      const statusTxt = estado
                        ? capitalizar(estado)
                        : periodosPagados.includes(idMes)
                          ? 'Pagado'
                          : bloqueadoPorAnual
                            ? 'Cubierto por anual'
                            : '';

                      // ✅ mostrar precio real histórico por mes (si no condonar y no libre)
                      const precioMesLabel = (!condonar && !libreActivo)
                        ? ` • ${formatearARS(getPrecioMes(idMes))}`
                        : '';

                      return (
                        <div
                          key={idMes}
                          className={`periodo-card ${yaOcupado ? 'pagado' : ''} ${sel ? 'seleccionado' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => { if (cargando) return; togglePeriodo(idMes); }}
                          onKeyDown={(e) => {
                            if (cargando) return;
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePeriodo(idMes); }
                          }}
                        >
                          <div className="periodo-checkbox" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              id={`periodo-${idMes}`}
                              checked={sel}
                              onChange={() => togglePeriodo(idMes)}
                              disabled={cargando || yaOcupado}
                            />
                            <span className="checkmark"></span>
                          </div>
                          <label htmlFor={`periodo-${idMes}`} className="periodo-label" onClick={(e) => e.preventDefault()}>
                            {m.nombre}{precioMesLabel}
                            {yaOcupado && (
                              <span className="periodo-status">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                  <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {statusTxt}
                              </span>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <div className="footer-left footer-left--chips">
              <span className={`total-badge ${condonar ? 'total-badge-warning' : ''}`}>
                {etiquetaTotal}: {formatearARS(totalParaMostrar)}
              </span>

              {mostrarDescuentoFamiliarFooter && (
                <span className="total-badge total-badge-family">
                  Descuento familiar {formatearPorcentaje(porcentajeDescuentoFamiliarVista)}
                </span>
              )}

              {esAlumnoCobrador && !condonar && totalParaMostrar > 0 && (
                <div className="cobrador-footer-chips" aria-label="Detalle de cobrador">
                  <span className="cobrador-footer-chip cobrador-footer-chip--comision">
                    {PORCENTAJE_COBRADOR}% cobrador: - {formatearARS(montoComisionCobradorVista)}
                  </span>

                  <span className="cobrador-footer-chip cobrador-footer-chip--neto">
                    cooperadora: {formatearARS(montoNetoCooperadoraVista)}
                  </span>
                </div>
              )}

              {!medioSeleccionado && (
                <span className="total-badge total-badge-warning">
                  Medio de pago requerido
                </span>
              )}

              {!isValidYMD(fechaPagoSeleccionada) && (
                <span className="total-badge total-badge-warning">
                  Fecha inválida
                </span>
              )}
            </div>

            <div className="footer-actions">
              <button className="btn btn-secondary" onClick={() => onClose?.(false)} disabled={cargando} type="button">
                Cancelar
              </button>
              <button className={`btn ${condonar ? 'btn-warning' : 'btn-danger'}`} onClick={confirmarPago} disabled={!puedeConfirmarPago} type="button">
                {cargando ? (<><span className="spinner-btn"></span> Procesando...</>) : condonar ? 'Condonar' : 'Confirmar Pago'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalPagos;
