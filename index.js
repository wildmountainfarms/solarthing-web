'use strict';
google.charts.load('current', {packages: ['corechart', 'line']});
google.charts.setOnLoadCallback(drawLogScales);
// TODO Possibly use this in future: https://stackoverflow.com/a/14521482/5434860 + prompt("enter ip", "default ip") for couchdb

const DATABASE_URL = "http://192.168.10.250:5984/solarthing";
const DESIGN = "/_design";
const VIEW = "/_view";
let graphOptions;

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
		}
	},
	hAxis: {
		title: 'Time',
		logScale: false,
		format: "hh:mm a",
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
				max: 3000,
				min: 0
			},
			gridlines: { count: 10 },
		},
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
	lineWidth: 3,
	colors: ['#a52714',
		'#9f9e03'],
	backgroundColor: "#225fe0",
	legend: {
		textStyle: { color: "#000000" }
	},
	chartArea: { width: 500 }
};

function drawLogScales() {
	let element = document.getElementById("chart_div");
	let data = new google.visualization.DataTable();
	data.addColumn('timeofday', 'X');
	data.addColumn('number', 'Battery Voltage');
	data.addColumn('number', 'Panel Voltage');
	getGraphDataLastHours(2, function(rows){
		console.log(rows);
		data.addRows(rows);
		let chart = new google.visualization.LineChart(element);
		// credit to: https://stackoverflow.com/a/171256/5434860
		chart.draw(data, {...graphOptions, ...{title: "Last 2 Hours"}});
	});
}

function getGraphDataFromPacketCollectionArray(packetCollectionArray){
	let r = [];
	for(let indexKey in packetCollectionArray){
		let packetCollection = packetCollectionArray[indexKey].value;
		let dateArray = packetCollection.dateArray;
		console.log(dateArray);
		let graphData = [[dateArray[3], dateArray[4]], null, null];
		// for(let packetIndexKey in packetCollection.packets){
		// 	let packet = packetCollection.packets[packetIndexKey].value;
		// console.log(packetCollection.packets);
		for(let packetIndexKey in packetCollection.packets){
			let packet = packetCollection.packets[packetIndexKey];
			// console.log(packet);
			let packetType = packet.packetType;
			// console.log(packetType);
			if(packetType === "FX_STATUS"){
				graphData[1] = packet.batteryVoltage;
			} else if(packetType === "MXFM_STATUS"){
				let amps = packet.pvCurrent;
				let volts = packet.inputVoltage;
				let watts = amps * volts;
				graphData[2] = watts;
			} else {
				console.error("Unknown packet type: " + packetType);
			}
		}
		// if(graphData[0][1] % 5 === 0) { // only add data from 5 minute intervals
		r.push(graphData);
	}
	return r;
}
/**
 * @param lastHours The amount of hours back to get data from that time to the current time
 * @param onSuccessFunction A function that will be passed a parameter with the desired rows of data ->
 *          Array for the last lastHours hours(2D array where each sub array has a length of 3)
 */
function getGraphDataLastHours(lastHours, onSuccessFunction){
	let date = new Date();
	date.setMinutes(Math.floor(date.getMinutes() / 5.0) * 5);
	date.setHours(date.getHours() - lastHours);
	getGraphDataSince(date, onSuccessFunction);
}
function getGraphDataSince(date, onSuccessFunction){
	getJsonDataSince(date, function(jsonData){
		let r = getGraphDataFromPacketCollectionArray(jsonData.rows);
		onSuccessFunction(r);
	});
}
function getJsonDataSince(date, onSuccessFunction){

	let minMillis = date.getTime();
	getJsonDataFromUrl(DATABASE_URL + DESIGN + "/packets" + VIEW + "/millis" + "?startkey=" + minMillis, onSuccessFunction);
}
function getJsonDataFromUrl(urlString, onSuccessFunction){
	$.getJSON(urlString,
		function(jsonData){
			onSuccessFunction(jsonData);
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
	document.getElementById("panel_watts").innerHTML = watts;
	document.getElementById("panel_amps").innerHTML = amps;
	document.getElementById("panel_volts").innerHTML = volts;

}
function getJsonObjectFromUrl(urlString) {
    return $.getJSON(urlString);
}


function main(){
	setBatteryVoltage(null);
	setPanelAmpsVolts(null, null);
}
main();
