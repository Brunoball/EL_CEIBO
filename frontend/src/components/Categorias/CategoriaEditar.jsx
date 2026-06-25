// src/components/Categorias/CategoriaEditar.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faSave } from '@fortawesome/free-solid-svg-icons';
import './CategoriaEditar.css';

const CategoriaEditar = () => {
  const navigate = useNavigate();
  const params = useParams();

  const idStr = params?.id ?? '';
  const idNum = Number(idStr);
  const idValido = Number.isFinite(idNum) && idNum > 0;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nombre, setNombre] = useState('');
  const [mMensual, setMMensual] = useState('');
  const [mAnual, setMAnual] = useState('');

  const original = useRef({ mensual: null, anual: null });
  const mensualRef = useRef(null);

  const [toast, setToast] = useState({ show: false, tipo: 'exito', mensaje: '', duracion: 3000 });
  const showToast = (tipo, mensaje, duracion = 3000) => setToast({ show: true, tipo, mensaje, duracion });
  const closeToast = () => setToast((t) => ({ ...t, show: false }));

  const fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, options);
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Respuesta no JSON (HTTP ${res.status})`);
    }
    if (!res.ok) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
    return data;
  };

  const numOrNull = (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);

        if (!idValido) throw new Error('ID inválido en la URL. Revisá la ruta: /categorias/editar/:id');

        const json = await fetchJSON(`${BASE_URL}/api.php?action=cat_listar`);
        const filas = Array.isArray(json)
          ? json
          : (json?.categorias ?? json?.data ?? json?.rows ?? json?.result ?? json?.resultados ?? []);

        const lista = filas.map((r) => ({
          id: r.id ?? r.id_cat_monto ?? r.id_categoria,
          descripcion: String(r.descripcion ?? r.nombre_categoria ?? ''),
          monto_mensual: Number(r.monto ?? r.monto_mensual ?? 0),
          monto_anual: Number(r.monto_anual ?? 0),
        }));

        const cat = lista.find((x) => String(x.id) === String(idNum));
        if (!cat) throw new Error('Categoría no encontrada');

        setNombre(cat.descripcion);
        setMMensual(String(cat.monto_mensual ?? ''));
        setMAnual(String(cat.monto_anual ?? ''));

        original.current = {
          mensual: cat.monto_mensual,
          anual: cat.monto_anual,
        };

        setTimeout(() => mensualRef.current?.focus(), 0);
      } catch (e) {
        showToast('error', e.message || 'No se pudo cargar la categoría', 3200);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [idStr]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!idValido) {
      showToast('error', 'ID inválido en la URL. No se puede guardar.', 3200);
      return;
    }

    const mens = numOrNull(mMensual);
    const anu = numOrNull(mAnual);

    const chk = (n) => n === null || (!Number.isNaN(n) && n >= 0);
    if (!chk(mens)) {
      showToast('error', 'Monto mensual inválido (>= 0)', 2800);
      mensualRef.current?.focus();
      return;
    }
    if (!chk(anu)) {
      showToast('error', 'Monto anual inválido (>= 0)', 2800);
      return;
    }

    const changedBaseMens = mens !== null && mens !== original.current.mensual;
    const changedBaseAnu = anu !== null && anu !== original.current.anual;

    if (!changedBaseMens && !changedBaseAnu) {
      showToast('info', 'No hay cambios para guardar.', 2200);
      return;
    }

    const body = new FormData();
    body.append('id', String(idNum));
    if (changedBaseMens) body.append('monto', String(mens));
    if (changedBaseAnu) body.append('monto_anual', String(anu));
    if (changedBaseMens) body.append('precio', String(mens));

    try {
      setSaving(true);
      const json = await fetchJSON(`${BASE_URL}/api.php?action=cat_actualizar`, {
        method: 'POST',
        body,
      });
      if (!json?.exito) throw new Error(json?.mensaje || 'No se pudo actualizar');

      const dur = 1600;
      showToast('exito', 'Cambios guardados.', dur);
      setTimeout(() => navigate('/categorias', { replace: true }), dur);
    } catch (e2) {
      showToast('error', e2.message || 'Error al actualizar la categoría', 3200);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cat_edi_page">
      <div className="cat_edi_card" role="dialog" aria-modal="true">
        <header className="cat_edi_header">
          <h2 className="cat_edi_title">Editar categoría</h2>
        </header>

        {loading ? (
          <div className="cat_edi_loading">Cargando…</div>
        ) : (
          <form className="cat_edi_form" onSubmit={onSubmit}>
            <div className="cat_edi_form_row">
              <label className="cat_edi_label">Nombre</label>
              <input
                className="cat_edi_input"
                value={nombre}
                disabled
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            <div className="cat_edi_two_col">
              <div className="cat_edi_form_row">
                <label className="cat_edi_label">Monto mensual</label>
                <input
                  ref={mensualRef}
                  className="cat_edi_input"
                  type="number"
                  inputMode="numeric"
                  value={mMensual}
                  onChange={(e) => setMMensual(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="1"
                  disabled={saving}
                />
              </div>

              <div className="cat_edi_form_row">
                <label className="cat_edi_label">Monto anual</label>
                <input
                  className="cat_edi_input"
                  type="number"
                  inputMode="numeric"
                  value={mAnual}
                  onChange={(e) => setMAnual(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="1"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="cat_edi_form_actions">
              <button
                type="button"
                className="cat_edi_btn cat_edi_btn_back"
                onClick={() => navigate('/categorias')}
                disabled={saving}
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                <span className="cat_edi_btn_text">Volver</span>
              </button>

              <button type="submit" className="cat_edi_btn cat_edi_btn_primary" disabled={saving}>
                <FontAwesomeIcon icon={faSave} />
                <span className="cat_edi_btn_text">{saving ? 'Guardando…' : 'Guardar'}</span>
              </button>
            </div>
          </form>
        )}

        {toast.show && <Toast tipo={toast.tipo} mensaje={toast.mensaje} duracion={toast.duracion} onClose={closeToast} />}
      </div>
    </div>
  );
};

export default CategoriaEditar;
