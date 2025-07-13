import __toread from './__toread.js';
import { __sdec } from '../util/__ser.js';

// different signature, since working with buffers in JS is plain painful
export function fread(s, count) {
	const buf = new SharedArrayBuffer(count);
	const cnt = _fread(buf, null, count, s);
	if (cnt <= 0) return cnt;
	return __sdec(buf, cnt);
}
export default fread;

// C-compatible func
export function _fread(dest, _, len, s) {
	let l = len;
	let k, dpos = 0;

	if (s.rpos != s.rend) {
		const dst  = new Uint8Array(dest);
		const sbuf = new Uint8Array(s.buf);

		/* First exhaust the buffer. */
		k = Math.min(s.rend - s.rpos, l);
		while (dpos < k)
			dst[dpos++] = sbuf[s.rpos++];
		l -= k;
	}
	
	/* Read the remainder directly */
	for (; l; l-=k, dpos+=k) {
		k = __toread(s) < 0 ? 0 : s.ops.read(s, dest, l);
		if (!k) return len-l;
	}

	return len;
}
