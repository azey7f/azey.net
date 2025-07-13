import __get_node from './__get_node.js';
import __mk_node from './__mk_node.js';
import __validate_name from './__validate_name.js';

export async function rename(pid, path, new_path) {
	if (typeof path !== 'string' || typeof new_path !== 'string') return EINVAL;
	let node = await __get_node(pid, path);
	if (node < 0) return node;
	return await __rename_node(pid, node, new_path);
}
export default rename;

export async function __rename_node(pid, node, new_path) {
	if (node.refs > 0) return EBUSY;

	const last_slash = new_path.lastIndexOf('/');
	const new_parent = await __get_node(pid, new_path.slice(0, last_slash));
	if (new_parent < 0) return new_parent;
	if (new_parent.superblock.mountpoint.id !== node.superblock.mountpoint.id) return EXDEV;

	const new_name_end = new_path.slice(last_slash+1);
	if (!__validate_name(new_name_end)) return EINVAL;
	if (new_name_end in new_parent.children) return EEXIST;

	let ret;
	if (node.type === 'dir')
		ret = await node.op.__renamed(node, new_name_end, new_parent, pid);
	else
		ret = await node.op.__renamef(node, new_name_end, new_parent, pid);
	if (ret < 0) return ret;

	delete node.parent.children[node.name];
	new_parent.children[new_name_end] = node;
	Object.assign(node, {
		name: new_name_end,
		parent: new_parent,
	});
	return 0;
}
