import __get_node from './__get_node.js';

export async function umount(pid, target) {
	if (typeof target !== 'string') return EINVAL;

	const node = await __get_node(pid, target);
	if (node < 0) return ret;
	if (node.mounted_on === undefined) return EINVAL;
	if (node.superblock.refs > 0) return EBUSY;

	const ret = await node.superblock.op.__umount(node.superblock.device, node, pid);
	if (ret < 0) return ret;

	node.parent.children[node.name] = node.mounted_on;
	delete window.vfs.superblocks[node.id];
	delete window.vfs.nodes[node.id];

	--node.mounted_on.refs;
	return 0;
}
export default umount;
