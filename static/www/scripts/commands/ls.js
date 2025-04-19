import { sleep, use_index, process_path } from '../util.js';
import * as out from '../terminal.js';

export const description = "list files";

export default async (args=[]) => {
	if (args.length == 0) { args = [""]; }

	for (const path of args) {
		const processed_path = await process_path(path); 

		if (await use_index(processed_path, async (index) => {
			if (args.length > 1) {
				await out.println(`${path}:`);
			}
			await out.print_all(index, { stoppable:true });
		}) == 1) {
			if (!(await fetch(processed_path)).ok) {
				await out.println(`ls: cannot access '${path}': No such file or directory`);
				continue;
			}

			await out.println(path);
		};

		if (args.length > 1 && path != args[args.length-1]) { out.newline(); }
	}
};
