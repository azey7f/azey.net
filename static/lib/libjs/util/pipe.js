import * as sys from '../sys.js';

export function pipe(flags) {
	const sab = new SharedArrayBuffer(8);
	const ret = sys.pipe(sab, flags);
	if (ret < 0) return ret;
	return new Int32Array(sab);
}
export default pipe;
