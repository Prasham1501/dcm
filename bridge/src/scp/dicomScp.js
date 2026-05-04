/**
 * Single-slot DICOM Storage SCP.
 * Wraps a TCP listener that accepts associations for one (AE title, port)
 * pair and emits 'file' events for each received DICOM dataset.
 *
 * Adapted from dcm/main.js startDicomNetworkReceiver() (lines 2455-2710).
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const {
  buildAssociateAC,
  buildReleaseRP,
  buildAbortRJ,
  buildCStoreRSP,
  buildCEchoRSP,
  parseCommandSet,
  buildFileMetaHeader,
} = require('./pduCodec');

const MAX_PDU_BYTES = 16 * 1024 * 1024;

class DicomScp extends EventEmitter {
  constructor({ aeTitle, port, storageDir, logger }) {
    super();
    this.aeTitle = aeTitle;
    this.port = port;
    this.storageDir = storageDir;
    this.logger = logger || console;
    this.server = null;
  }

  start() {
    if (this.server) return Promise.resolve();
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.server = net.createServer({ allowHalfOpen: false }, (socket) => this._onConnection(socket));

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          this.logger.error(`[SCP ${this.aeTitle}:${this.port}] port in use`);
        } else {
          this.logger.error(`[SCP ${this.aeTitle}:${this.port}] server error: ${err.message}`);
        }
        this.emit('error', err);
        if (!this.server.listening) reject(err);
      });

      this.server.maxConnections = 10;

      this.server.listen(this.port, '0.0.0.0', () => {
        this.logger.info(`[SCP] listening on ${this.aeTitle} port ${this.port} -> ${this.storageDir}`);
        resolve();
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => {
        this.server = null;
        this.logger.info(`[SCP] stopped ${this.aeTitle}:${this.port}`);
        resolve();
      });
    });
  }

  _onConnection(socket) {
    this.logger.debug(`[SCP ${this.aeTitle}:${this.port}] connection from ${socket.remoteAddress}:${socket.remotePort}`);
    socket.setKeepAlive(true, 10000);
    socket.setTimeout(120000);

    const ctx = {
      recvBuffer: Buffer.alloc(0),
      associationInfo: null,
      currentCommand: null,
      fileCount: 0,
      socketAlive: true,
    };

    const safeWrite = (data) => {
      if (ctx.socketAlive && !socket.destroyed) {
        try { socket.write(data); }
        catch (e) { this.logger.error(`[SCP] write error: ${e.message}`); }
      }
    };

    const handleCompleteMessage = (pcId) => {
      if (!ctx.currentCommand || !ctx.currentCommand.parsed) {
        ctx.currentCommand = null;
        return;
      }
      const cmd = ctx.currentCommand.parsed;
      const commandField = cmd['0000,0100'];
      const messageId = cmd['0000,0110'] || 1;
      const sopClassUid = cmd['0000,0002'] || '';
      const sopInstanceUid = cmd['0000,1000'] || `1.2.${Date.now()}.${ctx.fileCount}`;

      if (commandField === 0x0030) {
        this.logger.info(`[SCP ${this.aeTitle}] C-ECHO`);
        safeWrite(buildCEchoRSP(pcId, messageId));
      } else if (commandField === 0x0001) {
        const datasetData = Buffer.concat(ctx.currentCommand.dataFragments || []);

        if (datasetData.length > 0) {
          let transferSyntax = '1.2.840.10008.1.2';
          if (ctx.associationInfo) {
            const pc = ctx.associationInfo.items.find((i) => i.pcId === pcId);
            if (pc && pc.acceptedTransferSyntax) transferSyntax = pc.acceptedTransferSyntax;
          }

          const fileHeader = buildFileMetaHeader(sopClassUid, sopInstanceUid, transferSyntax);
          const fullFile = Buffer.concat([fileHeader, datasetData]);

          const safeUid = sopInstanceUid.replace(/[^0-9.]/g, '');
          const filename = `${safeUid || Date.now()}.dcm`;
          const filepath = path.join(this.storageDir, filename);

          try {
            fs.writeFileSync(filepath, fullFile);
            ctx.fileCount++;
            this.logger.info(`[SCP ${this.aeTitle}] saved ${filename} (${fullFile.length} bytes)`);
            this.emit('file', {
              aeTitle: this.aeTitle,
              port: this.port,
              callingAE: ctx.associationInfo?.callingAE || '',
              filepath,
              filename,
              size: fullFile.length,
              sopClassUid,
              sopInstanceUid,
              transferSyntax,
              receivedAt: new Date().toISOString(),
            });
          } catch (e) {
            this.logger.error(`[SCP ${this.aeTitle}] save error: ${e.message}`);
          }
        }

        safeWrite(buildCStoreRSP(pcId, messageId, sopClassUid, sopInstanceUid));
      } else {
        this.logger.warn(`[SCP ${this.aeTitle}] unsupported command 0x${commandField?.toString(16)}`);
      }

      ctx.currentCommand = null;
    };

    const handlePDU = (pduType, pdu) => {
      switch (pduType) {
        case 0x01: { // A-ASSOCIATE-RQ
          try {
            const { acPdu, items, callingAE } = buildAssociateAC(pdu, this.aeTitle);
            ctx.associationInfo = { items, callingAE };
            safeWrite(acPdu);
            this.logger.info(`[SCP ${this.aeTitle}] association from ${callingAE} (${items.length} contexts)`);
          } catch (e) {
            this.logger.error(`[SCP ${this.aeTitle}] association failed: ${e.message}`);
            safeWrite(buildAbortRJ());
            socket.end();
          }
          break;
        }

        case 0x04: { // P-DATA-TF
          if (!ctx.associationInfo) break;
          const pduDataLen = pdu.readUInt32BE(2);
          let offset = 6;
          const end = 6 + pduDataLen;
          while (offset + 6 <= end && offset + 6 <= pdu.length) {
            const pdvLen = pdu.readUInt32BE(offset);
            if (pdvLen < 2 || offset + 4 + pdvLen > pdu.length) break;
            const pdvPcId = pdu[offset + 4];
            const pdvHeader = pdu[offset + 5];
            const isCommand = (pdvHeader & 0x01) !== 0;
            const isLast = (pdvHeader & 0x02) !== 0;
            const data = pdu.slice(offset + 6, offset + 4 + pdvLen);

            if (!ctx.currentCommand) {
              ctx.currentCommand = { pcId: pdvPcId, cmdFragments: [], dataFragments: [], parsed: null };
            }

            if (isCommand) {
              ctx.currentCommand.cmdFragments.push(data);
              if (isLast) {
                const cmdData = Buffer.concat(ctx.currentCommand.cmdFragments);
                ctx.currentCommand.parsed = parseCommandSet(cmdData);
                ctx.currentCommand.cmdFragments = [];
                const dataSetType = ctx.currentCommand.parsed['0000,0800'];
                if (dataSetType === 0x0101) handleCompleteMessage(pdvPcId);
              }
            } else {
              ctx.currentCommand.dataFragments.push(data);
              if (isLast) handleCompleteMessage(pdvPcId);
            }

            offset += 4 + pdvLen;
          }
          break;
        }

        case 0x05: { // A-RELEASE-RQ
          this.logger.info(`[SCP ${this.aeTitle}] release (${ctx.fileCount} files)`);
          safeWrite(buildReleaseRP());
          socket.end();
          break;
        }

        case 0x07: { // A-ABORT
          this.logger.info(`[SCP ${this.aeTitle}] abort received`);
          socket.end();
          break;
        }

        default:
          this.logger.warn(`[SCP ${this.aeTitle}] unknown PDU type 0x${pduType.toString(16)}`);
      }
    };

    const processPDU = () => {
      while (ctx.recvBuffer.length >= 6) {
        const pduType = ctx.recvBuffer[0];
        const pduLen = ctx.recvBuffer.readUInt32BE(2);
        const totalLen = 6 + pduLen;
        if (pduLen > MAX_PDU_BYTES) {
          this.logger.error(`[SCP ${this.aeTitle}] PDU too large (${pduLen})`);
          socket.destroy();
          return;
        }
        if (ctx.recvBuffer.length < totalLen) break;
        const pdu = Buffer.from(ctx.recvBuffer.slice(0, totalLen));
        ctx.recvBuffer = ctx.recvBuffer.slice(totalLen);
        try { handlePDU(pduType, pdu); }
        catch (e) { this.logger.error(`[SCP ${this.aeTitle}] handle error: ${e.message}`); }
      }
    };

    socket.on('data', (data) => {
      ctx.recvBuffer = Buffer.concat([ctx.recvBuffer, data]);
      processPDU();
    });

    socket.on('end', () => {
      ctx.socketAlive = false;
      if (ctx.recvBuffer.length > 0) {
        try { processPDU(); } catch (e) { /* ignore */ }
      }
      if (ctx.fileCount > 0) {
        this.logger.info(`[SCP ${this.aeTitle}] connection closed, ${ctx.fileCount} files`);
      }
    });

    socket.on('error', (err) => {
      ctx.socketAlive = false;
      if (err.code !== 'ECONNRESET') {
        this.logger.error(`[SCP ${this.aeTitle}] socket error: ${err.message}`);
      }
    });

    socket.on('timeout', () => {
      this.logger.warn(`[SCP ${this.aeTitle}] socket timeout`);
      socket.destroy();
    });

    socket.on('close', () => { ctx.socketAlive = false; });
  }
}

module.exports = { DicomScp };
