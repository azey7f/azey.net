import * as sys from '../sys.js';
import { __sdec } from './__ser.js';

export function getcwd() {
	const fd = sys.open('.', { READ: true, DIR: true });
	if (fd < 0) return fd;

	const pathbuf = new SharedArrayBuffer(128); // TODO: dynamic buf size and/or enforce max file path len
	const count = sys.path(fd, pathbuf);
	sys.close(fd);
	if (count < 0) return count;

	return __sdec(pathbuf, count);
}
export default getcwd;
