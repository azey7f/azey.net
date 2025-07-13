// linked list, inspired by musl's __ofl
// linked list, inspired by musl's ofl
export let __osl_head;

export function __osl_add(s) {
	s.next = __osl_head;
	if (__osl_head) __osl_head.prev = s;
	return __osl_head = s;
}

export function __osl_rm(s) {
	if (s.prev) s.prev.next = s.next;
	if (s.next) s.next.prev = s.prev;
	if (s == __osl_head) __osl_head = s.next;
	s = undefined;
	return 0;
}
