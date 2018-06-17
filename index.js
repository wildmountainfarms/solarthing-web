google.charts.load('current', {packages: ['corechart', 'line']});
google.charts.setOnLoadCallback(drawLogScales);

function drawLogScales() {
	let data = new google.visualization.DataTable();
	data.addColumn('number', 'X');
	data.addColumn('number', 'Power coming in');
	data.addColumn('number', 'Power being used');

	data.addRows([
		[0, 0, 0], [1, 10, 5], [2, 23, 15], [3, 17, 9], [4, 18, 10], [5, 9, 5]
	]);

	let options = {
		hAxis: {
			title: 'Time',
			logScale: false
		},
		vAxis: {
			title: 'Popularity',
			logScale: false
		},
		colors: ['#a52714',
			'#097138']
	};

	let chart = new google.visualization.LineChart(document.getElementById('chart_div'));
	chart.draw(data, options);
}
function setBatteryVoltage(volts){
    document.getElementById("battery_voltage").innerHTML = volts;
}
function setPanelAmps(amps){
    document.getElementById("panel_amps").innerHTML = amps;
}
function setPanelVolts(volts){
    document.getElementById("panel_volts").innerHTML = volts;
}


function main(){
	setBatteryVoltage(0);
	setPanelAmps(0);
	setPanelVolts(0);
}
main();
