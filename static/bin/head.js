import '/lib/libjs/std.js';
import * as sys from '/lib/libjs/sys.js';
import { fprint, getline, fread, fopen, fclose, fdopen, print, println } from '/lib/libjs/stdio.js';
import { getopt, strerror } from '/lib/libjs/util.js';

const opts = {
	bytes: undefined,
	lines: 10,
	rev: false,
};

function usage() {
	println('Usage: head [OPTION]... [FILE]...');
	println('Print the first 10 lines of each FILE to standard output.');
	println('With more than one FILE, precede each with a header giving the file name.');
	println();
	println('With no FILE, or when FILE is -, read standard input.');
	println();
	println('  -c <[-]NUM>          print the first NUM bytes of each file;');
	println("                         with the leading '-', print all but the last");
	println('                         NUM bytes of each file');
	println('  -n <[-]NUM>, -<NUM>  print the first NUM lines instead of the first 10;');
	println("                         with the leading '-', print all but the last");
	println('                         NUM lines of each file');
	println('  -h    print usage and exit');
}
self.main = function(argv) {
	const files = [];

	// parse argv
	while (self.optind < argv.length)
		switch (getopt(argv, 'c:n:h1::2::3::4::5::6::7::8::9::0::')) {
			case 'c':
				if (self.optarg[0] === '-') {
					self.optarg = self.optarg.slice(1);
					opts.rev = true;
				} else opts.rev = false;

				if (!Number.isInteger(opts.bytes = +self.optarg)) {
					err(argv[0], 'invalid number of bytes', self.optarg);
					return EINVAL;
				}
				break;
			case '1':
			case '2':
			case '3':
			case '4':
			case '5':
			case '6':
			case '7':
			case '8':
			case '9':
			case '0':
				self.optarg = self.optarg === 0 ? self.optopt : self.optopt + self.optarg
			case 'n':
				if (self.optarg[0] === '-') {
					self.optarg = self.optarg.slice(1);
					opts.rev = true;
				} else opts.rev = false;

				if (!Number.isInteger(opts.lines = +self.optarg)) {
					err(argv[0], 'invalid number of lines', self.optarg);
					return EINVAL;
				}
				opts.bytes = undefined;
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

	if (files.length === 0) files.push('-');

	// do stuff
	for (let i=0; i<files.length; ++i) {
		let f, fname;
		if (files[i] === '-') {
			f = fdopen(STDIN_FILENO, 'r');
			fname = 'standard input'
		} else {
			f = fopen(files[i], 'r');
			fname = files[i];
		}
                if (f < 0) {
                        err(argv[0], `cannot access ${fname}`, strerror(f));
                        continue;
                }

		if (files.length > 1)
			println(`==> ${fname} <==`);

		if (opts.bytes !== undefined) {
			let str;
			if (!opts.rev) {
				if (typeof (str = fread(f, opts.bytes)) === 'string')
					print(str);
			} else {
				let prev = '';
				while (typeof (str = fread(f, opts.bytes)) === 'string') {
					prev += str;
					if (prev.length > opts.bytes) {
						print(prev.slice(0, prev.length - opts.bytes));
						prev = prev.slice(prev.length - opts.bytes);
					}
				}
			}
			if (str < 0) {
				err(argv[0], `failed to read from ${fname}`, strerror(str));
				continue;
			}
		} else {
			let line;
			if (!opts.rev) {
                		let i=0;
                		while (i++ < opts.lines && typeof (line = getline(f)) === 'string')
                        		print(line);
			} else {
				++opts.lines;
				const last = []; // ring buffer of last opts.lines lines
				last.pos = 0;
                		while (typeof (last[last.pos] = line = getline(f)) === 'string') {
					last.pos = (last.pos+1)%opts.lines;
					if (last.length === opts.lines) // rbuf is full, print the oldest line
                        			print(last[last.pos]);
				}
			}
			if (line < 0) {
				err(argv[0], `failed to read from ${fname}`, strerror(line));
				continue;
			}
		}

                fclose(f);
	}

	return 0;
};

function err(...args) {
	fprint(stderr, args.join(': ')+'\n');
}
