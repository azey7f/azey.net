import { printk } from './util.js';
import * as vfs from './vfs.js';

export async function insmod(path) {
	path = path.endsWith('.js') ? path : `/boot/kernels/azix/drivers/${path}.js`;
	const fd = await vfs.open(0, path, { READ: true });
	if (fd === ENOENT) return EBADDRV;
	if (fd < 0) return fd;

	const js = await vfs.read(0, fd, Number.MAX_SAFE_INTEGER);
	if (js < 0) return js;

	await vfs.close(0, fd);

	const url = URL.createObjectURL(new Blob([
		// prepend href+path to import paths, needed since the module is loaded as a blob
                window.dec.decode(js).replaceAll(/(import.*?)'(\..*?)'(;.*?\n)/gs, `$1'${window.location.href}${path.slice(0,path.lastIndexOf('/')+1)}$2'$3`)
	], { type: 'text/javascript' }));
	const mod = await import(url);
	URL.revokeObjectURL(url) // GC objectURL

	try {
		return await __insmod(mod);
	} catch (err) { await printk(`failed to load module ${path}: ${err.message}`); }
	return EGENERIC;
}
export async function __insmod(mod) {
	if (mod.name in window.drivers) return EEXIST;
	mod = Object.assign({}, mod);

	if (mod.depends_on && !Object.values(mod.depends_on).every(driver => driver in window.drivers))
		throw { message: `module ${dep} not loaded` };

	for (const super_op of [ '__mount', '__remount', '__umount' ])
		if (!(super_op in mod.super_ops)) mod.super_ops[super_op] = () => EDRV;

	for (const node_op of [ '__removef', '__removed', '__creatf', '__creatd', '__renamef', '__renamed' ])
		if (!(node_op in mod.node_ops)) mod.node_ops[node_op] = () => EDRV;
	for (const node_op of [ '__existf', '__existd', '__isatty' ])
		if (!(node_op in mod.node_ops)) mod.node_ops[node_op] = () => false;

	for (const file_op of [
		'__openf', '__opend', '__close',
		'__readf', '__readd', '__write'
	]) if (!(file_op in mod.file_ops)) mod.file_ops[file_op] = () => EDRV;

	if (!('depends_on' in mod))
		mod.depends_on = [];
	if (!('read_only' in mod))
		mod.read_only = false;
	if (!('defaults' in mod))
		mod.defaults = {};

	mod.defaults.ro =  mod.read_only;
	mod.defaults.rw = !mod.read_only;

	await mod.init();
	window.drivers[mod.name] = mod;
	await printk(`inserted module ${mod.name}`);
	return 0;
}

export async function rmmod(mod) {
	if (!(mod in window.drivers)) return EINVAL;
	try {
		for (const driver in Object.values(window.drivers))
			if (mod in driver.depends_on)
				throw { message: `module ${driver} depends on ${mod}` };

		await window.drivers[mod].exit();
		delete window.drivers[mod];
		await printk(`removed module ${mod.name}`);
		return 0;
	} catch (err) { await printk(`failed to unload module ${mod}: ${err.message}`); }
	return EGENERIC;
}
