#!/usr/bin/env node

const osc = require("node-osc");
const path = require("path");
const SelfReloadJSON = require("self-reload-json");
const request = require("request");
const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");

const dynamics = new SelfReloadJSON("./dynamics.json");
const config = new SelfReloadJSON("./config.json");

const REPEAT_IPS = config.REPEAT_IPS || [];
const CUSTOM_VARIABLE_ADDRESSES = config.CUSTOM_VARIABLE_ADDRESSES || [];

if (!REPEAT_IPS.length || !CUSTOM_VARIABLE_ADDRESSES.length) {
	console.warn("Warning: REPEAT_IPS or CUSTOM_VARIABLE_ADDRESSES is empty in config.json");
}

const dataCache = {
	teams: require("./teams.json"),
	leftTeam: "",
	rightTeam: "",
	selectedMap: "",
	leftColor: "red",
	rightColor: "blue",
	champions: "",
	redTeam: "",
	blueTeam: "",
};

let clients = [];
let transition;

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use("/sps", express.static(path.join(__dirname, "public")));

// Function to register endpoints
function registerEndpoints() {
	Object.keys(dynamics).forEach((key) => {
		const endpoint = dynamics[key].endpoint;
		const sequence = dynamics[key].sequence;

		app.get(endpoint, (req, res) => {
			executeSequence(sequence);
			res.send(`Sequence for ${endpoint} executed successfully`);
		});
	});
}

// Register endpoints initially
registerEndpoints();

// Re-register endpoints when dynamics reloads
dynamics.on("updated", () => {
	registerEndpoints();
});

// Function to update redTeam and blueTeam based on colors
function updateTeamColors() {
	if (dataCache.leftColor === "red") {
		dataCache.redTeam = dataCache.leftTeam;
		dataCache.blueTeam = dataCache.rightTeam;
	} else {
		dataCache.redTeam = dataCache.rightTeam;
		dataCache.blueTeam = dataCache.leftTeam;
	}

	// Execute the set-red-team sequence
	const setRedTeamSequence = getSequence("/CODM/set-red-team");
	if (setRedTeamSequence) {
		executeSequence(setRedTeamSequence.sequence);
	}

	// Execute the set-blue-team sequence
	const setBlueTeamSequence = getSequence("/CODM/set-blue-team");
	if (setBlueTeamSequence) {
		executeSequence(setBlueTeamSequence.sequence);
	}

	// Send updated team colors to custom variable endpoints
	sendCustomVariables();
}

// Function to swap colors and execute color sequence
function swapColors() {
	const temp = dataCache.leftColor;
	dataCache.leftColor = dataCache.rightColor;
	dataCache.rightColor = temp;

	updateTeamColors();
	io.emit("main", dataCache);

	// Execute the appropriate color sequence
	executeColorSequence();
}

// Add this new route for the HTML endpoint
app.get("/CODM/swap-colors", (req, res) => {
	swapColors();
	res.send("Colors swapped successfully");
});

server.listen(3072, () => {
	console.log("Server running at http://localhost:3072");
	// Send initial custom variables on startup
	sendCustomVariables();
});

io.on("connection", (socket) => {
	socket.emit("main", dataCache);

	socket.on("main", (data, callback) => {
		const oldLeftTeam = dataCache.leftTeam;
		const oldRightTeam = dataCache.rightTeam;
		const oldSelectedMap = dataCache.selectedMap;
		const oldLeftColor = dataCache.leftColor;
		const oldRightColor = dataCache.rightColor;
		const oldChampions = dataCache.champions;

		Object.assign(dataCache, data);
		updateTeamColors();
		io.emit("main", dataCache);

		// Check if leftTeam or rightTeam has changed
		if (dataCache.leftTeam !== oldLeftTeam || dataCache.rightTeam !== oldRightTeam) {
			setTeams();
		}

		// Check if selectedMap has changed
		if (dataCache.selectedMap !== oldSelectedMap) {
			const setMapSequence = getSequence("/CODM/set-map");
			if (setMapSequence) {
				executeSequence(setMapSequence.sequence);
			}
		}

		// Check if colors have changed
		if (dataCache.leftColor !== oldLeftColor || dataCache.rightColor !== oldRightColor) {
			executeColorSequence();
		}

		// Check if champion has changed
		if (dataCache.champions !== oldChampions) {
			const setChampionSequence = getSequence("/CODM/set-champion");
			if (setChampionSequence) {
				executeSequence(setChampionSequence.sequence);
			}
		}

		// Send updated custom variables
		sendCustomVariables();

		if (callback) callback(true);
	});

	// Add this new event listener
	socket.on("swapColors", (data, callback) => {
		// Update only the color properties
		dataCache.leftColor = data.leftColor;
		dataCache.rightColor = data.rightColor;

		updateTeamColors();
		// Emit only the updated color information
		io.emit("main", dataCache);

		// Execute the appropriate color sequence
		executeColorSequence();

		// Send updated custom variables
		sendCustomVariables();

		if (callback) callback(true);
	});
});

// Function to set teams and update colors
function setTeams() {
	const setTeamsSequence = getSequence("/CODM/set-teams");
	if (setTeamsSequence) {
		executeSequence(setTeamsSequence.sequence);
	}
	updateTeamColors();
	executeColorSequence();
}

// Function to execute the appropriate color sequence
function executeColorSequence() {
	const sequenceName = dataCache.leftColor === "blue" ? "/CODM/set-color-standard" : "/CODM/set-color-flipped";
	const colorSequence = getSequence(sequenceName);
	if (colorSequence) {
		executeSequence(colorSequence.sequence);
		console.log("Setting Colors");
	}
}

// Function to send custom variables
function sendCustomVariables() {
	const variables = {
		redTeam: dataCache.redTeam,
		blueTeam: dataCache.blueTeam,
		transition: transition ? transition.endpoint : "",
	};

	Object.entries(variables).forEach(([variableName, value]) => {
		CUSTOM_VARIABLE_ADDRESSES.forEach((address) => {
			const url = `${address}/api/custom-variable/${variableName}/value?value=${encodeURIComponent(value)}`;
			request.post(url, (error, response, body) => {
				if (error) {
					console.error(`Error sending ${variableName} to ${address}:`, error);
				} else {
					console.log(`Sent ${variableName} to ${address}: ${value}`);
				}
			});
		});
	});
}

REPEAT_IPS.forEach((ip) => {
	clients.push(new osc.Client(ip, 7000));
});

var oscServer = new osc.Server(1337, "0.0.0.0", () => {
	console.log("OSC Server is listening");
});

function executeSequence(sequence, value, index = 0) {
	for (let i = index; i < sequence.length; i++) {
		const item = sequence[i];
		console.log(item);
		try {
			switch (item.type) {
				case "osc_command":
					sendOSC(item, value);
					break;
				case "pause":
					console.log(`Pausing for ${item.duration} milliseconds`);
					setTimeout(() => {
						executeSequence(sequence, value, i + 1);
					}, item.duration);
					return;
				default:
					console.log(`Unknown type: ${item.type}`);
					break;
			}
		} catch (e) {
			console.error(e);
		}
	}
}

function sendOSC(command, value) {
	try {
		let message = command.data;
		if (value && !isNumber(message)) {
			console.log(`Value ${value}`);
			message = message.includes("{value}") ? message.replace("{value}", value) : message;
			message = isNumber(message) ? parseInt(message) : message;
		}

		if (typeof message === "string") {
			if (message.includes("{leftTeam}")) {
				message = message.replace("{leftTeam}", dataCache.leftTeam);
			}
			if (message.includes("{rightTeam}")) {
				message = message.replace("{rightTeam}", dataCache.rightTeam);
			}
			if (message.includes("{selectedMap}")) {
				message = message.replace("{selectedMap}", dataCache.selectedMap);
			}
			if (message.includes("{champions}")) {
				message = message.replace("{champions}", dataCache.champions);
			}
			if (message.includes("{redTeam}")) {
				message = message.replace("{redTeam}", dataCache.redTeam);
			}
			if (message.includes("{blueTeam}")) {
				message = message.replace("{blueTeam}", dataCache.blueTeam);
			}
		}

		message = message === "" && message !== 0 ? "" : message;
		console.log(`Sending OSC: ${command.uri} ${message}`);
		clients.forEach((client) => {
			client.send(command.uri, message);
		});
	} catch (e) {
		console.log(e);
	}
}

function isNumber(value) {
	return typeof value === "number";
}

function getSequence(uri) {
	for (const key in dynamics) {
		if (dynamics[key].endpoint === uri) {
			return dynamics[key];
		}
	}
	return null;
}

function messageMatch(msg) {
	try {
		let [uri, ...bundle] = msg;
		console.log(uri);
		console.log(bundle);

		if (uri === "/CODM/setTransition") {
			handleTransition(bundle[0]);
			return;
		}

		if (uri === "/CODM/swap-colors") {
			swapColors();
			console.log("Colors swapped via OSC");
			return;
		}

		const result = getSequence(uri);
		if (!result) return;

		let sequence = JSON.parse(JSON.stringify(result.sequence));

		if (result.applyTransition && transition) {
			sequence = [...transition.sequence, ...sequence];
		}
		executeSequence(sequence, "");
		return;
	} catch (e) {
		console.log(e);
	}
}

function handleTransition(transitionValue) {
	if (transitionValue === "") {
		transition = undefined;
		console.log("Transition Cleared");
	} else {
		const val = getSequence(transitionValue);
		if (val) {
			transition = val;
			console.log(`Transition set to ${transition.endpoint}`);
		}
	}
	// Send updated custom variables when transition changes
	sendCustomVariables();
}

// ... (rest of the functions remain largely unchanged)

oscServer.on("message", function (msg, rinfo) {
	console.log(`Message: ${msg}`);
	try {
		messageMatch(msg);
	} catch (e) {
		console.log(e);
	}
	return;
});
