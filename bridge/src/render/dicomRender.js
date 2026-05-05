/**
 * DICOM render — parses a .dcm file, extracts pixel data, applies
 * WindowCenter/WindowWidth windowing, and produces a PNG data URL.
 *
 * Supports Explicit VR LE (via dicom-parser) and Implicit VR LE (via a
 * built-in manual scanner — dicom-parser throws plain strings for some
 * Implicit VR files, causing the caller to see e.message === undefined).
 *
 * Compressed transfer syntaxes (JPEG, JPEG2000) are NOT supported.
 */

const fs = require('fs');
const dicomParser = require('dicom-parser');
const { PNG } = require('pngjs');

const IMPLICIT_VR_LE = '1.2.840.10008.1.2';
const UNCOMPRESSED_TS = new Set([
  IMPLICIT_VR_LE,
  '1.2.840.10008.1.2.1',   // Explicit VR Little Endian
  '1.2.840.10008.1.2.2',   // Explicit VR Big Endian (rare)
]);

// ─── Meta-header parser (finds dataset start + transfer syntax) ───────────────

/**
 * Parse the Part 10 file meta header (Explicit VR LE, group 0002).
 * Returns { transferSyntax, datasetStart }.
 */
function readMetaHeader(buf) {
  if (buf.length < 132 || buf.slice(128, 132).toString('ascii') !== 'DICM') {
    return { transferSyntax: IMPLICIT_VR_LE, datasetStart: 0 };
  }

  let offset = 132;
  let transferSyntax = IMPLICIT_VR_LE;

  while (offset + 8 <= buf.length) {
    const group = buf.readUInt16LE(offset);
    if (group !== 0x0002) break;

    const elem = buf.readUInt16LE(offset + 2);
    const vr = buf.slice(offset + 4, offset + 6).toString('ascii');

    let valueLen, valueStart;
    if (['OB', 'OW', 'SQ', 'UC', 'UR', 'UT', 'UN'].includes(vr)) {
      valueLen = buf.readUInt32LE(offset + 8);
      valueStart = offset + 12;
    } else {
      valueLen = buf.readUInt16LE(offset + 6);
      valueStart = offset + 8;
    }

    if (elem === 0x0010) {
      transferSyntax = buf.slice(valueStart, valueStart + valueLen)
        .toString('ascii').replace(/[\0\s]+$/, '').trim() || IMPLICIT_VR_LE;
    }

    let next = valueStart + valueLen;
    if (next % 2 !== 0) next++;
    offset = next;
  }

  return { transferSyntax, datasetStart: offset };
}

// ─── Manual Implicit VR LE scanner ───────────────────────────────────────────

function _readStr(buf, offset, len) {
  if (len <= 0 || offset + len > buf.length) return '';
  return buf.slice(offset, offset + len).toString('ascii').replace(/[\0\s]+$/, '').trim();
}

/**
 * Skip an undefined-length sequence or item by scanning for its closing
 * delimiter (FFFE,E0DD or FFFE,E00D), respecting nesting depth.
 */
function _skipUndefinedLength(buf, pos, end) {
  let depth = 1;
  while (pos + 8 <= end) {
    const group = buf.readUInt16LE(pos);
    const elem  = buf.readUInt16LE(pos + 2);
    const vlen  = buf.readUInt32LE(pos + 4);
    const dpos  = pos + 8;

    if (group === 0xFFFE) {
      if (elem === 0xE0DD || elem === 0xE00D) {
        depth--;
        if (depth <= 0) return dpos;
        pos = dpos;
      } else if (elem === 0xE000) {
        if (vlen === 0xFFFFFFFF) depth++;
        pos = vlen === 0xFFFFFFFF ? dpos : dpos + vlen;
      } else {
        pos = dpos + (vlen === 0xFFFFFFFF ? 0 : vlen);
      }
      continue;
    }

    if (vlen === 0xFFFFFFFF) {
      depth++;
      pos = dpos;
    } else {
      let next = dpos + vlen;
      if (next % 2 !== 0) next++;
      pos = next;
    }
  }
  return pos;
}

/**
 * Scan an Implicit VR LE dataset for the tags we care about.
 * Returns a plain object with the extracted values.
 */
function scanImplicitVR(buf, datasetStart) {
  const t = {};
  let pos = datasetStart;
  const end = buf.length;

  while (pos + 8 <= end) {
    const group = buf.readUInt16LE(pos);
    const elem  = buf.readUInt16LE(pos + 2);
    const vlen  = buf.readUInt32LE(pos + 4);
    const dpos  = pos + 8;

    // Skip FFFE delimiter items (length field is always 0 for delimiters)
    if (group === 0xFFFE) { pos = dpos + (vlen === 0 ? 0 : vlen); continue; }

    // Stop at pixel data — record its location
    if (group === 0x7FE0 && elem === 0x0010) {
      t.pixelDataOffset = dpos;
      t.pixelDataLength = vlen;
      break;
    }

    // Guard against corrupt length
    if (vlen !== 0xFFFFFFFF && dpos + vlen > end) break;

    // Extract tags
    /* eslint-disable no-multi-spaces */
    if      (group === 0x0008 && elem === 0x0018) t.sopInstanceUid      = _readStr(buf, dpos, vlen);
    else if (group === 0x0008 && elem === 0x0020) t.studyDate           = _readStr(buf, dpos, vlen);
    else if (group === 0x0008 && elem === 0x0060) t.modality            = _readStr(buf, dpos, vlen);
    else if (group === 0x0010 && elem === 0x0010) t.patientName         = _readStr(buf, dpos, vlen);
    else if (group === 0x0010 && elem === 0x0020) t.patientId           = _readStr(buf, dpos, vlen);
    else if (group === 0x0010 && elem === 0x0030) t.patientDob          = _readStr(buf, dpos, vlen);
    else if (group === 0x0010 && elem === 0x0040) t.patientSex          = _readStr(buf, dpos, vlen);
    else if (group === 0x0010 && elem === 0x1010) t.patientAge          = _readStr(buf, dpos, vlen);
    else if (group === 0x0008 && elem === 0x0050) t.accessionNumber     = _readStr(buf, dpos, vlen);
    else if (group === 0x0008 && elem === 0x0090) t.referringPhysician  = _readStr(buf, dpos, vlen);
    else if (group === 0x0008 && elem === 0x1030) t.studyDescription    = _readStr(buf, dpos, vlen);
    else if (group === 0x0020 && elem === 0x000D) t.studyUid            = _readStr(buf, dpos, vlen);
    else if (group === 0x0020 && elem === 0x000E) t.seriesUid           = _readStr(buf, dpos, vlen);
    else if (group === 0x0020 && elem === 0x0013) t.instanceNumber      = parseInt(_readStr(buf, dpos, vlen)) || 0;
    else if (group === 0x0028 && elem === 0x0002) t.samplesPerPixel     = vlen >= 2 ? buf.readUInt16LE(dpos) : 1;
    else if (group === 0x0028 && elem === 0x0004) t.photometric         = _readStr(buf, dpos, vlen).toUpperCase();
    else if (group === 0x0028 && elem === 0x0010) t.rows                = vlen >= 2 ? buf.readUInt16LE(dpos) : 0;
    else if (group === 0x0028 && elem === 0x0011) t.cols                = vlen >= 2 ? buf.readUInt16LE(dpos) : 0;
    else if (group === 0x0028 && elem === 0x0100) t.bitsAllocated       = vlen >= 2 ? buf.readUInt16LE(dpos) : 8;
    else if (group === 0x0028 && elem === 0x0103) t.pixelRepresentation = vlen >= 2 ? buf.readUInt16LE(dpos) : 0;
    else if (group === 0x0028 && elem === 0x1050) t.wc                  = parseFloat(_readStr(buf, dpos, vlen).split('\\')[0]);
    else if (group === 0x0028 && elem === 0x1051) t.ww                  = parseFloat(_readStr(buf, dpos, vlen).split('\\')[0]);
    else if (group === 0x0028 && elem === 0x1052) t.rescaleIntercept    = parseFloat(_readStr(buf, dpos, vlen)) || 0;
    else if (group === 0x0028 && elem === 0x1053) t.rescaleSlope        = parseFloat(_readStr(buf, dpos, vlen)) || 1;
    else if (group === 0x0028 && elem === 0x0101) t.bitsStored          = vlen >= 2 ? buf.readUInt16LE(dpos) : 0;
    else if (group === 0x0028 && elem === 0x0120) t.pixelPaddingValue   = vlen >= 2 ? buf.readUInt16LE(dpos) : null;
    /* eslint-enable no-multi-spaces */

    // Advance
    if (vlen === 0xFFFFFFFF) {
      pos = _skipUndefinedLength(buf, dpos, end);
    } else {
      let next = dpos + vlen;
      if (next % 2 !== 0) next++;
      pos = next;
    }
  }

  return t;
}

// ─── Public API ───────────────────────────────────────────────────────────────

function parseStudyUid(filepath) {
  const buf = fs.readFileSync(filepath);
  const { transferSyntax, datasetStart } = readMetaHeader(buf);

  if (transferSyntax === IMPLICIT_VR_LE) {
    return scanImplicitVR(buf, datasetStart).studyUid || '';
  }

  // Try Explicit VR via dicom-parser; fall back to manual scanner on failure
  // (handles TS mismatch: meta says Explicit but bytes are actually Implicit)
  try {
    const ds = dicomParser.parseDicom(new Uint8Array(buf));
    return ds.string('x0020000d') || '';
  } catch (_) {
    return scanImplicitVR(buf, datasetStart).studyUid || '';
  }
}

function readMetadata(filepath) {
  const buf = fs.readFileSync(filepath);
  const { transferSyntax, datasetStart } = readMetaHeader(buf);

  const buildFromScan = (t) => ({
    studyUid:         t.studyUid         || '',
    seriesUid:        t.seriesUid        || '',
    sopInstanceUid:   t.sopInstanceUid   || '',
    instanceNumber:   t.instanceNumber   || 0,
    patientName:      t.patientName      || '',
    patientId:        t.patientId        || '',
    patientDob:       t.patientDob       || '',
    patientSex:       t.patientSex       || '',
    patientAge:       t.patientAge       || '',
    studyDate:        t.studyDate        || '',
    modality:         t.modality         || '',
    accessionNumber:  t.accessionNumber  || '',
    referringPhysician: t.referringPhysician || '',
    studyDescription: t.studyDescription || '',
    transferSyntax,
  });

  if (transferSyntax === IMPLICIT_VR_LE) {
    return buildFromScan(scanImplicitVR(buf, datasetStart));
  }

  try {
    const ds = dicomParser.parseDicom(new Uint8Array(buf));
    return {
      studyUid:         ds.string('x0020000d') || '',
      seriesUid:        ds.string('x0020000e') || '',
      sopInstanceUid:   ds.string('x00080018') || '',
      instanceNumber:   ds.intString('x00200013') || 0,
      patientName:      ds.string('x00100010') || '',
      patientId:        ds.string('x00100020') || '',
      patientDob:       ds.string('x00100030') || '',
      patientSex:       ds.string('x00100040') || '',
      patientAge:       ds.string('x00101010') || '',
      studyDate:        ds.string('x00080020') || '',
      modality:         ds.string('x00080060') || '',
      accessionNumber:  ds.string('x00080050') || '',
      referringPhysician: ds.string('x00080090') || '',
      studyDescription: ds.string('x00081030') || '',
      transferSyntax,
    };
  } catch (_) {
    return buildFromScan(scanImplicitVR(buf, datasetStart));
  }
}

/**
 * Read one pixel value from the buffer, applying sign-extension based on
 * BitsStored. Uses Buffer.readInt16LE / readUInt16LE / readUInt8 / readInt8
 * to avoid the byte-alignment requirement of Int16Array views over Buffer.
 */
function readPixel(buf, idx, bitsAllocated, bitsStored, signed) {
  if (bitsAllocated === 16) {
    if (signed) {
      let v = buf.readInt16LE(idx * 2);
      // Sign-extend if BitsStored < 16 (e.g. CT often stores 12 or 14 bits)
      if (bitsStored && bitsStored < 16) {
        const signBit = 1 << (bitsStored - 1);
        const mask = (1 << bitsStored) - 1;
        v = v & mask;
        if (v & signBit) v -= (1 << bitsStored);
      }
      return v;
    }
    return buf.readUInt16LE(idx * 2);
  }
  return signed ? buf.readInt8(idx) : buf.readUInt8(idx);
}

/**
 * Compute a sensible WC/WW when the file doesn't provide them by sampling
 * the pixel range. Uses 5–95 percentile to ignore extreme outliers.
 */
function autoWindow(buf, samples, bitsAllocated, bitsStored, signed, slope, intercept) {
  const stride = Math.max(1, Math.floor(samples / 5000));
  const vals = [];
  for (let i = 0; i < samples; i += stride) {
    vals.push(readPixel(buf, i, bitsAllocated, bitsStored, signed) * slope + intercept);
  }
  vals.sort((a, b) => a - b);
  const lo = vals[Math.floor(vals.length * 0.05)] ?? 0;
  const hi = vals[Math.floor(vals.length * 0.95)] ?? 255;
  const ww = Math.max(2, hi - lo);
  const wc = (lo + hi) / 2;
  return { wc, ww };
}

/**
 * Apply Modality LUT (Rescale Slope/Intercept) → VOI LUT (Window
 * Center/Width) → 8-bit grayscale. CT pixels in particular are stored as
 * raw signed Int16 with intercept ≈ -1024; without rescaling, every pixel
 * saturates against a HU-based window and the image prints pure white.
 */
function applyWindowing(pixelData, samples, bitsAllocated, bitsStored, signed, wc, ww, slope, intercept) {
  const out = Buffer.alloc(samples * 4); // RGBA
  const lower = wc - ww / 2;
  const upper = wc + ww / 2;
  const range = upper - lower || 1;

  for (let i = 0; i < samples; i++) {
    const raw = readPixel(pixelData, i, bitsAllocated, bitsStored, signed);
    const hu = raw * slope + intercept;
    let g;
    if (hu <= lower) g = 0;
    else if (hu >= upper) g = 255;
    else g = Math.round(((hu - lower) / range) * 255);
    out[i * 4] = g;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = g;
    out[i * 4 + 3] = 255;
  }
  return out;
}

function renderToPng(filepath, logger, opts = {}) {
  const buf = fs.readFileSync(filepath);
  const { transferSyntax, datasetStart } = readMetaHeader(buf);

  if (!UNCOMPRESSED_TS.has(transferSyntax)) {
    logger?.warn(`[Render] compressed transfer syntax ${transferSyntax} not supported, skipping ${filepath}`);
    return null;
  }

  let rows, cols, bitsAllocated, bitsStored, samplesPerPixel, photometric, pixelRepresentation, wc, ww, slope, intercept, pixelBytes;

  // Helper: fill render vars from manual Implicit VR scan
  const fillFromScan = () => {
    const t = scanImplicitVR(buf, datasetStart);
    rows              = t.rows              || 0;
    cols              = t.cols              || 0;
    bitsAllocated     = t.bitsAllocated     || 8;
    bitsStored        = t.bitsStored        || bitsAllocated;
    samplesPerPixel   = t.samplesPerPixel   || 1;
    photometric       = t.photometric       || 'MONOCHROME2';
    pixelRepresentation = t.pixelRepresentation || 0;
    wc  = (t.wc != null && !isNaN(t.wc)) ? t.wc : NaN;
    ww  = (t.ww != null && !isNaN(t.ww)) ? t.ww : NaN;
    slope     = (t.rescaleSlope     != null && !isNaN(t.rescaleSlope))     ? t.rescaleSlope     : 1;
    intercept = (t.rescaleIntercept != null && !isNaN(t.rescaleIntercept)) ? t.rescaleIntercept : 0;

    if (!rows || !cols) {
      logger?.warn(`[Render] missing rows/cols in ${filepath}`);
      return false;
    }
    if (t.pixelDataOffset == null) {
      logger?.warn(`[Render] no pixel data in ${filepath}`);
      return false;
    }

    const pdLen = (t.pixelDataLength === 0xFFFFFFFF || t.pixelDataLength == null)
      ? buf.length - t.pixelDataOffset
      : t.pixelDataLength;
    pixelBytes = buf.slice(t.pixelDataOffset, t.pixelDataOffset + pdLen);
    return true;
  };

  if (transferSyntax === IMPLICIT_VR_LE) {
    if (!fillFromScan()) return null;
  } else {
    // Try Explicit VR via dicom-parser; fall back to manual scanner on failure
    let ok = false;
    try {
      const ds = dicomParser.parseDicom(new Uint8Array(buf));

      rows              = ds.uint16('x00280010');
      cols              = ds.uint16('x00280011');
      bitsAllocated     = ds.uint16('x00280100') || 8;
      bitsStored        = ds.uint16('x00280101') || bitsAllocated;
      samplesPerPixel   = ds.uint16('x00280002') || 1;
      photometric       = (ds.string('x00280004') || 'MONOCHROME2').toUpperCase();
      pixelRepresentation = ds.uint16('x00280103') || 0;
      const wcStr = ds.string('x00281050');
      const wwStr = ds.string('x00281051');
      wc = wcStr ? parseFloat(wcStr.split('\\')[0]) : NaN;
      ww = wwStr ? parseFloat(wwStr.split('\\')[0]) : NaN;
      const slopeStr     = ds.string('x00281053');
      const interceptStr = ds.string('x00281052');
      slope     = slopeStr     ? (parseFloat(slopeStr)     || 1) : 1;
      intercept = interceptStr ? (parseFloat(interceptStr) || 0) : 0;

      if (!rows || !cols) {
        logger?.warn(`[Render] missing rows/cols in ${filepath}`);
        return null;
      }

      const pixelDataElement = ds.elements.x7fe00010;
      if (!pixelDataElement) {
        logger?.warn(`[Render] no pixel data in ${filepath}`);
        return null;
      }

      pixelBytes = Buffer.from(
        buf.buffer,
        buf.byteOffset + pixelDataElement.dataOffset,
        pixelDataElement.length,
      );
      ok = true;
    } catch (e) {
      logger?.info(`[Render] dicom-parser failed, falling back to manual scanner: ${e?.exception || e?.message || String(e)}`);
    }

    if (!ok) {
      if (!fillFromScan()) return null;
    }
  }

  const totalSamples = rows * cols;

  // Determine target dimensions BEFORE creating the PNG to avoid
  // allocating a full-resolution RGBA buffer unnecessarily.
  const maxDim = opts.maxDim || 0;
  const needsDownscale = maxDim > 0 && (cols > maxDim || rows > maxDim);
  const scale = needsDownscale ? Math.min(maxDim / cols, maxDim / rows) : 1;
  const outW = needsDownscale ? Math.max(1, Math.round(cols * scale)) : cols;
  const outH = needsDownscale ? Math.max(1, Math.round(rows * scale)) : rows;

  if (needsDownscale) {
    logger?.info(`[Render] downscale ${cols}x${rows} → ${outW}x${outH}`);
  }

  const png = new PNG({ width: outW, height: outH });

  if (samplesPerPixel === 3) {
    if (needsDownscale) {
      // Nearest-neighbour downscale directly from source pixels → PNG
      for (let dy = 0; dy < outH; dy++) {
        const sy = Math.min(rows - 1, Math.floor(dy / scale));
        for (let dx = 0; dx < outW; dx++) {
          const sx = Math.min(cols - 1, Math.floor(dx / scale));
          const si = (sy * cols + sx) * 3;
          const di = (dy * outW + dx) * 4;
          png.data[di]     = pixelBytes[si];
          png.data[di + 1] = pixelBytes[si + 1];
          png.data[di + 2] = pixelBytes[si + 2];
          png.data[di + 3] = 255;
        }
      }
    } else {
      for (let i = 0; i < totalSamples; i++) {
        png.data[i * 4]     = pixelBytes[i * 3];
        png.data[i * 4 + 1] = pixelBytes[i * 3 + 1];
        png.data[i * 4 + 2] = pixelBytes[i * 3 + 2];
        png.data[i * 4 + 3] = 255;
      }
    }
  } else {
    const signed = pixelRepresentation === 1;
    if (isNaN(wc) || isNaN(ww) || ww <= 0) {
      const auto = autoWindow(pixelBytes, totalSamples, bitsAllocated, bitsStored, signed, slope, intercept);
      wc = auto.wc; ww = auto.ww;
      logger?.info(`[Render] auto window WC=${wc.toFixed(0)} WW=${ww.toFixed(0)}`);
    }

    // Apply windowing directly into the (possibly smaller) PNG buffer
    const lower = wc - ww / 2;
    const upper = wc + ww / 2;
    const range = upper - lower;
    const bytesPerSample = bitsAllocated <= 8 ? 1 : 2;
    const invert = photometric === 'MONOCHROME1';

    if (needsDownscale) {
      for (let dy = 0; dy < outH; dy++) {
        const sy = Math.min(rows - 1, Math.floor(dy / scale));
        for (let dx = 0; dx < outW; dx++) {
          const sx = Math.min(cols - 1, Math.floor(dx / scale));
          const si = sy * cols + sx;
          let raw;
          if (bytesPerSample === 1) {
            raw = signed ? (pixelBytes[si] > 127 ? pixelBytes[si] - 256 : pixelBytes[si]) : pixelBytes[si];
          } else {
            raw = pixelBytes.readUInt16LE(si * 2);
            if (signed && raw > 32767) raw -= 65536;
          }
          const hu = raw * slope + intercept;
          let g;
          if (hu <= lower) g = 0;
          else if (hu >= upper) g = 255;
          else g = Math.round(((hu - lower) / range) * 255);
          if (invert) g = 255 - g;
          const di = (dy * outW + dx) * 4;
          png.data[di] = g;
          png.data[di + 1] = g;
          png.data[di + 2] = g;
          png.data[di + 3] = 255;
        }
      }
    } else {
      const rgba = applyWindowing(pixelBytes, totalSamples, bitsAllocated, bitsStored, signed, wc, ww, slope, intercept);
      if (invert) {
        for (let i = 0; i < totalSamples; i++) {
          rgba[i * 4] = 255 - rgba[i * 4];
          rgba[i * 4 + 1] = 255 - rgba[i * 4 + 1];
          rgba[i * 4 + 2] = 255 - rgba[i * 4 + 2];
        }
      }
      rgba.copy(png.data);
    }
  }

  // filterType 0 (none) is fastest to encode; size difference is negligible
  // for already-downscaled grayscale images
  const pngBuf = PNG.sync.write(png, { filterType: 0 });

  if (opts.outFile) {
    fs.writeFileSync(opts.outFile, pngBuf);
    return opts.outFile;
  }

  return `data:image/png;base64,${pngBuf.toString('base64')}`;
}

module.exports = { parseStudyUid, readMetadata, renderToPng };
