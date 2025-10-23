import { printk } from '../util.js';
import * as vfs from '../vfs.js';
import __open_node from '../vfs/__open_node.js';

import { setsid, setpgid } from './jobs.js';
import { signal } from './signal.js';
import { __syscall, syscalls } from './syscall.js';

// functions
export async function spawn(ppid, path, argv, envp, waitsab) {
	if (!window.isSecureContext) {
		await printk("spawn: can't use SharedArrayBuffer: document is not in a secure context");
		return EGENERIC;
	}
	if (!window.crossOriginIsolated) {
		await printk("spawn: can't use SharedArrayBuffer: document is not cross-origin isolated");
		await printk("^^^ this seems to happen on android with firefox-based browsers sometimes, no clue why :c");
		return EGENERIC;
	}

	// spawn worker
	const urls = await __link(path);
	if (urls < 0) return urls;

	let worker;
	try {
		worker = new Worker(urls[0], { type: 'module' });
	} catch (err) {
		await printk(`spawn: failed to start worker: ${err.message}`);
		for (const url of urls) URL.revokeObjectURL(url);
		return EGENERIC;
	}

	const sysret = new SharedArrayBuffer(4); // 4 bytes since Atomics use an Int32Array
	const pid = await __create_process(ppid, path, argv, envp, worker, new Int32Array(sysret));

	// error handlers, wait for waitsab
	worker.onmessage = (event) => __syscall(pid, event.data);
	worker.onerror = (err) => {
		printk(`process PID ${pid} error: ${err.message}`);
		syscalls.exit(pid, -EGENERIC);
		//throw err;
	};

	if (waitsab !== undefined) {
		(async () => {
			const i32 = new Int32Array(waitsab);
			if (Atomics.waitAsync !== undefined) // TODO: hopefully this should be fully supported everywhere soon
				await Atomics.waitAsync(i32, 0, 0, 5000); // 5s max delay, should be more than enough
			else await new Promise((resolve) => {
				// 3ms spin wait
				const inter = setInterval(() => {
					if (Atomics.load(i32, 0) !== 0) {
						clearInterval(inter);
						resolve();
					}
				}, 3);
			});

			worker.postMessage({ argv, envp, sysret });
		})();
	} else worker.postMessage({ argv, envp, sysret });

	// cleanup
	setTimeout(() => {
		for (const url of urls) URL.revokeObjectURL(url)
	}, 1000);
	return pid;
}

export async function terminate(pid, ret=0) {
	const proc = window.proc[pid];

	proc.worker.terminate();
	if (!proc.parent) return await __remove_process(pid);
	proc.state = 'Z';
	proc.ret = ret;
	proc.parent.target.dispatchEvent(new CustomEvent('child', { detail: pid }));
	return 0;
}

export async function wait(pid) {
	if (window.proc[pid].children.reduce(m => m+1,0) === 0) return EGENERIC;

	for (const cpid in window.proc[pid].children)
		if (window.proc[cpid].state === 'Z') {
			const ret = window.proc[cpid].ret;
			await __remove_process(cpid);
			return [cpid, ret];
		}

	return await new Promise((resolve, reject) => {
		const controller = new AbortController();
		window.proc[pid].target.addEventListener('child', async (e) => {
			controller.abort();
			const ret = window.proc[e.detail].ret;
			await __remove_process(e.detail);
			resolve([e.detail, ret]);
		}, { signal: controller.signal });
	});
}

// internal
// __create_process: create window.proc[] record of process
export async function __create_process(ppid, path, argv=[], envp=[], worker, sysret) {
	const pid = __get_pid();
	const parent = window.proc[ppid];

	window.proc[pid] = {
		pid,
		worker, sysret, parent,
		cmdline: argv,
		files: [], state: 'R',
		signals: {},
		children: [],
		target: new EventTarget(),
	};

	if (parent) {
		parent.children[pid] = window.proc[pid];

		window.proc[pid].env = parent.env.concat(envp);
		for (const opt of ['group', 'cwd'])
			window.proc[pid][opt] = parent[opt];
		
		for (const fd in parent.files) {
			const f = parent.files[fd];
			if (!f.flags.CLOSPAWN) {
				__open_node(pid, f.node, f.flags);
				//window.proc[pid].files.push(f);
				//++f.refs;
			}
		}

		parent.group.proc[pid] = window.proc[pid];
	} else {
		window.proc[pid].env = envp;
		window.proc[pid].cwd = window.vfs.nodes[0].children['/'];
		setsid(pid);
	}

	return pid;
}

function __get_pid() {
	let pid = -1;
	while (window.proc[++pid] || window.pgrp[pid] || window.pses[pid]);
	return pid;
}

// __remove_process: close open files, remove window.proc/pgrp/pses records
export async function __remove_process(pid) {
	for (const cpid in window.proc[pid].children) {
		signal(cpid, 'SIGTERM'); // send SIGTERM to child and reassign it to init
		window.proc[cpid].parent = window.proc[1];
		window.proc[1].children[cpid] = window.proc[cpid];
	}

	for (const fd in window.proc[pid].files)
		await vfs.close(pid, fd);

	delete window.proc[pid].parent?.children[pid];
	delete window.proc[pid].group.proc[pid];
	if (window.proc[pid].group.proc.reduce(m => m+1,0) === 0)
		await __remove_pgroup(window.proc[pid].group.id);
	delete window.proc[pid];
	return 0;
}

export function __remove_pgroup(pgid) {
	delete window.pgrp[pgid].session.groups[pgid];
	if (window.pgrp[pgid].session.groups.reduce(m => m+1,0) === 0)
		delete window.pses[window.pgrp[pgid].session.id];
	delete window.pgrp[pgid];
	return 0;
}

// __link: read and JIT "link" source files, recursively replaces imports with blob: URLs
// returns an array of blob URLs, with the first one being the final processed program
// __link_cache: stores already processed blobs by path, speeds stuff up
export let __link_cache = {};
export function __link(path) {
	const ret = __link_rec(path);
	__link_cache = {};
	return ret;
};
export async function __link_rec(path) {
	const fd = await vfs.open(0, path, { READ: true });
	if (fd < 0) return fd;

	const js = await vfs.read(0, fd, Number.MAX_SAFE_INTEGER);
	if (js < 0) return js;

	const abspath = vfs.path(window.proc[0].files[fd].node);
	if (abspath < 0) return abspath;

	await vfs.close(0, fd);

	// check cache
	if (Object.hasOwn(__link_cache, abspath)) return [__link_cache[abspath]];

	// iterate over all lines, match imports & recursively replace them with blob URLs
	let blobURLs = [""];
	const processed = await Promise.all(window.dec.decode(js).split('\n').map(async (line, i) => {
		if (blobURLs < 0) return;

		const match = line.match(/^([a-z][a-z])port(.*)(['"])(.*\.js)\3(.*)/);
		if (match === null) return line + "\n";
		// match = ["import _ from '/lib/whatever';", "im", " _ from ", "'", "/lib/whatever", ";"]

		let ipath = match[4];
		if (!ipath.startsWith('/')) {
			// relative path
			ipath = '/' + abspath.slice(0, abspath.lastIndexOf('/')+1) + ipath;
		};

		const urls = await __link_rec(ipath);
		if (urls < 0) {
			blobURLs = urls;
			return await printk(`__link: failed with error: ${urls}`);
		}

		blobURLs = blobURLs.concat(urls);
		return `${match[1]}port${match[2]}${match[3]}${urls[0]}${match[3]}${match[5]}\n`;
	}));

	if (!(blobURLs < 0)) {
		__link_cache[abspath] = blobURLs[0] = URL.createObjectURL(new Blob(processed, {type: 'text/javascript'}));
	}
	return blobURLs;
}
