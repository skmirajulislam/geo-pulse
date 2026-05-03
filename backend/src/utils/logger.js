const levels = {
	info: "INFO",
	warn: "WARN",
	error: "ERROR",
	debug: "DEBUG",
};

const getTimestamp = () => new Date().toISOString();

const log = (level, message, context = "app") => {
	console.log(
		`[${getTimestamp()}] [${levels[level]}] [${context}] ${message}\n`,
	);
};

module.exports = {
	info: (msg, ctx) => log("info", msg, ctx),
	warn: (msg, ctx) => log("warn", msg, ctx),
	error: (msg, ctx) => log("error", msg, ctx),
	debug: (msg, ctx) => log("debug", msg, ctx),
};
