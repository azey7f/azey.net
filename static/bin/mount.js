import '/lib/libjs/std.js';
import * as sys from '/lib/libjs/sys.js';
import { fprint, print, println, fopen, getline, fread } from '/lib/libjs/stdio.js';
import { getopt, strerror } from '/lib/libjs/util.js';

const opts = {
	all: false,
	insmod: false,
	log: undefined,
	mkdir: false,
}

function usage() {
	println('Usage: mount [OPTION]... [DRIVER [DEVICE] DIRECTORY]');
	println('Mount the DEVICE at DIRECTORY using DRIVER.');
	println();
	println('  -a [<file>]  mount all filesystems mentioned in file');
	println('                 /etc/fstab by default');
	println("  -i           automatically load FS driver if it isn't loaded already");
	println("  -l <file>    log mounting to file, won't fail if it doesn't exist");
	println("  -m           create target directory if it doesn't exist");
	println('  -o <list>    comma-separated list of mount options');
	println('  -h           print usage and exit');
}
self.main = function(argv) {
	const args = [];
	const options = {};
	const mounts = [];

	// parse argv
	while (self.optind < argv.length)
		switch (getopt(argv, 'a::il:mo:h')) {
			case 'a':
				opts.all = true;

                                const file = self.optarg ? self.optarg : '/etc/fstab';
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
					const [device, target, driver, m_options] = split;

                                        if (split.length !== 4) return fail('invalid mount record format');
                                        if (target[0] !== '/') return fail("mount target doesn't start with /", target);

                                        mounts.push([driver, device, target, parse_options(m_options)]);
                                }

                                if (line < 0) {
                                        err(argv[0], `failed to read from ${file}`, strerror(line));
                                        return line;
                                }
                                break;
			case 'i':
				opts.insmod = true;
				break;
			case 'l':
				opts.log = optarg;
				break;
			case 'm':
				opts.mkdir = true;
				break;
			case 'o':
				Object.assign(options, parse_options(self.optarg));
				break;
			case 'h':
				usage();
				return 0;
			default:
				usage();
				return EINVAL;

			case -1:
				args.push(argv[self.optind++]);
				break;
		}

	switch (args.length) {
		case 2:
			mounts.push(args[0], 'none', args[1], options);
			break;
		case 3:
			mounts.push([...args, options]);
			break;
		case 0:
			if (!opts.all) {
				const f = fopen('/proc/mounts', 'r');
				if (f < 0) {
                                        err(argv[0], 'failed to open /proc/mounts', strerror(f));
					return f;
				}

				let str;
                                while (typeof (str = fread(f, 1024)) === 'string')
					print(str);

				if (str < 0) {
                                        err(argv[0], 'failed to read from /proc/mounts', strerror(str));
                                        return str;
				}

				return 0;
			} else break;
		default:
			usage();
			return EINVAL;
	}

	// mount
	let log;
	for (const [driver, device, target, m_options] of mounts) {
		for (;;) {
			if (opts.insmod) sys.insmod(driver);

			const ret = sys.mount(target, driver, device,
				Object.keys(m_options).length > 0 ? m_options : { defaults: true }
			);

			if (ret === ENOENT && opts.mkdir)
				if (sys.open(target, { DIR: true, CREATE: true, NOOPEN: true }) === 0) continue;

			if (opts.log !== undefined && (log === undefined || log < 0))
				log = fopen(opts.log, 'w');

			if (ret === EEXIST) break;
			if (ret < 0) {
				err(argv[0], strerror(ret));
				if (!(log < 0))
					fprint(log, `failed mounting ${driver} on ${target}: ${strerror(ret)}\n`);
				break;
			}

			if (!(log < 0))
				fprint(log, `mounted ${driver} on ${target}\n`);
			break;
		}
	}

	return 0;
};

function err(...args) {
	fprint(stderr, args.join(': ')+'\n');
}

function parse_options(opts) {
	const options = [];
	for (const opt of opts.split(',')) {
		const iof = opt.indexOf('=');
		options.push(iof === -1
			? [opt, true]
			: [opt.slice(0,iof), opt.slice(iof+1)]
		);
	}
	return Object.fromEntries(options);
}
