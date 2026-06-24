import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen, faSave } from "@fortawesome/free-solid-svg-icons";
import ModalBase from "./ModalBase";
import "./ModalCampania.css";
import Toggle from "../Toggle";
import { asBool, money, precioProductoAnticipada, precioProductoPuerta } from "../ventasConfig";

const abrirCalendario = (event) => {
  const input = event.currentTarget;

  if (!input || input.disabled || input.readOnly || typeof input.showPicker !== "function") return;

  try {
    input.showPicker();
  } catch (_) {
    // Algunos navegadores solo permiten abrirlo con una acción directa del usuario.
  }
};

export default function ModalCampania({ abierto, form, setForm, productos = [], saving, onClose, onSubmit }) {
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const seleccionarProducto = (idProducto) => {
    const producto = productos.find((p) => String(p.id_producto) === String(idProducto));

    if (!producto) {
      setForm((prev) => ({
        ...prev,
        id_producto_principal: "",
        producto_nombre: "",
        producto_descripcion: "",
        producto_precio: "",
        producto_precio_anticipada: "",
        producto_precio_puerta: "",
        producto_stock: "",
      }));
      return;
    }

    const precioAnticipada = precioProductoAnticipada(producto);
    const precioPuerta = precioProductoPuerta(producto);

    setForm((prev) => ({
      ...prev,
      id_producto_principal: producto.id_producto || "",
      producto_nombre: producto.nombre || "",
      producto_descripcion: producto.descripcion || "",
      producto_precio: precioAnticipada,
      producto_precio_anticipada: precioAnticipada,
      producto_precio_puerta: precioPuerta,
      producto_stock: producto.stock ?? "",
    }));
  };

  const titulo = form?.id_campania ? "Editar venta" : "Nueva venta";
  const productoSeleccionado = productos.find((p) => String(p.id_producto) === String(form.id_producto_principal));
  const precioAnticipada = productoSeleccionado
    ? precioProductoAnticipada(productoSeleccionado)
    : form.producto_precio_anticipada ?? form.producto_precio;
  const precioPuerta = productoSeleccionado ? precioProductoPuerta(productoSeleccionado) : form.producto_precio_puerta;
  const stockMostrado =
    form.producto_stock === null || form.producto_stock === undefined || form.producto_stock === ""
      ? "Sin límite"
      : form.producto_stock;

  return (
    <ModalBase
      abierto={abierto}
      titulo={titulo}
      subtitulo="Configurá la opción que el bot mostrará para registrar la venta."
      onClose={saving ? undefined : onClose}
      className="ventas-modal--campania"
    >
      <form className="ventas-form" onSubmit={onSubmit}>
        <div className="ventas-modal__body ventas-campania-body">
          <section className="ventas-campania-panel ventas-campania-panel--general">
            <header className="ventas-campania-panel__head">
              <span className="ventas-campania-step">01</span>
              <div>
                <h3>Información visible</h3>
                <p>Nombre y consulta que recibirá la persona en WhatsApp.</p>
              </div>
            </header>

            <div className="ventas-campania-fields">
              <label className="ventas-campania-field ventas-floating-field">
                <span className="ventas-floating-label">Nombre de la opción en el bot</span>
                <input
                  value={form.nombre}
                  onChange={(e) => setField("nombre", e.target.value)}
                  placeholder="Ej: Venta de talitas / Entradas evento del club"
                  maxLength={150}
                  required
                />
              </label>

              <label className="ventas-campania-field ventas-floating-field">
                <span className="ventas-floating-label">Pregunta que verá el usuario en WhatsApp</span>
                <textarea
                  value={form.pregunta_persona || ""}
                  rows={2}
                  onChange={(e) => setField("pregunta_persona", e.target.value)}
                  placeholder="Ingresá el DNI de la persona o socio que va a realizar la compra/pago."
                  required
                />
              </label>
            </div>
          </section>

          <section className="ventas-campania-panel ventas-campania-panel--product">
            <header className="ventas-campania-panel__head">
              <span className="ventas-campania-step">02</span>
              <div>
                <h3>Producto principal</h3>
                <p>Elegí el concepto y verificá los importes que tomará la venta.</p>
              </div>
            </header>

            <label className="ventas-product-selector ventas-floating-field">
              <span className="ventas-product-selector__label ventas-floating-label">
                <FontAwesomeIcon icon={faBoxOpen} /> Producto de la venta
              </span>
              <select
                value={form.id_producto_principal || ""}
                onChange={(e) => seleccionarProducto(e.target.value)}
                required
              >
                <option value="">Seleccioná un producto...</option>
                {productos.map((producto) => (
                  <option key={producto.id_producto} value={producto.id_producto}>
                    {producto.nombre} - Anticipada {money(precioProductoAnticipada(producto))} / Puerta {money(precioProductoPuerta(producto))}
                    {Number(producto.activo) === 1 ? "" : " (inactivo)"}
                  </option>
                ))}
              </select>
              <small>El bot usa el precio anticipada. En ventas manuales se puede elegir anticipada o en puerta.</small>
            </label>

            {productos.length === 0 ? (
              <div className="ventas-admin-note ventas-admin-note--warning">
                Todavía no hay productos cargados. Primero cargá el producto en la pestaña Productos y después volvé a crear la venta.
              </div>
            ) : null}

            {productoSeleccionado ? (
              <div className="ventas-product-resume" aria-label="Resumen del producto seleccionado">
                <article className="ventas-product-resume__main">
                  <span>Producto / concepto</span>
                  <strong>{form.producto_nombre || "Sin producto"}</strong>
                  <small>{form.producto_descripcion || "Sin detalle adicional"}</small>
                </article>

                <article className="ventas-price-chip">
                  <span>Anticipada</span>
                  <strong>{money(precioAnticipada)}</strong>
                </article>

                <article className="ventas-price-chip">
                  <span>En puerta</span>
                  <strong>{money(precioPuerta)}</strong>
                </article>

                <article className="ventas-stock-chip">
                  <span>Stock</span>
                  <strong>{stockMostrado}</strong>
                </article>
              </div>
            ) : (
              <div className="ventas-product-empty">
                Seleccioná un producto para visualizar sus precios y disponibilidad.
              </div>
            )}

            {productoSeleccionado && Number(productoSeleccionado.activo) !== 1 ? (
              <p className="ventas-flow-help ventas-flow-help--danger">
                Este producto está inactivo. Para mostrar esta venta en el bot, activalo desde Productos o elegí otro.
              </p>
            ) : null}
          </section>

          <section className="ventas-campania-panel ventas-campania-panel--availability">
            <header className="ventas-campania-panel__head">
              <span className="ventas-campania-step">03</span>
              <div>
                <h3>Vigencia y visibilidad</h3>
                <p>Definí cuándo estará disponible y si se muestra en el bot.</p>
              </div>
            </header>

            <div className="ventas-form-row ventas-campania-dates">
              <label className="ventas-campania-field ventas-floating-field">
                <span className="ventas-floating-label">Fecha inicio opcional</span>
                <input
                  type="date"
                  value={form.fecha_inicio || ""}
                  onClick={abrirCalendario}
                  onFocus={abrirCalendario}
                  onChange={(e) => setField("fecha_inicio", e.target.value)}
                />
              </label>
              <label className="ventas-campania-field ventas-floating-field">
                <span className="ventas-floating-label">Fecha fin opcional</span>
                <input
                  type="date"
                  value={form.fecha_fin || ""}
                  onClick={abrirCalendario}
                  onFocus={abrirCalendario}
                  onChange={(e) => setField("fecha_fin", e.target.value)}
                />
              </label>
            </div>

            <div className="ventas-toggle-grid ventas-toggle-grid--simple">
              <Toggle
                checked={asBool(form.activo)}
                label="Venta activa"
                hint="Habilitar la venta para que pueda utilizarse"
                onChange={(v) => setField("activo", v ? 1 : 0)}
              />
              <Toggle
                checked={asBool(form.visible_menu)}
                label="Mostrar opción en el bot"
                hint="Mostrar esta opción dentro del menú del bot"
                onChange={(v) => setField("visible_menu", v ? 1 : 0)}
              />
            </div>
          </section>
        </div>

        <footer className="ventas-modal__footer">
          <button type="button" className="ventas-modal-cancel" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="ventas-primary" type="submit" disabled={saving || productos.length === 0}>
            <FontAwesomeIcon icon={faSave} /> {saving ? "Guardando..." : "Guardar venta"}
          </button>
        </footer>
      </form>
    </ModalBase>
  );
}
