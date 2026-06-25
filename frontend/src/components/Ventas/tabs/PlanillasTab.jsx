import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPrint } from "@fortawesome/free-solid-svg-icons";
import { asBool, money } from "../ventasConfig";

const obtenerCampaniaInicial = (campanias = []) => {
  const activa = campanias.find((c) => asBool(c.activo));
  return activa?.id_campania || campanias[0]?.id_campania || "";
};

const abrirEnNuevaPestana = (url) => {
  const nuevaVentana = window.open(url, "_blank", "noopener,noreferrer");
  if (nuevaVentana) nuevaVentana.opener = null;
};

const NUMERO_BOT_PLANILLAS = "3564 665050";

const opcionesIniciales = {
  categorias: [],
  total_socios: 0,
};

export default function PlanillasTab({ tableTabs, campanias = [], apiUrl }) {
  const [idCampania, setIdCampania] = useState(() => obtenerCampaniaInicial(campanias));
  const [idCategoria, setIdCategoria] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);
  const [opciones, setOpciones] = useState(opcionesIniciales);
  const [cargandoOpciones, setCargandoOpciones] = useState(false);
  const [errorOpciones, setErrorOpciones] = useState("");

  useEffect(() => {
    if (!campanias.length) {
      setIdCampania("");
      return;
    }

    const existeSeleccion = campanias.some((c) => String(c.id_campania) === String(idCampania));
    if (!idCampania || !existeSeleccion) {
      setIdCampania(obtenerCampaniaInicial(campanias));
    }
  }, [campanias, idCampania]);

  useEffect(() => {
    if (!apiUrl) return;

    let cancelado = false;
    const cargarOpciones = async () => {
      setCargandoOpciones(true);
      setErrorOpciones("");

      try {
        const params = new URLSearchParams();
        params.set("action", "ventas_planillas_opciones");
        const res = await fetch(`${apiUrl}?${params.toString()}`);
        const data = await res.json();

        if (!res.ok || data?.exito === false) {
          throw new Error(data?.mensaje || "No se pudieron cargar los filtros de planillas.");
        }

        if (!cancelado) {
          setOpciones({
            categorias: Array.isArray(data.categorias) ? data.categorias : [],
            total_socios: Number(data.total_socios || 0),
          });
        }
      } catch (err) {
        if (!cancelado) {
          setOpciones(opcionesIniciales);
          setErrorOpciones(err?.message || "No se pudieron cargar los filtros de planillas.");
        }
      } finally {
        if (!cancelado) setCargandoOpciones(false);
      }
    };

    cargarOpciones();
    return () => {
      cancelado = true;
    };
  }, [apiUrl]);

  const campaniaSeleccionada = useMemo(
    () => campanias.find((c) => String(c.id_campania) === String(idCampania)) || null,
    [campanias, idCampania]
  );

  const categoriaSeleccionada = useMemo(
    () => opciones.categorias.find((categoria) => String(categoria.id_categoria) === String(idCategoria)) || null,
    [opciones.categorias, idCategoria]
  );

  const exportarPlanillas = () => {
    if (!idCampania || !apiUrl) return;

    const params = new URLSearchParams();
    params.set("action", "ventas_planillas_socios");
    params.set("tipo", "socios");
    params.set("id_campania", idCampania);
    params.set("solo_activos", soloActivos ? "1" : "0");
    params.set("orientacion", "vertical");
    params.set("formato_hoja", "vertical");
    params.set("estilo", "club");
    params.set("numero_bot", NUMERO_BOT_PLANILLAS);

    if (idCategoria) params.set("id_categoria", idCategoria);

    abrirEnNuevaPestana(`${apiUrl}?${params.toString()}`);
  };

  const campaniaActiva = campaniaSeleccionada && asBool(campaniaSeleccionada.activo);
  const tituloPlanilla = "Planillas de socios por categoría";

  return (
    <section className="ventas-card ventas-full-card ventas-planillas-card">
      <div className="ventas-planillas-nav">{tableTabs}</div>

      <div className="ventas-planillas-layout ventas-planillas-layout--single">
        <div className="ventas-planillas-panel ventas-planillas-panel--single">
          <div className="ventas-planillas-panel-head">
            <div className="ventas-planillas-heading">
              <span className="ventas-planillas-eyebrow">Exportación masiva</span>
              <h2>{tituloPlanilla}</h2>
            </div>

            <span className="ventas-planillas-format">
              <FontAwesomeIcon icon={faPrint} />
              A4 vertical
            </span>
          </div>

          <div className="ventas-planillas-form-grid">
            <label className="ventas-planillas-field ventas-floating-field">
              <span className="ventas-floating-label">Venta / campaña</span>
              <select value={idCampania || ""} onChange={(e) => setIdCampania(e.target.value)}>
                <option value="">Seleccionar venta</option>
                {campanias.map((c) => (
                  <option key={c.id_campania} value={c.id_campania}>
                    {c.nombre}{asBool(c.activo) ? "" : " (inactiva)"}
                  </option>
                ))}
              </select>
            </label>

            <label className="ventas-planillas-field ventas-floating-field">
              <span className="ventas-floating-label">Tipo de planilla</span>
              <select value="socios" disabled>
                <option value="socios">Socios / categorías</option>
              </select>
            </label>

            <label className="ventas-planillas-field ventas-floating-field">
              <span className="ventas-floating-label">Categoría</span>
              <select value={idCategoria} onChange={(e) => setIdCategoria(e.target.value)} disabled={cargandoOpciones}>
                <option value="">Todas las categorías</option>
                {opciones.categorias.map((categoria) => (
                  <option key={categoria.id_categoria} value={categoria.id_categoria}>{categoria.nombre}</option>
                ))}
              </select>
            </label>
          </div>

          {errorOpciones ? (
            <div className="ventas-planillas-resumen ventas-planillas-resumen--warning">
              <strong>No se cargaron los filtros</strong>
              <p>{errorOpciones}</p>
            </div>
          ) : null}

          {campaniaSeleccionada ? (
            <div className="ventas-planillas-resumen">
              <div className="ventas-planillas-resumen-head">
                <strong>{campaniaSeleccionada.nombre}</strong>
                <span className={campaniaActiva ? "is-active" : "is-inactive"}>
                  {campaniaActiva ? "Activa" : "Inactiva"}
                </span>
              </div>

              <div className="ventas-planillas-meta">
                <span>
                  <small>Producto</small>
                  {campaniaSeleccionada.producto_principal_nombre || "Sin producto"}
                </span>
                <span>
                  <small>Precio VEN</small>
                  {campaniaSeleccionada.producto_principal_precio ? money(campaniaSeleccionada.producto_principal_precio) : "Sin precio"}
                </span>
                <span>
                  <small>Planilla</small>
                  Socios por categoría
                </span>
                <span>
                  <small>Filtro</small>
                  {`${soloActivos ? "Socios activos" : "Todos los socios"} · ${categoriaSeleccionada?.nombre || "Todas las categorías"} · ${opciones.total_socios || 0} socios`}
                </span>
              </div>
            </div>
          ) : (
            <div className="ventas-planillas-resumen ventas-planillas-resumen--warning">
              <strong>No hay una venta seleccionada</strong>
              <p>Primero cargá una venta/campaña desde Configuración.</p>
            </div>
          )}

          <div className="ventas-planillas-actions">
            <label className="ventas-planillas-check">
              <input
                type="checkbox"
                checked={soloActivos}
                onChange={(e) => setSoloActivos(e.target.checked)}
              />
              <span className="ventas-planillas-checkmark" aria-hidden="true" />
              <span className="ventas-planillas-check-label">
                <span className="ventas-planillas-check-full">Incluir solo socios activos</span>
                <span className="ventas-planillas-check-short">Solo activos</span>
              </span>
            </label>

            <button
              type="button"
              className="ventas-primary ventas-planillas-export"
              onClick={exportarPlanillas}
              disabled={!idCampania}
            >
              <FontAwesomeIcon icon={faPrint} />
              <span className="ventas-planillas-export-full">Exportar planillas</span>
              <span className="ventas-planillas-export-short">Exportar</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
