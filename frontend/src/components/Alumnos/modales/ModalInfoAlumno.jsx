// src/components/Alumnos/ModalInfoAlumno.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import './ModalInfoAlumno.css';

const ModalInfoAlumno = ({ mostrar, alumno, onClose }) => {
  // Cerrar con ESC
  useEffect(() => {
    if (!mostrar) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mostrar, onClose]);

  // Pestañas
  const [pestania, setPestania] = useState('datos');

  /* ================= Helpers ================= */
  const texto = useCallback((v) => {
    const s = v === null || v === undefined ? '' : String(v).trim();
    return s === '' ? '-' : s;
  }, []);

  const fmtARS = useCallback((n) => {
    if (n === null || n === undefined || n === '') return '-';
    const v = Number(n);
    if (Number.isNaN(v)) return '-';
    return v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  }, []);

  const formatearFecha = useCallback((val) => {
    if (!val) return '-';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    const d = new Date(val.includes('T') ? val : `${val}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }, []);

  const nombreCompleto = useMemo(() => {
    if (!alumno) return '';
    const ap = (alumno.apellido || '').trim();
    const no = (alumno.nombre || '').trim();
    const armado = `${ap} ${no}`.trim();
    return armado || ap || no || '-';
  }, [alumno]);

  if (!mostrar || !alumno) return null;

  /* =============== Extracts (defensivos) =============== */
  // Documento
  const tipoDocNombre = alumno.tipo_documento_nombre || '';
  const tipoDocSigla  = alumno.tipo_documento_sigla ? ` (${alumno.tipo_documento_sigla})` : '';
  const tipoDoc       = texto(`${tipoDocNombre}${tipoDocSigla}`);
  const numDoc        = alumno.num_documento || alumno.dni || '-';

  // Sexo
  const sexo = texto(alumno.sexo_nombre);

  // Contacto / domicilio
  const domicilio = texto(alumno.domicilio);
  const localidad = texto(alumno.localidad);
  const cp        = texto(alumno.cp);
  const telefono  = texto(alumno.telefono);

  // Nacimiento
  const lugarNac  = texto(alumno.lugar_nacimiento);
  const fechaNac  = formatearFecha(alumno.fecha_nacimiento);

  // Cuota/categoría
  const anio      = alumno.anio_nombre      || alumno.nombre_año      || alumno.nombre_anio || texto(alumno.id_año);
  const division  = alumno.division_nombre  || alumno.nombre_division || texto(alumno.id_division);
  const categoria =
    alumno.categoria_nombre ||
    alumno.nombre_categoria ||
    alumno.catm_nombre ||
    alumno.categoria_monto_nombre ||
    alumno.nombre_categoria_monto ||
    texto(alumno.id_cat_monto || alumno.id_categoria);

  const catMontoMensual  =
    alumno.catm_monto_mensual ?? alumno.monto_mensual ?? null;
  const catMontoAnual    =
    alumno.catm_monto_anual   ?? alumno.monto_anual   ?? null;

  // Estado
  const ingreso   = formatearFecha(alumno.ingreso);

  // Observaciones (texto libre)
  const observaciones = alumno.observaciones;

  // Familia (nuevo)
  const familia = texto(alumno.familia);

  return (
    <div
      className="mi-modal__overlay"
      onClick={(e) => e.target.classList.contains('mi-modal__overlay') && onClose?.()}
    >
      <div className="mi-modal__container" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {/* Header violeta */}
        <div className="mi-modal__header">
          <div className="mi-modal__head-left">
            <h2 className="mi-modal__title">Información del Socio</h2>
            <p className="mi-modal__subtitle">
              ID: {alumno.id_alumno ?? '-'} &nbsp;|&nbsp; {nombreCompleto}
            </p>
          </div>
          <button className="mi-modal__close" onClick={onClose} aria-label="Cerrar">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="mi-modal__tabs">
          <button className={`mi-tab ${pestania === 'datos' ? 'is-active' : ''}`} onClick={() => setPestania('datos')}>Datos Generales</button>
          <button className={`mi-tab ${pestania === 'contacto' ? 'is-active' : ''}`} onClick={() => setPestania('contacto')}>Contacto</button>
          <button className={`mi-tab ${pestania === 'academico' ? 'is-active' : ''}`} onClick={() => setPestania('academico')}>Cuota</button>
          <button className={`mi-tab ${pestania === 'observaciones' ? 'is-active' : ''}`} onClick={() => setPestania('observaciones')}>Observaciones</button>
        </div>

        {/* Contenido */}
        <div className="mi-modal__content">
          {pestania === 'datos' && (
            <section className="mi-tabpanel is-active">
              <div className="mi-grid">
                <article className="mi-card mi-card--full">
                  <h3 className="mi-card__title">Datos Personales</h3>

                  <div className="mi-row">
                    <span className="mi-label">Tipo de Documento</span>
                    <span className="mi-value">{tipoDoc}</span>
                  </div>
                  <div className="mi-row">
                    <span className="mi-label">Nº Documento</span>
                    <span className="mi-value">{texto(numDoc)}</span>
                  </div>

                  <div className="mi-row">
                    <span className="mi-label">Sexo</span>
                    <span className="mi-value">{sexo}</span>
                  </div>

                  <div className="mi-row">
                    <span className="mi-label">Lugar de nacimiento</span>
                    <span className="mi-value">{lugarNac}</span>
                  </div>
                  <div className="mi-row">
                    <span className="mi-label">Fecha de nacimiento</span>
                    <span className="mi-value">{fechaNac}</span>
                  </div>

                  <div className="mi-sep" />

                  <div className="mi-row">
                    <span className="mi-label">Ingreso</span>
                    <span className="mi-value">{ingreso}</span>
                  </div>

                  {/* Familia */}
                  <div className="mi-row">
                    <span className="mi-label">Familia</span>
                    <span className="mi-value">{familia}</span>
                  </div>
                </article>
              </div>
            </section>
          )}

          {pestania === 'contacto' && (
            <section className="mi-tabpanel is-active">
              <div className="mi-grid">
                <article className="mi-card">
                  <h3 className="mi-card__title">Dirección</h3>
                  <div className="mi-row">
                    <span className="mi-label">Domicilio</span>
                    <span className="mi-value">{domicilio}</span>
                  </div>
                  <div className="mi-row">
                    <span className="mi-label">Localidad</span>
                    <span className="mi-value">{localidad}</span>
                  </div>
                  <div className="mi-row">
                    <span className="mi-label">CP</span>
                    <span className="mi-value">{cp}</span>
                  </div>
                </article>

                <article className="mi-card">
                  <h3 className="mi-card__title">Contacto</h3>
                  <div className="mi-row">
                    <span className="mi-label">Teléfono</span>
                    <span className="mi-value">{telefono}</span>
                  </div>
                </article>
              </div>
            </section>
          )}

          {pestania === 'academico' && (
            <section className="mi-tabpanel is-active">
              <div className="mi-grid">
                <article className="mi-card">
                  <h3 className="mi-card__title">Datos de cuota</h3>
                  <div className="mi-row">
                    <span className="mi-label">Año</span>
                    <span className="mi-value">{texto(anio)}</span>
                  </div>
                  <div className="mi-row">
                    <span className="mi-label">División</span>
                    <span className="mi-value">{texto(division)}</span>
                  </div>
                </article>

                <article className="mi-card">
                  <h3 className="mi-card__title">Categoría</h3>
                  <div className="mi-row">
                    <span className="mi-label">Nombre</span>
                    <span className="mi-value">{texto(categoria)}</span>
                  </div>
                  <div className="mi-row">
                    <span className="mi-label">Monto mensual</span>
                    <span className="mi-value">{fmtARS(catMontoMensual)}</span>
                  </div>
                  <div className="mi-row">
                    <span className="mi-label">Monto anual</span>
                    <span className="mi-value">{fmtARS(catMontoAnual)}</span>
                  </div>
                </article>
              </div>
            </section>
          )}

          {pestania === 'observaciones' && (
            <section className="mi-tabpanel is-active">
              <div className="mi-grid">
                <article className="mi-card mi-card--full">
                  <h3 className="mi-card__title">Observaciones</h3>
                  <div className="mi-row mi-row--block">
                    <span className="mi-label">Notas</span>
                    <span className="mi-value mi-value--multiline">{texto(observaciones)}</span>
                  </div>
                </article>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalInfoAlumno;
