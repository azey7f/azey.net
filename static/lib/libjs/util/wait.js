import * as sys from '../sys.js';
import { __sdec } from './__ser.js';

export function wait() {
	const sab = new SharedArrayBuffer(1);
	const pid = sys.wait(sab);
	if (pid < 0) return pid;
	return (new Uint8Array(sab))[0];
}
export default wait;
