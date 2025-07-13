import __get_node_id from './__get_node_id.js'

export function __mk_node(type, name, parent, children={}, refs=0, id=__get_node_id()) {
	return (window.vfs.nodes[id] = {
		type, name, parent, children,
		id, refs,
		op: parent?.op,
		superblock: parent?.superblock,
	});
}
export default __mk_node;
