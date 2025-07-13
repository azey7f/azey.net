import { printk } from '../util.js';
import * as vfs from '../vfs.js';
import __open_node from '../vfs/__open_node.js';

import { setsid, setpgid } from './jobs.js';
import { signal } from './signal.js';
import { __syscall, syscalls } from './syscall.js';

// functions
export async function spawn(ppid, path, argv, envp, waitsab) {
	const fd = await vfs.open(0, path, { READ: true });
	if (fd < 0) return fd;

	const js = await vfs.read(0, fd, Number.MAX_SAFE_INTEGER);
	if (js < 0) return js;

	await vfs.close(0, fd);

	const url = URL.createObjectURL(new Blob([
		// prepend href to import paths, needed since the module is loaded as a blob
		js.replaceAll(/(import.*?)'\/?(.*?)'(;.*?\n)/gs, `$1'${window.location.href}$2'$3`)
	], {type: 'text/javascript'}));
	let worker;
	try { worker = new Worker(url, { type: 'module' }); } catch (err) {
		await printk(`spawn: failed to start worker: ${err.message}`);
		return EGENERIC;
	} finally { URL.revokeObjectURL(url) };

	const sysret = new SharedArrayBuffer(4); // 4 bytes since Atomics use an Int32Array
	const pid = await __create_process(ppid, path, argv, envp, worker, new Int32Array(sysret));

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
