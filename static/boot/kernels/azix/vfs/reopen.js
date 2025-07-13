import close from './close.js';
import __open_node from './__open_node.js';

export async function reopen(pid, fd, flags={}) {
	const f = window.proc[pid].files[fd];
	if (!f || typeof flags !== 'object') return EINVAL;
	
	const new_flags = structuredClone(f.flags);
	for (const flag in flags) new_flags[flag] = flags[flag];

	// check if openable
	const noop = new_flags.NOOPEN;
	new_flags.NOOPEN = true;
	const tryopen = await __open_node(pid, f.node, new_flags);
	if (noop || tryopen < 0) return tryopen;
	new_flags.NOOPEN = false;

	// close old file
	const cl = close(pid, fd);
	if (cl < 0) return cl;

	// open new file
	const new_fd = await __open_node(pid, f.node, new_flags);
	return new_fd;
}
export default reopen;
