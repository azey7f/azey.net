const config = {
	SELECTION_TIMEOUT_S: 3,
};

{
	// get boot options
	let options = JSON.parse((await (await fetch('/boot/kernels/__autoindex.json')).text()))
		.filter(k => k.type !== 'directory')
		.map(k => k.name);
	options.push("cancel boot sequence");

	// setup framebuffer & menu
	let fb = document.createElement("main");
        fb.id = "azloader-framebuffer";
        document.body.append(fb);

	let menu_window = document.createElement("div");
	menu_window.className = "bootmenu";
	fb.appendChild(menu_window);

	let menu = document.createElement("ul");
	menu_window.appendChild(menu);

	let lines = [];
	for (const option of options) {
		let line = document.createElement("li");
		line.innerText = option.replace(/\.js$/, "");
		lines.push(line);
		menu.append(line);
	}

	menu.append(document.createElement("hr"));
	let countdown = document.createElement("p");
	menu.append(countdown);

	let selected = 0;
	lines[0].className = "selected";

	// define boot func
	const input_controller = new AbortController()
	let boot = (kernel) => {
		// cleanup framebuffer & listener, hand over to kernel
		document.body.innerHTML = "";
		input_controller.abort();
		import(`/boot/kernels/${kernel}`);
	}

	// setup boot countdown
	const countdown_controller = new AbortController();
	(new Promise(async (resolve, reject) => {
		let ok = true;

		countdown_controller.signal.addEventListener('abort', () => {
			reject();
			countdown.innerText = "Select boot option";
			ok = false;
		});

		for (let i = config.SELECTION_TIMEOUT_S;; --i) {
			countdown.innerText = `Boot in ${i} s.`;
			if (i > 0) await new Promise(r => setTimeout(r, 1000));
			else break;
			if (!ok) return;
		}

		resolve(options[selected]);
	}).then(boot, ()=>{}));

	// add input event listener
	window.addEventListener("keydown", (event) => {
		if (!countdown_controller.signal.aborted) countdown_controller.abort();
		switch (event.key) {
			case 'ArrowUp':
				if (selected == 0) break;
				lines[selected].className = "";
				lines[--selected].className = "selected";
				break;
			case 'ArrowDown':
				if (selected == options.length-1) break;
				lines[selected].className = "";
				lines[++selected].className = "selected";
				break;
			case 'Enter':
				if (selected == options.length-1) {
					// cancel boot seq
					fb.innerHTML = "";
					input_controller.abort();
				} else boot(options[selected]);
		}
	}, { signal: input_controller.signal });
}
