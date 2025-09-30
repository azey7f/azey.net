import { printk } from '../util.js';
import { spawn, terminate, wait } from './process.js';
import { signals } from './signal.js';
import { setsid, setpgid } from './jobs.js';

import { insmod, rmmod } from '../module.js';

import * as vfs from '../vfs.js';
import __open_node from '../vfs/__open_node.js';
import __mount_node from '../vfs/__mount_node.js';

// __syscall: handles worker postMessage events, meant to be called from worker.onmessage
export async function __syscall(pid, data) {
	const sysret = window.proc[pid].sysret;
	if (
		Array.isArray(data) && data.length === 2
		&& typeof data[0] === 'string' && Array.isArray(data[1])
		&& data[0] in syscalls
	) {

		window.proc[pid].state = 'D';
		const ret = await syscalls[data[0]](pid, ...data[1]);
		if (pid in window.proc && window.proc[pid].state !== 'Z') { // call wasn't exit()
			window.proc[pid].state = 'R';

			Atomics.store(sysret, 0, ret);
			Atomics.notify(sysret, 0);
		}
		return ret;
	}

	Atomics.store(sysret, 0, EINVAL);
	Atomics.notify(sysret, 0);
}

// data serialization
const encoder = new TextEncoder();
function senc(str) { return encoder.encode(str); }

// syscall table
export const syscalls = {
	// files
	open:   (pid, path, flags) => vfs.open(pid, path, flags),
	remove: (pid, path, flags) => vfs.remove(pid, path, flags),
	reopen: (pid, fd, flags)   => vfs.reopen(pid, fd, flags),
	close:  (pid, fd)          => vfs.close(pid, fd),
	dup:    (pid, fd, newfd)   => vfs.dup(pid, fd, newfd),
	read: async (pid, fd, sab, count) => {
		if (sab === count || count > sab.byteLength || count < 0) return EINVAL;

		const str = await vfs.read(pid, fd, count)
		if (str < 0) return str;
		//console.log(count)
		//console.log(str)
		//console.log(str.length)

		// not thread-safe, but the web worker should be in an Atomics.wait() call
		let buf = senc(str), out = new Uint8Array(sab);
		let i = 0;
		while (i<count && i<buf.length)
			out[i] = buf[i++];

		return i;
	},
	write: (pid, fd, str) => vfs.write(pid, fd, str),
	seek: (pid, fd, n, type) => vfs.seek(pid, fd, n, type),

	mount: (pid, target, driver, device, options) => vfs.mount(pid, target, driver, device, options),
	umount: (pid, target) => vfs.umount(pid, target),

	/*stat:  (pid, path) => {
		vfs.stat(path);
		return 0;
	},
	fstat: (pid, fd) => {
		if (!(fd in window.proc[pid].fd)) return EBADF;
		vfs.nodestat(window.proc[pid].fd[fd].node);
		return 0;
	},*/
	path: (pid, fd, sab) => {
		const path = vfs.path(window.proc[pid].files[fd].node);
		if (path < 0) return path;

		let buf = senc('/'+path), out = new Uint8Array(sab);
		if (buf.length > sab.byteLength) return EINVAL;

		// not thread-safe, but the web worker should be in an Atomics.wait() call
		let i = 0;
		while (i<buf.length)
			out[i] = buf[i++];

		return i;
	},
	pipe: async (pid, sab, open_flags) => {
		if (sab.byteLength < 8) return EINVAL;

		const vnode = {
			type: 'dir',
			parent: {
				op: {
					__existf: () => true,
					__existd: () => false,
					__openf: () => 0,
				},
				children: {},
			},
		};

		if (await __mount_node(pid, vnode, 'pipe') < 0) { // if any of these calls return an error something's very wrong
			printk(`${pid}: failed to mount unnamed pipe`);
			return EGENERIC;
		}

		const pnode = vnode.parent.children[undefined];

		let rfd = __open_node(pid, pnode, Object.assign({}, open_flags, { READ: true,  WRITE: false }));
		let wfd = __open_node(pid, pnode, Object.assign({}, open_flags, { READ: false, WRITE: true }));
		if ((rfd = await rfd) < 0) {
			delete window.vfs.nodes[pnode.id];
			printk(`${pid}: failed to open unnamed pipe: ${rfd}`);
			return rfd;
		}
		if ((wfd = await wfd) < 0) {
			delete window.vfs.nodes[pnode.id];
			printk(`${pid}: failed to open unnamed pipe: ${wfd}`);
			return wfd;
		}

		const ret = new Int32Array(sab);
		ret[0] = rfd;
		ret[1] = wfd;

		return 0;
	},

	// process stuff
	chdir: (pid, fd) => {
		const node = window.proc[pid].files[fd].node;
		if (node.type != 'dir') return ENOTDIR;
		window.proc[pid].cwd = node;
		return 0;
	},

	setsid:  (pid) => setsid(pid),
	setpgid: (pid, apid, pgid) => {
		if (!(apid in window.proc[pid].children) && pid !== apid) return EPERM;
		if (pgid !== 0 && pgid in window.pgrp && window.proc[pid].group.session.id !== window.pgrp[pgid].session.id) return EPERM;
		return setpgid(apid, pgid);
	},

	spawn: (pid, path, argv, envp, waitsab) => spawn(pid, path, argv, envp, waitsab),
	signal: (pid, sig, handler) => {
		if (!(sig in signals)) return EINVAL;
		if (['SIGKILL', 'SIGSTOP'].includes(sig)) return 0;

		switch (handler) {
			case 'default':
				delete window.proc[pid].signals[sig];
				break;
			case 'ignore':
			case 'handle':
				window.proc[pid].signals[sig] = handler;
				break;
			default: return EINVAL;
		}
		return 0;
	},

	exit: (pid, ret) => terminate(pid, ret),
	wait: async (pid, sab) => {
		const wret = await wait(pid);
		if (wret < 0) return wret;
		const [cpid, ret] = wret;
		if (sab !== undefined)
			(new Uint8Array(sab))[0] = ret;
		return cpid;
	},

	// misc
	insmod: (pid, path) => insmod(path),
	rmmod: (pid, mod) => insmod(mod),
};
