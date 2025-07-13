
export function __towrite(s) {
	if (!s.flags.WRITE) return EBADF;

	// clear read buffer (to quote musl, "easier than summoning nasal demons")
	s.rpos = s.rend = 0;

	// activate writing
	s.wpos = 0;
	s.wend = s.bufsize;

	return 0;
}
export default __towrite;
