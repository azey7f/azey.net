const encoder = new TextEncoder();
export function __senc(str) { return encoder.encode(str); }

const decoder = new TextDecoder();
export function __sdec(buf, count) {
	// TextDecoder doesn't accept SABs
	// TODO?: maybe do a full JS implementation at some point? probably not
	const abuf = new Uint8ClampedArray(buf).slice(0,count);
	return decoder.decode(abuf);
}
