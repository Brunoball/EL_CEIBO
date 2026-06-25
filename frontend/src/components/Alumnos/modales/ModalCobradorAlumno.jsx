// ✅ REEMPLAZAR COMPLETO
// src/components/Alumnos/ModalCobradorAlumno.jsx
import React, { useEffect, useMemo } from "react";
import "./ModalCobradorAlumno.css";

const ModalCobradorAlumno = ({ mostrar, alumno, nuevoValor, onClose, onConfirm }) => {
  // Cerrar con ESC
  useEffect(() => {
    if (!mostrar) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mostrar, onClose]);

  const nombre = useMemo(() => {
    const ap = (alumno?.apellido ?? "").trim();
    const no = (alumno?.nombre ?? "").trim();
    const armado = `${ap} ${no}`.trim();
    return armado || `Socio #${alumno?.id_alumno ?? "-"}`;
  }, [alumno]);

  if (!mostrar) return null;

  const esAsignar = Number(nuevoValor) === 1;

  return (
    <div
      className="mi-modal__overlay mi-modal__overlay--cobrador"
      onClick={(e) => e.target.classList.contains("mi-modal__overlay") && onClose?.()}
    >
      <div
        className="mi-modal__container mi-modal__container--cobrador"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (mismo look que InfoAlumno) */}
        <div className="mi-modal__header">
          <div className="mi-modal__head-left">
            <h2 className="mi-modal__title">
              {esAsignar ? "Asignar cobrador a domicilio" : "Quitar cobrador a domicilio"}
            </h2>
            <p className="mi-modal__subtitle">
              ID: {alumno?.id_alumno ?? "-"} &nbsp;|&nbsp; {nombre}
            </p>
          </div>

          <button className="mi-modal__close" onClick={onClose} aria-label="Cerrar">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Contenido (cards como InfoAlumno) */}
        <div className="mi-modal__content mi-modal__content--cobrador">
          <section className="mi-tabpanel is-active mi-tabpanel--cobrador">
            <div className="mi-grid mi-grid--cobrador">
              <article className="mi-card mi-card--full">
                <h3 className="mi-card__title">Confirmación</h3>

                <div className="mi-row mi-row--block">
                  <span className="mi-label">Acción</span>
                  <span className="mi-value mi-value--multiline">
                    {esAsignar
                      ? "El socio pasará a ser visitado por el cobrador en su domicilio."
                      : "El socio dejará de ser visitado por el cobrador en su domicilio."}
                  </span>
                </div>

                <div className="mi-sep" />

                <div className="mi-row">
                  <span className="mi-label">Socio</span>
                  <span className="mi-value">{nombre}</span>
                </div>

                <div className="mi-row mi-row--block">
                  <span className="mi-label">Importante</span>
                  <span className="mi-value mi-value--multiline">
                    Esta opción solo organiza la modalidad de cobro. El monto de la cuota (Interno/Externo) no se modifica.
                  </span>
                </div>
              </article>
            </div>
          </section>
        </div>

        {/* Acciones (mismo lenguaje visual) */}
        <div className="mi-modal__actions">
          <button className="mi-btn mi-btn--ghost" onClick={onClose}>
            Cancelar
          </button>

          <button
            className={`mi-btn mi-btn--primary ${esAsignar ? "is-ok" : "is-danger"}`}
            onClick={onConfirm}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalCobradorAlumno;