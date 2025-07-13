import __mk_node from './__mk_node.js';

export async function __get_node(pid, path, nofail=false) {
	const p = path.split(/\/+/);

	let current = p[0] === '' // if absolute
		? window.vfs.nodes[0].children['/']
		: window.proc[pid].cwd;

	for (let i=0; i < p.length; ++i) switch (p[i]) {
		case '':
		case '.':
			continue;
		case '..':
			if (current.parent.id !== 0) current = current.parent; // current.parent === 0 => current is /
			break;
		default: switch (current.type) {
			case 'dir':
				if (current.children.hasOwnProperty(p[i])) {
					current = current.children[p[i]];
				} else {
					const node = __mk_node(undefined, p[i], current);

					const is_dir = await current.op.__existd(node, pid);
					if (is_dir) {
						current.children[p[i]] = node;
						current = node;
						current.type = 'dir';
						break;
					}

					const is_f = await current.op.__existf(node, pid);
					if (is_f) {
						current.children[p[i]] = node;
						current = node;
						current.type = 'file';
						break;
					}

					delete window.vfs.nodes[node.id];
					return nofail ? [current, p[i], ENOENT] : ENOENT;
				}
				break;
			default: return nofail ? [current, p[i], ENOTDIR] : ENOTDIR;
		}
	};

	return nofail ? [current] : current;
}
export default __get_node;
