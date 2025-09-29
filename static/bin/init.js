import '/lib/libjs/std.js';
import { println } from '/lib/libjs/stdio.js';
import { getopt, wait, strerror, isatty } from '/lib/libjs/util.js';
import * as sys from '/lib/libjs/sys.js';

const opts = {
	TTYPREFIX: '/dev/tty',
	CONSOLE_INIT: '/bin/getty.js',
	LOG: '/proc/dmesg',
};

function usage() {
	println('Usage: init [OPTION]...');
	println('Initialize the system.');
	println();
	println('  -p <path>  TTY path prefix, e.g. /dev/tty for /dev/ttyN');
	println('               /dev/tty by default');
	println('  -i <file>  specify program to run on each TTY');
	println('               /bin/getty.js by default');
	println('  -l <file>  log file to use');
	println('               /proc/dmesg by default');
	println('  -h         print usage and exit');
}
self.main = function(argv) {
	while (self.optind < argv.length)
		switch (getopt(argv, 'i:p:l:h') ) {
			case 'p':
				opts.TTYPREFIX = self.optarg;
				break;
			case 'i':
				opts.CONSOLE_INIT = self.optarg;
				break;
			case 'l':
				opts.LOG = self.optarg;
				break;
			case 'h':
				usage();
				return 0;
			default:
				usage();
				return EINVAL;
		}

	// load localfs and mount /etc, so we can access /etc/fstab
	sys.insmod('localfs');
	if (sys.mount('/etc', 'localfs', 'etc', { defaults: true }) < 0) return EGENERIC;

	// mount fstab filesystems
	sys.spawn('/bin/mount.js', ['/bin/mount.js', '-mia', '-l/proc/dmesg']);
	if (wait() !== 0) return EGENERIC;

	// init TTYs
	const dmesg = sys.open(opts.LOG, { WRITE: true, CLOSPAWN: true });
	if (dmesg >= 0) sys.write(dmesg, `initializing TTYs, starting ${opts.CONSOLE_INIT} processes`);

	let i=0, tty;
	while (isatty(undefined, tty = `${opts.TTYPREFIX}${++i}`) === 0) {
		const ret = sys.spawn(opts.CONSOLE_INIT, [opts.CONSOLE_INIT, tty]);
		if (ret < 0 && dmesg >= 0)
			sys.write(dmesg, `failed to spawn ${opts.CONSOLE_INIT}: ${strerror(ret)}`);
	}

	// create tty7
	sys.spawn('/bin/mount.js', ['/bin/mount.js', '-mo', 'defaults,terminal=n', 'tty', '7', `${opts.TTYPREFIX}7`])
	wait();

	// start UI
	const ret = sys.spawn('/bin/startz.js', ['/bin/startz.js', '/dev/dom/ul id="tty7"'])
	if (ret < 0 && dmesg >= 0)
		sys.write(dmesg, `failed to spawn /bin/startz.js: ${strerror(ret)}`);

	// switch to tty7
	const ftty = sys.open('/dev/tty/ftty', { WRITE: true });
	if (ftty < 0) {
		if (dmesg >= 0) sys.write(dmesg, `failed to open /dev/tty/ftty: ${strerror(ftty)}`);
	} else {
		const wret = sys.write(ftty, '7');
		if (wret < 0 && dmesg >= 0) sys.write(dmesg, `failed to write to /dev/tty/ftty: ${strerror(wret)}`);
	}

	// collect dead processes
	for (;;) if (wait() === EGENERIC) return 0;
};
