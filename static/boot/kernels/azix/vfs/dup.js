import close from './close.js';
import __get_fd from './__get_fd.js';

export async function dup(pid, oldfd, newfd=__get_fd(pid)) {
	const f = window.proc[pid].files[oldfd];
	if (f === undefined || !is_naturalz(newfd)) return EINVAL; 

	if (newfd in window.proc[pid].files)
		await close(pid, newfd);
	++f.refs;
	window.proc[pid].files[newfd] = f;
	f.flags.CLOSPAWN = false;

	return newfd;
}
export default dup;

const is_naturalz = n => n >= 0 && Math.floor(n) === +n;
