import '/lib/libjs/std.js';
import * as sys from '/lib/libjs/sys.js';
import { fopen, fclose, fflush, print, fprint, getline, fread, setvbuf } from '/lib/libjs/stdio.js';
import { getcwd, getenv, chdir, sleep, wait, strerror, fdpath, pipe, isatty, signal } from '/lib/libjs/util.js';

const hostname = self.location.origin.replace(/^https?:\/\//, '');
let home;
let ename;
let fpgid, fldisc;
let cwd;

const config = {
	PATH: '/bin', // TODO: /etc/profile?
};

self.main = function(argv) {
	ename = argv[0];
	home = getenv("HOME");
	if (home < 0) home = '/';
	const paths = config.PATH.split(':');
	//const pathenv = [ 'PATH='+config.PATH ];

	// make self session leader
	const sid = sys.setsid();
	if (sid < 0) return fail(sid, 'setsid');
	// set session's ctty
	{
		const ctty = fdpath(STDIN_FILENO);
		if (ctty < 0) return fail(ctty, 'standard input', 'get fdpath');
		const fctty = sys.open('/dev/tty/ctty', { WRITE: true, CLOSPAWN: true });
		if (fctty < 0) return fail(fctty, '/dev/tty/ctty', 'open');
		const ret = sys.write(fctty, ctty);
		if (ret < 0) return fail(ret, '/dev/tty/ctty', 'write');
		sys.close(fctty);
	}

	// get PID
	const fpid = fopen('/proc/self/pid', 'r');
	if (fpid < 0) return fail(fpid, '/proc/self/pid', 'open');
	const pid = getline(fpid);
	if (pid < 0) return fail(fpid, '/proc/self/pid', 'read');
	fclose(fpid);

	// switch TTY's pgid and keep the FD open for later
	{
		fpgid = sys.open('/dev/tty/pgid', { WRITE: true, CLOSPAWN: true });
		if (fpgid < 0) return fail(fpgid, '/dev/tty/pgid', 'open');
		const ret = sys.write(fpgid, pid.toString());
		if (ret < 0) return fail(ret, '/dev/tty/pgid', 'write');
	}

	// open TTY ldisc for later use
	fldisc = sys.open('/dev/tty/ldisc', { WRITE: true, CLOSPAWN: true });
	if (fldisc < 0) return fail(fldisc, '/dev/tty/ldisc', 'open');

	// check if stdin is a TTY
	const stdin_tty = isatty(STDIN_FILENO) === 0;

	// register signal handlers
	signal('SIGINT', () => {});

	// setup history
	const history = [];
	history.pos = 0;
	history.saved = '';
	history.saved_pos = 0;
	{
		const fhist = fopen(home+'/.azsh_history', 'a+');
		if (fhist < 0) return fail(fhist, home+'/.azsh_history', 'open');

		let cur;
		while (typeof (cur = getline(fhist)) === 'string')
			history[history.pos++] = cur;
		if (cur < 0) return fail(cur, home+'/.azsh_history', 'read');
		fclose(fhist);
	}

	// main loop
	main: for (let ch;;) {
		{ // set TTY line discipline to raw
			const ret = sys.write(fldisc, 'n_null');
			if (ret < 0) return fail(ret, '/dev/tty/ldisc', 'write');
		}

		// get cursor position, if > 0 print newline before prompt
		print('\x1B[6n');
		fflush(stdout);

		// get line
		let line = '';
		chget: for (let pos = 0;;) switch (typeof (ch = getch())) {
			case 'object': // cursor position array, should only occur once
				const [rows, cols] = ch;
				if (cols > 0) print('\n');

				print_prompt();
				break;
			case 'string': // standard single char
				switch (ch) {
					case '\b':
						if (line.length > 0) {
							const right = line.slice(pos--);
							line = line.slice(0,pos) + right;
							print('\b'+right+` \x1B[${right.length+1}D`); // \x1B[nD moves cursor left by n
						}
						break;

					case '\n':
						print('\n');
						fflush(stdout);

						// switch back to canonical ldisc & finish
						const ret = sys.write(fldisc, 'n_tty');
						if (ret < 0) return fail(ret, '/dev/tty/ldisc', 'write');
						break chget;

					case '\x03': // ^C
						print('^C\n');
						continue main;

					default:
						if (ch.charCodeAt() < 32) continue; // don't process non-printable control chars

						const right = ch + line.slice(pos);
						line = line.slice(0,pos) + right;
						print(right+`\x1B[${right.length-1}D`);
						++pos;
						break;
				}
				fflush(stdout);
				break;
			case 'number': // parsed CSI escape sequence
				if (ch < 0) return fail(ch, 'standard input', 'read');
				switch (ch & 0b1111000) {
					case DELETE:
						if (line.length > 0) {
							const right = line.slice(pos+1);
							line = line.slice(0,pos) + right;
							print(right+` \x1B[${right.length+1}D`);
						}
						break;

					// cursor moving
					case LT_ARR:
						if (pos > 0) {
							print('\x1B[D');
							--pos;
						}
						break;
					case RT_ARR:
						if (pos < line.length) {
							print('\x1B[C');
							++pos;
						}
						break;
					case END:
						print(`\x1B[${line.length-pos}C`);
						pos = line.length;
						break;
					case HOME:
						print(`\x1B[${pos}D`);
						pos = 0;
						break;

					// history
					case UP_ARR:
						if (history.pos > 0) {
							if (history.pos === history.length) {
								history.saved = line;
								history.saved_pos = pos;
							}
							// move to start of prompt, print line, remove all right of cursor
							print(`\x1B[${line.length}D${line = history[--history.pos]}\x1B[K`);
							pos = line.length;
						}
						break;
					case DN_ARR:
						if (history.pos < history.length) {
							if (++history.pos === history.length) {
								pos = history.saved_pos;
								// move to start of prompt, print line, remove all right of cursor & move to pos
								print(`\x1B[${line.length}D${line = history.saved}\x1B[K\x1B[${line.length-pos}D`);
							} else {
								print(`\x1B[${line.length}D${line = history[history.pos]}\x1B[K`);
								pos = line.length;
							}
						}
						break;
				}
				fflush(stdout);
				break;
		}

		// add to history
		if (history[history.pos] !== line) {
			history.push(line);

			const fhist = fopen(home+'/.azsh_history', 'a+');
			if (fhist < 0) return fail(fhist, home+'/.azsh_history', 'open');
			const ret = fprint(fhist, line+'\n');
			if (ret < 0) return fail(ret, home+'/.azsh_history', 'write');
			fclose(fhist);
		}
		history.pos = history.length;

		// parse line
		const parsed = lineparse(line);
		if (parsed < 0) {
			err(ename, strerror(parsed));
			continue;
		}
		if (parsed[0] < 0) {
			const [e, ...rest] = parsed;
			err(ename, ...rest, strerror(e));
			continue;
		}
		if (parsed.length === 0) continue;
		//console.log(parsed)

		// parse cmds
		const jobs = [];
		for (const [i, job] of parsed.entries()) {
			jobs[i] = [];
			cmd: for (const cmd of job) {
				//console.log(cmd)
				const [bin, ...args] = cmd;

				// set stdio streams
				/*for (const stream of ['stdin', 'stdout', 'stderr']) {
					if (cmd[stream]) {
					}
				}*/

				// internal cmds
				if (bin in internal) { jobs[i].push({
					f: internal[bin],
					argv: [args],
					stdio: cmd.stdio,
					bg: cmd.bg,
				}); continue cmd; }

				// process bin path
				let binj = bin.endsWith('.js') ? bin : bin+'.js';
				if (binj.startsWith('.')) binj = (cwd === '/' ? '/' : cwd+'/')+binj;
				const cmd_argv = [bin].concat(args);

				if (binj.startsWith('/')) {
					// start from cwd/absolute path
					if (sys.open(binj, { NOOPEN: true }) === 0) {
						jobs[i].push({
							f: spawn,
							argv: [binj, cmd_argv, self.__environ],
							stdio: cmd.stdio,
							bg: cmd.bg,
						});
						continue cmd;
					}
				} else for (const path of paths) {
					// start from PATH
					if (sys.open(`${path}/${binj}`, { NOOPEN: true }) === 0) {
						jobs[i].push({
							f: spawn,
							argv: [`${path}/${binj}`, cmd_argv, self.__environ],
							stdio: cmd.stdio,
							bg: cmd.bg,
						});
						continue cmd;
					}
				}

				err(bin, 'command not found');
				continue main;
			}
		}

		// start processes & wait for all to exit
		for (const job of jobs) {
			spawn_pgid = 0;
			for (const cmd of job) {
				// save stdio & replace with process'
				const stdio = [0,1,2]; //[STDIN_FILENO, STDOUT_FILENO, STDERR_FILENO];
				for (let i=0; i<3; ++i) {
					if (cmd.stdio[i] !== i) {
						sys.reopen(stdio[i] = sys.dup(i), { CLOSPAWN: true }); // save stdio

						// dup and close the old fd, note that since dup() sets CLOSPAWN to false there's no need to manually reset it
						let oldfd = cmd.stdio[i];
						if (oldfd < 3) { // is stdio
							oldfd = stdio[cmd.stdio[i]];
							const newfd = sys.dup(oldfd, i);
							if (oldfd >= 3) {
								sys.close(oldfd);
								stdio[cmd.stdio[i]] = newfd;
							}
						} else {
							sys.dup(oldfd, i);
							sys.close(oldfd);
						}
					}
				}

				cmd.f(...cmd.argv);

				// restore stdio
				for (let i=0; i<3; ++i)
					if (stdio[i] !== i) {
						sys.dup(stdio[i], i);
						sys.close(stdio[i]);
					}
			}
			while (wait() !== EGENERIC);
		}

		// reset foreground group
		sys.write(fpgid, pid.toString());
	}

	return 0;
};

// process stuff
let spawn_pgid;
function spawn(path, argv, envp) {
	const waitsab = new SharedArrayBuffer(4);
	const i32 = new Int32Array(waitsab);

	// spawn process
	const pid = sys.spawn(path, argv, envp, waitsab);
	if (pid < 0) return pid;

	// move process to a separate foreground pgrp
	const pgid = sys.setpgid(pid, spawn_pgid);
	if (!(pgid < 0)) {
		spawn_pgid = pgid;
		sys.write(fpgid, pgid.toString());
	}

	// notify kernel
	Atomics.store(i32, 0, 1);
	Atomics.notify(i32, 0);

	return 0;
}

// helper functions
function fail(e, path, op) {
	err(ename, path, 'failed to '+op, strerror(e));
	return err;
}

function err(...args) {
	fprint(stderr, args.join(': ')+'\n');
	return -1;
}

// TODO: put this into a lib?
let ch_next = '';
self.INSERT = 0b0001000;
self.DELETE = 0b0010000;
self.PAGEUP = 0b0011000;
self.PAGEDN = 0b0011000;
self.UP_ARR = 0b0100000;
self.DN_ARR = 0b0101000;
self.RT_ARR = 0b0110000;
self.LT_ARR = 0b0111000;
self.HOME   = 0b1000000;
self.END    = 0b1001000;

self.SHIFT  = 0b0000001;
self.ALT    = 0b0000010;
self.CTRL   = 0b0000100;
const char_mapping = {
	'A': self.UP_ARR,
	'B': self.DN_ARR,
	'C': self.RT_ARR,
	'D': self.LT_ARR,
	'H': self.HOME,
	'F': self.END,
};
function getch() {
	if (ch_next.length > 0) {
		const ret = ch_next[0];
		ch_next = ch_next.slice(1);
		return ret;
	}

	let ch;
	switch ((ch = fread(stdin, 1))) {
		case '\x1B': // ESC
			if ((ch_next = fread(stdin, 1)) === '[') { // CSI
				ch = '';
				outer: for (;;) switch (ch += (ch_next = fread(stdin, 1))) {
					case '2~': ch = INSERT; break outer;
					case '3~': ch = DELETE; break outer;
					case '5~': ch = PAGEUP; break outer;
					case '6~': ch = PAGEDN; break outer;
					default:
						if (ch_next === 'R') {
							const split = ch.slice(0,-1).split(';');
							let rows, cols;
							if (split.length === 2
							&& Number.isInteger(rows = +split[0])
							&& Number.isInteger(cols = +split[1])
							&& rows >= 0 && cols >= 0
							) {
								ch = [rows, cols];
								break outer;
							}
						} else if (ch_next in char_mapping) switch (ch.length) {
							case 1:
								ch = char_mapping[ch_next]
								break outer;
							case 4:
								// ch should be 1;N where N = ORed self.SHIFT/ALT/CTRL +1
								if (ch.slice(0,2) === '1;'
								&& Number.isInteger(ch = +ch.slice(2,-1))
								&& ch > 1 && ch <= 0b1000) {
									ch = char_mapping[ch_next] | (ch-1);
									break outer;
								}
								break;
						} else continue outer; // TODO: invalid sequence handling?

						ch_next = '['+ch;
						return '\x1B';
				}
				ch_next = '';
			} else return ch;
			break;
	}
	return ch;
}

// shell stuff
function print_prompt() {
	cwd = getcwd();
	if (cwd < 0) cwd = '/';
	if (home !== '/' && cwd.startsWith(home)) cwd = cwd.replace(home, '~');
	print(`\x1B[96mroot\x1B[39m@${hostname} \x1B[96m${cwd}\x1B[39m> `); //\x1B[97m`);
	fflush(stdout);
}

function lineparse(argstr) {
	let cmds = []; // array of arrays of arrays of strings - top-level array represents sequential jobs, sub-arrays represent parallel-running process, sub-sub-arrays contain args for each
	let job = 0;
	let cmd = 0;
	let arg = 0;

	const addch = (ch) => {
		if (!(job in cmds)) cmds[job] = [];
		if (!(cmd in cmds[job])) {
			cmds[job][cmd] = [];
			cmds[job][cmd].stdio = [STDIN_FILENO, STDOUT_FILENO, STDERR_FILENO];
			cmds[job][cmd].bg = false;
		}
		if (!(arg in cmds[job][cmd])) cmds[job][cmd][arg] = '';

		cmds[job][cmd][arg] += ch;
	};

	let inner = 0;
	let escaped = false;
	let str_char = undefined;
	let next_stdin;
	let redirect_in, redirect_out;
	let redirect_out_append;

	const process_redir = () => {
		if (redirect_out !== undefined) {
			if (!(arg in cmds[job][cmd])) return 0;
			if (cmds[job][cmd][arg][0] === '&') { // redirect to FD
				const n = +cmds[job][cmd][arg].slice(1);
				if (!Number.isInteger(n) || n < 0) return [EINVAL, '>'];
				cmds[job][cmd].stdio[redirect_out] = n;
			} else { // redirect to file
				const fd = sys.open(cmds[job][cmd][arg], {
					WRITE: true, APPEND: true, CREATE: true,
					OVERWRITE: !redirect_out_append,
				});
				if (fd < 0) return [fd, `error opening ${cmds[job][cmd][arg]}`];
				cmds[job][cmd].stdio[redirect_out] = fd;
			}
			--cmds[job][cmd].length;
			redirect_out = undefined;
			redirect_out_append = undefined;
		}
		return 0;
	};

	for (const ch of argstr) {
		if (escaped) {
			escaped = false;
			if (str_char === '\'') {
				if (ch !== '\'') addch('\\');
				addch(ch);
			} else switch (ch) {
				case 'e': addch('\x1B'); break; // ESC
				case '0': addch('\0'); break;
				case 'n': addch('\n'); break;
				case 'r': addch('\r'); break;
				default:  addch(ch); break;
			}
			continue;
		}
		if (str_char !== undefined) switch (ch) {
			case str_char:
				str_char = undefined;
				continue;
			case '\\':
				escaped = true;
				continue;
			default:
				addch(ch);
				continue;
		}
		switch (ch) {
			case '\n':
			case '\t':
			case ' ':
				{ const ret = process_redir(); if (ret !== 0) return ret; }
				if (job in cmds && cmd in cmds[job] && arg in cmds[job][cmd]) ++arg;
				break;
			case `"`:
			case `'`:
				str_char = ch;
				break;
			case '\\':
				escaped = true;
				break;
			case '|':
				{ const ret = process_redir(); if (ret !== 0) return ret; }
				if (job in cmds && cmd in cmds[job]) {
					const ret = pipe({ CLOSPAWN: true });
					if (ret < 0) return ret;
					[
						next_stdin,
						cmds[job][cmd++].stdio[1] //STDOUT_FILENO
					] = ret;
					arg = 0;
				} else return [EINVAL, '|'];
				break;
			case '&':
				{ const ret = process_redir(); if (ret !== 0) return ret; }
				if (job in cmds && cmd in cmds[job]) {
					cmds[job][cmd].bg = true;
					++cmd;
					arg = 0;
				} else return [EINVAL, '&'];
				break;
			case ';':
				{ const ret = process_redir(); if (ret !== 0) return ret; }
				if (job in cmds) {
					++job;
					cmd = arg = 0;
				}
				break;
			case '>':
				if (redirect_out !== undefined)
					if (redirect_out_append === undefined) {
						redirect_out_append = true;
						break;
					} else return [EINVAL, '>'];

				if (job in cmds && cmd in cmds[job]) {
					if (arg in cmds[job][cmd]) {
						const n = +cmds[job][cmd][arg];
						if (Number.isInteger(n) && n >= 0) {
							redirect_out = n;
							delete cmds[job][cmd][arg];
							break;
						}
						++arg;
					}
					redirect_out = 1; //STDOUT_FILENO
				} else return [EINVAL, '>'];
				break;
			case '~':
				if (job in cmds && cmd in cmds[job] && !(arg in cmds)) {
					addch(home);
					break;
				}
			default:
				addch(ch)
				if (next_stdin !== undefined) {
					cmds[job][cmd].stdio[0] = next_stdin;
					next_stdin = undefined;
				}
				break;
		}
	}
	if (escaped) return [EINVAL, '\\'];
	if (str_char !== undefined) return [EINVAL, str_char];
	const ret = process_redir();
	if (ret !== 0) return ret;
	return cmds;
}

const internal = {
	cd: (args) => {
		if (args.length > 1) return err(ename, 'cd', 'too many arguments');

		if (args.length === 0)
			args = [home];

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
