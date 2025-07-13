import '/lib/libjs/std.js';
import { print, println } from '/lib/libjs/stdio.js';

const opts = {
	newline: true,
}
self.main = function(argv) {
	const str = [];

        // parse argv
        for (let i=1; i<argv.length; ++i)
		if (opts.newline && argv[i] === '-n') opts.newline = false;
		else str.push(argv[i]);

	if (opts.newline)
		println(str.join(' '));
	else print(str.join(' '));

	return 0;
};
