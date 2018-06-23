'use strict';
google.charts.load('current', {packages: ['corechart', 'line']});
google.charts.setOnLoadCallback(drawLogScales);
// TODO Possibly use this in future: https://stackoverflow.com/a/14521482/5434860 + prompt("enter ip", "default ip") for couchdb

const DATABASE_URL = window.location.protocol === "file:" ?
	"http://192.168.10.250:5984/solarthing" :
	window.location.protocol + "//" +  window.location.hostname + ":5984/solarthing";
const DESIGN = "/_design";
const VIEW = "/_view";

let graphOptions;
let desiredLastHours = null;
let graphUpdateTimeoutID = null;

// let db = null;
// let localDB = new window.PouchDB("localDB");
// let remoteDB;
// remoteDB = new window.PouchDB("http://192.168.10.250:5984/solarthing")
// localDB.sync(remoteDB, {live: true})

// try{
// 	$.couch.urlPrefix = "http://192.168.10.250:5984";
// 	db = $.couch.db("solarthing");
// 	console.log(db);
// 	console.log("Successfully initialized the couchdb");
// } catch(err){
// 	console.error(err);
// 	console.log("unable to initialize database. That's not very relaxing!");
// }
graphOptions = {
	// title: "Cool Title",
	titleTextStyle: {
		color: "#000000"
	},
	series: {
		0: {
			targetAxisIndex: 0
		},
		1: {
			targetAxisIndex: 1
		},
		2: {
			targetAxisIndex: 1
		},
		3: {
			targetAxisIndex: 1
		},
		4: {
			targetAxisIndex: 1
		},
	},
	hAxis: {
		title: 'Time',
		logScale: false,
		// format: "hh:mm a",
		textStyle: { color: "#000000" },
		titleTextStyle: { color: "#000000" },
		gridlines: {
			color: "#000000", // probably won't show up anyway unless we use numbers
			count: 9,
		},
	},
	vAxes: {
		0: {
			title: 'Voltage',
			titleTextStyle: { color: "#FF0000" },
			viewWindowMode: "explicit",
			viewWindow: {
				max: 30,
				min: 20
			},
			gridlines: { count: 10 },
		},
		1: {
			title: "Watts",
			viewWindowMode: "explicit",
			viewWindow: {
				max: 4600,
				min: 0
			},
			gridlines: { count: 10 },
		},
		// 2: {
		// 	viewWindow: {
		// 		max: 4000,
		// 		min: 0
		// 	},
		// 	color: "#FFFFFF"
		// }
	},
	vAxis: {

		logScale: false,
		textStyle: { color: "#000000" },
		titleTextStyle: { color: "#000000" },
		gridlines: {
			color: "transparent",
		},
	},
	// timeline: {
	// 	groupByRowLabel: true
	// },
	lineWidth: 2,
	colors: [ // colors used by the lines
		'#a52714',
		'#639f1f',
		'#ff1ff3',
		'#674d1b',
		'#a29d00',
	],
	backgroundColor: "#215fe0",
	legend: {
		textStyle: { color: "#000000" }
	},
	chartArea: { width: "70%", height:200}
};
function toggleHours() {
	let firstRun = desiredLastHours == null; // is this just to initiailze and not to call drawLogScales()
	let element = document.getElementById("hours_toggle");
	let last = desiredLastHours;
	if (desiredLastHours === 2) {
		desiredLastHours = 24;
	} else {
		desiredLastHours = 2;
	}
	if (!last) {
		last = 24;
	}
	element.innerText = "Change to " + last + " hours";
	if(!firstRun) {
		clearTimeout(graphUpdateTimeoutID);
		drawLogScales();
	}
}

function drawLogScales() {
	// console.log("drawing log scales");
	const element = document.getElementById("chart_div");
	const lastHours = desiredLastHours;
	getJsonDataLastHours(lastHours, function (jsonData) {
		updateCurrent(getLastPacketCollectionFromJsonData(jsonData));

		element.innerHTML = "";

		let usedGraphData = updateGraphData(jsonData);
		let chart = new google.visualization.LineChart(element);
		let newOptions = Object.assign({}, graphOptions, {title: "Last " + lastHours + " Hours"});
		chart.draw(usedGraphData, newOptions);
		graphUpdateTimeoutID = setTimeout(drawLogScales, 12000);
	}, function(){
		console.log("got error, trying again in 3 seconds");
		graphUpdateTimeoutID = setTimeout(drawLogScales, 3000);
	});
}
function updateGraphData(jsonData){
	let graphData = new google.visualization.DataTable();
	graphData.addColumn('datetime', 'X');
	graphData.addColumn('number', 'Battery V');
	graphData.addColumn('number', 'Panel W');
	graphData.addColumn('number', "Load W");
	graphData.addColumn('number', "Gen W -> Battery");
	graphData.addColumn('number', "Gen W (Total)");

	let rows = getGraphDataFromPacketCollectionArray(jsonData.rows);
	graphData.addRows(rows);
	return graphData;
}
function updateCurrent(lastPacketCollection){
	function getDictString(dict){
		let r = "";
		let isFirst = true;
		for(let key in dict){
			let value = dict[key];
			if(!isFirst){
				r += "|";
			}
			isFirst = false;
			r += value;
		}
		return r;
	}
	// console.log("updating now. dateArray: " + lastPacketCollection.dateArray);
	let deviceInfo = "";
	let acModeDict = {};
	let operatingModeDict = {};
	let errorsFXDict = {};
	let miscModesDict = {};
	let warningsDict = {};

	let errorsMXDict = {};
	let auxModeDict = {};
	let chargerModeDict = {};

	let load = 0;

	let chargeWattsFromGenerator = 0;
	let totalWattsFromGenerator = 0;


	for(let i in lastPacketCollection.packets){
		let packet = lastPacketCollection.packets[i];
		let packetType = packet.packetType;
		let address = packet.address;
		if(packetType === "FX_STATUS"){
			// address = packet.inverterAddress;
			let batteryVoltage = packet.batteryVoltage;
			setBatteryVoltage(batteryVoltage);

			let acMode = packet.acModeName;
			let operatingMode = packet.operatingModeName;
			let errors = packet.errors;
			let miscModes = packet.miscModes;
			let warnings = packet.warnings;

			acModeDict[address] = acMode;
			operatingModeDict[address] = operatingMode;
			errorsFXDict[address] = errors;
			miscModesDict[address] = miscModes;
			warningsDict[address] = warnings;

			load += packet.outputVoltage * packet.inverterCurrent;

			chargeWattsFromGenerator += packet.inputVoltage * packet.chargerCurrent;
			totalWattsFromGenerator += packet.inputVoltage * packet.buyCurrent;
		} else if(packetType === "MXFM_STATUS"){
			// address = packet.address;
			let amps = packet.pvCurrent;
			let volts = packet.inputVoltage;
			setPanelAmpsVolts(amps, volts);

			let errors = packet.errors;
			let auxMode = packet.auxModeName;
			let chargerMode = packet.chargerModeName;
			errorsMXDict[address] = errors;
			auxModeDict[address] = auxMode;
			chargerModeDict[address] = chargerMode;
		} else {
			console.error("Unknown packet type: " + packetType);
		}
		if(deviceInfo){
			deviceInfo += "|";
		}
		let splitPacketType = packetType.split("_");
		deviceInfo += address + ":" + splitPacketType[0];
	}
	setIDText("packets_info", deviceInfo);
	setIDText("operating_mode", getDictString(operatingModeDict));
	setIDText("ac_mode", getDictString(acModeDict));
	setIDText("aux_mode", getDictString(auxModeDict));
	setIDText("charger_mode", getDictString(chargerModeDict));
	setIDText("misc_mode", getDictString(miscModesDict));
	setIDText("warnings", getDictString(warningsDict));
	setIDText("errors_fx", getDictString(errorsFXDict));
	setIDText("errors_mx", getDictString(errorsMXDict));
	//
	setIDText("load", load);
	//
	setIDText("generator_status", totalWattsFromGenerator === 0 ? "OFF" : "ON");
	setIDText("generator_total_watts", totalWattsFromGenerator);
	setIDText("generator_charge_watts", chargeWattsFromGenerator);
}
function getLastPacketCollectionFromJsonData(jsonData){
	let rows = jsonData.rows;
	return rows[rows.length - 1].value
}

function getGraphDataFromPacketCollectionArray(packetCollectionArray){
	let r = [];
	for(let i in packetCollectionArray){
		let packetCollection = packetCollectionArray[i].value;
		let dateArray = packetCollection.dateArray;
		// console.log(dateArray);
		// some set to 0 because we want to do +=, otherwise set to null
		let date = new Date(dateArray[0], dateArray[1], dateArray[2], dateArray[3], dateArray[4], dateArray[5]);
		let graphData = [date, 0, null, null, 0, 0];
		//           <        date     >, <battery volt>, <solar panel>, <load>, <generator to batteries>, <total from generator>
		// console.log(packetCollection.packets);
		for(let j in packetCollection.packets){
			let packet = packetCollection.packets[j];
			// console.log(packet);
			let packetType = packet.packetType;
			// console.log(packetType);
			if(packetType === "FX_STATUS"){
				graphData[1] = packet.batteryVoltage;
				graphData[3] += packet.outputVoltage * packet.inverterCurrent;
				graphData[4] += packet.inputVoltage * packet.chargerCurrent;
				graphData[5] += packet.inputVoltage * packet.buyCurrent;
			} else if(packetType === "MXFM_STATUS"){
				let amps = packet.pvCurrent;
				let volts = packet.inputVoltage;
				let watts = amps * volts;
				graphData[2] = watts;
			} else {
				console.error("Unknown packet type: " + packetType);
			}
		}
		let lastData = null;
		if(r.length){
			lastData = r[r.length - 1];
		}
		// if(graphData[0][1] % 5 === 0) { // only add data from 5 minute intervals
		if(!graphData[5]) { // don't draw generator voltage line unless it's in use
			if (!lastData || !lastData[4]) { // set to null only if the there wasn't lastData or if it was 0 or null
				graphData[5] = null;
				graphData[4] = null;
			}
		} else if(lastData){
			if(!lastData[5]){ // if the last generator voltage is null (or 0) set to 0 to make sure line is drawn
				lastData[5] = 0;
				lastData[4] = 0;
			}
		}
		r.push(graphData);
	}
	return r;
}
/**
 * @param lastHours The amount of hours back to get data from that time to the current time
 * @param onSuccessFunction A function that will be passed a parameter with the desired rows of data ->
 *          Array for the last lastHours hours(2D array where each sub array has a length of 3)
 */
function getJsonDataLastHours(lastHours, onSuccessFunction, onFailFunction=null){
	let date = new Date();
	date.setSeconds(0);
	date.setMilliseconds(0);

	date.setMinutes(Math.floor(date.getMinutes() / 5.0) * 5);
	date.setTime(date.getTime() - lastHours * 60 * 60 * 1000);
	getJsonDataSince(date, onSuccessFunction, onFailFunction);
}
function getJsonDataSince(date, onSuccessFunction, onFailFunction=null){

	let minMillis = date.getTime();
	getJsonDataFromUrl(DATABASE_URL + DESIGN + "/packets" + VIEW + "/millis" + "?startkey=" + minMillis, onSuccessFunction, onFailFunction);

}
function getJsonDataFromUrl(urlString, onSuccessFunction, onFailFunction=null){
	$.getJSON(urlString,
	function(jsonData){
		onSuccessFunction(jsonData);
	}).fail(function(){
		if(onFailFunction){
			onFailFunction();
		}
	});
}
function getDateString(date){
	let hour = date.getHours();
	let ampmString = "AM";
	if(hour > 12){
		ampmString = "PM";
		hour -= 12;
	}
	if(hour === 0){
		hour = 12;
	}
	let minuteString = "" + date.getMinutes();
	if(minuteString.length === 1){
		minuteString = "0" + minuteString;
	}
	return "" + hour + ":" + minuteString + " " + ampmString;
}
function setBatteryVoltage(volts){
	if(volts == null){
		volts = "?";
	}
	document.getElementById("battery_voltage").innerHTML = volts;
}
function setPanelAmpsVolts(amps, volts){
	let watts;
	if(amps == null || volts == null){
		amps = "?";
		volts = "?";
		watts = "?";
	} else {
		watts = amps * volts;
	}
	// document.getElementById("panel_watts").innerHTML = watts;
	setIDText("panel_watts", watts);
	// document.getElementById("panel_amps").innerHTML = amps;
	setIDText("panel_amps", amps);
	// document.getElementById("panel_volts").innerHTML = volts;
	setIDText("panel_volts", volts);

}
function setIDText(idString, text){
	document.getElementById(idString).innerText = text;
}
function getJsonObjectFromUrl(urlString) {
    return $.getJSON(urlString);
}


function main(){
	setBatteryVoltage(null);
	setPanelAmpsVolts(null, null);
	setIDText("generator_status", "?");
	setIDText("generator_total_watts", "?");
	setIDText("generator_charge_watts", "?");
	setIDText("load", "?");
	toggleHours();
}
main();
