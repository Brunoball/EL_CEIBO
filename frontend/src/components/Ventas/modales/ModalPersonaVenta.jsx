import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faIdCard, faSave, faUserPlus } from "@fortawesome/free-solid-svg-icons";
import ModalBase from "./ModalBase";
import "./ModalOrden.css";

const limpiarDni = (value) => String(value || "").replace(/\D+/g, "");

export default function ModalPersonaVenta({ abierto, form, setForm, saving, onClose, onSubmit }) {
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <ModalBase
      abierto={abierto}
      titulo="Agregar nueva persona"
      subtitulo="Cargá una persona manual para poder seleccionarla en ventas registradas."
      onClose={saving ? undefined : onClose}
      className="ventas-modal--persona-venta"
      size="sm"
    >
      <form className="ventas-form ventas-persona-venta-form" onSubmit={onSubmit}>
        <div className="ventas-modal__body ventas-persona-venta-body">
          <div className="ventas-persona-venta-note">
            <span className="ventas-persona-venta-note__icon" aria-hidden="true">
              <FontAwesomeIcon icon={faUserPlus} />
            </span>
            <div>
              <strong>Alta rápida para venta manual</strong>
              <span>Al guardar, queda en el catálogo de personas y se selecciona automáticamente en la venta actual.</span>
            </div>
          </div>

          <label className="ventas-orden-field ventas-floating-field">
            <span className="ventas-floating-label">DNI</span>
            <input
              value={form.dni || ""}
              onChange={(e) => setField("dni", limpiarDni(e.target.value))}
              placeholder="Ej: 30123456"
              inputMode="numeric"
              maxLength={20}
              autoComplete="off"
              required
            />
          </label>

          <label className="ventas-orden-field ventas-floating-field">
            <span className="ventas-floating-label">Nombre y apellido</span>
            <input
              value={form.nombre_apellido || ""}
              onChange={(e) => setField("nombre_apellido", e.target.value.toUpperCase())}
              placeholder="Ej: PEREZ JUAN"
              maxLength={160}
              autoComplete="off"
              required
            />
          </label>

          <label className="ventas-orden-field ventas-floating-field">
            <span className="ventas-floating-label">Observación opcional</span>
            <textarea
              value={form.observacion || ""}
              onChange={(e) => setField("observacion", e.target.value)}
              placeholder="Referencia, referencia o aclaración interna"
              maxLength={255}
              rows={3}
            />
          </label>
        </div>

        <footer className="ventas-modal__footer ventas-persona-venta-footer">
          <button type="button" className="ventas-modal-cancel" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="ventas-primary" type="submit" disabled={saving}>
            <FontAwesomeIcon icon={saving ? faIdCard : faSave} /> {saving ? "Guardando..." : "Guardar persona"}
          </button>
        </footer>
      </form>
    </ModalBase>
  );
}
