import '/lib/libjs/std.js';
import * as sys from '/lib/libjs/sys.js';
import { __sdec } from '/lib/libjs/util/__ser.js'; // TODO: make this an actual part of the lib
import { fprint, print, println } from '/lib/libjs/stdio.js';
import { getopt, strerror } from '/lib/libjs/util.js';

const opts = {
	all: false,
	long: false,
	single: false,
	recursive: false,
};

function usage() {
	println('Usage: ls [OPTION]... [FILE]...');
	println('List information about the FILEs (the current directory by default).');
	println();
	println('  -a  do not ignore entries starting with .');
	println('  -l  use a long listing format');
	println('  -1  list one file per line');
	println('  -R  list subdirectories recursively');
	println('  -h  print usage and exit');
}
self.main = function(argv) {
	let entries = [];

	// parse argv
	while (self.optind < argv.length)
		switch (getopt(argv, 'al1Rh')) {
			case 'a':
				opts.all = true;
				break;
			case 'R':
				opts.recursive = true;
				break;
			case 'l':
				//opts.long = true;
				opts.single = true;
				break;
			case '1':
				opts.single = true;
				break;
			case 'h':
				usage();
				return 0;
			default:
				usage();
				return EINVAL;
			
			case -1:
				entries.push(argv[self.optind++]);
				break;
		}

	// sort entries, add cwd if none
	entries = entries.length ? entries.sort() : ['.'];

	// separate entries, print files
	let first_printed = false;
	let files_count = 0;
	const dirs = [];

	for (const ent of entries) {
		// try opening as dir
		const d = sys.open(ent, { DIR: true, READ: true });
		if (d === ENOTDIR) {
			// is a file
			print_entry(ent);
			first_printed = true;
			++files_count;
		} else if (d < 0) {
			err(argv[0], `cannot access '${ent}'`, strerror(d));
		} else dirs.push([ent, d]);
	}
	if (files_count > 0 && !opts.single && !opts.long) println();

	// print dirs
	let sab_cur_size = 32;
	let sab = new SharedArrayBuffer(sab_cur_size, { maxByteLength: 1073741824 });
	for (let i=0; i<dirs.length; ++i) {
		let cur = 0;
		if (opts.recursive || dirs.length + files_count > 1) {
			if (first_printed)
				println();
			else first_printed = true;

			println(`${dirs[i][0]}:`);
		}
		const to_print = [];
		for (;;) {
			const cnt = sys.read(dirs[i][1], sab, sab_cur_size);
			if (cnt === EINVAL) {
				sab.grow(sab_cur_size *= 2);
				continue;
			}
			if (cnt < 0) {
				err(argv[0], `error listing '${dirs[i][0]}'`, strerror(cnt));
				break;
			}
			if (cnt === 0) break;

			let name = __sdec(sab, cnt);
			if (name[0] === '.' && !opts.all) continue;

			const fullname = dirs[i][0] === '/' ? '/'+name : `${dirs[i][0]}/${name}`;

			// check if dir
			const d = sys.open(fullname, { DIR: true, READ: true, NOOPEN: !opts.recursive });

			if (d !== ENOTDIR) {
				if (d < 0) {
					err(argv[0], `cannot access '${fullname}'`, strerror(d));
					continue;
				}
				if (opts.recursive) dirs.splice(i + ++cur, 0, [fullname, d]);
				name = name+'/';
			}

			to_print.push(name);
		}
		for (const name of to_print.sort())
			print_entry(name);
		if (!opts.single && !opts.long) println();
	}

	return 0;
};

function err(...args) {
	fprint(stderr, args.join(': ')+'\n');
}

function str_escape(str) {
	const seg = [];

	let has_special = false;
	let prev = 0, cur = 0;
	while (cur < str.length) switch (str[cur++]) {
		case '\'':
			seg.push(str.slice(prev, (prev = cur)-1) + '\'\\');
		case ' ':
		case '\t':
		case '\"':
			has_special = true;
			break;
	}
	seg.push(str.slice(prev));

	let is_dir = false;
	if (seg[seg.length-1].endsWith('/')) {
		seg[seg.length-1] = seg[seg.length-1].slice(0,-1);
		is_dir = true;
	}
	str = has_special ? seg.map(str => `'${str}'`).join('') : seg.join('');

	return is_dir ? '\x1B[94m'+str+'\x1B[39m/' : str;
}

function print_entry(ent) {
	if (opts.long) {
		return EIMPL;
	} else return print(str_escape(ent) + (opts.single ? '\n' : '  '));
}
