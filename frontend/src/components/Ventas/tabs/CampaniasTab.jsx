import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faEye, faEyeSlash, faPowerOff, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { asBool, money } from "../ventasConfig";

export default function CampaniasTab({ tableTabs, campanias, onAdd, onEdit, onDelete, onToggleActivo, loading = false }) {
  return (
    <section className="ventas-card ventas-table-card ventas-full-card">
      <div className="ventas-card-head ventas-card-head--stack">
        <div className="ventas-card-tabs-slot">
          {tableTabs}
        </div>
        <button type="button" className="ventas-primary" onClick={onAdd}>
          <FontAwesomeIcon icon={faPlus} /> Nueva venta
        </button>
      </div>

      <div className="ventas-table-wrap ventas-table-wrap--center">
        <div className="ventas-div-table ventas-div-table--campanias" role="table" aria-label="Ventas configuradas">
          <div className="ventas-div-head" role="rowgroup">
            <div className="ventas-div-row ventas-div-row--head" role="row">
              <div className="ventas-div-cell" role="columnheader">Venta</div>
              <div className="ventas-div-cell" role="columnheader">Identificación</div>
              <div className="ventas-div-cell ventas-div-cell--principal-precios" role="columnheader">Principal / precios</div>
              <div className="ventas-div-cell" role="columnheader">Conceptos</div>
              <div className="ventas-div-cell" role="columnheader">Ventas</div>
              <div className="ventas-div-cell" role="columnheader">Bot</div>
              <div className="ventas-div-cell" role="columnheader">Estado</div>
              <div className="ventas-div-cell" role="columnheader">Fechas</div>
              <div className="ventas-div-cell ventas-div-cell--actions" role="columnheader">Acciones</div>
            </div>
          </div>

          <div className="ventas-div-body" role="rowgroup">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={`skeleton-campania-${i}`} className="ventas-div-row ventas-skeleton-row" role="row" aria-hidden="true">
                  {Array.from({ length: 9 }).map((__, j) => (
                    <div key={j} className="ventas-div-cell"><span className="ventas-skeleton-line" /></div>
                  ))}
                </div>
              ))
            ) : campanias.length === 0 ? (
              <div className="ventas-empty-cell" role="row">No hay ventas cargadas todavía.</div>
            ) : (
              campanias.map((c) => {
                const activo = asBool(c.activo);
                return (
                  <div key={c.id_campania} className={`ventas-div-row ${!activo ? "ventas-row-muted" : ""}`} role="row">
                    <div className="ventas-div-cell ventas-div-cell--main" role="cell">
                      <strong>{c.nombre}</strong>
                      <span>Venta #{c.id_campania}</span>
                    </div>
                    <div className="ventas-div-cell ventas-div-cell--main" role="cell">
                      <strong>DNI persona/socio</strong>
                      <span>{c.pregunta_persona || "Sin pregunta configurada."}</span>
                    </div>
                    <div className="ventas-div-cell ventas-div-cell--main ventas-div-cell--principal-precios" role="cell">
                      <strong>{c.producto_principal_nombre || "Sin producto"}</strong>
                      <span>
                        {c.producto_principal_nombre
                          ? `Ant. ${money(c.producto_principal_precio_anticipada ?? c.producto_principal_precio)} · Puerta ${money(c.producto_principal_precio_puerta ?? c.producto_principal_precio)}`
                          : "Seleccioná un producto para mostrarla en el bot."}
                      </span>
                    </div>
                    <div className="ventas-div-cell" role="cell">{c.productos_activos || 0}</div>
                    <div className="ventas-div-cell" role="cell">{c.ordenes_total || 0}</div>
                    <div className="ventas-div-cell" role="cell">
                      <span className={`ventas-status ${asBool(c.disponible_menu) ? "ok" : "muted"}`}>
                        <FontAwesomeIcon icon={asBool(c.disponible_menu) ? faEye : faEyeSlash} />
                        {asBool(c.disponible_menu) ? "Visible" : "Oculta"}
                      </span>
                    </div>
                    <div className="ventas-div-cell" role="cell">
                      <span className={`ventas-status ${activo ? "ok" : "muted"}`}>
                        {activo ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                    <div className="ventas-div-cell ventas-div-cell--main" role="cell">
                      <strong>{c.fecha_inicio ? String(c.fecha_inicio).slice(0, 10) : "Sin inicio"}</strong>
                      <span>{c.fecha_fin ? `Hasta ${String(c.fecha_fin).slice(0, 10)}` : "Sin fin"}</span>
                    </div>
                    <div className="ventas-div-cell ventas-row-actions" role="cell">
                      <button type="button" onClick={() => onEdit(c)} title="Editar venta">
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        type="button"
                        className={activo ? "warning" : "success"}
                        onClick={() => onToggleActivo(c)}
                        title={activo ? "Dar de baja venta" : "Activar venta"}
                      >
                        <FontAwesomeIcon icon={faPowerOff} />
                      </button>
                      <button type="button" className="danger" onClick={() => onDelete(c)} title="Eliminar venta definitivamente">
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
