export async function __remove_node(pid, node, flags) {
	if (node.refs > 0) return EBUSY;

	if (flags.DIR) {
		if (node.type !== 'dir') return ENOTDIR;
		if (Object.keys(node.children).length > 0) return ENOTEMPTY;

		const ret = await node.op.__removed(node, pid);
		if (ret < 0) return ret;
	} else {
		if (node.type === 'dir') return EISDIR;

		const ret = await node.op.__removef(node, pid);
		if (ret < 0) return ret;
	}

	delete node.parent.children[node.name];
	return 0;
}
export default __remove_node;
