import '/lib/libjs/std.js';
import * as sys from '/lib/libjs/sys.js';
import { fprint, print, println } from '/lib/libjs/stdio.js';
import { getopt, strerror } from '/lib/libjs/util.js';

const opts = {
	recursive: false,
};

function usage() {
	println('Usage: rm [OPTION]... FILE...');
	println('Remove the FILE(s).');
	println();
	println('  -r  remove directories and their contents recursively');
	println('  -d  remove empty directories');
	println('  -h  print usage and exit');
}
self.main = function(argv) {
	const files = [];

	// parse argv
	while (self.optind < argv.length)
		switch (getopt(argv, 'rdh')) {
			case 'r':
				opts.recursive = true;
				break;
			case 'd':
				opts.dir = true;
				break;
			case 'h':
				usage();
				return 0;
			default:
				usage();
				return EINVAL;

			case -1:
				files.push(argv[self.optind++]);
				break;
		}

	if (files.length === 0) {
		usage();
		return EINVAL;
	}

	// remove stuff
	for (let i=0; i<files.length; ++i) {
		if (opts.recursive) { // TODO
			err(argv[0], strerror(EIMPL));
			return EIMPL;
			// attempt to open as dir
			/*const fd = sys.open(files[i], { READ: true, DIR: true });
			if (fd !== ENOTDIR) {
				if (fd < 0) {
					err(argv[0], files[i], strerror(fd));
					continue;
				}

			}*/
		}

		const ret = sys.remove(files[i], { DIR: opts.dir });
		if (ret < 0) {
			err(argv[0], files[i], strerror(ret));
			continue;
		}
	}

	return 0;
};

function err(...args) {
	fprint(stderr, args.join(': ')+'\n');
}
