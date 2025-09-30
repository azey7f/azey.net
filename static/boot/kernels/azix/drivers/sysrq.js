import { printk } from '../util.js';
import { signal } from '../proc.js';

// module stuff
export const name = "sysrq";
export function init() {
	mounts = 0;
	return 0;
}
export async function exit() {
	if (mounts > 0) throw { message: "module in use" };
	mounts = undefined;
	return 0;
}

// int mount count
let mounts;

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
}

export const file_ops = {
	__openf: (f, flags) => {
		if (flags.READ) return EINVAL;
		return 0;
	},
	__close: (f) => 0,
	
	__write: (f, str) => {
		switch (str.trim()) {
			case 'o': // shutdown - kills all processess except PID 1 (which should then shut down by itself)
				for (const i in window.proc)
					if (i > 1) signal(i, "SIGKILL");
				break;
		}
		return str.length;
	},
}
