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
  anios: [],
  divisiones: [],
  total_docentes: 0,
};

export default function PlanillasTab({ tableTabs, campanias = [], apiUrl }) {
  const [idCampania, setIdCampania] = useState(() => obtenerCampaniaInicial(campanias));
  const [tipoPlanilla, setTipoPlanilla] = useState("referencias");
  const [idAnio, setIdAnio] = useState("");
  const [idDivision, setIdDivision] = useState("");
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
            anios: Array.isArray(data.anios) ? data.anios : [],
            divisiones: Array.isArray(data.divisiones) ? data.divisiones : [],
            total_docentes: Number(data.total_docentes || 0),
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

  const anioSeleccionado = useMemo(
    () => opciones.anios.find((anio) => String(anio.id_anio) === String(idAnio)) || null,
    [opciones.anios, idAnio]
  );

  const divisionSeleccionada = useMemo(
    () => opciones.divisiones.find((division) => String(division.id_division) === String(idDivision)) || null,
    [opciones.divisiones, idDivision]
  );

  const exportarPlanillas = () => {
    if (!idCampania || !apiUrl) return;

    const params = new URLSearchParams();
    params.set("action", "ventas_planillas_referencias");
    params.set("tipo", tipoPlanilla);
    params.set("id_campania", idCampania);
    params.set("solo_activos", soloActivos ? "1" : "0");
    params.set("orientacion", "vertical");
    params.set("formato_hoja", "vertical");
    params.set("estilo", "calcado");
    params.set("numero_bot", NUMERO_BOT_PLANILLAS);

    if (tipoPlanilla === "referencias") {
      if (idAnio) params.set("id_anio", idAnio);
      if (idDivision) params.set("id_division", idDivision);
    }

    abrirEnNuevaPestana(`${apiUrl}?${params.toString()}`);
  };

  const campaniaActiva = campaniaSeleccionada && asBool(campaniaSeleccionada.activo);
  const esPlanillaDocentes = tipoPlanilla === "docentes";
  const tituloPlanilla = esPlanillaDocentes ? "Listado completo de profesores" : "Una hoja por referencia y referencia";

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
              <select value={tipoPlanilla} onChange={(e) => setTipoPlanilla(e.target.value)}>
                <option value="referencias">Referencias / socios</option>
                <option value="docentes">Profesores / docentes</option>
              </select>
            </label>

            {tipoPlanilla === "referencias" ? (
              <>
                <label className="ventas-planillas-field ventas-floating-field">
                  <span className="ventas-floating-label">Año</span>
                  <select value={idAnio} onChange={(e) => setIdAnio(e.target.value)} disabled={cargandoOpciones}>
                    <option value="">Todos los años</option>
                    {opciones.anios.map((anio) => (
                      <option key={anio.id_anio} value={anio.id_anio}>{anio.nombre}</option>
                    ))}
                  </select>
                </label>

                <label className="ventas-planillas-field ventas-floating-field">
                  <span className="ventas-floating-label">Referencia</span>
                  <select value={idDivision} onChange={(e) => setIdDivision(e.target.value)} disabled={cargandoOpciones}>
                    <option value="">Todas las divisiones</option>
                    {opciones.divisiones.map((division) => (
                      <option key={division.id_division} value={division.id_division}>{division.nombre}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
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
                  {esPlanillaDocentes ? "Profesores" : "Referencias / socios"}
                </span>
                <span>
                  <small>Filtro</small>
                  {esPlanillaDocentes
                    ? `${soloActivos ? "Docentes activos" : "Todos los docentes"} · ${opciones.total_docentes || 0} docentes`
                    : `${anioSeleccionado?.nombre || "Todos los años"} · ${divisionSeleccionada?.nombre || "Todas las divisiones"}`}
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
                <span className="ventas-planillas-check-full">
                  {esPlanillaDocentes ? "Incluir solo docentes activos" : "Incluir solo socios activos"}
                </span>
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
