export async function read(pid, fd, n_bytes) {
	if (!(pid in window.proc)) return EINVAL;
	if (!(fd in window.proc[pid].files)) return EBADF;

	const f = window.proc[pid].files[fd];
	if (f === undefined || n_bytes === undefined) return EINVAL;
	if (!f.flags.READ) return EBADF;

	if (f.flags.DIR) {
		const ret = await f.op.__readd(f, pid);
		if (typeof ret === "string") {
			if (ret.length > n_bytes) return EINVAL;
			++f.offset;
		}
		return window.enc.encode(ret);
	}

	const ret = await f.op.__readf(f, n_bytes, pid);
	if (typeof ret === "object") f.offset += n_bytes;
	return ret;
}
export default read;
