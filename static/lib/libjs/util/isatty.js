import { open, reopen } from '../sys.js';

// C-compatible signature, but also supports path or FD
export function isatty(fd, path) {
	const fd_ok = typeof fd === 'number';
	const path_ok = typeof path === 'string';
	if (fd_ok === path_ok) return EINVAL;

	if (path_ok)
		return open(path, { TTY: true, NOOPEN: true });
	else
		return reopen(fd, { TTY: true, NOOPEN: true });
}
export default isatty;
