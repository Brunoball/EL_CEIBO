// ✅ REEMPLAZAR COMPLETO
// src/components/Categorias/Categorias.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faPlus,
  faTrash,
  faEdit,
  faClockRotateLeft,
  faPercent,
  faSave,
} from '@fortawesome/free-solid-svg-icons';
import './Categorias.css';

// ✅ Modal historial aparte
import ModalHistorialCategorias from './modales/ModalHistorialCategorias';

/* ===========================
   Modal Confirmar Eliminación
=========================== */
function ConfirmDeleteModal({ open, categoria, onConfirm, onCancel, loading }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
      if (e.key === 'Enter') onConfirm?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div
      className="catdel-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="catdel-modal-title"
      onClick={onCancel}
    >
      <div
        className="catdel-modal-container catdel-modal--danger"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="catdel-modal__icon" aria-hidden="true">
          <FontAwesomeIcon icon={faTrash} />
        </div>

        <h3 id="catdel-modal-title" className="catdel-modal-title catdel-modal-title--danger">
          Eliminar categoría
        </h3>

        <p className="catdel-modal-text">
          {categoria?.descripcion
            ? <>¿Seguro que querés eliminar <strong>{categoria.descripcion}</strong>? Esta acción no se puede deshacer.</>
            : <>¿Seguro que querés eliminar esta categoría? Esta acción no se puede deshacer.</>}
        </p>

        <p className="catdel-modal-text" style={{ marginTop: 8 }}>
          <strong>Importante:</strong> todos los <strong>alumnos</strong> que tengan asignada esta
          categoría de monto quedarán <strong>sin ninguna categoría</strong>.
        </p>

        <div className="catdel-modal-buttons">
          <button className="catdel-btn catdel-btn--ghost" onClick={onCancel} autoFocus disabled={loading}>
            Cancelar
          </button>
          <button
            className="catdel-btn catdel-btn--solid-danger"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading ? 'true' : 'false'}
          >
            {loading ? 'Eliminando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   Utils
=========================== */
const fmtARS = (n) =>
  (n === null || n === undefined || n === '')
    ? '—'
    : Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });



/* ===========================
   Descuento familiar general
=========================== */
function DescuentosFamiliaresPanel({ showToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nuevoCant, setNuevoCant] = useState('2');
  const [nuevoPct, setNuevoPct] = useState('');

  const fetchJSONLocal = async (url, options = {}) => {
    const res = await fetch(url, options);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; }
    catch { throw new Error(`Respuesta no JSON (HTTP ${res.status})`); }
    if (!res.ok) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
    return data;
  };

  const normalizar = (arr) => [...(arr || [])]
    .map((r) => ({
      id_descuento_hermanos: r.id_descuento_hermanos ?? null,
      cantidad_hermanos: Number(r.cantidad_hermanos),
      porcentaje_descuento: String(Number(r.porcentaje_descuento ?? 0)),
    }))
    .filter((r) => Number.isFinite(r.cantidad_hermanos) && r.cantidad_hermanos >= 2)
    .sort((a, b) => a.cantidad_hermanos - b.cantidad_hermanos);

  const cargar = async () => {
    try {
      setLoading(true);
      const json = await fetchJSONLocal(`${BASE_URL}/api.php?action=descuentos_hermanos_listar`);
      const filas = Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []);
      setItems(normalizar(filas));
    } catch (e) {
      console.error(e);
      setItems([]);
      showToast?.('error', `No se pudieron cargar los descuentos familiares: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const yaExiste = (cant) => items.some((x) => Number(x.cantidad_hermanos) === Number(cant));

  const agregarFila = () => {
    const cant = Number(nuevoCant);
    const pct = nuevoPct === '' ? 0 : Number(nuevoPct);

    if (!Number.isFinite(cant) || cant < 2) {
      showToast?.('error', 'La cantidad de hermanos debe ser 2 o más.');
      return;
    }
    if (yaExiste(cant)) {
      showToast?.('info', `Ya existe una configuración para ${cant} hermanos.`);
      return;
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      showToast?.('error', 'El porcentaje debe estar entre 0 y 100.');
      return;
    }

    setItems((prev) => normalizar([
      ...prev,
      { id_descuento_hermanos: null, cantidad_hermanos: cant, porcentaje_descuento: String(pct) },
    ]));
    setNuevoCant(String(cant + 1));
    setNuevoPct('');
  };

  const cambiarFila = (idx, key, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  };

  const quitarFila = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const guardar = async () => {
    const normalizados = [];
    const vistos = new Set();

    for (const row of items) {
      const cant = Number(row.cantidad_hermanos);
      const pct = Number(row.porcentaje_descuento);

      if (!Number.isFinite(cant) || cant < 2) {
        showToast?.('error', 'Hay una cantidad de hermanos inválida.');
        return;
      }
      if (vistos.has(cant)) {
        showToast?.('error', `La cantidad ${cant} hermanos está repetida.`);
        return;
      }
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        showToast?.('error', `Porcentaje inválido para ${cant} hermanos.`);
        return;
      }

      vistos.add(cant);
      normalizados.push({ cantidad_hermanos: cant, porcentaje_descuento: pct });
    }

    try {
      setSaving(true);
      const json = await fetchJSONLocal(`${BASE_URL}/api.php?action=descuentos_hermanos_guardar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descuentos: normalizados }),
      });
      if (!json?.exito) throw new Error(json?.mensaje || 'No se pudieron guardar los descuentos.');
      showToast?.('exito', 'Descuentos familiares guardados.');
      await cargar();
    } catch (e) {
      console.error(e);
      showToast?.('error', e.message || 'No se pudieron guardar los descuentos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="cat_family_panel">
      <div className="cat_family_head">
        <div>
          <h3 className="cat_family_title">
            <FontAwesomeIcon icon={faPercent} /> Descuento familiar general
          </h3>
          <p className="cat_family_desc">
            Configurá el porcentaje sobre el total del grupo. Ejemplo: si hay 3 hermanos con categorías distintas, cuotas suma los 3 montos y aplica el porcentaje de “3 hermanos”.
          </p>
        </div>
        <button className="cat_btn cat_btn_primary" onClick={guardar} disabled={saving || loading} type="button">
          <FontAwesomeIcon icon={faSave} /> {saving ? 'Guardando…' : 'Guardar descuentos'}
        </button>
      </div>

      <div className="cat_family_add">
        <div className="cat_family_field">
          <label>Cantidad de hermanos</label>
          <input type="number" min="2" step="1" value={nuevoCant} onChange={(e) => setNuevoCant(e.target.value)} disabled={saving} />
        </div>
        <div className="cat_family_field">
          <label>% descuento</label>
          <input type="number" min="0" max="100" step="0.01" value={nuevoPct} onChange={(e) => setNuevoPct(e.target.value)} placeholder="Ej: 10" disabled={saving} />
        </div>
        <button className="cat_btn cat_btn_outline" onClick={agregarFila} disabled={saving} type="button">
          <FontAwesomeIcon icon={faPlus} /> Agregar
        </button>
      </div>

      {loading ? (
        <div className="cat_family_empty">Cargando descuentos familiares…</div>
      ) : items.length === 0 ? (
        <div className="cat_family_empty">No hay descuentos familiares configurados. Si una familia tiene hermanos y no hay fila exacta, no se descuenta nada.</div>
      ) : (
        <div className="cat_family_rows">
          {items.map((row, idx) => (
            <div className="cat_family_row" key={`${row.id_descuento_hermanos ?? 'new'}_${row.cantidad_hermanos}_${idx}`}>
              <div className="cat_family_badge">{row.cantidad_hermanos}</div>
              <div className="cat_family_label"><strong>{row.cantidad_hermanos}</strong> hermanos</div>
              <div className="cat_family_field cat_family_field_inline">
                <label>% descuento</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={row.porcentaje_descuento}
                  onChange={(e) => cambiarFila(idx, 'porcentaje_descuento', e.target.value)}
                  disabled={saving}
                />
              </div>
              <button className="cat_icon_btn cat_icon_btn_danger" onClick={() => quitarFila(idx)} disabled={saving} title="Quitar" type="button">
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ===========================
   Componente principal
=========================== */
const Categorias = () => {
  const navigate = useNavigate();

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);

  // TOAST
  const [toast, setToast] = useState({ show: false, tipo: 'exito', mensaje: '', duracion: 3000 });
  const showToast = (tipo, mensaje, duracion = 3000) => setToast({ show: true, tipo, mensaje, duracion });
  const closeToast = () => setToast((t) => ({ ...t, show: false }));

  // Eliminar
  const [delState, setDelState] = useState({ open: false, cat: null, loading: false });

  // ✅ Historial modal state
  const [histState, setHistState] = useState({ open: false, cat: null });

  // Helpers API
  const fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, options);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; }
    catch { throw new Error(`Respuesta no JSON (HTTP ${res.status})`); }
    if (!res.ok) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
    return data;
  };

  // Normalización
  const normalizarFilas = (arr) =>
    [...(arr || [])]
      .map((r) => ({
        id: r.id ?? r.id_cat_monto ?? r.id_categoria ?? r.ID ?? null,
        descripcion: (r.descripcion ?? r.nombre_categoria ?? r.nombre ?? '').toString(),
        monto_mensual: r.monto ?? r.monto_mensual ?? null,
        monto_anual: r.monto_anual ?? null,
      }))
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  const cargar = async () => {
    try {
      setLoading(true);
      const json = await fetchJSON(`${BASE_URL}/api.php?action=cat_listar`);
      let filas = [];
      if (Array.isArray(json)) filas = json;
      else if (json?.categorias) {
        if (json.exito === false) throw new Error(json.mensaje || 'Error al listar');
        filas = json.categorias;
      } else if (json?.exito && Array.isArray(json?.data)) filas = json.data;
      else if (json?.exito && Array.isArray(json?.rows)) filas = json.rows;
      else if (json?.exito && Array.isArray(json?.result)) filas = json.result;
      else filas = json?.resultados || [];
      setLista(normalizarFilas(filas));
    } catch (e) {
      console.error(e);
      setLista([]);
      showToast('error', `No se pudieron cargar las categorías: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const filtradas = useMemo(() => lista, [lista]);

  // Eliminar
  const pedirConfirmacionEliminar = (cat) => setDelState({ open: true, cat, loading: false });

  const confirmarEliminar = async () => {
    const cat = delState.cat;
    if (!cat) return setDelState({ open: false, cat: null, loading: false });

    try {
      setDelState((s) => ({ ...s, loading: true }));
      const body = new FormData();
      body.append('id', String(cat.id));
      const resp = await fetchJSON(`${BASE_URL}/api.php?action=cat_eliminar`, { method: 'POST', body });
      if (!resp?.exito) throw new Error(resp?.mensaje || 'No se pudo eliminar');
      showToast('exito', 'Categoría eliminada.');
      setDelState({ open: false, cat: null, loading: false });
      await cargar();
    } catch (e) {
      console.error(e);
      showToast('error', e.message || 'No se pudo eliminar la categoría.');
      setDelState((s) => ({ ...s, loading: false }));
    }
  };

  // ✅ Abrir historial modal
  const abrirHistorial = (cat) => {
    setHistState({ open: true, cat });
  };

  return (
    <div className="cat_page">
      <div className="cat_card">
        <header className="cat_header">
          <h2 className="cat_title">Categorías</h2>
        </header>

        <div className="cat_list">
          <div className="cat_list_head">
            <div className="cat_col cat_col_name cat_head_cell">Nombre</div>
            <div className="cat_col cat_col_amount cat_head_cell cat_center">Mensual</div>
            <div className="cat_col cat_col_amount cat_head_cell cat_center">Anual</div>
            <div className="cat_col cat_col_actions cat_head_cell cat_right">Acciones</div>
          </div>

          {loading ? (
            <>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="cat_row cat_row_skeleton">
                  <span className="cat_skel cat_skel_text" />
                  <span className="cat_skel cat_skel_text cat_skel_short" />
                  <span className="cat_skel cat_skel_text cat_skel_short" />
                  <span className="cat_skel cat_skel_icon" />
                </div>
              ))}
            </>
          ) : filtradas.length === 0 ? (
            <div className="cat_empty">No hay categorías para mostrar.</div>
          ) : (
            filtradas.map((c, index) => (
              <div
                key={c.id}
                className="cat_row"
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                <div className="cat_cell cat_col_name" data-label="Nombre">
                  {c.descripcion || '—'}
                </div>

                <div className="cat_cell cat_col_amount cat_center" data-label="Mensual">
                  {fmtARS(c.monto_mensual)}
                </div>

                <div className="cat_cell cat_col_amount cat_center" data-label="Anual">
                  {fmtARS(c.monto_anual)}
                </div>

                <div className="cat_cell cat_col_actions cat_right" data-label="Acciones">
                  <button
                    className="cat_icon_btn cat_icon_btn_history"
                    onClick={() => abrirHistorial(c)}
                    title="Historial de cambios"
                    aria-label={`Ver historial de ${c.descripcion || 'categoría'}`}
                  >
                    <FontAwesomeIcon icon={faClockRotateLeft} />
                  </button>

                  <button
                    className="cat_icon_btn"
                    onClick={() => navigate(`/categorias/editar/${c.id}`)}
                    title="Editar"
                    aria-label={`Editar categoría ${c.descripcion || ''}`}
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>

                  <button
                    className="cat_icon_btn cat_icon_btn_danger"
                    onClick={() => pedirConfirmacionEliminar(c)}
                    title="Eliminar"
                    aria-label={`Eliminar categoría ${c.descripcion || ''}`}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <DescuentosFamiliaresPanel showToast={showToast} />

        <section className="cat_toolbar">
          <button
            className="cat_btn cat_btn_primary cat_btn_back"
            onClick={() => navigate('/panel')}
            title="Volver"
            aria-label="Volver"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span className="cat_btn_text">Volver</span>
          </button>

          <div className="cat_toolbar_spacer" />

          <button
            className="cat_btn cat_btn_outline"
            onClick={() => navigate('/categorias/nueva')}
          >
            <FontAwesomeIcon icon={faPlus} />
            <span className="cat_btn_text">Nueva</span>
          </button>
        </section>
      </div>

      {/* ✅ Modal Historial (APARTE) */}
      <ModalHistorialCategorias
        open={histState.open}
        onClose={() => setHistState({ open: false, cat: null })}
        categoria={histState.cat}
        BASE_URL={BASE_URL}
      />

      {/* Modal Confirmar Eliminación */}
      <ConfirmDeleteModal
        open={delState.open}
        categoria={delState.cat}
        onConfirm={confirmarEliminar}
        onCancel={() => setDelState({ open: false, cat: null, loading: false })}
        loading={delState.loading}
      />

      {/* TOAST */}
      {toast.show && (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          duracion={toast.duracion}
          onClose={closeToast}
        />
      )}
    </div>
  );
};

export default Categorias;