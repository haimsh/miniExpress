function Calculator() {
	var value = 0;
	this["add"] = function(num) {
		value += num;
	};
	this["mul"] = function(num) {
		value *= num;
	};
	this["clear"] = function() {
		value = 0;
	};
	this.getValue = function() {
		return value;
	};
	this.setValue = function(newVal) {
		value = newVal;
	};
}