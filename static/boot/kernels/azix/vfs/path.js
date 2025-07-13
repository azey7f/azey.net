
export function path(node, root_id=window.vfs.nodes[0].children['/'].id) {
	if (node.id === root_id) return '';
	let path = node.name;
	while (node = node.parent) {
		if (node.id === root_id) return path;
		path = `${node.name}/${path}`;
	}
	return EINVAL;
}
export default path;
