import __toread from './__toread.js';
import getc_unlocked from './getc_unlocked.js';
import { __sdec } from '../util/__ser.js';

// different signature, since working with buffers in JS is plain painful
export function getdelim(s, delim, bufsize=32) {
	const buf = new SharedArrayBuffer(bufsize, { maxByteLength: 1073741824 });
	const cnt = _getdelim(buf, bufsize, delim, s);
	if (cnt <= 0) return cnt;
	return __sdec(buf, cnt);
}
export default getdelim;

// C-compatible func
export function _getdelim(buf, n, delim, s) {
	let z, k, c;
	let i = 0;

	if (!n || !buf) return EINVAL;

	let dest = new Uint8Array(buf);
	const sbuf = new Uint8Array(s.buf);
	for (;;) {
		if (s.rpos != s.rend) {
			z = sbuf.indexOf(delim, s.rpos);
			k = z >= 0 ? z - s.rpos + 1 : s.rend - s.rpos;
		} else {
			z = 0;
			k = 0;
		}
		if (i+k >= n) {
			n = i+k+2;
			if (z <= 0) n += n/2;
			buf.grow(n);
			dest = new Uint8Array(buf);
		}
		if (k) {
			for (const max=i+k; i < max;)
				dest[i++] = sbuf[s.rpos++];
		}
		if (z > 0) break;

		if ((c = getc_unlocked(s)) == -1) break;

		/* If the byte read by getc won't fit without growing the
		 * output buffer, push it back for next iteration. */
		if (i+1 >= n) s.buf[--s.rpos] = c;
		else if ((dest[i++] = c) == delim) break;
	}

	return i;
}
