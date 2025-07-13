import fwrite from './fwrite.js';

// no formatting since JS has template strings
export function println(str='') {
	if (stdout < 0 || !stdout) return EIO;
	return fwrite(str+'\n', stdout);
}
export default println;
