export function __get_node_id() {
	let id = -1;
	while (window.vfs.nodes[++id]);
	return id;
}
export default __get_node_id;
