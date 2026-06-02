const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const {
  buildNGetRSP,
  buildNSetRSP,
  buildNActionRSP,
  buildNCreateRSP,
  buildNDeleteRSP,
  buildFileMetaHeader,
} = require('./pduCodec');
const {
  IMPLICIT_VR_LE,
  EXPLICIT_VR_LE,
  parseDataset,
  getString,
  getUint16,
  getIntString,
  encodeDataset,
  extractImageBoxPayload,
} = require('./dicomDataset');

const SOP = {
  BASIC_FILM_SESSION: '1.2.840.10008.5.1.1.1',
  BASIC_FILM_BOX: '1.2.840.10008.5.1.1.2',
  BASIC_GRAYSCALE_IMAGE_BOX: '1.2.840.10008.5.1.1.4',
  BASIC_COLOR_IMAGE_BOX: '1.2.840.10008.5.1.1.4.1',
  BASIC_GRAYSCALE_PRINT_META: '1.2.840.10008.5.1.1.9',
  BASIC_COLOR_PRINT_META: '1.2.840.10008.5.1.1.18',
  PRINTER: '1.2.840.10008.5.1.1.16',
  PRINTER_INSTANCE: '1.2.840.10008.5.1.1.17',
  SECONDARY_CAPTURE: '1.2.840.10008.5.1.4.1.1.7',
};

const PRINT_COMMANDS = new Set([0x0110, 0x0120, 0x0130, 0x0140, 0x0150]);
const STATUS_SUCCESS = 0x0000;
const STATUS_NO_SUCH_OBJECT = 0x0112;
const STATUS_PROCESSING_FAILURE = 0xC000;

let uidCounter = 1;

function generateUid() {
  const now = Date.now();
  const counter = uidCounter++ % 100000;
  return `1.2.826.0.1.3680043.8.498.2.${now}.${counter}`;
}

function normalizeTransferSyntax(ts) {
  return ts === EXPLICIT_VR_LE ? EXPLICIT_VR_LE : IMPLICIT_VR_LE;
}

function responseSyntaxFor(ts) {
  return normalizeTransferSyntax(ts);
}

function clampCopies(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 99);
}

function parseImageDisplayFormat(value) {
  const raw = String(value || '').trim().toUpperCase();
  const match = raw.match(/^STANDARD\\(\d+)\s*,\s*(\d+)$/);
  if (match) {
    const cols = Math.max(1, parseInt(match[1], 10) || 1);
    const rows = Math.max(1, parseInt(match[2], 10) || 1);
    return { type: 'STANDARD', cols, rows, spots: cols * rows, raw };
  }
  return { type: 'STANDARD', cols: 1, rows: 1, spots: 1, raw: raw || 'STANDARD\\1,1' };
}

function dicomDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function dicomTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
}

function isColorContext(abstractSyntax) {
  return abstractSyntax === SOP.BASIC_COLOR_PRINT_META || abstractSyntax === SOP.BASIC_COLOR_IMAGE_BOX;
}

function requestedSopClass(cmd) {
  return cmd['0000,0003'] || cmd['0000,0002'] || '';
}

function requestedSopInstance(cmd) {
  return cmd['0000,1001'] || cmd['0000,1000'] || '';
}

class PrintScpHandler extends EventEmitter {
  constructor({ aeTitle, storageDir, logger }) {
    super();
    this.aeTitle = aeTitle;
    this.storageDir = storageDir;
    this.logger = logger || console;
    this.sessions = new Map();
    this.filmBoxes = new Map();
    this.currentSessionUid = null;
    this.currentFilmBoxUid = null;
  }

  static isPrintCommand(commandField) {
    return PRINT_COMMANDS.has(commandField);
  }

  handleCommand({ pcId, cmd, datasetData, transferSyntax, abstractSyntax, associationInfo, remoteAddress }) {
    const commandField = cmd['0000,0100'];
    const messageId = cmd['0000,0110'] || 1;
    const rqClassUid = requestedSopClass(cmd);
    const rqInstanceUid = requestedSopInstance(cmd);
    const rspSyntax = responseSyntaxFor(transferSyntax);

    try {
      if (commandField === 0x0140) {
        return this._handleNCreate({ pcId, cmd, messageId, datasetData, transferSyntax, abstractSyntax, rspSyntax });
      }
      if (commandField === 0x0120) {
        return this._handleNSet({ pcId, cmd, messageId, datasetData, transferSyntax, rspSyntax });
      }
      if (commandField === 0x0130) {
        return this._handleNAction({ pcId, cmd, messageId, rqClassUid, rqInstanceUid, associationInfo, remoteAddress });
      }
      if (commandField === 0x0110) {
        return this._handleNGet({ pcId, messageId, rqClassUid, rqInstanceUid, rspSyntax });
      }
      if (commandField === 0x0150) {
        return this._handleNDelete({ pcId, messageId, rqClassUid, rqInstanceUid });
      }
    } catch (e) {
      this.logger.error(`[Print SCP ${this.aeTitle}] command failed: ${e?.message || e}`);
      return this._buildFailureResponse(pcId, commandField, messageId, rqClassUid, rqInstanceUid);
    }

    return null;
  }

  _buildFailureResponse(pcId, commandField, messageId, sopClassUid, sopInstanceUid) {
    const opts = {
      messageId,
      status: STATUS_PROCESSING_FAILURE,
      affectedSopClassUid: sopClassUid,
      affectedSopInstanceUid: sopInstanceUid,
    };
    if (commandField === 0x0110) return buildNGetRSP(pcId, opts);
    if (commandField === 0x0120) return buildNSetRSP(pcId, opts);
    if (commandField === 0x0130) return buildNActionRSP(pcId, { ...opts, actionTypeId: 1 });
    if (commandField === 0x0140) return buildNCreateRSP(pcId, opts);
    if (commandField === 0x0150) return buildNDeleteRSP(pcId, opts);
    return buildNSetRSP(pcId, opts);
  }

  _parseDataset(datasetData, transferSyntax) {
    if (!datasetData || datasetData.length === 0) return null;
    return parseDataset(datasetData, normalizeTransferSyntax(transferSyntax));
  }

  _handleNCreate({ pcId, cmd, messageId, datasetData, transferSyntax, abstractSyntax, rspSyntax }) {
    const affectedClass = cmd['0000,0002'] || '';
    const requestedInstance = cmd['0000,1000'] || '';
    const dataSet = this._parseDataset(datasetData, transferSyntax);

    if (affectedClass === SOP.BASIC_FILM_SESSION) {
      const sessionUid = requestedInstance || generateUid();
      const numberOfCopies = clampCopies(getString(dataSet, 'x20000010', '1'));
      const session = {
        uid: sessionUid,
        numberOfCopies,
        printPriority: getString(dataSet, 'x20000020', ''),
        mediumType: getString(dataSet, 'x20000030', ''),
        filmDestination: getString(dataSet, 'x20000040', ''),
        label: getString(dataSet, 'x20000050', ''),
        createdAt: new Date().toISOString(),
      };
      this.sessions.set(sessionUid, session);
      this.currentSessionUid = sessionUid;
      this.logger.info(`[Print SCP ${this.aeTitle}] Film Session N-CREATE copies=${numberOfCopies}`);
      return buildNCreateRSP(pcId, {
        messageId,
        status: STATUS_SUCCESS,
        affectedSopClassUid: SOP.BASIC_FILM_SESSION,
        affectedSopInstanceUid: sessionUid,
      });
    }

    if (affectedClass === SOP.BASIC_FILM_BOX) {
      const filmBoxUid = requestedInstance || generateUid();
      const imageDisplay = parseImageDisplayFormat(getString(dataSet, 'x20100010', 'STANDARD\\1,1'));
      const filmOrientation = getString(dataSet, 'x20100040', '').toUpperCase();
      const filmSizeId = getString(dataSet, 'x20100050', '').toUpperCase();
      const imageBoxClass = isColorContext(abstractSyntax)
        ? SOP.BASIC_COLOR_IMAGE_BOX
        : SOP.BASIC_GRAYSCALE_IMAGE_BOX;

      const imageBoxes = [];
      for (let i = 1; i <= imageDisplay.spots; i++) {
        const uid = generateUid();
        const box = {
          sopClassUid: imageBoxClass,
          sopInstanceUid: uid,
          position: i,
          filepath: null,
          receivedAt: null,
        };
        imageBoxes.push(box);
      }

      const filmBox = {
        uid: filmBoxUid,
        sessionUid: this.currentSessionUid,
        imageDisplay,
        filmOrientation,
        filmSizeId,
        imageBoxes,
        createdAt: new Date().toISOString(),
      };
      this.filmBoxes.set(filmBoxUid, filmBox);
      this.currentFilmBoxUid = filmBoxUid;

      const rspDataset = encodeDataset([{
        group: 0x2010,
        elem: 0x0510,
        vr: 'SQ',
        value: imageBoxes.map((box) => [
          { group: 0x0008, elem: 0x1150, vr: 'UI', value: box.sopClassUid },
          { group: 0x0008, elem: 0x1155, vr: 'UI', value: box.sopInstanceUid },
        ]),
      }], rspSyntax);

      this.logger.info(`[Print SCP ${this.aeTitle}] Film Box N-CREATE layout=${imageDisplay.raw} orientation=${filmOrientation || 'auto'} boxes=${imageBoxes.length}`);
      return buildNCreateRSP(pcId, {
        messageId,
        status: STATUS_SUCCESS,
        affectedSopClassUid: SOP.BASIC_FILM_BOX,
        affectedSopInstanceUid: filmBoxUid,
        dataset: rspDataset,
      });
    }

    return buildNCreateRSP(pcId, {
      messageId,
      status: STATUS_PROCESSING_FAILURE,
      affectedSopClassUid: affectedClass,
      affectedSopInstanceUid: requestedInstance,
    });
  }

  _findImageBox(instanceUid, position) {
    for (const filmBox of this.filmBoxes.values()) {
      const byUid = filmBox.imageBoxes.find((box) => box.sopInstanceUid === instanceUid);
      if (byUid) return { filmBox, imageBox: byUid };
      if (position) {
        const byPosition = filmBox.imageBoxes.find((box) => box.position === position);
        if (byPosition) return { filmBox, imageBox: byPosition };
      }
    }
    return null;
  }

  _handleNSet({ pcId, cmd, messageId, datasetData, transferSyntax, rspSyntax }) {
    const rqClassUid = requestedSopClass(cmd);
    const rqInstanceUid = requestedSopInstance(cmd);
    const dataSet = this._parseDataset(datasetData, transferSyntax);
    const imagePosition = getUint16(dataSet, 'x20200010', 0);
    const found = this._findImageBox(rqInstanceUid, imagePosition);

    if (!found) {
      this.logger.warn(`[Print SCP ${this.aeTitle}] N-SET for unknown Image Box ${rqInstanceUid || imagePosition}`);
      return buildNSetRSP(pcId, {
        messageId,
        status: STATUS_NO_SUCH_OBJECT,
        affectedSopClassUid: rqClassUid,
        affectedSopInstanceUid: rqInstanceUid,
      });
    }

    const payload = extractImageBoxPayload(dataSet);
    const filepath = this._writeImageBoxDicom(payload, found.filmBox, found.imageBox);
    found.imageBox.filepath = filepath;
    found.imageBox.sopClassUid = rqClassUid || found.imageBox.sopClassUid;
    found.imageBox.receivedAt = new Date().toISOString();
    found.imageBox.rows = payload.rows;
    found.imageBox.cols = payload.cols;

    this.logger.info(`[Print SCP ${this.aeTitle}] Image Box N-SET pos=${found.imageBox.position} ${payload.cols}x${payload.rows} ${payload.samplesPerPixel === 3 ? 'color' : 'gray'}`);
    return buildNSetRSP(pcId, {
      messageId,
      status: STATUS_SUCCESS,
      affectedSopClassUid: found.imageBox.sopClassUid,
      affectedSopInstanceUid: found.imageBox.sopInstanceUid,
    });
  }

  _handleNAction({ pcId, cmd, messageId, rqClassUid, rqInstanceUid, associationInfo, remoteAddress }) {
    const actionTypeId = cmd['0000,1008'] || 1;
    const filmBoxes = this._filmBoxesForAction(rqClassUid, rqInstanceUid);
    if (filmBoxes.length === 0) {
      return buildNActionRSP(pcId, {
        messageId,
        status: STATUS_NO_SUCH_OBJECT,
        affectedSopClassUid: rqClassUid,
        affectedSopInstanceUid: rqInstanceUid,
        actionTypeId,
      });
    }

    for (const filmBox of filmBoxes) {
      const files = filmBox.imageBoxes
        .filter((box) => box.filepath)
        .map((box) => ({
          filepath: box.filepath,
          info: {
            sopClassUid: box.sopClassUid,
            sopInstanceUid: box.sopInstanceUid,
            imageBoxPosition: box.position,
          },
        }));

      if (files.length === 0) {
        this.logger.warn(`[Print SCP ${this.aeTitle}] N-ACTION ignored: no image boxes received`);
        continue;
      }

      const session = this.sessions.get(filmBox.sessionUid) || {};
      this.emit('print', {
        kind: 'dicom-print',
        callingAE: associationInfo?.callingAE || '',
        remoteAddress: remoteAddress || '',
        filmSessionUid: filmBox.sessionUid || '',
        filmBoxUid: filmBox.uid,
        studyUid: `dicom-print-${filmBox.uid}`,
        files,
        directPrint: {
          filmSessionUid: filmBox.sessionUid || '',
          filmBoxUid: filmBox.uid,
          layout: {
            id: `dicom-print-${filmBox.imageDisplay.cols}x${filmBox.imageDisplay.rows}`,
            name: filmBox.imageDisplay.raw,
            cols: filmBox.imageDisplay.cols,
            rows: filmBox.imageDisplay.rows,
            spots: filmBox.imageDisplay.spots,
          },
          imageBoxes: filmBox.imageBoxes.map((box) => ({
            position: box.position,
            filepath: box.filepath,
            sopInstanceUid: box.sopInstanceUid,
          })),
          filmOrientation: filmBox.filmOrientation,
          filmSizeId: filmBox.filmSizeId,
          copies: clampCopies(session.numberOfCopies || 1),
        },
      });
      this.logger.info(`[Print SCP ${this.aeTitle}] Film Box N-ACTION queued layout=${filmBox.imageDisplay.raw} copies=${clampCopies(session.numberOfCopies || 1)}`);
    }

    return buildNActionRSP(pcId, {
      messageId,
      status: STATUS_SUCCESS,
      affectedSopClassUid: rqClassUid,
      affectedSopInstanceUid: rqInstanceUid,
      actionTypeId,
    });
  }

  _filmBoxesForAction(rqClassUid, rqInstanceUid) {
    if (this.filmBoxes.has(rqInstanceUid)) return [this.filmBoxes.get(rqInstanceUid)];
    if (rqClassUid === SOP.BASIC_FILM_SESSION && this.sessions.has(rqInstanceUid)) {
      return Array.from(this.filmBoxes.values()).filter((box) => box.sessionUid === rqInstanceUid);
    }
    if (this.currentFilmBoxUid && this.filmBoxes.has(this.currentFilmBoxUid)) {
      return [this.filmBoxes.get(this.currentFilmBoxUid)];
    }
    return [];
  }

  _handleNGet({ pcId, messageId, rqClassUid, rqInstanceUid, rspSyntax }) {
    const dataset = encodeDataset([
      { group: 0x2110, elem: 0x0010, vr: 'CS', value: 'NORMAL' },
      { group: 0x2110, elem: 0x0020, vr: 'CS', value: 'NORMAL' },
      { group: 0x2110, elem: 0x0030, vr: 'LO', value: 'One Clickz Bridge' },
      { group: 0x0008, elem: 0x0070, vr: 'LO', value: 'One Clickz' },
      { group: 0x0008, elem: 0x1090, vr: 'LO', value: 'One Clickz Bridge' },
    ], rspSyntax);

    return buildNGetRSP(pcId, {
      messageId,
      status: STATUS_SUCCESS,
      affectedSopClassUid: rqClassUid || SOP.PRINTER,
      affectedSopInstanceUid: rqInstanceUid || SOP.PRINTER_INSTANCE,
      dataset,
    });
  }

  _handleNDelete({ pcId, messageId, rqClassUid, rqInstanceUid }) {
    if (this.filmBoxes.has(rqInstanceUid)) this.filmBoxes.delete(rqInstanceUid);
    if (this.sessions.has(rqInstanceUid)) {
      this.sessions.delete(rqInstanceUid);
      for (const [uid, box] of this.filmBoxes.entries()) {
        if (box.sessionUid === rqInstanceUid) this.filmBoxes.delete(uid);
      }
    }
    return buildNDeleteRSP(pcId, {
      messageId,
      status: STATUS_SUCCESS,
      affectedSopClassUid: rqClassUid,
      affectedSopInstanceUid: rqInstanceUid,
    });
  }

  _writeImageBoxDicom(payload, filmBox, imageBox) {
    const dir = path.join(this.storageDir, 'dicom-print', filmBox.uid);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const sopInstanceUid = generateUid();
    const elements = [
      { group: 0x0008, elem: 0x0016, vr: 'UI', value: SOP.SECONDARY_CAPTURE },
      { group: 0x0008, elem: 0x0018, vr: 'UI', value: sopInstanceUid },
      { group: 0x0008, elem: 0x0020, vr: 'DA', value: dicomDate() },
      { group: 0x0008, elem: 0x0030, vr: 'TM', value: dicomTime() },
      { group: 0x0008, elem: 0x0060, vr: 'CS', value: 'OT' },
      { group: 0x0008, elem: 0x1030, vr: 'LO', value: 'DICOM Print Image' },
      { group: 0x0020, elem: 0x000D, vr: 'UI', value: filmBox.uid },
      { group: 0x0020, elem: 0x000E, vr: 'UI', value: filmBox.uid + '.1' },
      { group: 0x0020, elem: 0x0013, vr: 'IS', value: String(imageBox.position) },
      { group: 0x0028, elem: 0x0002, vr: 'US', value: payload.samplesPerPixel },
      { group: 0x0028, elem: 0x0004, vr: 'CS', value: payload.photometric },
      { group: 0x0028, elem: 0x0010, vr: 'US', value: payload.rows },
      { group: 0x0028, elem: 0x0011, vr: 'US', value: payload.cols },
      { group: 0x0028, elem: 0x0100, vr: 'US', value: payload.bitsAllocated },
      { group: 0x0028, elem: 0x0101, vr: 'US', value: payload.bitsStored },
      { group: 0x0028, elem: 0x0102, vr: 'US', value: payload.highBit },
      { group: 0x0028, elem: 0x0103, vr: 'US', value: payload.pixelRepresentation },
    ];

    if (payload.samplesPerPixel === 3) {
      elements.push({ group: 0x0028, elem: 0x0006, vr: 'US', value: payload.planarConfiguration || 0 });
    }
    if (payload.windowCenter) elements.push({ group: 0x0028, elem: 0x1050, vr: 'DS', value: payload.windowCenter });
    if (payload.windowWidth) elements.push({ group: 0x0028, elem: 0x1051, vr: 'DS', value: payload.windowWidth });
    if (payload.rescaleIntercept) elements.push({ group: 0x0028, elem: 0x1052, vr: 'DS', value: payload.rescaleIntercept });
    if (payload.rescaleSlope) elements.push({ group: 0x0028, elem: 0x1053, vr: 'DS', value: payload.rescaleSlope });

    elements.push({
      group: 0x7FE0,
      elem: 0x0010,
      vr: payload.bitsAllocated <= 8 ? 'OB' : 'OW',
      value: payload.pixelBytes,
    });

    const meta = buildFileMetaHeader(SOP.SECONDARY_CAPTURE, sopInstanceUid, EXPLICIT_VR_LE);
    const dataset = encodeDataset(elements, EXPLICIT_VR_LE);
    const file = Buffer.concat([meta, dataset]);
    const filepath = path.join(dir, `image-box-${String(imageBox.position).padStart(3, '0')}-${Date.now()}.dcm`);
    fs.writeFileSync(filepath, file);
    return filepath;
  }
}

module.exports = { PrintScpHandler, SOP };
