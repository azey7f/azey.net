
export async function write(pid, fd, str) {
	const f = window.proc[pid].files[fd];
	if (!f || !str) return EINVAL;
	if (!f.flags.WRITE) return EBADF;

	const prev = f.offset;
	if (f.flags.APPEND) f.offset = f.size;

	const ret = await f.op.__write(f, str, pid);

	if (ret > 0) f.offset += ret;
	else if (f.flags.APPEND) f.offset = prev;
	return ret;
}
export default write;
