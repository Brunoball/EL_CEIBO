// src/components/Alumnos/modales/ModalMiembros.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useDeferredValue,
  useCallback,
  useTransition,
  useRef,
  memo,
} from 'react';
import { FaTimes, FaPlus, FaTrash, FaSearch } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import './ModalMiembros.css';

/* Utilidad: inicial del nombre */
const getInitial = (str) => {
  const s = (str || '').trim();
  return s ? s.charAt(0).toUpperCase() : '?';
};

/* ---------- Modal de confirmación (estética famdel) ---------- */
function ConfirmRemoveMemberModal({ open, miembro, isWorking, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div
      className="famdel-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="miembro-del-title"
      onClick={onCancel}
    >
      <div
        className="famdel-modal-container famdel-modal--danger"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="famdel-modal__icon" aria-hidden="true">
          <FaTrash />
        </div>

        <h3 id="miembro-del-title" className="famdel-modal-title famdel-modal-title--danger">
          Quitar miembro
        </h3>

        <p className="famdel-modal-text">
          ¿Seguro que querés quitar a <strong>“{miembro?.nombre || '—'}”</strong> de la familia?
        </p>

        <div className="famdel-modal-buttons">
          <button className="famdel-btn famdel-btn--ghost" onClick={onCancel} disabled={isWorking}>
            Cancelar
          </button>
          <button
            className="famdel-btn famdel-btn--solid-danger"
            onClick={onConfirm}
            disabled={isWorking}
          >
            {isWorking ? 'Quitando…' : 'Quitar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Tarjetas memoizadas ---------- */
const MiembroCard = memo(function MiembroCard({
  m,
  onRemoveClick,
  cascadeIndex = -1,
  playCascade = false,
  isAdmin = true,
}) {
  const active = Number(m.activo) === 1;
  const cascadeClass =
    playCascade && cascadeIndex > -1 && cascadeIndex < 10 ? 'modalmi-cascade' : '';
  const cascadeStyle = cascadeClass ? { '--mi-cascade-i': cascadeIndex } : undefined;

  return (
    <div
      className={`modalmi-card ${active ? 'is-active' : 'is-inactive'} ${cascadeClass}`}
      style={cascadeStyle}
    >
      <div className="modalmi-avatar" title={m.nombre} aria-hidden="true">
        {getInitial(m.nombre)}
      </div>

      <div className="modalmi-info">
        <div className="modalmi-name-row">
          <span className={`modalmi-status-dot ${active ? 'ok' : 'off'}`} />
          <span className="modalmi-name" title={m.nombre}>{m.nombre}</span>
        </div>
        <div className="modalmi-meta">
          <span className="modalmi-dni"><strong>DNI:</strong> {m.dni || '—'}</span>
          {m.localidad ? <span className="modalmi-dni">• {m.localidad}</span> : null}
          {Number(m.activo) !== 1 && <span className="modalmi-badge danger">Inactivo</span>}
        </div>
      </div>

      {isAdmin && (
        <button className="modalmi-remove" title="Quitar" onClick={() => onRemoveClick(m)}>
          <FaTrash />
        </button>
      )}
    </div>
  );
});

const CandidatoCard = memo(function CandidatoCard({
  c,
  checked,
  onToggle,
  cascadeIndex = -1,
  playCascade = false,
}) {
  const active = Number(c.activo) === 1;
  const cascadeClass =
    playCascade && cascadeIndex > -1 && cascadeIndex < 10 ? 'modalmi-cascade' : '';
  const cascadeStyle = cascadeClass ? { '--mi-cascade-i': cascadeIndex } : undefined;

  return (
    <label
      className={`modalmi-card modalmi-selectable ${active ? 'is-active' : 'is-inactive'} ${checked ? 'is-checked' : ''} ${cascadeClass}`}
      style={cascadeStyle}
    >
      <input type="checkbox" checked={checked} onChange={() => onToggle(c.id_alumno)} />
      <div className="modalmi-checkslot" aria-hidden="true" />
      <div className="modalmi-info">
        <div className="modalmi-name-row">
          <span className={`modalmi-status-dot ${active ? 'ok' : 'off'}`} />
          <span className="modalmi-name" title={c.nombre}>{c.nombre}</span>
        </div>
        <div className="modalmi-meta">
          <span className="modalmi-dni"><strong>DNI:</strong> {c.dni || '—'}</span>
          {c.localidad ? <span className="modalmi-dni">• {c.localidad}</span> : null}
          {Number(c.activo) !== 1 && <span className="modalmi-badge danger">Inactivo</span>}
        </div>
      </div>
    </label>
  );
});

/* ---------- Modal principal ---------- */
export default function ModalMiembros({ open, onClose, familia, notify, onDeltaCounts }) {
  const [miembros, setMiembros] = useState([]);
  const [candidatosAll, setCandidatosAll] = useState([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(new Set());

  const [loading, setLoading] = useState(false);
  const [miembrosLoading, setMiembrosLoading] = useState(false);

  // Skeleton + cascada primera vez
  const [showMiembrosSkeleton, setShowMiembrosSkeleton] = useState(false);
  const [showCandidatosSkeleton, setShowCandidatosSkeleton] = useState(false);
  const [playCascade, setPlayCascade] = useState(false);
  const didFirstIntroRef = useRef(false);

  const [isPending, startTransition] = useTransition();
  const qDeferred = useDeferredValue(q);

  // Infinite scroll
  const BATCH = 60;
  const [visibleCount, setVisibleCount] = useState(BATCH);

  const searchInputRef = useRef(null);

  // Modal quitar
  const [delOpen, setDelOpen] = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [delWorking, setDelWorking] = useState(false);

  const [isAdmin] = useState(true);

  useEffect(() => {
    if (!open || !familia) return;

    setQ('');
    setSel(new Set());
    setVisibleCount(BATCH);

    if (!didFirstIntroRef.current) {
      setShowMiembrosSkeleton(true);
      setShowCandidatosSkeleton(true);
      setPlayCascade(false);

      const t = setTimeout(() => {
        setShowMiembrosSkeleton(false);
        setShowCandidatosSkeleton(false);
        setPlayCascade(true);
        didFirstIntroRef.current = true;

        const off = setTimeout(() => setPlayCascade(false), 900);
        return () => clearTimeout(off);
      }, 220);

      return () => clearTimeout(t);
    }
  }, [open, familia?.id_familia]);

  // Carga datos
  useEffect(() => {
    if (!open || !familia) return;
    setMiembrosLoading(true);
    cargarMiembros().finally(() => setMiembrosLoading(false));
    cargarCandidatosIniciales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, familia?.id_familia]);

  const cargarMiembros = useCallback(async () => {
    try {
      const r = await fetch(
        `${BASE_URL}/api.php?action=familia_miembros&id_familia=${familia.id_familia}&ts=${Date.now()}`,
        { cache: 'no-store' }
      );
      const j = await r.json();
      const rows = (j?.miembros || j?.alumnos || []).map(a => ({
        id_alumno: a.id_alumno ?? a.id ?? a.idAlumno,
        nombre: a.nombre_completo
          ? a.nombre_completo
          : [a.apellido, a.nombre].filter(Boolean).join(', '),
        dni: a.dni ?? a.num_documento ?? '',
        domicilio: a.domicilio ?? '',
        localidad: a.localidad ?? '',
        activo: Number(a.activo ?? 1)
      }));
      setMiembros(rows);
    } catch {
      notify?.('Error al obtener miembros', 'error');
    }
  }, [familia, notify]);

  const cargarCandidatosIniciales = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `${BASE_URL}/api.php?action=alumnos_sin_familia&all=1&ts=${Date.now()}`,
        { cache: 'no-store' }
      );
      const j = await r.json();
      const rows = (j?.alumnos || []).map(a => {
        const nombre = a.nombre_completo
          ? a.nombre_completo
          : [a.apellido, a.nombre].filter(Boolean).join(', ');
        const dni = a.dni ?? a.num_documento ?? '';
        return {
          id_alumno: a.id_alumno ?? a.id ?? a.idAlumno,
          nombre,
          dni,
          domicilio: a.domicilio ?? '',
          localidad: a.localidad ?? '',
          activo: Number(a.activo ?? 1),
          searchKey: `${nombre} ${dni}`.toLowerCase()
        };
      });
      setCandidatosAll(rows);
    } catch {
      try {
        const r2 = await fetch(
          `${BASE_URL}/api.php?action=alumnos_sin_familia&ts=${Date.now()}`,
          { cache: 'no-store' }
        );
        const j2 = await r2.json();
        const rows = (j2?.alumnos || j2?.socios || []).map(a => {
          const nombre = a.nombre_completo ??
            (a.nombre || [a.apellido, a.nombre].filter(Boolean).join(', '));
          const dni = a.dni ?? a.num_documento ?? '';
          return {
            id_alumno: a.id_alumno ?? a.id_socio ?? a.id ?? a.idAlumno,
            nombre,
            dni,
            domicilio: a.domicilio ?? '',
            localidad: a.localidad ?? '',
            activo: Number(a.activo ?? 1),
            searchKey: `${nombre} ${dni}`.toLowerCase()
          };
        });
        setCandidatosAll(rows);
      } catch {
        notify?.('Error al obtener socios sin familia', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [notify]);

  /* ====== NUEVO: set de IDs de miembros para excluirlos de la lista derecha ====== */
  const miembroIds = useMemo(() => new Set(miembros.map(m => m.id_alumno)), [miembros]);

  const candidatosFiltrados = useMemo(() => {
    const t = (qDeferred || '').trim().toLowerCase();

    // 1) Siempre excluir a los que ya están como miembros (robusto contra backend).
    let base = candidatosAll.filter(c => !miembroIds.has(c.id_alumno));

    // 2) Aplicar filtro por texto si hay búsqueda.
    if (!t) return base;
    return base.filter(c =>
      (c.searchKey || `${c.nombre} ${c.dni}`.toLowerCase()).includes(t)
    );
  }, [candidatosAll, qDeferred, miembroIds]);

  useEffect(() => { setVisibleCount(BATCH); }, [qDeferred]);
  const visibles = useMemo(() => candidatosFiltrados.slice(0, visibleCount), [candidatosFiltrados, visibleCount]);

  const onGridScroll = useCallback((e) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 160) {
      setVisibleCount(v => (v < candidatosFiltrados.length ? v + BATCH : v));
    }
  }, [candidatosFiltrados.length]);

  const toggleSel = useCallback((id_alumno) => {
    setSel(prev => {
      const n = new Set(prev);
      n.has(id_alumno) ? n.delete(id_alumno) : n.add(id_alumno);
      return n;
    });
  }, []);

  const agregarSeleccionados = useCallback(async () => {
    if (!sel.size) return;
    const ids = Array.from(sel);
    const setIds = new Set(ids);
    const toAdd = candidatosAll.filter(c => setIds.has(c.id_alumno));
    if (!toAdd.length) return;

    try {
      const r = await fetch(`${BASE_URL}/api.php?action=familia_agregar_miembros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_familia: familia.id_familia, ids_alumno: ids }),
      });
      const j = await r.json();
      if (!j?.exito) { notify?.(j?.mensaje || 'No se pudo agregar', 'error'); return; }

      setMiembros(prev => [
        ...prev,
        ...toAdd.map(c => ({
          id_alumno: c.id_alumno,
          nombre: c.nombre,
          dni: c.dni,
          domicilio: c.domicilio,
          localidad: c.localidad,
          activo: c.activo
        })),
      ]);

      // Por prolijidad seguimos sacándolos de la fuente de candidatos.
      setCandidatosAll(prev => prev.filter(c => !setIds.has(c.id_alumno)));
      setSel(new Set());

      const deltaTotales = toAdd.length;
      const deltaActivos = toAdd.reduce((acc, c) => acc + (Number(c.activo) === 1 ? 1 : 0), 0);
      onDeltaCounts?.({ id_familia: familia.id_familia, deltaActivos, deltaTotales });
      notify?.('Miembros agregados');
    } catch {
      notify?.('Error al agregar miembros', 'error');
    }
  }, [sel, candidatosAll, familia, notify, onDeltaCounts]);

  const abrirModalQuitar = useCallback((miembro) => {
    setDelTarget(miembro);
    setDelOpen(true);
  }, []);

  const cerrarModalQuitar = useCallback(() => {
    if (delWorking) return;
    setDelOpen(false);
    setDelTarget(null);
  }, [delWorking]);

  const confirmarQuitar = useCallback(async () => {
    if (!delTarget) return;
    setDelWorking(true);
    const id_alumno = delTarget.id_alumno;
    const eraActivo = Number(delTarget?.activo) === 1;

    try {
      const r = await fetch(`${BASE_URL}/api.php?action=familia_quitar_miembro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_alumno }),
      });
      const j = await r.json();
      if (!j?.exito) { notify?.(j?.mensaje || 'No se pudo quitar', 'error'); return; }

      setMiembros(prev => prev.filter(x => x.id_alumno !== id_alumno));

      // Volver a ofrecerlo como candidato.
      setCandidatosAll(prev =>
        prev.some(x => x.id_alumno === delTarget.id_alumno)
          ? prev
          : [{
              id_alumno: delTarget.id_alumno,
              nombre: delTarget.nombre,
              dni: delTarget.dni,
              domicilio: delTarget.domicilio,
              localidad: delTarget.localidad,
              activo: delTarget.activo,
              searchKey: `${delTarget.nombre} ${delTarget.dni}`.toLowerCase()
            }, ...prev]
      );

      onDeltaCounts?.({ id_familia: familia.id_familia, deltaActivos: eraActivo ? -1 : 0, deltaTotales: -1 });
      notify?.('Miembro quitado');
      setDelOpen(false);
      setDelTarget(null);
    } catch {
      notify?.('Error al quitar miembro', 'error');
    } finally {
      setDelWorking(false);
    }
  }, [delTarget, familia, notify, onDeltaCounts]);

  // buscador (lupa/clear + ESC)
  const handleSearchIcon = useCallback(() => {
    if (!q) {
      searchInputRef.current?.focus();
      return;
    }
    startTransition(() => setQ(''));
    searchInputRef.current?.focus();
  }, [q, startTransition]);

  const onSearchKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && q) {
      e.preventDefault();
      e.stopPropagation();
      startTransition(() => setQ(''));
    }
  }, [q, startTransition]);

  if (!open || !familia) return null;

  const showMiembrosSkeletonNow = !didFirstIntroRef.current && showMiembrosSkeleton;
  const showCandidatosSkeletonNow = !didFirstIntroRef.current && showCandidatosSkeleton;

  return (
    <div className="modalmi-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modalmi-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modalmi-head">
          <h3 className="modalmi-title">
            <span className="modalmi-title-dot" />
            Miembros de “{familia.nombre_familia}”
          </h3>
          <button className="modalmi-close" onClick={onClose} aria-label="Cerrar">
            <FaTimes />
          </button>
        </div>

        <div className="modalmi-body">
          {/* Columna izquierda: miembros actuales */}
          <div className="modalmi-col">
            <div className="modalmi-subbar">
              <h4 className="modalmi-subtitle">Miembros actuales</h4>
              <div className="modalmi-subbar-spacer" aria-hidden />
            </div>

            <div className="modalmi-grid" data-fixed>
              {showMiembrosSkeletonNow ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div className="modalmi-skel-card" key={`skel-left-${i}`}>
                    <div className="modalmi-skel-avatar" />
                    <div className="modalmi-skel-lines">
                      <div className="modalmi-skel-line long" />
                      <div className="modalmi-skel-line short" />
                    </div>
                  </div>
                ))
              ) : miembrosLoading ? (
                <div className="modalmi-empty">Cargando miembros…</div>
              ) : miembros.length === 0 ? (
                <div className="modalmi-empty">Sin miembros</div>
              ) : (
                miembros.map((m, idx) => (
                  <MiembroCard
                    key={m.id_alumno}
                    m={m}
                    onRemoveClick={abrirModalQuitar}
                    cascadeIndex={idx}
                    playCascade={playCascade}
                    isAdmin={true}
                  />
                ))
              )}
            </div>
          </div>

          {/* Columna derecha: candidatos */}
          <div className="modalmi-col">
            <div className="modalmi-subbar">
              <h4 className="modalmi-subtitle">
                Agregar socios {isPending && <span className="modalmi-hint"></span>}
              </h4>

              <div className={`modalmi-search modalmi-search--compact ${q ? 'is-filled' : ''}`} role="search">
                <input
                  ref={searchInputRef}
                  placeholder="Buscar por nombre o DNI…"
                  value={q}
                  onChange={(e) => startTransition(() => setQ(e.target.value))}
                  onKeyDown={onSearchKeyDown}
                  aria-label="Buscar socios"
                />
                <button
                  className="modalmi-search-ico"
                  onClick={handleSearchIcon}
                  aria-label={q ? 'Limpiar búsqueda' : 'Buscar'}
                  title={q ? 'Limpiar' : 'Buscar'}
                  type="button"
                >
                  {q ? <FaTimes /> : <FaSearch />}
                </button>
              </div>
            </div>

            <div className="modalmi-grid" data-fixed onScroll={onGridScroll}>
              {showCandidatosSkeletonNow ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div className="modalmi-skel-card modalmi-skel-card--cand" key={`skel-right-${i}`}>
                    <div className="modalmi-skel-check" />
                    <div className="modalmi-skel-lines">
                      <div className="modalmi-skel-line long" />
                      <div className="modalmi-skel-line short" />
                    </div>
                  </div>
                ))
              ) : loading && visibles.length === 0 ? (
                <div className="modalmi-empty">Cargando socios…</div>
              ) : visibles.length === 0 ? (
                <div className="modalmi-empty">Sin resultados</div>
              ) : (
                visibles.map((c, idx) => (
                  <CandidatoCard
                    key={c.id_alumno}
                    c={c}
                    checked={sel.has(c.id_alumno)}
                    onToggle={toggleSel}
                    cascadeIndex={idx}
                    playCascade={playCascade}
                  />
                ))
              )}
              {visibles.length < candidatosFiltrados.length && !showCandidatosSkeletonNow && (
                <div className="modalmi-sentinel">Cargando más…</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer: solo botón Agregar */}
        <div className="modalmi-foot">
          <button
            className="modalmi-btn modalmi-solid"
            onClick={agregarSeleccionados}
            disabled={sel.size === 0}
            title="Agregar seleccionados"
          >
            <FaPlus /> Agregar seleccionados ({sel.size})
          </button>
        </div>
      </div>

      {/* Modal de quitar miembro */}
      <ConfirmRemoveMemberModal
        open={delOpen}
        miembro={delTarget}
        isWorking={delWorking}
        onConfirm={confirmarQuitar}
        onCancel={cerrarModalQuitar}
      />
    </div>
  );
}
