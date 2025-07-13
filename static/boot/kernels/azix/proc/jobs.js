export function setsid(pid) {
	if (!is_naturalz(pid)) return EINVAL;
	if ((pid = +pid) in window.pgrp) return EPERM;

	if (window.proc[pid].group)
		delete window.proc[pid].group.proc[pid];

	window.proc[pid].group = __create_group(window.pses[pid] = {
		id: pid, groups: [],
		tty: undefined,
	}, pid, pid);

	return pid;
}

export function setpgid(pid, pgid) {
	if (!is_naturalz(pid) || !is_naturalz(pgid)) return EINVAL;

	if (!((pgid = pgid === 0 ? pid : pgid) in window.pgrp)) {
		// create new group
		delete window.proc[pid].group.proc[pid];
		window.proc[pid].group = __create_group(window.proc[pid].group.session, pid, pgid);
		return pgid;
	}

	// move to existing
	if (window.proc[pid].group.id === pgid) return 0;
	if (!(pgid in window.proc[pid].group.session.groups)) return EPERM;

	delete window.proc[pid].group.proc[pid];
	window.proc[pid].group = window.pgrp[pgid];
	window.pgrp[pgid].proc[pid] = window.proc[pid];

	return pgid;
}

function __create_group(session, pid, pgid) {
	session.groups[pgid] = window.pgrp[pgid] = {
		id: pgid, session,
		proc: [],
	};
	window.pgrp[pgid].proc[pid] = window.proc[pid];

	return window.pgrp[pgid];
}

const is_naturalz = n => n >= 0 && Math.floor(n) === +n;
