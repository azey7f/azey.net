import { sleep } from './util.js';
export { sleep };

// vars
const terminal = window.terminal;

// misc
export function newline(spaced=false, nowrap=false) {
	let line = document.createElement("li");

	let classes = [];
	if (spaced) { classes.push("spaced");}
	if (nowrap) { classes.push("nowrap");}
	line.className = classes.join(" "); 

	terminal.append(line);
}

export function get_input() {
	return document.querySelector("ul#terminal > li > span.input");
}

export function clear() {
	terminal.innerHTML = "";
	newline();
	prompt();
	add_styling(get_input());
}

// printing
export async function print(str, {
	delay=3,
	random_delay=0,
	stoppable=false,
	reset_stop=true,
	term_lock=false,
	html_open, html_close,
	stdout
}={}) {
	let success = true;
	if (term_lock) { window.term_locked = true; }

	let line = stdout ? stdout : terminal.lastElementChild;

	for (let i=0; i < str.length; ++i) {
		if (html_open && html_close) {
			line.innerHTML = line.innerText.slice(0, line.innerText.length - i) +
				html_open+str.slice(0, i+1)+html_close;
		} else {
			line.innerHTML += str[i];
		}
		terminal.scrollTop = terminal.scrollHeight;
		if (delay != 0) {
			await sleep(delay + Math.floor(Math.random() * random_delay));
		}
		if (stoppable && window.stop_print) {
			if (reset_stop) window.stop_print = false;
			success = false;
			break;
		}
	}

	if (term_lock) { window.term_locked = false; }
	return success;
}

export async function println(str, {
	delay,
	random_delay,
	spaced=false,
	nowrap=false,
	stoppable=false,
	reset_stop=true,
	term_lock=false,
	html_open, html_close,
	stdout
}={}) {
	if (await print(str, { delay, random_delay, stoppable, reset_stop, term_lock, stdout, html_open, html_close })) {
		newline(spaced, nowrap);
	} else { await println("^C"); return false; }

	return true;
}

export async function print_all(str, {
	delay=0,
	char_delay=5,
	char_random_delay=0,
	spaced=false,
	nowrap=false,
	stoppable=false,
	reset_stop=true,
	term_lock=false,
	html_open, html_close
}={}) {
	if (term_lock) { window.term_locked = true; }

	const arr = Array.isArray(str) ? str : str.split("\n");
	for (var i = 0; i < arr.length; ++i) {
		if (await println(arr[i], {
			delay: char_delay,
			random_delay: char_random_delay,
			spaced, stoppable, reset_stop, nowrap, html_open, html_close
		})) {
			if (delay != 0) { await sleep(delay); }
		} else { return false; }
	}

	if (term_lock) { window.term_locked = false; }
	return true;
}

export async function delete_printed(count=1, { delay=5, random_delay=0 }={}) {
	const line = terminal.lastElementChild;
	for (let i=0; i < count; ++i) {
		line.innerHTML = line.innerHTML.slice(0,-1);

		if (delay != 0) {
			await sleep(delay + Math.floor(Math.random() * random_delay));
		}
	}
}

export function simulate_key(key) {
	terminal.dispatchEvent(new KeyboardEvent("keydown", {key, code:-1}));
}
export async function simulate_typing(str, {
	delay=50,
	random_delay=120
}={}) {
	for (const char of str) {
		simulate_key(char);
		if (delay != 0) {
			await sleep(delay + Math.floor(Math.random() * random_delay));
		}
	}
}

// input
export function prompt() {
	let pwd = window.working_directory.replace(/^\/root/, "~");
	while (pwd.endsWith("/")) { pwd = pwd.slice(0,-1); }
	if (pwd == "") { pwd = "/"; }

	const input = get_input();
	if (input) {
		input.className = "input-history";
		window.cursor_pos = 0;
	}

	terminal.lastElementChild.innerHTML =
		// bash-style:
		// `<span class="prompt">[root@${window.location.hostname}:${pwd}]$ </span><span class="input"></span>`;
		// fish-style:
		`<span class="prompt"><span class="user">root</span>@${window.location.hostname} <span class="dir">${pwd}</span>&gt; </span><span class="input"></span>`;
	terminal.scrollTop = terminal.scrollHeight;
}

export function del(stdout, from, to, cursor_move=null) {
	const str = stdout.innerText;
	stdout.innerText = str.slice(0, from) + str.slice(to);

	if (cursor_move != null) { window.cursor_pos -= cursor_move; }
}

// cursor
export function add_styling(stdout, no_cursor=false) {
	const str = stdout.innerText;
	const char = str.charAt(window.cursor_pos);

	const first_nonwhitespace = str.search(/\S/);
	if (first_nonwhitespace == -1) {
		if (no_cursor) return;
		stdout.innerHTML =
			str.slice(0, window.cursor_pos) +
			'<span id="cursor">' +
			(char != '' ? char : ' ') +
			'</span>' +
			str.slice(window.cursor_pos+1);
	} else {
		const [cmd, ...others] = str.slice(first_nonwhitespace).split(" ");

		const cmd_style = Object.keys(window.commands).includes(cmd.trim()) ? "cmd" : "cmd-unmatched";
		const parts = [
			str.slice(0, first_nonwhitespace),
			`<span class="${cmd_style}">`,
			cmd + " ",
			'</span><span class="args">',
			others.join(" "),
			'</span>',
		];

		if (!no_cursor) {
			let cursor_adjusted = window.cursor_pos;
			for (let i=0; i < parts.length; ++i) {
				if (i%2==0) {
					if (cursor_adjusted >= parts[i].length) {
						cursor_adjusted -= parts[i].length;
					} else {
						parts[i] = parts[i].slice(0, cursor_adjusted) +
							'<span id="cursor">' +
							(char != '' ? char : ' ') +
							'</span>' +
							parts[i].slice(cursor_adjusted+1);
						break;
					}
				}
			}
		}

		stdout.innerHTML = parts.join("");
	}

	if (window.term_selected) { style_cursor(); }
}

export function style_cursor() {
	if (document.getElementById("cursor") == null) return;
	document.getElementById("cursor").className = "s";
}

export function select(event) {
	event.stopPropagation();
	if (window.selection_locked) return;
	if (!window.term_locked) document.getElementById("dummy-input").focus();
	if (!window.term_selected) {
		style_cursor();
		window.term_selected = true;
	}
}
export function deselect() {
	if (window.selection_locked) return;
	if (window.term_selected) {
		window.term_selected = false;
		if (document.getElementById("cursor") != null) document.getElementById("cursor").className = "";
	}
}

terminal.addEventListener("click", select);
document.getElementsByTagName("body")[0].addEventListener("click", deselect);
document.getElementsByTagName("footer")[0].addEventListener("click", deselect);
