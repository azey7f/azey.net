import __get_fd from './__get_fd.js';
import path from './path.js';

export async function __open_node(pid, node, flags={}) {
	if (flags.DIR) {
		if (flags.WRITE || flags.TTY) return EINVAL;
		if (!await node.op.__existd(node, pid)) {
			if (await node.op.__existf(node, pid)) return ENOTDIR;
			if (flags.CREATE) {
				const ret = await node.op.__creatd(node, pid);
				if (ret < 0) return ret;
				node.parent.children[node.name] = node;
			} else return ENOENT;
		}
	} else {
		if (flags.WRITE && node.superblock.options.ro) return EROFS;
		if (!await node.op.__existf(node, pid)) {
			if (await node.op.__existd(node, pid)) return EISDIR;
			if (flags.CREATE) {
				if (flags.TTY) return ENOTTY;
				const ret = await node.op.__creatf(node, pid);
				if (ret < 0) return ret;
				node.parent.children[node.name] = node;
			} else return ENOENT;
		}

		if (flags.TTY && !node.op.__isatty(node, pid)) return ENOTTY;
	}
	
	if (flags.NOOPEN) return 0;

	const file = {
		op: node.superblock.driver.file_ops,
		node, flags,
		offset: 0,
		refs: 1,
	};

	file.size = file.flags.DIR
		? await file.op.__opend(file, file.flags, pid)
		: await file.op.__openf(file, file.flags, pid);
	if (file.size < 0) return file.size;

	const fd = __get_fd(pid);

	window.proc[pid].files[fd] = file;
	++file.node.refs;
	++file.node.superblock.refs;

	return fd;
}
export default __open_node;
