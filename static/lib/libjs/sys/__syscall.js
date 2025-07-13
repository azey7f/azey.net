export function __syscall(syscall, ...args) {
	self.postMessage([ syscall, args ]);
	Atomics.wait(self.__sysret, 0, 0); // block until Atomics.notify() or sysret != 0
					 // note that no signals from the kernel are processed while waiting for a syscall
	return Atomics.exchange(self.__sysret, 0, 0); // return sysret & reset it to 0
};
export default __syscall;
