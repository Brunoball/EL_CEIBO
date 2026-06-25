import React, { useEffect, useState } from "react";
import { FaUserMinus } from "react-icons/fa";
import "./ModalDarBajaAlumno.css";

const MAX_LEN = 250;

const ModalDarBajaAlumno = ({ mostrar, alumno, onClose, onDarBaja }) => {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");

  // Resetear campos al abrir
  useEffect(() => {
    if (mostrar) {
      setMotivo("");
      setError("");
    }
  }, [mostrar]);

  // 🔑 Cerrar con ESC (copiado del modal de empresa)
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

  if (!mostrar || !alumno) return null;

  const confirmar = () => {
    const txt = motivo.trim();
    if (!txt) {
      setError("Por favor, escribí el motivo de la baja.");
      return;
    }
    onDarBaja(alumno.id_alumno, txt);
  };

  return (
    <div
      className="empbaja-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alubaja-title"
      onClick={onClose} // cerrar al hacer click fuera (comportamiento socios)
    >
      <div
        className="empbaja-modal empbaja-modal--danger"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="empbaja-modal__icon" aria-hidden="true">
          <FaUserMinus />
        </div>

        <h3 id="alubaja-title" className="empbaja-modal__title">
          Confirmar baja de socio
        </h3>

        <p className="empbaja-modal__body">
          ¿Estás seguro de que querés dar de baja a{" "}
          <strong>{alumno?.apellido_nombre ?? alumno?.nombre ?? "—"}</strong>?
        </p>

        {/* Campo MOTIVO (mismo look & feel que empresa) */}
        <div className="empbaja-field">
          <label htmlFor="alubaja-motivo" className="empbaja-label">
            Motivo de la baja <span className="empbaja-asterisk">*</span>
          </label>
          <textarea
            id="alubaja-motivo"
            className="empbaja-textarea"
            placeholder="Escribí el motivo (obligatorio)"
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              if (error) setError("");
            }}
            rows={4}
            maxLength={MAX_LEN}
          />
          <div className="empbaja-helper">
            {motivo.length}/{MAX_LEN}
          </div>
          {error && <div className="empbaja-error">{error}</div>}
        </div>

        <div className="empbaja-modal__actions">
          <button
            type="button"
            className="empbaja-btn empbaja-btn--ghost"
            onClick={onClose}
          >
            Cancelar
          </button>

          {/* Mantengo la validación al click (no deshabilito el botón) */}
          <button
            type="button"
            className="empbaja-btn empbaja-btn--solid-danger"
            onClick={confirmar}
          >
            Dar de baja
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalDarBajaAlumno;
