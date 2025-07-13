export function __validate_name(name) {
	if (name === '.' || name === '..') return false;
	for (const ch of name)
		if (ch === '\0' || ch === '/') {
			return false;
			break;
		}
	return true;
}
export default __validate_name;
