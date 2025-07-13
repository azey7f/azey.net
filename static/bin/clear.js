import '/lib/libjs/std.js';
import { clear, fprint } from '/lib/libjs/stdio.js';

self.main = function(argv) {
	if (argv.length > 1) return fprint(stderr, argv[0]+': too many arguments\n');
	clear();
	return 0;
};
