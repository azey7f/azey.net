import '/lib/libjs/std.js';
import { open, write, close, spawn, setsid } from '/lib/libjs/sys.js';
import { fopen, fclose, fflush, setvbuf, fprint, print, println, clear, getline } from '/lib/libjs/stdio.js';
import { getopt, sleep, chdir, wait, strerror, isatty } from '/lib/libjs/util.js';

const config = {
	INIT: "/bin/azsh.js",
	HOME: "/root",
	CTTY: undefined,
};

function usage() {
	println('Usage: getty [OPTION]... TTY');
	println('Initialize the TTY (e.g. /dev/tty1) and start login program.');
	println();
	println('  -l <file>  specify login program');
	println('  -H <path>  specify path to use as HOME');
	println('  -h         print usage and exit');
}
self.main = function(argv) {
	while (self.optind < argv.length)
		switch (getopt(argv, 'l:H:h')) {
			case 'l':
				config.INIT = self.optarg;
				break;
			case 'H':
				config.HOME = self.optarg;
				break;
			case 'h':
				usage();
				return 0;
			default:
				usage();
				return EINVAL;

			case -1:
				if (config.CTTY !== undefined) {
					usage();
					return EINVAL;
				}
				config.CTTY = argv[self.optind++];
				break;
		}

	if (config.CTTY === undefined) {
		usage();
		return EINVAL;
	}

	// verify CTTY is actually a TTY
	const istty = isatty(undefined, config.CTTY);
	if (istty < 0) {
		err(argv[0], config.CTTY, strerror(istty));
		return istty;
	}

	// move to a new session
	const sid = setsid();
	if (sid < 0) return sid;

	// set controlling tty
	const ctty = open('/dev/tty/ctty', { WRITE: true });
	if (ctty < 0) {
		err(argv[0], '/dev/tty/ctty', strerror(ctty));
		return ctty;
	}
	const retw = write(ctty, config.CTTY);
	if (retw < 0) return retw;
	const retc = close(ctty);
	if (retc < 0) return retc;

	// get PID
	const fpid = fopen('/proc/self/pid', 'r');
	if (fpid < 0) {
		err(argv[0], '/proc/self/pid', strerror(fpid));
		return fpid;
	}
	const pid = getline(fpid);
	if (pid < 0) return pid;
	fclose(fpid);

	// attempt to open std streams
	self.stdin  = fopen(config.CTTY, 'r');
	self.stdout = fopen(config.CTTY, 'w');
	self.stderr = fopen(config.CTTY, 'w');
	if (stderr >= 0) setvbuf(stderr, undefined, _IONBF, undefined);

	// chdir to HOME
	const ret = chdir(config.HOME);
	if (ret < 0) {
		err(argv[0], config.HOME, strerror(ret));
		return ret;
	}

	let fpgid;
	for (;;) {
		// clear TTY & print welcome message - TODO: motd?
		clear();
		println(`\x1B[96m<<< Welcome to azey.net! - ${config.CTTY} >>>\x1B[39m`);
		println();
		println('This is a web-based Unix-like operating system written in pure static javascript :3');
		println('for more info check out the source at https://git.azey.net/infra/azey.net');
		println();
		// print TTY colors
		for (let c=40; c<=47; ++c)
			print(`\x1B[${c}m  `);
		println();
		for (let c=100; c<=107; ++c)
			print(`\x1B[${c}m  `);
		println('\x1B[39;49m\n');

		// start shell & block until it exits
		spawn(config.INIT, [config.INIT], ['HOME='+config.HOME]);
		if (wait() !== 0) return EGENERIC;

		// reset TTY's pgid
		if (fpgid === undefined) {
			fpgid = open('/dev/tty/pgid', { WRITE: true });
			if (fpgid < 0) return fpgid;
		}
		const retp = write(fpgid, pid.toString());
		if (retp < 0) return retp;
	}

	return 0;
};

function err(...args) {
	fprint(stderr, args.join(': ')+'\n');
}
