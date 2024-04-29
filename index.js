// Desc: This is the main file for the node.js server
const osc = require("node-osc");
const dynamics = require("./dynamics.json");

let toRepeat = ["172.23.0.215", "172.23.1.235", "172.23.1.250"];
let clients = [];
let transition;

let threads = [];

for (let ip of toRepeat) {
  clients.push(new osc.Client(ip, 7000));
} // foreach

var oscServer = new osc.Server(7001, "0.0.0.0", () => {
  console.log("OSC Server is listening");
});

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

    if (value) {
      console.log(`Value ${value}`);
      message = message.replace("{value}", value);
    } // if
    send(command.uri, message);
  } catch (e) {
    console.log(e);
  } // catch
}

function messageMatch(msg) {
  try {
    let bundle = msg;
    let uri = bundle.shift();
    console.log(uri);
    console.log(bundle);

    if (uri == "/setTransition") {
      if (bundle.length == 0) {
        console.log(`Transition Cleared`);
        return;
      } // if
      else {
        for (let i = 0; i < Object.keys(dynamics).length; i++) {
          let key = Object.keys(dynamics)[i];
          if (dynamics[key].endpoint == bundle[0]) {
            transition = dynamics[key];
            console.log(`Transition set to ${transition.endpoint}`);
          } // if
        } // for
      } // else
      return;
    } // if
    for (let i = 0; i < Object.keys(dynamics).length; i++) {
      let key = Object.keys(dynamics)[i];
      if (dynamics[key].endpoint == uri) {
        console.log(`Matched: ${key}`);
        for (let value in bundle) {
          let sequence = dynamics[key].sequence;
          if (dynamics[key].applyTransition && transition) {
            let newArray = sequence;
            for (let j = transition.sequence.length - 1; j >= 0; j--) {
              newArray.unshift(transition.sequence[j]);
              console.log(j);
              sequence = newArray;
            }
          }
          executeSequence(sequence, bundle[value]);
        } // foreach
      } // if
    } // for
  } catch (e) {
    console.log(e);
  } // catch
} // messageMatch

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
