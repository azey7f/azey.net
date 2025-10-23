// module stuff
export const name = "domfs";
export function init() {
	mounts = 0;
	nodes = [];
	dom = create_dom(window.fb);
	return 0;
}
export function exit() {
	if (mounts > 0) throw { message: "module in use" };
	mounts = undefined;
	nodes = undefined;
	dom = undefined;
	return 0;
}

// int count of mounts
let mounts;
// internal representation of the HTML DOM starting at window.fb,
// driver assumes that nothing else ever touches it
// each obj contains type, refs, elem, parent & content (either list of children or u8str)
let dom;
// sparse array of refs to dom object, indexed by VFS node ID
let nodes;

// core functions
export const super_ops = {
	__mount: (device, node) => {
		nodes[node.id] = dom;
		++mounts;
		return 0;
	},
	__remount: () => EIMPL,

	__umount: (device, node) => {
		++mounts;
		recursive_rm(node);
		return 0;
	},
};

export const node_ops = {
	/*__stat: (node) => {
		const n = ensure_node_exists(node);
		if (n < 0) return n;
		return { type: nodes[n.id].type };
	},*/

	__existd: (node) => node.id in nodes && nodes[node.id].type === 'dir',
	__existf: (node) => node.id in nodes && nodes[node.id].type === 'file',

	__creatd: (node) => creat(node, true),
	__creatf: (node) => creat(node, false),

	__removef: (node) => {
		nodes[node.id].elem.remove();
		delete nodes[node.id];
		return 0;
	},
	__removed: (node) => {
		if (nodes[node.id].content.length > 0) return ENOTEMPTY;
		nodes[node.id].elem.remove();
		delete nodes[node.id];
		return 0;
	},

	__renamef: rename,
	__renamed: rename,
}

export const file_ops = {
	__openf: open,
	__opend: open,

	__close: (f) => {
		--nodes[f.node.id].refs;
		return 0;
	},

	__readf: (f, n_bytes) => nodes[f.node.id].content.slice(f.offset, f.offset + n_bytes),
	__readd: (f) => {
		const entr = getentr(nodes[f.node.id].elem);
		if (f.offset >= entr.length) return '';
		return entr[f.offset];
	},

	__write: (f, str) => {
		const buf = window.enc.encode(str);
		const len = f.offset + buf.length;

		const prev = nodes[f.node.id].content;
		if (len > prev.length) {
			nodes[f.node.id].content = new Uint8Array(len);
			nodes[f.node.id].content.set(prev);
		}

		nodes[f.node.id].content.set(buf, f.offset);
		nodes[f.node.id].elem.innerHTML = window.dec.decode(nodes[f.node.id].content);

		f.size = nodes[f.node.id].content.length;
		return buf.length;
	},
}

// used in __creatf & __creatd
function creat(node, dir) {
	// assumes VFS checks if node.parent is actually a dir
	// and that the dir doesn't already exist
	const parent = nodes[node.parent.id];

	const ret = parse_fname(node.name);
	if (ret < 0) return ret;
	const [name, attrs] = ret;

	const elem = document.createElement(name);
	for (const attr in attrs)
		elem.setAttribute(attr, attrs[attr])
	parent.elem.appendChild(elem);

	const n = mknode(elem, parent, dir ? {} : new Uint8Array());
	parent.content[node.name] = n;
	nodes[node.id] = n;
	return 0;
}

// used in __openf & __opend
function open(f, flags) {
	const dnode = nodes[f.node.id];

	if (flags.TRUNCATE) {
		dnode.elem.innerHTML = '';
		dnode.content = new Uint8Array();
	}

	++dnode.refs;
	return nodes[f.node.id].content.length;
}

// used in __renamef & __renamed
function rename(node, new_name, new_parent) {
	const ret = parse_fname(new_name);
	if (ret < 0) return EINVAL;
	const [name, attrs] = ret;

	const elem = document.createElement(name);
	for (const attr in attrs)
		elem.setAttribute(attr, attrs[attr])
	elem.innerHTML = nodes[node.id].elem.innerHTML;

	nodes[node.id].elem.remove();
	nodes[new_parent.id].elem.appendChild(elem);

	nodes[node.id] = mknode(elem, nodes[new_parent.id], nodes[node.id].content);
	return 0;
}

// util
function recursive_rm(node) {
	for (const k in node.children) recursive_rm(node.children[k]);
	delete nodes[node.id];
}

function getentr(elem) {
	let chl = [];
	if (elem.children.length < 0) return -1;
	for (const child of elem.children) {
		let name = child.localName;
		for (const a of child.attributes)
			name += ` ${a.name}="${a.value}"`;
		chl.push(name);
	}
	return chl;
}

function create_dom(elem, parent) {
	const names = getentr(elem);
	if (names < 0) return;

	let obj = mknode(elem, parent);
	if ((names.length > 0 || elem.innerHTML.length == 0) && (new Set(names)).size == names.length) { // no duplicates
		obj.content = {};
		obj.type = 'dir';
		for (let i=0; i < names.length; ++i)
			obj.content[names[i]] = create_dom(elem.children[i], obj);
	} else obj.content = window.enc.encode(elem.innerHTML);
	return obj;
}

function ensure_node_exists(vfs_node) {
	if (!vfs_node) return ENOENT;
	if (vfs_node.id in nodes) return vfs_node;

	const vfs_parent = ensure_node_exists(vfs_node.parent);
	if (vfs_parent < 0) return vfs_parent;
	const parent = nodes[vfs_parent.id];
	if (parent.type != 'dir' || !(vfs_node.name in parent.content)) return ENOENT;

	nodes[vfs_node.id] = parent.content[vfs_node.name];
	return vfs_node;
}

function mknode(elem, parent, content) {
	return {
		refs: 0, type: content instanceof Uint8Array ? 'file' : 'dir',
		elem, parent, content,
	}
}

/*function validate_fname(str) {
	return /^[a-z]+( *[a-z]*="[a-z0-9]*")* *$/.test(str);
}
function parse_fname(str) {
	const [element, ...attrs] = str.match(/(\w+)(.*)/).slice(1);
	const attributes = Object.fromEntries(
		[...attrs.join('').matchAll(/(\w+)=["']?([^"']+)["']?/g)]
		.map([_, name, value] => [name, value])
	);
	return [element, attributes];
}*/

// manual parsing of 'p id="ex"' into ['p', { id: 'ex' }], should be faster than regex maybe?
function parse_fname(str) {
	if (!str) return EINVAL;

	let elem_name = '';
	let attrs = {};

	let i = 0;
	for (;;)
		if (i == str.length) break;
		else if (str.charCodeAt(i) >= 0x61 && str.charCodeAt(i) <= 122) // [a-z]
			elem_name += str[i++];
		else if (str[i] == ' ') break;
		else return EINVAL;
	if (i == 0) return EINVAL;

	for (;;) {
		let attr_name = '';
		let attr_value = '';

		while (++i != str.length && str[i] == ' ');
		if (i == str.length) break;

		for (;;)
			if (i == str.length) return EINVAL;
			else if (str.charCodeAt(i) >= 0x61 && str.charCodeAt(i) <= 122) // [a-z]
				attr_name += str[i++];
			else if (str[i] == '=') break;
			else return EINVAL;
		if (attr_name == '') return EINVAL;
		if (str[++i] != '"') return EINVAL;
		for (;;) {
			if (++i == str.length) return EINVAL;
			else if (
				(str.charCodeAt(i) >= 0x61 && str.charCodeAt(i) <= 0x7a) // [a-z]
				|| (str.charCodeAt(i) >= 0x30 && str.charCodeAt(i) <= 0x39) // [0-9]
				|| str[i] == '-' || str[i] == ' '
			)
				attr_value += str[i];
			else if (str[i] == '"') break;
			else {
				return EINVAL;
			}
		}

		attrs[attr_name] = attr_value;
	}

	return [elem_name, attrs];
}
