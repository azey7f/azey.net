// module stuff
export const name = "tmpfs";
export function init() {
	mounts = 0;
	nodes = [];
	return 0;
}
export function exit() {
	if (mounts > 0) throw { message: "module in use" };
	mounts = undefined;
	nodes = undefined;
	return 0;
}

// int mount count
let mounts;
// sparse array of objects indexed by VFS node ID
// each object contains type, also content if file or link
let nodes;

// core functions
export const super_ops = {
	__mount: (device, node, options) => {
		nodes[node.id] = {
			type: 'dir',
			name: node.name,
		};
		++mounts;
		return 0;
	},
	__remount: () => EIMPL,

	__umount: (device, node) => {
		--mounts;
		recursive_rm(node);
		return 0;
	},
};

const remove = (node) => {
	delete nodes[node.id];
	return 0;
}
export const node_ops = {
	__removef: remove,
	__removed: remove,

	__existf: (node) => node.id in nodes && nodes[node.id].type === 'file',
	__existd: (node) => node.id in nodes && nodes[node.id].type === 'dir',

	/*stat: (node) => {
		if (!nodes[node.id]) return ENOENT;
		const type = nodes[node.id].type;
		return type ? { type } : ENOENT;
	},*/

	__creatf: (node) => {
		nodes[node.id] = {
			type: 'file',
			name: node.name,
			content: '',
		};
		return 0;
	},
	__creatd: (node) => {
		nodes[node.id] = {
			type: 'dir',
			name: node.name,
		};
		return 0;
	},

	__renamef: (node, new_name, new_parent) => 0,
	__renamed: (node, new_name, new_parent) => 0,
}

export const file_ops = {
	__openf: (f, flags) => {
		if (flags.TRUNCATE) nodes[f.node.id].content = '';
		return nodes[f.node.id].content.length;
	},
	__opend: (f, flags) => f.node.children.length,

	__close: (f) => 0,

	__readf: (f, n_bytes) => nodes[f.node.id].content.slice(f.offset, f.offset+n_bytes),
	__readd: (f) => {
		const keys = Object.keys(f.node.children);
		return f.offset < keys.length ? keys[f.offset] : '';
	},

	__write: (f, str) => {
		const prev = nodes[f.node.id].content;
		nodes[f.node.id].content = prev.slice(0,f.offset) + str + prev.slice(f.offset+str.length);
		f.size = nodes[f.node.id].content.length;
		return str.length;
	},
}

// util
function recursive_rm(node) {
	for (const k in node.children) recursive_rm(node.children[k]);
	delete nodes[node.id];
}
