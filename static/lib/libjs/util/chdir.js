import * as sys from '../sys.js';

export function chdir(path) {
	const fd = sys.open(path, { DIR: true });
	if (fd < 0) return fd;

	const ret = sys.chdir(fd);
	sys.close(fd);
	return ret;
}
export default chdir;
