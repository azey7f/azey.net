import * as out from "./terminal.js";

// misc
export async function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function set_title() {
	const path = (window.working_directory.startsWith("/root")
		? window.working_directory.replace("/root", "~")
		: window.working_directory
	).replace(/\/+$/, "");
	document.title = `${window.location.hostname}:${path.length ? path : "/"}`;
}

export function autocomplete(str, completions) {
	const possible_completions = completions
		.filter((c) => c.startsWith(str))
		.map((c) => c.slice(str.length))
		.sort();

	if (possible_completions.length == 0) { return [null]; }

	// get common substring
	const first = possible_completions[0];
	const last = possible_completions[possible_completions.length - 1];
	const length = first.length;
	let index = 0;
	while (index<length && first[index] === last[index]) { ++index; }

	// index = common substring len
	return [possible_completions, index];
}

// .index file functions
export async function use_index(path, success_func, err) {
	let index = await fetch(path+".index");
	if (index.ok) { return await success_func((await index.text()).trim()); }

	if (err) { await out.println(err); }
	return 1;
}

// path operations
export async function print_path(p) {
	if (p.endsWith('/')) {
		await out.print(p.slice(0,-1), { html_open:'<span class="blue">', html_close:"</span>" });
		await out.println('/')
	} else if (p.endsWith('@')) {
		const dir_end = p.lastIndexOf('/') + 1;
		await out.print(p.slice(0,dir_end));
		await out.print(p.slice(dir_end,-1), {
			html_open:`<a class="cyan" href="https://${p.slice(dir_end,-1)}">`,
			html_close:"</a>"
		});
		await out.println('@')
	} else await out.println(p);
}

export async function process_path(path, remove_trailing_slashes=true) {
	path = path.trim();

	let processed_path;
	switch (path.charAt()) {
		case '/':
			processed_path = "/";
			path = path.slice(1);
			break;
		case '~':
			processed_path = "/root/";
			path = path.slice(1);
			break;
		default:  processed_path = window.working_directory; break;
	}

	const p = path.split('/');
	for (let i=0; i < p.length; ++i) {
		let new_path;
		switch (p[i]) {
			case '':
			case '.':
				continue;
			case '..': {
				if (processed_path == "/") continue;
				new_path = processed_path.slice(0, processed_path.lastIndexOf('/', processed_path.length-2));
				break;
			} default: new_path = processed_path + p[i]; break;
		}

		const is_dir = (await fetch(new_path + "/.index")).ok;
		if (!is_dir && i == p.length-1) {
			/*
			if (!(await fetch(new_path)).ok || i != p.length-1) {
				// path doesn't exist or goes through a file
				// TODO: error handling
				processed_path = new_path + '/';
			} else {
				processed_path = new_path;
			}*/
			processed_path = new_path;
		} else processed_path = new_path + '/';
	}

	return processed_path;
}
