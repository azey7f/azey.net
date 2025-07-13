import * as sys from '../sys.js';

export function fseek(s, offset, type) {
	if (type !== 'SET' && type !== 'CUR' && type !== 'END') return EINVAL;

	/* Adjust relative offset for unread data in buffer, if any. */
	if (type === 'CUR' && s.rend) offset -= s.rend - s.rpos;

	/* Flush write buffer, and report error on failure. */
	if (s.wpos !== 0) {
		s.ops.write(f, '', 0);
		if (!s.wpos) return EGENERIC;
	}

	/* Leave writing mode */
	s.wpos = s.wend = 0;

	/* Perform the underlying seek. */
	const ret = s.ops.seek(s, offset, type);
	if (ret < 0) return ret;

	/* If seek succeeded, file is seekable and we discard read buffer. */
	s.rpos = s.rend = 0;
	
	return ret;
}
export default fseek;
