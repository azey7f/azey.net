import * as sys from '../sys.js';

export function ftell(s) {
	const pos = s.ops.seek(s, 0, 'CUR');
	if (pos < 0) return pos;

	/* Adjust for data in buffer. */
	if (s.rend)
		pos += s.rpos - s.rend;
	else if (s.wbase)
		pos += s.wpos - s.wbase;
	return pos;
}
export default ftell;
