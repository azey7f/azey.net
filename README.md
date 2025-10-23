# azey.net

An experimental Unix-like operating system written entirely in pure static frameworkless browser Javascript, complete with a kernel and userspace!

> Science isn't about WHY. It's about WHY NOT!  
> ~ Cave Johnson

Currently implemented features:
- a bootloader - doesn't do much except show a selection menu and `import()` the kernel
- [a fully functional monolithic kernel](#azix-kernel) including drivers, process management, TTYs, all that good stuff
- [a userspace](#userspace) consisting of a libc-like libjs, init, getty, a shell and a few basic commands

## azix kernel

Now, I know what you're thinking. "A kernel, written in javascript? *For a website*? What? Why? What? Are you high?" To the last question: No, unfortunately I wrote this fully conscious and of my own free will. As for the others, honestly, I have no idea. See Cave Johnson quote at the top of the README.

You can find the source code in `static/boot/kernels/azix`. Might make it a separate repo and include it here as a submodule eventually.

Features:
- a single-root node graph VFS layer
- modular drivers taking the "everything is a file" philosophy to its logical conclusion - all drivers are implemented as mountable filesystems
    - a read-only httpfs filesystem that mounts the webroot at `/`, with `read()` implemented using `fetch()`
        - assumes that the server serves an autoindex on /\<path\>/\_\_autoindex.json, since the alternative is just fuzzing the site and that seems a bit excessive for `ls`
    - a tmpfs filesystem mounted in `/dev`, mostly for other device drivers
    - an input driver mounted as a file at `/dev/input`, buffers JS `keydown` events
    - a domfs (HTML DOM, don't get excited) driver mounted at `/dev/dom` for graphical output, replaces traditional VGA drivers
    - 8 (by default) TTYs mounted at `/dev/ttyN`, with each mount corresponding to 1 TTY (except for tty0, which is the currently focused TTY). Processes `/dev/input`, also handles line discipline using kernel functions (see `tty.js`). Uses input & domfs.
    - TODO: PTY driver mounted at `/dev/pts`, handles line discipline & links `/dev/pts/N` with a `/dev/pts/ptmx` file descriptor, inspired by the [Linux implementation](https://linux.die.net/man/4/ptmx)
    - a ttyctl driver mounted at `/dev/tty`, exposes several files for TTY control:
        - `ctty`: get/set the current process' controlling TTY
        - `ftty`: get/set index of the currently focused TTY (VT)
        - `pgid`: get/set TTY's foreground process group
        - `ldisc`: get/set TTY's line discipline (`n_tty`, `n_echo` or `n_null`)
    - a pipe driver, mounting it creates a named FIFO; also used by the `pipe()` syscall
    - a localfs driver using JS localStorage mounted in `/etc` and `/root` - with an `/etc/fstab` actually used on "boot" by the init program and `/root/.azsh_history` used for shell history
    - a sysrq driver, for shutdown/reboot/etc
- process management
    - each process is a web worker, started from a `createObjectURL` blob read from the filesystem
    - job control, `setsid()` and `setpgid()`
    - signals
    - syscalls (see `docs/SYSCALL.md` for full list)
        - tried to use as few as possible, very much inspired by Plan9
        - to make a syscall, a process (web worker) calls `postMessage` and then `Atomics.wait`s on a shared array buffer, which then contains the syscall's return value
        - `read()` and other calls that return strings take a SharedArrayBuffer and length as arguments, C function-like

## Userspace

The kernel/userpace separation is implemented using web workers with `postMessage`+`SharedArrayBuffer`+`Atomics` imitating syscalls, because, yknow, why not. Args and env vars are transferred right after process creation in a `postMessage`.

Current features:
- a libc-like library in `/lib/libjs`
    - handles the initial setup, incl. waiting for args+env before running the program and setting up standard i/o streams
    - streams! including buffering and all the familiar `fwrite`, `fflush`, `setvbuf` etc functions, most implementations ~~stolen from~~ inspired by musl
    - a few miscellaneous C-like functions like `getopt`
- a few basic binaries in `/bin`
    - `init.js` - started by the kernel, runs `getty.js` on all TTYs
    - `getty.js` - prints welcome message and starts shell in a loop
    - `sh.js` - a barely-interactive proof of concept shell using canonical TTY line discipline without job control, comparable to [dash](https://github.com/danishprakash/dash)
    - `azsh.js` - a more advanced and generally much nicer shell using raw TTY ldisc, visuals inspired by [fish](https://fishshell.com/)
        - includes piping and file redirection support, history and ~~pretty colors~~ TODO
    - a bunch of coreutils: `head`, `tail`, `cat`, `rm`, `echo`, `ls`, `mount`, etc.

#### TODO
