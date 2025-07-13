import * as sys from '../sys.js';
import { __sdec } from '../util/__ser.js';

export function fdpath(fd, bufsize=32) {
	const buf = new SharedArrayBuffer(bufsize, { maxByteLength: 1073741824 });
	const cnt = _fdpath(fd, buf, bufsize);
	if (cnt < 0) return cnt;
	return __sdec(buf, cnt);
}
export default fdpath;

export function _fdpath(fd, buf, bufsize) {
	let len;
	while ((len = sys.path(fd, buf)) === EINVAL)
		buf.grow(bufsize *= 2);
	return len;
}
