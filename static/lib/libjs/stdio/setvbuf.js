self._IOFBF = 'f';
self._IOLBF = 'l';
self._IONBF = 'n';

export function setvbuf(s, buf, type, size) {
	s.iobuf = 'n';

	if (type == _IONBF) {
		s.bufsize = 0;
	} else if (type == _IOLBF || type == _IOFBF) {
		if (buf && size >= 1) {
			s.buf = buf;
			s.bufsize = size;
		}
		if (type == _IOLBF && s.bufsize)
			s.iobuf = 'l';
	} else return EINVAL;

	return 0;
}
export default setvbuf;
