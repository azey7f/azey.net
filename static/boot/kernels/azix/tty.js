import * as vfs from './vfs.js';
import { signal } from './proc.js';

// line discipline

// sparse array of strs, indexed by process & FD, used when n_bytes is too small
let buffers = [];
const buf_get = (pid, n_bytes) => {
	const ret = buffers[pid].slice(0,n_bytes);
	buffers[pid] = buffers[pid].slice(n_bytes);
	if (buffers[pid] === '')
		delete buffers[pid];
	return ret;
};
const buf_store = (pid, buf, n_bytes) => {
	if (!(pid in buffers)) buffers[pid] = '';
	buffers[pid] += buf.slice(n_bytes);
};
export const ldisc = {
	n_tty: async (pid, n_bytes, awaiting, tryget, echo, asig) => {
		if (pid in buffers)
			return buf_get(pid, n_bytes);

		let buf = '';
		loop: for (;;) {
			const char = to_char(await get(pid, awaiting, tryget, asig));
			if (char < 0) continue;
			const code = char.charCodeAt();
			if (code < 0) continue;

			switch (char) {
				case '\b':
					if (buf.length) {
						await echo(`\b \b`.repeat(
							buf.slice(-1).charCodeAt() < 32 ? 2 : 1
						));
						buf = buf.slice(0,-1);
					} else await echo('\x07');
					continue;
				case '\n':
					buf += '\n';
					await echo('\n');
					break loop;
			}

			let echar = char;
			if (char.length === 1) {
				if (code < 32) echar = `^${String.fromCharCode(code + 0x40)}`;
			} else echar = char.replace(ESC, '^[');

			buf += char;
			await echo(echar);
		}

		if (buf.length > n_bytes)
			buf_store(pid, buf, n_bytes);
		return buf.slice(0,n_bytes);
	},

	n_echo: async (pid, n_bytes, awaiting, tryget, echo, asig) => {
		if (pid in buffers)
			return buf_get(pid, n_bytes);

		const char = to_char(await get(pid, awaiting, tryget, asig));
		if (char < 0) return char;
		if (char.length > n_bytes)
			buf_store(pid, char, n_bytes);

		await echo(char);
		return char.slice(0,n_bytes);
	},

	n_null: async (pid, n_bytes, awaiting, tryget, echo, asig) => {
		if (pid in buffers)
			return buf_get(pid, n_bytes);

		const char = to_char(await get(pid, awaiting, tryget, asig));
		if (char < 0) return char;
		if (char.length > n_bytes)
			buf_store(pid, char, n_bytes);

		return char.slice(0,n_bytes);
	},
};

function get(pid, awaiting, tryget, asig) {
	let ret = tryget();
	if (ret < 0) {
		return new Promise((resolve) => {
			let i = awaiting.push((ret) => resolve(ret)) - 1;
			asig.addEventListener('abort', () => {
				delete awaiting[i];
				resolve(EGENERIC);
			});
		});
	}
	return ret;
}

const ESC = '\x1B';
const CSI = ESC+'[';
const mkprefixed = (final, event) => {
	const n = (event.ctrl << 2) + (event.alt << 1) + (event.shift) + 1;
	return CSI + (n>1 ? '1;'+n.toString()+final : final);
}

function to_char(event) { // should be xterm-like, hopefully
	if (event < 0) return event;

	let key;
	switch (event.key) {
		// ASCII control chars
		case 'Backspace':	key = '\b'; break;
		case 'Enter':		key = '\n'; break;
		case 'Tab':		key = '\t'; break;
		case 'Escape':		key = '\x1B'; break;

		// ANSI cursor controls
		case 'Home':		key = mkprefixed('H', event); break;
		case 'End':		key = mkprefixed('F', event); break;
		case 'ArrowUp':		key = mkprefixed('A', event); break;
		case 'ArrowDown':	key = mkprefixed('B', event); break;
		case 'ArrowRight':	key = mkprefixed('C', event); break;
		case 'ArrowLeft':	key = mkprefixed('D', event); break;

		// Misc keys
		case 'Insert':   key = CSI+'2~'; break;
		case 'Delete':   key = CSI+'3~'; break;
		case 'PageUp':   key = CSI+'5~'; break;
		case 'PageDown': key = CSI+'6~'; break;
	}

	if (key === undefined)
		if (event.key.length === 1) {
			if (event.ctrl && !event.alt && !event.shift && !event.meta) {
				const shift_chars = { '2':64, '6':94, '-':95 };
				let upper = shift_chars[event.key]
					? shift_chars[event.key] : event.key.toUpperCase().charCodeAt();
				if (upper >= 64 && upper <= 96) key = String.fromCharCode(upper - 0x40);
			}
			if (!key) key = event.key;
		} else return EGENERIC;

	return key;
}
