import { printk } from '../util.js';
import * as vfs from '../vfs.js';
import __open_node from '../vfs/__open_node.js';
import { ldisc } from '../tty.js';
import { signal } from '../proc.js';

// module stuff
export const name = "tty";
export const depends_on = [ "input", "domfs" ];
export const defaults = {
	input: '/dev/input',
	domfs: '/dev/dom',
	terminal: 'y', // if false the terminal emulator is disabled, no output is drawn and trying to open READ/WRITE returns EIO
	               // 'y'/'n' instead of true/false because opts are passed as strings and !'false' === false. gods I hate JS
};
export function init() {
	mounts = [];
	buffer = new Array(4096);
	buffer.rpos = buffer.wpos = 0;
	buffer.awaiting = [];

	// selected & input_f is set on first call of mount()
	return 0;
}
export function exit() {
	if (mounts.reduce(m => m+1,0) > 0) throw { message: "module in use" };
	mounts = undefined;
	selected = undefined;
	event_target = undefined;
	if (input_f) vfs.close(0, input_f);
	input_f = undefined;
	buffer = undefined;
	return 0;
}

// sparse array of objects indexed by device (tty index)
let mounts;
// index of currently selected tty
let selected;
let event_target;
export function selected_index() { return selected; }
export function select_tty(i) {
	if (!mounts[i]) return EINVAL;
	return select(i, mounts[i].node);
}
async function select(dev, node) {
	if (dev === selected) return;
	selected = dev;

	if (mounts[dev].options.terminal === 'y') {
		await vfs.close(0, 0); // printk fd
		await __open_node(0, node, { WRITE: true });
	}

	for (const i in mounts)
		await set_hidden(i, +i !== dev);
	//await draw();

	event_target.dispatchEvent(new Event('select'));
	return 0;
}
// FD of options.input
let input_f;
// ring buffer of input events, global across TTYs
let buffer;
// ring buffer impl
function tryadd(item) {
	if (mounts[selected].options.terminal !== 'y') return 0;

	let f;
	while (buffer.awaiting[selected].length > 0 && (f = buffer.awaiting[selected].pop()) === undefined);
	if (f !== undefined) {
		f(item);
		return 0;
	} else if (buffer[buffer.wpos] === undefined) {
		buffer[buffer.wpos++] = item;
		buffer.wpos %= buffer.length;
		return 0;
	}
	return EGENERIC;
}
function tryget() {
	if (buffer[buffer.rpos] !== undefined) {
		const ret = buffer[buffer.rpos];
		delete buffer[buffer.rpos++];
		buffer.rpos %= buffer.length;
		return ret;
	}
	return EGENERIC;
}

// core functions
export const super_ops = {
	__mount: async (device, node, options) => {
		if (!is_naturalz(device)) return EINVAL;

		if (+device === 0) {
			// tty0 is just an alias to the currently selected TTY
			mounts[+device] = { refs: 0 };
			return 0;
		}

		const elem = await vfs.open(0, `${options.domfs}/ul id="tty${+device}"`, { WRITE: true, CREATE: true, TRUNCATE: true });
		if (elem < 0) return elem;

		const controller = options.terminal === 'y' ? new AbortController() : null;
		mounts[+device] = {
			elem, controller,
			options,
			refs: 0, node,
			cursor: 0,

			pgid: undefined,
			ldisc: 'n_tty',

			color_fg: 'w',
			color_bg: 'b',

			width:  ~~(window.fb.offsetWidth/8),   // 8x16 px font, squiggly lines for integer division
			height: ~~(window.fb.offsetHeight/16), // ^ ^^
		};

		if (options.terminal === 'y') {
			mounts[+device].cwidth  = mounts[+device].width  * 3; // see mkempty() func definition
			mounts[+device].cheight = mounts[+device].height * 3;
			mounts[+device].buffer = mkempty(mounts[+device].width * mounts[+device].height);

			buffer.awaiting[+device] = [];

			addEventListener('resize', async (e) => {
				const m = mounts[+device];
				let new_w  = ~~(window.fb.offsetWidth/8);
				let new_h = ~~(window.fb.offsetHeight/16);

				if (new_w !== m.width || new_h !== m.height) {
					m.width = new_w; m.height = new_h;
					m.cwidth = new_w*3; m.cheight = new_h*3;

					const new_buf = m.height * m.width * 3;
					m.cursor = Math.min(m.cursor, new_buf);

					if (m.buffer.length > new_buf) {
						const cutoff = m.buffer.length - new_buf;
						if (m.cursor > m.buffer.length - cutoff)
							m.buffer = m.buffer.slice(cutoff);
						else m.buffer = m.buffer.slice(0, -cutoff);
					} else m.buffer = m.buffer + mkempty((new_buf - m.buffer.length)/3);
					// TODO: properly resize buffer?
					// https://stackoverflow.com/a/60624182, slightly adapted
					/*let lines = [];
					for (let i = 0, l = m.buffer.length; i < l;)
					    lines.push(m.buffer.substring(i, i+=m.width));

					m.buffer = lines.reduce((buf, l) => {
						l = l.trimEnd();
						if (m.width > l.length)
						return buf + l + ' '.repeat(Math.max(0, m.width-l.length));
					}, '');
					*/

					await draw();

					if (m.pgid) signal(-m.pgid, 'SIGWINCH');
				}
			}, { signal: controller.signal });
		}

		if (!selected && options.terminal === 'y') {
			const input = await vfs.open(0, options.input, { READ: true });
			if (input < 0) return EIO;
			input_f = input;
			event_target = new EventTarget(); // used for blocking until select() + cancelling read awaits on close
			await select(+device, node);
			await printk(`printk: console [tty${+device}] enabled`);

			(async () => { // read input events to buffer on separate "thread"
				const echo = (str) => mounts[selected].pgid in window.pgrp ? file_ops.__write(
					{node: {superblock: {device: selected}}},
					str, Object.keys(window.pgrp[mounts[selected].pgid].proc)[0],
				) : undefined;
				for (;;) {
					window.proc[0].files[input_f].offset = 0;
					const ret = await vfs.read(0, input_f, Number.MAX_SAFE_INTEGER);
					if (ret < 0) break;
					const event = JSON.parse(ret);
					if (event.ctrl && !event.alt && !event.shift && !event.meta) {
						switch (event.key.toUpperCase()) {
							case 'C':
								signal(-mounts[selected].pgid, 'SIGINT');
								break;
							case 'Z':
								signal(-mounts[selected].pgid, 'SIGSTP');
								break;
						}
					}
					switch (event.key) {
						case 'Control':
						case 'Shift':
						case 'Meta':
						case 'Alt':
							break;
						default:
							tryadd(event);
							break;
					}
				}
			})();
		} else await set_hidden(device, true);

		return 0;
	},
	__remount: () => EIMPL,

	__umount: async (device, node) => {
		if (+device === selected) return EBUSY;
		if (mounts[+device].controller) mounts[+device].controller.abort();
		const e = await vfs.close(0, mounts[+device].elem);
		if (e < 0) return e;

		if (mounts[+device].options.terminal === 'y') {
			for (let f; buffer.awaiting[+device].length > 0;)
				if ((f = buffer.awaiting[+device].pop()) !== undefined) f(EGENERIC);
			delete buffer.awaiting[+device];
		}
		delete mounts[+device];
		return 0;
	},
};

function exists(node) { return node.id === node.superblock.mountpoint.id; }
export const node_ops = {
	//stat: (node) => { return { type: 'file' }; },
	__existf: exists,
	__isatty: exists,

	__tty_get: (node, attr) => mounts[node.superblock.device][attr] !== undefined
		? mounts[node.superblock.device][attr]
		: EGENERIC,
	__tty_set: (node, attr, value) => {
		mounts[node.superblock.device][attr] = value;
		return 0;
	},
}

export const file_ops = {
	__openf: (f, flags) => {
		if (mounts[+f.node.superblock.device].options.terminal !== 'y' && (flags.READ || flags.WRITE)) return EIO;

		++mounts[+f.node.superblock.device].refs;
		return 0;
	},

	__close: (f, pid) => {
		--mounts[+f.node.superblock.device].refs;
		event_target.dispatchEvent(new CustomEvent('close', { detail: pid }));
		return 0;
	},

	__readf: async (f, n_bytes, pid) => {
		const dev = +f.node.superblock.device === 0
			? selected : +f.node.superblock.device;
		if (!(dev in mounts)) return ENOTTY; // tty0 if nothing else is mounted

		const m = mounts[dev];
		let buf = '';
		for (;;) {
			if (m.pgid && m.pgid in window.pgrp && !(pid in window.pgrp[m.pgid].proc)) {
				signal(-m.pgid, 'SIGTTIN');
				//console.log('SIGTTIN')
				//return EGENERIC; // TODO
			}

			if (dev !== selected) await new Promise((resolve) => { // block until selection
				const controller = new AbortController();
				event_target.addEventListener('select', () => {
					if (dev === selected) {
						resolve();
						controller.abort();
					}
				}, { signal: controller.signal });
			});

			const controller = new AbortController(); // abort reading on selecting another TTY or FD close
			event_target.addEventListener('select', () => {
				controller.abort();
			}, { signal: controller.signal });
			event_target.addEventListener('close', (e) => {
				if (+e.detail === pid) controller.abort();
			}, { signal: controller.signal });

			const ret = await ldisc[m.ldisc](pid, n_bytes,
				buffer.awaiting[dev], tryget,
				(str) => file_ops.__write(f, str, pid),
				controller.signal,
			);
			if (ret < 0) return buf.length > 0 ? buf : ret;
			buf += ret;

			const aborted = controller.signal.aborted;
			controller.abort();
			if (!aborted) break; // finish if reading wasn't aborted
		}
		return buf;
	},

	__write: async (f, buf, pid) => {
		const dev = +f.node.superblock.device === 0
			? selected : +f.node.superblock.device;
		if (!(dev in mounts)) return ENOTTY; // tty0 if nothing else is mounted

		const m = mounts[dev];

		if (m.pgid && (!(m.pgid in window.pgrp) || !(pid in window.pgrp[m.pgid].proc))) {
			//console.log(pid)
			//console.log(m.pgid)
			//console.log(Object.assign([], window.proc[pid].group.proc))
			signal(-m.pgid, 'SIGTTOU');
			//console.log('SIGTTOU')
			//return EGENERIC; // TODO
		}

		if (dev !== selected) {
			if (f.flags.NOBLOCK) return EWOULDBLOCK;
			await new Promise((resolve) => { // block until selection
				const controller = new AbortController();
				event_target.addEventListener('select', () => {
					if (dev === selected) {
						resolve();
						controller.abort();
					}
				}, { signal: controller.signal });
			});
		}

		for (let i = 0; i < buf.length;) {
			const ch = buf[i++];
			outer_switch: switch (ch) {
				// ASCII control chars
				case '\b': {
					m.cursor = Math.max(m.cursor - 3, 0);
					continue;
				} case '\n': {
					if (~~(m.cursor/m.cwidth) === m.height-1)
						m.buffer = m.buffer.slice(m.cwidth) + mkempty(m.width);
					else m.cursor += m.cwidth;
				} case '\r': {
					m.cursor -= m.cursor%m.cwidth;
					continue;

				} case '\t': {
					m.cursor += 24 - (m.cursor%m.cwidth)%24;
					continue;

				} case '\x07': { //^G - BEL
					const context = new AudioContext();
					const oscillator = context.createOscillator();
					oscillator.type = "square";
					oscillator.frequency.value = 1000;
					const gain = context.createGain();
    					gain.gain.value = 0.05;
					oscillator.connect(gain);
    					gain.connect(context.destination);
					oscillator.start();
					// beep for 150ms
					setTimeout(function () {
					    oscillator.stop();
					}, 150);
					continue;


				// ANSI escape sequences
				} case '\x1B': if (buf[i] === '[') {
					let p = [];
					let param = 0;
					const process_p = (defaults=[1]) => {
						const max = Math.max(p.length, defaults.length);
						for (param = 0; param < max; ++param) {
							if (p[param] === undefined)
								p[param] = defaults[param];
							else if (!is_naturalz(p[param]))
								break;
							else p[param] = parseInt(p[param]);
						}
						return param;
					};
					let j = i;
					loop: for (;;) switch (buf[++j]) {
						// Arrows
						case 'A': {
							// moves up by n
							if (process_p() > 1) break outer_switch;
							m.cursor = Math.max(m.cursor - p[0]*m.cwidth, m.cursor%m.cwidth);
							break loop;
						} case 'B': {
							// moves down by n
							if (process_p() > 1) break outer_switch;
							m.cursor = Math.min(
								m.cursor + p[0]*m.cwidth,
								m.buffer.length - (m.cwidth - m.cursor%m.cwidth)
							);
							break loop;
						} case 'C': {
							// moves right by n
							if (process_p() > 1) break outer_switch;
							m.cursor = Math.min(
								m.cursor + p[0]*3,
								(~~(m.cursor/m.cwidth) + 1) * m.cwidth - 3
							);
							break loop;
						} case 'D': {
							// moves left by n
							if (process_p() > 1) break outer_switch;
							m.cursor = Math.max(
								m.cursor - p[0]*3,
								m.cursor - m.cursor%m.cwidth
							);
							break loop;
						
						// Next/prev line
						} case 'E': {
							// moves to next line n times
							if (process_p() > 1) break outer_switch;
							m.cursor = Math.min(
								(~~(m.cursor/m.cwidth) + p[0]) * m.cwidth,
								m.buffer.length - m.cwidth
							);
							break loop;
						} case 'F': {
							// moves to prev line n times
							if (process_p() > 1) break outer_switch;
							m.cursor = Math.max((~~(m.cursor/m.cwidth) - p[0]) * m.cwidth, 0);
							break loop;

						// Cursor to position
						} case 'G': {
							// moves to col n
							if (process_p([0]) > 1) break outer_switch;
							m.cursor -= m.cursor%m.cwidth - Math.min(p[0]*3, m.cwidth-3);
							break loop;
						} case 'H': {
							// moves to row n col m
							if (process_p([0,0]) > 2) break outer_switch;
							m.cursor = Math.min(p[0], m.height-1)*m.cwidth
								 + Math.min(p[1]*3, m.cwidth-1);
							break loop;
						
						//unimplemented: case 'I'

						// Erase
						} case 'J': { // in buffer
							if (process_p([0]) > 1) break outer_switch;
							switch (p[0]) {
								case 0: // all below cursor
									m.buffer = m.buffer.slice(0, m.cursor)
										+ mkempty(~~((m.buffer.length - m.cursor)/3));
									break;
								case 1: // all above cursor
									m.buffer = mkempty(~~(m.cursor/3))
										+ m.buffer.slice(m.cursor);
									break;
								case 2: // whole buf
									m.buffer = mkempty(m.width*m.height);
									m.cursor = 0;
									break;
								default: break outer_switch;
							}
							break loop;
						} case 'K': { // in line
							if (process_p([0]) > 1) break outer_switch;
							switch (p[0]) {
								case 0: { // all right of cursor
									const count = m.cwidth - m.cursor%m.cwidth;
									m.buffer = m.buffer.slice(0, m.cursor)
										+ mkempty(~~(count/3))
										+ m.buffer.slice(m.cursor+count);
									break;
								} case 1: { // all left of cursor
									const count = m.cursor%m.cwidth;
									m.buffer = m.buffer.slice(0, m.cursor - count)
										+ mkempty(~~(count/3))
										+ m.buffer.slice(m.cursor);
									break;
								} case 2: { // whole line
									m.cursor -= m.cursor%m.cwidth;
									m.buffer = m.buffer.slice(0, m.cursor)
										+ mkempty(m.width)
										+ m.buffer.slice(m.cursor+m.cwidth);
									break;
								} default: break outer_switch;
							}
							break loop;
						
						// device status report
						} case 'n': {
							if (process_p() > 1) break outer_switch;
							let str;
							switch (p[0]) {
								case 5: // status report
									str = '\x1B[0n';
									break;
								case 6: // cursor position report
									str = `\x1B[${~~(m.cursor/m.cwidth)};${~~((m.cursor%m.cwidth)/3)}R`;
									break;
								default: break outer_switch;
							}
							for (const ch of str) {
								buffer[buffer.wpos++] = {key: ch};
								buffer.wpos %= buffer.length;
							}
							break loop;

						// colors
						} case 'm': {
							process_p([0]);
							for (const a of p)
								if (a === 39) m.color_fg = 'w';
								else if (a === 49) m.color_bg = 'b';
								else if (a>= 30 && a<= 37) m.color_fg = colors_index[a%10];
								else if (a>= 40 && a<= 47) m.color_bg = colors_index[a%10];
								else if (a>= 90 && a<= 97) m.color_fg = colors_index_b[a%10];
								else if (a>=100 && a<=107) m.color_bg = colors_index_b[a%10];
							break loop;

						// n processing
						} case ';': {
							p[++param] = 0;
							break;
						} default: if (!Number.isNaN(parseInt(buf[j]))) {
							if (param in p)
								p[param] += buf[j];
							else p[param] = buf[j];
							break;
						} else break outer_switch;
					};
					i = j+1;
					continue;
				} else break;
			}
			
			if (ch.charCodeAt() < 32) continue; // don't print non-printable control chars

			m.buffer = m.buffer.slice(0, m.cursor) + ch + m.color_fg + m.color_bg + m.buffer.slice(m.cursor += 3);
			if (m.cursor >= m.buffer.length) {
				m.buffer = m.buffer.slice(m.cwidth) + mkempty(m.width);
				m.cursor -= m.cwidth;
			}
		}

		await draw();
		return buf.length;
	},
}

// util
const is_naturalz = n => n >= 0 && Math.floor(n) === +n;

const escapeHtml = char => {
  return char
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

async function draw() {
	const m = mounts[selected];
	if (m.options.terminal !== 'y') return 0;

	const reopen_promise = vfs.reopen(0, m.elem); // truncate file

	// for some reason pre-wrap only wraps non-whitespace characters,
	// so the buffer needs to be split into <li>s to render properly
	let lines = Array(m.height).fill('');
	for (let i=0, j=0; j < m.height; ++j) {
		let prev_fg='w', prev_bg='b';
		lines[j] += '<span>';
		for (const last = i + m.cwidth; i<last; i+=3) {
			if (m.buffer[i+1] !== prev_fg || m.buffer[i+2] !== prev_bg) {
				prev_fg = m.buffer[i+1];
				prev_bg = m.buffer[i+2];
				lines[j] += `</span><span style="color:${colors[prev_fg]};background-color:${colors[prev_bg]}">`;
			}
			if (i === m.cursor) {
				lines[j] += '<span id="cursor">'
					+ escapeHtml(m.buffer[i])
					+ '</span>';
			} else lines[j] += escapeHtml(m.buffer[i]);
		}
		lines[j] += '</span>';
	}

	/*const y = ~~(m.cursor/m.width);
	if (!lines[y]) return;
	const x = m.cursor%m.width;
	lines[y] = lines[y].slice(0, x)
		+ '<span id="cursor">'
		+ lines[y][x]
		+ '</span>'
		+ lines[y].slice(x+1);*/

	const ret = await reopen_promise;
	if (ret < 0) return ret;
	m.elem = ret;
	await vfs.write(0, m.elem, lines.reduce((acc, line) => acc+'<li>'+line+'</li>', ''));

	return 0;
}

async function set_hidden(dev, hidden) {
	if (+dev === 0) return 0;

	const new_name = `${mounts[dev].options.domfs}/ul id="tty${dev}"${hidden ? ' hidden=""' : ''}`
	const node = window.proc[0].files[mounts[dev].elem].node;
	//console.log(Object.assign({}, node))
	//console.log(Object.assign({}, window.proc[0].files[mounts[dev].elem]))
	//console.log(new_name)
	await vfs.close(0, mounts[dev].elem);

	await vfs.__rename_node(0, node, new_name);

	const elem = await vfs.open(0, new_name, { WRITE: true });

	if (elem < 0) return elem;
	mounts[dev].elem = elem;

	return 0;
}

// char functions
//
// colors (lowercase for normal, uppercase for bright):
// b: black
// r: red
// g: green
// a: blue (think azure, close enough)
// m: magenta
// c: cyan
// w: white
const mkchar  = (char=' ', fg='w', bg='b') => char+fg+bg;
const mkempty = (length) => ' wb'.repeat(length);

const colors = {
	b: '#000',
	r: '#d00',
	g: '#0d0',
	y: '#d50',
	a: '#00d',
	m: '#d0d',
	c: '#0dd',
	w: '#ddd', // 0xD instead of 0xA, since standard VGA colors look horrid on a website

	B: '#555',
	R: '#f55',
	G: '#5f5',
	Y: '#ff5',
	A: '#55f',
	M: '#f5f',
	C: '#5ff',
	W: '#fff',
};

const colors_index   = 'brgyamcw';
const colors_index_b = 'BRGYAMCW';
