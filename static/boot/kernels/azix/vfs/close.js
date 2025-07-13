
export async function close(pid, fd) {
	const f = window.proc[pid]?.files[fd];
	if (f === undefined) return EBADF;

	if (--f.refs === 0) {
		const ret = await f.op.__close(f, pid);
		if (ret < 0) return ret;
		--f.node.refs;
		--f.node.superblock.refs;
	}

	delete window.proc[pid].files[fd];
	return 0;
}
export default close;
