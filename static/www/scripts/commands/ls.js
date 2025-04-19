import { sleep, use_index, process_path, print_path } from '../util.js';
import * as out from '../terminal.js';

export const description = "list files";

export default async (args=[]) => {
	if (args.length == 0) { args = [""]; }

	for (const path of args) {
		const processed_path = await process_path(path); 

		if (await use_index(processed_path, async (index) => {
			if (args.length > 1) await out.println(`${path}:`);

			for (const p of index.split("\n")) await print_path(p); 
		}) == 1) {
			if (
				path.endsWith('@')
				? (await fetch(processed_path.slice(0,-1))).status != 403
				: !(await fetch(processed_path)).ok
			) {
				await out.println(`ls: cannot access '${path}': No such file or directory`);
				continue;
			}

			await print_path(path);
		};

		if (args.length > 1 && path != args[args.length-1]) { out.newline(); }
	}
};
