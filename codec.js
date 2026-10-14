(() => {
  const KEY = 11;
  const enc = new TextEncoder(), dec = new TextDecoder('utf-8');

  const xor = (b) => { const o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b[i] ^ KEY; return o; };
  const isGzip = (b) => b.length > 18 && b[0] === 0x1f && b[1] === 0x8b;
  const looksXml = (s) => /^\s*<(\?xml|plist)/.test(s);

  function fromB64(text) {
    const m = text.replace(/^[\s\0]+/, '').match(/^[A-Za-z0-9+/_-]+={0,2}/);
    if (!m || m[0].length < 24) return null;
    const std = m[0].replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
    if (std.length % 4 === 1) return null;
    try {
      const bin = atob(std + '='.repeat((4 - std.length % 4) % 4));
      const o = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i);
      return o;
    } catch { return null; }
  }

  function toB64Url(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_');
  }

  async function pipe(bytes, Stream, format) {
    const stream = new Blob([bytes]).stream().pipeThrough(new Stream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function gunzip(b) {
    try { return await pipe(b, DecompressionStream, 'gzip'); }
    catch {
      let p = 10; const flg = b[3];
      if (flg & 4) p += 2 + (b[p] | (b[p + 1] << 8));
      if (flg & 8) while (b[p++]);
      if (flg & 16) while (b[p++]);
      if (flg & 2) p += 2;
      return pipe(b.subarray(p), DecompressionStream, 'deflate-raw');
    }
  }

  const clean = (t) => {
    t = t.replace(/^\uFEFF/, '').replace(/\0+$/, '');
    const end = t.lastIndexOf('</plist>');
    return (end >= 0 ? t.slice(0, end + 8) : t).trim();
  };

  async function decode(buffer) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress GZIP. Use a recent Chrome, Edge, Firefox or Safari.');
    const raw = new Uint8Array(buffer);
    const text = dec.decode(raw);
    if (looksXml(text)) return { xml: clean(text), container: 'xml' };
    if (isGzip(raw)) return { xml: clean(dec.decode(await gunzip(raw))), container: 'gzip' };
    for (const [container, bytes] of [['xor-b64-gzip', xor(raw)], ['b64-gzip', raw]]) {
      const bin = fromB64(dec.decode(bytes));
      if (!bin || !isGzip(bin)) continue;
      let xml;
      try { xml = clean(dec.decode(await gunzip(bin))); }
      catch { throw new Error('Decoded the save but GZIP decompression failed. The file may be corrupted.'); }
      if (!looksXml(xml)) throw new Error('Decoded data is not a Geometry Dash plist.');
      return { xml, container };
    }
    throw new Error('Unrecognised save format. This tool reads Windows/Android saves (XOR 11 + Base64 + GZIP); macOS saves use AES and are not supported.');
  }

  async function encode(xml, container) {
    const data = enc.encode(xml);
    if (container === 'xml') return data;
    const gz = await pipe(data, CompressionStream, 'gzip');
    gz.fill(0, 4, 9); gz[9] = 3;
    if (container === 'gzip') return gz;
    const b64 = enc.encode(toB64Url(gz));
    return container === 'xor-b64-gzip' ? xor(b64) : b64;
  }

  globalThis.GDCodec = { decode, encode };
})();
