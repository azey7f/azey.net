import '/lib/libjs/std.js';
import * as sys from '/lib/libjs/sys.js';
import { fprint, print, println } from '/lib/libjs/stdio.js';
import { getopt, strerror } from '/lib/libjs/util.js';

const opts = {
	parents: false,
};

function usage() {
	println('Usage: mkdir [OPTION]... DIRECTORY...');
	println('Create the DIRECTORY(ies), if they do not already exist.');
	println();
	println('  -p  no error if existing, make parent directories as needed');
	println('  -h  print usage and exit');
}
self.main = function(argv) {
	const dirs = [];

	// parse argv
	while (self.optind < argv.length)
		switch (getopt(argv, 'ph')) {
			case 'p':
				opts.parents = true;
				break;
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

	/*if (opts.parents) {
		err(argv[0], strerror(EIMPL));
		return EIMPL;
	}*/

	// do stuff
	for (let i=0; i<dirs.length; ++i) {
		// check for existence
		const ret = sys.open(dirs[i], { DIR: true, NOOPEN: true });
		switch (ret) {
			case 0:
				if (!opts.parents) err(argv[0], dirs[i], 'already exists');
				continue;
			case ENOTDIR:
				err(argv[0], dirs[i], 'is a file');
				continue;
			case ENOENT:
				break;
			default:
				err(argv[0], dirs[i], strerror(ret));
				continue;
		}

		// create
		const cret = sys.open(dirs[i], { DIR: true, CREATE: true, NOOPEN: true });
		if (cret < 0) {
			err(argv[0], dirs[i], strerror(cret));
			continue;
		}
	}

	return 0;
};

function err(...args) {
	fprint(stderr, args.join(': ')+'\n');
}
