import * as sys from '../sys.js';
import * as ops from './__file_ops.js';

import __mkstream from './__mkstream.js';
import __parse_mode from './__parse_mode.js';
import { __osl_add } from './__osl.js';

export function fdopen(fd, mode) {
	const flags = __parse_mode(mode);
	if (flags < 0) return flags;

	// attempt to open file as a TTY, returns ENOTTY if regular file and 0 if TTY
	const ret = sys.reopen(fd, { TTY: true, NOOPEN: true });

	let iobuf = 'l';
	if (ret === ENOTTY)
		iobuf = 'f';
	else if (ret < 0) return ret;

	return __osl_add(__mkstream(fd, flags, BUFSIZ, iobuf, ops));
}
export default fdopen;
