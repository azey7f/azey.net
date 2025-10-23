import { printk } from '../util.js';
import * as vfs from '../vfs.js';

// module stuff
export const name = "procfs";
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
	__existd: (node, pid) => {
		const ret = get_node(pid, node);
		return !(ret < 0 || typeof ret[0].read === 'function' || typeof ret[0].write === 'function');
	},
	__existf: (node, pid) => {
		const ret = get_node(pid, node);
		return !(ret < 0) && (typeof ret[0].read === 'function' || typeof ret[0].write === 'function');
	},
}

export const file_ops = {
	__openf: () => 0,
	__opend: () => 0,
	__close: () => 0,

	__readf: (f, n_bytes, pid) => {
		const ret = get_node(pid, f.node);
		if (ret < 0) return ret;
		const [pnode, dyn_indexes] = ret;
		return pnode.read ? pnode.read(f, n_bytes, pid, ...dyn_indexes) : EPERM;
	},
	__readd: (f, pid) => {
		const ret = get_node(pid, f.node);
		if (ret < 0) return ret;
		const [pnode, dyn_indexes] = ret;

		const parsed_node = {};
		for (const key in pnode) {
			if (key === '__dyn') {
				for (const i in get_property(pnode.__dyn.__key(...dyn_indexes)))
					parsed_node[i.toString()] = pnode.__dyn;
				if (pnode.__dyn.__self)
					parsed_node.self = pnode[pnode.__dyn.__self(pid)];
			} else if (!key.startsWith('__')) {
				if (pnode[key].link && pnode[key].link(...dyn_indexes) < 0) continue;
				parsed_node[key] = pnode[key];
			}
		}

		const keys = Object.keys(parsed_node);
		return f.offset < keys.length ? keys[f.offset] : '';
	},

	__write: (f, str, pid) => {
		const ret = get_node(pid, f.node);
		if (ret < 0) return ret;
		const [pnode, dyn_indexes] = ret;
		return pnode.write ? pnode.write(f, str, pid, ...dyn_indexes) : EPERM;
	},
}

// structure of the filesystem & related r/w functions
//
// read() and write() use the same arguments as file_ops' __readf() and __write(), incl. PID
// if read() or write() isn't defined, an EPERM error is returned instead
// each entry can also contain link() instead, which returns a reversed array path (/group/self -> ['self', 'group'])
//
// __dyn is a special entry which creates dirs from entries in the window object using the return value of __dyn.__key as path
// functions inside __dyn have an additional index argument, nested __dyns add multiple args with the hierarchically
// lowest ones first (/proc/1/2 -> func(2, 1))
// __dyn.__self(pid) returns an index to be used for self dirs, e.g. /proc/self for the current process
const self_i = (f, n_bytes, _, index) => enc.encode(index.toString()).slice(f.offset, f.offset+n_bytes);
const proc = {
	__dyn: {
		__key: () => ['proc'],
		__self: (pid) => pid,
		pid: { read: self_i },

		cmdline: { read: (f, n, _, pid) => enc.encode(window.proc[pid].cmdline.join('\0')).slice(f.offset, f.offset+n) },
		env: { read: (f, n, _, pid) => enc.encode(window.proc[pid].env.join('\0')).slice(f.offset, f.offset+n) },
		cwd: { read: (f, n, _, pid) => enc.encode('/'+vfs.path(window.proc[pid].cwd)).slice(f.offset, f.offset+n) },
		state: { read: (f, n, _, pid) => enc.encode(window.proc[pid].state).slice(f.offset, f.offset+n) },

		group: { link: (pid) => [window.proc[pid].group.id.toString(), 'group'], },
		session: { link: (pid) => [window.proc[pid].group.session.id.toString(), 'session'], },

		parent: { link: (pid) => window.proc[pid].parent ? [window.proc[pid].parent.pid.toString()] : EGENERIC },
		children: {}, // recursive, assigned below

		fd: { __dyn: {
			__key: (pid) => ['proc', `${pid}`, 'files'],
			read: (f, n, _, pid, fd) => enc.encode('/'+vfs.path(window.proc[pid].files[fd].node)).slice(f.offset, f.offset+n),
		} },
	},
	group: { __dyn: {
		__key: () => ['pgrp'],
		__self: (pid) => window.proc[pid].group.id,
		pgid: { read: self_i },
		session: { link: (pgid) => [window.pgrp[pgid].session.id.toString(), 'session'] },
		proc: {}, // recursive, assigned below
	} },
	session: { __dyn: {
		__key: () => ['pses'],
		__self: (pid) => window.proc[pid].group.session.id,
		sid: { read: self_i },
		groups: {}, // recursive, assigned below
		tty: { read: (f, n, _, sid) => window.pses[sid].tty
			? enc.encode('/'+vfs.path(window.pses[sid].tty)).slice(f.offset, f.offset+n)
			: ENOTTY
		},
	} },

	dmesg: {
		read: (f, n_bytes) => enc.encode(window.dmesg.join('')).slice(f.offset, f.offset+n_bytes), // TODO: make this blocking?
		write: (f, str, pid) => printk(str),//printk(`PID ${pid}: ${str}`),
	},

	mounts: { read: (f, n_bytes) => {
		let content = '';
		for (const id in window.vfs.superblocks) {
			const sb = window.vfs.superblocks[id];
			const path = vfs.path(sb.mountpoint);
			if (path < 0) continue; // ignore out-of-root mounts, like unnamed pipes

			const options = Object.entries(sb.options)
				.filter(([k,v]) => typeof v !== 'boolean' || v)
				.map(([k,v]) => v !== true ? `${k}=${v}` : k).join();
			content += `${sb.device} ${'/'+path} ${sb.driver.name} ${options}\n`;
		}
		return enc.encode(content).slice(f.offset, f.offset+n_bytes);
	}},
};
// recursive assigns
proc.__dyn.children.__dyn = Object.assign({}, proc.__dyn, {
	__key: (pid) => ['proc', `${pid}`, 'children'],
	__self: null,
});
proc.group.__dyn.proc.__dyn = Object.assign({}, proc.__dyn, {
	__key: (pgid) => ['pgrp', `${pgid}`, 'proc'],
	__self: null,
});
proc.session.__dyn.groups.__dyn = Object.assign({}, proc.group.__dyn, {
	__key: (sid) => ['pses', `${sid}`, 'groups'],
	__self: null,
});

// misc
function get_node(pid, vnode) {
	const path = [];
	while (vnode.id !== vnode.superblock.mountpoint.id) {
		path.push(vnode.name);
		vnode = vnode.parent;
	}

	return path_get_node(pid, path);
}

function path_get_node(pid, path) {
	let current = proc;
	let dyn_indexes = [];
	for (let i=path.length; --i >= 0;) {
		if (current.read || path[i].startsWith('__')) return ENOENT;
		if (!(path[i] in current)) {
			if (current.__dyn) {
				if (current.__dyn.__self && path[i] === 'self') {
					dyn_indexes.push(current.__dyn.__self(pid));
					current = current.__dyn;
				} else if (+path[i] in get_property(current.__dyn.__key(...dyn_indexes))) {
					dyn_indexes.push(+path[i]);
					current = current.__dyn;
				} else return ENOENT;
				continue;
			}
			return ENOENT;
		}
		if ((current = current[path[i]]).link) {
			const link = current.link(...dyn_indexes);
			if (link < 0) return link;
			const ret = path_get_node(pid, link);
			current = ret[0];
			dyn_indexes = ret[1].concat(dyn_indexes);
		}
	}
	return [current, dyn_indexes];
}

const get_property = (keyarr) => keyarr.reduce((prev, curr) => prev?.[curr], window);
