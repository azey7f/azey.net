import getdelim from './getdelim.js';

export function getline(s, bufsize=32) {
	return getdelim(s, 0xA, bufsize);
}
export default getline;
