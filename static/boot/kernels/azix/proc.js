import { printk } from './util.js';
import { __create_process } from './proc/process.js';

export async function init() {
	await printk('setting up process management');

	window.pses = [];
	window.pgrp = [];
	window.proc = [];

	// create kernel process (PID, SID, PGID 0)
	await __create_process(undefined, config.NAME, [config.NAME]);

	return 0;
}

export * from './proc/jobs.js';
export * from './proc/process.js';
export * from './proc/signal.js';
export * from './proc/syscall.js';
