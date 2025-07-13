import __mk_node from './__mk_node.js';
import __get_node from './__get_node.js';

export async function __mount_node(pid, node, driver, device, options={ defaults: true }) {
	if (node.type !== 'dir')
		return ENOTDIR;

	if (options.defaults === true)
                options = Object.assign({}, window.drivers[driver].defaults, options);
        if (
                (typeof options.rw !== 'boolean' && typeof options.ro !== 'boolean')
                || options.rw === options.ro
        ) return EINVAL;
        if (options.rw && window.drivers[driver].read_only) return EROFS;
	delete options.defaults;

	driver = window.drivers[driver];

	// create new node
	const mount = __mk_node('dir', node.name, node.parent);

	mount.superblock = window.vfs.superblocks[mount.id] = {
		driver, device, options,
		op: driver.super_ops,
		mountpoint: mount,
		refs: 0,
	};
	mount.op = driver.node_ops;
	mount.mounted_on = node;

	// call FS func
	const ret = await driver.super_ops.__mount(device, mount, options, pid);
	if (ret < 0) {
		delete window.vfs.nodes[mount.id];
		return ret;
	}

	// housekeeping
	node.parent.children[node.name] = mount;
	++mount.refs; // mountpoint nodes are created with 1 ref, so stuff like remove() returns EBUSY
	++node.refs;  // prevent removing underlying node if mounted

	return 0;
}
export default __mount_node;
