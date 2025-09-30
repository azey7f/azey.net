import '/lib/libjs/std.js';
import * as sys from '/lib/libjs/sys.js';
import { fread, fprint, fclose, fflush, print, println, fopen } from '/lib/libjs/stdio.js';
import { getopt, strerror, sleep } from '/lib/libjs/util.js';

const opts = {
	INDEX: '/index.html',
	TTY: undefined,
};

function usage() {
	println('Usage: startz [OPTION]... TTY');
	println('Start the Z Window System on a domfs TTY path (e.g. \'/dev/dom/ul id="tty1"\').');
	println();
	println('  -i <file>  specify file to use as HTML index');
	println('  -h         print usage and exit');
}
self.main = function(argv) {
	const dirs = [];

	// parse argv
	while (self.optind < argv.length)
		switch (getopt(argv, 'i:h')) {
			case 'i':
				opts.INDEX = self.optarg;
				return 0;
			case 'h':
				usage();
				return 0;
			default:
				usage();
				return EINVAL;
			
			case -1:
				if (opts.TTY !== undefined) {
					usage();
					return EINVAL;
				}
				opts.TTY = argv[self.optind++];
				break;
		}

	if (opts.TTY === undefined) {
		usage();
		return EINVAL;
	};

	// read index
	let index = '';
	{
		const findex = fopen(opts.INDEX, 'r');
		if (findex < 0) return err(argv[0], opts.INDEX, 'failed to open', strerror(findex));

		let str;
		while (typeof (str = fread(findex, 1024)) === 'string')
			index += str;

		fclose(findex);
	}

	// extract noscript content
	const matches = Array.from(index.matchAll(/<noscript>\s*(.*)\s*<\/noscript>/gs));
	if (matches.length === 1) index = matches[0][1];

	// open tty elem
	const root = fopen(opts.TTY, 'w');
	if (root < 0) return err(argv[0], opts.TTY, 'failed to open', strerror(root));

	// draw page
	const ret = fprint(root, `<li>${index}</li>`);
	if (ret < 0) return err(argv[0], opts.TTY, 'failed to write', strerror(ret));

	fclose(root);

	// TODO? block 4ever
	sleep(Infinity);
};

function err(...args) {
	fprint(stderr, args.join(': ')+'\n');
}
