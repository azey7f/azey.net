
export function getenv(name) {
	if (!__environ || !name || name.includes('=')) return EINVAL;

	let i = 0;
	for (;__environ[i] && (
		(name != __environ[i].slice(0, name.length))
		|| __environ[i][name.length] != '='); ++i);

	if (__environ[i]) return __environ[i].slice(name.length+1);
	return EGENERIC;
}
export default getenv;
