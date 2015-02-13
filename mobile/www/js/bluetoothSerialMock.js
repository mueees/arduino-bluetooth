var bluetoothSerial = {};

var devices = [
    {
        name: "Device 1",
        address: "address 1"
    },
    {
        name: "Device 2",
        address: "address 2"
    },
    {
        name: "Device 3",
        address: "address 3"
    }
];
var delay = 30;
var interval;

bluetoothSerial.list = function (success, error) {
    setTimeout(function () {
        success(devices);
    }, delay);
};
bluetoothSerial.connect = function (id, success, error) {
    setTimeout(function () {
        success();
    }, delay);
};
bluetoothSerial.unsubscribe = function (success, errpor) {
    setTimeout(function () {
        if(interval){
            clearInterval(interval);
        }
        interval = null;
        success();
    }, delay);
};
bluetoothSerial.subscribe = function (delimeter, callback) {
    var i = 1;

    function getValue() {
        return Math.random() * 99 + 1;
    }

    interval = setInterval(function () {
        var val = getValue();
        switch (i){
            case 1:
                callback('t:' + val);
                i++;
                break;
            case 2:
                callback('h:' + val);
                i++;
                break;
            case 3:
                callback('c:' + val);
                i = 1;
                break;
        }
    }, 30);
};