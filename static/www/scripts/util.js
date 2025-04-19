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
	let index = await fetch(path+"/.index");
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
		await out.print(p.slice(dir_end,-1), { html_open:'<span class="cyan">', html_close:"</span>" });
		await out.println('@')
	} else await out.println(p);
}

export async function process_path(path, is_dir=true, remove_trailing_slashes=true) {
	path = path.trim();

	// special cases
	if (path == ".") { return window.working_directory; }
        if (path.startsWith("~")) { path = path.replace("~", "/root"); }

	// make path absolute
	if (!path.startsWith("/")) { path = `${window.working_directory}/${path}`; }
	path = path.replace(/\/+/g, "/");

	// handle relatives
	while (path.includes("/./")) {
		path = path.replace(/\/\.\//g, "/");
	}
	while (path.includes("..")) {
		path = path.replace(/\/?[^\/]*\/?\.\.\/?/, "/")
	}

        if (is_dir) {
		while (path.endsWith("/.")) { path = path.replace(/\/\.$/, ""); }
		if (remove_trailing_slashes) path = path.replace(/\/+$/, "");
	}

	return path;
}
