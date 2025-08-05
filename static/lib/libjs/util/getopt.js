// JS version of https://gist.github.com/attractivechaos/a574727fb687109a2adefcd75655d9ea
// pretty much an exact re-implementation of libc's getopt(), see its man page for usage
// only difference is that this doesn't take argc for obvious reasons

import * as sys from '../sys.js';
import { fprint } from '../stdio/fprint.js';

self.optarg = undefined;
self.optind = 1;
self.opterr = true;
self.optopt = undefined;
self.optpos = 0;
self.optreset = 0;

function __getopt_msg(a, b, c, l) {
	if (!(stderr < 0)) fprint(stderr, a + b + c.slice(0, l) + '\n');
}

export function getopt(argv, optstring) {
	let i, c, d;
	let k;
	let optchar;

	if (!optind || optreset) {
		optreset = 0;
		optpos = 0;
		optind = 1;
	}

	if (optind >= argv.length || !argv[optind]) {
		return EGENERIC;
	}

	if (argv[optind][0] !== '-') {
		if (optstring[0] === '-') {
			optarg = argv[optind++];
			return 1;
		}
		return EGENERIC;
	}

	if (!argv[optind][1]) {
		return EGENERIC;
	}

	if (argv[optind][1] === '-' && !argv[optind][2]) {
		optind++;
		return EGENERIC;
	}

	if (!optpos) optpos++;
	c = argv[optind][optpos];
	k = 1;
	optchar = argv[optind].slice(optpos);
	optopt = c;
	optpos += k;

	if (!argv[optind][optpos]) {
		optind++;
		optpos = 0;
	}

	if (optstring[0] === '-' || optstring[0] === '+') {
		optstring = optstring.slice(1);
	}

	i = 0;
	d = 0;
	do {
		d = optstring[i++];
	} while (i != optstring.length && d !== c);

	if (d !== c) {
		if (optstring[0] !== ':' && opterr) {
			__getopt_msg(argv[0], ": unrecognized option: ", optchar, k);
		}
		return '?';
	}
	if (optstring[i] === ':') {
		if (optstring[i + 1] === ':') optarg = 0;
		else if (optind >= argv.length) {
			if (optstring[0] === ':') return ':';
			if (opterr) __getopt_msg(argv[0], ": option requires an argument: ", optchar, k);
			return '?';
		}
		if (optstring[i + 1] !== ':' || optpos) {
			optarg = argv[optind].slice(optpos);
			optind++;
			optpos = 0;
		}
	}
	return c;
}

function permute(argv, dest, src) {
	let tmp = argv[src];
	for (let i = src; i > dest; i--) {
		argv[i] = argv[i - 1];
	}
	argv[dest] = tmp;
}
