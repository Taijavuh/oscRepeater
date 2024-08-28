#!/usr/bin/env node
// I know this is a piece of shit, don't judge me.
// note to self - renew your JS and build a basic UI framework when you next have some time.
const osc = require("node-osc");
const path = require("path");
var SelfReloadJSON = require("self-reload-json");
var dynamics = new SelfReloadJSON("./dynamics.json");
const request = require("request");

let toRepeat = ["10.100.101.31", "10.100.101.32", "10.100.101.33", "10.100.101.34", "10.100.101.35"];
let clients = [];
let transition;
let player_url = "http://10.100.101.98:3003/teams";
let draft_url = "https://prod-api.algstools.com/v1/poi-drafts";
//let dinoBADGER = require("./dinoBADGER.json");
let dataCache = {};
dataCache.matchPoint = [];
dataCache.matchPoint.mpCount = 0;
dataCache.lastThree = [];
dataCache.teams = require("./teams.json");
dataCache.pods = [];
dataCache.mw = "";
dataCache.sw = "";
dataCache.champ = "";
dataCache.tt = "";
dataCache.upNext = 1;
dataCache.drafts = {};
dataCache.draftId = "";
dataCache.draftMap = "";
dataCache.draftMapping = {};
//dataCache.pods = require("./team_map_default.json");
//dataCache.draftMapping = require("./draft.json");

// Web World

const express = require("express");
const { createServer } = require("node:http");
const { join } = require("node:path");
const { Server } = require("socket.io");
const { clear } = require("node:console");

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use("/apex", express.static(path.join(__dirname, "public")));

server.listen(3072, () => {
	console.log("server running at http://localhost:3072");
});

io.on("connection", (socket) => {
	socket.emit("main", dataCache);
	socket.on("main", (msg) => {
		dataCache = msg;
		socket.broadcast.emit("main", dataCache);
		// check MP teams
		if (dataCache.matchPoint.length != dataCache.matchPoint.mpCount && dataCache.matchPoint.length > 0) {
			doMPTeams();
		} // if
	});
	socket.on("getDraftList", () => {
		getDraftList();
	});
	socket.on("getDraft", () => {
		getDraft();
	});
	socket.on("setDraft", () => {
		setDraft();
	});
	socket.on("mapDraft", () => {
		doDraftMapping();
	});
	socket.on("resetMP", () => {
		clearMPTeams();
	});
});

// Clear Pods
function clearPodCache() {
	dataCache.pods = [];
	for (let i = 0; i < 20; i++) {
		dataCache.pods.push("ASSIGN POD");
	} // for
} // clearPodCache

setTimeout(() => {
	clearPodCache();
	getTeams();
	clearMPTeams();
	andySpam();
}, 1000);

// OSC World

for (let ip of toRepeat) {
	clients.push(new osc.Client(ip, 7401));
} // foreach

var oscServer = new osc.Server(7001, "0.0.0.0", () => {
	console.log("OSC Server is listening");
	//andySpam();
});

function andySpam() {
	for (let i = 1; i < 21; i++) {
		send(`/d3/layer/S_W_${i}/bookmark`, `objects/webbookmark/s${i}.apx`);
	} // for
} // andy

function executeSequence(sequence, value, index) {
	for (let i = index || 0; i < sequence.length; i++) {
		let item = sequence[i];
		console.log(item);
		try {
			switch (item.type) {
				case "osc_command":
					sendOSC(item, value);
					break;
				case "pause":
					console.log(`Pausing for ${item.duration} seconds`);
					setTimeout(() => {
						executeSequence(sequence, value, i + 1);
					}, item.duration);
					return;
				default:
					console.log(`Unknown type: ${sequence[item].type}`);
					break;
			}
		} catch (e) {
			console.error(e);
		} // catch
	} // for
}

function sendOSC(command, value) {
	try {
		let message = command.data;
		if (value && !isNumber(message)) {
			console.log(`Value ${value}`);
			if (message.includes("{value}")) {
				message = message.replace("{value}", value);
				if (isNumber(message)) message = parseInt(message);
			} else {
				message = message.replace("{value}", value);
			} // else
		} // if

		if (message == "" && message != 0) message = "";

		console.log(message);

		send(command.uri, message);
	} catch (e) {
		console.log(e);
	} // catch
}

function isNumber(value) {
	return typeof value === "number";
}

function messageMatch(msg) {
	try {
		let bundle = msg;
		let uri = bundle.shift();
		console.log(uri);
		console.log(bundle);

		// Transition Logic
		if (uri == "/apex-legends/setTransition") {
			if (bundle[0] == "") {
				transition = undefined;
				console.log(`Transition Cleared`);
				return;
			} // if
			else {
				let val = getSequence(bundle[0]);
				if (val) {
					transition = val;
					console.log(`Transition set to ${transition.endpoint}`);
				} // if
			} // else
			return;
		} // if

		// Get Teams
		if (uri == "/apex-legends/getTeams") {
			getTeams();
			return;
		} // if

		if (uri == "/apex-legends/getDraft") {
			getDraftList();
			return;
		} // if

		if (uri == "/apex-legends/doDraftMapping") {
			doDraftMapping();
			return;
		} // if

		if (uri == "/apex-legends/setDraft") {
			setDraft();
			return;
		} // if

		if (uri == "/apex-legends/setTeams") {
			setTeams();
			return;
		} // if

		if (uri == "/apex-legends/3-teams-remain-depr") {
			set3Teams(bundle);
			return;
		} // if

		if (uri == "/apex-legends/clear-match-point") {
			clearMPTeams();
			return;
		} // if

		if (uri == "/apex-legends/set-match-point") {
			setMPTeams(bundle);
			return;
		}

		if (uri == "/apex-legends/up-next") {
			if (dataCache.upNext) {
				bundle = [dataCache.upNext];
			} // if
		} // if

		if (uri == "/apex-legends/match-winner") {
			if (bundle[0]) {
				dataCache.mw = bundle[0];
				io.emit("main", dataCache);
			}
		} // if

		if (uri == "/apex-legends/series-winner") {
			if (bundle[0]) {
				dataCache.sw = bundle[0];
				io.emit("main", dataCache);
			} // if
		} // if

		if (uri == "/apex-legends/champions") {
			if (bundle[0]) {
				dataCache.champs = bundle[0];
				io.emit("main", dataCache);
			} // if
		} // if

		if (uri == "/apex-legends/team-takeover") {
			if (bundle[0]) {
				dataCache.tt = bundle[0];
				io.emit("main", dataCache);
			} // if
		} // if

		if (uri == "/apex-legends/match-winner-trig") {
			if (dataCache.mw) {
				bundle = [dataCache.mw];
			} // if
		} // if

		if (uri == "/apex-legends/series-winner-trig") {
			if (dataCache.sw) {
				bundle = [dataCache.sw];
			} // if
		} // if

		if (uri == "/apex-legends/champions-trig") {
			if (dataCache.champ) {
				bundle = [dataCache.champ];
			} // if
		} // if

		if (uri == "/apex-legends/team-takeover-trig") {
			if (dataCache.tt) {
				bundle = [dataCache.tt];
			} // if
		} // if

		if (uri == "/apex-legends/reset-gameplay") {
			resetTeamNames();
			return;
		}

		if (uri == "/apex-legends/match-point") {
			doMPTeams();
		}

		let result = getSequence(uri);

		for (let value in bundle) {
			let sequence = JSON.parse(JSON.stringify(result.sequence));
			console.log(sequence);
			try {
				if (bundle[value]) {
					for (let j = 0; j < sequence.length; j++) {
						if (sequence[j].uri) {
							console.log("true");
							sequence[j].uri = sequence[j].uri.replace("{value}", bundle[value]);
						} // for
					} // for
				} // if
			} catch (e) {
				console.log(e);
			} // catch

			let bundleValue = bundle[value];
			if (uri == "/apex-legends/eliminated") {
				console.log(`Eliminated: ${bundleValue}`);
				for (let p = 0; p < dataCache.lastThree.length; p++) {
					if (dataCache.lastThree[p] == parseInt(bundleValue)) {
						let toRemove = p + 1;
						let addObj3 = {};
						addObj3.uri = `/d3/layer/3T_${toRemove}/brightness`;
						addObj3.data = 0;
						addObj3.type = "osc_command";
						sequence.push(addObj3);
						break;
					} //
				} // for
				for (let l = 0; l < dataCache.matchPoint.length; l++) {
					if (dataCache.matchPoint[l] == parseInt(bundleValue)) {
						let toRemove = l + 1;
						let addObj4 = {};
						addObj4.uri = `/d3/layer/3T_MP_${toRemove}/brightness`;
						addObj4.data = 0;
						addObj4.type = "osc_command";
						sequence.push(addObj4);
						break;
					} //
				} // for
				bundleValue = parseInt(bundleValue) + 60;
				let addObj = {};
				addObj.uri = `/d3/layer/TN_${bundle[value]}/brightness`;
				addObj.data = 0.1;
				addObj.type = "osc_command";
				let addObj2 = {};
				addObj2.uri = `/d3/layer/S_W_${bundle[value]}/brightness`;
				addObj2.data = 0.1;
				addObj2.type = "osc_command";
				sequence.push(addObj);
				sequence.push(addObj2);
			} // if

			if (result.applyTransition && transition) {
				let newArray = sequence;
				for (let j = transition.sequence.length - 1; j >= 0; j--) {
					newArray.unshift(transition.sequence[j]);
					sequence = newArray;
				}
			}
			executeSequence(sequence, bundleValue);
		} // foreach
	} catch (e) {
		console.log(e);
	} // catch
} // messageMatch

function getSequence(uri) {
	try {
		for (let i = 0; i < Object.keys(dynamics).length; i++) {
			let key = Object.keys(dynamics)[i];
			if (dynamics[key].endpoint == uri) {
				console.log(`Matched: ${key}`);
				return dynamics[key];
			} // if
		} // for
	} catch (e) {
		console.log(e);
		return;
	} // catch
	return;
} // getSequence

function mapTeam(teamName) {
	try {
		let tn = teamName;
		switch (teamName) {
			case "ENTER FORCE.36":
				tn = "EnterForce36";
				break;
			case "SSG":
				tn = "SpacestationGaming";
				break;
			case "GHS Professional":
				tn = "GHSPro";
				break;
			case "GaiminGladiators":
				tn = "Gaimin";
				break;
			case "GoNext Esports":
				tn = "GoNext";
				break;
			case "BLEED Esports":
				tn = "Bleed";
				break;
			case "SSE-Xray":
				tn = "SSE";
				break;
			case "E-XoloLAZER":
				tn = "E-XolosLAZER";
				break;
			default:
				tn = tn.replace(" ", "");
				break;
		} // switch
		return tn;
	} catch (e) {
		console.log(e);
	} // catch
} // mapTeam

function mapPOI(name) {
	try {
		let poi = name;
		switch (poi) {
			case "SkyhookWest":
				poi = "SkyWest";
				break;
			case "SkyhookEast":
				poi = "SkyEast";
				break;
			case "SurveyCamp":
				poi = "Survey";
				break;
			case "TheEpicenter":
				poi = "Epicenter";
				break;
			case "TheGeyser":
				poi = "Geyser";
				break;
			case "ThePylon":
				poi = "Pylon";
				break;
			case "Lift":
				poi = "MountainLift";
				break;
			case "ThePylon":
				poi = "Pylon";
				break;
			case "DevastatedCoast":
				poi = "DevCoast";
				break;
			case "CoastalCamp":
				poi = "Costal";
				break;
			case "CheckpointNorth":
				poi = "Checkpoint";
				break;
			case "CheckpointSouth":
				poi = "Checkpoint";
				break;
			case "CenoteCave":
				poi = "Cenote";
				break;
			case "BarometerNorth":
				poi = "Barometer";
				break;
			case "BarometerSouth":
				poi = "Barometer";
				break;
			case "ProwlerNest":
				poi = "Cliffside";
				break;
			default:
				poi = poi.replace(" ", "");
				break;
		} // switch
		return poi;
	} catch (e) {
		console.log(e);
	} // catch
} // mapTeam

function getDraftList() {
	// First get the URL
	let opt = {};
	opt.url = draft_url;
	opt.headers = { "x-api-key": "mZLnTaoptF8jvry5yrEkD2pKtK0B6xpxyHxWU05NE0x7M4WW" };

	console.log(opt);

	request(opt, (error, response, body) => {
		// Printing the error if occurred
		if (error) {
			console.log(error);
			return;
		} // if

		// Printing status code
		console.log(response.statusCode);
		let res = JSON.parse(body);

		// Find Latest
		try {
			for (let i = 0; i < res.drafts.length; i++) {
				console.log(i);
				let draft = res.drafts[i];
				getDraft(draft.series.name, draft.id, draft.date);
			} // for
		} catch (e) {
			console.log(e);
		} // catch
	});
	io.emit("main", dataCache);
} // getDraftList

function getDraft(name, gid, date) {
	try {
		let opt = {};
		opt.url = draft_url + `/${gid}/pick`;
		opt.headers = { "x-api-key": "mZLnTaoptF8jvry5yrEkD2pKtK0B6xpxyHxWU05NE0x7M4WW" };

		console.log(opt);

		// Setup
		dataCache.drafts[gid] = {};
		dataCache.drafts[gid].name = name;
		dataCache.drafts[gid].date = date;

		request(opt, (error, response, body) => {
			// Printing the error if occurred
			if (error) {
				console.log(error);
				return;
			} // if

			let res = JSON.parse(body);

			// Find Latest
			try {
				let gid_p1 = response.req.path.replace("/v1/poi-drafts/", "");
				let gid = gid_p1.replace("/pick", "");
				let obj = {};
				obj = {};
				obj.all = [];
				obj.stormpoint = [];
				obj.worldsedge = [];
				for (let i = 0; i < res.picks.length; i++) {
					let pick = res.picks[i];
					let obj2 = {};
					obj2.pick = pick.actualPickNumber;
					obj2.fake_pick = pick.pickNumber;
					obj2.map = pick.map.name ? pick.map.name.replace(" ", "") : "";
					obj2.poi = pick.spawnLocation.name ? pick.spawnLocation.name.replace(" ", "") : "";
					obj2.poi_id = pick.spawnLocation.inGameDropId;
					obj2.team = mapTeam(pick.team.name);
					obj.all.push(obj2);
					if (obj2.map == "StormPoint") obj.stormpoint.push(obj2);
					if (obj2.map == "WorldsEdge") obj.worldsedge.push(obj2);
				} // for
				obj.all.sort(sortPicks);
				obj.worldsedge.sort(sortPicks);
				obj.stormpoint.sort(sortPicks);
				for (let i = 0; i < obj.worldsedge.length; i++) {
					obj.worldsedge[i].map_pick = i + 1;
				} // for
				for (let i = 0; i < obj.stormpoint.length; i++) {
					obj.stormpoint[i].map_pick = i + 1;
				} // for
				dataCache.drafts[gid].picks = obj;
				io.emit("main", dataCache);
			} catch (e) {
				console.log(e);
			} // catch
		}); // try
	} catch (e) {
		console.log(e);
	} // catch
} // getDraft

function doDraftMapping() {
	try {
		let gid = dataCache.draftId;
		let map = dataCache.draftMap;
		if (!gid || !map) return;
		console.log(`${gid} on ${map} - OK`);
		let draft = dataCache.drafts[gid].picks[map];
		let draftMapping = {};
		for (let i = 0; i < draft.length; i++) {
			let pick = draft[i];
			let pod = findPod(pick.team);
			if (pod) draftMapping[pod] = pick;
		} // for
		dataCache.draftMapping = draftMapping;
		io.emit("main", dataCache);
	} catch (e) {
		console.log(e);
	} // catch
} // doDraftMapping

function setDraft() {
	try {
		let baseUri = "/apex-legends/";

		console.log(dataCache.draftMapping);
		let obj = {};
		obj.endpoint = baseUri + "set-draft";
		obj.applyTransition = false;
		obj.sequence = [];
		let seq = getSequence(baseUri + "set-draft").sequence;

		for (let i = 1; i < 21; i++) {
			for (let j = 0; j < seq.length; j++) {
				let seqItem = JSON.parse(JSON.stringify(seq[j]));
				console.log(dataCache.draftMapping[i]);
				if (dataCache.draftMapping[i]) {
					seqItem.uri = seqItem.uri.replace("{map_pick}", dataCache.draftMapping[i].map_pick);
					seqItem.data = seqItem.data.replace("{index}", i);
					seqItem.data = seqItem.data.replace("{pick}", dataCache.draftMapping[i].pick);
					seqItem.data = seqItem.data.replaceAll("{map}", dataCache.draftMapping[i].map);
					seqItem.data = seqItem.data.replace("{poi}", mapPOI(dataCache.draftMapping[i].poi));
					seqItem.data = seqItem.data.replace("{team}", dataCache.draftMapping[i].team);
				} else {
					seqItem.data = 0;
				} // else
				obj.sequence.push(seqItem);
			} // for
		} // for
		executeSequence(obj.sequence, "");
	} catch (e) {
		console.log(e);
	} // catch
} // setDraft

function findPod(team) {
	try {
		for (let i = 0; i < dataCache.pods.length; i++) {
			let pod = dataCache.pods[i];
			if (pod.toLowerCase() == mapTeam(team).toLowerCase()) return i + 1;
		} // for
		return false;
	} catch (e) {
		// try
		console.log(e);
	} // catch
} // findPod

function sortPicks(a, b) {
	if (a.pick < b.pick) {
		return -1;
	}
	if (a.pick > b.pick) {
		return 1;
	}
	return 0;
} // sortPicks

function getTeams() {
	// YAHOO PARTNER - COPILOT it's time to get the teams!!! Let's go! I believe in you! You can do it
	// sorry what? I was just thinking about how much I love my job no, no the job you just said I love you, I love you too oh you're so sweet and kind and you're so good at your job I know I know why are you so good at your job? I don't know it's just a gift I guess what's your secret? I don't know can you tell me? I don't know I don't know what's your secret? dino
	// I don't know I don't know what's your secret? dino badger

	request(player_url, (error, response, body) => {
		// Printing the error if occurred
		if (error) {
			console.log(error);
			return;
		} // if

		// Printing status code
		console.log(response.statusCode);

		// Set Teams
		let val = JSON.parse(body);

		for (let i = 0; i < val.teams.length; i++) {
			console.log(val.teams[i].idx);
			dataCache.pods[val.teams[i].idx - 1] = mapTeam(val.teams[i].teamName);
		} // for
		io.emit("main", dataCache);
		console.log(dataCache.pods);
	});
} // getTeams

function setTeams() {
	let input = dataCache.pods;
	for (let i = 0; i < input.length; i++) {
		setTeam(input[i], i + 1);
	} // for
} // setTeams

function setTeam(input, idx) {
	try {
		let baseUri = "/apex-legends/teams/set";
		let uri = `${baseUri}${idx}`;
		let message = input;
		let obj = {};
		obj.endpoint = uri;
		obj.applyTransition = false;
		obj.sequence = JSON.parse(JSON.stringify(getSequence(baseUri).sequence));
		for (let i = 0; i < obj.sequence.length; i++) {
			let item = obj.sequence[i];
			if (item.uri) {
				obj.sequence[i].uri = item.uri.replace("{index}", idx);
			} // if
		} // for
		executeSequence(obj.sequence, message);
		console.log(obj);
	} catch (e) {
		console.log(e);
	} // catch
} // setTeam

function resetTeamNames() {
	let baseUri = "/apex-legends/";
	dataCache.lastThree = [];
	let obj = {};
	obj.endpoint = baseUri + "gp-reset";
	obj.applyTransition = false;
	obj.sequence = [];
	let seq = getSequence(baseUri + "gameplay-reset").sequence;
	// Set all mp teams to off
	for (let i = 1; i < 21; i++) {
		for (let j = 0; j < seq.length; j++) {
			let seqItem = JSON.parse(JSON.stringify(seq[j]));
			seqItem.uri = seqItem.uri.replace("{index}", i);
			obj.sequence.push(seqItem);
		} // for
	} // for
	executeSequence(obj.sequence, "");
}

function clearMPTeams() {
	console.log("clearMP");
	let baseUri = "/apex-legends/";
	dataCache.matchPoint = [];
	let mpOutSequence = getSequence(baseUri + "3-teams-mp-out").sequence;
	let obj = {};
	obj.endpoint = baseUri + "mp-clear";
	obj.applyTransition = false;
	obj.sequence = [];
	// Set all mp teams to off
	for (let i = 1; i < 21; i++) {
		for (let j = 0; j < mpOutSequence.length; j++) {
			let seqItem = JSON.parse(JSON.stringify(mpOutSequence[j]));
			seqItem.uri = seqItem.uri.replace("{value}", i);
			obj.sequence.push(seqItem);
		} // for
	} // for
	executeSequence(obj.sequence, "");
}

function setMPTeams(input) {
	try {
		dataCache.matchPoint.push(input[0]);
		dataCache.matchPoint.mpCount = dataCache.matchPoint.length;
		dataCache.emit("main", dataCache);
	} catch (e) {
		console.log(e);
	} // catch
} // setMPTeams

function doMPTeams() {
	let baseUri = "/apex-legends/";
	let obj = {};
	obj.endpoint = baseUri + "mp-executor";
	obj.applyTransition = false;
	obj.sequence = [];

	let delay = {};
	delay.type = "pause";
	delay.duration = 5000;
	obj.sequence.push(delay);

	//SEQ
	let mpInSequence = getSequence(baseUri + "3-teams-mp-in").sequence;

	// Update match point
	for (let i = 0; i < dataCache.matchPoint.length && i < 20; i++) {
		for (let j = 0; j < mpInSequence.length; j++) {
			let seqItem = JSON.parse(JSON.stringify(mpInSequence[j]));
			if (seqItem.type == "osc_command") {
				seqItem.uri = seqItem.uri.replace("{value}", dataCache.matchPoint[i]);
			}
			//seqItem.data = seqItem.data.replace("{value}", input[i]);
			obj.sequence.push(seqItem);
		} // for
	} // for
	/*
  // And remainder of sequence plus cue
  let mainSequence = getSequence(baseUri + "mp-teams").sequence;
  for (let i = 0; i < mainSequence.length; i++) {
    obj.sequence.push(mainSequence[i]);
  } // for
*/
	// Exec
	console.log(obj.sequence);
	executeSequence(obj.sequence, "");
} // setMPTeams

function set3Teams(input) {
	try {
		let baseUri = "/apex-legends/";

		let obj = {};
		obj.endpoint = baseUri + "3-teams-executor";
		obj.applyTransition = false;
		obj.sequence = [];

		let inSequence = getSequence(baseUri + "3-teams-in").sequence;

		// Update those we care about
		for (let i = 0; i < input.length || i < 3; i++) {
			for (let j = 0; j < inSequence.length; j++) {
				dataCache.lastThree.push(input[i]);
				let seqItem = JSON.parse(JSON.stringify(inSequence[j]));
				seqItem.uri = seqItem.uri.replace("{value}", input[i]);
				seqItem.data = 0;
				//seqItem.data = seqItem.data.replace("{value}", input[i]);
				obj.sequence.push(seqItem);
			} // for
		} // for

		// And remainder of sequence plus cue
		let mainSequence = getSequence(baseUri + "3-teams-remain-depr").sequence;
		for (let i = 0; i < mainSequence.length; i++) {
			obj.sequence.push(mainSequence[i]);
		} // for

		// Exec
		console.log(obj.sequence);
		executeSequence(obj.sequence, "");
	} catch (e) {
		console.log(e);
	} // catch
} // setTeam

function send(uri, msg) {
	try {
		for (let client of clients) {
			client.send(uri, msg);
			console.log(`Sent: ${client.host} ${uri} ${msg}`);
		} // foreach
	} catch (e) {
		console.log(e);
	} // catch
} // send

oscServer.on("message", function (msg) {
	console.log(`Message: ${msg}`);
	try {
		messageMatch(msg);
	} catch (e) {
		console.log(e);
	} // catch
});
