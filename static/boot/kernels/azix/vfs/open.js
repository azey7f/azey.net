import __mk_node from './__mk_node.js';
import __get_node from './__get_node.js';
import __open_node from './__open_node.js';
import __validate_name from './__validate_name.js';

export async function open(pid, path, flags={}) {
	if (typeof path !== 'string' || typeof flags !== 'object') return EINVAL;
	const [node, name, err] = await __get_node(pid, path, true);
	if (err !== undefined) {
		if (err === ENOENT && flags.CREATE) {
			if (!__validate_name(name)) return EINVAL;
			const new_node = __mk_node(flags.DIR ? 'dir' : 'file', name, node);

			const ret = await __open_node(pid, new_node, flags);
			if (ret < 0) {
				delete window.vfs.nodes[new_node.id];
				return ret;
			}

			node.children[name] = new_node;
			return ret;
		} else return err;
	}

	return await __open_node(pid, node, flags);
}
export default open;
