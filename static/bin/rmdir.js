import '/lib/libjs/std.js';
import * as sys from '/lib/libjs/sys.js';
import { fprint, print, println } from '/lib/libjs/stdio.js';
import { getopt, strerror } from '/lib/libjs/util.js';

const opts = {
};

function usage() {
	println('Usage: rmdir [OPTION]... DIRECTORY...'); // TODO: -p, maybe?
	println('Remove the DIRECTORY(ies), if they are empty.');
	println();
	println('  -h  print usage and exit');
}
self.main = function(argv) {
	const dirs = [];

	// parse argv
	while (self.optind < argv.length)
		switch (getopt(argv, 'h')) {
			case 'h':
				usage();
				return 0;
			default:
				usage();
				return EINVAL;

			case -1:
				dirs.push(argv[self.optind++]);
				break;
		}

	if (dirs.length === 0) {
		usage();
		return EINVAL;
	}

	// remove stuff
	for (let i=0; i<dirs.length; ++i) {
		const ret = sys.remove(dirs[i], { DIR: true });
		if (ret < 0) {
			err(argv[0], dirs[i], strerror(ret));
			continue;
		}
	}

	return 0;
};

function err(...args) {
	fprint(stderr, args.join(': ')+'\n');
}
