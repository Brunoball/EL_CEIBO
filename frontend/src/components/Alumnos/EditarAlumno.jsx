// src/components/Alumnos/EditarAlumno.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faArrowLeft, faUser, faGraduationCap, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import './EditarAlumno.css';

const aMayus = (v) => (typeof v === 'string' ? v.toUpperCase() : v);
const TZ_CBA = 'America/Argentina/Cordoba';

const hoyISO = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_CBA, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());

const esFechaISO = (val) => /^\d{4}-\d{2}-\d{2}$/.test(val);

const EditarAlumno = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('informacion');

  // ===== Campos =====
  const [apellido, setApellido] = useState('');
  const [nombre, setNombre] = useState('');
  const [id_tipo_documento, setIdTipoDocumento] = useState('');
  const [num_documento, setNumDocumento] = useState('');
  const [id_sexo, setIdSexo] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [telefono, setTelefono] = useState('');
  const [id_cat_monto, setIdCatMonto] = useState('');
  const [ingreso, setIngreso] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Listas
  const [categorias, setCategorias] = useState([]);
  const [sexos, setSexos] = useState([]);
  const [tiposDocumento, setTiposDocumento] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [idAlumno, setIdAlumno] = useState(null);

  const fechaInputRef = useRef(null);

  // Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'exito' });
  const showToast = (message, type = 'exito') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const abrirCalendario = () => {
    const el = fechaInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); return; } catch {}
    }
    el.focus();
    try { el.click(); } catch {}
  };

  const obtenerAlumno = async (signal) => {
    try {
      setCargando(true);

      // Listas
      const resListas = await fetch(`${BASE_URL}/api.php?action=obtener_listas`, { signal });
      const jsonListas = await resListas.json();

      if (jsonListas.exito) {
        const L = jsonListas.listas || {};
        setCategorias((L.categorias || []).map(r => ({
          id: r.id ?? r.id_cat_monto,
          nombre: r.nombre ?? r.nombre_categoria ?? '',
          monto_mensual: r.monto_mensual ?? r.monto ?? null,
          monto_anual: r.monto_anual ?? null
        })));
        setSexos(L.sexos || []);
        setTiposDocumento(L.tipos_documentos || []);
      } else {
        showToast('Error al cargar listas: ' + (jsonListas.mensaje || ''), 'error');
      }

      // Datos del alumno
      const response = await fetch(`${BASE_URL}/api.php?action=editar_alumno&id=${encodeURIComponent(id)}`, { signal });
      const data = await response.json();

      if (data.exito) {
        const a = data.alumno || {};
        setIdAlumno(a.id_alumno || id);
        setApellido(a.apellido || '');
        setNombre(a.nombre || '');
        setIdTipoDocumento(a.id_tipo_documento ?? '');
        setNumDocumento(a.num_documento || '');
        setIdSexo(a.id_sexo ?? '');
        setDomicilio(a.domicilio || '');
        setLocalidad(a.localidad || '');
        setTelefono(a.telefono || '');
        setIdCatMonto(a.id_cat_monto ?? a.id_categoria ?? '');
        setIngreso(a.ingreso || '');
        setObservaciones(a.observaciones || '');
      } else {
        showToast('Error al cargar datos del alumno: ' + (data.mensaje || ''), 'error');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        showToast('Hubo un error al obtener los datos: ' + error.message, 'error');
      }
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    if (id) obtenerAlumno(ctrl.signal);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleOnlyDigits = (e, setter) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setter(value);
  };

  const guardarAlumno = async () => {
    if (!apellido?.trim()) return showToast('El apellido es obligatorio.', 'error');
    if (!num_documento?.trim()) return showToast('El documento es obligatorio.', 'error');
    if (!id_cat_monto) return showToast('La categoría es obligatoria.', 'error');
    if (!ingreso || !esFechaISO(ingreso)) return showToast('La fecha de ingreso es obligatoria y debe ser AAAA-MM-DD.', 'error');

    try {
      const response = await fetch(`${BASE_URL}/api.php?action=editar_alumno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_alumno: id,
          apellido: aMayus(apellido),
          nombre: aMayus(nombre) || null,
          id_tipo_documento: id_tipo_documento || null,
          num_documento: num_documento,
          id_sexo: id_sexo || null,
          domicilio: aMayus(domicilio) || null,
          localidad: aMayus(localidad) || null,
          telefono: telefono || null,
          id_anio: null,
          id_division: null,
          id_cat_monto: id_cat_monto || null,
          ingreso: ingreso,
          observaciones: (observaciones !== '' ? observaciones : null)
        }),
      });

      const data = await response.json();

      if (data.exito) {
        showToast('Socio actualizado correctamente', 'exito');
        setTimeout(() => navigate('/alumnos'), 800);
      } else {
        showToast(data.mensaje || 'Error al actualizar.', 'error');
      }
    } catch (error) {
      showToast('Error en la solicitud: ' + error.message, 'error');
    }
  };

  // --- UI ---
  const Header = (
    <div className="edit-socio-header">
      {cargando ? (
        <div className="edit-socio-header-skel">
          <div className="skel skel-title" />
          <div className="skel skel-subtitle" />
        </div>
      ) : (
        <>
          <h2 className="edit-socio-title">Editar Socio #{idAlumno}</h2>
          <div className="edit-socio-subtitle">
            {[apellido, nombre].filter(Boolean).join(' ')}
          </div>
        </>
      )}
    </div>
  );

  const Tabs = (
    <div className="edit-socio-tabs" role="tablist" aria-label="Secciones de edición">
      {['informacion','cuota','otros'].map(tab => (
        <button
          key={tab}
          className={`edit-socio-tab ${activeTab === tab ? 'active' : ''} ${cargando ? 'is-disabled' : ''}`}
          onClick={() => !cargando && setActiveTab(tab)}
          role="tab"
          aria-selected={activeTab === tab}
          aria-label={tab}
          title={tab.charAt(0).toUpperCase() + tab.slice(1)}
          disabled={cargando}
        >
          <FontAwesomeIcon
            icon={tab==='informacion' ? faUser : tab==='cuota' ? faGraduationCap : faInfoCircle}
            className="edit-socio-tab-icon"
          />
          <span className="tab-text">
            {tab==='informacion' ? 'Información' : tab==='cuota' ? 'Cuota' : 'Otros'}
          </span>
        </button>
      ))}
    </div>
  );

  const ContentLoading = (
    <div className="edit-socio-form">
      <div className="edit-socio-tab-content">
        <div className="edit-socio-input-group">
          <div className="skel skel-input" />
          <div className="skel skel-input" />
        </div>
        <div className="edit-socio-input-group">
          <div className="skel skel-input" />
          <div className="skel skel-input" />
        </div>
        <div className="edit-socio-input-group">
          <div className="skel skel-input" />
          <div className="skel skel-input" />
        </div>
      </div>

      <div className="edit-socio-buttons-container">
        <div className="skel skel-btn" />
        <div className="skel skel-btn" />
      </div>
    </div>
  );

  return (
    <div className="edit-socio-container">
      {toast.show && (
        <Toast
          tipo={toast.type}
          mensaje={toast.message}
          onClose={() => setToast(prev => ({ ...prev, show: false }))}
          duracion={3000}
        />
      )}

      <div className="edit-socio-box edit-socio-animate-in" role="region" aria-label="Editar socio">
        {Header}
        {Tabs}

        {cargando ? (
          ContentLoading
        ) : (
          <form className="edit-socio-form" onSubmit={(e) => e.preventDefault()}>
            {activeTab === 'informacion' && (
              <div className="edit-socio-tab-content">
                {/* Apellido / Nombre */}
                <div className="edit-socio-input-group">
                  <div className="edit-socio-floating-label-wrapper">
                    <input
                      type="text"
                      value={apellido}
                      onChange={(e) => setApellido(aMayus(e.target.value))}
                      placeholder=" "
                      className="edit-socio-input"
                      id="apellido"
                      required
                    />
                    <label htmlFor="apellido" className={`edit-socio-floating-label ${apellido ? 'edit-socio-floating-label-filled' : ''}`}>
                      Apellido *
                    </label>
                  </div>

                  <div className="edit-socio-floating-label-wrapper">
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(aMayus(e.target.value))}
                      placeholder=" "
                      className="edit-socio-input"
                      id="nombre"
                    />
                    <label htmlFor="nombre" className={`edit-socio-floating-label ${nombre ? 'edit-socio-floating-label-filled' : ''}`}>
                      Nombre
                    </label>
                  </div>
                </div>

                {/* Documento + Tipo + Sexo */}
                <div className="edit-socio-input-group cols-3">
                  <div className="edit-socio-floating-label-wrapper">
                    <input
                      type="text"
                      value={num_documento}
                      onChange={(e) => handleOnlyDigits(e, setNumDocumento)}
                      placeholder=" "
                      className="edit-socio-input"
                      id="num_documento"
                      inputMode="numeric"
                      required
                    />
                    <label htmlFor="num_documento" className={`edit-socio-floating-label ${num_documento ? 'edit-socio-floating-label-filled' : ''}`}>
                      Documento *
                    </label>
                  </div>

                  <div className="edit-fl-wrapper always-active">
                    <label htmlFor="id_tipo_documento" className="edit-fl-label">Tipo de documento</label>
                    <select
                      id="id_tipo_documento"
                      value={id_tipo_documento || ''}
                      onChange={(e) => setIdTipoDocumento(e.target.value)}
                      className="edit-socio-input edit-select"
                    >
                      <option value="">Seleccionar</option>
                      {tiposDocumento.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.descripcion}{t.sigla ? ` (${t.sigla})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="edit-fl-wrapper always-active">
                    <label htmlFor="id_sexo" className="edit-fl-label">Sexo</label>
                    <select
                      id="id_sexo"
                      value={id_sexo || ''}
                      onChange={(e) => setIdSexo(e.target.value)}
                      className="edit-socio-input edit-select"
                    >
                      <option value="">Seleccionar</option>
                      {sexos.map((s) => (
                        <option key={s.id} value={s.id}>{s.sexo}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Teléfono / Fecha de ingreso */}
                <div className="edit-socio-input-group">
                  <div className="edit-socio-floating-label-wrapper">
                    <input
                      type="text"
                      value={telefono}
                      onChange={(e) => handleOnlyDigits(e, setTelefono)}
                      placeholder=" "
                      className="edit-socio-input"
                      id="telefono"
                      inputMode="tel"
                    />
                    <label htmlFor="telefono" className={`edit-socio-floating-label ${telefono ? 'edit-socio-floating-label-filled' : ''}`}>
                      Teléfono
                    </label>
                  </div>

                  <div
                    className="edit-socio-floating-label-wrapper date-clickable"
                    onClick={abrirCalendario}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && abrirCalendario()}
                    aria-label="Fecha de ingreso (abrir calendario)"
                    title="Fecha de ingreso"
                  >
                    <input
                      ref={fechaInputRef}
                      type="date"
                      value={ingreso || ''}
                      onChange={(e) => setIngreso(e.target.value)}
                      className="edit-socio-input date-no-effect"
                      id="ingreso"
                      max="9999-12-31"
                      placeholder={hoyISO()}
                      required
                    />
                    <label htmlFor="ingreso" className="edit-socio-floating-label date-label-fixed">
                      Fecha de ingreso *
                    </label>
                  </div>
                </div>

                {/* Domicilio / Localidad */}
                <div className="edit-socio-input-group">
                  <div className="edit-socio-floating-label-wrapper">
                    <input
                      type="text"
                      value={domicilio}
                      onChange={(e) => setDomicilio(aMayus(e.target.value))}
                      placeholder=" "
                      className="edit-socio-input"
                      id="domicilio"
                    />
                    <label htmlFor="domicilio" className={`edit-socio-floating-label ${domicilio ? 'edit-socio-floating-label-filled' : ''}`}>
                      Domicilio
                    </label>
                  </div>

                  <div className="edit-socio-floating-label-wrapper">
                    <input
                      type="text"
                      value={localidad}
                      onChange={(e) => setLocalidad(aMayus(e.target.value))}
                      placeholder=" "
                      className="edit-socio-input"
                      id="localidad"
                    />
                    <label htmlFor="localidad" className={`edit-socio-floating-label ${localidad ? 'edit-socio-floating-label-filled' : ''}`}>
                      Localidad
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cuota' && (
              <div className="edit-socio-tab-content">

                <div className="edit-socio-input-group">
                  <div className="edit-fl-wrapper always-active">
                    <label htmlFor="id_cat_monto" className="edit-fl-label">Categoría *</label>
                    <select
                      id="id_cat_monto"
                      value={id_cat_monto || ''}
                      onChange={(e) => setIdCatMonto(e.target.value)}
                      className="edit-socio-input edit-select"
                    >
                      <option value="" disabled>Seleccione una categoría</option>
                      {categorias.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.nombre}{c.monto_mensual!=null ? ` — $${Number(c.monto_mensual).toLocaleString('es-AR')}/mes` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'otros' && (
              <div className="edit-socio-tab-content">
                <div className="edit-socio-input-group">
                  <div className="edit-socio-floating-label-wrapper">
                    <textarea
                      placeholder=" "
                      className="edit-socio-input edit-socio-textarea"
                      id="observaciones"
                      rows="4"
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                    />
                    <label htmlFor="observaciones" className={`edit-socio-floating-label ${observaciones ? 'edit-socio-floating-label-filled' : ''}`}>
                      Observaciones
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="edit-socio-buttons-container">
              <button
                type="button"
                onClick={guardarAlumno}
                className="edit-socio-button"
                aria-label="Guardar"
                title="Guardar"
              >
                <FontAwesomeIcon icon={faSave} className="edit-socio-icon-button" />
                <span className="btn-text">Guardar</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/alumnos')}
                className="edit-socio-back-button"
                aria-label="Volver"
                title="Volver"
              >
                <FontAwesomeIcon icon={faArrowLeft} className="edit-socio-icon-button" />
                <span className="btn-text">Volver</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EditarAlumno;
