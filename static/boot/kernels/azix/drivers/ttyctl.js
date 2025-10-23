import * as vfs from '../vfs.js';
import __get_node from '../vfs/__get_node.js';
import { ldisc } from '../tty.js';

// module stuff
export const name = "ttyctl";
export function init() {
	mounts = 0;
	return 0;
}
export function exit() {
	if (mounts > 0) throw { message: "module in use" };
	mounts = undefined;
	return 0;
}

// int mount count
let mounts;
// driver files visible in mount
const files = {
	'ctty': { // controlling TTY
		read: (f, n_bytes, pid) => window.proc[pid].group.session.tty
			? enc.encode('/'+vfs.path(window.proc[pid].group.session.tty)).slice(f.offset, f.offset + n_bytes)
			: ENOTTY,
		write: async (f, str, pid) => {
			if (!(pid in window.pses)) return EPERM;
			if (str === '') {
				window.pses[pid].group.session.tty = undefined;
				return 0;
			}

			const node = await __get_node(pid, str);
			if (node < 0) return node;
			if (!node.op.__isatty(node)) return ENOTTY;

			window.proc[pid].group.session.tty = node;
			files.pgid.write(f, pid, pid);
			return str.length;
		},
	},
	'ftty': { // currently selected TTY index (ctrl-1,2,3,4...)
		read: (f, n_bytes, pid) => enc.encode(window.drivers.tty.selected_index().toString()).slice(f.offset, f.offset + n_bytes),
		write: (f, str, pid) => window.drivers.tty.select_tty(+str),
	},
	'pgid': { // TTY's foreground process group ID
		read: (f, n_bytes, pid) => {
			const node = window.proc[pid].group.session.tty;
			if (!node) return ENOTTY;

			const ret = node.op.__tty_get(node, 'pgid');
			return ret < 0 ? ret : enc.encode(ret.toString()).slice(f.offset, f.offset + n_bytes);
		},
		write: (f, str, pid) => {
			if (!(pid in window.pses)) return EPERM;
			if (!((str = +str) in window.pses[pid].groups)) return EINVAL;

			const node = window.proc[pid].group.session.tty;
			if (!node) return ENOTTY;

			const ret = node.op.__tty_set(node, 'pgid', str);
			return ret < 0 ? ret : str.length;
		},
	},
	'ldisc': { // line discipline, see ../tty.js
		read: (f, n_bytes, pid) => {
			const node = window.proc[pid].group.session.tty;
			if (!node) return ENOTTY;

			const ret = node.op.__tty_get(node, 'ldisc');
			return ret < 0 ? ret : enc.encode(ret.toString()).slice(f.offset, f.offset + n_bytes);
		},
		write: (f, str, pid) => {
			if (!(str in ldisc)) return EINVAL;

			const node = window.proc[pid].group.session.tty;
			if (!node) return ENOTTY;

			const ret = node.op.__tty_set(node, 'ldisc', str);
			return ret < 0 ? ret : str.length;
		},
	},
};

// core functions
export const super_ops = {
	__mount: (device, node) => {
		++mounts;
		return 0;
	},
	__remount: () => EIMPL,

	__umount: (device, node) => {
		--mounts;
		return 0;
	},
};

export const node_ops = {
	//stat: (node) => { return { type: 'file' }; },
	__existd: (node) => node.id === node.superblock.mountpoint.id,
	__existf: (node) => node.parent.id === node.superblock.mountpoint.id && node.name in files,
}

export const file_ops = {
	__openf: (f, flags) => 0,
	__opend: (f, flags) => files.length,
	__close: (f) => 0,

	__readf: (f, n_bytes, pid) => files[f.node.name].read(f, n_bytes, pid),
	__readd: (f) => {
		const keys = Object.keys(files);
		return f.offset < keys.length ? keys[f.offset] : '';
	},

	__write: (f, str, pid) => files[f.node.name].write(f, str, pid),
}
