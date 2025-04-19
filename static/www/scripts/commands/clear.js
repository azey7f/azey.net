import * as out from '../terminal.js';

export const description = "clear terminal buffer";

export default async () => {
	out.clear();
};
