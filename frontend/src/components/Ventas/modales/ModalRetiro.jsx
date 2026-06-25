import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle, faClock, faSave } from "@fortawesome/free-solid-svg-icons";
import ModalBase from "./ModalBase";
import "./ModalRetiro.css";
import { asBool } from "../ventasConfig";

export default function ModalRetiro({ abierto, orden, saving, onClose, onSubmit }) {
  const [retirado, setRetirado] = useState(0);

  useEffect(() => {
    if (abierto) {
      setRetirado(asBool(orden?.retirado) ? 1 : 0);
    }
  }, [abierto, orden]);

  if (!abierto || !orden) return null;

  const nombre = orden.persona_nombre || "Sin nombre informado";
  const venta = orden.campania_nombre || "Venta del club";
  const codigo = orden.codigo_orden || "Sin código";

  return (
    <ModalBase
      abierto={abierto}
      titulo="Estado de retiro"
      subtitulo="Marcá si la persona ya pasó por Cooperadora a retirar la entrada o producto."
      onClose={saving ? undefined : onClose}
      size="sm"
      className="ventas-modal--retiro"
    >
      <div className="ventas-modal__body ventas-retiro-modal__body">
        <div className="ventas-retiro-resumen">
          <div>
            <span>Código</span>
            <strong>{codigo}</strong>
          </div>
          <div>
            <span>Venta</span>
            <strong>{venta}</strong>
          </div>
          <div>
            <span>Nombre</span>
            <strong>{nombre}</strong>
          </div>
        </div>

        <div className="ventas-retiro-options" role="radiogroup" aria-label="Estado de retiro">
          <button
            type="button"
            className={`ventas-retiro-option ${retirado === 0 ? "active" : ""}`}
            onClick={() => setRetirado(0)}
            disabled={saving}
          >
            <FontAwesomeIcon icon={faClock} />
            <span>
              <strong>Pendiente</strong>
              <small>Todavía no retiró la entrada o producto.</small>
            </span>
          </button>

          <button
            type="button"
            className={`ventas-retiro-option ${retirado === 1 ? "active" : ""}`}
            onClick={() => setRetirado(1)}
            disabled={saving}
          >
            <FontAwesomeIcon icon={faCheckCircle} />
            <span>
              <strong>Retirado</strong>
              <small>Ya pasó por Cooperadora y se entregó.</small>
            </span>
          </button>
        </div>
      </div>

      <footer className="ventas-modal__footer ventas-retiro-modal__footer">
        <button type="button" className="ventas-modal-cancel" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button type="button" className="ventas-modal-danger ventas-modal-save" onClick={() => onSubmit(retirado)} disabled={saving}>
          <FontAwesomeIcon icon={faSave} /> {saving ? "Guardando..." : "Guardar estado"}
        </button>
      </footer>
    </ModalBase>
  );
}
