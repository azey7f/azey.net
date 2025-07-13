import __get_node from './__get_node.js';
import __mount_node from './__mount_node.js';

export async function mount(pid, target, driver, device, options={ defaults: true }) {
	if (typeof target !== 'string'
	||  typeof driver !== 'string'
	||  typeof device !== 'string'
	||  typeof options !== 'object'
	||  device.includes(' ') || device.includes('\t') || device.includes('\n')
	) return EINVAL;
	if (!window.drivers.hasOwnProperty(driver)) return EBADDRV;

	const node = await __get_node(pid, target);
	if (node < 0) return node;

	if (node.superblock.driver.name === driver && node.superblock.device === device)
		return EEXIST;

	return __mount_node(pid, node, driver, device, options);
}
export default mount;
