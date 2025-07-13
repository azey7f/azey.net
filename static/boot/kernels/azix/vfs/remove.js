import __get_node from './__get_node.js';
import __remove_node from './__remove_node.js';

export async function remove(pid, path, flags={}) {
	if (typeof path !== 'string') return EINVAL;
	let node = await __get_node(pid, path);
	if (node < 0) return node;
	return await __remove_node(pid, node, flags);
}
export default remove;
