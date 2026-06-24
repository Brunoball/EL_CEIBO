// ✅ REEMPLAZAR COMPLETO
// src/components/Cuotas/Cuotas.jsx

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDollarSign,
  faPrint,
  faSearch,
  faCalendarAlt,
  faFilter,
  faSort,
  faUsers,
  faTimes,
  faArrowLeft,
  faFileExcel,
  faCheckCircle,
  faExclamationTriangle,
  faCog,
  faMoneyCheckAlt,
  faList
} from '@fortawesome/free-solid-svg-icons';

import BASE_URL from '../../config/config';
import ModalPagos from './modales/ModalPagos';
import ModalCodigoBarras from './modales/ModalCodigoBarras';
import ModalEliminarPago from './modales/ModalEliminarPago';
import ModalEliminarCondonacion from './modales/ModalEliminarCondonacion';
import ModalMesCuotas from './modales/ModalMesCuotas';
import { imprimirRecibos } from '../../utils/imprimirRecibos';
import { imprimirRecibosExternos } from '../../utils/imprimirRecibosExternos';
import Toast from '../Global/Toast';
import './Cuotas.css';
import "../Global/roots.css";

const normalizar = (s = '') =>
  String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const CURRENT_YEAR = new Date().getFullYear();

const ID_MES_ANUAL     = 13;
const ID_MES_1ER_MITAD = 15;
const ID_MES_2DA_MITAD = 16;

const ORDEN_MESES_CLUB = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const esPeriodoVisibleCuotas = (mes) => {
  const id = Number(mes?.id ?? mes?.id_mes ?? 0);
  // Club: cuotas mensuales completas de enero a diciembre.
  // Se conservan los períodos especiales: contado anual, 1era mitad y 2da mitad.
  return (id >= 1 && id <= 12) || [13, 15, 16].includes(id);
};

function getPorcDescuentoDerivado() {
  // El descuento familiar ya viene calculado desde el backend según la tabla descuentos_hermanos.
  // Se deja en 0 para no aplicar dos veces el porcentaje sobre el monto final.
  return 0;
}

async function asyncPool(limit, array, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);

    if (limit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

const parseMonto = (v) => {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  const s = String(v).replace(/[^\d,.-]/g, '');
  const normalized = s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

const Cuotas = () => {
  const [cuotas, setCuotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPrint, setLoadingPrint] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  const [estadoPagoSeleccionado, setEstadoPagoSeleccionado] = useState('deudor');
  const [anioPagoSeleccionado, setAnioPagoSeleccionado] = useState('');
  const [anioLectivoSeleccionado, setAnioLectivoSeleccionado] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [divisionSeleccionada, setDivisionSeleccionada] = useState('');
  const [mesSeleccionado, setMesSeleccionado] = useState('');
  const [soloCobrador, setSoloCobrador] = useState(false);

  const [aniosPago, setAniosPago] = useState([]);
  const [aniosLectivos, setAniosLectivos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [divisiones, setDivisiones] = useState([]);
  const [meses, setMeses] = useState([]);

  const [orden, setOrden] = useState({ campo: 'nombre', ascendente: true });

  const [toastVisible, setToastVisible] = useState(false);
  const [toastTipo, setToastTipo] = useState('exito');
  const [toastMensaje, setToastMensaje] = useState('');

  const [mostrarModalPagos, setMostrarModalPagos] = useState(false);
  const [mostrarModalCodigoBarras, setMostrarModalCodigoBarras] = useState(false);
  const [mostrarModalEliminarPago, setMostrarModalEliminarPago] = useState(false);
  const [mostrarModalEliminarCond, setMostrarModalEliminarCond] = useState(false);

  const [socioParaPagar, setSocioParaPagar] = useState(null);

  const [mostrarModalMesCuotas, setMostrarModalMesCuotas] = useState(false);
  const [socioParaImprimir, setSocioParaImprimir] = useState(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [selectedRow, setSelectedRow] = useState(null);

  const listRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const selectedRowRef  = useRef(null);

  const abortRef = useRef({ cuotas: null, listas: null, anios: null });

  const cacheMontoCategoriaRef = useRef(new Map());
  const cacheFamiliaRef = useRef(new Map());

  const [cascadeActive, setCascadeActive] = useState(false);
  const [cascadeRunId, setCascadeRunId] = useState(0);
  const cascadeTimerRef = useRef(null);
  const triggerCascade = useCallback(() => {
    setCascadeActive(true);
    setCascadeRunId(prev => prev + 1);
    if (cascadeTimerRef.current) clearTimeout(cascadeTimerRef.current);
    cascadeTimerRef.current = setTimeout(() => setCascadeActive(false), 800);
  }, []);
  useEffect(() => () => { if (cascadeTimerRef.current) clearTimeout(cascadeTimerRef.current); }, []);

  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const getIdMesFromCuota = (c) => c?.id_mes ?? c?.id_periodo ?? '';
  const getNombreCuota = (c) => c?.nombre ?? '';
  const getDomicilioCuota = (c) => c?.domicilio ?? '';
  const getDocumentoCuota = (c) => c?.documento ?? c?.dni ?? c?.num_documento ?? '';
  const getIdAlumnoFromCuota = (c) => c?.id_alumno ?? c?.id_socio ?? c?.id ?? '';

  const getIdAnioLectivo = (c) =>
    c?.id_anio ?? c?.id_año ?? c?.anio_id ?? c?.anio ?? '';
  const getNombreAnioLectivo = (c) =>
    c?.anio_nombre ?? c?.nombre_anio ?? c?.nombre_año ?? '';

  const getNombreDivision = (id) => (divisiones.find(d => String(d.id) === String(id))?.nombre) || '';
  const getNombreCategoria = (id) => (categorias.find(c => String(c.id) === String(id))?.nombre) || '';
  const getNombreMes = (id) => (meses.find(m => String(m.id) === String(id))?.nombre) || id;

  const getCategoriaExternoId = useCallback(() => {
    const cat = categorias.find(c => normalizar(c?.nombre) === 'externo');
    return cat ? String(cat.id) : '';
  }, [categorias]);

  const getMesesClubOrdenados = useCallback(() => {
    const lista = Array.isArray(meses) ? meses : [];

    const encontrados = lista
      .map((m) => {
        const nombreNorm = normalizar(m?.nombre || '');
        const orden = ORDEN_MESES_CLUB[nombreNorm];
        if (!orden) return null;
        return {
          id: Number(m.id),
          nombre: m.nombre,
          orden,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.orden - b.orden);

    if (encontrados.length > 0) {
      return encontrados;
    }

    return [
      { id: 1, nombre: 'Enero', orden: 1 },
      { id: 2, nombre: 'Febrero', orden: 2 },
      { id: 3, nombre: 'Marzo', orden: 3 },
      { id: 4, nombre: 'Abril', orden: 4 },
      { id: 5, nombre: 'Mayo', orden: 5 },
      { id: 6, nombre: 'Junio', orden: 6 },
      { id: 7, nombre: 'Julio', orden: 7 },
      { id: 8, nombre: 'Agosto', orden: 8 },
      { id: 9, nombre: 'Septiembre', orden: 9 },
      { id: 10, nombre: 'Octubre', orden: 10 },
      { id: 11, nombre: 'Noviembre', orden: 11 },
      { id: 12, nombre: 'Diciembre', orden: 12 },
    ];
  }, [meses]);

  const canPrint = (estadoPagoSeleccionado === 'pagado') || (soloCobrador === true);

  const getAlumnoUniqueKey = useCallback((c) => {
    const idAlumno = getIdAlumnoFromCuota(c);
    if (idAlumno !== '' && idAlumno != null) return `id:${idAlumno}`;

    const nombre = normalizar(getNombreCuota(c));
    const dni = String(getDocumentoCuota(c) || '').trim();
    const division = String(c?.id_division || '').trim();

    return `fallback:${nombre}|${dni}|${division}`;
  }, []);

  const deduplicarPorAlumno = useCallback((lista) => {
    if (!Array.isArray(lista) || lista.length === 0) return [];

    const map = new Map();

    for (const item of lista) {
      const key = getAlumnoUniqueKey(item);
      const actual = map.get(key);

      if (!actual) {
        map.set(key, item);
        continue;
      }

      const mesActual = Number(getIdMesFromCuota(actual)) || 999;
      const mesNuevo = Number(getIdMesFromCuota(item)) || 999;

      if (mesNuevo < mesActual) {
        map.set(key, item);
      }
    }

    return Array.from(map.values());
  }, [getAlumnoUniqueKey]);

  const fetchAniosPago = useCallback(async () => {
    try {
      if (abortRef.current.anios) abortRef.current.anios.abort();
      abortRef.current.anios = new AbortController();

      const res = await fetch(`${BASE_URL}/api.php?action=cuotas&listar_anios=1`, {
        signal: abortRef.current.anios.signal
      });
      const data = await res.json().catch(() => ({}));
      const lista = (data?.anios && Array.isArray(data.anios)) ? data.anios : [];
      setAniosPago(lista);

      const seleccionado = String(anioPagoSeleccionado || '');
      const existeSeleccionado = seleccionado && lista.some(a => String(a.id) === seleccionado);
      if (existeSeleccionado) return;

      const hasCurrent = lista.some(a => String(a.id) === String(CURRENT_YEAR));
      if (hasCurrent) setAnioPagoSeleccionado(String(CURRENT_YEAR));
      else if (lista.length > 0) setAnioPagoSeleccionado(String(lista[0].id));
      else setAnioPagoSeleccionado('');
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.error('Error al obtener años de pago:', e);
      setAniosPago([]);
    }
  }, [anioPagoSeleccionado]);

  const obtenerCuotasYListas = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      params.set('action', 'cuotas');
      if (mesSeleccionado) params.set('id_mes', String(mesSeleccionado));
      if (anioPagoSeleccionado) params.set('anio', String(anioPagoSeleccionado));
      if (soloCobrador) params.set('solo_cobrador', '1');

      if (abortRef.current.cuotas) abortRef.current.cuotas.abort();
      if (abortRef.current.listas) abortRef.current.listas.abort();
      abortRef.current.cuotas = new AbortController();
      abortRef.current.listas = new AbortController();

      const [resCuotas, resListas] = await Promise.all([
        fetch(`${BASE_URL}/api.php?${params.toString()}`, { signal: abortRef.current.cuotas.signal }),
        fetch(`${BASE_URL}/api.php?action=obtener_listas`, { signal: abortRef.current.listas.signal })
      ]);

      const dataCuotas = await resCuotas.json().catch(() => ({}));
      const dataListas = await resListas.json().catch(() => ({}));

      setCuotas(dataCuotas?.exito && Array.isArray(dataCuotas.cuotas) ? dataCuotas.cuotas : []);

      if (dataListas?.exito) {
        const L = dataListas.listas || {};
        setCategorias(Array.isArray(L.categorias) ? L.categorias : []);
        setDivisiones(Array.isArray(L.divisiones) ? L.divisiones : []);
        setMeses(Array.isArray(L.meses) ? L.meses.filter(esPeriodoVisibleCuotas) : []);
        setAniosLectivos(Array.isArray(L.anios) ? L.anios : []);
      } else {
        setCategorias([]); setDivisiones([]); setMeses([]); setAniosLectivos([]);
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.error('Error al conectar con el servidor:', e);
      setCuotas([]); setCategorias([]); setDivisiones([]); setMeses([]); setAniosLectivos([]);
    } finally {
      setLoading(false);
    }
  }, [mesSeleccionado, anioPagoSeleccionado, soloCobrador]);

  useEffect(() => { fetchAniosPago(); }, [fetchAniosPago]);
  useEffect(() => { obtenerCuotasYListas(); /* eslint-disable-next-line */ }, [mesSeleccionado, anioPagoSeleccionado, soloCobrador]);

  useEffect(() => {
    if (!loading && listRef.current && scrollOffsetRef.current > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollTo(scrollOffsetRef.current);
      });
    }
    if (!loading && selectedRowRef.current !== null) {
      setSelectedRow(selectedRowRef.current);
    }
  }, [loading]);

  const patchCuotasAfterAccion = useCallback(({ idAlumno, periodos, estado }) => {
    if (!idAlumno || !Array.isArray(periodos) || periodos.length === 0) return;

    const periodosNum = periodos
      .map(p => Number(String(p).trim()))
      .filter(n => Number.isFinite(n));

    if (periodosNum.length === 0) return;

    const estadoNorm = String(estado || '').toLowerCase().trim();
    if (!estadoNorm) return;

    setCuotas(prev =>
      prev.map((c) => {
        const sameAlumno = String(getIdAlumnoFromCuota(c)) === String(idAlumno);
        if (!sameAlumno) return c;

        const mes = Number(String(getIdMesFromCuota(c)).trim());
        if (!Number.isFinite(mes)) return c;

        if (periodosNum.includes(mes)) {
          return { ...c, estado_pago: estadoNorm };
        }
        return c;
      })
    );
  }, []);

  const coincideBusquedaLibre = (c) => {
    if (!busqueda) return true;
    const q = normalizar(busqueda);
    return (
      normalizar(getNombreCuota(c)).includes(q) ||
      normalizar(getDomicilioCuota(c)).includes(q) ||
      normalizar(getDocumentoCuota(c)).includes(q)
    );
  };
  const coincideCategoria = (c) =>
    !categoriaSeleccionada || String(c?.id_categoria ?? '') === String(categoriaSeleccionada);
  const coincideDivision = () => true;
  const coincideMes = (c) =>
    !mesSeleccionado || String(getIdMesFromCuota(c)) === String(mesSeleccionado);

  const coincideEstadoPago = (c) =>
    !estadoPagoSeleccionado ||
    String(c?.estado_pago ?? '').toLowerCase().trim() === String(estadoPagoSeleccionado).toLowerCase().trim();

  const coincideAnioLectivo = () => true;

  const ordenarPor = (a, b, campo, asc) => {
    let va = '', vb = '';
    switch (campo) {
      case 'nombre': va = getNombreCuota(a); vb = getNombreCuota(b); break;
      case 'domicilio': va = getDomicilioCuota(a); vb = getDomicilioCuota(b); break;
      case 'dni': va = String(getDocumentoCuota(a)); vb = String(getDocumentoCuota(b)); break;
      default: va = getNombreCuota(a); vb = getNombreCuota(b);
    }
    return asc ? va.localeCompare(vb) : vb.localeCompare(va);
  };

  const cuotasFiltradas = useMemo(() => {
    if (!mesSeleccionado && !soloCobrador) return [];

    let lista = cuotas
      .filter(coincideEstadoPago)
      .filter(coincideBusquedaLibre)
      .filter(coincideCategoria)
      .filter(coincideDivision)
      .filter(coincideAnioLectivo)
      .filter(c => (soloCobrador ? true : coincideMes(c)));

    if (soloCobrador) {
      lista = deduplicarPorAlumno(lista);
    }

    return lista.sort((a, b) => ordenarPor(a, b, orden.campo, orden.ascendente));
  }, [
    cuotas,
    busqueda,
    categoriaSeleccionada,
    divisionSeleccionada,
    anioLectivoSeleccionado,
    mesSeleccionado,
    estadoPagoSeleccionado,
    orden,
    soloCobrador,
    deduplicarPorAlumno
  ]);

  const contarConFiltros = useCallback((estadoPago) => {
    let lista = cuotas.filter((c) =>
      (soloCobrador ? true : String(getIdMesFromCuota(c)) === String(mesSeleccionado || '')) &&
      (!busqueda || coincideBusquedaLibre(c)) &&
      coincideCategoria(c) &&
      coincideDivision(c) &&
      coincideAnioLectivo(c) &&
      (String(c?.estado_pago ?? '').toLowerCase().trim() === String(estadoPago).toLowerCase().trim())
    );

    if (soloCobrador) {
      lista = deduplicarPorAlumno(lista);
    }

    return lista.length;
  }, [
    cuotas,
    soloCobrador,
    mesSeleccionado,
    busqueda,
    categoriaSeleccionada,
    divisionSeleccionada,
    anioLectivoSeleccionado,
    deduplicarPorAlumno
  ]);

  const cantidadFiltradaDeudores   = useMemo(() => (mesSeleccionado || soloCobrador) ? contarConFiltros('deudor')    : 0, [mesSeleccionado, soloCobrador, contarConFiltros]);
  const cantidadFiltradaPagados    = useMemo(() => (mesSeleccionado || soloCobrador) ? contarConFiltros('pagado')    : 0, [mesSeleccionado, soloCobrador, contarConFiltros]);
  const cantidadFiltradaCondonados = useMemo(() => (mesSeleccionado || soloCobrador) ? contarConFiltros('condonado') : 0, [mesSeleccionado, soloCobrador, contarConFiltros]);

  const imprimirTodosDisabled =
    !canPrint ||
    loadingPrint ||
    (!mesSeleccionado && !soloCobrador) ||
    cuotasFiltradas.length === 0 ||
    loading ||
    !categoriaSeleccionada;

  const imprimirTodosTitle = !canPrint
    ? (soloCobrador ? 'Activá "Solo cobrador" para imprimir' : 'Disponible solo en Pagados')
    : (categoriaSeleccionada ? 'Imprimir' : 'Seleccioná categoría: Interno o Externo');

  const toggleOrden = useCallback((campo) => {
    setOrden(prev => ({ campo, ascendente: prev.campo === campo ? !prev.ascendente : true }));
    triggerCascade();
  }, [triggerCascade]);

  const fetchMontoCategoria = useCallback(async (idAlumno, familyCount = 1) => {
    const key = `${idAlumno}::${familyCount}`;
    if (!idAlumno) return null;
    if (cacheMontoCategoriaRef.current.has(key)) return cacheMontoCategoriaRef.current.get(key);

    try {
      const url = `${BASE_URL}/api.php?action=obtener_monto_categoria&id_alumno=${encodeURIComponent(String(idAlumno))}&family_count=${encodeURIComponent(String(familyCount))}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`obtener_monto_categoria HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));

      const out = {
        exito: !!data?.exito,
        monto_mensual: parseMonto(data?.monto_mensual ?? data?.monto ?? data?.precio ?? data?.Precio_Categoria),
        monto_anual: parseMonto(data?.monto_anual),
        categoria_nombre: String(data?.categoria_nombre ?? data?.nombre_categoria ?? data?.nombre ?? '').toUpperCase(),
      };

      cacheMontoCategoriaRef.current.set(key, out);
      return out;
    } catch (e) {
      console.error('fetchMontoCategoria error:', e);
      const out = { exito: false, monto_mensual: 0, monto_anual: 0, categoria_nombre: '' };
      cacheMontoCategoriaRef.current.set(key, out);
      return out;
    }
  }, []);

  const fetchFamilia = useCallback(async (idAlumno) => {
    const key = String(idAlumno);
    if (!key) return null;
    if (cacheFamiliaRef.current.has(key)) return cacheFamiliaRef.current.get(key);

    try {
      const url = `${BASE_URL}/api.php?action=obtener_info_familia&id_alumno=${encodeURIComponent(key)}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`obtener_info_familia HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));

      const out = {
        exito: !!data?.exito,
        tiene_familia: !!data?.tiene_familia,
        miembros_total: Number(data?.miembros_total || 0),
        miembros_activos: Number(data?.miembros_activos || 0),
      };

      cacheFamiliaRef.current.set(key, out);
      return out;
    } catch (e) {
      console.error('fetchFamilia error:', e);
      const out = { exito: false, tiene_familia: false, miembros_total: 0, miembros_activos: 0 };
      cacheFamiliaRef.current.set(key, out);
      return out;
    }
  }, []);

  const getPeriodoImpresion = useCallback((cuota, overrideMesId = null) => {
    const anio = Number(anioPagoSeleccionado) || CURRENT_YEAR;

    const idMesCuota = Number(getIdMesFromCuota(cuota));
    const idMesSel = Number(overrideMesId || mesSeleccionado);

    const esEspecial = [ID_MES_ANUAL, ID_MES_1ER_MITAD, ID_MES_2DA_MITAD].includes(idMesCuota);
    const origenAnual = Number(cuota?.origen_anual || 0) === 1;

    let idMesImprimir = idMesSel || idMesCuota || 0;

    if (overrideMesId) {
      idMesImprimir = Number(overrideMesId);
    } else if (esEspecial) {
      idMesImprimir = idMesCuota;
    } else if (origenAnual) {
      idMesImprimir = ID_MES_ANUAL;
    } else if (idMesCuota > 0) {
      idMesImprimir = idMesCuota;
    }

    let periodoTexto = `${getNombreMes(idMesImprimir)} ${anio}`;

    if (idMesImprimir === ID_MES_ANUAL) periodoTexto = `CONTADO ANUAL ${anio}`;
    if (idMesImprimir === ID_MES_1ER_MITAD) periodoTexto = `1ER MITAD ${anio}`;
    if (idMesImprimir === ID_MES_2DA_MITAD) periodoTexto = `2DA MITAD ${anio}`;

    return { idMesImprimir, periodoTexto, anio };
  }, [anioPagoSeleccionado, mesSeleccionado, getNombreMes]);

  const buildAlumnoParaImprimir = useCallback(async (cuota, overrideMesId = null) => {
    const idAlumno = getIdAlumnoFromCuota(cuota);
    const { idMesImprimir, periodoTexto, anio } = getPeriodoImpresion(cuota, overrideMesId);

    const catFallback = (getNombreCategoria(cuota?.id_categoria) || '').toUpperCase();

    const fam = await fetchFamilia(idAlumno);
    const mA = Number(fam?.miembros_activos || 0);
    const mT = Number(fam?.miembros_total || 0);
    const baseFam = Math.max(mA, mT, 0);
    const familyCount = (fam?.tiene_familia) ? Math.max(1, baseFam) : 1;

    const mCat = await fetchMontoCategoria(idAlumno, familyCount);
    const categoriaNombre = (mCat?.categoria_nombre || catFallback || '').toUpperCase();

    const porc = getPorcDescuentoDerivado(categoriaNombre, familyCount);

    const mensualBase = Number(mCat?.monto_mensual || 0);
    const anualBase   = Number(mCat?.monto_anual || 0);
    let precio = 0;

    if (idMesImprimir === ID_MES_ANUAL) {
      const base = anualBase > 0 ? anualBase : (mensualBase * 12);
      precio = Math.max(0, Math.round(base * (1 - porc)));
    } else if (idMesImprimir === ID_MES_1ER_MITAD || idMesImprimir === ID_MES_2DA_MITAD) {
      const base = anualBase > 0 ? (anualBase / 2) : (mensualBase * 6);
      precio = Math.max(0, Math.round(base * (1 - porc)));
    } else {
      precio = Math.max(0, Math.round(mensualBase * (1 - porc)));
    }

    return {
      ...cuota,
      id_alumno: idAlumno,

      periodos: [idMesImprimir],
      extras_periodos: [],
      periodos_completos: [idMesImprimir],
      cantidad_meses: 1,
      id_periodo: idMesImprimir,
      periodo_texto: periodoTexto,

      anio,
      categoria_nombre: categoriaNombre,

      precio_unitario: precio,
      importe_total: precio,
      precio_total: precio,

      meta_descuento_hermanos: {
        familia: familyCount,
        categoria: categoriaNombre,
        porcentaje: porc,
      },
    };
  }, [
    fetchFamilia,
    fetchMontoCategoria,
    getNombreCategoria,
    getPeriodoImpresion,
  ]);

  const buildAlumnoCuponesCobrador = useCallback(async (cuota) => {
    const mesesClub = getMesesClubOrdenados();
    const cupones = [];

    for (const mes of mesesClub) {
      const alumnoMes = await buildAlumnoParaImprimir(cuota, mes.id);
      cupones.push(alumnoMes);
    }

    return cupones;
  }, [buildAlumnoParaImprimir, getMesesClubOrdenados]);

  const imprimirUnoDirecto = useCallback(async (cuota) => {
    try {
      if (!cuota) return;
      if (!mesSeleccionado && !soloCobrador) return;

      setLoadingPrint(true);

      const nombreCat = getNombreCategoria(cuota?.id_categoria);
      const isExterno = normalizar(nombreCat) === 'externo';

      const w = window.open('', '_blank');
      if (!w) {
        alert('Deshabilite el bloqueador de popups para imprimir');
        return;
      }

      if (soloCobrador) {
        const alumnoCupones = await buildAlumnoCuponesCobrador(cuota);
        const mesesClub = getMesesClubOrdenados();
        const primerMes = mesesClub[0]?.id || 1;

        if (isExterno) {
          await imprimirRecibosExternos(alumnoCupones, primerMes, w, { anioPago: anioPagoSeleccionado, modoCobrador: true });
        } else {
          await imprimirRecibos(alumnoCupones, primerMes, w, { anioPago: anioPagoSeleccionado, modoCobrador: true });
        }
      } else {
        const alumno = await buildAlumnoParaImprimir(cuota);
        const { idMesImprimir } = getPeriodoImpresion(cuota);

        if (isExterno) {
          await imprimirRecibosExternos([alumno], idMesImprimir, w, { anioPago: anioPagoSeleccionado });
        } else {
          await imprimirRecibos([alumno], idMesImprimir, w, { anioPago: anioPagoSeleccionado });
        }
      }
    } catch (e) {
      console.error('imprimirUnoDirecto error:', e);
      setToastTipo('error');
      setToastMensaje('Error al imprimir. Revisá consola.');
      setToastVisible(true);
    } finally {
      setLoadingPrint(false);
    }
  }, [
    mesSeleccionado,
    soloCobrador,
    anioPagoSeleccionado,
    buildAlumnoParaImprimir,
    buildAlumnoCuponesCobrador,
    getNombreCategoria,
    getPeriodoImpresion,
    getMesesClubOrdenados,
  ]);

  const handleImprimirTodos = async () => {
    if (!canPrint) {
      setToastTipo('advertencia');
      setToastMensaje(soloCobrador
        ? 'Activá "Solo cobrador" para imprimir desde cualquier pestaña.'
        : 'La impresión está disponible únicamente en la pestaña de Pagados.');
      setToastVisible(true);
      return;
    }

    if (!categoriaSeleccionada) {
      setToastTipo('advertencia');
      setToastMensaje('Seleccioná una categoría (Interno o Externo) para habilitar la impresión.');
      setToastVisible(true);
      return;
    }

    if ((!mesSeleccionado && !soloCobrador) || cuotasFiltradas.length === 0) return;

    setLoadingPrint(true);
    try {
      const getCatNombreDeCuota = (c) => (categorias.find(x => String(x.id) === String(c?.id_categoria))?.nombre) || '';
      const internosRaw = [];
      const externosRaw = [];

      for (const c of cuotasFiltradas) {
        const tipo = normalizar(getCatNombreDeCuota(c));
        if (tipo === 'externo') externosRaw.push(c);
        else internosRaw.push(c);
      }

      const CONCURRENCY = 8;

      if (soloCobrador) {
        const internosNested = await asyncPool(CONCURRENCY, internosRaw, buildAlumnoCuponesCobrador);
        const externosNested = await asyncPool(CONCURRENCY, externosRaw, buildAlumnoCuponesCobrador);

        const internos = internosNested.flat();
        const externos = externosNested.flat();

        const mesesClub = getMesesClubOrdenados();
        const primerMes = mesesClub[0]?.id || 1;

        if (internos.length) {
          const w1 = window.open('', '_blank');
          if (!w1) { alert('Deshabilite el bloqueador de popups para imprimir'); return; }
          await imprimirRecibos(internos, primerMes, w1, { anioPago: anioPagoSeleccionado, modoCobrador: true });
        }

        if (externos.length) {
          const w2 = window.open('', '_blank');
          if (!w2) { alert('Deshabilite el bloqueador de popups para imprimir'); return; }
          await imprimirRecibosExternos(externos, primerMes, w2, { anioPago: anioPagoSeleccionado, modoCobrador: true });
        }

        setToastTipo('exito');
        setToastMensaje('Impresión de cobrador generada: 1 cupón por mes (enero a diciembre) por socio.');
        setToastVisible(true);
        return;
      }

      const internos = await asyncPool(CONCURRENCY, internosRaw, buildAlumnoParaImprimir);
      const externos = await asyncPool(CONCURRENCY, externosRaw, buildAlumnoParaImprimir);

      if (internos.length) {
        const w1 = window.open('', '_blank');
        if (!w1) { alert('Deshabilite el bloqueador de popups para imprimir'); return; }
        await imprimirRecibos(internos, mesSeleccionado, w1, { anioPago: anioPagoSeleccionado });
      }
      if (externos.length) {
        const w2 = window.open('', '_blank');
        if (!w2) { alert('Deshabilite el bloqueador de popups para imprimir'); return; }
        await imprimirRecibosExternos(externos, mesSeleccionado, w2, { anioPago: anioPagoSeleccionado });
      }

      setToastTipo('exito');
      setToastMensaje('Impresión generada con montos reales por socio (incluye descuentos).');
      setToastVisible(true);
    } catch (e) {
      console.error('Error al imprimir:', e);
      setToastTipo('error');
      setToastMensaje('Error al imprimir. Revisá consola.');
      setToastVisible(true);
    } finally {
      setLoadingPrint(false);
    }
  };

  const handleRowClick = useCallback((index) => {
    if (cascadeActive) return;
    if (typeof index === 'number' && index >= 0) {
      setSelectedRow(prev => (prev === index ? null : index));
      selectedRowRef.current = index;
    }
  }, [cascadeActive]);

  const handlePaymentClick = useCallback((item) => { setSocioParaPagar(item); setMostrarModalPagos(true); }, []);
  const handleDeletePaymentClick = useCallback((item) => { setSocioParaPagar(item); setMostrarModalEliminarPago(true); }, []);
  const handleDeleteCondClick = useCallback((item) => { setSocioParaPagar(item); setMostrarModalEliminarCond(true); }, []);

  const handlePrintClick = useCallback(async (item) => {
    if (!canPrint) {
      setToastTipo('advertencia');
      setToastMensaje(soloCobrador
        ? 'Activá "Solo cobrador" para imprimir desde cualquier pestaña.'
        : 'La impresión está disponible únicamente en la pestaña de Pagados.');
      setToastVisible(true);
      return;
    }

    if (estadoPagoSeleccionado === 'pagado' || soloCobrador) {
      await imprimirUnoDirecto(item);
      return;
    }

    setSocioParaImprimir(item);
    setMostrarModalMesCuotas(true);
  }, [canPrint, soloCobrador, estadoPagoSeleccionado, imprimirUnoDirecto]);

  const handleExportExcel = useCallback(() => {
    if (!mesSeleccionado && !soloCobrador) {
      setToastTipo('advertencia');
      setToastMensaje('Seleccione mes');
      setToastVisible(true);
      return;
    }

    if (loading) {
      setToastTipo('advertencia');
      setToastMensaje('Esperando datos...');
      setToastVisible(true);
      return;
    }

    if (!Array.isArray(cuotasFiltradas) || cuotasFiltradas.length === 0) {
      setToastTipo('advertencia');
      setToastMensaje('No hay datos para exportar');
      setToastVisible(true);
      return;
    }

    try {
      // IMPORTANTE:
      // Antes se generaba HTML con extensión .xls. Excel lo abría, pero mostraba
      // el aviso "el formato y la extensión no coinciden" porque no era un XLS real.
      // CSV con BOM + separador ; abre directo en Excel sin ese aviso.
      const escapeCsv = (value) => {
        const text = String(value ?? '').replace(/\r?\n|\r/g, ' ').trim();
        const escaped = text.replace(/"/g, '""');
        return '"' + escaped + '"';
      };

      const periodoTexto = soloCobrador
        ? 'Cobrador - Marzo a Diciembre'
        : getNombreMes(mesSeleccionado);

      const estadoTexto = String(estadoPagoSeleccionado || '')
        .charAt(0)
        .toUpperCase() + String(estadoPagoSeleccionado || '').slice(1);

      const headers = [
        'Socio',
        'DNI',
        'Domicilio',
        'Categoría',
        'Estado',
        'Período',
        'Año de pago',
      ];

      const rows = cuotasFiltradas.map((cuota) => [
        getNombreCuota(cuota),
        getDocumentoCuota(cuota),
        getDomicilioCuota(cuota),
        getNombreCategoria(cuota?.id_categoria) || '',
        estadoTexto,
        periodoTexto,
        anioPagoSeleccionado || CURRENT_YEAR,
      ]);

      const csvLines = [
        headers.map(escapeCsv).join(';'),
        ...rows.map((row) => row.map(escapeCsv).join(';')),
      ];

      const csvContent = csvLines.join('\r\n');
      const blob = new Blob(['\ufeff', csvContent], {
        type: 'text/csv;charset=utf-8;',
      });

      const fecha = new Date().toISOString().slice(0, 10);
      const periodoArchivo = normalizar(periodoTexto)
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'cuotas';
      const estadoArchivo = normalizar(estadoPagoSeleccionado || 'cuotas')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'cuotas';

      const filename = `cuotas_${estadoArchivo}_${periodoArchivo}_${fecha}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setToastTipo('exito');
      setToastMensaje(`Excel exportado correctamente (${cuotasFiltradas.length} registros)`);
      setToastVisible(true);
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      setToastTipo('error');
      setToastMensaje('No se pudo exportar el Excel. Revisá consola.');
      setToastVisible(true);
    }
  }, [
    mesSeleccionado,
    soloCobrador,
    loading,
    cuotasFiltradas,
    estadoPagoSeleccionado,
    anioPagoSeleccionado,
    getNombreMes,
  ]);

  const onChangeMes        = (e) => { setMesSeleccionado(e.target.value); triggerCascade(); };
  const onChangeAnioPago   = (e) => { setAnioPagoSeleccionado(e.target.value); triggerCascade(); };
  const onChangeCategoria  = (e) => { setCategoriaSeleccionada(e.target.value); triggerCascade(); };
  const onChangeDivision   = (e) => { setDivisionSeleccionada(e.target.value); triggerCascade(); };
  const onChangeAnioLect   = (e) => { setAnioLectivoSeleccionado(e.target.value); triggerCascade(); };
  const onChangeBusqueda   = (e) => { setBusqueda(e.target.value); triggerCascade(); };

  const onToggleSoloCobrador = () => {
    setSoloCobrador(prev => {
      const next = !prev;

      if (next) {
        setEstadoPagoSeleccionado('deudor');

        const externoId = getCategoriaExternoId();
        if (externoId) {
          setCategoriaSeleccionada(externoId);
        }
      }

      return next;
    });

    triggerCascade();
  };

  const handleListScroll = useCallback(({ scrollOffset }) => {
    scrollOffsetRef.current = scrollOffset;
  }, []);

  const Row = ({ index, style, data }) => {
    const cuota = data[index];
    const isSelected = selectedRow === index;

    const nombreDiv  = getNombreDivision(cuota?.id_division);
    const nombreCat  = getNombreCategoria(cuota?.id_categoria);
    const tipoCat    = normalizar(nombreCat);
    const isInterno  = tipoCat === 'interno';
    const isExterno  = tipoCat === 'externo';

    const cascadeClass = cascadeActive && index < 25 ? `gcuotas-cascade gcuotas-cascade-${index}` : '';
    const zebraClass   = index % 2 === 0 ? 'gcuotas-row-even' : 'gcuotas-row-odd';

    const actionButtons = (
      <div className="gcuotas-actions-inline">
        {canPrint && (
          <button
            className="gcuotas-action-button gcuotas-print-button"
            onClick={(e) => { e.stopPropagation(); handlePrintClick(cuota); }}
            title="Imprimir"
            disabled={loadingPrint}
          >
            <FontAwesomeIcon icon={faPrint} />
          </button>
        )}

        {estadoPagoSeleccionado === 'deudor' ? (
          <button
            className="gcuotas-action-button gcuotas-payment-button"
            onClick={(e) => { e.stopPropagation(); handlePaymentClick(cuota); }}
            title="Registrar pago / Condonar"
          >
            <FontAwesomeIcon icon={faDollarSign} />
          </button>
        ) : estadoPagoSeleccionado === 'pagado' ? (
          <button
            className="gcuotas-action-button gcuotas-deletepay-button"
            onClick={(e) => { e.stopPropagation(); handleDeletePaymentClick(cuota); }}
            title="Eliminar pago"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        ) : (
          <button
            className="gcuotas-action-button gcuotas-deletepay-button"
            onClick={(e) => { e.stopPropagation(); handleDeleteCondClick(cuota); }}
            title="Eliminar condonación"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        )}
      </div>
    );

    if (isMobile) {
      return (
        <div
          style={style}
          className={`gcuotas-mobile-card ${cascadeClass} ${isSelected ? "gcuotas-selected-card" : ""}`}
          onClick={() => { if (!cascadeActive) handleRowClick(index); }}
        >
          <div className="gcuotas-mobile-row">
            <span className="gcuotas-mobile-label">Socio:</span>
            <span>{getNombreCuota(cuota)}</span>
          </div>
          <div className="gcuotas-mobile-row">
            <span className="gcuotas-mobile-label">DNI:</span>
            <span>{getDocumentoCuota(cuota) || '—'}</span>
          </div>
          <div className="gcuotas-mobile-row">
            <span className="gcuotas-mobile-label">Domicilio:</span>
            <span>{getDomicilioCuota(cuota) || '—'}</span>
          </div>
          <div className="gcuotas-mobile-row">
            <span className="gcuotas-mobile-label">Categoría:</span>
            <span>
              <span
                className={`gcuotas-chip ${
                  isInterno ? 'gcuotas-chip--interno'
                  : isExterno ? 'gcuotas-chip--externo'
                  : 'gcuotas-chip--default'
                }`}
              >
                {nombreCat || '—'}
              </span>
            </span>
          </div>

          <div className="gcuotas-mobile-actions">
            {canPrint && (
              <button
                className="gcuotas-mobile-print-button"
                onClick={(e) => { e.stopPropagation(); handlePrintClick(cuota); }}
                disabled={loadingPrint}
              >
                <FontAwesomeIcon icon={faPrint} /><span>Imprimir</span>
              </button>
            )}

            {estadoPagoSeleccionado === 'deudor' ? (
              <button
                className="gcuotas-mobile-payment-button"
                onClick={(e) => { e.stopPropagation(); handlePaymentClick(cuota); }}
              >
                <FontAwesomeIcon icon={faDollarSign} /><span>Pagar</span>
              </button>
            ) : estadoPagoSeleccionado === 'pagado' ? (
              <button
                className="gcuotas-mobile-deletepay-button"
                onClick={(e) => { e.stopPropagation(); handleDeletePaymentClick(cuota); }}
              >
                <FontAwesomeIcon icon={faTimes} /><span>Eliminar</span>
              </button>
            ) : (
              <button
                className="gcuotas-mobile-deletepay-button"
                onClick={(e) => { e.stopPropagation(); handleDeleteCondClick(cuota); }}
              >
                <FontAwesomeIcon icon={faTimes} /><span>Eliminar</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        style={style}
        className={`gcuotas-virtual-row ${zebraClass} ${cascadeClass} ${isSelected ? "gcuotas-selected-row" : ""}`}
        onClick={() => { if (!cascadeActive) handleRowClick(index); }}
      >
        <div className="gcuotas-virtual-cell">{getNombreCuota(cuota)}</div>
        <div className="gcuotas-virtual-cell">{getDocumentoCuota(cuota) || '—'}</div>
        <div className="gcuotas-virtual-cell">{getDomicilioCuota(cuota) || '—'}</div>
        <div className="gcuotas-virtual-cell">
          <span
            className={`gcuotas-chip ${
              isInterno ? 'gcuotas-chip--interno'
              : isExterno ? 'gcuotas-chip--externo'
              : 'gcuotas-chip--default'
            }`}
          >
            {getNombreCategoria(cuota?.id_categoria) || '—'}
          </span>
        </div>
        <div className="gcuotas-virtual-cell gcuotas-virtual-actions">{actionButtons}</div>
      </div>
    );
  };

  const LoadingIndicator = () => (
    <div className="gcuotas-loading-container">
      <div className="gcuotas-loading-spinner"></div>
      <p>Cargando datos...</p>
    </div>
  );

  const NoMonthSelected  = () => (
    <div className="gcuotas-info-message">
      <FontAwesomeIcon icon={faCalendarAlt} size="3x" />
      <p>Por favor seleccione un mes para ver los datos</p>
    </div>
  );

  const NoDataFound      = () => (
    <div className="gcuotas-info-message">
      <FontAwesomeIcon icon={faExclamationTriangle} size="3x" />
      <p>No se encontraron datos para los filtros seleccionados</p>
    </div>
  );

  const resyncAll = useCallback(async () => {
    await fetchAniosPago();
    await obtenerCuotasYListas();
    triggerCascade();
  }, [fetchAniosPago, obtenerCuotasYListas, triggerCascade]);

  return (
    <div className={`gcuotas-container gcuotas--table-fullwidth ${cascadeActive ? 'gcuotas-cascading' : ''}`}>
      {toastVisible && (
        <Toast
          tipo={toastTipo}
          mensaje={toastMensaje}
          onClose={() => setToastVisible(false)}
          duracion={3000}
        />
      )}

      {mostrarModalPagos && (
        <ModalPagos
          socio={socioParaPagar}
          onClose={async (ok, payload) => {
            setMostrarModalPagos(false);

            if (ok && payload?.idAlumno && Array.isArray(payload?.periodos) && payload?.estado) {
              patchCuotasAfterAccion(payload);
            }

            await resyncAll();
          }}
        />
      )}

      {mostrarModalCodigoBarras && (
        <ModalCodigoBarras
          onClose={async () => {
            setMostrarModalCodigoBarras(false);
            await resyncAll();
          }}
          periodo={getNombreMes(mesSeleccionado)}
          periodoId={mesSeleccionado}
          onPagoRealizado={resyncAll}
        />
      )}

      {mostrarModalEliminarPago && (
        <ModalEliminarPago
          socio={socioParaPagar}
          periodoId={Number(mesSeleccionado)}
          periodoNombre={getNombreMes(mesSeleccionado)}
          anioPago={anioPagoSeleccionado}
          onClose={() => setMostrarModalEliminarPago(false)}
          onEliminado={async () => {
            const idAlumno = socioParaPagar?.id_alumno ?? socioParaPagar?.id_socio ?? socioParaPagar?.id;
            const mes = Number(mesSeleccionado);
            if (idAlumno && mes) patchCuotasAfterAccion({ idAlumno, periodos: [mes], estado: 'deudor' });

            await resyncAll();
          }}
        />
      )}

      {mostrarModalEliminarCond && (
        <ModalEliminarCondonacion
          socio={socioParaPagar}
          periodo={Number(mesSeleccionado)}
          periodoTexto={getNombreMes(mesSeleccionado)}
          onClose={() => setMostrarModalEliminarCond(false)}
          onEliminado={async () => {
            const idAlumno = socioParaPagar?.id_alumno ?? socioParaPagar?.id_socio ?? socioParaPagar?.id;
            const mes = Number(mesSeleccionado);
            if (idAlumno && mes) patchCuotasAfterAccion({ idAlumno, periodos: [mes], estado: 'deudor' });

            await resyncAll();
          }}
        />
      )}

      {canPrint && mostrarModalMesCuotas && socioParaImprimir && !soloCobrador && (
        <ModalMesCuotas
          socio={socioParaImprimir}
          meses={meses}
          anio={Number(anioPagoSeleccionado) || new Date().getFullYear()}
          esExterno={normalizar(getNombreCategoria(socioParaImprimir?.id_categoria)) === 'externo'}
          onClose={() => { setMostrarModalMesCuotas(false); setSocioParaImprimir(null); }}
        />
      )}

      <div className="gcuotas-left-section gcuotas-box">
        <div className="gcuotas-header-section">
          <h2 className="gcuotas-title">
            <FontAwesomeIcon icon={faMoneyCheckAlt} className="gcuotas-title-icon" />
            Gestión de Cuotas
          </h2>
        </div>

        <div className="gcuotas-scrollable-content">
          <div className="gcuotas-top-section">
            <div className="gcuotas-filter-card">
              <div className="gcuotas-filter-header">
                <div className="gcuotas-filter-header-left">
                  <FontAwesomeIcon icon={faFilter} className="gcuotas-filter-icon" />
                  <span>Filtros</span>
                </div>

                <button
                  className={`gcuotas-button gcuotas-button-print-all gcuotas-filter-print-compact ${loadingPrint ? 'gcuotas-button-loading' : ''}`}
                  onClick={handleImprimirTodos}
                  disabled={imprimirTodosDisabled}
                  title={imprimirTodosTitle}
                >
                  <FontAwesomeIcon icon={faPrint} /><span>{loadingPrint ? 'Generando...' : 'Imprimir'}</span>
                </button>
              </div>

              <div className="gcuotas-select-container">
                <div className="gcuotas-input-row">
                  <div className="gcuotas-input-group">
                    <div className="fl-field">
                      <select
                        id="anioPago"
                        value={anioPagoSeleccionado}
                        onChange={onChangeAnioPago}
                        className="fl-control fl-select"
                        disabled={loading || aniosPago.length === 0}
                      >
                        {aniosPago.length === 0 ? (
                          <option value="">Sin pagos</option>
                        ) : (
                          aniosPago.map((a, idx) => (
                            <option key={idx} value={a.id}>{a.nombre}</option>
                          ))
                        )}
                      </select>
                      <label htmlFor="anioPago" className="fl-label">Año</label>
                    </div>
                  </div>

                  <div className="gcuotas-input-group">
                    <div className="fl-field">
                      <select
                        id="meses"
                        value={mesSeleccionado}
                        onChange={onChangeMes}
                        className="fl-control fl-select"
                        disabled={loading}
                      >
                        <option value="">Mes</option>
                        {meses.map((mes, idx) => (
                          <option key={idx} value={mes.id}>{mes.nombre}</option>
                        ))}
                      </select>
                      <label htmlFor="meses" className="fl-label">Mes</label>
                    </div>
                  </div>
                </div>

                <div className="gcuotas-input-row gcuotas-input-row-categoria-cobrador">
                  <div className="gcuotas-input-group">
                    <div className="fl-field">
                      <select
                        id="categoria"
                        value={categoriaSeleccionada}
                        onChange={onChangeCategoria}
                        className="fl-control fl-select"
                        disabled={loading}
                      >
                        <option value="">Todas</option>
                        {categorias.map((c, idx) => (
                          <option key={idx} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                      <label htmlFor="categoria" className="fl-label">Categoría</label>
                    </div>
                  </div>

                  <div className="gcuotas-input-group">
                    <label className="gcuotas-input-label">
                      <FontAwesomeIcon icon={faFilter} /> Cobrador
                    </label>
                    <button
                      type="button"
                      onClick={onToggleSoloCobrador}
                      className={`gcuotas-button gcuotas-button-cobrador ${
                        soloCobrador ? "gcuotas-button-print-all" : "gcuotas-button-export"
                      }`}
                      disabled={loading}
                      title="Filtrar socios marcados como cobrador"
                    >
                      {soloCobrador ? "ACTIVADO" : "Desactivado"}
                    </button>
                  </div>
                </div>

              </div>
            </div>

            <div className="gcuotas-tabs-card">
              <div className="gcuotas-tabs-header">
                <FontAwesomeIcon icon={faList} className="gcuotas-tabs-icon" />
                <span>Estado de cuotas</span>
              </div>
              <div className="gcuotas-tab-container">
                <button
                  className={`gcuotas-tab-button ${estadoPagoSeleccionado === 'deudor' ? "gcuotas-active-tab" : ""}`}
                  onClick={() => setEstadoPagoSeleccionado('deudor')}
                  disabled={loading}
                  title="Deudores"
                >
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <span className="gcuotas-tab-badge">{cantidadFiltradaDeudores}</span>
                </button>
                <button
                  className={`gcuotas-tab-button ${estadoPagoSeleccionado === 'pagado' ? "gcuotas-active-tab" : ""}`}
                  onClick={() => setEstadoPagoSeleccionado('pagado')}
                  disabled={loading}
                  title="Pagados"
                >
                  <FontAwesomeIcon icon={faCheckCircle} />
                  <span className="gcuotas-tab-badge">{cantidadFiltradaPagados}</span>
                </button>
                <button
                  className={`gcuotas-tab-button ${estadoPagoSeleccionado === 'condonado' ? "gcuotas-active-tab" : ""}`}
                  onClick={() => setEstadoPagoSeleccionado('condonado')}
                  disabled={loading}
                  title="Condonados"
                >
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <span className="gcuotas-tab-badge">{cantidadFiltradaCondonados}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="gcuotas-actions-card">
            <div className="gcuotas-actions-header">
              <FontAwesomeIcon icon={faCog} className="gcuotas-actions-icon" />
              <span>Acciones</span>
            </div>
            <div className="gcuotas-buttons-container">
              <button
                className="gcuotas-button gcuotas-button-back"
                onClick={() => navigate('/panel')}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faArrowLeft} /><span>Volver</span>
              </button>

              <button
                className="gcuotas-button gcuotas-button-export"
                onClick={handleExportExcel}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faFileExcel} /><span>Excel</span>
              </button>

              <button
                className={`gcuotas-button gcuotas-button-print-all gcuotas-actions-print-desktop ${loadingPrint ? 'gcuotas-button-loading' : ''}`}
                onClick={handleImprimirTodos}
                disabled={imprimirTodosDisabled}
                title={imprimirTodosTitle}
              >
                <FontAwesomeIcon icon={faPrint} /><span>{loadingPrint ? 'Generando...' : 'Imprimir'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`gcuotas-right-section gcuotas-box ${isMobile ? 'gcuotas-has-bottombar' : ''}`}>
        <div className="gcuotas-table-header">
          <h3>
            <FontAwesomeIcon icon={estadoPagoSeleccionado === 'pagado' ? faCheckCircle : faExclamationTriangle} />
            {estadoPagoSeleccionado === 'pagado'
              ? 'Cuotas Pagadas'
              : estadoPagoSeleccionado === 'condonado'
                ? 'Cuotas Condonadas'
                : 'Cuotas Pendientes'}
            {soloCobrador
              ? (<span className="gcuotas-periodo-seleccionado"> - Cobrador (Marzo a Diciembre)</span>)
              : mesSeleccionado
                ? (<span className="gcuotas-periodo-seleccionado"> - {getNombreMes(mesSeleccionado)}</span>)
                : null}
          </h3>

          <div className="gcuotas-input-group gcuotas-search-group">
            <div className="fl-field fl-field--float">
              <FontAwesomeIcon icon={faSearch} className="gcuotas-search-icon" />
              <input
                id="buscarAlumno"
                type="text"
                value={busqueda}
                onChange={onChangeBusqueda}
                disabled={loading || (!mesSeleccionado && !soloCobrador)}
                className="fl-control fl-search"
                placeholder=" "
                autoComplete="off"
              />
              <label htmlFor="buscarAlumno" className="fl-label">Buscar socio</label>
            </div>
          </div>

          <div className="gcuotas-summary-info">
            <span className="gcuotas-summary-item">
              <FontAwesomeIcon icon={faUsers} /> Total: {(mesSeleccionado || soloCobrador) ? cuotasFiltradas.length : 0}
            </span>
          </div>
        </div>

        <div className="gcuotas-table-container">
          {loading ? <LoadingIndicator /> :
            (!mesSeleccionado && !soloCobrador) ? <NoMonthSelected /> :
              cuotasFiltradas.length === 0 ? <NoDataFound /> :
                isMobile ? (
                  <div className="gcuotas-mobile-list">
                    {cuotasFiltradas.map((item, index) => (
                      <Row key={`${cascadeRunId}-${getAlumnoUniqueKey(item)}-${index}`} index={index} style={{}} data={cuotasFiltradas} />
                    ))}
                  </div>
                ) : (
                  <div className="gcuotas-virtual-tables" style={{ height: "80vh" }}>
                    <div className="gcuotas-virtual-header">
                      <div className="gcuotas-virtual-cell" onClick={() => toggleOrden('nombre')}>
                        Socio <FontAwesomeIcon icon={faSort} className={`gcuotas-sort-icon ${orden.campo === 'nombre' ? 'gcuotas-sort-active' : ''}`} />
                        {orden.campo === 'nombre' && (orden.ascendente ? ' ↑' : ' ↓')}
                      </div>
                      <div className="gcuotas-virtual-cell" onClick={() => toggleOrden('dni')}>
                        DNI <FontAwesomeIcon icon={faSort} className={`gcuotas-sort-icon ${orden.campo === 'dni' ? 'gcuotas-sort-active' : ''}`} />
                        {orden.campo === 'dni' && (orden.ascendente ? ' ↑' : ' ↓')}
                      </div>
                      <div className="gcuotas-virtual-cell" onClick={() => toggleOrden('domicilio')}>
                        Domicilio <FontAwesomeIcon icon={faSort} className={`gcuotas-sort-icon ${orden.campo === 'domicilio' ? 'gcuotas-sort-active' : ''}`} />
                        {orden.campo === 'domicilio' && (orden.ascendente ? ' ↑' : ' ↓')}
                      </div>
                      <div className="gcuotas-virtual-cell">Categoría</div>
                      <div className="gcuotas-virtual-cell">Acciones</div>
                    </div>

                    <AutoSizer>
                      {({ height, width }) => (
                        <List
                          key={`list-${cascadeRunId}`}
                          ref={listRef}
                          height={height}
                          itemCount={cuotasFiltradas.length}
                          itemSize={45}
                          width={width}
                          itemData={cuotasFiltradas}
                          className="gcuotas-listoverflow"
                          onScroll={handleListScroll}
                          initialScrollOffset={scrollOffsetRef.current}
                        >
                          {Row}
                        </List>
                      )}
                    </AutoSizer>
                  </div>
                )}
        </div>
      </div>

      {isMobile && (
        <div className="gcuotas-mobile-bottombar">
          <button
            className="gcuotas-mbar-btn mbar-back"
            onClick={() => navigate('/panel')}
            disabled={loading}
          >
            <FontAwesomeIcon icon={faArrowLeft} /><span>Volver</span>
          </button>

          <button
            className="gcuotas-mbar-btn mbar-excel"
            onClick={handleExportExcel}
            disabled={loading}
          >
            <FontAwesomeIcon icon={faFileExcel} /><span>Excel</span>
          </button>

          <button
            className="gcuotas-mbar-btn mbar-imprimir"
            onClick={handleImprimirTodos}
            disabled={imprimirTodosDisabled}
            title={imprimirTodosTitle}
          >
            <FontAwesomeIcon icon={faPrint} /><span>Imprimir</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Cuotas;