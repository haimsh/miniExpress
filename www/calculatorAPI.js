var calc = new Calculator();

function startCalculator() {
	if (!checkForm()) {
		return;
	}
	$("#calculator").show();
	$("#profile").hide();
	updateCalc(calc);
	$("input#calculatorInput").keypress(checkNum).val("");
	$("input.calculatorOperation").click(doOperation);
	$("input#calculatorSet").click(settings);
	$("input#clear").click(clearCalculator);
}

function checkNum(event) {
	return( event.which >=48 && event.which <= 57 ||
			event.which == 0 || event.which == 8);
}

function clearCalculator() {
	$("input#calculatorInput").val("");
}

function settings() {
	do {
		var strVal = window.prompt("Please enter new calculator value", "0");
		if (strVal == null) {
			return;
		}
		newVal = parseInt(strVal);
		if (isNaN(newVal) || newVal != strVal) {
			alert("Invalid value");
		}
	} while (isNaN(newVal) || newVal != strVal);
	calc.setValue(newVal);
	updateCalc(calc);
}

function doOperation(event) {
	input = $("input#calculatorInput");
	calc[event.target.id](parseInt(input.val()));
	updateCalc(calc);
}

function updateCalc(calc) {
	$("#calculatorDisplay").val(calc.getValue());
}

function loadEventListeners(){ 
	$("#calculator").hide();
	$("input.send").click(startCalculator);
}

$(document).ready(loadEventListeners);

function checkForm() {
	return $("#username").val() === "admin" && $("#password").val() === "admin";
}
