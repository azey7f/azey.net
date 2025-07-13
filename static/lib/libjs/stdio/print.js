import fwrite from './fwrite.js';

// no formatting since JS has template strings
export function print(str='') {
	if (stdout < 0 || !stdout) return EIO;
	return fwrite(str, stdout);
}
export default print;
