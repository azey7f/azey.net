import { signal } from '../proc.js';
import __remove_node from '../vfs/__remove_node.js';

// module stuff
export const name = "pipe";
export function init() {
	mounts = 0;
	nodes = [];
	return 0;
}
export async function exit() {
	if (mounts > 0) throw { message: "module in use" };
	mounts = undefined;
	nodes = undefined;
	return 0;
}

// int mount count
let mounts;
// ring buffer impl
function tryadd(buf, item) {
	if (buf[buf.wpos] === undefined) {
		buf[buf.wpos++] = item;
		buf.wpos %= buf.length;
		return 0;
	}
	return EGENERIC;
}
function tryget(buf) {
	if (buf[buf.rpos] !== undefined) {
		const ret = buf[buf.rpos];
		delete buf[buf.rpos++];
		buf.rpos %= buf.length;
		return ret;
	}
	return EGENERIC;
}
// sparse array of objects indexed by VFS node ID
// contains buf (ring buffer), target (event dispatch target, for blocking), rrefs and wrefs (reader and writer counts),
// r_awaiting and w_awaiting (LIFO array of functions, used for blocking in __readf() and __write())
let nodes;

// core functions
export const super_ops = {
	__mount: (device, node) => {
		const buf = new Array(4096);
		buf.wpos = buf.rpos = 0;
		nodes[node.id] = {
			buf, rrefs: 0, wrefs: 0,
			target: new EventTarget(),
			r_awaiting: [],
			w_awaiting: [],
		};
		++mounts;
		return 0;
	},
	__remount: (node) => EIMPL, // TODO: remount

	__umount: (node) => {
		delete nodes[node.id];
		--mounts;
		return 0;
	},
};

export const node_ops = {
	__existf: (node) => node.id in nodes,
};

export const file_ops = {
	__openf: async (f, flags, pid) => {
		const node = nodes[f.node.id];

		if (flags.WRITE) {
			++node.wrefs;
			node.target.dispatchEvent(new Event('w'));
		}
		if (flags.READ) {
			++node.rrefs;
			node.target.dispatchEvent(new Event('r'));
		}

		if (!flags.NOBLOCK) {
			if (flags.WRITE && node.rrefs === 0)
				await block(node.target, 'r');
			if (flags.READ  && node.wrefs === 0)
				await block(node.target, 'w');
		}

		return 0;
	},

	__close: (f) => {
		const node = nodes[f.node.id];
		if (f.flags.WRITE)
			if (--node.wrefs === 0) for (const resolve of node.r_awaiting) resolve(true);
		if (f.flags.READ)
			if (--node.rrefs === 0) for (const resolve of node.w_awaiting) resolve(true);

		if (f.node.name === undefined && node.wrefs === 0 && node.rrefs === 0) {
			delete nodes[f.node.id];
			delete window.vfs.nodes[f.node.id];
			delete window.vfs.superblocks[f.node.id];
		}
		return 0;
	},

	__readf: async (f, n_bytes, pid) => {
		const node = nodes[f.node.id];

		const buf = new Uint8Array(n_bytes);
		let read = 0;
		while (read < n_bytes) {
			if (node === undefined) return buf.slice(0,read);
			const ret = tryget(node.buf);
			if (ret < 0) {
				if (node.wrefs === 0) return buf.slice(0,read);
				if (f.flags.NOBLOCK) return read ? buf.slice(0,read) : EWOULDBLOCK;

				if (await new Promise((resolve) => node.r_awaiting.push((err) => resolve(err)))) return buf.slice(0,read);
				continue;
			}

			if (node.w_awaiting.length) node.w_awaiting.pop()(false);
			buf.set(ret, read);
			read += ret.length;
		}
		return buf;
	},

	__write: async (f, str) => {
		const node = nodes[f.node.id];

		let i = 0;
		const err = () => {
			if (i > 0) return i; else {
				signal(pid, 'SIGPIPE');
				return EPIPE;
			}
		};

		while (i < str.length) {
			if (node === undefined) return err();
			const ret = tryadd(node.buf, window.enc.encode(str[i]));
			if (ret < 0) {
				if (node.rrefs === 0) return err();
				if (f.flags.NOBLOCK) return i ? i : EWOULDBLOCK;

				if (await new Promise((resolve) => node.w_awaiting.push((err) => resolve(err)))) return err();
				continue;
			}

			if (node.r_awaiting.length) node.r_awaiting.pop()(false);
			++i;
		}
		return i;
	},
}

// misc
function block(target, event) {
	return new Promise((resolve) => {
		const controller = new AbortController();
		target.addEventListener(event, () => {
			controller.abort();
			resolve();
		}, { signal: controller.signal });
	});
}
