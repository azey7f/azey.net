window.config = {
	NAME: "azix",
	VERSION: "0.0.2",
	INIT: "/bin/init.js",

	ROOT: window.location.origin,
	ROOT_DRIVER: "httpfs",
	ROOT_OPTIONS: {},

	DEFAULT_MODULES: [
		"pipe", // used by pipe() syscall
		/*"procfs",
		"ttyctl",
		"tmpfs",
		"domfs",
		"input",
		"tty",*/
	],
};

import './err.js';
import { printk } from './util.js';
import { __insmod } from './module.js';

import * as vfs from './vfs.js';
import * as proc from './proc.js';

{
	await start_kernel();

	await printk(`running ${config.INIT} as userland init process`);
	await proc.spawn(0, config.INIT, [config.INIT], []);
	const [_, init_ret] = await proc.wait(0);
	if (init_ret !== 0) {
		printk(`${config.INIT} exited with error: -${init_ret}`);
		printk('if this happened on boot, your /etc/fstab is probably messed up');
		printk('run localStorage.clear() in the browser console to maybe fix it');
	}
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
	window.fb = document.createElement('main');
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

	// mount default filesystems
	/*await try_mount('/proc', 'procfs', 'none');
	await try_mount('/dev', 'tmpfs', 'none');
	await try_mount('/dev/input', 'input', 'none');
	await try_mount('/dev/dom', 'domfs', 'none');

	for (let i=0; i <= 4; ++i) {
		let name = `tty${i}`;
		await try_mount(`/dev/${name}`, 'tty', i.toString());
	}

	await try_mount('/dev/tty', 'ttyctl', 'none');*/

	// end
	await printk('kernel initialized!');

	// r/w test
	//for (;;) await vfs_file.read(window.proc[0].files[0], 1); /*
	/*for (;;) {
		await vfs_file.write(window.proc[0].files[0], "in: ");
		const str = await vfs_file.read(window.proc[0].files[0], 1);
		await vfs_file.write(window.proc[0].files[0], str+'\n');
	}//*/
}

async function try_mount(target, fs, ...args) {
	await printk(`mounting ${fs} on ${target}`);
	await vfs.open(0, target, { DIR: true, CREATE: true, NOOPEN: true });

	const mount = await vfs.mount(0, target, fs, ...args);
	if (mount < 0) throw new Error(`error mounting ${target}: ${mount}`);
}
