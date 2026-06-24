// src/components/Alumnos/AgregarAlumno.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faArrowLeft, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import './AgregarAlumno.css';

const AgregarAlumno = () => {
  const navigate = useNavigate();

  const [listas, setListas] = useState({
    categorias: [],          // única categoría del club: categoria_monto
    tipos_documentos: [],
    sexos: [],
    loaded: false
  });

  const [formData, setFormData] = useState({
    apellido: '',
    nombre: '',
    id_tipo_documento: '',
    num_documento: '',
    id_sexo: '',
    domicilio: '',
    localidad: '',
    telefono: '',
    id_cat_monto: '',
    observaciones: ''
  });

  const [toast, setToast] = useState({ show: false, message: '', type: 'exito' });
  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState(null);

  const [currentStep, setCurrentStep] = useState(1);
  const enterBloqueadoRef = useRef(false);

  // ===== Modal de confirmar volver =====
  const [confirmBackOpen, setConfirmBackOpen] = useState(false);

  // ⚠️ Solo consideramos "campos de usuario" para detectar cambios (ignoramos id_tipo_documento auto-preseleccionado)
  const USER_DIRTY_KEYS = [
    'apellido', 'nombre', 'num_documento', 'id_sexo', 'domicilio', 'localidad', 'telefono',
    'id_cat_monto', 'observaciones'
  ];
  const isDirty = useMemo(() => {
    return USER_DIRTY_KEYS.some(k => (formData[k] ?? '').toString().trim() !== '');
  }, [formData]);

  const showToast = (message, type = 'exito', duracion = 3000) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type }), duracion);
  };

  const normalize = (s) =>
    (s || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

  useEffect(() => {
    const fetchListas = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE_URL}/api.php?action=obtener_listas`);
        const json = await res.json();

        if (json.exito) {
          const {
            categorias,
            tipos_documentos,
            sexos
          } = json.listas || {};

          const td = Array.isArray(tipos_documentos) ? tipos_documentos : [];

          setListas({
            categorias: Array.isArray(categorias) ? categorias : [],
            tipos_documentos: td,
            sexos: Array.isArray(sexos) ? sexos : [],
            loaded: true
          });

          // Preseleccionar DNI si no hay selecc. (esto ya no marca dirty)
          if (!formData.id_tipo_documento && td.length) {
            const dniOption =
              td.find(t => (t.sigla || '').toUpperCase() === 'DNI') ||
              td.find(t => normalize(t.descripcion).includes('DOCUMENTO NACIONAL DE IDENTIDAD'));
            if (dniOption?.id != null) {
              setFormData(prev => ({ ...prev, id_tipo_documento: String(dniOption.id) }));
            }
          }
        } else {
          showToast('Error al cargar listas: ' + (json.mensaje || 'desconocido'), 'error');
        }
      } catch (err) {
        showToast('Error de conexión: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchListas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validarCampo = (name, value) => {
    const soloNumeros = /^[0-9]+$/;
    const telValido = /^[0-9-]+$/;
    const textoValido = /^[A-ZÑa-zñáéíóúÁÉÍÓÚ0-9\s.,-]*$/;

    switch (name) {
      case 'apellido':
        if (!value || !value.trim()) return 'obligatorio';
        if (!/^[A-ZÑa-zñáéíóúÁÉÍÓÚ\s.]+$/u.test(value)) return 'formato inválido';
        if (value.length > 100) return 'máximo 100 caracteres';
        break;
      case 'nombre':
        if (!value || !value.trim()) return 'obligatorio';
        if (!/^[A-ZÑa-zñáéíóúÁÉÍÓÚ\s.]+$/u.test(value)) return 'formato inválido';
        if (value.length > 100) return 'máximo 100 caracteres';
        break;
      case 'num_documento':
        if (!value || !value.trim()) return 'obligatorio';
        if (!soloNumeros.test(value)) return 'solo números';
        if (value.length > 20) return 'máximo 20 caracteres';
        break;
      case 'id_tipo_documento':
      case 'id_sexo':
      case 'id_cat_monto':
        if (['id_tipo_documento','id_sexo','id_cat_monto'].includes(name)) {
          if (!value) return 'obligatorio';
        }
        if (value !== '' && isNaN(Number(value))) return 'valor inválido';
        break;
      case 'domicilio':
        if (!value || !value.trim()) return 'obligatorio';
        if (value && !textoValido.test(value)) return 'caracteres inválidos';
        if (value && value.length > 150) return 'máximo 150 caracteres';
        break;
      case 'localidad':
        if (value && !textoValido.test(value)) return 'caracteres inválidos';
        if (value && value.length > 100) return 'máximo 100 caracteres';
        break;
      case 'telefono':
        if (value && (!telValido.test(value) || value.length > 20)) return 'solo números y guiones (-), máx 20';
        break;
      case 'observaciones':
        return null;
      default:
        return null;
    }
    return null;
  };

  // Paso 1: TODOS obligatorios
  const validarPaso1 = () => {
    const campos = ['apellido','nombre','id_tipo_documento','num_documento','id_sexo'];
    const faltantes = [];
    const invalidos = [];

    campos.forEach((k) => {
      const err = validarCampo(k, formData[k]);
      if (err === 'obligatorio') faltantes.push(k);
      else if (err) invalidos.push(k);
    });

    const labels = {
      apellido: 'Apellido',
      nombre: 'Nombre',
      id_tipo_documento: 'Tipo de documento',
      num_documento: 'Documento',
      id_sexo: 'Sexo',
    };

    if (faltantes.length || invalidos.length) {
      const p1 = faltantes.length ? `Completá: ${faltantes.map(k => labels[k]).join(', ')}` : '';
      const p2 = invalidos.length ? `Revisá: ${invalidos.map(k => labels[k]).join(', ')}` : '';
      showToast([p1, p2].filter(Boolean).join(' | '), 'error');
      return false;
    }
    return true;
  };

  // Paso 2: domicilio obligatorio
  const validarPaso2 = () => {
    const errDom = validarCampo('domicilio', formData.domicilio);
    if (errDom) {
      showToast('Completá: Domicilio', 'error');
      return false;
    }
    return true;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'telefono') {
      const cleaned = value.replace(/[^0-9-]/g, '');
      if (cleaned !== value) showToast('Teléfono: solo números y guiones (-).', 'error');
      const limited = cleaned.slice(0, 20);
      setFormData(prev => ({ ...prev, [name]: limited }));
      return;
    }

    const toUpper = (v) => (typeof v === 'string' ? v.toUpperCase() : v);
    const nextVal =
      ['apellido', 'nombre', 'domicilio', 'localidad'].includes(name)
        ? toUpper(value)
        : value;

    setFormData(prev => ({ ...prev, [name]: nextVal }));
  };

  const handleFocus = (fieldName) => setActiveField(fieldName);
  const handleBlur = () => setActiveField(null);

  const handleNextStep = () => {
    if (currentStep === 1 && !validarPaso1()) return;
    if (currentStep === 2 && !validarPaso2()) return;
    setCurrentStep(s => Math.min(3, s + 1));
  };
  const handlePrevStep = () => setCurrentStep(s => Math.max(1, s - 1));

  const handleFormKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentStep < 3) {
        e.stopPropagation();
        enterBloqueadoRef.current = true;
        handleNextStep();
      }
    }
  };
  const handleFormKeyUp = (e) => {
    if (e.key === 'Enter' && enterBloqueadoRef.current) {
      e.preventDefault();
      e.stopPropagation();
      enterBloqueadoRef.current = false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentStep !== 3) return;

    const labels = {
      apellido: 'Apellido',
      nombre: 'Nombre',
      id_tipo_documento: 'Tipo de documento',
      num_documento: 'Documento',
      id_sexo: 'Sexo',
      domicilio: 'Domicilio',
      localidad: 'Localidad',
      telefono: 'Teléfono',
      id_cat_monto: 'Categoría',
      observaciones: 'Observaciones'
    };

    // Obligatorios globales (incluye Domicilio)
    const obligatorios = [
      'apellido', 'nombre', 'id_tipo_documento', 'num_documento', 'id_sexo',
      'domicilio',
      'id_cat_monto'
    ];

    const faltantes = [];
    const invalidos = [];

    obligatorios.forEach((k) => {
      const val = formData[k];
      if (!val || !String(val).trim()) faltantes.push(labels[k]);
    });

    Object.entries(formData).forEach(([k, v]) => {
      const err = validarCampo(k, v);
      if (err && (v || obligatorios.includes(k))) invalidos.push(labels[k] || k);
    });

    if (faltantes.length || invalidos.length) {
      const partes = [];
      if (faltantes.length) partes.push(`Completá: ${faltantes.join(', ')}`);
      if (invalidos.length) partes.push(`Revisá: ${invalidos.join(', ')}`);
      showToast(partes.join(' | '), 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/api.php?action=agregar_alumno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();

      if (data.exito) {
        showToast('Socio agregado correctamente', 'exito');
        setTimeout(() => navigate('/alumnos'), 1800);
      } else {
        showToast(data.mensaje || 'Revisá los datos e intentá nuevamente.', 'error');
      }
    } catch (error) {
      showToast('Error de conexión con el servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

  const ProgressSteps = () => (
    <div className="progress-steps">
      {[1, 2, 3].map((step) => (
        <div
          key={step}
          className={`progress-step ${currentStep === step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}
          onClick={() => currentStep > step && setCurrentStep(step)}
        >
          <div className="step-number">{step}</div>
          <div className="step-label">
            {step === 1 && 'Identificación'}
            {step === 2 && 'Contacto y Domicilio'}
            {step === 3 && 'Datos de cuota'}
          </div>
        </div>
      ))}
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${((currentStep - 1) / 2) * 100}%` }} />
      </div>
    </div>
  );

  // === Volver con confirmación si hay datos cargados ===
  const handleBackClick = () => {
    if (isDirty) {
      setConfirmBackOpen(true);
    } else {
      navigate('/alumnos');
    }
  };
  const confirmExit = () => {
    setConfirmBackOpen(false);
    navigate('/alumnos');
  };
  const cancelExit = () => setConfirmBackOpen(false);

  return (
    <div className="add-alumno-container">
      <div className="add-alumno-box">
        {toast.show && (
          <Toast
            tipo={toast.type}
            mensaje={toast.message}
            onClose={() => setToast({ show: false, message: '', type: 'exito' })}
            duracion={3000}
          />
        )}

        <div className="add-header">
          <div className="add-icon-title">
            <FontAwesomeIcon icon={faUserPlus} className="add-icon" />
            <div>
              <h1>Agregar Nuevo Socio</h1>
              <p>Completá los datos del socio</p>
            </div>
          </div>

        <button
          className="add-back-btn"
          onClick={handleBackClick}
          disabled={loading}
          type="button"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          Volver
        </button>
        </div>

        <ProgressSteps />

        <form
          onSubmit={handleSubmit}
          className="add-alumno-form"
          onKeyDown={handleFormKeyDown}
          onKeyUp={handleFormKeyUp}
        >
          {/* PASO 1 */}
          {currentStep === 1 && (
            <div className="add-alumno-section">
              <h3 className="add-alumno-section-title">Identificación</h3>
              <div className="add-alumno-section-content">
                <div className="add-group">
                  <div className={`add-input-wrapper ${formData.apellido || activeField === 'apellido' ? 'has-value' : ''}`} style={{ flex: 1 }}>
                    <label className="add-label">Apellido *</label>
                    <input
                      name="apellido"
                      value={formData.apellido}
                      onChange={handleChange}
                      onFocus={() => handleFocus('apellido')}
                      onBlur={handleBlur}
                      className="add-input"
                    />
                    <span className="add-input-highlight" />
                  </div>

                  <div className={`add-input-wrapper ${formData.nombre || activeField === 'nombre' ? 'has-value' : ''}`} style={{ flex: 1 }}>
                    <label className="add-label">Nombre *</label>
                    <input
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleChange}
                      onFocus={() => handleFocus('nombre')}
                      onBlur={handleBlur}
                      className="add-input"
                    />
                    <span className="add-input-highlight" />
                  </div>
                </div>

                <div className="add-group">
                  <div className="add-input-wrapper always-active" style={{ flex: 1 }}>
                    <label className="add-label">Tipo de documento *</label>
                    <select
                      name="id_tipo_documento"
                      value={formData.id_tipo_documento}
                      onChange={handleChange}
                      onFocus={() => handleFocus('id_tipo_documento')}
                      onBlur={handleBlur}
                      className="add-input"
                      disabled={loading || !listas.loaded}
                    >
                      <option value="">Seleccionar</option>
                      {listas.tipos_documentos.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.descripcion}{t.sigla ? ` (${t.sigla})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={`add-input-wrapper ${formData.num_documento || activeField === 'num_documento' ? 'has-value' : ''}`} style={{ flex: 1 }}>
                    <label className="add-label">Documento *</label>
                    <input
                      name="num_documento"
                      value={formData.num_documento}
                      onChange={handleChange}
                      onFocus={() => handleFocus('num_documento')}
                      onBlur={handleBlur}
                      className="add-input"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                    <span className="add-input-highlight" />
                  </div>

                  <div className="add-input-wrapper always-active" style={{ flex: 1 }}>
                    <label className="add-label">Sexo *</label>
                    <select
                      name="id_sexo"
                      value={formData.id_sexo}
                      onChange={handleChange}
                      onFocus={() => handleFocus('id_sexo')}
                      onBlur={handleBlur}
                      className="add-input"
                      disabled={loading || !listas.loaded}
                    >
                      <option value="">Seleccionar</option>
                      {listas.sexos.map(s => (
                        <option key={s.id} value={s.id}>{s.sexo}</option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* PASO 2 */}
          {currentStep === 2 && (
            <div className="add-alumno-section">
              <h3 className="add-alumno-section-title">Contacto y Domicilio</h3>
              <div className="add-alumno-section-content">

                <div className="add-group">
                  <div
                    className={`add-input-wrapper ${formData.telefono || activeField === 'telefono' ? 'has-value' : ''}`}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <label className="add-label">Teléfono</label>
                    <input
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleChange}
                      onFocus={() => handleFocus('telefono')}
                      onBlur={handleBlur}
                      className="add-input"
                      type="tel"
                      inputMode="tel"
                      pattern="[0-9-]*"
                    />
                    <span className="add-input-highlight" />
                  </div>

                  <div
                    className={`add-input-wrapper ${formData.domicilio || activeField === 'domicilio' ? 'has-value' : ''}`}
                    style={{ flex: 2, minWidth: 0 }}
                  >
                    <label className="add-label">Domicilio *</label>
                    <input
                      name="domicilio"
                      value={formData.domicilio}
                      onChange={handleChange}
                      onFocus={() => handleFocus('domicilio')}
                      onBlur={handleBlur}
                      className="add-input"
                    />
                    <span className="add-input-highlight" />
                  </div>

                  <div
                    className={`add-input-wrapper ${formData.localidad || activeField === 'localidad' ? 'has-value' : ''}`}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <label className="add-label">Localidad</label>
                    <input
                      name="localidad"
                      value={formData.localidad}
                      onChange={handleChange}
                      onFocus={() => handleFocus('localidad')}
                      onBlur={handleBlur}
                      className="add-input"
                    />
                    <span className="add-input-highlight" />
                  </div>
                </div>

                <div className="add-group">
                  <div className="add-input-wrapper always-active" style={{ width: '100%' }}>
                    <label className="add-label">Observaciones</label>
                    <textarea
                      name="observaciones"
                      value={formData.observaciones}
                      onChange={handleChange}
                      onFocus={() => handleFocus('observaciones')}
                      onBlur={handleBlur}
                      className="add-textarea"
                      rows={4}
                      placeholder="Notas internas, aclaraciones, referencias, etc."
                    />
                    <span className="add-input-highlight" />
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* PASO 3 */}
          {currentStep === 3 && (
            <div className="add-alumno-section">
              <h3 className="add-alumno-section-title">Datos de cuota</h3>
              <div className="add-alumno-section-content">

                <div className="add-group">
                  <div className="add-input-wrapper always-active" style={{ flex: 1, minWidth: 0 }}>
                    <label className="add-label">Categoría *</label>
                    <select
                      name="id_cat_monto"
                      value={formData.id_cat_monto}
                      onChange={handleChange}
                      onFocus={() => handleFocus('id_cat_monto')}
                      onBlur={handleBlur}
                      className="add-input"
                      disabled={loading || !listas.loaded}
                    >
                      <option value="">Seleccionar categoría</option>
                      {listas.categorias.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}{(c.monto_mensual!=null) ? ` — $${Number(c.monto_mensual).toLocaleString('es-AR')}/mes` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>
            </div>
          )}

          <div className="add-alumno-buttons-container">
            {currentStep > 1 && (
              <button
                key="prev"
                type="button"
                className="add-alumno-button prev-step"
                onClick={handlePrevStep}
                data-mobile-label="Volver"
              >
                <FontAwesomeIcon icon={faArrowLeft} className="add-icon-button" />
                <span className="add-button-text">Anterior</span>
              </button>
            )}

            {currentStep < 3 ? (
              <button
                key="next"
                type="button"
                className="add-alumno-button next-step"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNextStep();
                }}
              >
                <span className="add-button-text">Siguiente</span>
              </button>
            ) : (
              <button
                key="submit"
                type="submit"
                className="add-alumno-button"
                disabled={loading}
                data-mobile-label="Guardar"
              >
                <FontAwesomeIcon icon={faSave} className="add-icon-button" />
                <span className="add-button-text">{loading ? 'Guardando...' : 'Guardar Socio'}</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ===== Modal confirmar volver sin guardar ===== */}
      {confirmBackOpen && (
        <div className="confirm-exit-overlay" role="dialog" aria-modal="true">
          <div className="confirm-exit-card">
            <h3>¿Salir sin guardar?</h3>
              <div className="confirm-exit-icon">
    <FontAwesomeIcon icon={faTriangleExclamation} />
  </div>
            <p>Vas a perder todos los datos que estabas cargando.</p>
            <div className="confirm-exit-actions">
              <button className="btn-cancel" onClick={cancelExit}>Cancelar</button>
              <button className="btn-danger" onClick={confirmExit}>Salir y descartar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgregarAlumno;
