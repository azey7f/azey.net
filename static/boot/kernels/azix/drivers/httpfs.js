import * as vfs from '../vfs.js';

// module stuff
export const name = "httpfs";
export const read_only = true;
export function init() {
	mounts = 0;
	nodes = {};
	return 0;
}
export function exit() {
	if (mounts > 0) throw { message: "module in use" };
	mounts = undefined;
	nodes = undefined;
	return 0;
}

// int mount count
let mounts;
// 2d array of objects indexed by mount dev & VFS node ID, used for caching; contains type (str) and content (either u8str file content or array of dir entries)
let nodes;

// core functions
export const super_ops = {
	__mount: (device) => {
		if (!window.URL.canParse(device)) return EINVAL;
		++mounts;
		nodes[device] = [];
		return 0;
	},
	__remount: () => EIMPL,

	__umount: (device) => {
		--mounts;
		delete nodes[device];
		return 0;
	},
};

export const node_ops = {
	__existd: async (node) => !((await getentr(node))  < 0),
	__existf: async (node) => !((await getfcont(node)) < 0),
};

export const file_ops = {
	__openf: async (f, flags) => {
		if (flags.WRITE) return EINVAL;
		const cont = await getfcont(f.node);
		if (cont < 0) return cont;
		return nodes[f.node.superblock.device][f.node.id].content.length;
	},
	__opend: async (f, flags) => {
		const entr = await getentr(f.node);
		if (entr < 0) return entr;
		return entr.length;
	},

	__close: (f) => {
		return 0;
	},

	__readf: async (f, n_bytes) => {
		const cont = await getfcont(f.node);
		if (cont < 0) return cont;
		return cont.slice(f.offset, f.offset+n_bytes);
	},
	__readd: async (f) => {
		const entr = await getentr(f.node);
		if (entr < 0) return entr;
		if (f.offset >= entr.length) return '';
		return entr[f.offset];
	},
};

// utils
async function fetch_file(node, options={}, suffix='') {
	const url = window.URL.parse(node.superblock.device);
	let path = vfs.path(node, node.superblock.mountpoint.id);
	if (!url.pathname.endsWith('/')) path = '/'+path;
	return await fetch(`${url.origin}${url.pathname}${path}${suffix}`, options);
}

async function getentr(node) {
	const dev = node.superblock.device;
	if (!(node.id in nodes[dev])) {
		const res = await fetch_file(node, {}, '/__autoindex.json');
		if (!res.ok) return ENOTDIR;

		nodes[dev][node.id] = {
			type: 'dir',
			content: JSON.parse(await res.text()).map(c => c.name),
		};
	}

	if (nodes[dev][node.id].type === 'file') return ENOTDIR;
	return nodes[dev][node.id].content;
}

async function getfcont(node) {
	const dev = node.superblock.device;
	if (!(node.id in nodes[dev])) {
		if (!((await getentr(node)) < 0)) return EISDIR;

		const res = await fetch_file(node);
		if (!res.ok) return ENOENT;

		nodes[dev][node.id] = { type: 'file', content: window.enc.encode(await res.text()) };
	}

	if (nodes[dev][node.id].type === 'dir') return EISDIR;
	return nodes[dev][node.id].content;
}
