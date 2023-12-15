// Desc: This is the main file for the node.js server
const osc = require("node-osc");
const dynamics = require("./dynamics.json");

let toRepeat = ["172.23.1.200", "172.23.1.218", "172.23.1.214"];
let clients = [];

for (let ip of toRepeat) {
  clients.push(new osc.Client(ip, 7000));
} // foreach

var oscServer = new osc.Server(7001, "0.0.0.0", () => {
  console.log("OSC Server is listening");
});

function messageMatch(msg) {
  try {
    let type = msg[0].split("/");
    console.log(type);
    if (type[1] == "setTeam") {
      if (type[2] == "left") {
        for (let bundle of dynamics.left) {
          try {
            if (bundle.value) {
              send(bundle.uri, bundle.value);
            } else {
              send(bundle.uri, bundle.prefix + msg[1] + bundle.postfix);
            }
          } catch (e) {
            console.log(e);
          }
        } // foreach
      } else if (type[2] == "right") {
        for (let bundle of dynamics.right) {
          try {
            if (bundle.value) {
              send(bundle.uri, bundle.value);
            } else {
              send(bundle.uri, bundle.prefix + msg[1] + bundle.postfix);
            } // else
          } catch (e) {
            console.log(e);
          }
        } // foreach
      } // else if
    } // if
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
