import * as vfs from '../vfs.js';
import * as migrations from './localfs/migrations.js'

/* JS localStorage driver
 *
 * since localStorage can only store strings and serializing everything with JSON.stringify would be expensive,
 * each node has its own key:
 *   '<device>/<path>/' - represents a dir, contains a \0-separated list of entries - the root node is at '<device>/'
 *   '<device>/<path>/<filename>' - represents a file, contains just the file content since azix doesn't really do file attributes
 */

// module stuff
export const name = "localfs";
export function init() {
	mounts = 0;

	// migrations
	if (localStorage.length !== 0) {
		let last_kver = localStorage.getItem('__localfs_kernel_version');
		if (last_kver === null) last_kver = 'v0_0_2';

		for (const [kver, functions] of Object.entries(migrations))
			// semver compare kver > last_kver
			if (kver.localeCompare(last_kver, undefined, { numeric: true, sensitivity: 'base' }) === 1) {
				for (const f of Object.values(functions)) f();
			}

		localStorage.setItem('__localfs_kernel_version', `v${window.config.VERSION.replaceAll('.', '_')}`);
	}

	return 0;
}
export function exit() {
	if (mounts > 0) throw { message: "module in use" };
	mounts = undefined;
	return 0;
}

// int mount count
let mounts;

// core functions
export const super_ops = {
	__mount: (device, node, options) => {
		if (device.includes('/')) return EINVAL;

		const key = device+'/';
		if (localStorage.getItem(key) === null) {
			// doesn't exist, create root node
			// + populate default mounts
			switch (device) {
				default:
					localStorage.setItem(key, '');
					break;
				case 'etc':
					populate_default(key, {
						fstab: [
							'# rootfs is mounted by kernel',
							'# the /etc localfs is mounted by init',
							'none	/proc		procfs	defaults',
							'none	/dev		tmpfs	defaults',
							'none	/dev/sysrq	sysrq	defaults',
							'none	/dev/input	input	defaults',
							'none	/dev/dom	domfs	defaults',
							'0	/dev/tty0	tty	defaults',
							'1	/dev/tty1	tty	defaults',
							'2	/dev/tty2	tty	defaults',
							'3	/dev/tty3	tty	defaults',
							'4	/dev/tty4	tty	defaults',
							'none	/dev/tty	ttyctl	defaults',
							'root	/root		localfs	defaults',
							'',
						].join('\n'),
					});
					break;
				case 'root':
					populate_default(key, {
						["cat.txt"]: [
                                                        "             *     ,MMM8&&&.            *      ",
                                                        "                  MMMM88&&&&&    .             ",
                                                        "                 MMMM88&&&&&&&                 ",
                                                        "     *           MMM88&&&&&&&&                 ",
                                                        "                 MMM88&&&&&&&&                 ",
                                                        "                 'MMM88&&&&&&'                 ",
                                                        "                   'MMM8&&&'      *            ",
                                                        "          |\\___/|     /\\___/\\                  ",
                                                        "          )     (     )    ~( .              ' ",
                                                        "         =\\     /=   =\\~    /=                 ",
                                                        "           )===(       ) ~ (                   ",
                                                        "          /     \\     /     \\                  ",
                                                        "          |     |     ) ~   (                  ",
                                                        "         /       \\   /     ~ \\                 ",
                                                        "         \\       /   \\~     ~/                 ",
                                                        "  jgs_/\\_/\\__  _/_/\\_/\\__~__/_/\\_/\\_/\\_/\\_/\\_  ",
                                                        "  |  |  |  |( (  |  |  | ))  |  |  |  |  |  |  ",
                                                        "  |  |  |  | ) ) |  |  |//|  |  |  |  |  |  |  ",
                                                        "  |  |  |  |(_(  |  |  (( |  |  |  |  |  |  |  ",
							"  |  |  |  |  |  |  |  |\\)|  |  |  |  |  |  |  ",
                                                        "  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  ",
							"",
						].join('\n'),
					});
					break;
			}
		}
		++mounts;
		return 0;
	},
	__remount: () => EIMPL,

	__umount: (device, node) => {
		const key = device+'/';
		if (localStorage.getItem(key) === '')
			localStorage.removeItem(key)
		--mounts;
		return 0;
	},
};

export const node_ops = {
	__existf: (node) => null !== localStorage.getItem(kpath(node)),
	__existd: (node) => null !== localStorage.getItem(kpath(node)+'/'),

	__removef: (node) => {
		parent_rm(node.name, node.parent);
		localStorage.removeItem(kpath(node));
                return 0;
        },
        __removed: (node) => {
		const key = kpath(node)+'/';
                if (localStorage.getItem(key).length > 0) return ENOTEMPTY;
		parent_rm(node.name, node.parent);
		localStorage.removeItem(key);
                return 0;
        },

	__creatf: (node) => {
		localStorage.setItem(kpath(node), '');
		parent_add(node.name, node.parent);
		return 0;
	},
	__creatd: (node) => {
		localStorage.setItem(kpath(node)+'/', '');
		parent_add(node.name, node.parent);
		return 0;
	},

	__renamef: (node, new_name, new_parent) => {
		parent_rm(node.name, node.parent);

		const key = kpath(node);
		localStorage.setItem(kpath(new_parent)+'/'+new_name,
			localStorage.getItem(key)
		);
		localStorage.removeItem(key);

		parent_add(new_name, new_parent);
		return 0;
	},
	__renamed: (node, new_name, new_parent) => {
		parent_rm(node.name, node.parent);

		const key = kpath(node)+'/';
		localStorage.setItem(kpath(new_parent)+'/'+new_name+'/',
			localStorage.getItem(key)
		);
		localStorage.removeItem(key);

		parent_add(new_name, new_parent);
		return 0;
	},
}

export const file_ops = {
	__openf: (f, flags) => {
		const key = kpath(f.node);
		if (flags.TRUNCATE) {
			localStorage.setItem(key, '');
			return 0;
		}
		return localStorage.getItem(key).length;
	},
	__opend: (f, flags) => localStorage.getItem(kpath(f.node)+'/').split('\0').length,

	__close: (f) => 0,

	__readf: (f, n_bytes) => window.enc.encode(localStorage.getItem(kpath(f.node))).slice(f.offset, f.offset+n_bytes),
	__readd: (f) => {
		const keys = localStorage.getItem(kpath(f.node)+'/').split('\0');
		return f.offset < keys.length ? keys[f.offset] : '';
	},

	__write: (f, str) => {
		const key = kpath(f.node);
		const prev = localStorage.getItem(key);
		const content = prev.slice(0,f.offset) + str + prev.slice(f.offset+str.length);
		localStorage.setItem(key, content);
		f.size = content.length;
		return str.length;
	},
}

// util
function populate_default(key, files) {
	localStorage.setItem(key, Object.keys(files).join('\0'));
	for (const [name, content] of Object.entries(files)) {
		if (typeof content === 'object')
			populate_default(`${key}${name}/`, content);
		else localStorage.setItem(key+name, content);
	}
}

function kpath(node) {
	return vfs.path(node, node.superblock.mountpoint.parent.id);
}

function parent_rm(name, parent) {
	const pkey = kpath(parent)+'/';
	localStorage.setItem(pkey, localStorage.getItem(pkey).split('\0').filter(
		k => k !== name
	).join('\0'));
}

function parent_add(name, parent) {
	const pkey = kpath(parent)+'/';
	const cur = localStorage.getItem(pkey);
	localStorage.setItem(pkey, cur.length > 0 ? cur+'\0'+name : name);
}
