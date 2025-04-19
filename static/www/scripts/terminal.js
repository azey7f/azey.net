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
	stdout
}={}) {
	if (term_lock) { window.term_locked = true; }

	let line = stdout ? stdout : terminal.lastElementChild;
	for (let i=0; i < str.length; ++i) {
		line.innerText += str[i];
		terminal.scrollTop = terminal.scrollHeight;
		if (delay != 0) {
			await sleep(delay + Math.floor(Math.random() * random_delay));
		}
		if (stoppable && window.stop_print) {
			if (reset_stop) window.stop_print = false;
			return false;
		}
	}

	if (term_lock) { window.term_locked = false; }
	return true;
}

export async function println(str, {
	delay,
	random_delay,
	spaced=false,
	nowrap=false,
	stoppable=false,
	reset_stop=true,
	term_lock=false,
	stdout
}={}) {
	if (await print(str, { delay, random_delay, stoppable, reset_stop, term_lock, stdout })) {
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
	term_lock=false
}={}) {
	if (term_lock) { window.term_locked = true; }

	const arr = str.split("\n");
	for (var i = 0; i < arr.length; ++i) {
		if (await println(arr[i], {
			delay: char_delay,
			random_delay: char_random_delay,
			spaced, stoppable, reset_stop, nowrap
		})) {
			if (delay != 0) { await sleep(delay); }
		} else { return false; }
	}

	if (term_lock) { window.term_locked = false; }
	return true;
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
export function remove_styling(stdout) {
	while (stdout.innerHTML.search(/<span.*>.*<\/span>/) != -1) {
		stdout.innerHTML = stdout.innerHTML.replace(/<span.*?>(.*?)<\/span>/, '$1');
	}
}
export function add_styling(stdout, no_cursor=false) {
	const str = stdout.innerHTML;
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

		const parts = [
			str.slice(0, first_nonwhitespace),
			'<span class="cmd">',
			cmd + " ",
			'</span><span class="args">',
			others.join(" "),
			'</span>',
		];

		if (!no_cursor) {
			let cursor_adjusted = window.cursor_pos-first_nonwhitespace;
			for (let i=2; i < parts.length; ++i) {
				if ([2, 4].includes(i)) {
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
	if (!window.term_locked) document.getElementById("dummy-input").focus();
	if (!window.term_selected) {
		style_cursor();
		window.term_selected = true;
	}
}
export function deselect() {
	if (window.term_selected) {
		window.term_selected = false;
		if (document.getElementById("cursor") != null) document.getElementById("cursor").className = "";
	}
}

terminal.addEventListener("click", select);
document.getElementsByTagName("body")[0].addEventListener("click", deselect);
document.getElementsByTagName("footer")[0].addEventListener("click", deselect);
