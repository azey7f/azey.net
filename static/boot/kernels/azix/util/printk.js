import { timestamp } from './time.js';
import * as vfs from '../vfs.js';

export async function printk(msg) {
	msg = timestamp(msg.endsWith('\n') ? msg : msg+'\n');
	window.dmesg.push(msg);
	console.log(msg);

	if (window.proc) await vfs.write(0, 0, msg);
	return msg.length;
}
