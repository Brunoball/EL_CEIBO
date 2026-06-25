// src/components/Cuotas/modales/ModalEliminarCondonacion.jsx
import React, { useState } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalEliminarCondonacion.css';

const ModalEliminarCondonacion = ({ socio, periodo, periodoTexto, anioPago, onClose, onEliminado }) => {
  const [toast, setToast] = useState(null);
  const [cargando, setCargando] = useState(false);

  const mostrarToast = (tipo, mensaje, duracion = 3000) =>
    setToast({ tipo, mensaje, duracion });

  const handleEliminar = async () => {
    setCargando(true);
    try {
      // Tolerante con nombres alternativos
      const id_alumno = socio?.id_alumno ?? socio?.id_socio ?? socio?.id ?? 0;
      const id_mes = Number(periodo ?? socio?.id_mes ?? socio?.id_periodo ?? 0);
      const anio = Number(anioPago ?? socio?.anio_aplicado ?? new Date().getFullYear());

      if (!id_alumno || !id_mes || !anio) {
        mostrarToast('error', 'Faltan datos para eliminar la condonación.');
        setCargando(false);
        return;
      }

      // Primero detectamos el registro real. Esto evita borrar otra cosa
      // y también resuelve condonaciones anuales o por mitad.
      const resBuscar = await fetch(`${BASE_URL}/api.php?action=buscar_pago_eliminar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_alumno, id_mes, anio }),
      });

      const info = await resBuscar.json().catch(() => ({}));
      if (!info?.exito || !info?.id_pago) {
        mostrarToast('error', info?.mensaje || 'No se encontró la condonación para eliminar.');
        return;
      }

      if (info.estado !== 'condonado') {
        mostrarToast('error', 'El registro encontrado no es una condonación.');
        return;
      }

      const res = await fetch(`${BASE_URL}/api.php?action=eliminar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_pago: Number(info.id_pago),
          id_alumno,
          id_mes,
          id_mes_real: Number(info.id_mes_real || id_mes),
          anio,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (data?.exito) {
        mostrarToast('exito', 'Condonación eliminada correctamente');
        setTimeout(() => {
          onEliminado?.();
          onClose?.();
        }, 700);
      } else {
        mostrarToast('error', data?.mensaje || 'No se pudo eliminar la condonación.');
      }
    } catch (e) {
      console.error(e);
      mostrarToast('error', 'Error al conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  if (!socio) return null;

  return (
    <>
      {/* Toast por encima del overlay */}
      <div className="toast-fixed-container">
        {toast && (
          <Toast
            tipo={toast.tipo}
            mensaje={toast.mensaje}
            duracion={toast.duracion}
            onClose={() => setToast(null)}
          />
        )}
      </div>

      <div className="soc-modal-overlay-eliminar" role="dialog" aria-modal="true">
        <div className="soc-modal-contenido-eliminar" role="document">
          <div className="soc-modal-icono-eliminar" aria-hidden="true">
            <FaExclamationTriangle />
          </div>

          <h3 className="soc-modal-titulo-eliminar">Eliminar Condonación</h3>

          <p className="soc-modal-texto-eliminar">
            ¿Deseás eliminar la condonación del alumno{' '}
            <strong>{socio?.nombre ?? socio?.apellido_nombre ?? '—'}</strong>{' '}
            para el período <strong>{periodoTexto ?? periodo}</strong>?
          </p>

          <div className="soc-modal-botones-eliminar">
            <button
              className="soc-boton-cancelar-eliminar"
              onClick={onClose}
              disabled={cargando}
            >
              Cancelar
            </button>
            <button
              className="soc-boton-confirmar-eliminar"
              onClick={handleEliminar}
              disabled={cargando}
            >
              {cargando ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalEliminarCondonacion;
