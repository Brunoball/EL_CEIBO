// src/components/Categorias/modales/ModalHistorialCategorias.jsx

import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes,
  faClockRotateLeft,
  faArrowTrendUp,
  faArrowTrendDown,
} from '@fortawesome/free-solid-svg-icons';

import '../Categorias.css';

const fmtARS = (n) =>
  (n === null || n === undefined || n === '')
    ? '—'
    : Number(n).toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
      });

const formatDate = (iso) => {
  if (!iso) return '—';
  const s = iso.toString().slice(0, 10);
  const [y, m, d] = s.split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : s;
};

const renderCambio = (viejo, nuevo) => {
  const pv = Number(viejo);
  const pn = Number(nuevo);
  if (!(pv > 0)) return <span className="cat_change_dash">—</span>;

  const diff = pn - pv;
  const pct = (diff / pv) * 100;
  const sign = diff >= 0 ? '+' : '';
  const isUp = diff > 0;
  const isDown = diff < 0;

  return (
    <span className={`cat_change ${isUp ? 'cat_change_up' : ''} ${isDown ? 'cat_change_down' : ''}`}>
      <FontAwesomeIcon icon={isUp ? faArrowTrendUp : faArrowTrendDown} className="cat_change_icon" />
      {sign}{pct.toFixed(1)}%
    </span>
  );
};

const ModalBase = ({ open, title, onClose, children, width = 920 }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cat_modal" role="dialog" aria-modal="true" aria-labelledby="cat_modal_title" onClick={onClose}>
      <div className="cat_modal_card" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div className="cat_modal_head">
          <h3 id="cat_modal_title" className="cat_modal_title">{title}</h3>
          <button onClick={onClose} className="cat_modal_close" aria-label="Cerrar">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="cat_modal_body">{children}</div>
      </div>
    </div>
  );
};

async function fetchJSON(url, { signal, timeoutMs = 12000, ...options } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  const onAbort = () => ctrl.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    const text = await res.text();

    let data = null;
    try { data = text ? JSON.parse(text) : null; }
    catch { throw new Error(`Respuesta no JSON (HTTP ${res.status})`); }

    if (!res.ok) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
    return data;
  } finally {
    clearTimeout(t);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

const ModalHistorialCategorias = ({ open, onClose, categoria, BASE_URL }) => {
  const catId = categoria?.id;

  const [loading, setLoading] = useState(false);
  const [baseHist, setBaseHist] = useState([]);
  const [emptyMsg, setEmptyMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    setBaseHist([]);
    setEmptyMsg('');
  }, [open, catId]);

  useEffect(() => {
    if (!open || !catId) return;

    const ac = new AbortController();

    const run = async () => {
      try {
        setLoading(true);

        const jBase = await fetchJSON(
          `${BASE_URL}/api.php?action=cat_historial&id=${encodeURIComponent(catId)}`,
          { signal: ac.signal, timeoutMs: 12000 }
        );

        let filasBase = [];
        if (Array.isArray(jBase)) filasBase = jBase;
        else if (Array.isArray(jBase?.historial)) filasBase = jBase.historial;
        else if (jBase?.exito && Array.isArray(jBase?.data)) filasBase = jBase.data;
        else filasBase = jBase?.resultados || [];

        const normBase = (filasBase || []).map((r) => ({
          tipo: (r.tipo ?? 'BASE').toString(),
          precio_anterior: (r.precio_anterior ?? r.anterior ?? r.old ?? null),
          precio_nuevo: (r.precio_nuevo ?? r.nuevo ?? r.new ?? null),
          fecha: (r.fecha_cambio ?? r.fecha ?? '').toString(),
        }));

        setBaseHist(normBase);
        if (normBase.length === 0) setEmptyMsg('No hay historial de cambios para esta categoría.');
      } catch (e) {
        if (e?.name === 'AbortError') return;
        console.error(e);
        setEmptyMsg(`No se pudo cargar el historial: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => ac.abort();
  }, [open, catId, BASE_URL]);

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FontAwesomeIcon icon={faClockRotateLeft} />
          Historial · {categoria?.descripcion || ''}
        </span>
      }
      width={980}
    >
      {loading ? (
        <div className="cat_hist_loading">Cargando historial…</div>
      ) : emptyMsg ? (
        <div className="cat_hist_empty">{emptyMsg}</div>
      ) : (
        <div className="cat_hist_table_wrap">
          <table className="cat_hist_table">
            <thead>
              <tr>
                <th className="cat_th_center">#</th>
                <th className="cat_th_center">Tipo</th>
                <th className="cat_th_right">Monto anterior</th>
                <th className="cat_th_right">Monto nuevo</th>
                <th className="cat_th_center">Cambio</th>
                <th className="cat_th_center">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {baseHist.map((h, i) => (
                <tr key={i}>
                  <td className="cat_td_center" data-label="#"> {i + 1} </td>
                  <td className="cat_td_center" data-label="Tipo">{h.tipo || 'BASE'}</td>
                  <td className="cat_td_right" data-label="Monto anterior">{fmtARS(h.precio_anterior)}</td>
                  <td className="cat_td_right" data-label="Monto nuevo">{fmtARS(h.precio_nuevo)}</td>
                  <td className="cat_td_center" data-label="Cambio">{renderCambio(h.precio_anterior, h.precio_nuevo)}</td>
                  <td className="cat_td_center" data-label="Fecha">{formatDate(h.fecha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModalBase>
  );
};

export default ModalHistorialCategorias;
