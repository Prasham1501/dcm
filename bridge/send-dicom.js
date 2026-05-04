/**
 * send-dicom.js — Standalone DICOM C-STORE SCU
 * No npm dependencies. Uses only built-in Node.js modules (net, fs, path).
 *
 * Usage:
 *   node send-dicom.js <host> <port> <calledAET> <file.dcm> [file2.dcm ...]
 *
 * Examples:
 *   node send-dicom.js localhost 7001 BRIDGE_P1 sample.dcm
 *   node send-dicom.js 192.168.29.252 7001 BRIDGE_P1 C:\Users\prash\downloads\dicom\image.dcm
 */

'use strict';
const net = require('net');
const fs = require('fs');
const path = require('path');

// ─── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length < 4) {
  console.error('Usage: node send-dicom.js <host> <port> <calledAET> <file.dcm> [file2.dcm ...]');
  console.error('');
  console.error('Example:');
  console.error('  node send-dicom.js 192.168.29.252 7001 BRIDGE_P1 C:\\Users\\prash\\downloads\\dicom\\image.dcm');
  process.exit(1);
}

const HOST = args[0];
const PORT = parseInt(args[1], 10);
const CALLED_AET = args[2];
const FILES = args.slice(3);
const CALLING_AET = 'SENDER';
const MAX_PDU = 131072; // 128 KB

// ─── DICOM Meta Parser ────────────────────────────────────────────────────────

function parseMeta(buf) {
  if (buf.length < 132 || buf.slice(128, 132).toString('ascii') !== 'DICM') {
    throw new Error('Not a valid DICOM Part 10 file (missing DICM preamble/magic)');
  }

  let offset = 132;
  let sopClassUID = '';
  let sopInstanceUID = '';
  let transferSyntaxUID = '1.2.840.10008.1.2.1'; // default: Explicit VR LE

  while (offset + 8 <= buf.length) {
    const group = buf.readUInt16LE(offset);
    if (group !== 0x0002) break; // past file meta info

    const elem = buf.readUInt16LE(offset + 2);
    const vr = buf.slice(offset + 4, offset + 6).toString('ascii');

    let len, dataOffset;
    if (['OB', 'OW', 'SQ', 'UC', 'UR', 'UT', 'UN'].includes(vr)) {
      // 4-byte reserved + 4-byte length
      len = buf.readUInt32LE(offset + 8);
      dataOffset = offset + 12;
    } else {
      // 2-byte length
      len = buf.readUInt16LE(offset + 6);
      dataOffset = offset + 8;
    }

    const val = buf.slice(dataOffset, dataOffset + len)
      .toString('ascii')
      .replace(/[\0\s]+$/, '')
      .trim();

    if (group === 0x0002 && elem === 0x0002) sopClassUID = val;
    if (group === 0x0002 && elem === 0x0003) sopInstanceUID = val;
    if (group === 0x0002 && elem === 0x0010) transferSyntaxUID = val;

    offset = dataOffset + len;
    if (offset % 2 !== 0) offset++; // even-byte alignment
  }

  if (!sopClassUID || !sopInstanceUID) {
    throw new Error('Could not find SOP Class UID or SOP Instance UID in file meta info');
  }

  return { sopClassUID, sopInstanceUID, transferSyntaxUID, datasetOffset: offset };
}

// ─── PDU Helpers ──────────────────────────────────────────────────────────────

function padAE(str) {
  return (str + '                ').slice(0, 16);
}

function evenPadUID(str) {
  return str.length % 2 !== 0 ? str + '\0' : str;
}

function buildAssociateRQ(calledAET, callingAET, sopClassUID, transferSyntaxUID) {
  // Application Context Item (0x10)
  const appCtx = '1.2.840.10008.3.1.1.1';
  const appCtxBytes = Buffer.from(appCtx);
  const appCtxItem = Buffer.alloc(4 + appCtxBytes.length);
  appCtxItem[0] = 0x10;
  appCtxItem.writeUInt16BE(appCtxBytes.length, 2);
  appCtxBytes.copy(appCtxItem, 4);

  // Abstract Syntax sub-item (0x30)
  const absBytes = Buffer.from(evenPadUID(sopClassUID));
  const absSub = Buffer.alloc(4 + absBytes.length);
  absSub[0] = 0x30;
  absSub.writeUInt16BE(absBytes.length, 2);
  absBytes.copy(absSub, 4);

  // Transfer Syntax sub-items (0x40): propose ONLY the file's native TS
  // (we don't transcode, so we must not offer a TS we can't send)
  const tsSet = [transferSyntaxUID];
  const tsSubs = tsSet.map((ts) => {
    const b = Buffer.from(evenPadUID(ts));
    const sub = Buffer.alloc(4 + b.length);
    sub[0] = 0x40;
    sub.writeUInt16BE(b.length, 2);
    b.copy(sub, 4);
    return sub;
  });

  // Presentation Context Item (0x20), PC ID = 1
  const pcContent = Buffer.concat([absSub, ...tsSubs]);
  const pcItem = Buffer.alloc(8 + pcContent.length);
  pcItem[0] = 0x20;
  pcItem.writeUInt16BE(4 + pcContent.length, 2);
  pcItem[4] = 0x01; // PC ID
  pcContent.copy(pcItem, 8);

  // User Info: Max PDU (0x51) + Implementation UID (0x52)
  const maxPduSub = Buffer.alloc(8);
  maxPduSub[0] = 0x51;
  maxPduSub.writeUInt16BE(4, 2);
  maxPduSub.writeUInt32BE(MAX_PDU, 4);

  const implUid = Buffer.from('1.2.826.0.1.3680043.8.498.2');
  const implSub = Buffer.alloc(4 + implUid.length);
  implSub[0] = 0x52;
  implSub.writeUInt16BE(implUid.length, 2);
  implUid.copy(implSub, 4);

  const userContent = Buffer.concat([maxPduSub, implSub]);
  const userItem = Buffer.alloc(4 + userContent.length);
  userItem[0] = 0x50;
  userItem.writeUInt16BE(userContent.length, 2);
  userContent.copy(userItem, 4);

  const varItems = Buffer.concat([appCtxItem, pcItem, userItem]);

  // Fixed header: protocol version(2) + reserved(2) + called AE(16) + calling AE(16) + reserved(32)
  const fixedLen = 2 + 2 + 16 + 16 + 32;
  const pduLen = fixedLen + varItems.length;

  const rq = Buffer.alloc(6 + pduLen);
  rq[0] = 0x01; // PDU type: A-ASSOCIATE-RQ
  rq.writeUInt32BE(pduLen, 2);
  rq.writeUInt16BE(1, 6); // protocol version
  Buffer.from(padAE(calledAET)).copy(rq, 10);
  Buffer.from(padAE(callingAET)).copy(rq, 26);
  varItems.copy(rq, 74);
  return rq;
}

function buildReleaseRQ() {
  const rq = Buffer.alloc(10);
  rq[0] = 0x05; // A-RELEASE-RQ
  rq.writeUInt32BE(4, 2);
  return rq;
}

// Build C-STORE-RQ command set (Implicit VR LE — command sets are always Implicit LE)
function buildCStoreCommand(sopClassUID, sopInstanceUID, messageId) {
  function u16Elem(group, elem, val) {
    const b = Buffer.alloc(10);
    b.writeUInt16LE(group, 0);
    b.writeUInt16LE(elem, 2);
    b.writeUInt32LE(2, 4);
    b.writeUInt16LE(val, 8);
    return b;
  }
  function strElem(group, elem, val) {
    let v = Buffer.from(val, 'ascii');
    if (v.length % 2) v = Buffer.concat([v, Buffer.from([0x00])]);
    const h = Buffer.alloc(8);
    h.writeUInt16LE(group, 0);
    h.writeUInt16LE(elem, 2);
    h.writeUInt32LE(v.length, 4);
    return Buffer.concat([h, v]);
  }

  const elems = Buffer.concat([
    strElem(0x0000, 0x0002, evenPadUID(sopClassUID)), // AffectedSOPClassUID
    u16Elem(0x0000, 0x0100, 0x0001),                  // CommandField = C-STORE-RQ
    u16Elem(0x0000, 0x0110, messageId),               // MessageID
    u16Elem(0x0000, 0x0700, 0x0002),                  // Priority = MEDIUM
    u16Elem(0x0000, 0x0800, 0x0000),                  // CommandDataSetType = HAS dataset
    strElem(0x0000, 0x1000, evenPadUID(sopInstanceUID)), // AffectedSOPInstanceUID
  ]);

  // Prepend (0000,0000) group length element
  const grpLen = Buffer.alloc(12);
  grpLen.writeUInt16LE(0x0000, 0);
  grpLen.writeUInt16LE(0x0000, 2);
  grpLen.writeUInt32LE(4, 4);
  grpLen.writeUInt32LE(elems.length, 8);
  return Buffer.concat([grpLen, elems]);
}

// Wrap buffer in a P-DATA-TF PDU with a single PDV
function makePDataPDU(pcId, data, flags) {
  const pdvLen = 2 + data.length;
  const pdv = Buffer.alloc(4 + pdvLen);
  pdv.writeUInt32BE(pdvLen, 0);
  pdv[4] = pcId;
  pdv[5] = flags;
  data.copy(pdv, 6);

  const pdu = Buffer.alloc(6 + pdv.length);
  pdu[0] = 0x04; // P-DATA-TF
  pdu.writeUInt32BE(pdv.length, 2);
  pdv.copy(pdu, 6);
  return pdu;
}

// ─── Connection Manager ───────────────────────────────────────────────────────

class DicomSCU {
  constructor(socket) {
    this.socket = socket;
    this._buf = Buffer.alloc(0);
    this._waiting = []; // queue of { resolve, reject, timer }

    socket.on('data', (chunk) => {
      this._buf = Buffer.concat([this._buf, chunk]);
      this._drain();
    });

    socket.on('error', (err) => {
      // Reject all pending waiters
      for (const w of this._waiting) {
        clearTimeout(w.timer);
        w.reject(err);
      }
      this._waiting = [];
    });
  }

  _drain() {
    while (this._waiting.length > 0 && this._buf.length >= 6) {
      const pduLen = this._buf.readUInt32BE(2);
      const total = 6 + pduLen;
      if (this._buf.length < total) break;

      const pdu = Buffer.from(this._buf.slice(0, total));
      this._buf = this._buf.slice(total);

      const w = this._waiting.shift();
      clearTimeout(w.timer);
      w.resolve(pdu);
    }
  }

  nextPDU(timeoutMs = 15000) {
    // Check if already buffered
    if (this._buf.length >= 6) {
      const pduLen = this._buf.readUInt32BE(2);
      const total = 6 + pduLen;
      if (this._buf.length >= total) {
        const pdu = Buffer.from(this._buf.slice(0, total));
        this._buf = this._buf.slice(total);
        return Promise.resolve(pdu);
      }
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this._waiting.findIndex((w) => w.resolve === resolve);
        if (idx >= 0) this._waiting.splice(idx, 1);
        reject(new Error(`Timeout (${timeoutMs}ms) waiting for PDU`));
      }, timeoutMs);
      this._waiting.push({ resolve, reject, timer });
    });
  }

  write(data) {
    this.socket.write(data);
  }

  destroy() {
    this.socket.destroy();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  // Expand folders in file list
  const expanded = [];
  for (const f of FILES) {
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
      const dcms = fs.readdirSync(f)
        .filter((n) => n.toLowerCase().endsWith('.dcm'))
        .map((n) => path.join(f, n));
      expanded.push(...dcms);
    } else {
      expanded.push(f);
    }
  }

  if (expanded.length === 0) {
    console.error('No .dcm files found.');
    process.exit(1);
  }

  // Parse first file to get SOP class/TS for association negotiation
  const firstBuf = fs.readFileSync(expanded[0]);
  const firstMeta = parseMeta(firstBuf);

  console.log(`\nAccurate Bridge — DICOM C-STORE sender`);
  console.log(`Target  : ${HOST}:${PORT}  (AET: ${CALLED_AET})`);
  console.log(`Calling : ${CALLING_AET}`);
  console.log(`Files   : ${expanded.length}`);
  console.log('');

  // Connect
  console.log(`[1/3] Connecting to ${HOST}:${PORT}...`);
  const socket = await new Promise((resolve, reject) => {
    const s = new net.Socket();
    s.connect(PORT, HOST, () => resolve(s));
    s.once('error', reject);
  });
  socket.setNoDelay(true);
  const scu = new DicomSCU(socket);
  console.log('      Connected.');

  // A-ASSOCIATE-RQ
  console.log(`[2/3] Sending A-ASSOCIATE-RQ...`);
  scu.write(buildAssociateRQ(CALLED_AET, CALLING_AET, firstMeta.sopClassUID, firstMeta.transferSyntaxUID));

  const acPdu = await scu.nextPDU(10000);
  if (acPdu[0] === 0x03) {
    throw new Error('Association REJECTED by the SCP. Check that the slot is enabled and the AE title matches.');
  }
  if (acPdu[0] !== 0x02) {
    throw new Error(`Unexpected PDU type 0x${acPdu[0].toString(16)} (expected A-ASSOCIATE-AC 0x02)`);
  }
  console.log('      Association ACCEPTED.\n');

  // Send each file
  let sent = 0;
  let failed = 0;
  console.log(`[3/3] Sending files...\n`);

  for (let i = 0; i < expanded.length; i++) {
    const filepath = expanded[i];
    const filename = path.basename(filepath);
    console.log(`  [${i + 1}/${expanded.length}] ${filename}`);

    try {
      const buf = i === 0 ? firstBuf : fs.readFileSync(filepath);
      const meta = i === 0 ? firstMeta : parseMeta(buf);

      console.log(`         SOP Class    : ${meta.sopClassUID}`);
      console.log(`         SOP Instance : ${meta.sopInstanceUID}`);
      console.log(`         Transfer TS  : ${meta.transferSyntaxUID}`);

      // C-STORE command PDV (flags 0x03 = command + last fragment)
      const cmd = buildCStoreCommand(meta.sopClassUID, meta.sopInstanceUID, i + 1);
      scu.write(makePDataPDU(0x01, cmd, 0x03));

      // Dataset PDV(s) — send in chunks if large
      const dataset = buf.slice(meta.datasetOffset);
      const CHUNK = MAX_PDU - 12;
      for (let pos = 0; pos < dataset.length; pos += CHUNK) {
        const chunk = dataset.slice(pos, pos + CHUNK);
        const isLast = (pos + CHUNK) >= dataset.length;
        // flags: 0x02 = data + last fragment; 0x00 = data + not last
        scu.write(makePDataPDU(0x01, chunk, isLast ? 0x02 : 0x00));
      }

      // Wait for C-STORE-RSP
      const rsp = await scu.nextPDU(30000);
      if (rsp[0] === 0x04) {
        console.log(`         Status       : SUCCESS (C-STORE-RSP received)\n`);
        sent++;
      } else {
        console.log(`         Status       : WARNING (unexpected PDU 0x${rsp[0].toString(16)} in response)\n`);
        failed++;
      }
    } catch (err) {
      console.error(`         ERROR: ${err.message}\n`);
      failed++;
    }
  }

  // A-RELEASE-RQ
  scu.write(buildReleaseRQ());
  await scu.nextPDU(5000).catch(() => {}); // ignore timeout on release

  scu.destroy();

  console.log('─'.repeat(50));
  console.log(`Done. Sent: ${sent}  Failed: ${failed}`);
  if (failed === 0) {
    console.log('All files accepted by the bridge!');
    console.log(`Check the bridge's Logs tab — it will print after the debounce timer expires.`);
  }
  console.log('');
}

run().catch((err) => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});
