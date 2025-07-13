import fwrite from './fwrite.js';
import fflush from './fflush.js';

// not a libc function, but eh whatevs
export function clear() {
	if (stdout < 0 || !stdout) return EIO;
	let ret = fwrite('\x1B[H\x1B[J', stdout);
	return ret | fflush(stdout);
}
export default clear;
