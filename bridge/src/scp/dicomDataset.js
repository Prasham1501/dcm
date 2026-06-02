const dicomParser = require('dicom-parser');

const IMPLICIT_VR_LE = '1.2.840.10008.1.2';
const EXPLICIT_VR_LE = '1.2.840.10008.1.2.1';

const LONG_EXPLICIT_VRS = new Set(['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT']);
const STRING_VRS = new Set(['AE', 'AS', 'CS', 'DA', 'DS', 'DT', 'IS', 'LO', 'LT', 'PN', 'SH', 'ST', 'TM', 'UC', 'UI', 'UR', 'UT']);

function tagKey(group, elem) {
  return `x${group.toString(16).padStart(4, '0')}${elem.toString(16).padStart(4, '0')}`;
}

function cleanString(value) {
  return String(value || '').replace(/[\0\s]+$/g, '').trim();
}

function bufferFromByteArray(byteArray, offset, length) {
  return Buffer.from(byteArray.buffer, byteArray.byteOffset + offset, length);
}

function parseDataset(buffer, transferSyntax = IMPLICIT_VR_LE) {
  const bytes = buffer instanceof Uint8Array
    ? buffer
    : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
  const parser = dicomParser.littleEndianByteArrayParser;
  const dataSet = new dicomParser.DataSet(parser, bytes, {});
  const stream = new dicomParser.ByteStream(parser, bytes, 0);

  if (transferSyntax === EXPLICIT_VR_LE) {
    dicomParser.parseDicomDataSetExplicit(dataSet, stream, bytes.length);
  } else {
    dicomParser.parseDicomDataSetImplicit(dataSet, stream, bytes.length);
  }
  return dataSet;
}

function getString(dataSet, tag, fallback = '') {
  if (!dataSet) return fallback;
  try {
    return cleanString(dataSet.string(tag) || fallback);
  } catch (_) {
    return fallback;
  }
}

function getUint16(dataSet, tag, fallback = 0) {
  if (!dataSet) return fallback;
  try {
    const value = dataSet.uint16(tag);
    return Number.isFinite(value) ? value : fallback;
  } catch (_) {
    return fallback;
  }
}

function getIntString(dataSet, tag, fallback = 0) {
  if (!dataSet) return fallback;
  try {
    const value = parseInt(dataSet.string(tag) || '', 10);
    return Number.isFinite(value) ? value : fallback;
  } catch (_) {
    return fallback;
  }
}

function getElementBytes(dataSet, tag) {
  const element = dataSet?.elements?.[tag];
  if (!element || element.dataOffset == null || element.length == null || element.length === 0xFFFFFFFF) {
    return null;
  }
  return bufferFromByteArray(dataSet.byteArray, element.dataOffset, element.length);
}

function getSequenceItems(dataSet, tag) {
  const element = dataSet?.elements?.[tag];
  return Array.isArray(element?.items) ? element.items : [];
}

function firstSequenceItem(dataSet, tag) {
  return getSequenceItems(dataSet, tag)[0]?.dataSet || null;
}

function padValue(vr, value) {
  const isBinary = Buffer.isBuffer(value) || Array.isArray(value);
  let buf;
  if (Buffer.isBuffer(value)) {
    buf = value;
  } else if (Array.isArray(value)) {
    buf = Buffer.concat(value);
  } else {
    buf = Buffer.from(String(value ?? ''), 'ascii');
  }

  if (buf.length % 2 === 0) return buf;
  const pad = isBinary || vr === 'UI' ? 0x00 : 0x20;
  return Buffer.concat([buf, Buffer.from([pad])]);
}

function encodePrimitiveValue(vr, value, transferSyntax) {
  if (Buffer.isBuffer(value)) return padValue(vr, value);

  if (vr === 'US') {
    const values = Array.isArray(value) ? value : [value];
    const buf = Buffer.alloc(values.length * 2);
    values.forEach((v, idx) => buf.writeUInt16LE(Math.max(0, parseInt(v, 10) || 0), idx * 2));
    return buf;
  }

  if (vr === 'UL') {
    const values = Array.isArray(value) ? value : [value];
    const buf = Buffer.alloc(values.length * 4);
    values.forEach((v, idx) => buf.writeUInt32LE(Math.max(0, parseInt(v, 10) || 0), idx * 4));
    return buf;
  }

  if (vr === 'AT') {
    const values = Array.isArray(value[0]) ? value : [value];
    const buf = Buffer.alloc(values.length * 4);
    values.forEach(([group, elem], idx) => {
      buf.writeUInt16LE(group, idx * 4);
      buf.writeUInt16LE(elem, idx * 4 + 2);
    });
    return buf;
  }

  if (STRING_VRS.has(vr)) {
    return padValue(vr, String(value ?? ''));
  }

  return padValue(vr, value ?? '');
}

function encodeElement(element, transferSyntax) {
  const { group, elem, vr, value } = element;

  let valueBuf;
  if (vr === 'SQ') {
    const items = Array.isArray(value) ? value : [];
    const itemBuffers = items.map((item) => {
      const itemData = Buffer.isBuffer(item) ? item : encodeDataset(item, transferSyntax);
      const itemHeader = Buffer.alloc(8);
      itemHeader.writeUInt16LE(0xFFFE, 0);
      itemHeader.writeUInt16LE(0xE000, 2);
      itemHeader.writeUInt32LE(itemData.length, 4);
      return Buffer.concat([itemHeader, itemData]);
    });
    valueBuf = Buffer.concat(itemBuffers);
  } else {
    valueBuf = encodePrimitiveValue(vr, value, transferSyntax);
  }

  if (transferSyntax === EXPLICIT_VR_LE) {
    const tag = Buffer.alloc(LONG_EXPLICIT_VRS.has(vr) ? 12 : 8);
    tag.writeUInt16LE(group, 0);
    tag.writeUInt16LE(elem, 2);
    tag.write(vr, 4, 2, 'ascii');
    if (LONG_EXPLICIT_VRS.has(vr)) {
      tag.writeUInt16LE(0, 6);
      tag.writeUInt32LE(valueBuf.length, 8);
    } else {
      tag.writeUInt16LE(valueBuf.length, 6);
    }
    return Buffer.concat([tag, valueBuf]);
  }

  const tag = Buffer.alloc(8);
  tag.writeUInt16LE(group, 0);
  tag.writeUInt16LE(elem, 2);
  tag.writeUInt32LE(valueBuf.length, 4);
  return Buffer.concat([tag, valueBuf]);
}

function encodeDataset(elements, transferSyntax = EXPLICIT_VR_LE) {
  return Buffer.concat((elements || []).map((element) => encodeElement(element, transferSyntax)));
}

function extractImageBoxPayload(dataSet) {
  const imageSet =
    firstSequenceItem(dataSet, 'x20200110') ||
    firstSequenceItem(dataSet, 'x20200111') ||
    dataSet;

  const pixelBytes = getElementBytes(imageSet, 'x7fe00010');
  if (!pixelBytes) throw new Error('image box has no native Pixel Data');

  const samplesPerPixel = getUint16(imageSet, 'x00280002', 1);
  const rows = getUint16(imageSet, 'x00280010', 0);
  const cols = getUint16(imageSet, 'x00280011', 0);
  const bitsAllocated = getUint16(imageSet, 'x00280100', 8);
  const bitsStored = getUint16(imageSet, 'x00280101', bitsAllocated);
  const highBit = getUint16(imageSet, 'x00280102', Math.max(0, bitsStored - 1));
  const pixelRepresentation = getUint16(imageSet, 'x00280103', 0);
  const planarConfiguration = getUint16(imageSet, 'x00280006', 0);
  const photometric = getString(imageSet, 'x00280004', samplesPerPixel === 3 ? 'RGB' : 'MONOCHROME2').toUpperCase();

  if (!rows || !cols) throw new Error('image box missing Rows/Columns');

  let normalizedPixelBytes = pixelBytes;
  if (samplesPerPixel === 3 && planarConfiguration === 1 && bitsAllocated === 8) {
    const pixels = rows * cols;
    const out = Buffer.alloc(pixels * 3);
    for (let i = 0; i < pixels; i++) {
      out[i * 3] = pixelBytes[i];
      out[i * 3 + 1] = pixelBytes[pixels + i];
      out[i * 3 + 2] = pixelBytes[pixels * 2 + i];
    }
    normalizedPixelBytes = out;
  }

  return {
    samplesPerPixel,
    rows,
    cols,
    bitsAllocated,
    bitsStored,
    highBit,
    pixelRepresentation,
    planarConfiguration: samplesPerPixel === 3 ? 0 : undefined,
    photometric,
    pixelBytes: normalizedPixelBytes,
    windowCenter: getString(imageSet, 'x00281050', ''),
    windowWidth: getString(imageSet, 'x00281051', ''),
    rescaleIntercept: getString(imageSet, 'x00281052', ''),
    rescaleSlope: getString(imageSet, 'x00281053', ''),
  };
}

module.exports = {
  IMPLICIT_VR_LE,
  EXPLICIT_VR_LE,
  tagKey,
  parseDataset,
  getString,
  getUint16,
  getIntString,
  getElementBytes,
  getSequenceItems,
  firstSequenceItem,
  encodeDataset,
  extractImageBoxPayload,
};
