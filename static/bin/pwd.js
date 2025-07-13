import '/lib/libjs/std.js';
import { print, println } from '/lib/libjs/stdio.js';
import { getcwd } from '/lib/libjs/util.js';

self.main = function(argv) {
	if (argv.length > 1) return err(argv[0], 'too many arguments');

	println(getcwd());

	return 0;
};


function err(...args) {
	fprint(stderr, args.join(': ')+'\n');
	return -1;
}
