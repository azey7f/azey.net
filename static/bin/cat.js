import '/lib/libjs/std.js';
import * as sys from '/lib/libjs/sys.js';
import { strerror } from '/lib/libjs/util.js';
import { fprint, print, println, fopen, fdopen, fclose, fread } from '/lib/libjs/stdio.js';

self.main = function(argv) {
	if (argv.length === 1) argv.push('-');
	for (let i=1; i<argv.length; ++i) {
		const f = argv[i] === '-' ? fdopen(STDIN_FILENO, 'r') : fopen(argv[i], 'r');
		if (f < 0) {
			err(argv[0], `cannot access ${argv[i]}`, strerror(f));
			continue;
		}

		let str;
		while (typeof (str = fread(f, 1024)) === 'string')
			print(str);

		if (str < 0) err(argv[0], `failed to read from ${argv[i]}`, strerror(str));

		fclose(f);
	}
	return 0;
};

function err(...args) {
	fprint(stderr, args.join(': ')+'\n');
}
