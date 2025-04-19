const commands = [
	"ls",
	"cd",
	"cat",
	"clear",
	// "help" not included to prevent infinite recursion on import,
	// instead manually added to this list in main.js
];

export const descriptions = Object.fromEntries(await Promise.all(
	commands.map(async (f) => [f, (await import(`./${f}.js`)).description])
));

export default commands;
