export default function() {
	// add sysrq mount
	localStorage.setItem('etc/fstab', localStorage.getItem('etc/fstab')+'none	/dev/sysrq	sysrq	defaults\n')
}
