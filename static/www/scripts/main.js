import './setup.js';

import { sleep } from './util.js';
import * as util from './util.js';
import * as out from './terminal.js';

import cmds from './commands/meta.js';

// main
(async () => {
	const commands = Object.fromEntries(await Promise.all(
		(cmds.concat([ "help" ])).map(async (f) => [f, (await import(`./commands/${f}.js`)).default])
	));

	const setup_term = async () => {
		// ^ called after setting up event listeners
		util.set_title();
		out.clear();

		if (window.working_directory == "/") {
			window.term_locked = true;
			window.selection_locked = true;
			window.term_selected = true;

			await sleep(500);
			await out.simulate_typing("cd ~");
			out.simulate_key("Enter");

			await sleep(500);
			await out.simulate_typing("help");
			out.simulate_key("Enter");

			window.term_locked = false;
			window.selection_locked = false;
		}
	}

	window.addEventListener("change", (e) => e.preventDefault());
	window.addEventListener("keyup", (e) => e.preventDefault());
	window.addEventListener("input", (e) => e.preventDefault());
	window.addEventListener("keydown", async (event) => {
		if (event.defaultPrevented) { return; } // do nothing if event already processed

		if (window.term_selected) {
			event.preventDefault();

			const dummyinput = document.getElementById("dummy-input");
			dummyinput.blur();
			dummyinput.focus();

			if (window.term_locked && event.code != -1) {
				// event.code == -1 set by out.simulate_typing()
				if (event.ctrlKey && event.key.toLowerCase() == 'c') { window.stop_print = true }
				return;
			}

			let input = out.get_input();
			out.remove_styling(input);

			if (event.key.length == 1) {
				if (!event.ctrlKey) {
					const str = input.innerText;
					input.innerText = str.slice(0, window.cursor_pos) + event.key + str.slice(window.cursor_pos);
					terminal.scrollTop = terminal.scrollHeight;

					++window.cursor_pos;
				} else switch (event.key.toLowerCase()) {
					case 'c': {
						// cancel
						window.history_current = 0;
						out.add_styling(input, true);
						input.innerHTML += '^C';
						out.newline();
						out.prompt();
						break;
					} case 'v': {
						// paste
						const clipboard_content = await navigator.clipboard.readText();
						const str = input.innerText;
						input.innerText = str.slice(0, window.cursor_pos)
							+ clipboard_content
							+ str.slice(window.cursor_pos);
						terminal.scrollTop = terminal.scrollHeight;
						window.cursor_pos += clipboard_content.length;
						break;
					}
				}
			} else {
				switch (event.key) {
					// navigation
					case "ArrowLeft": {
						if (window.cursor_pos > 0) { --window.cursor_pos; }
						break;
					} case "ArrowRight": {
						if (window.cursor_pos < input.innerText.length-1) { ++window.cursor_pos; }
						break;
					} case "Home": {
						window.cursor_pos = 0;
						break;
					} case "End": {
						window.cursor_pos = input.innerText.length-1;
						break;

					// char deletion
					} case "Delete": {
						if (input.innerText.length > 0 && window.cursor_pos < input.innerText.length) {
							out.del(input, window.cursor_pos, window.cursor_pos+1)
						}
						break;
					} case "Backspace": {
						if (input.innerText.length > 0 && window.cursor_pos > 0) {
							out.del(input, window.cursor_pos-1, window.cursor_pos, 1)
						}
						break;

					// cmd history
					} case "ArrowUp": {
						const history = document.getElementsByClassName("input-history");
						if (history.length > window.history_current) {
							if (window.history_current == 0) {
								window.history_saved = input.innerText;
								window.history_cursor_pos = window.cursor_pos;
							}

							input.innerText = history[history.length - ++window.history_current].innerText;
							window.cursor_pos = input.innerText.length-1;
						}
						break;
					} case "ArrowDown": {
						const history = document.getElementsByClassName("input-history");
						if (window.history_current > 1) {
							input.innerText = history[history.length - --window.history_current].innerText;
							window.cursor_pos = input.innerText.length-1;
						} else if (window.history_current == 1) {
							--window.history_current;
							input.innerText = window.history_saved;
							window.cursor_pos = window.history_cursor_pos;
						}
						break;

					// cmd execution
					} case "Enter": {
						window.term_locked = true;
						await out.add_styling(input, true);

						const [cmd, ...args] = input.innerText
							.slice(0, window.cursor_pos)
							.trim()
							.replace(/ +/g, " ")
							.split(" ");
						out.newline();

						if (cmd != "") {
							if (!(cmd in commands)) {
								await out.println(`${cmd}: command not found`);
							} else {
								await commands[cmd](args);
							}
						}

						out.prompt();
						window.term_locked = false;
						window.history_current = 0;
						break;

					// autocomplete
					} case "Tab": {
						let [cmd, ...args] = input.innerText.trim().split(/ +/);
						window.term_locked = true;

						if (
							(args.length == 0 && window.cursor_pos == input.innerText.search(/\s+$/)) ||
							window.cursor_pos - input.innerText.search(/\S|$/) <= cmd.length
						) {
							const command_list = Object.keys(commands);
							if (command_list.includes(cmd)) {

							} else {
								// command autocomplete

								const sliced = cmd.slice(0, window.cursor_pos)
								let [possible_completions, index] = util.autocomplete(sliced, command_list);

								if (possible_completions != null) {
									if (index == 0) {
										// no common autocompletion
										await out.add_styling(input, true);
										out.newline();
										for (const completion of possible_completions) {
											await out.println(sliced+completion, { delay:0 });
										}

										const cursor_pos = window.cursor_pos;
										out.prompt();
										out.get_input().innerText = cmd;
										window.cursor_pos = cursor_pos;
									} else {
										// common substring found, autocomplete!
										input.innerText = sliced + possible_completions[0].substring(0, index)
											+ cmd.slice(window.cursor_pos);
										if (args.length > 0) {  input.innerText += " " + args.join(" "); }
										window.cursor_pos = input.innerText.length;
									}
								}
							}
						} else {
							// path autocomplete

							// get word at position
							// inspired by https://stackoverflow.com/a/58403800
							const str = input.innerText;
							let start = window.cursor_pos;
							let end = window.cursor_pos - 1;
							while (--start >= 0 && !(str[start] == " "));
							while (++end < str.length && !(str[end] == " "));

							const word = str.substring(start, end).trim();

							let path = await util.process_path(word, true, false);
							if (path == null) {
								window.term_locked = false;
								break;
							}

							await util.use_index(path.substring(0, path.lastIndexOf('/')), async (dir_index) => {
								dir_index = dir_index.trim().split(/\r?\n/);
								if (!word.length || dir_index.includes(word)) {
									await out.add_styling(input, true);
									const cursor_pos = window.cursor_pos

									out.newline();
									await commands.ls([word]);
									out.prompt();

									out.get_input().innerText = input.innerText;
									window.cursor_pos = cursor_pos;

									return;
								}

								// only dirs
								if (cmd == "cd") { dir_index = dir_index.filter((p) => p.endsWith("/")); }
								
								path = path.substring(path.lastIndexOf('/')+1);
								const [possible_completions, index] = util.autocomplete(path, dir_index);
								if (possible_completions == null) { return; }

								if (index == 0) {
									// no common autocompletion
									const cursor_pos = window.cursor_pos

									await out.add_styling(input, true);
									out.newline();
									for (const completion of possible_completions) {
										await out.println(path+completion);
									}
									out.prompt();

									out.get_input().innerText = input.innerText;
									window.cursor_pos = cursor_pos;
								} else {
									// common substring found, autocomplete!
									const inner = input.innerText;
									const completion = possible_completions[0].substring(0, index)
									input.innerText = inner.slice(0, end)
										+ completion
										+ inner.slice(end);
									window.cursor_pos = end + completion.length;
								}
							});
						}

						window.term_locked = false;
						break;

					// misc
					} case "Escape": {
						out.add_styling(out.get_input());
						out.deselect();
						return;
					}
				}
			}

			out.add_styling(out.get_input());
		}
	}, true);

	await setup_term();
})();
