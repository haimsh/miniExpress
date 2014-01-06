/**
 * Created by ShachorFam on 12/12/13.
 */
var active = false;
exports.startCallBack = function (callBackDesc) {
    if (active) {
        console.log(callBackDesc + ': started...');
    }
};

exports.endCallBack = function (callBackDesc) {
    if (active) {
        console.log(callBackDesc + ': ended!');
    }
};

exports.activate = function () {
    active = true;
};