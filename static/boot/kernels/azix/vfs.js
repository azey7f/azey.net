import { printk } from './util.js';
import { __insmod } from './module.js';

import __mk_node from './vfs/__mk_node.js';
import __mount_node from './vfs/__mount_node.js';

// init called in start_kernel()
export async function init(root_dev, root_drv, root_opts) {
	await printk('initializing VFS layer');

	// define global encoder/decoder objs
	window.enc = new TextEncoder();
	window.dec = new TextDecoder();

	// vfs.nodes[0] is a super-root node, on which the actual root is created
	// this way mount()/umount() can maintain a ref to the current root mount at vfs.nodes[0].children['/']
	// without needing to handle root any different
	window.vfs = {
		superblocks: [], // indexed by mountpoint node's id
		nodes: [],
	};
	const root = __mk_node('dir', '/', __mk_node('dir'));

	// load rootfs driver
	const iret = await __insmod(await import(`./drivers/${root_drv}.js`));
	if (iret < 0) {
		await printk(`failed to load rootfs driver ${root_drv}: ${iret}`);
		return mret;
	}

	// mount root
	const mret = __mount_node(0, root, root_drv, root_dev, root_opts);
	if (mret < 0)
		await printk(`error mounting root: ${mret}`);
	return mret;
}

export * from './vfs/close.js';
export * from './vfs/mount.js';
export * from './vfs/open.js';
export * from './vfs/path.js';
export * from './vfs/read.js';
export * from './vfs/remove.js';
export * from './vfs/rename.js';
export * from './vfs/reopen.js';
export * from './vfs/dup.js';
export * from './vfs/seek.js';
export * from './vfs/umount.js';
export * from './vfs/write.js';
