/**
 * DICOM Upper Layer PDU codec.
 * Extracted and adapted from dcm/main.js (lines 2091-2418).
 *
 * Implements:
 *   - A-ASSOCIATE-AC builder (response to A-ASSOCIATE-RQ)
 *   - A-RELEASE-RP builder
 *   - C-STORE-RSP / C-ECHO-RSP builders
 *   - Command set parser (Implicit VR LE)
 *   - DICOM Part 10 File Meta Information header builder
 *
 * The original dcm code hardcoded a single AET ('ACCURATE'). This version
 * accepts the called AET as a parameter so each printer slot can listen
 * with its own AE title.
 */

const DICOM_MAX_PDU = 131072; // 128KB — compatible with most devices
const IMPLEMENTATION_CLASS_UID = '1.2.826.0.1.3680043.8.498.1';
const IMPLEMENTATION_VERSION_NAME = 'ACCURATE_BRIDGE';

function padAE(str) {
  return (str + '                ').slice(0, 16);
}

function padUID(str) {
  if (str.length % 2 !== 0) return str + '\0';
  return str;
}

function buildAssociateAC(rqBuffer, ourAeTitle) {
  const pduLength = rqBuffer.readUInt32BE(2);
  const calledAE = rqBuffer.slice(10, 26).toString('ascii').trim();
  const callingAE = rqBuffer.slice(26, 42).toString('ascii').trim();

  const items = [];
  let offset = 74;
  const pduEnd = 6 + pduLength;
  while (offset + 4 <= pduEnd && offset + 4 <= rqBuffer.length) {
    const itemType = rqBuffer[offset];
    if (offset + 4 > rqBuffer.length) break;
    const itemLen = rqBuffer.readUInt16BE(offset + 2);
    if (itemLen === 0 && itemType === 0) break;
    if (offset + 4 + itemLen > rqBuffer.length) break;

    if (itemType === 0x20) {
      const pcId = rqBuffer[offset + 4];
      let abstractSyntax = '';
      const transferSyntaxes = [];
      let subOffset = offset + 8;
      const pcEnd = offset + 4 + itemLen;
      while (subOffset + 4 <= pcEnd && subOffset + 4 <= rqBuffer.length) {
        const subType = rqBuffer[subOffset];
        const subLen = rqBuffer.readUInt16BE(subOffset + 2);
        if (subOffset + 4 + subLen > rqBuffer.length) break;
        if (subType === 0x30) {
          abstractSyntax = rqBuffer.slice(subOffset + 4, subOffset + 4 + subLen).toString('ascii').replace(/\0+$/, '').trim();
        } else if (subType === 0x40) {
          transferSyntaxes.push(rqBuffer.slice(subOffset + 4, subOffset + 4 + subLen).toString('ascii').replace(/\0+$/, '').trim());
        }
        subOffset += 4 + subLen;
      }
      items.push({ pcId, abstractSyntax, transferSyntaxes });
    }
    offset += 4 + itemLen;
  }

  const pcResults = [];
  for (const pc of items) {
    let selectedTs = pc.transferSyntaxes[0] || '1.2.840.10008.1.2';
    // Prefer the TS that matches what the SCU will actually send.
    // Most modalities propose their native TS first; accept it as-is.
    // Only upgrade to Explicit VR LE if the SCU doesn't offer Implicit.
    const implicitLE = pc.transferSyntaxes.find((ts) => ts === '1.2.840.10008.1.2');
    const explicitLE = pc.transferSyntaxes.find((ts) => ts === '1.2.840.10008.1.2.1');
    if (implicitLE) selectedTs = implicitLE;
    else if (explicitLE) selectedTs = explicitLE;

    const tsBytes = Buffer.from(selectedTs, 'ascii');
    const tsSub = Buffer.alloc(4 + tsBytes.length);
    tsSub[0] = 0x40; tsSub[1] = 0x00;
    tsSub.writeUInt16BE(tsBytes.length, 2);
    tsBytes.copy(tsSub, 4);

    const pcItem = Buffer.alloc(8 + tsSub.length);
    pcItem[0] = 0x21; pcItem[1] = 0x00;
    pcItem.writeUInt16BE(4 + tsSub.length, 2);
    pcItem[4] = pc.pcId;
    pcItem[5] = 0x00; pcItem[6] = 0x00; pcItem[7] = 0x00;
    tsSub.copy(pcItem, 8);
    pcResults.push(pcItem);

    pc.acceptedTransferSyntax = selectedTs;
  }

  const appCtxUid = '1.2.840.10008.3.1.1.1';
  const appCtxBytes = Buffer.from(appCtxUid, 'ascii');
  const appCtxItem = Buffer.alloc(4 + appCtxBytes.length);
  appCtxItem[0] = 0x10; appCtxItem[1] = 0x00;
  appCtxItem.writeUInt16BE(appCtxBytes.length, 2);
  appCtxBytes.copy(appCtxItem, 4);

  const maxPduSub = Buffer.alloc(8);
  maxPduSub[0] = 0x51; maxPduSub[1] = 0x00;
  maxPduSub.writeUInt16BE(4, 2);
  maxPduSub.writeUInt32BE(DICOM_MAX_PDU, 4);

  const implUidBytes = Buffer.from(IMPLEMENTATION_CLASS_UID, 'ascii');
  const implSub = Buffer.alloc(4 + implUidBytes.length);
  implSub[0] = 0x52; implSub[1] = 0x00;
  implSub.writeUInt16BE(implUidBytes.length, 2);
  implUidBytes.copy(implSub, 4);

  const implVerBytes = Buffer.from(IMPLEMENTATION_VERSION_NAME, 'ascii');
  const implVerSub = Buffer.alloc(4 + implVerBytes.length);
  implVerSub[0] = 0x55; implVerSub[1] = 0x00;
  implVerSub.writeUInt16BE(implVerBytes.length, 2);
  implVerBytes.copy(implVerSub, 4);

  const userInfoContent = Buffer.concat([maxPduSub, implSub, implVerSub]);
  const userInfoItem = Buffer.alloc(4 + userInfoContent.length);
  userInfoItem[0] = 0x50; userInfoItem[1] = 0x00;
  userInfoItem.writeUInt16BE(userInfoContent.length, 2);
  userInfoContent.copy(userInfoItem, 4);

  const variableItems = Buffer.concat([appCtxItem, ...pcResults, userInfoItem]);

  const fixedLen = 2 + 2 + 16 + 16 + 32;
  const pduLen = fixedLen + variableItems.length;
  const acPdu = Buffer.alloc(6 + pduLen);
  acPdu[0] = 0x02; acPdu[1] = 0x00;
  acPdu.writeUInt32BE(pduLen, 2);
  acPdu.writeUInt16BE(1, 6);
  acPdu.writeUInt16BE(0, 8);
  Buffer.from(padAE(ourAeTitle)).copy(acPdu, 10);
  Buffer.from(padAE(callingAE)).copy(acPdu, 26);
  variableItems.copy(acPdu, 74);

  return { acPdu, items, callingAE, calledAE };
}

function buildReleaseRP() {
  const rp = Buffer.alloc(10);
  rp[0] = 0x06; rp[1] = 0x00;
  rp.writeUInt32BE(4, 2);
  return rp;
}

function buildAbortRJ() {
  const rj = Buffer.alloc(10);
  rj[0] = 0x03; rj[1] = 0x00;
  rj.writeUInt32BE(4, 2);
  rj[7] = 0x01; rj[8] = 0x01; rj[9] = 0x01;
  return rj;
}

function addCmdUint16Elem(group, elem, val) {
  const b = Buffer.alloc(10);
  b.writeUInt16LE(group, 0);
  b.writeUInt16LE(elem, 2);
  b.writeUInt32LE(2, 4);
  b.writeUInt16LE(val, 8);
  return b;
}

function addCmdStringElem(group, elem, val) {
  let v = Buffer.from(val, 'ascii');
  if (v.length % 2 !== 0) v = Buffer.concat([v, Buffer.from([0x00])]);
  const hdr = Buffer.alloc(8);
  hdr.writeUInt16LE(group, 0);
  hdr.writeUInt16LE(elem, 2);
  hdr.writeUInt32LE(v.length, 4);
  return Buffer.concat([hdr, v]);
}

function wrapCmdInPDataTF(pcId, fullCmd) {
  const pdvLen = 2 + fullCmd.length;
  const pdv = Buffer.alloc(4 + pdvLen);
  pdv.writeUInt32BE(pdvLen, 0);
  pdv[4] = pcId;
  pdv[5] = 0x03; // command + last fragment
  fullCmd.copy(pdv, 6);

  const pdata = Buffer.alloc(6 + pdv.length);
  pdata[0] = 0x04; pdata[1] = 0x00;
  pdata.writeUInt32BE(pdv.length, 2);
  pdv.copy(pdata, 6);
  return pdata;
}

function buildCStoreRSP(pcId, messageId, sopClassUid, sopInstanceUid) {
  const elements = [
    addCmdStringElem(0x0000, 0x0002, sopClassUid),
    addCmdUint16Elem(0x0000, 0x0100, 0x8001),
    addCmdUint16Elem(0x0000, 0x0120, messageId),
    addCmdUint16Elem(0x0000, 0x0800, 0x0101),
    addCmdUint16Elem(0x0000, 0x0900, 0x0000),
    addCmdStringElem(0x0000, 0x1000, sopInstanceUid),
  ];
  const cmdData = Buffer.concat(elements);

  const grpLenElem = Buffer.alloc(12);
  grpLenElem.writeUInt16LE(0x0000, 0);
  grpLenElem.writeUInt16LE(0x0000, 2);
  grpLenElem.writeUInt32LE(4, 4);
  grpLenElem.writeUInt32LE(cmdData.length, 8);

  return wrapCmdInPDataTF(pcId, Buffer.concat([grpLenElem, cmdData]));
}

function buildCEchoRSP(pcId, messageId) {
  const elements = [
    addCmdStringElem(0x0000, 0x0002, '1.2.840.10008.1.1'),
    addCmdUint16Elem(0x0000, 0x0100, 0x8030),
    addCmdUint16Elem(0x0000, 0x0120, messageId),
    addCmdUint16Elem(0x0000, 0x0800, 0x0101),
    addCmdUint16Elem(0x0000, 0x0900, 0x0000),
  ];
  const cmdData = Buffer.concat(elements);

  const grpLenElem = Buffer.alloc(12);
  grpLenElem.writeUInt16LE(0x0000, 0);
  grpLenElem.writeUInt16LE(0x0000, 2);
  grpLenElem.writeUInt32LE(4, 4);
  grpLenElem.writeUInt32LE(cmdData.length, 8);

  return wrapCmdInPDataTF(pcId, Buffer.concat([grpLenElem, cmdData]));
}

function parseCommandSet(cmdBuffer) {
  const result = {};
  let offset = 0;
  while (offset + 8 <= cmdBuffer.length) {
    const group = cmdBuffer.readUInt16LE(offset);
    const elem = cmdBuffer.readUInt16LE(offset + 2);
    const len = cmdBuffer.readUInt32LE(offset + 4);
    if (len === 0xFFFFFFFF || len > cmdBuffer.length - offset - 8) break;
    const tag = `${group.toString(16).padStart(4, '0')},${elem.toString(16).padStart(4, '0')}`;
    if (len === 2) {
      result[tag] = cmdBuffer.readUInt16LE(offset + 8);
    } else if (len === 4 && group === 0x0000 && elem === 0x0000) {
      result[tag] = cmdBuffer.readUInt32LE(offset + 8);
    } else {
      result[tag] = cmdBuffer.slice(offset + 8, offset + 8 + len).toString('ascii').replace(/\0+$/, '');
    }
    offset += 8 + len;
  }
  return result;
}

function buildFileMetaHeader(sopClassUid, sopInstanceUid, transferSyntax) {
  function addShortVR(group, elem, vr, value) {
    const valBuf = Buffer.isBuffer(value) ? value : Buffer.from(padUID(value), 'ascii');
    const hdr = Buffer.alloc(8);
    hdr.writeUInt16LE(group, 0);
    hdr.writeUInt16LE(elem, 2);
    hdr[4] = vr.charCodeAt(0);
    hdr[5] = vr.charCodeAt(1);
    hdr.writeUInt16LE(valBuf.length, 6);
    return Buffer.concat([hdr, valBuf]);
  }

  function addLongVR(group, elem, vr, value) {
    const valBuf = Buffer.isBuffer(value) ? value : Buffer.from(value, 'ascii');
    const hdr = Buffer.alloc(12);
    hdr.writeUInt16LE(group, 0);
    hdr.writeUInt16LE(elem, 2);
    hdr[4] = vr.charCodeAt(0);
    hdr[5] = vr.charCodeAt(1);
    hdr.writeUInt16LE(0, 6);
    hdr.writeUInt32LE(valBuf.length, 8);
    return Buffer.concat([hdr, valBuf]);
  }

  const parts = [
    addLongVR(0x0002, 0x0001, 'OB', Buffer.from([0x00, 0x01])),
    addShortVR(0x0002, 0x0002, 'UI', sopClassUid),
    addShortVR(0x0002, 0x0003, 'UI', sopInstanceUid),
    addShortVR(0x0002, 0x0010, 'UI', transferSyntax),
    addShortVR(0x0002, 0x0012, 'UI', IMPLEMENTATION_CLASS_UID),
  ];

  const verName = IMPLEMENTATION_VERSION_NAME;
  const verPadded = verName.length % 2 !== 0 ? verName + ' ' : verName;
  parts.push(addShortVR(0x0002, 0x0013, 'SH', Buffer.from(verPadded, 'ascii')));

  const metaContent = Buffer.concat(parts);

  const grpLenBuf = Buffer.alloc(12);
  grpLenBuf.writeUInt16LE(0x0002, 0);
  grpLenBuf.writeUInt16LE(0x0000, 2);
  grpLenBuf[4] = 0x55; grpLenBuf[5] = 0x4C; // 'UL'
  grpLenBuf.writeUInt16LE(4, 6);
  grpLenBuf.writeUInt32LE(metaContent.length, 8);

  const preamble = Buffer.alloc(128, 0);
  const magic = Buffer.from('DICM');

  return Buffer.concat([preamble, magic, grpLenBuf, metaContent]);
}

module.exports = {
  DICOM_MAX_PDU,
  buildAssociateAC,
  buildReleaseRP,
  buildAbortRJ,
  buildCStoreRSP,
  buildCEchoRSP,
  parseCommandSet,
  buildFileMetaHeader,
};
