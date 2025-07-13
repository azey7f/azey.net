import __syscall from './__syscall.js';

export const exit   = code => __syscall('exit', code);

// process stuff
export const setsid  = ()		=> __syscall('setsid');
export const setpgid = (pid, pgid)	=> __syscall('setpgid', pid, pgid);
export const signal  = (sig, handler)	=> __syscall('signal', sig, handler);
export const wait    = (sab)		=> __syscall('wait', sab);
export const spawn   = (path, argv, envp, waitsab) => __syscall('spawn', path, argv, envp, waitsab);

// files
export const open   = (path, flags)			=> __syscall('open', path, flags);
export const remove = (path, flags)			=> __syscall('remove', path, flags);
export const reopen = (fd, flags)			=> __syscall('reopen', fd, flags);
export const dup    = (oldfd, newfd)			=> __syscall('dup', oldfd, newfd);
export const close  = (fd)				=> __syscall('close', fd);
export const read   = (fd, sab, count=sab.byteLength)	=> __syscall('read', fd, sab, count);
export const write  = (fd, str)				=> __syscall('write', fd, str);
export const seek   = (fd, n, type='SET')		=> __syscall('seek', fd, n, type);
export const pipe   = (sab, flags)			=> __syscall('pipe', sab, flags);
export const mount  = (target, driver, device, options)	=> __syscall('mount', target, driver, device, options);
export const umount = (target)				=> __syscall('umount', target);

//export const stat   = (path) => __syscall('stat', path);
//export const fstat  = (fd)   => __syscall('fstat', fd);

// paths
export const chdir = (fd)	=> __syscall('chdir', fd);
export const path  = (fd, sab)	=> __syscall('path', fd, sab);

// misc
export const insmod = (path)	=> __syscall('insmod', path);
export const rmmod  = (mod)	=> __syscall('rmmod', mod);
