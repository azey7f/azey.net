import '/lib/libjs/std.js';
import * as sys from '/lib/libjs/sys.js';
import { fprint, print, println, fopen, getline } from '/lib/libjs/stdio.js';
import { getopt, strerror } from '/lib/libjs/util.js';

function usage() {
	println('Usage: umount [OPTION]... [DIRECTORY]...');
	println('Unmount filesystems.');
	println();
	println('  -a [<file>]  unmount all filesystems listed in file;');
	println('                 /proc/mounts by default');
	println('  -h           print usage and exit');
}
self.main = function(argv) {
	let dirs = [];

	// parse argv
	const args = [];
	while (self.optind < argv.length)
		switch (getopt(argv, 'a::h')) {
			case 'a':
				const file = self.optarg ? self.optarg : '/proc/mounts';
				const f = fopen(file, 'r');
				if (f < 0) {
					err(argv[0], `failed to open ${file}`, strerror(f));
					return f;
				}

				let line, i=0;
				const fail = (...msg) => {
					err(argv[0], `failed parsing ${file} at line ${i}`, ...msg);
					return EINVAL;
				};

				while (typeof (line = getline(f)) === 'string') {
					++i;

					if ((line = line.trim())[0] === '#') continue; // comment
					const split = line.split(/\s+/);

					if (split.length !== 4) return fail('invalid mount record format');
					if (split[1][0] !== '/') return fail("mount target doesn't start with /", target);

					dirs.push(split[1]);
				}

				if (line < 0) {
					err(argv[0], `failed to read from ${file}`, strerror(line));
					return line;
				}
				break;
			case 'h':
			default:
				usage();
				return EINVAL;

			case -1:
				dirs.push(argv[self.optind++]);
				break;
		}

	// unmount stuff
	for (const dir of dirs) {
		const ret = sys.umount(dir);
		if (ret < 0) {
			err(argv[0], `failed to unmount ${dir}`, strerror(ret));
			continue;
		}
	}

	return 0;
};

function err(...args) {
	fprint(stderr, args.join(': ')+'\n');
}
