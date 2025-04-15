// constants
const terminal = document.getElementById("terminal");
const prompt = "[root@azey.net:~]$ ";

// util
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function blink_cursor() {
	let line = terminal.lastElementChild;
	line.innerHTML += '_';
	await sleep(500);
	line.innerHTML = line.innerHTML.slice(0,-1);
	return sleep(500);
}
async function blink_cursor_secs(seconds) {
	for (let i=0; i < seconds; ++i) { await blink_cursor(); }
}

function newline(unspaced=false) {
	let line = document.createElement("p");
	line.className = unspaced ? "terminal-line unspaced" : "terminal-line";
	terminal.append(line);
}

async function print(str, delay=50, random_delay=120) {
	let line = terminal.lastElementChild;
	for (let i=0; i < str.length; ++i) {
		line.innerHTML += str[i];
		terminal.scrollTop = terminal.scrollHeight;
		if (delay != 0) {
			await sleep(delay + Math.floor(Math.random() * random_delay));
		}
	}
}

async function println(str, delay, random_delay, unspaced) {
	await print(str, delay, random_delay);
	newline(unspaced);
}

async function print_all(str, delay=500, print_delay=80, print_random_delay=0, unspaced=false) {
	let arr = str.split("\n");
	for (var i = 0; i < arr.length; ++i) {
		await println(arr[i], print_delay, print_random_delay, unspaced);
		if (delay != 0) { await sleep(delay); }
	}
}

// main
(async () => {
	newline();
	terminal.lastElementChild.innerHTML = prompt;
	await blink_cursor_secs(3);
	await println("cat ./the-freedom-song.txt");
	await blink_cursor();

	await print_all(`
	In the depths of despair,
	
	Where hope seems to fade,
	
	I sing a song of freedom,
	
	That will never be swayed.
	
	I sing of a world beyond bars,
	
	Of endless skies and open roads,
	
	Of dreams that come true,
	
	And burdens that are unloads.
	
	I sing of the power of the human spirit,
	
	To overcome any obstacle,
	
	To rise above any challenge,
	
	And to never give up on what is possible.
	
	So join me in this song,
	
	My friends, my fellow souls,
	
	Let us sing of freedom,
	
	And make our spirits whole.

	~ Raegan Butcher
	`);

	await print_all(`
	⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
	⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣾⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
	⠀⠀⠀⠀⠀⠀⠀⠀⢀⣼⣿⣧⣶⣶⣶⣦⣤⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀
	⠀⠀⠀⠀⠀⠀⣠⣾⢿⣿⣿⣿⣏⠉⠉⠛⠛⠿⣷⣕⠀⠀⠀⠀⠀⠀⢀⡀
	⠀⠀⠀⠀⣠⣾⢝⠄⢀⣿⡿⠻⣿⣄⠀⠀⠀⠀⠈⢿⣧⡀⣀⣤⡾⠀⠀⠀
	⠀⠀⠀⢰⣿⡡⠁⠀⠀⣿⡇⠀⠸⣿⣾⡆⠀⠀⣀⣤⣿⣿⠋⠁⠀⠀⠀⠀
	⠀⠀⢀⣷⣿⠃⠀⠀⢸⣿⡇⠀⠀⠹⣿⣷⣴⡾⠟⠉⠸⣿⡇⠀⠀⠀⠀⠀
	⠀⠀⢸⣿⠗⡀⠀⠀⢸⣿⠃⣠⣶⣿⠿⢿⣿⡀⠀⠀⢀⣿⡇⠀⠀⠀⠀⠀
	⠀⠀⠘⡿⡄⣇⠀⣀⣾⣿⡿⠟⠋⠁⠀⠈⢻⣷⣆⡄⢸⣿⡇⠀⠀⠀⠀⠀
	⠀⠀⠀⢻⣷⣿⣿⠿⣿⣧⠀⠀⠀⠀⠀⠀⠀⠻⣿⣷⣿⡟⠀⠀⠀⠀⠀⠀
	⢀⣰⣾⣿⠿⣿⣿⣾⣿⠇⠀⠀⠀⠀⠀⠀⠀⢀⣼⣿⣿⣅⠀⠀⠀⠀⠀⠀
	⠀⠰⠊⠁⠀⠙⠪⣿⣿⣶⣤⣄⣀⣀⣀⣤⣶⣿⠟⠋⠙⢿⣷⡄⠀⠀⠀⠀
	⠀⠀⠀⠀⠀⠀⢀⣿⡟⠺⠭⠭⠿⠿⠿⠟⠋⠁⠀⠀⠀⠀⠙⠏⣦⠀⠀⠀
	⠀⠀⠀⠀⠀⠀⢸⡟⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
	⠀⠀⠀⠀⠀⠀⠀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
	`, 0, 5, 0, true);

	await sleep(150);
	await print(prompt, 0, 0);
	while (true) { await blink_cursor(); }
})();
