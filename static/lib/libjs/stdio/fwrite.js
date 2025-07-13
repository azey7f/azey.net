import __towrite from './__towrite.js';
import { __senc } from '../util/__ser.js';

// different signature, since the size & count args don't really make sense in JS
export function fwrite(str, s) {
	if (!s || !s.flags) return EINVAL;
	if (!s.wend && __towrite(s)) return 0;

	const buf = __senc(str);
	const count = str.length;

	if (count > s.wend - s.wpos) return s.ops.write(s, str, count);

	let i = 0, buf_pos = 0;
	if (s.iobuf !== 'n') {
		/* Match /^(.*\n|)/ */
		for (i=count; i && buf[i-1] != 0xA; --i);
		if (i) {
			const ret = s.ops.write(s, str, i);
			if (ret < i) return ret;
			buf_pos = i + 1;
		}
	}

	const view = new Uint8Array(s.buf);
	while (buf_pos < buf.length)
		view[s.wpos++] = buf[buf_pos++];

	return count;
}
export default fwrite;

// C-compatible func, just in case
export const _fwrite = (buf, _, count, s) => fwrite(buf.slice(0,count), s);
