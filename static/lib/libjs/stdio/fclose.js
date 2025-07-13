import fflush from './fflush.js';
import { __osl_rm } from './__osl.js';

export function fclose(s) {
	let ret = fflush(s);
	ret |= s.ops.close(s);

	__osl_rm(s);
	return ret;
}
export default fclose;
