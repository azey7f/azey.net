window.terminal = document.createElement("ul");;
window.terminal.id = "terminal";
document.getElementById("term-window").append(window.terminal);

window.working_directory = location.pathname;
window.term_locked = false;
window.cursor_pos = 0;

window.history_current = 0;
window.history_saved = "";
window.history_cursor_pos = 0;
