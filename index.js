'use strict';
google.charts.load('current', {packages: ['corechart', 'line']});
google.charts.setOnLoadCallback(function(){
	console.log("got callback");
	console.log("$: " + $);
	drawLogScales();
	updateOuthouse()
});
// TODO Possibly use this in future: https://stackoverflow.com/a/14521482/5434860 + prompt("enter ip", "default ip") for couchdb

const DATABASE_URL = window.location.protocol === "file:" ?
	"http://192.168.10.250:5984" :
	window.location.protocol + "//" +  window.location.hostname + ":5984";
const SOLAR_DB = "/solarthing";
const OUTHOUSE_DB = "/outhouse"
const DESIGN = "/_design";
const VIEW = "/_view";

let desiredLastHours = null;
let graphUpdateTimeoutID = null;
let outhouseUpdateTimeoutID = null;

const graphOptions = {
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
		for(const key in dict){
			const value = dict[key];
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
	const acModeDict = {};
	const operatingModeDict = {};
	const errorsFXDict = {};
	const miscModesDict = {};
	const warningsDict = {};

	const errorsMXDict = {};
	const auxModeDict = {};
	const chargerModeDict = {};

	let load = 0;

	let chargeWattsFromGenerator = 0;
	let totalWattsFromGenerator = 0;


	let pvWatts = 0;
	let chargerWatts = 0;
	for(const packet of lastPacketCollection.packets){
		let packetType = packet.packetType;
		let address = packet.address;
		if(deviceInfo){
			deviceInfo += "|";
		}
		if(packetType === "FX_STATUS"){
		    deviceInfo += "FX";
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
			deviceInfo += "MX";
			// address = packet.address;
			pvWatts += packet.pvCurrent * packet.inputVoltage;
			chargerWatts += packet.chargerCurrent * packet.batteryVoltage;

			const errors = packet.errors;
			const auxMode = packet.auxModeName;
			const chargerMode = packet.chargerModeName;
			errorsMXDict[address] = errors;
			auxModeDict[address] = auxMode;
			chargerModeDict[address] = chargerMode;
		} else {
		    deviceInfo += "UNKNOWN";
			console.error("Unknown packet type: " + packetType);
		}
	}
	setPVAndCharger(pvWatts, chargerWatts);
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
	for(const packetCollectionValue of packetCollectionArray){
		const packetCollection = packetCollectionValue.value;
		const dateArray = packetCollection.dateArray;
		// some set to 0 because we want to do +=, otherwise set to null
		const date = new Date(dateArray[0], dateArray[1], dateArray[2], dateArray[3], dateArray[4], dateArray[5]);
		const graphData = [date, 0, 0, null, 0, 0];
		//           <        date     >, <battery volt>, <solar panel>, <load>, <generator to batteries>, <total from generator>
		// console.log(packetCollection.packets);
		for(const packet of packetCollection.packets){
			const packetType = packet.packetType;
			if(packetType === "FX_STATUS"){
				graphData[1] = packet.batteryVoltage;
				graphData[3] += packet.outputVoltage * packet.inverterCurrent;
				graphData[4] += packet.inputVoltage * packet.chargerCurrent;
				graphData[5] += packet.inputVoltage * packet.buyCurrent;
			} else if(packetType === "MXFM_STATUS"){
				const amps = packet.pvCurrent;
				const volts = packet.inputVoltage;
				const watts = amps * volts;
				graphData[2] += watts;
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
 * @param onFailFunction The function to be called if it fails or null
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
	getJsonDataFromUrl(DATABASE_URL + SOLAR_DB + DESIGN + "/packets" + VIEW + "/millis" + "?startkey=" + minMillis, onSuccessFunction, onFailFunction);

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
function setBatteryVoltage(volts){
	if(volts == null){
		volts = "?";
	}
	document.getElementById("battery_voltage").innerHTML = volts;
}
function setPVAndCharger(pv, charger){
	setIDText("panel_watts", pv);
	setIDText("charger", charger == null ? null : charger.toFixed(1));
}
function setIDText(idString, text){
	document.getElementById(idString).innerText = text;
}
function getJsonObjectFromUrl(urlString) {
    return $.getJSON(urlString);
}

function updateOuthouse() {
    const minMillis = new Date().getTime() - 5 * 60 * 1000;
	getJsonDataFromUrl(DATABASE_URL + OUTHOUSE_DB + DESIGN + "/packets" + VIEW + "/millis" + "?startkey=" + minMillis, function(jsonData){
		console.log(jsonData);
		const packetCollections = jsonData.rows;
		let minDate = 0;
		let newestCollection = null;
		for(const packetCollectionValue of packetCollections){
			const packetCollection = packetCollectionValue.value
			const dateMillis = packetCollection.dateMillis;
			if(dateMillis > minDate){
				newestCollection = packetCollection;
				minDate = dateMillis;
			}
		}
		if(newestCollection != null){
			console.log("newestCollection:");
			console.log(newestCollection);
			let occupied = false;
			let temperatureCelsius = null;
			let humidity = null;

			let doorOpen = false;
			let lastClose = null;
			let lastOpen = null;
			for(const packet of newestCollection.packets){
				if(packet.packetType === "OCCUPANCY"){
					occupied = packet.occupancy === 1
				} else if(packet.packetType === "WEATHER"){
					temperatureCelsius = packet.temperatureCelsius;
					humidity = packet.humidityPercent;
				} else if(packet.packetType === "DOOR") {
					console.log(packet);
					doorOpen = packet.isOpen;
					lastClose = packet.lastCloseTimeMillis;
					lastOpen = packet.lastOpenTimeMillis;
				} else {
					console.error("unknown packetType: " + packet.packetType);
				}
			}
			setIDText("occupancy", occupied ? "occupied" : "vacant");
			setIDText("temperature_f", temperatureCelsius == null ? "?" : toF(temperatureCelsius).toFixed(1));
			setIDText("humidity", humidity == null ? "?" : humidity);
			setIDText("door", doorOpen ? "open" : "closed");
			setIDText("door_last_close", lastClose ? moment(new Date(lastClose)).fromNow() : "unknown");
			setIDText("door_last_open", lastOpen ? moment(new Date(lastOpen)).fromNow() : "unknown");
		} else {
			console.log("no outhouse packets");
		}
		outhouseUpdateTimeoutID = setTimeout(updateOuthouse, 12000);
	}, function(){
		console.log("got error, trying again in 3 seconds");
		outhouseUpdateTimeoutID = setTimeout(updateOuthouse, 3000);
	});
}
function toF(celsius){
	return celsius * 1.8 + 32;
}


function main(){
	setBatteryVoltage(null);
	setPVAndCharger(null, null);
	setIDText("generator_status", "?");
	setIDText("generator_total_watts", "?");
	setIDText("generator_charge_watts", "?");
	setIDText("load", "?");
	toggleHours();

	setIDText("occupancy", "?");
	setIDText("temperature_f", "?");
	setIDText("humidity", "?");
	setIDText("door", null);
	setIDText("door_last_close", null);
	setIDText("door_last_open", null);
}
main();
