// src/utils/ComprobanteExternoPDF.jsx
import BASE_URL from '../config/config';

/**
 * Genera un PDF con un comprobante individual para el socio.
 * Diseño adaptado a club: no muestra curso ni división.
 * Usa html2canvas + jsPDF desde CDN.
 */
export async function generarComprobanteAlumnoPDF(alumno, opts = {}) {
  const NOMBRE_CLUB = 'CLUB DEPORTIVO EL CEIBO';

  const NORMALIZAR = (s = '') => String(s ?? '').trim();
  const UPPER = (s = '') => NORMALIZAR(s).toUpperCase();
  const escapeHtml = (value = '') => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const nombreMes = (idMes) => {
    const m = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const i = Number(idMes);
    if (i >= 1 && i <= 12) return m[i];
    if (i === 13) return 'Contado anual';
    if (i === 15) return '1er mitad';
    if (i === 16) return '2da mitad';
    return String(idMes || '');
  };

  const getIdAlumno = (s) => s?.id_alumno ?? s?.id ?? s?.id_socio ?? null;

  const compactarApellidoNombre = (texto) => {
    const raw = UPPER(texto);
    const partes = raw.split(',').map(t => t.trim()).filter(Boolean);
    if (partes.length >= 2 && partes[0] === partes[1]) {
      partes.splice(1, 1);
    }
    return partes.join(', ');
  };

  const getNombreCompleto = (s) => {
    const apNom = NORMALIZAR(s?.apellido_nombre || s?.nombre_completo);
    const nombre = NORMALIZAR(s?.nombre);
    const apellido = NORMALIZAR(s?.apellido);

    if (apNom) return compactarApellidoNombre(apNom);
    if (nombre && nombre.includes(',')) return compactarApellidoNombre(nombre);

    if (apellido || nombre) {
      const armado = [apellido, nombre].filter(Boolean).join(', ');
      return UPPER(armado);
    }

    return '—';
  };

  const getDni = (s) =>
    s?.num_documento ?? s?.dni ?? s?.documento ?? s?.numDocumento ?? '';

  const fechaImpresion = new Date().toLocaleDateString('es-AR');

  // Enriquecer desde backend para completar DNI, domicilio, localidad y categoría.
  let socioFull = { ...alumno };
  const idSocio = getIdAlumno(socioFull);
  if (idSocio) {
    try {
      const r = await fetch(`${BASE_URL}/api.php?action=obtener_socio_comprobante&id=${encodeURIComponent(String(idSocio))}`);
      const j = await r.json();
      if (j?.exito && j?.socio) {
        // Backend primero; props/opts pueden sobreescribir.
        socioFull = { ...j.socio, ...socioFull };
      }
    } catch {
      /* noop */
    }
  }

  const anio = Number(opts?.anio ?? alumno?.anio ?? new Date().getFullYear());
  const periodoId = Number(opts?.periodoId ?? alumno?.id_periodo ?? 0);
  const periodoTexto = NORMALIZAR(opts?.periodoTexto) || `${nombreMes(periodoId)} ${anio}`;

  const precioUnitario = Number(
    opts?.precioUnitario ??
    alumno?.precio_unitario ??
    socioFull?.monto_mensual ??
    socioFull?.precio_categoria ??
    0
  );

  const importeTotal = Number(
    opts?.importeTotal ??
    alumno?.importe_total ??
    alumno?.precio_total ??
    (precioUnitario > 0 ? precioUnitario : 0)
  );

  const nombreCompleto = getNombreCompleto(socioFull);
  const dni = getDni(socioFull);
  const domicilio = NORMALIZAR(socioFull?.domicilio ?? socioFull?.direccion);
  const localidad = NORMALIZAR(socioFull?.localidad);
  const categoria = NORMALIZAR(
    opts?.categoriaNombre ??
    alumno?.categoria_nombre ??
    alumno?.nombre_categoria ??
    socioFull?.categoria_nombre ??
    socioFull?.nombre_categoria ??
    socioFull?.cm_nombre_categoria ??
    ''
  );

  const css = `
    @page { size: A4; margin: 18mm 16mm 16mm 16mm; }
    html, body { margin: 0; padding: 0; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, "Segoe UI", sans-serif; color: #000; }
    .sheet { width: 210mm; min-height: 297mm; display:flex; justify-content:center; }
    .comprobante { width: 175mm; border: 1px solid #111; border-radius: 6px; padding: 10mm; }
    .hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom: 6mm; }
    .hdr .tit { font-weight: 800; font-size: 14pt; letter-spacing: .2px; }
    .hdr .sub { font-weight: 600; font-size: 10pt; color:#444; margin-top: 1mm; }
    .sep { border-bottom: 1px solid #000; margin: 4mm 0 6mm 0; }
    .row { display:flex; gap: 8mm; margin: 2.5mm 0; }
    .col { flex: 1; }
    .lbl { font-size: 10pt; color:#444; display:block; margin-bottom: 1mm; }
    .val { font-size: 12pt; font-weight: 600; }
    .mono { font-family: "Courier New", Courier, monospace; letter-spacing: .2px; }
    .right { text-align:right; }
    .fecha-impresion { margin-top: 5mm; text-align: right; font-size: 8pt; color: #555; font-weight: 600; }
  `;

  const importeFmt = Number(importeTotal || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const htmlContent = `
    <div class="sheet">
      <div class="comprobante" id="cmp-socio">
        <div class="hdr">
          <div>
            <div class="tit">${escapeHtml(NOMBRE_CLUB)}</div>
            <div class="sub">Comprobante de cuota social</div>
          </div>
        </div>
        <div class="sep"></div>

        <div class="row">
          <div class="col">
            <span class="lbl">Socio</span>
            <span class="val mono">${escapeHtml(nombreCompleto || '—')}</span>
          </div>
          <div class="col">
            <span class="lbl">DNI</span>
            <span class="val mono">${escapeHtml(UPPER(dni) || '—')}</span>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <span class="lbl">Domicilio</span>
            <span class="val mono">${escapeHtml(UPPER(domicilio) || '—')}</span>
          </div>
          <div class="col">
            <span class="lbl">Localidad</span>
            <span class="val mono">${escapeHtml(UPPER(localidad) || '—')}</span>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <span class="lbl">Categoría</span>
            <span class="val mono">${escapeHtml(UPPER(categoria) || '—')}</span>
          </div>
          <div class="col">
            <span class="lbl">Periodo</span>
            <span class="val mono">${escapeHtml(UPPER(periodoTexto) || '—')}</span>
          </div>
        </div>

        <div class="row">
          <div class="col right">
            <span class="lbl">Importe</span>
            <span class="val mono">$ ${escapeHtml(importeFmt)}</span>
          </div>
        </div>

        <div class="fecha-impresion">Exportado: ${escapeHtml(fechaImpresion)}</div>
      </div>
    </div>
  `;

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-99999px';
  wrapper.style.top = '0';
  wrapper.innerHTML = `<style>${css}</style>${htmlContent}`;
  document.body.appendChild(wrapper);

  try {
    const ensureScript = (src) =>
      new Promise((resolve, reject) => {
        if ([...document.scripts].some(s => s.src.includes(src))) return resolve();
        const sc = document.createElement('script');
        sc.src = src;
        sc.onload = resolve;
        sc.onerror = () => reject(new Error('No se pudo cargar ' + src));
        document.body.appendChild(sc);
      });

    await ensureScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
    await ensureScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');

    const h2c = window.html2canvas;
    const { jsPDF } = window.jspdf;

    const nodo = wrapper.querySelector('#cmp-socio');
    const canvas = await h2c(nodo, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = 210;
    const targetW = 175;
    const x = (pageW - targetW) / 2;
    const imgW = targetW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const y = 18;

    pdf.addImage(imgData, 'PNG', x, y, imgW, imgH, undefined, 'FAST');
    const nombreArchivo = `Comprobante - ${nombreCompleto || 'Socio'}.pdf`;
    pdf.save(nombreArchivo);
  } finally {
    document.body.removeChild(wrapper);
  }
}
