import React, { useEffect, useMemo } from "react";
import { FaTrash } from "react-icons/fa";
import "./ModalEliminarAlumno.css";

const ModalEliminarAlumno = ({ mostrar, alumno, onClose, onEliminar }) => {
  // 🔑 Cerrar con ESC (misma lógica que el modal de empresa)
  useEffect(() => {
    if (!mostrar) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mostrar, onClose]);

  const nombreMostrado = useMemo(() => {
    if (!alumno) return "";
    const partes = [
      alumno?.apellido ?? "",
      alumno?.nombre ?? "",
      alumno?.nombre_completo ?? "",
      alumno?.nombreyapellido ?? "",
      alumno?.nyap ?? "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return partes || alumno?.nombre || "";
  }, [alumno]);

  if (!mostrar || !alumno) return null;

  return (
    <div
      className="empdel-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aludel-title"
      onClick={onClose} // conservar cierre por click fuera (comportamiento socios)
    >
      <div
        className="empdel-modal empdel-modal--danger"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="empdel-modal__icon" aria-hidden="true">
          <FaTrash />
        </div>

        <h3 id="aludel-title" className="empdel-modal__title">
          Eliminar permanentemente
        </h3>

        <p className="empdel-modal__body">
          ¿Deseás eliminar al socio <strong>{nombreMostrado}</strong>? Esta acción no se
          puede deshacer.
        </p>

        <div className="empdel-modal__actions">
          <button
            type="button"
            className="empdel-btn empdel-btn--ghost"
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="empdel-btn empdel-btn--solid-danger"
            onClick={() => onEliminar(alumno.id_alumno)}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalEliminarAlumno;
