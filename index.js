google.charts.load('current', {packages: ['corechart', 'line']});
google.charts.setOnLoadCallback(drawLogScales);

db = null;
try{

} catch(e){
	console.log("unable to initialize database. That's not very relaxing!");
}

function drawLogScales() {
	let element = document.getElementById("chart_div");
	let data = new google.visualization.DataTable();
	data.addColumn('string', 'X');
	data.addColumn('number', 'Battery Voltage');
	data.addColumn('number', 'Panel Voltage');

	data.addRows([
		["0:00", 0, 0], ["1:00", 10, 5], ["2:00", 23, 15], ["3:00", 17, 9], ["4:00", 18, 10], ["5:00", 9, 5]
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
            gridlines: { color: "#000000" }
		},
		vAxis: {
			title: 'Voltage',
			logScale: false,
            textStyle: { color: "#000000" },
            titleTextStyle: { color: "#000000" },
            gridlines: { color: "#000000" }
		},
        lineWidth: 5,
		colors: ['#a52714',
			'#097138'],
		backgroundColor: element.style["background-color"],
		legend: {
	    	textStyle: { color: "#000000" }
		},
		chartArea: { width: "50%" }
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
