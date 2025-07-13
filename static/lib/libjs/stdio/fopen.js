import * as sys from '../sys.js';
import * as ops from './__file_ops.js';

import __mkstream from './__mkstream.js';
import __parse_mode from './__parse_mode.js';
import { __osl_add } from './__osl.js';

export function fopen(path, mode) {
	const flags = __parse_mode(mode);
	if (flags < 0) return flags;

	// try to open as TTY
	flags.TTY = true;
	let fd = sys.open(path, flags);
	if (fd === ENOTTY) {
		// open as regular file
		delete flags.TTY;
		fd = sys.open(path, flags);
	}
	if (fd < 0) return fd;

	return __osl_add(__mkstream(fd, flags, BUFSIZ, flags.TTY ? 'l' : 'f', ops));
}
export default fopen;
