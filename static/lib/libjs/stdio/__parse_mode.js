// used in fopen() and fdopen()
export const __parse_mode = (mode) => {
	switch (mode) {
		case 'r':  return { READ: true };
		case 'r+': return { READ: true, WRITE: true };
		case 'w':  return { WRITE: true, CREATE: true, TRUNCATE: true, };
		case 'w+': return { READ: true, WRITE: true, CREATE: true, TRUNCATE: true, };
		case 'a':  return { WRITE: true, APPEND: true };
		case 'a+': return { READ: true, WRITE: true, APPEND: true, CREATE: true, };
		default: return EINVAL;
	}
};
export default __parse_mode;
