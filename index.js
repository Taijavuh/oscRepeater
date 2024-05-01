// I know this is a piece of shit, don't judge me.
// note to self - renew your JS and build a basic UI framework when you next have some time.
const osc = require("node-osc");
var SelfReloadJSON = require("self-reload-json");
var dynamics = new SelfReloadJSON("./dynamics.json");
const request = require("request");

let toRepeat = ["10.100.101.72", "10.100.101.73", "10.100.101.74"];
let clients = [];
let transition;
let player_url = "http://10.100.101.89:3003/teams";
let dinoBADGER = require("./dinoBADGER.json");
let dataCache = {};
dataCache.matchPoint = [];
dataCache.lastThree = [];
dataCache.teams = require("./teams.json");
dataCache.pods = [];
dataCache.mw = "";
dataCache.sw = "";
dataCache.champ = "";
dataCache.tt = "";
dataCache.upNext = 1;
let threads = [];

// Web World

const express = require("express");
const { createServer } = require("node:http");
const { join } = require("node:path");
const { Server } = require("socket.io");
const { clear } = require("node:console");

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use("/apex", express.static("public"));

server.listen(3072, () => {
  console.log("server running at http://localhost:3072");
});

io.on("connection", (socket) => {
  socket.emit("main", dataCache);
  socket.on("main", (msg) => {
    console.log(msg);
    dataCache = msg;
    socket.broadcast.emit("main", dataCache);
    // check MP teams
    if (dataCache.matchPoint.length > 0) {
      setMPTeams();
    } // if
    else {
      clearMPTeams();
    } // else
  });
});

// Clear Pods
function clearPodCache() {
  dataCache.pods = [];
  for (let i = 0; i < 20; i++) {
    dataCache.pods.push("ASSIGN POD");
  } // for
} // clearPodCache
clearPodCache();

// OSC World

for (let ip of toRepeat) {
  clients.push(new osc.Client(ip, 7401));
} // foreach

var oscServer = new osc.Server(7001, "0.0.0.0", () => {
  console.log("OSC Server is listening");
  //andySpam();
});
/*
function andySpam() {
  for (let i = 1; i < 21; i++) {
    send(`/d3/layer/HS_W_${i}/fade_up_time`, 1);
  } // for
} // andy
*/
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
      if (message.includes("{value}i")) {
        message = message.replace("{value}i", value);
        message = parseInt(message);
      } else {
        message = message.replace("{value}", value);
      } // else
    } // if

    if (message == "") message = "";

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

    if (uri == "/apex-legends/setTeams") {
      setTeams();
      return;
    } // if

    if (uri == "/apex-legends/3-teams") {
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

    let result = getSequence(uri);

    for (let value in bundle) {
      let sequence = JSON.parse(JSON.stringify(result.sequence));
      let bundleValue = bundle[value];
      if (uri == "/apex-legends/eliminated") {
        console.log(`Eliminated: ${bundleValue}`);
        for (let p = 0; p < dataCache.lastThree.length; p++) {
          if (dataCache.lastThree[p] == parseInt(bundleValue)) {
            let toRemove = p + 1;
            let addObj3 = {};
            addObj3.uri = `/d3/layer/3T_${toRemove}/mapping`;
            addObj3.data = "0";
            addObj3.type = "osc_command";
            sequence.push(addObj3);
          } //
        } // for
        for (let p = 0; p < dataCache.matchPoint.length; p++) {
          if (dataCache.matchPoint[p] == parseInt(bundleValue)) {
            let toRemove = p + 1;
            let addObj4 = {};
            addObj4.uri = `/d3/layer/3T_MP_${toRemove}/mapping`;
            addObj4.data = "0";
            addObj4.type = "osc_command";
            sequence.push(addObj4);
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
      dataCache.pods[val.teams[i].idx - 1] = val.teams[i].teamName;
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
      seqItem.uri = seqItem.uri.replace("{index}", i);
      obj.sequence.push(seqItem);
    } // for
  } // for
  executeSequence(obj.sequence, "");
}

function setMPTeams(input) {
  let baseUri = "/apex-legends/";
  let obj = {};
  obj.endpoint = baseUri + "mp-executor";
  obj.applyTransition = false;
  obj.sequence = [];

  if (!input || input.length < 0) {
    input = dataCache.matchPoint;
  } // if

  //SEQ
  let mpInSequence = getSequence(baseUri + "3-teams-mp-in").sequence;

  // Update match point
  for (let i = 0; i < input.length && i < 20; i++) {
    for (let j = 0; j < mpInSequence.length; j++) {
      let seqItem = JSON.parse(JSON.stringify(mpInSequence[j]));
      seqItem.uri = seqItem.uri.replace("{index}", i + 1);
      seqItem.data = seqItem.data.replace("{value}", input[i]);
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
        seqItem.uri = seqItem.uri.replace("{index}", i + 1);
        seqItem.data = seqItem.data.replace("{value}", input[i]);
        obj.sequence.push(seqItem);
      } // for
    } // for

    // And remainder of sequence plus cue
    let mainSequence = getSequence(baseUri + "3-teams-remain").sequence;
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
      console.log(`Sent: ${uri} ${msg}`);
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
