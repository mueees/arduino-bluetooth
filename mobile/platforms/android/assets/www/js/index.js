/* jshint quotmark: false, unused: vars, browser: true */
/* global cordova, console, $, bluetoothSerial, _, refreshButton, deviceList, previewColor, red, green, blue, disconnectButton, connectionScreen, colorScreen, rgbText, messageDiv */
'use strict';

var mac = '00:12:09:11:01:52';

var app2 = {
    initialize: function(){
        this.bind();
    },

    bind: function() {
        document.addEventListener('deviceready', this.deviceready, false);
    },

    deviceready: function(){
        $('.statusDevice').remove();
        app2.$status = $('.status');
        app2.$message = $('.message');

        app2.$temp = $('.temp');
        app2.$humidity = $('.humidity');

        app2.$status.html('Connecting to device');

        bluetoothSerial.connect(mac, app2.connectSuccess, app2.connectFailure);
    },

    connectSuccess: function(){
        app2.$status.html('Connected');
        bluetoothSerial.subscribe('\n', app2.display);
    },

    connectFailure: function(){
        alert('Cannot connect');
        app2.$status.html('Cannot connect');
    },

    display: function(message){
        if( message[0] == 't' ){
            app2.$temp.html( message.slice(2) );
        }else if(message[0] == 'h'){
            app2.$humidity.html( message.slice(2) );
        }
    }
}