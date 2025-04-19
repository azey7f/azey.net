import { sleep } from '../util.js';
import * as out from '../terminal.js';
import { descriptions } from './meta.js';

export const description = "list commands";

export default async () => {
	let output = [ "available commands:" ];
	for (const [cmd, desc] of Object.entries(descriptions)) {
		output.push(`${cmd}\t\t(${desc})`);
	}
	output.push(`help\t\t(${description})`);
	await out.print_all(output.join("\n"), { stoppable:true });
};
