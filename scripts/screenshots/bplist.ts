// Binary property lists, as far as the Web Inspector's wire protocol uses
// them: dictionaries, arrays, strings, integers, booleans and data.

export type PlistValue = string | number | boolean | null | Uint8Array | PlistValue[] | { [key: string]: PlistValue };

export function encode(root: PlistValue): Buffer {
  const objects: Buffer[] = [];
  // Object references are written before their objects exist, so the
  // reference width is fixed up front; two bytes covers 65535 objects.
  const refSize = 2;
  const ref = (n: number) => {
    const b = Buffer.alloc(refSize);
    b.writeUInt16BE(n);
    return b;
  };
  const header = (type: number, length: number) =>
    length < 15 ? Buffer.from([type | length]) : Buffer.concat([Buffer.from([type | 0xf]), int(length)]);
  const int = (n: number) => {
    if (n >= 0 && n < 0x100) return Buffer.from([0x10, n]);
    if (n >= 0 && n < 0x10000) return Buffer.from([0x11, n >> 8, n & 0xff]);
    if (n >= 0 && n < 0x100000000) {
      const b = Buffer.alloc(5);
      b[0] = 0x12;
      b.writeUInt32BE(n, 1);
      return b;
    }
    const b = Buffer.alloc(9);
    b[0] = 0x13;
    b.writeBigInt64BE(BigInt(n), 1);
    return b;
  };

  const add = (value: PlistValue): number => {
    const index = objects.length;
    objects.push(Buffer.alloc(0));
    let out: Buffer;
    if (value === null) out = Buffer.from([0x00]);
    else if (typeof value === 'boolean') out = Buffer.from([value ? 0x09 : 0x08]);
    else if (typeof value === 'number') {
      if (Number.isInteger(value)) out = int(value);
      else {
        out = Buffer.alloc(9);
        out[0] = 0x23;
        out.writeDoubleBE(value, 1);
      }
    } else if (typeof value === 'string') {
      out = /^[\x00-\x7f]*$/.test(value)
        ? Buffer.concat([header(0x50, value.length), Buffer.from(value, 'ascii')])
        : Buffer.concat([header(0x60, value.length), Buffer.from(value, 'utf16le').swap16()]);
    } else if (value instanceof Uint8Array) {
      out = Buffer.concat([header(0x40, value.length), Buffer.from(value)]);
    } else if (Array.isArray(value)) {
      const refs = value.map(add);
      out = Buffer.concat([header(0xa0, refs.length), ...refs.map(ref)]);
    } else {
      const entries = Object.entries(value);
      const keys = entries.map(([k]) => add(k));
      const values = entries.map(([, v]) => add(v));
      out = Buffer.concat([header(0xd0, entries.length), ...keys.map(ref), ...values.map(ref)]);
    }
    objects[index] = out;
    return index;
  };

  add(root);
  if (objects.length > 0xffff) throw new Error('Property list too large');
  const offsets: number[] = [];
  let position = 8;
  for (const o of objects) {
    offsets.push(position);
    position += o.length;
  }
  const offsetSize = position < 0x100 ? 1 : position < 0x10000 ? 2 : 4;
  const table = Buffer.alloc(offsets.length * offsetSize);
  offsets.forEach((o, i) => table.writeUIntBE(o, i * offsetSize, offsetSize));
  const trailer = Buffer.alloc(32);
  trailer[6] = offsetSize;
  trailer[7] = refSize;
  trailer.writeBigUInt64BE(BigInt(objects.length), 8);
  trailer.writeBigUInt64BE(0n, 16);
  trailer.writeBigUInt64BE(BigInt(position), 24);
  return Buffer.concat([Buffer.from('bplist00'), ...objects, table, trailer]);
}

export function decode(buf: Buffer): PlistValue {
  if (buf.subarray(0, 8).toString() !== 'bplist00') throw new Error('Not a binary property list');
  const t = buf.subarray(buf.length - 32);
  const offsetSize = t[6]!;
  const refSize = t[7]!;
  const count = Number(t.readBigUInt64BE(8));
  const top = Number(t.readBigUInt64BE(16));
  const tableStart = Number(t.readBigUInt64BE(24));
  const offset = (i: number) => buf.readUIntBE(tableStart + i * offsetSize, offsetSize);
  if (top >= count) throw new Error('Bad property list trailer');

  const read = (index: number): PlistValue => {
    let p = offset(index);
    const marker = buf[p++]!;
    const type = marker >> 4;
    let info = marker & 0xf;
    const length = () => {
      if (info !== 0xf) return info;
      const size = 1 << (buf[p++]! & 0xf);
      const n = size === 8 ? Number(buf.readBigUInt64BE(p)) : buf.readUIntBE(p, size);
      p += size;
      return n;
    };
    const refs = (n: number) =>
      Array.from({ length: n }, (_, i) => buf.readUIntBE(p + i * refSize, refSize));
    switch (type) {
      case 0x0:
        return info === 0x9 ? true : info === 0x8 ? false : null;
      case 0x1: {
        const size = 1 << info;
        return size === 8 ? Number(buf.readBigInt64BE(p)) : buf.readUIntBE(p, size);
      }
      case 0x2:
        return info === 2 ? buf.readFloatBE(p) : buf.readDoubleBE(p);
      case 0x3:
        // Seconds since 2001-01-01, as a Unix timestamp in milliseconds.
        return (buf.readDoubleBE(p) + 978307200) * 1000;
      case 0x4: {
        const n = length();
        return new Uint8Array(buf.subarray(p, p + n));
      }
      case 0x5: {
        const n = length();
        return buf.subarray(p, p + n).toString('ascii');
      }
      case 0x6: {
        const n = length();
        return Buffer.from(buf.subarray(p, p + n * 2)).swap16().toString('utf16le');
      }
      case 0x8:
        return buf.readUIntBE(p, info + 1);
      case 0xa:
        return refs(length()).map(read);
      case 0xd: {
        const n = length();
        const all = refs(n * 2);
        const out: Record<string, PlistValue> = {};
        for (let i = 0; i < n; i++) out[read(all[i]!) as string] = read(all[n + i]!);
        return out;
      }
      default:
        throw new Error(`Unsupported property list object 0x${marker.toString(16)}`);
    }
  };
  return read(top);
}
