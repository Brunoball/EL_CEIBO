import React, { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle, faPlus, faSave, faTrash } from "@fortawesome/free-solid-svg-icons";
import ModalBase from "./ModalBase";
import "./ModalOrden.css";
import {
  asBool,
  estadosOrden,
  normalizarTipoPrecio,
  precioProductoPorTipo,
  precioTipoLabel,
  tiposPrecioProducto,
} from "../ventasConfig";

const today = () => new Date().toISOString().slice(0, 10);

const abrirCalendario = (event) => {
  const input = event.currentTarget;

  if (!input || input.disabled || input.readOnly || typeof input.showPicker !== "function") return;

  try {
    input.showPicker();
  } catch (_) {
    // Algunos navegadores solo permiten abrirlo con una acción directa del usuario.
  }
};

const toNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").replace("$", "").trim();
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

const moneyConCentavos = (value) =>
  toNumber(value).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const precioFormateado = (value) =>
  String(value ?? "").trim() === "" ? "" : moneyConCentavos(value);

const crearItemVacio = (codigo = "ITEM") => ({
  id_producto: "",
  producto_nombre: "",
  columna_codigo: codigo,
  columna_nombre: "",
  cantidad: 1,
  precio_tipo: "anticipada",
  precio_unitario: "",
});

const crearItemDesdeCampania = (campania) => ({
  id_producto: campania?.id_producto_principal || "",
  producto_nombre: campania?.producto_principal_nombre || "",
  columna_codigo: "VEN",
  columna_nombre: campania?.producto_principal_nombre || "Venta",
  cantidad: 1,
  precio_tipo: "anticipada",
  precio_unitario: campania?.producto_principal_precio_anticipada ?? campania?.producto_principal_precio ?? "",
});

const limpiarDni = (value) => String(value || "").replace(/\D+/g, "");

const nombreSocio = (socio) => {
  const apellido = String(socio?.apellido || "").trim();
  const nombre = String(socio?.nombre || "").trim();
  return `${apellido} ${nombre}`.trim();
};

const referenciaSocio = (socio) => {
  return String(socio?.categoria_nombre || socio?.catm_nombre || "").trim();
};

const opcionSocio = (socio) => {
  const dni = limpiarDni(socio?.dni || socio?.num_documento);
  const referencia = referenciaSocio(socio);
  const activo = Number(socio?.activo) === 0 ? " - BAJA" : "";
  return `${dni} - ${nombreSocio(socio)}${referencia ? ` (${referencia})` : ""}${activo}`.trim();
};

const opcionPersonaVenta = (persona) => {
  const dni = limpiarDni(persona?.dni);
  const nombre = String(persona?.nombre_apellido || "").trim();
  const origen = persona?.origen ? ` (${persona.origen})` : "";
  return `${dni} - ${nombre}${origen}`.trim();
};

const normalizarBusqueda = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const filtrarOpcionesCatalogo = (itemsCatalogo, getLabel, busqueda, limite = 45) => {
  const q = normalizarBusqueda(busqueda);
  const lista = Array.isArray(itemsCatalogo) ? itemsCatalogo : [];

  if (!q) return lista.slice(0, limite);

  return lista
    .filter((item) => normalizarBusqueda(getLabel(item)).includes(q))
    .slice(0, limite);
};

const obtenerTipoPrecioDesdeItem = (item) => {
  if (item?.precio_tipo) return normalizarTipoPrecio(item.precio_tipo);

  try {
    const metadata = typeof item?.metadata_json === "string" && item.metadata_json.trim() !== ""
      ? JSON.parse(item.metadata_json)
      : item?.metadata;
    return normalizarTipoPrecio(metadata?.precio_tipo);
  } catch (_) {
    return "anticipada";
  }
};

const normalizarItems = (form, campaniaSeleccionada) => {
  if (Array.isArray(form.items) && form.items.length > 0) {
    return form.items.map((item, idx) => ({
      id_producto: item.id_producto || "",
      producto_nombre: item.producto_nombre || "",
      columna_codigo: item.columna_codigo || (idx === 0 ? "VEN" : "ITEM"),
      columna_nombre: item.columna_nombre || item.producto_nombre || "",
      cantidad: item.cantidad ?? 1,
      precio_tipo: obtenerTipoPrecioDesdeItem(item),
      precio_unitario: item.precio_unitario ?? "",
    }));
  }

  if (form.id_producto || form.producto_nombre || campaniaSeleccionada) {
    return [
      {
        id_producto: form.id_producto || campaniaSeleccionada?.id_producto_principal || "",
        producto_nombre: form.producto_nombre || campaniaSeleccionada?.producto_principal_nombre || "",
        columna_codigo: form.columna_codigo || "VEN",
        columna_nombre: form.columna_nombre || form.producto_nombre || campaniaSeleccionada?.producto_principal_nombre || "Venta",
        cantidad: form.cantidad ?? 1,
        precio_tipo: normalizarTipoPrecio(form.precio_tipo),
        precio_unitario: form.precio_unitario ?? campaniaSeleccionada?.producto_principal_precio_anticipada ?? campaniaSeleccionada?.producto_principal_precio ?? "",
      },
    ];
  }

  return [crearItemVacio("VEN")];
};

export default function ModalOrden({
  abierto,
  form,
  setForm,
  campanias = [],
  productos = [],
  mediosPago = [],
  sociosCatalogo = [],
  personasCatalogo = [],
  personasCatalogoLoading = false,
  catalogosLoading = false,
  saving,
  onClose,
  onSubmit,
  onOpenNuevaPersona,
}) {
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const [socioBusqueda, setSocioBusqueda] = useState("");
  const [personaBusqueda, setPersonaBusqueda] = useState("");
  const [selectorActivo, setSelectorActivo] = useState("");
  const [precioActivo, setPrecioActivo] = useState(null);
  const socioComboRef = useRef(null);
  const personaComboRef = useRef(null);

  useEffect(() => {
    if (!abierto) {
      setSocioBusqueda("");
      setPersonaBusqueda("");
      setSelectorActivo("");
      setPrecioActivo(null);
    }
  }, [abierto]);



  useEffect(() => {
    if (!abierto) return undefined;

    const cerrarSiHaceClickAfuera = (event) => {
      const target = event.target;
      const clickEnSocios = socioComboRef.current?.contains(target);
      const clickEnPersonas = personaComboRef.current?.contains(target);

      if (!clickEnSocios && !clickEnPersonas) {
        setSelectorActivo("");
      }
    };

    // Captura mouse y tactil antes que cualquier elemento interno pueda frenar el evento.
    document.addEventListener("pointerdown", cerrarSiHaceClickAfuera, true);

    return () => {
      document.removeEventListener("pointerdown", cerrarSiHaceClickAfuera, true);
    };
  }, [abierto]);

  const cerrarSelectorConTeclado = (event) => {
    if (event.key !== "Enter" && event.key !== "Escape") return;

    // Evita que Enter dispare el submit del formulario mientras se esta buscando.
    event.preventDefault();
    setSelectorActivo("");
    event.currentTarget.blur();
  };

  const aplicarSocio = (socio) => {
    const dni = limpiarDni(socio?.dni || socio?.num_documento);
    const nombre = nombreSocio(socio);
    const referencia = referenciaSocio(socio);

    if (!dni || !nombre) return;

    setForm((prev) => ({
      ...prev,
      id_venta_persona: "",
      persona_dni: dni,
      dni,
      persona_nombre: nombre,
      persona_detalle: referencia ? `Socio - ${referencia}` : "Socio registrado",
    }));
    setPersonaBusqueda("");
  };

  const aplicarPersonaVenta = (persona) => {
    const dni = limpiarDni(persona?.dni);
    const nombre = String(persona?.nombre_apellido || "").trim();

    if (!dni || !nombre) return;

    setForm((prev) => ({
      ...prev,
      id_venta_persona: persona?.id_persona || prev.id_venta_persona || "",
      persona_dni: dni,
      dni,
      persona_nombre: nombre,
      persona_detalle: persona?.observacion || (persona?.id_alumno ? "Persona de ventas - socio vinculado" : "Persona de ventas"),
    }));
    setSocioBusqueda("");
  };

  const seleccionarSocioCatalogo = (socio) => {
    setSocioBusqueda(opcionSocio(socio));
    aplicarSocio(socio);
    setSelectorActivo("");
  };

  const seleccionarPersonaCatalogo = (persona) => {
    setPersonaBusqueda(opcionPersonaVenta(persona));
    aplicarPersonaVenta(persona);
    setSelectorActivo("");
  };

  const abrirAltaPersonaDesdeSelector = () => {
    const texto = String(personaBusqueda || "").trim();
    const dni = limpiarDni(texto);
    const nombreSugerido = texto
      .replace(/\d+/g, " ")
      .replace(/[()\-–—_.:,;]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();

    setSelectorActivo("");

    if (typeof onOpenNuevaPersona === "function") {
      onOpenNuevaPersona({
        dni,
        nombre_apellido: nombreSugerido,
      });
    }
  };

  useEffect(() => {
    if (!abierto) return;
    if (!form?.id_venta_persona || !form?.persona_dni || !form?.persona_nombre) return;

    setPersonaBusqueda(`${limpiarDni(form.persona_dni)} - ${String(form.persona_nombre || "").trim()}`.trim());
  }, [abierto, form?.id_venta_persona, form?.persona_dni, form?.persona_nombre]);

  const sociosFiltrados = useMemo(
    () => filtrarOpcionesCatalogo(sociosCatalogo, opcionSocio, socioBusqueda),
    [sociosCatalogo, socioBusqueda]
  );

  const personasFiltradas = useMemo(
    () => filtrarOpcionesCatalogo(personasCatalogo, opcionPersonaVenta, personaBusqueda),
    [personasCatalogo, personaBusqueda]
  );

  const campaniaSeleccionada = useMemo(
    () => campanias.find((c) => String(c.id_campania) === String(form.id_campania)),
    [campanias, form.id_campania]
  );

  const items = useMemo(() => normalizarItems(form, campaniaSeleccionada), [form, campaniaSeleccionada]);

  const total = useMemo(
    () => items.reduce((acc, item) => acc + Math.max(0, Number(item.cantidad || 0)) * Math.max(0, toNumber(item.precio_unitario)), 0),
    [items]
  );

  const esEdicion = Boolean(form?.id_orden);
  const titulo = esEdicion ? "Editar venta registrada" : "Nueva venta registrada";
  const guardadoBloqueadoPorCatalogos = catalogosLoading && mediosPago.length === 0;

  const guardarItems = (nuevosItems) => {
    setForm((prev) => ({ ...prev, items: nuevosItems }));
  };

  const actualizarItem = (index, patch) => {
    const nuevos = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    guardarItems(nuevos);
  };

  const normalizarPrecioItem = (index, value) => {
    const raw = String(value ?? "").trim();
    actualizarItem(index, { precio_unitario: raw ? toNumber(raw).toFixed(2) : "" });
  };

  const seleccionarProductoEnItem = (index, idProducto) => {
    const producto = productos.find((p) => String(p.id_producto) === String(idProducto));

    if (!producto) {
      actualizarItem(index, {
        id_producto: "",
        producto_nombre: "",
        precio_tipo: "anticipada",
        precio_unitario: "",
      });
      return;
    }

    const tipoPrecio = normalizarTipoPrecio(items[index]?.precio_tipo);

    actualizarItem(index, {
      id_producto: producto.id_producto,
      producto_nombre: producto.nombre || "",
      columna_nombre: items[index]?.columna_nombre || producto.nombre || "",
      precio_tipo: tipoPrecio,
      precio_unitario: precioProductoPorTipo(producto, tipoPrecio),
    });
  };

  const seleccionarTipoPrecioEnItem = (index, tipo) => {
    const tipoNormalizado = normalizarTipoPrecio(tipo);
    const producto = productos.find((p) => String(p.id_producto) === String(items[index]?.id_producto));
    actualizarItem(index, {
      precio_tipo: tipoNormalizado,
      precio_unitario: producto ? precioProductoPorTipo(producto, tipoNormalizado) : (items[index]?.precio_unitario ?? ""),
    });
  };

  const agregarItem = () => {
    const productoGan = productos.find((p) => String(p.nombre || "").toUpperCase().includes("GAN"));
    const codigo = items.some((item) => String(item.columna_codigo || "").toUpperCase() === "GAN") ? "ITEM" : "GAN";

    guardarItems([
      ...items,
      productoGan && codigo === "GAN"
        ? {
            id_producto: productoGan.id_producto,
            producto_nombre: productoGan.nombre || "",
            columna_codigo: "GAN",
            columna_nombre: productoGan.nombre || "Ganancia",
            cantidad: 1,
            precio_tipo: "anticipada",
            precio_unitario: precioProductoPorTipo(productoGan, "anticipada"),
          }
        : crearItemVacio(codigo),
    ]);
  };

  const quitarItem = (index) => {
    const nuevos = items.filter((_, i) => i !== index);
    guardarItems(nuevos.length ? nuevos : [crearItemVacio("VEN")]);
  };

  const seleccionarCampania = (idCampania) => {
    const campania = campanias.find((c) => String(c.id_campania) === String(idCampania));
    setForm((prev) => ({
      ...prev,
      id_campania: idCampania,
      id_producto: campania?.id_producto_principal || "",
      producto_nombre: campania?.producto_principal_nombre || "",
      precio_unitario: campania?.producto_principal_precio_anticipada ?? campania?.producto_principal_precio ?? "",
      persona_tipo: "vendedor",
      items: [crearItemDesdeCampania(campania)],
    }));
  };

  return (
    <ModalBase
      abierto={abierto}
      titulo={titulo}
      subtitulo={esEdicion
        ? "Actualizá los datos de la venta registrada sin perder sus conceptos asociados."
        : "Registrá una venta cobrada manualmente y vinculala con una persona o socio."}
      onClose={saving ? undefined : onClose}
      className="ventas-modal--orden"
    >
      <form className="ventas-form" onSubmit={onSubmit}>
        <div className="ventas-modal__body ventas-orden-body">


          <section className="ventas-orden-card ventas-orden-card--datos" aria-label="Datos principales de la venta">
            <div className="ventas-orden-card__head">
              <div>
                <h3>Datos de la venta</h3>
                <p>Definí el origen del cobro, su medio de pago y la fecha de registro.</p>
              </div>

            </div>

            <div className="ventas-orden-main-grid">
              <label className="ventas-orden-field ventas-floating-field">
                <span className="ventas-floating-label">Venta / campaña</span>
                <select value={form.id_campania || ""} onChange={(e) => seleccionarCampania(e.target.value)} required disabled={catalogosLoading && campanias.length === 0}>
                  <option value="">{catalogosLoading && campanias.length === 0 ? "Cargando ventas..." : "Seleccioná una venta / campaña..."}</option>
                  {campanias.map((c) => (
                    <option key={c.id_campania} value={c.id_campania}>
                      {c.nombre}{!asBool(c.activo) ? " (inactiva)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="ventas-orden-field ventas-floating-field">
                <span className="ventas-floating-label">Medio de pago</span>
                <select value={form.id_medio_pago || ""} onChange={(e) => setField("id_medio_pago", e.target.value)} required disabled={catalogosLoading && mediosPago.length === 0}>
                  <option value="">{catalogosLoading && mediosPago.length === 0 ? "Cargando medios..." : "Seleccioná un medio de pago..."}</option>
                  {mediosPago.map((m) => (
                    <option key={m.id_medio_pago} value={m.id_medio_pago}>{m.medio_pago}</option>
                  ))}
                </select>
              </label>

              <label className="ventas-orden-field ventas-floating-field">
                <span className="ventas-floating-label">Fecha de venta</span>
                <input
                  type="date"
                  value={form.fecha_venta || today()}
                  onClick={abrirCalendario}
                  onFocus={abrirCalendario}
                  onChange={(e) => setField("fecha_venta", e.target.value)}
                />
              </label>

              <label className="ventas-orden-field ventas-floating-field">
                <span className="ventas-floating-label">Estado</span>
                <select value={form.estado || "aprobada"} onChange={(e) => setField("estado", e.target.value)}>
                  {estadosOrden.filter((e) => e.value).map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="ventas-orden-card ventas-orden-card--items" aria-label="Productos y conceptos de la venta">
            <div className="ventas-orden-card__head ventas-orden-card__head--plain">
              <div>
                <h3>Productos y conceptos</h3>
                <p>Agregá productos del catálogo o conceptos manuales, con su cantidad y precio correspondiente.</p>
              </div>
              <div className="ventas-orden-items-actions">
                <span className="ventas-orden-count-chip">{items.length} {items.length === 1 ? "concepto" : "conceptos"}</span>
                <button type="button" className="ventas-secondary" onClick={agregarItem}>
                  <FontAwesomeIcon icon={faPlus} /> Agregar concepto
                </button>
              </div>
            </div>

            <div className="ventas-items-scroll" aria-label="Conceptos cargados en la venta">
              <div className="ventas-items-grid ventas-items-grid--head">
                <span>Producto / concepto</span>
                <span>Nombre visible</span>
                <span>Tipo precio</span>
                <span>Precio</span>
                <span>Cant.</span>
                <span>Subtotal</span>
                <span></span>
              </div>

              {items.map((item, index) => {
                const cantidad = Math.max(0, Number(item.cantidad || 0));
                const precio = Math.max(0, toNumber(item.precio_unitario));
                const subtotal = cantidad * precio;

                return (
                  <div className="ventas-items-grid" key={`item-${index}`}>
                    <label className="ventas-item-field" data-label="Producto / concepto">
                      <select value={item.id_producto || ""} onChange={(e) => seleccionarProductoEnItem(index, e.target.value)} disabled={catalogosLoading && productos.length === 0}>
                        <option value="">{catalogosLoading && productos.length === 0 ? "Cargando productos..." : "Manual / sin catálogo"}</option>
                        {productos.map((p) => (
                          <option key={p.id_producto} value={p.id_producto}>
                            {p.nombre} - Ant. {moneyConCentavos(precioProductoPorTipo(p, "anticipada"))} / Puerta {moneyConCentavos(precioProductoPorTipo(p, "puerta"))}{Number(p.activo) === 1 ? "" : " (inactivo)"}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="ventas-item-field" data-label="Nombre visible">
                      <input
                        value={item.producto_nombre || ""}
                        onChange={(e) => actualizarItem(index, { producto_nombre: e.target.value, columna_nombre: e.target.value })}
                        placeholder="Ej: Entrada / Bono"
                        maxLength={150}
                        required
                      />
                    </label>

                    <label className="ventas-item-field" data-label="Tipo precio">
                      <select
                        value={normalizarTipoPrecio(item.precio_tipo)}
                        onChange={(e) => seleccionarTipoPrecioEnItem(index, e.target.value)}
                        title={`Precio ${precioTipoLabel(item.precio_tipo)}`}
                      >
                        {tiposPrecioProducto.map((tipo) => (
                          <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="ventas-item-field ventas-item-field--currency" data-label="Precio">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={precioActivo === index ? (item.precio_unitario ?? "") : precioFormateado(item.precio_unitario)}
                        onFocus={(e) => {
                          const input = e.currentTarget;
                          setPrecioActivo(index);
                          window.requestAnimationFrame(() => input.select());
                        }}
                        onChange={(e) => actualizarItem(index, { precio_unitario: e.target.value })}
                        onBlur={() => {
                          normalizarPrecioItem(index, item.precio_unitario);
                          setPrecioActivo(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            normalizarPrecioItem(index, item.precio_unitario);
                            setPrecioActivo(null);
                            e.currentTarget.blur();
                          }
                        }}
                        placeholder="$ 0,00"
                        required
                      />
                    </label>

                    <label className="ventas-item-field" data-label="Cantidad">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.cantidad ?? 0}
                        onChange={(e) => actualizarItem(index, { cantidad: e.target.value })}
                        required
                      />
                    </label>

                    <div className="ventas-item-subtotal" data-label="Subtotal">
                      <strong>{moneyConCentavos(subtotal)}</strong>
                    </div>

                    <button type="button" className="ventas-item-delete" onClick={() => quitarItem(index)} title="Quitar concepto" aria-label="Quitar concepto">
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="ventas-orden-summary">
              <span className="ventas-orden-summary__chip">
                Conceptos <strong>{items.length}</strong>
              </span>
              <span className="ventas-orden-summary__chip ventas-orden-summary__chip--total">
                Total de la venta <strong>{moneyConCentavos(total)}</strong>
              </span>
            </div>
          </section>

          <section className="ventas-orden-card ventas-orden-card--soft" aria-label="Comprador o socio">
            <div className="ventas-orden-card__head ventas-orden-card__head--plain">
              <div>
                <h3>Comprador o socio</h3>
                <p>{personasCatalogoLoading ? "El modal ya está listo. Estamos cargando socios y personas para el buscador..." : "Buscá una persona existente para completar sus datos o ingresalos manualmente."}</p>
              </div>
            </div>

            <div className="ventas-persona-selector-box">


              <div className="ventas-form-row ventas-persona-search-grid">
                <label className="ventas-orden-field ventas-search-combo ventas-floating-field" ref={socioComboRef}>
                  <span className="ventas-floating-label">Socio por DNI o nombre</span>
                  <input
                    value={socioBusqueda}
                    onChange={(e) => {
                      setSocioBusqueda(e.target.value);
                      setSelectorActivo("socios");
                    }}
                    onFocus={() => setSelectorActivo("socios")}
                    onKeyDown={cerrarSelectorConTeclado}
                    placeholder={personasCatalogoLoading ? "Cargando socios..." : "Escribí DNI, apellido o nombre"}
                    disabled={personasCatalogoLoading}
                    autoComplete="off"
                  />
                  {selectorActivo === "socios" && !personasCatalogoLoading && (
                    <div className="ventas-search-dropdown" role="listbox" onMouseDown={(e) => e.preventDefault()}>
                      {sociosFiltrados.length > 0 ? sociosFiltrados.map((socio) => (
                        <button
                          type="button"
                          key={`socio-${socio.id_alumno || socio.id || socio.num_documento}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => seleccionarSocioCatalogo(socio)}
                        >
                          <strong>{nombreSocio(socio) || "Socio sin nombre"}</strong>
                          <span>{[limpiarDni(socio?.dni || socio?.num_documento) && `DNI ${limpiarDni(socio?.dni || socio?.num_documento)}`, referenciaSocio(socio)].filter(Boolean).join(" · ") || "Sin datos adicionales"}</span>
                        </button>
                      )) : (
                        <div className="ventas-search-empty">No hay socios que coincidan.</div>
                      )}
                    </div>
                  )}
                </label>

                <label className="ventas-orden-field ventas-search-combo ventas-floating-field" ref={personaComboRef}>
                  <span className="ventas-floating-label">Persona de ventas</span>
                  <input
                    value={personaBusqueda}
                    onChange={(e) => {
                      setPersonaBusqueda(e.target.value);
                      setSelectorActivo("personas");
                    }}
                    onFocus={() => setSelectorActivo("personas")}
                    onKeyDown={cerrarSelectorConTeclado}
                    placeholder={personasCatalogoLoading ? "Cargando personas..." : "Escribí DNI o nombre registrado"}
                    disabled={personasCatalogoLoading}
                    autoComplete="off"
                  />
                  {selectorActivo === "personas" && !personasCatalogoLoading && (
                    <div className="ventas-search-dropdown" role="listbox" onMouseDown={(e) => e.preventDefault()}>
                      <button
                        type="button"
                        className="ventas-search-add-person"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={abrirAltaPersonaDesdeSelector}
                      >
                        <strong><FontAwesomeIcon icon={faPlus} /> Agregar nueva persona</strong>
                        <span>{personaBusqueda.trim() ? "Usar lo escrito como sugerencia para el alta" : "Cargar una persona manual y seleccionarla en esta venta"}</span>
                      </button>

                      {personasFiltradas.length > 0 ? personasFiltradas.map((persona) => (
                        <button
                          type="button"
                          key={`persona-${persona.id_persona}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => seleccionarPersonaCatalogo(persona)}
                        >
                          <strong>{String(persona?.nombre_apellido || "Persona sin nombre").trim()}</strong>
                          <span>{[limpiarDni(persona?.dni) && `DNI ${limpiarDni(persona?.dni)}`, persona?.origen || "Persona de ventas"].filter(Boolean).join(" · ")}</span>
                        </button>
                      )) : (
                        <div className="ventas-search-empty">No hay personas guardadas que coincidan. Podés agregarla con la primera opción.</div>
                      )}
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="ventas-orden-persona-grid">
              <label className="ventas-orden-field ventas-floating-field">
                <span className="ventas-floating-label">DNI de la persona/socio</span>
                <input
                  value={form.persona_dni || form.dni || ""}
                  onChange={(e) => {
                    const dni = limpiarDni(e.target.value);
                    setForm((prev) => ({ ...prev, persona_dni: dni, dni }));
                  }}
                  placeholder="Ej: 30123456"
                  maxLength={20}
                  inputMode="numeric"
                  required
                />
              </label>

              <label className="ventas-orden-field ventas-floating-field">
                <span className="ventas-floating-label">Detalle / referencia opcional</span>
                <input
                  value={form.persona_detalle || ""}
                  onChange={(e) => setField("persona_detalle", e.target.value)}
                  placeholder="Referencia, socio u otra referencia"
                  maxLength={160}
                />
              </label>
            </div>

            <label className="ventas-orden-field ventas-orden-field--full ventas-orden-observation ventas-floating-field">
              <span className="ventas-floating-label">Observación opcional</span>
              <textarea value={form.observacion || ""} rows={3} onChange={(e) => setField("observacion", e.target.value)} placeholder="Ej: transferencia, pagó en secretaría o recibió comprobante manual." />
            </label>
          </section>
        </div>

        <footer className="ventas-modal__footer ventas-orden-footer">
          <div className="ventas-orden-footer__total">
            <span>Total</span>
            <strong>{moneyConCentavos(total)}</strong>
          </div>
          <div className="ventas-orden-footer__actions">
            <button type="button" className="ventas-modal-cancel" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button className="ventas-primary" type="submit" disabled={saving || guardadoBloqueadoPorCatalogos || total <= 0}>
              <FontAwesomeIcon icon={faSave} /> {saving ? "Guardando..." : guardadoBloqueadoPorCatalogos ? "Cargando datos..." : esEdicion ? "Actualizar venta" : "Guardar venta"}
            </button>
          </div>
        </footer>
      </form>
    </ModalBase>
  );
}
