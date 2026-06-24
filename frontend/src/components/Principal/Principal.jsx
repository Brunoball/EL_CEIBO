import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faBookOpen,
  faChartPie,
  faChevronRight,
  faHouse,
  faLayerGroup,
  faMoneyCheckDollar,
  faRobot,
  faStore,
  faSignOutAlt,
  faUsers,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import logoRH from "../../imagenes/Escudo.png";
import "./principal.css";
import "../Global/roots.css";

const PANEL_API =
  "https://elceibo.3devsnet.com/api/bot_wp/funciones/Panel/endpoints";

const ROUTE_PREFETCH = {
  "/alumnos": () => import("../Alumnos/Alumno"),
  "/alumnos/agregar": () => import("../Alumnos/AgregarAlumno"),
  "/alumnos/baja": () => import("../Alumnos/AlumnoBaja"),
  "/familias": () => import("../Alumnos/Familias"),
  "/cuotas": () => import("../Cuotas/Cuotas"),
  "/ventas": () => import("../Ventas/Ventas"),
  "/tipos-documentos": () => import("../TiposDocumentos/TiposDocumentos"),
  "/categorias": () => import("../Categorias/Categorias"),
  "/registro": () => import("../Login/Registro"),
  "/contable/libro": () => import("../Contable/LibroContable"),
};

function prefetchRoute(ruta) {
  try {
    const fn = ROUTE_PREFETCH[ruta];
    if (fn) fn();
  } catch {}
}

function safeUsuario() {
  try {
    return JSON.parse(localStorage.getItem("usuario")) || null;
  } catch {
    return null;
  }
}

function normalizeRol(value) {
  const v = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["admin", "administrador", "superadmin", "1"].includes(v)) return "admin";
  return "usuario";
}

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtBadge = (n) => {
  const v = toNum(n);
  if (v <= 0) return "";
  return v > 99 ? "99+" : String(v);
};

const calcularBadgesDesdeChats = (rows) => {
  const chats = Array.isArray(rows) ? rows : [];

  let normal = 0;
  let urgent = 0;
  let approval = 0;

  for (const c of chats) {
    const unread = Math.max(0, toNum(c?.unread || 0));
    const consultasPendientes = Math.max(
      0,
      toNum(c?.consultas_pendientes || c?.pending_consultas || 0)
    );
    const comprobantesPendientes = Math.max(
      0,
      toNum(c?.comprobantes_pendientes || c?.pending_comprobantes || 0)
    );

    const prioridad = String(
      c?.prioridad || c?.notificacion_tipo || c?.tipo_notificacion || ""
    ).toLowerCase();

    const esAlertaComprobante =
      prioridad === "aprobacion_comprobante" ||
      prioridad === "comprobante_pendiente" ||
      prioridad.includes("comprobante");

    // El backend ya manda comprobantes_pendientes. El fallback por prioridad evita
    // que el indicador azul desaparezca si llega un chat viejo sin ese contador.
    const aprobacionesChat =
      comprobantesPendientes > 0
        ? comprobantesPendientes
        : esAlertaComprobante
          ? Math.max(1, Math.min(unread, 1))
          : 0;

    const urgentesChat = Math.min(unread, consultasPendientes);
    const clasificadosChat = Math.min(
      unread,
      urgentesChat + Math.min(unread, aprobacionesChat)
    );
    const normalesChat = Math.max(0, unread - clasificadosChat);

    urgent += urgentesChat;
    approval += aprobacionesChat;
    normal += normalesChat;
  }

  return { normal, urgent, approval };
};

const pathMatches = (pathname, paths = []) => {
  const path = String(pathname || "");
  return paths.some((ruta) => path === ruta || path.startsWith(`${ruta}/`));
};

const routeAliases = (ruta) => {
  if (!ruta || ruta === "/panel") return ["/panel", "/panel/dashboard"];
  if (ruta.startsWith("/panel")) return [ruta];
  return [ruta, `/panel${ruta}`];
};

const StableOutlet = memo(function StableOutlet() {
  return <Outlet />;
});

/* =========================
   Modal cierre sesión
========================= */
const ConfirmLogoutModal = memo(function ConfirmLogoutModal({
  open,
  onClose,
  onConfirm,
  loading = false,
}) {
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    cancelBtnRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const stop = (e) => e.stopPropagation();

  return (
    <div className="pp-modal-overlay" role="dialog" aria-modal="true">
      <div className="pp-modal" onMouseDown={stop}>
        <div className="pp-modal__icon" aria-hidden="true">
          <FontAwesomeIcon icon={faSignOutAlt} />
        </div>

        <h3 className="pp-modal__title">Confirmar cierre de sesión</h3>

        <p className="pp-modal__text">
          ¿Estás seguro de que deseas cerrar la sesión?
        </p>

        <div className="pp-modal__actions">
          <button
            type="button"
            className="pp-btn pp-btn--ghost"
            onClick={onClose}
            ref={cancelBtnRef}
            disabled={loading}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="pp-btn pp-btn--danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Cerrando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
});

const Principal = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [closingUI, setClosingUI] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openAlumnosSub, setOpenAlumnosSub] = useState(false);
  const [openAdminSub, setOpenAdminSub] = useState(false);
  const [usuario, setUsuario] = useState(null);

  const [normalUnread, setNormalUnread] = useState(0);
  const [urgentUnread, setUrgentUnread] = useState(0);
  const [approvalUnread, setApprovalUnread] = useState(0);

  useEffect(() => {
    setUsuario(safeUsuario());
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem("ultimaBusqueda");
      localStorage.removeItem("ultimosResultados");
      localStorage.removeItem("alumnoSeleccionado");
      localStorage.removeItem("ultimaAccion");
    } catch {}
  }, []);

  useEffect(() => {
    let alive = true;

    const hasSession = () => {
      try {
        return !!localStorage.getItem("token") || !!localStorage.getItem("usuario");
      } catch {
        return false;
      }
    };

    const tick = async () => {
      if (!hasSession()) return;

      try {
        const res = await fetch(`${PANEL_API}/panel_chats.php?_=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json().catch(() => null);
        if (!alive) return;

        if (res.ok && data?.success) {
          const { normal, urgent, approval } = calcularBadgesDesdeChats(data.chats);

          setNormalUnread(Math.max(0, toNum(normal)));
          setUrgentUnread(Math.max(0, toNum(urgent)));
          setApprovalUnread(Math.max(0, toNum(approval)));
        }
      } catch {
        // silencio
      }
    };

    tick();
    const t = setInterval(tick, 2000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.classList.add("pp-lockScroll");
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove("pp-lockScroll");
    };
  }, [drawerOpen]);

  const rolUsuario = normalizeRol(usuario?.rol || usuario?.tipo_rol);
  const isAdmin = rolUsuario === "admin";

  const navItems = useMemo(() => {
    const base = [
      {
        key: "dashboard",
        label: "Inicio",
        icon: faHouse,
        ruta: "/panel",
      },
      {
        key: "alumnos",
        label: "Socios",
        icon: faUsers,
        ruta: "/alumnos",
      },
      {
        key: "cuotas",
        label: "Cuotas",
        icon: faMoneyCheckDollar,
        ruta: "/cuotas",
      },
      {
        key: "ventas",
        label: "Ventas generales",
        icon: faStore,
        ruta: "/ventas",
      },
      {
        key: "administracion",
        label: "Administración",
        icon: faLayerGroup,
        ruta: "/categorias",
        children: [
          { label: "Tipos de documento", ruta: "/tipos-documentos" },
          { label: "Categorías", ruta: "/categorias" },
          { label: "Registro de usuarios", ruta: "/registro" },
        ],
      },
      {
        key: "contable",
        label: "Contable",
        icon: faChartPie,
        ruta: "/contable/libro",
      },
    ];

    if (isAdmin) return base;

    return base.filter((item) => ["dashboard", "alumnos"].includes(item.key));
  }, [isAdmin]);

  const flatNavItems = useMemo(() => {
    return navItems.flatMap((item) => [item, ...(item.children || [])]);
  }, [navItems]);

  const activeKey = useMemo(() => {
    const path = location.pathname;

    if (pathMatches(path, ["/panel", "/panel/dashboard"]) && path === "/panel") {
      return "dashboard";
    }

    if (pathMatches(path, ["/alumnos", "/familias", "/panel/alumnos", "/panel/familias"])) {
      return "alumnos";
    }

    if (pathMatches(path, ["/cuotas", "/panel/cuotas"])) return "cuotas";
    if (pathMatches(path, ["/ventas", "/panel/ventas"])) return "ventas";

    if (
      pathMatches(path, [
        "/tipos-documentos",
        "/categorias",
        "/registro",
        "/panel/tipos-documentos",
        "/panel/categorias",
        "/panel/registro",
      ])
    ) {
      return "administracion";
    }

    if (pathMatches(path, ["/contable", "/panel/contable"])) return "contable";

    return "dashboard";
  }, [location.pathname]);

  const activeLabel = useMemo(() => {
    const foundSub = flatNavItems.find((item) =>
      pathMatches(location.pathname, routeAliases(item.ruta))
    );

    if (foundSub?.label) return foundSub.label;

    const foundGroup = navItems.find((item) => item.key === activeKey);
    return foundGroup?.label || "Inicio";
  }, [activeKey, flatNavItems, location.pathname, navItems]);

  const closeAllSubs = useCallback(() => {
    setOpenAlumnosSub(false);
    setOpenAdminSub(false);
  }, []);

  const handleNavigate = useCallback(
    (ruta) => {
      closeAllSubs();
      navigate(ruta);
      setDrawerOpen(false);
    },
    [closeAllSubs, navigate]
  );

  const handleLogoClick = useCallback(() => {
    handleNavigate("/panel");
  }, [handleNavigate]);

  const toggleSubmenu = useCallback(
    (itemKey, isOpen) => {
      if (isOpen) {
        closeAllSubs();
        return;
      }

      setOpenAlumnosSub(itemKey === "alumnos");
      setOpenAdminSub(itemKey === "administracion");
    },
    [closeAllSubs]
  );

  const defaultSubRoutes = useMemo(
    () => ({
      alumnos: "/alumnos",
      administracion: "/categorias",
    }),
    []
  );

  const handleNavItemClick = useCallback(
    (item, hasSub, isOpen) => {
      prefetchRoute(item.ruta);

      if (!hasSub) {
        handleNavigate(item.ruta);
        return;
      }

      if (drawerOpen && isOpen) {
        handleNavigate(defaultSubRoutes[item.key] || item.ruta);
        return;
      }

      toggleSubmenu(item.key, isOpen);
    },
    [defaultSubRoutes, drawerOpen, handleNavigate, toggleSubmenu]
  );

  const confirmarCierreSesion = useCallback(() => {
    setClosingUI(true);

    setTimeout(() => {
      try {
        sessionStorage.clear();
      } catch {}
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
      } catch {}

      setShowLogoutModal(false);
      setClosingUI(false);
      navigate("/", { replace: true });
    }, 350);
  }, [navigate]);

  const irPanelBot = () => {
    window.open("/bot/panel", "_blank", "noopener,noreferrer");
  };

  const isPanelHome = location.pathname === "/panel" || location.pathname === "/panel/";

  return (
    <div className="pp-shell">
      <header className="mov-topbar">
        <div className="mov-topbar__left">
          <button
            className="pp-burger"
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            title="Menú"
          >
            <FontAwesomeIcon icon={faBars} />
          </button>

          <button
            className="mov-topbar__logo"
            type="button"
            onClick={handleLogoClick}
            title="Ir al inicio"
            aria-label="Ir al inicio"
          >
            <img src={logoRH} alt="Logo El Ceibo" className="mov-topbar__logoImg" />
          </button>

          <div className="mov-topbar__titles">
            <div className="mov-topbar__sysname">
              <span className="mov-topbar__brandName">EL CEIBO</span>
              <span className="mov-topbar__brandDot">•</span>
              <span className="mov-topbar__brandType">Sistema de Gestión</span>
            </div>

            <div className="mov-topbar__sysby">
              Desarrollado por{" "}
              <a
                href="https://3devsnet.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mov-topbar__sysbyLink"
              >
                3 devs
              </a>
            </div>
          </div>
        </div>

        <div className="mov-topbar__right">
          <div className="mov-topbar__section">{activeLabel}</div>

          <button
            className="pp-topbarLogout"
            type="button"
            onClick={() => setShowLogoutModal(true)}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <FontAwesomeIcon icon={faSignOutAlt} />
          </button>
        </div>
      </header>

      <div
        className={`pp-drawerOverlay ${drawerOpen ? "is-open" : ""}`}
        onMouseDown={() => setDrawerOpen(false)}
      />

      <aside className={`pp-sidebar ${drawerOpen ? "is-drawerOpen" : ""}`}>
        <div className="pp-drawerHeader">
          <div
            className="pp-drawerBrand"
            onClick={handleLogoClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleLogoClick();
            }}
          >
            <div className="pp-drawerBrand__mark">
              <img src={logoRH} alt="" className="pp-drawerBrand__img" />
            </div>

            <div className="pp-drawerBrand__txt">
              <div className="pp-drawerBrand__t">Club Deportivo</div>
              <div className="pp-drawerBrand__s">Panel</div>
            </div>
          </div>

          <button
            className="pp-drawerClose"
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Cerrar menú"
            title="Cerrar"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div
          className="pp-brand"
          onClick={handleLogoClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleLogoClick();
          }}
        >
          <div className="pp-brand__mark">
            <img src={logoRH} alt="" className="pp-brand__img" />
          </div>

          <div className="pp-brand__text">
            <div className="pp-brand__title">Club Deportivo</div>
            <div className="pp-brand__subtitle">IPET 50</div>
          </div>
        </div>

        <nav className="pp-nav" aria-label="Navegación principal">
          {navItems.map((item) => {
            const hasSub = Array.isArray(item.children) && item.children.length > 0;
            const isOpen =
              (item.key === "alumnos" && openAlumnosSub) ||
              (item.key === "administracion" && openAdminSub);
            const isActive = activeKey === item.key;

            return (
              <div
                key={item.key}
                className={`pp-navGroup ${hasSub ? "has-sub" : ""} ${
                  isOpen ? "is-open" : ""
                }`}
                onMouseEnter={() => prefetchRoute(item.ruta)}
              >
                <button
                  type="button"
                  className={`pp-nav__item ${isActive ? "is-active" : ""}`}
                  onClick={() => handleNavItemClick(item, hasSub, isOpen)}
                  onDoubleClick={() => {
                    if (!hasSub) return;
                    handleNavigate(defaultSubRoutes[item.key] || item.ruta);
                  }}
                  aria-expanded={hasSub ? isOpen : undefined}
                  aria-haspopup={hasSub ? "menu" : undefined}
                >
                  <span className="pp-nav__icon">
                    <FontAwesomeIcon icon={item.icon} />
                  </span>

                  <span className="pp-nav__label">{item.label}</span>

                  {hasSub && (
                    <span className="pp-nav__chev" aria-hidden="true">
                      <FontAwesomeIcon icon={faChevronRight} />
                    </span>
                  )}
                </button>

                {hasSub && (
                  <div className="pp-navSub" role="menu">
                    {item.children.map((sub) => {
                      const subActive = pathMatches(
                        location.pathname,
                        routeAliases(sub.ruta)
                      );

                      return (
                        <button
                          key={sub.ruta + sub.label}
                          type="button"
                          className={`pp-navSub__item ${subActive ? "is-active" : ""}`}
                          onMouseEnter={() => prefetchRoute(sub.ruta)}
                          onClick={() => handleNavigate(sub.ruta)}
                          role="menuitem"
                        >
                          <span className="pp-navSub__dot" />
                          <span className="pp-navSub__label">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="pp-content">
        <div className="pp-content__inner">
          {isPanelHome ? (
            <section className="pp-welcome">
              <div className="pp-welcome__header">
                <div className="pp-welcome__icon">
                  <FontAwesomeIcon icon={faBookOpen} />
                </div>
                <div>
                  <h1>Panel de gestión</h1>
                  <p>
                    Seleccioná una sección desde la navegación lateral para comenzar.
                  </p>
                </div>
              </div>

              <div className="pp-welcome__grid">
                {navItems
                  .filter((item) => item.key !== "dashboard")
                  .map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      className="pp-welcomeCard"
                      onClick={() => handleNavigate(defaultSubRoutes[item.key] || item.ruta)}
                    >
                      <span className="pp-welcomeCard__icon">
                        <FontAwesomeIcon icon={item.icon} />
                      </span>
                      <span className="pp-welcomeCard__text">
                        <strong>{item.label}</strong>
                      </span>
                    </button>
                  ))}
              </div>
            </section>
          ) : (
            <StableOutlet />
          )}
        </div>
      </main>

      <button
        type="button"
        className="bot-fab"
        onClick={irPanelBot}
        aria-label="Abrir panel interno del bot"
        title="Panel interno del Bot (WhatsApp)"
      >
        <FontAwesomeIcon icon={faRobot} />

        {approvalUnread > 0 ? (
          <span
            className="bot-fab-badge bot-fab-badge--approval"
            aria-label={`Comprobantes pendientes de aprobación: ${approvalUnread}`}
            title={`Comprobantes para aprobar: ${approvalUnread}`}
            style={{
              background: "#2563eb",
              color: "#fff",
              top: "-6px",
              left: "-8px",
              right: "auto",
            }}
          >
            {fmtBadge(approvalUnread)}
          </span>
        ) : null}

        {normalUnread > 0 ? (
          <span
            className="bot-fab-badge bot-fab-badge--normal"
            aria-label={`Notificaciones normales: ${normalUnread}`}
            title={`Normales: ${normalUnread}`}
          >
            {fmtBadge(normalUnread)}
          </span>
        ) : null}

        {urgentUnread > 0 ? (
          <span
            className="bot-fab-badge bot-fab-badge--urgent"
            aria-label={`Notificaciones urgentes: ${urgentUnread}`}
            title={`Urgentes: ${urgentUnread}`}
          >
            {fmtBadge(urgentUnread)}
          </span>
        ) : null}
      </button>

      <ConfirmLogoutModal
        open={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmarCierreSesion}
        loading={closingUI}
      />
    </div>
  );
};

export default Principal;
