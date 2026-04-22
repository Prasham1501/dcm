/**
 * Professional report print template generator.
 * Produces a self-contained HTML page with hospital branding,
 * patient demographics, report content, and doctor signature.
 * Uses CSS table trick for repeating header/footer on every printed page.
 */

interface PrintConfig {
  hospitalName: string;
  address1: string;
  address2: string;
  address3: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;
  registration: string;
  logoDataUrl: string;
  /** Footer slot layout */
  enableFooter?: boolean;
  footerLayout?: { left: string; center: string; right: string };
  customFooterLeft?: string;
  customFooterCenter?: string;
  customFooterRight?: string;
  customFooterText?: string;
}

interface PrintReportData {
  title: string;
  doctor: string;
  status: 'draft' | 'final';
  patientName: string;
  patientId: string;
  studyDate: string;
  content: string;
  /** DICOM metadata for demographics */
  dicomMeta?: Record<string, string> | null;
  /** Paper size: a4, a5, letter (default: a4) */
  paperSize?: 'a4' | 'a5' | 'letter';
}

/**
 * Generate a professional print-ready HTML document for a USG report.
 */
export function generatePrintHtml(config: PrintConfig, data: PrintReportData): string {
  const {
    hospitalName, address1, address2, address3,
    city, state, pincode, phone, email, website, registration, logoDataUrl,
  } = config;

  const { title, doctor, status, patientName, patientId, studyDate, content, dicomMeta, paperSize } = data;

  // Paper size CSS
  const paper = paperSize || 'a4';
  const pageSizeMap: Record<string, string> = {
    a4: 'A4',
    a5: 'A5',
    letter: 'letter',
  };
  const pageSize = pageSizeMap[paper] || 'A4';
  const isA5 = paper === 'a5';
  const bodyFontSize = isA5 ? '11px' : '13px';
  const headerNameSize = isA5 ? '16px' : '20px';
  const titleSize = isA5 ? '13px' : '15px';

  // Build address line
  const addrParts = [address1, address2, address3].filter(Boolean);
  const cityLine = [city, state, pincode].filter(Boolean).join(', ');
  if (cityLine) addrParts.push(cityLine);

  // Contact line
  const contactParts: string[] = [];
  if (phone) contactParts.push(`Tel: ${escHtml(phone)}`);
  if (email) contactParts.push(`Email: ${escHtml(email)}`);
  if (website) contactParts.push(escHtml(website));
  const contactLine = contactParts.join(' &nbsp;|&nbsp; ');

  // Patient demographics from DICOM metadata
  const meta = dicomMeta || {};
  const patAge = meta.patientAge || '';
  const patSex = meta.patientSex || '';
  const modality = meta.modality || 'US';
  const bodyPart = meta.bodyPart || meta.protocolName || '';
  const refPhysician = meta.referringPhysician || '';
  const machine = [meta.manufacturer, meta.modelName].filter(Boolean).join(' ');
  const institution = meta.institutionName || '';

  // Format study date
  let formattedDate = studyDate;
  if (studyDate && /^\d{8}$/.test(studyDate)) {
    const y = studyDate.slice(0, 4);
    const m = studyDate.slice(4, 6);
    const d = studyDate.slice(6, 8);
    formattedDate = `${d}/${m}/${y}`;
  }

  // Pre-compute footer HTML
  const footerHtml = (() => {
    if (!config.enableFooter) return '';
    const fl = config.footerLayout || { left: 'none', center: 'none', right: 'none' };
    const hasAnyFooter = fl.left !== 'none' || fl.center !== 'none' || fl.right !== 'none';
    if (!hasAnyFooter) return '';
    const addressStr = addrParts.map(p => escHtml(p)).join(', ');
    const renderSlot = (slot: string, pos: 'left'|'center'|'right') => {
      const customText = pos === 'left' ? (config.customFooterLeft || config.customFooterText || '')
        : pos === 'center' ? (config.customFooterCenter || config.customFooterText || '')
        : (config.customFooterRight || config.customFooterText || '');
      const ta = pos;
      switch (slot) {
        case 'logo':
          return logoDataUrl ? `<div style="text-align:${ta}"><img src="${logoDataUrl}" style="max-height:30px;max-width:80px;object-fit:contain" /></div>` : '';
        case 'name':
          return `<div style="text-align:${ta};font-weight:600">${escHtml(hospitalName)}</div>`;
        case 'address':
          return `<div style="text-align:${ta}">${addressStr}${phone ? ` | Tel: ${escHtml(phone)}` : ''}</div>`;
        case 'custom':
          return customText ? `<div style="text-align:${ta}">${escHtml(customText)}</div>` : '';
        default:
          return '';
      }
    };
    return `<div class="footer-content">
      <div style="flex:1">${renderSlot(fl.left, 'left')}</div>
      <div style="flex:1">${renderSlot(fl.center, 'center')}</div>
      <div style="flex:1">${renderSlot(fl.right, 'right')}</div>
    </div>`;
  })();
  const hasFooter = footerHtml.length > 0;

  // Spacing
  const topEdgeMm = isA5 ? 8 : 10;
  const bottomEdgeMm = isA5 ? 8 : 10;
  const sideMm = isA5 ? 12 : 15;
  const headerSpacerPx = isA5 ? 105 : 125;
  const footerSpacerPx = hasFooter ? (isA5 ? 55 : 65) : (isA5 ? 35 : 45);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escHtml(title || 'USG Report')}</title>
  <style>
    @page {
      size: ${pageSize};
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', 'Georgia', serif;
      font-size: ${bodyFontSize};
      line-height: 1.6;
      color: #1a1a1a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Fixed Header — repeats on every printed page */
    .page-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      padding: ${topEdgeMm}mm ${sideMm}mm 0 ${sideMm}mm;
      background: white;
      z-index: 10;
    }
    .header-inner {
      display: flex;
      align-items: center;
      padding-bottom: 8px;
      border-bottom: 2px solid #333;
    }
    .header-logo { flex-shrink: 0; }
    .header-logo img {
      max-height: ${isA5 ? '45px' : '60px'};
      max-width: ${isA5 ? '60px' : '80px'};
      object-fit: contain;
    }
    .header-center { flex: 1; text-align: center; }
    .header-name {
      font-size: ${headerNameSize};
      font-weight: bold;
      color: #1a1a1a;
      letter-spacing: 0.5px;
    }
    .header-address { font-size: 10px; color: #555; margin-top: 2px; }
    .header-contact { font-size: 9px; color: #888; margin-top: 2px; }

    /* Fixed Footer — repeats on every printed page */
    .page-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 0 ${sideMm}mm ${bottomEdgeMm}mm ${sideMm}mm;
      background: white;
      z-index: 10;
    }
    .footer-content {
      border-top: 1px solid #ccc;
      padding-top: 4px;
      font-size: 8px;
      color: #999;
      display: flex;
      justify-content: space-between;
    }

    /* Table trick: thead/tfoot spacers repeat on every page to prevent overlap */
    .layout-table {
      width: 100%;
      border-collapse: collapse;
      border-spacing: 0;
    }
    .layout-table td { padding: 0; border: none; }
    .header-spacer { height: ${headerSpacerPx}px; }
    .footer-spacer { height: ${footerSpacerPx}px; }

    /* Content area */
    .content-area {
      padding: 0 ${sideMm}mm;
    }

    /* Patient Info */
    .patient-bar {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 24px;
      padding: 6px 10px;
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 3px;
      margin-bottom: 10px;
      font-size: 11px;
    }
    .patient-bar .field { display: flex; gap: 4px; }
    .patient-bar .label { color: #777; font-weight: normal; min-width: 70px; }
    .patient-bar .value { font-weight: 600; color: #222; }

    /* Report Title */
    .report-title {
      font-size: ${titleSize};
      font-weight: bold;
      text-align: center;
      margin: 8px 0 6px;
      padding: 4px 0;
      border-bottom: 1px solid #ccc;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #333;
    }

    /* Report Content */
    .report-body {
      padding: 4px 0;
    }
    .report-body h3 {
      font-size: 13px;
      color: #333;
      margin: 12px 0 4px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 2px;
    }
    .report-body table {
      border-collapse: collapse;
      width: 100%;
      font-size: 13px;
    }
    .report-body td, .report-body th {
      padding: 3px 8px;
      vertical-align: top;
    }
    .report-body p { margin: 3px 0; }

    /* Signature */
    .signature-block {
      margin-top: 40px;
      page-break-inside: avoid;
    }
    .signature-line {
      display: flex;
      justify-content: flex-end;
      align-items: flex-end;
      gap: 12px;
      margin-top: 30px;
    }
    .signature-box { text-align: center; min-width: 200px; }
    .signature-box .line { border-top: 1px solid #555; margin-bottom: 4px; width: 100%; }
    .signature-box .doctor-name { font-weight: bold; font-size: 12px; }
    .signature-box .designation { font-size: 10px; color: #666; }

    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <!-- Fixed header (appears on every printed page) -->
  <div class="page-header">
    <div class="header-inner">
      ${logoDataUrl ? `<div class="header-logo"><img src="${logoDataUrl}" alt="Logo" /></div>` : ''}
      <div class="header-center">
        <div class="header-name">${escHtml(hospitalName)}</div>
        ${addrParts.length > 0 ? `<div class="header-address">${addrParts.map(p => escHtml(p)).join(', ')}</div>` : ''}
        ${contactLine ? `<div class="header-contact">${contactLine}</div>` : ''}
        ${registration ? `<div class="header-contact">Reg: ${escHtml(registration)}</div>` : ''}
      </div>
    </div>
  </div>

  ${hasFooter ? `<!-- Fixed footer (appears on every printed page) -->
  <div class="page-footer">${footerHtml}</div>` : ''}

  <!-- Content wrapped in table for multi-page header/footer spacing -->
  <table class="layout-table">
    <thead><tr><td><div class="header-spacer"></div></td></tr></thead>
    <tfoot><tr><td><div class="footer-spacer"></div></td></tr></tfoot>
    <tbody><tr><td>
      <div class="content-area">
        <!-- Patient Demographics -->
        <div class="patient-bar">
          <div class="field"><span class="label">Patient:</span><span class="value">${escHtml(patientName)}</span></div>
          <div class="field"><span class="label">ID:</span><span class="value">${escHtml(patientId)}</span></div>
          ${patAge ? `<div class="field"><span class="label">Age:</span><span class="value">${escHtml(patAge)}</span></div>` : ''}
          ${patSex ? `<div class="field"><span class="label">Sex:</span><span class="value">${patSex === 'M' ? 'Male' : patSex === 'F' ? 'Female' : escHtml(patSex)}</span></div>` : ''}
          <div class="field"><span class="label">Study Date:</span><span class="value">${escHtml(formattedDate)}</span></div>
          <div class="field"><span class="label">Modality:</span><span class="value">${escHtml(modality)}${bodyPart ? ` \u2014 ${escHtml(bodyPart)}` : ''}</span></div>
          ${refPhysician ? `<div class="field"><span class="label">Ref. Doctor:</span><span class="value">${escHtml(refPhysician)}</span></div>` : ''}
          ${machine ? `<div class="field"><span class="label">Machine:</span><span class="value">${escHtml(machine)}</span></div>` : ''}
        </div>

        <!-- Report Title -->
        <div class="report-title">${escHtml(title || 'Ultrasonography Report')}</div>

        <!-- Report Content -->
        <div class="report-body">
          ${content}
        </div>

        <!-- Signature -->
        <div class="signature-block">
          <div class="signature-line">
            <div class="signature-box">
              <div class="line"></div>
              ${doctor ? `<div class="doctor-name">${escHtml(doctor)}</div>` : '<div class="doctor-name">Reporting Physician</div>'}
              <div class="designation">Radiologist / Sonologist</div>
              ${institution ? `<div class="designation">${escHtml(institution)}</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    </td></tr></tbody>
  </table>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
