const config = {
	SELECTION_TIMEOUT_S: 3,
};

{
	// get boot options
	const options = JSON.parse((await (await fetch('/boot/kernels/__autoindex.json')).text()))
		.filter(k => k.type !== 'directory')
		.map(k => k.name);
	options.push("cancel boot sequence");

	// setup framebuffer & menu
	const fb = document.createElement("main");
        fb.id = "azloader-framebuffer";
        document.body.append(fb);

	const menu_window = document.createElement("div");
	menu_window.className = "bootmenu";
	fb.appendChild(menu_window);

	const menu = document.createElement("ul");
	menu_window.appendChild(menu);

	const lines = [];
	for (const option of options) {
		let line = document.createElement("li");
		line.innerText = option.replace(/\.js$/, "");
		lines.push(line);
		menu.append(line);
	}

	menu.append(document.createElement("hr"));
	const countdown = document.createElement("p");
	menu.append(countdown);

	let selected = 0;
	lines[0].className = "selected";

	// define boot func
	const input_controller = new AbortController()
	const boot = () => {
		if (selected == options.length-1) {
			// cancel boot seq
			fb.innerHTML = "";
			input_controller.abort();
		} else {
			// cleanup framebuffer & listener, hand over to kernel
			input_controller.abort();
			document.body.innerHTML = "";
			import(`/boot/kernels/${options[selected]}`);
		}
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

		resolve();
	}).then(boot, ()=>{}));

	// add input/click event listeners
	for (let i=0; i<lines.length; ++i) {
		const select = (event) => {
			event.preventDefault();
			if (!countdown_controller.signal.aborted) countdown_controller.abort();

			lines[selected].className = "";
			lines[selected = i].className = "selected";
		};

		lines[i].addEventListener("touchstart", select, { signal: input_controller.signal });
		lines[i].addEventListener("mousedown", select, { signal: input_controller.signal });

		lines[i].addEventListener("touchend", boot, { signal: input_controller.signal });
		lines[i].addEventListener("mouseup", boot, { signal: input_controller.signal });
	}
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
				boot();
				break;
		}
	}, { signal: input_controller.signal });
}
