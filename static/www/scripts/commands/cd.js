import { sleep, process_path, use_index, set_title } from '../util.js';
import * as out from '../terminal.js';

export const description = "change directory";

export default async (args=[]) => {
	if (args.length > 1) {
		await out.println("Too many args for cd command");
		return;
	} else if (args.length == 0) {
		args = ["~"];
	}

	const path = args[0];
	const processed_path = await process_path(path);

	if (processed_path.endsWith('@')) {
		window.location.href = "https://"+processed_path.slice(processed_path.lastIndexOf("/"),-1);
		return;
	}

	await use_index(processed_path, async (index) => {
		window.history.replaceState(null, "", processed_path+"/");
		window.working_directory = processed_path;
		set_title();
	}, `cd: The directory “${path}” does not exist`);
};
