import '/lib/libjs/std.js';
import * as sys from '/lib/libjs/sys.js';
import { fflush, print, fprint, getline } from '/lib/libjs/stdio.js';
import { getcwd, getenv, chdir, sleep, wait, strerror, isatty } from '/lib/libjs/util.js';

let ename;

const config = {
	PATH: '/bin', // TODO: /etc/profile?
};

self.main = function(argv) {
	ename = argv[0];
	const paths = config.PATH.split(':');
	const pathenv = [ 'PATH='+config.PATH ]; // TODO: setenv

	const stdin_tty = isatty(STDIN_FILENO);

	for (;;) {
		if (stdin_tty === 0) print_prompt();

		const line = getline(stdin);
		if (line < 0) continue;
		if (line === 0) break;

		const ret = lineparse(line);
		if (ret < 0) {
			err(argv[0], 'invalid command or arguments');
			continue;
		}
		if (!ret.length) continue;

		outer: for (const cmd of ret) {
			const [bin, ...args] = cmd;

			// internal cmds
			if (bin in internal) { internal[bin](args); continue outer; }

			// process bin path
			let binj = bin.endsWith('.js') ? bin : bin+'.js';
			const cmd_argv = [bin].concat(args);

			// start from absolute path
			if (binj.startsWith('/')) {
				if (sys.spawn(binj, cmd_argv, pathenv) >= 0) {
					wait(); continue outer;
				} else continue;
			}

			// start from PATH
			for (const path of paths) {
				if (sys.spawn(`${path}/${binj}`, cmd_argv, pathenv) >= 0) {
					wait(); continue outer;
				};
			}

			err(bin, 'command not found');
			break;
		}
	}

	return 0;
};


function print_prompt() {
	print(`\x1B[96m[\x1B[39m ${getcwd()} \x1B[96m]\x1B[39m > `);
	fflush(stdout);
}

function err(...args) {
	fprint(stderr, args.join(': ')+'\n');
	return -1;
}

function lineparse(argstr) {
	let cmds = [];
	let cmd = 0;
	let arg = 0;

	let inner = 0;
	let escaped = false;
	let str_char = false;
	for (const ch of argstr) {
		if (!(cmd in cmds)) {
			cmds[cmd] = [];
			cmds[cmd].stdin  = stdin;
			cmds[cmd].stdout = stdout;
			cmds[cmd].stderr = stderr;
		}
		if (!(arg in cmds[cmd])) cmds[cmd][arg] = '';
		if (escaped) {
			cmds[cmd][arg] += ch;
			escaped = false;
			continue;
		}
		if (str_char) {
			if (str_char === ch)
				str_char = false;
			else cmds[cmd][arg] += ch;
			continue;
		}
		switch (ch) {
			case '\n':
			case '\t':
			case ' ':
				if (cmds[cmd][arg].length) ++arg;
				break;
			case `"`:
			case `'`: if (arg !== 0) {
				str_char = ch;
				break;
			}
			case '\\': if (arg !== 0) {
				escaped = true;
				break;
			}
			default:
				cmds[cmd][arg] += ch;
				break;
		}
	}
	if (escaped || str_char) return EINVAL;
	return cmds;
}

const internal = {
	cd: (args) => {
		if (args.length > 1) return err(ename, 'cd', 'too many arguments');

		if (args.length === 0)
			return err(ename, 'cd', 'not enough arguments');

		const ret = chdir(args[0]);
		if (ret < 0) err(ename, 'cd', strerror(ret));
	},
	exit: (args) => {
		if (args.length > 1) return err(ename, 'exit', 'too many arguments');
		let ret = 0;
		if (args.length > 0) ret = parseInt(args[0]);
		if (Number.isNaN(ret)) return err(ename, 'exit', args[0], 'invalid integer')
		sys.exit(ret);
	},
	'': () => {},
};
