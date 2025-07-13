import __toread from './__toread.js';

// different signature, since working with buffers in JS is plain painful
export function getc_unlocked(s) {
	return (s.rpos < s.rend) ? s.buf[s.rpos++] : __uflow((s));
}
export default getc_unlocked;

function __uflow(s) {
	const c = new SharedArrayBuffer(1);
	if ((s.rend || !__toread(s)) && s.ops.read(s, c, 1)==1) return new Uint8Array(c)[0];
	return EGENERIC;
}
