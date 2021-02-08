'use strict';
google.charts.load('current', {packages: ['corechart', 'line']});
google.charts.setOnLoadCallback(function(){
	console.log("got callback");
	console.log("$: " + $);
	drawLogScales();
});
const URL_PARAMETERS = new URLSearchParams(window.location.search);
const DATABASE_URL_PARAM = URL_PARAMETERS.get("database");

// This expression is used to determine the database. If you'd like, you can replace it entirely with what you
//     want your database url to be. However, if you are hosting this on the same computer as the database, you
//     don't actually need to change this, as it will automatically use the ip and CouchDB's default port
const DATABASE_URL = DATABASE_URL_PARAM != null ? DATABASE_URL_PARAM : (window.location.protocol === "file:" ?
	"http://192.168.10.250:5984" :
	window.location.protocol + "//" +  window.location.hostname + ":5984");
const SOURCE_ID = "default";
console.log("database url: " + DATABASE_URL);
const SOLAR_DB = "/solarthing";
const DESIGN = "/_design";
const VIEW = "/_view";

let desiredLastHours = null;
let graphUpdateTimeoutID = null;

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

function jsonDataToPacketCollectionArray(jsonData){
	const packetCollections = [];
	for(const row of jsonData.rows){
		packetCollections.push(row.value);
	}
	return packetCollections;
}

function drawLogScales() {
	// console.log("drawing log scales");
	const element = document.getElementById("chart_div");
	const lastHours = desiredLastHours;
	getJsonDataLastHours(lastHours, function (jsonData) {
	    const map = sortPackets(jsonDataToPacketCollectionArray(jsonData), 2 * 60 * 1000);
	    const packets = map.get(SOURCE_ID);
	    console.log(map);
		updateCurrentSolar(packets[packets.length - 1]);

		element.innerHTML = "";

		let usedGraphData = updateSolarGraphData(packets);
		let chart = new google.visualization.LineChart(element);
		let newOptions = Object.assign({}, graphOptions, {title: "Last " + lastHours + " Hours"});
		chart.draw(usedGraphData, newOptions);
		graphUpdateTimeoutID = setTimeout(drawLogScales, 12000);
	}, function(){
		console.log("got error, trying again in 3 seconds");
		graphUpdateTimeoutID = setTimeout(drawLogScales, 3000);
	});
}
function updateSolarGraphData(packets){
	let graphData = new google.visualization.DataTable();
	graphData.addColumn('datetime', 'X');
	graphData.addColumn('number', 'Battery V');
	graphData.addColumn('number', 'Panel W');
	graphData.addColumn('number', "Load W");
	graphData.addColumn('number', "Gen W -> Battery");
	graphData.addColumn('number', "Gen W (Total)");

	graphData.addRows(getGraphDataFromPacketCollectionArray(packets));
	return graphData;
}
function updateCurrentSolar(lastPacketCollection){
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

	const errorsRoverDict = {};

	let load = 0;

	let chargeWattsFromGenerator = 0;
	let totalWattsFromGenerator = 0;


	let pvWatts = 0;
	let chargerWatts = 0;
	let batteryVoltage = null;
	for(const packet of lastPacketCollection.packets){
		let packetType = packet.packetType;
		let address = packet.address;
		let wasKnownPacket = true;
		if(packetType === "FX_STATUS"){
		    deviceInfo += "FX";
			// address = packet.inverterAddress;
            if (!batteryVoltage) {
				batteryVoltage = packet.batteryVoltage;
			}

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
			if (!batteryVoltage) {
				batteryVoltage = packet.batteryVoltage;
			}
			pvWatts += packet.pvCurrent * packet.inputVoltage;
			chargerWatts += packet.chargerCurrent * packet.batteryVoltage;

			const errors = packet.errors;
			const auxMode = packet.auxModeName;
			const chargerMode = packet.chargerModeName;
			errorsMXDict[address] = errors;
			auxModeDict[address] = auxMode;
			chargerModeDict[address] = chargerMode;
		} else if(packetType === "RENOGY_ROVER_STATUS"){
			if (!batteryVoltage) {
				batteryVoltage = packet.batteryVoltage;
			}
			const serial = packet.productSerialNumber;
			pvWatts += packet.pvCurrent * packet.inputVoltage;
			chargerWatts += packet.chargingPower;
			errorsRoverDict[serial] = packet.errors;
			chargerModeDict[serial] = packet.chargingStateName;
			deviceInfo += "Rover";
		} else {
			console.error("Unknown packet type: " + packetType);
			wasKnownPacket = false;
		}
		setBatteryVoltage(batteryVoltage);
		if(wasKnownPacket){
			deviceInfo += "|";
		}
	}
	deviceInfo = deviceInfo.substr(0, deviceInfo.length - 1);
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
	setIDText("errors_rover", getDictString(errorsRoverDict));
	//
	setIDText("load", load);
	//
	setIDText("generator_status", totalWattsFromGenerator === 0 ? "OFF" : "ON");
	setIDText("generator_total_watts", totalWattsFromGenerator);
	setIDText("generator_charge_watts", chargeWattsFromGenerator);
}

function getGraphDataFromPacketCollectionArray(packetCollectionArray){
	let r = [];
	for(const packetCollectionValue of packetCollectionArray){
		const packetCollection = packetCollectionValue;
		// const dateArray = packetCollection.dateArray;
		// some set to 0 because we want to do +=, otherwise set to null
		// const date = new Date(dateArray[0], dateArray[1], dateArray[2], dateArray[3], dateArray[4], dateArray[5]);
		const date = new Date(packetCollection.dateMillis);
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
			} else if(packetType === "RENGOY_ROVER_STATUS"){
				const power = packet.pvCurrent * packet.inputVoltage;
				graphData[2] += power;
			} else {
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
	// It would be nice to add explicit gzip encoding here, but the browser should do that automatically: https://stackoverflow.com/a/3778750/5434860
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
	} else {
		volts = volts.toFixed(1);
	}
	document.getElementById("battery_voltage").innerHTML = volts;
}
function setPVAndCharger(pv, charger){
	setIDText("panel_watts", pv == null ? null : pv.toFixed(1));
	setIDText("charger", charger == null ? null : charger.toFixed(1));
}
function setIDText(idString, text){
	document.getElementById(idString).innerText = text;
}
function getJsonObjectFromUrl(urlString) {
    return $.getJSON(urlString);
}

class PacketGroup {
	constructor(packets, dateMillis, extraDateMillisPacketMap = null){
		this.packets = packets;
		this.dateMillis = dateMillis;
		this.extraDateMillisPacketMap = extraDateMillisPacketMap;
	}
}

class ParsedPacketGroup extends PacketGroup{
	constructor(packets, dateMillis, sourceId, fragmentId){
		super(packets, dateMillis);
		this.sourceId = sourceId;
		this.fragmentId = fragmentId;
	}
}

function sortPackets(groups, maxTimeDistance = (60 * 1000)) {
    const map = new Map();
    for(const group of groups){
        const packets = [];
        let sourceId = "default";
        let fragmentId = null; // int or null
        console.log(group);
        for(const packet of group.packets){
        	switch(packet.packetType){
				case "SOURCE":
					sourceId = packet.sourceId;
					break;
				case "FRAGMENT_INDICATOR":
					fragmentId = packet.fragmentId;
					break;
				default:
					packets.push(packet); // this must be a normal packet
					break;
			}
        }
        let list = map.get(sourceId);
        if(list == null){
        	list = [];
        	map.set(sourceId, list);
		}
        list.push(new ParsedPacketGroup(packets, group.dateMillis, sourceId, fragmentId));
    }
    const r = new Map(); // HashMap<String, List<PacketGroup>>()
    for(const entry of map.entries()){
    	const sourceId = entry[0]; // sourceId will be the same for everything in list
    	const list = entry[1];

        const fragmentMap = new Map(); //HashMap<Int?, MutableList<ParsedPacketGroup>>()
        for(const packetGroup of list){
        	let newList = fragmentMap.get(packetGroup.fragmentId);
        	if(newList == null){
        		newList = [];
        		fragmentMap.set(packetGroup.fragmentId, newList);
			}
        	newList.push(packetGroup);
        }
        const fragmentIds = Array.from(fragmentMap.keys());
        fragmentIds.sort(function(o1, o2){
            if(o1 == null){
            	return 1;
			}
            if(o2 == null){
            	return -1;
			}
            return o1 - o2;
		});
        const masterFragmentId = fragmentIds[0];
        const masterList = fragmentMap.get(masterFragmentId);
        const packetGroups = []; // mutableListOf<PacketGroup>()
        for(const masterGroup of masterList){
            const extraDateMillisPacketMap = new Map(); //HashMap<Packet, Long>()
            const packetList = [];// mutableListOf<Packet>()
            for(const masterPacket of masterGroup.packets){
				packetList.push(masterPacket);
                extraDateMillisPacketMap[masterPacket] = masterGroup.dateMillis
            }
            for(const fragmentId of fragmentIds){
                if(fragmentId === masterFragmentId) continue;
                const packetGroupList = fragmentMap.get(fragmentId); //: List<ParsedPacketGroup> = fragmentMap[fragmentId]!!
                // now we want to find the closest packet group
                // TODO This is a perfect place to use binary search
                let closest = null; //: ParsedPacketGroup?
                let smallestTime = null; // time since epoch in millis
                for(const packetGroup of packetGroupList){
                    const timeDistance = Math.abs(packetGroup.dateMillis - masterGroup.dateMillis);
                    if(smallestTime == null || timeDistance < smallestTime){
                        closest = packetGroup;
                        smallestTime = timeDistance;
                    }
                }
                if(closest == null || smallestTime == null){
                	throw "closest or smallestTime is null!";
				}
                if(smallestTime < maxTimeDistance){
                    for(const packet of closest.packets){
						packetList.push(packet);
                        extraDateMillisPacketMap[packet] = closest.dateMillis;
                    }
                }
            }
            packetGroups.push(new PacketGroup(packetList, masterGroup.dateMillis, extraDateMillisPacketMap))
        }
        r.set(sourceId, packetGroups);
    }
    return r;
}

function main(){
	setBatteryVoltage(null);
	setPVAndCharger(null, null);
	setIDText("generator_status", "?");
	setIDText("generator_total_watts", "?");
	setIDText("generator_charge_watts", "?");
	setIDText("load", "?");
	toggleHours();
}
main();
