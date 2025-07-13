
export function __toread(s) {
	if (!s || !s.flags || !s.flags.READ) return EBADF;

	if (s.wpos != s.wend) s.ops.write(s, '', 0);
	s.wpos = s.wend = 0;

	if (s.rend == s.rpos)
		s.rpos = s.rend = s.bufsize;
	return 0;
}
export default __toread;
