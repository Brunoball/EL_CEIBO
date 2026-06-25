// src/utils/imprimirRecibos.js
import BASE_URL from '../config/config';

/*
  Diseño GLOBAL de comprobantes de impresión.
  Se usa para todos los casos: socio interno, externo, rotado y listado global.
  Cada pago genera 2 tickets: uno para el club y otro para el socio.
*/

const NOMBRE_CLUB = 'CLUB DEPORTIVO EL CEIBO';
const LOCALIDAD_DEFAULT = 'San Francisco';

function fechaHoy() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function nombreMes(idMes) {
  const meses = [
    '',
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  const i = Number(idMes);
  if (i >= 1 && i <= 12) return meses[i];
  if (i === 13) return 'CONTADO ANUAL';
  if (i === 15) return '1ER MITAD';
  if (i === 16) return '2DA MITAD';
  return String(idMes || '');
}

function numeroALetras(n) {
  n = Number(n ?? 0);
  if (!Number.isFinite(n) || n < 0) n = 0;

  const u = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const e = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const d = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const c = ['', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  const chunk = (x) => {
    if (x <= 9) return u[x];
    if (x <= 19) return e[x - 10];
    if (x <= 29) return x === 20 ? 'veinte' : `veinti${u[x - 20]}`;
    if (x <= 99) {
      const D = Math.floor(x / 10);
      const U = x % 10;
      return U ? `${d[D]} y ${u[U]}` : d[D];
    }
    if (x === 100) return 'cien';
    const C = Math.floor(x / 100);
    const R = x % 100;
    return `${c[C]}${R ? ` ${chunk(R)}` : ''}`;
  };

  if (n === 0) return 'CERO';

  let out = '';
  const millones = Math.floor(n / 1_000_000);
  if (millones) out += millones === 1 ? 'un millón' : `${numeroALetras(millones).toLowerCase()} millones`;
  n %= 1_000_000;

  const miles = Math.floor(n / 1000);
  if (miles) out += `${out ? ' ' : ''}${miles === 1 ? 'mil' : `${numeroALetras(miles).toLowerCase()} mil`}`;
  n %= 1000;

  if (n) out += `${out ? ' ' : ''}${chunk(n)}`;
  return out.replace(/\buno\b/g, 'un').toUpperCase();
}

const getIdSocio = (s) => s?.id_alumno ?? s?.id_socio ?? s?.id ?? '';

function getNombreCompleto(s) {
  const apellidoNombre = String(s?.apellido_nombre ?? '').trim();
  if (apellidoNombre) return apellidoNombre.toUpperCase();

  const nombreCompleto = String(s?.nombre_completo ?? '').trim();
  if (nombreCompleto) return nombreCompleto.toUpperCase();

  const apellido = String(s?.apellido ?? '').trim();
  const nombre = String(s?.nombre ?? '').trim();
  if (apellido || nombre) return `${apellido.toUpperCase()} ${nombre.toUpperCase()}`.trim();

  return '';
}

const getDni = (s) => s?.num_documento ?? s?.dni ?? s?.documento ?? s?.numDocumento ?? '';
const getDomicilio = (s) => s?.domicilio ?? s?.direccion ?? '';

function resolverMonto(s, categoriasById) {
  const idCat = s?.id_categoria ?? s?.categoria_id ?? null;
  const precioDesdeListas = Number(categoriasById[String(idCat)]?.monto ?? 0);
  const cantidadPeriodos = Array.isArray(s?.periodos) && s.periodos.length > 0
    ? s.periodos.length
    : Number(s?.cantidad_meses || 1);

  const candidatos = [
    Number(s?.importe_total),
    Number(s?.precio_total),
    Number(s?.monto_total),
    Number(s?.total),
    Number(s?.precio_unitario) * cantidadPeriodos,
    Number(s?.precio_unitario),
    Number(s?.monto_mensual),
    Number(s?.precio_categoria),
    Number(s?.monto),
    Number(s?.importe),
    precioDesdeListas,
  ].filter((v) => Number.isFinite(v) && v > 0);

  return candidatos.length ? candidatos[0] : 0;
}

function resolverCategoria(s, categoriasById) {
  const idCat = s?.id_categoria ?? s?.categoria_id ?? null;
  return String(
    s?.categoria_nombre
    ?? s?.nombre_categoria
    ?? categoriasById[String(idCat)]?.nombre
    ?? ''
  ).trim();
}

function resolverPeriodoTexto(s, periodoActual, opciones) {
  if (s?.periodo_texto && String(s.periodo_texto).trim()) {
    return String(s.periodo_texto).trim();
  }

  const anio = String(opciones?.anioPago || opciones?.anio || s?.anio || new Date().getFullYear());
  const mesTexto = nombreMes(s?.id_periodo ?? s?.id_mes ?? periodoActual);
  return [mesTexto, anio].filter(Boolean).join(' ');
}

function resolverCantidadMeses(s) {
  if (Number(s?.cantidad_meses) > 0) return Number(s.cantidad_meses);
  if (Array.isArray(s?.periodos) && s.periodos.length > 0) return s.periodos.length;
  return 1;
}

const COMP_W = 105;
const COMP_H = 99;

function renderTicket({
  destino = 'TICKET PARA EL SOCIO',
  nroRecibo = '',
  localidad = LOCALIDAD_DEFAULT,
  fecha = fechaHoy(),
  nombreCompleto = '',
  dni = '',
  domicilio = '',
  monto = 0,
  categoriaNombre = '',
  periodoTexto = '',
  mesesCantidad = 1,
  fechaImpresion = fechaHoy(),
}) {
  const montoRedondeado = Math.round(Number(monto || 0));
  const montoLetras = numeroALetras(montoRedondeado);
  const montoFmt = montoRedondeado.toLocaleString('es-AR', { minimumFractionDigits: 0 });
  const mesesTxt = mesesCantidad > 1 ? ` por ${mesesCantidad} meses` : '';
  const categoriaTxt = categoriaNombre ? ` ${String(categoriaNombre).toUpperCase()}` : '';
  const concepto = `como cuota de socio${categoriaTxt}${mesesTxt} correspondiente a ${periodoTexto}`;

  return `
    <div class="comprobante">
      <div class="ticket-destino">${escapeHtml(destino)}</div>
      <div class="titulo">${escapeHtml(NOMBRE_CLUB)}</div>

      <div class="fila cabecera">
        <div class="izq">Recibo N° ${escapeHtml(nroRecibo)}</div>
        <div class="der">${escapeHtml(localidad)}, ${escapeHtml(fecha)}</div>
      </div>

      <div class="fila">
        <span>Recibimos de</span>
        <span class="dato largo">${escapeHtml(nombreCompleto)}</span>
      </div>
      <div class="fila fila-doble">
        <span>DNI</span>
        <span class="dato">${escapeHtml(dni || '')}</span>
      </div>
      <div class="fila">
        <span>Domicilio</span>
        <span class="dato largo">${escapeHtml(domicilio || '—')}</span>
      </div>

      <div class="fila etiqueta">la cantidad de pesos:</div>
      <div class="raya-simple">
        <div class="texto">${escapeHtml(montoLetras)}</div>
        <div class="linea"></div>
      </div>

      <div class="fila leyenda">${escapeHtml(concepto)}</div>
      <div class="fila son">SON $ ${escapeHtml(montoFmt)}</div>

      <div class="pie">
        <div class="sello">Sello</div>
        <div class="firma">Firma</div>
      </div>

      <div class="fecha-impresion">Impreso: ${escapeHtml(fechaImpresion)}</div>
    </div>
  `;
}

const chunk6 = (arr) => {
  const out = [];
  for (let i = 0; i < arr.length; i += 6) out.push(arr.slice(i, i + 6));
  return out;
};

async function completarDatos(listaSocios) {
  const socios = [];

  for (const item of (listaSocios || [])) {
    const id = getIdSocio(item);
    if (!id) {
      socios.push(item);
      continue;
    }

    try {
      const res = await fetch(`${BASE_URL}/api.php?action=obtener_socio_comprobante&id=${encodeURIComponent(String(id))}`);
      const data = await res.json();
      if (data?.exito && data?.socio) socios.push({ ...item, ...data.socio });
      else socios.push(item);
    } catch {
      socios.push(item);
    }
  }

  return socios;
}

async function obtenerCategorias() {
  try {
    const r = await fetch(`${BASE_URL}/api.php?action=obtener_listas`);
    const j = await r.json();
    if (!j?.exito) return {};

    const cats = j?.listas?.categorias || [];
    return cats.reduce((acc, c) => {
      const id = c.id ?? c.id_categoria ?? c.idCategoria;
      const nombre = c.nombre ?? c.nombre_categoria ?? '';
      const monto = Number(c.monto ?? c.precio ?? c.Precio_Categoria ?? 0);
      if (id != null) acc[String(id)] = { nombre, monto };
      return acc;
    }, {});
  } catch {
    return {};
  }
}

/**
 * imprimirRecibos(listaSocios, periodoActual, ventana?, opciones?)
 * Imprime todos los comprobantes juntos en una sola ventana con diseño global.
 */
export const imprimirRecibos = async (listaSocios, periodoActual = '', ventana, opciones = {}) => {
  const socios = await completarDatos(listaSocios);
  const categoriasById = await obtenerCategorias();

  const w = ventana || window.open('', '', 'width=900,height=1200');
  if (!w) return;

  const css = `
    @page { size: 210mm 297mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    * { box-sizing: border-box; }
    body { font-family: "Courier New", Courier, monospace; color: #111; background: #fff; }
    .page { position: relative; width: 210mm; min-height: 297mm; page-break-after: always; padding: 0; }
    .page:last-child { page-break-after: auto; }
    .grid-2x3 {
      display: grid;
      grid-template-columns: ${COMP_W}mm ${COMP_W}mm;
      grid-template-rows: ${COMP_H}mm ${COMP_H}mm ${COMP_H}mm;
      column-gap: 0;
      row-gap: 0;
      width: 210mm;
      height: 297mm;
    }
    .comprobante {
      width: ${COMP_W}mm;
      height: ${COMP_H}mm;
      border: 1px solid #000;
      padding: 5mm 6mm 10mm 6mm;
      display: flex;
      flex-direction: column;
      gap: 1.7mm;
      position: relative;
      overflow: hidden;
    }
    .ticket-destino {
      position: absolute;
      top: 2mm;
      right: 5mm;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: .2px;
    }
    .titulo {
      text-align: center;
      font-weight: 800;
      letter-spacing: .35px;
      font-size: 11pt;
      margin: 4mm 25mm 1mm 0;
      min-height: 5mm;
    }
    .fila {
      display: flex;
      align-items: center;
      width: 100%;
      font-size: 9.4pt;
      line-height: 1.25;
      min-height: 4.2mm;
    }
    .cabecera { justify-content: space-between; color: #444; }
    .izq, .der { font-size: 9pt; }
    .dato { margin-left: 6px; font-weight: 700; }
    .dato.largo { margin-left: 8px; max-width: 76%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .etiqueta { margin-top: 0.3mm; color: #555; }
    .raya-simple {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      column-gap: 4mm;
      width: 100%;
      min-height: 6mm;
    }
    .raya-simple .texto { font-weight: 800; font-size: 10.6pt; letter-spacing: .25px; white-space: nowrap; }
    .raya-simple .linea { border-bottom: 1px solid #333; height: 0; width: 100%; }
    .leyenda { color: #444; min-height: 11mm; align-items: flex-start; }
    .son { font-weight: 800; font-size: 11pt; margin-top: 0.3mm; }
    .pie {
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 10mm;
      padding-top: 2mm;
      margin-bottom: 4mm;
    }
    .sello, .firma {
      width: 38mm;
      text-align: center;
      font-size: 9pt;
      color: #555;
      border-top: 1px solid #000;
      padding-top: 1.8mm;
    }
    .fecha-impresion {
      position: absolute;
      right: 5mm;
      bottom: 2.5mm;
      font-size: 7.3pt;
      color: #444;
      font-weight: 700;
    }
  `;

  const reciboBase = Number(opciones?.reciboBase ?? 1);
  const localidad = opciones?.localidad || LOCALIDAD_DEFAULT;
  const fecha = opciones?.fecha || fechaHoy();
  const fechaImpresion = opciones?.fechaImpresion || fechaHoy();

  const tickets = [];

  socios.forEach((s, idx) => {
    const nombreCompleto = getNombreCompleto(s);
    const dni = getDni(s);
    const domicilio = getDomicilio(s);
    const monto = resolverMonto(s, categoriasById);
    const categoriaNombre = resolverCategoria(s, categoriasById);
    const periodoTexto = resolverPeriodoTexto(s, periodoActual, opciones);
    const mesesCantidad = resolverCantidadMeses(s);
    const nroRecibo = String(s?.nro_recibo ?? reciboBase + idx).padStart(6, '0');

    tickets.push(renderTicket({
      destino: 'TICKET PARA EL CLUB',
      nroRecibo,
      localidad,
      fecha,
      nombreCompleto,
      dni,
      domicilio,
      monto,
      categoriaNombre,
      periodoTexto,
      mesesCantidad,
      fechaImpresion,
    }));

    tickets.push(renderTicket({
      destino: 'TICKET PARA EL SOCIO',
      nroRecibo,
      localidad,
      fecha,
      nombreCompleto,
      dni,
      domicilio,
      monto,
      categoriaNombre,
      periodoTexto,
      mesesCantidad,
      fechaImpresion,
    }));
  });

  const paginas = chunk6(tickets).map((items) => `
    <div class="page">
      <div class="grid-2x3">
        ${items.join('')}
      </div>
    </div>
  `).join('');

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Comprobantes de cuotas</title>
        <style>${css}</style>
      </head>
      <body>
        ${paginas}
        <script>
          window.onload = function() {
            try { window.focus(); } catch(e) {}
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  w.document.open();
  w.document.write(html);
  w.document.close();
};

export default imprimirRecibos;
