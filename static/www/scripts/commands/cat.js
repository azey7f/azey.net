import { sleep, process_path } from '../util.js';
import * as out from '../terminal.js';

export const description = "read file";

export default async (args=[]) => {
	if (args.length == 0) { return; }

	for (const path of args) {
		const processed_path = await process_path(path);
		const err = `cat: ${path}: No such file or directory`;

		if ((await fetch(processed_path+"/.index")).ok) {
			await out.println(`cat: ${path}: Is a directory`);
			continue;
		}

		const file = await fetch(processed_path);
        	if (!file.ok) { await out.println(err); continue; }
		const file_text = (await file.text()).trim();

		let json;
		try { json = JSON.parse(file_text); }
		catch { await out.print_all(file_text, { stoppable:true }); return; };

		for (const func of json) {
			if (!func.args) { func.args = []; }
			await out[func.f](...func.args);
			if (window.stop_print) {
				window.stop_print = false;
				break;
			}
		}
	}
};
