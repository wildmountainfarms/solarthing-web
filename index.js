google.charts.load('current', {packages: ['corechart', 'line']});
google.charts.setOnLoadCallback(drawLogScales);
// TODO Possibly use this in future: https://stackoverflow.com/a/14521482/5434860 + prompt("enter ip", "default ip") for couchdb

var db = null;
try{
	db = $.couch.db('databaseName');
} catch(err){
	console.error(err);
	console.log("unable to initialize database. That's not very relaxing!");
}

function drawLogScales() {
	let element = document.getElementById("chart_div");
	let data = new google.visualization.DataTable();
	data.addColumn('string', 'X');
	data.addColumn('number', 'Battery Voltage');
	data.addColumn('number', 'Panel Voltage');

	data.addRows([
		["0:00", 22.4, 15.9],
		["1:00", 10.2, 5.8],
		["2:00", 23.7, 15.9],
		["3:00", 17, 9],
		["4:00", 18, 10],
		["5:00", 9, 5],
	]);

	let options = {
		title: "Cool Title",
		titleTextStyle: {
			color: "#000000"
		},
		hAxis: {
			title: 'Time',
			logScale: false,
			textStyle: { color: "#000000" },
			titleTextStyle: { color: "#000000" },
			gridlines: {
				color: "#000000", // probably won't show up anyway unless we use numbers
			},
		},
		vAxis: {
			title: 'Voltage',
			logScale: false,
			textStyle: { color: "#000000" },
			titleTextStyle: { color: "#000000" },
			gridlines: {
				color: "#000000",
				count: 6
			},
			viewWindowMode: "explicit",
			viewWindow: {
				max: 30,
				min: 0
			}
		},
		lineWidth: 5,
		colors: ['#a52714',
			'#9f9e03'],
		backgroundColor: element.style["background-color"],
		legend: {
			textStyle: { color: "#000000" }
		},
		chartArea: { width: 500 }
	};

	let chart = new google.visualization.LineChart(element);
	chart.draw(data, options);
}
function setBatteryVoltage(volts){
	if(volts == null){
		volts = "?";
	}
	document.getElementById("battery_voltage").innerHTML = volts;
}
function setPanelAmps(amps){
	if(amps == null){
		amps = "?";
	}
	document.getElementById("panel_amps").innerHTML = amps;
}
function setPanelVolts(volts){
	if(volts == null){
		volts = "?";
	}
	document.getElementById("panel_volts").innerHTML = volts;
}


function main(){
	setBatteryVoltage(null);
	setPanelAmps(null);
	setPanelVolts(null);
}
main();
