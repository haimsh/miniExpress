var A = { 
	fieldA:0
} ;

function bCtor() {
	this.fieldB = 1;
};

function cCtor() {
	this.fieldC = 2;
};

function dCtor() {
	this.fieldD = 3;
};

bCtor.prototype = A;
var B = new bCtor();

cCtor.prototype = B;
var C = new cCtor();

dCtor.prototype = C;
var D = new dCtor();
