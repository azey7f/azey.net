window.config = {
	NAME: "azix",
	VERSION: "0.2.0",
	INIT: "/bin/init.js",

	ROOT: window.location.origin,
	ROOT_DRIVER: "httpfs",
	ROOT_OPTIONS: {},

	DEFAULT_MODULES: [
		"pipe", // used by pipe() syscall
	],
};

import err from './err.js';
import { printk } from './util.js';
import { __insmod } from './module.js';

import * as vfs from './vfs.js';
import * as proc from './proc.js';

export async function efi_main() {
	await start_kernel();

	await printk(`running ${config.INIT} as userland init process`);
	const spawn_ret = await proc.spawn(0, config.INIT, [config.INIT], []);
	if (spawn_ret < 0) {
		printk(`failed to spawn init process: ${spawn_ret}`);
		return cleanup(EGENERIC);
	};

	const [_, init_ret] = await proc.wait(0);
	if (init_ret !== 0) {
		printk(`${config.INIT} exited with error code: -${init_ret}`);
		printk('if this happened on boot, your /etc/fstab is probably messed up');
		printk('run localStorage.clear() in the browser console to maybe fix it');
		return cleanup(EGENERIC);
	}

	return cleanup(0);
}
function cleanup(ret_code) {
	// shutdown cleanup
	for (const key of [
		'clock_start',
		'config',
		'dmesg',
		'drivers',
		'enc',
		'dec',
		'fb',
		'pgrp',
		'proc',
		'pses',
		'vfs',
	].concat(Object.keys(err))) {
		delete window[key];
	}

	return ret_code;
}

async function start_kernel() {
	window.dmesg = [];
	window.drivers = {};
	await printk(`${config.NAME} version ${config.VERSION}`);

	{
		// setup clock
		if (window.performance.now) {
			let clock_start = window.performance.now();
			await printk(`performance-clock: using time offset of ${clock_start.toFixed(3)} milliseconds`);
			window.clock_start = clock_start;
		} else {
			let clock_start = Date.now();
			await printk(`date-clock: using time offset of ${clock_start.toFixed(3)} milliseconds`);
			window.clock_start = clock_start;
		}
	}

	// init VFS layer
	if (await vfs.init(config.ROOT, config.ROOT_DRIVER) < 0) return EGENERIC;

	// setup process management
	if (await proc.init() < 0) return EGENERIC;

	// setup framebuffer
	await printk('setting up display');
	window.fb = document.createElement('div');
	window.fb.id = 'framebuffer';
	document.body.append(window.fb);

	// setup early printk
	// note: if this is ever removed, make sure there's something at FD 0 at least before initializing the TTY driver
	{
		const early_printk = document.createElement('p');
		early_printk.id = "early-printk";
		window.fb.append(early_printk);
		window.proc[0].files.push({
			offset: 0,
			op: {
				__write: (f, msg) => { early_printk.innerHTML += msg; return msg.length; },
				__close: () => { early_printk.remove(); return 0; },
			},
			node: { refs: 1, superblock: { refs: 1 } },
			flags: { WRITE: true, CLOSPAWN: true },
			refs: 1,
		});
	}
	await printk('printk: early output enabled');

	// load drivers
	await printk('loading default drivers');
	for (const mod of config.DEFAULT_MODULES)
		await __insmod(await import(`./drivers/${mod}.js`));

	// end
	await printk('kernel initialized!');
}
