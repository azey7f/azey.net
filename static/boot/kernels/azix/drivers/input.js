import { printk } from '../util.js';
import * as vfs from '../vfs.js';

// module stuff
export const name = "input";
export function init() {
	mounts = 0;
	buffers = [];

	controller = new AbortController();

	window.fb.addEventListener('click', select, { signal: controller.signal });

	window.addEventListener('keydown', (event) => {
		if (event.defaultPrevented) return;
		if (event.key.match(/F[0-9]+/)) return; // don't process function keys

		// android keyboard, inputs are processed via textInput
		// android virtual keyboards aren't that great at controlling TTYs, but inputting a command and pressing enter should at least work
		if (event.keyCode === 229) return;

		if (dummy_input) {
			dummy_input.blur();
			dummy_input.focus();
		}

		if (!(event.ctrlKey && event.key === 'c')) // don't prevent copying
			event.preventDefault();

		if (
			event.ctrlKey && !event.shiftKey && !event.metaKey
			&& /^\d$/.test(event.key)
		) {
			if (window.drivers.tty)
				// 1-9 -> 1-9, 0 -> 10
				window.drivers.tty.select_tty(((+event.key)+9)%10+1);
			return;
		}

		for (const buf of buffers)
			if (buf !== undefined) tryadd(buf, window.enc.encode(JSON.stringify({
				alt: event.altKey ? 1 : 0,
				ctrl: event.ctrlKey ? 1 : 0,
				shift: event.shiftKey ? 1 : 0,
				meta: event.metaKey ? 1 : 0,
				key: event.key,
				code: event.keyCode
			})+'\n'));
	}, { signal: controller.signal });

	// android input processing
	window.addEventListener('textInput', (event) => {
		const ret = {
			alt: 0, ctrl: 0,
			shift: 0, meta: 0,
			key: event.data,
			keyCode: event.data.charAt(),
		};
		if (ret.code <= 90 && ret.code >= 65) { // is uppercase letter
			ret.shift = 1;
			ret.key = ret.key.toLowerCase();
			ret.code += 0x20;
		}

		for (const buf of buffers)
			if (buf !== undefined) tryadd(buf, window.enc.encode(JSON.stringify(ret)+'\n'));
	}, { signal: controller.signal });
	return 0;
}
export async function exit() {
	if (mounts > 0) throw { message: "module in use" };
	mounts = undefined;
	buffers = undefined;
	controller.abort();
	controller = undefined;
	dummy_input = undefined;
	await vfs.remove(0, dummy_input_path);
	return 0;
}

// int mount count
let mounts;
// ring buffers of events, one per process
let buffers;
function tryadd(buf, item) {
	let f;
	while (buf.awaiting.length && (f = buf.awaiting.pop()) === undefined);

	if (buf[buf.wpos] === undefined) {
		buf[buf.wpos++] = item;
		buf.wpos %= buf.length;
		if (f === undefined) return 0;
	}

	if (f !== undefined) {
		f(item);
		return 0;
	}
	return EGENERIC;
}
function tryget(buf) {
	if (buf[buf.rpos] !== undefined) {
		const ret = buf[buf.rpos];
		delete buf[buf.rpos++];
		buf.rpos %= buf.length;
		return ret;
	}
	return EGENERIC;
}
// input event listener abort
let controller;
// dummy input element, used to make the virtual keyboard appear on mobile
let dummy_input;
const dummy_input_path = '/dev/dom/input id="dummy-input" type="text"';

// core functions
export const super_ops = {
	__mount: async (device, node) => {
		++mounts;
		return 0;
	},
	__remount: () => EIMPL,

	__umount: (device, node) => {
		--mounts;
		return 0;
	},
};

export const node_ops = {
	__existf: (node) => node.superblock.mountpoint.id === node.id,
	//stat: (node) => { return { type: 'file' }; },
}

export const file_ops = {
	__openf: (f, flags, pid) => {
		if (flags.WRITE) return EINVAL;

		if (!buffers[pid]) {
			buffers[pid] = new Array(4096);
			buffers[pid].refs = 1;
			buffers[pid].wpos = buffers[pid].rpos = 0;
			// LIFO array of functions to be called in tryadd()
			buffers[pid].awaiting = [];
		}

		return 0;
	},

	__close: (f) => {
		if (--buffers[pid].refs === 0) delete buffers[pid];
		return 0;
	},

	__readf: (f, n_bytes, pid) => new Promise((resolve) => {
		const buf = buffers[pid];

		const try_ret = (offset) => {
			if (buf[buf.rpos]?.length > n_bytes-f.offset) {
				// partial read
				const ret = buf[buf.rpos].slice(offset, offset+n_bytes);
				resolve(ret);
				return;
			}

			let ret = tryget(buf);
			if (ret < 0) {
				if (f.flags.NOBLOCK) return resolve(EWOULDBLOCK);

				const offset = f.offset;
				buf.awaiting.push(() => try_ret(offset));
			} else {
				// final read, move offset back to 0
				f.offset -= ret.length;
				resolve(ret.slice(offset, offset+n_bytes));
			}
		}

		try_ret(f.offset);
	}),
}

// util
async function select(event) {
	if (event) event.stopPropagation();
	if (window.getSelection().type === "Range") return;

	if (!dummy_input) {
		if (!(await vfs.open(0, dummy_input_path, { CREATE: true, NOOPEN: true, }) < 0))
			dummy_input = document.getElementById("dummy-input");
	}

	dummy_input.focus();
}
