import __towrite from './__towrite.js';
import { __senc } from '../util/__ser.js';
import { __osl_head } from './__osl.js';

export function fflush(s) {
	if (!s) {
		let ret = 0;
		for (s=__osl_head; s; s=s.next)
			if (s.wpos != s.wend) ret |= fflush(s);
		return ret;
	}
	if (!s.flags) return EINVAL;

	/* If writing, flush output */
	if (s.wpos != s.wend) {
		s.ops.write(s, '', 0);
		if (!s.wpos) return EGENERIC;
	}

	/* If reading, sync position, per POSIX */
	if (s.rpos != s.rend) s.ops.seek(s, s.rpos-s.rend, 'CUR');

	/* Clear read and write modes */
	s.wpos = s.wend = 0;
	s.rpos = s.rend = 0;

	return 0;
}
export default fflush;
