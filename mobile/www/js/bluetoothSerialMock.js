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

bluetoothSerial.list = function (success, error) {
    setTimeout(function () {
        success(devices);
    }, 1000);
};

bluetoothSerial.connect = function (id, success, error) {
    setTimeout(function () {
        success();
    }, 1000);
};
bluetoothSerial.unsubscribe = function (success, errpor) {
    setTimeout(function () {
        success();
    }, 1000);
};
bluetoothSerial.subscribe = function (delimeter, callback) {
    var i = 1;

    function getValue() {
        return Math.random() * 99 + 1;
    }

    setInterval(function () {
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
    }, 1200);
};