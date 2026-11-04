import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_FRAME = 1024 * 1024;
export function acceptSocket(request, socket, head, onMessage, onClose) {
  const key = request.headers['sec-websocket-key'];
  if (request.headers.upgrade?.toLowerCase() !== 'websocket' || typeof key !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(key)) {
    socket.destroy(); return null;
  }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  let buffer = Buffer.alloc(0), alive = true;
  const peer = {
    send(data) {
      if (!alive || socket.destroyed) return;
      const payload = Buffer.from(JSON.stringify(data));
      if (payload.length > MAX_FRAME) return;
      let hdr;
      if (payload.length < 126) hdr = Buffer.from([0x81, payload.length]);
      else if (payload.length <= 65535) {
        hdr = Buffer.alloc(4); hdr[0] = 0x81; hdr[1] = 126;
        hdr.writeUInt16BE(payload.length, 2);
      } else {
        hdr = Buffer.alloc(10); hdr[0] = 0x81; hdr[1] = 127;
        hdr.writeBigUInt64BE(BigInt(payload.length), 2);
      }
      socket.write(Buffer.concat([hdr, payload]));
    },
    close() { if (alive) socket.end(Buffer.from([0x88, 0])); },
  };
  function receive(chunk) {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const op = buffer[0] & 15, final = !!(buffer[0] & 128), mask = !!(buffer[1] & 128);
      let len = buffer[1] & 127, off = 2;
      if (!mask || !final) { socket.destroy(); return; }
      if (len === 126) { if (buffer.length < 4) return; len = buffer.readUInt16BE(2); off = 4; }
      else if (len === 127) {
        if (buffer.length < 10) return;
        const value = buffer.readBigUInt64BE(2);
        if (value > BigInt(MAX_FRAME)) { socket.destroy(); return; }
        len = Number(value); off = 10;
      }
      if (len > MAX_FRAME) { socket.destroy(); return; }
      if (buffer.length < off + 4 + len) return;
      const key = buffer.subarray(off, off + 4), bytes = buffer.subarray(off + 4, off + 4 + len);
      const payload = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) payload[i] = bytes[i] ^ key[i % 4];
      buffer = buffer.subarray(off + 4 + len);
      if (op === 8) { socket.end(); return; }
      if (op === 9) { socket.write(Buffer.from([0x8a, 0])); continue; }
      if (op !== 1) { socket.destroy(); return; }
      try { onMessage(JSON.parse(payload.toString('utf8')), peer); } catch { peer.send({ type: 'error', message: 'Invalid message' }); }
    }
  }
  socket.on('data', receive);
  if (head?.length) receive(head);
  socket.on('close', () => { alive = false; onClose(peer); });
  socket.on('error', () => { alive = false; });
  return peer;
}
