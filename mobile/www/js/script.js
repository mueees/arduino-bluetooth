$(document).ready(function () {

    var app = {
        currentState: null,
        states: {},
        constructors: {

        },
        elements: {}
    };

    app.elements = {
        placeholder: $(".content"),
        status: $('.status')
    };

    app.initialize = function () {
        document.addEventListener('deviceready', function deviceready(){
            app.goToState('chooseBluetooth');
        }, false);
    };

    app.setStatus = function (message) {
        app.elements.status.html(message);
    };

    app.clearStatus = function () {
        app.elements.status.html('');
    };

    app.goToState = function (state, params) {
        //stop previous state
        if(app.currentState && app.currentState.stop){
            app.currentState.stop();
        }

        //clear dom
        app.elements.placeholder.html('');

        if(!app.states[state]){
            throw new Error("State should exist");
        }

        app.currentState = new app.states[state]();
        if(app.currentState.initialize) app.currentState.initialize(params);
    };

    app.states = {
        chooseBluetooth: ControllerBluetooth,
        main: ControllerMain
    };

    function ControllerBluetooth(){}
    ControllerBluetooth.prototype = {
        initialize: function () {
            _.bindAll(this, 'onDeviceList', 'onErrorDeviceList', 'connectToDevice');

            this.showLoadingView();
            this.requestDevice();
        },

        requestDevice: function () {
            bluetoothSerial.list(this.onDeviceList, this.onErrorDeviceList);
        },

        onDeviceList: function (devices) {
            this.collection = new BleutoothCollection(devices);
            this.showDevices();
        },

        onErrorDeviceList: function () {
            var _this = this;
            app.setStatus('Cannot get list of devices');

            setTimeout(function(){
                app.setStatus('Reconnect ...');
            }, 500);

            setTimeout(_this.requestDevice, 1500);
        },

        showLoadingView: function () {
            this.loadingDeviceView = new LoadingDeviceView();
            app.elements.placeholder.html(this.loadingDeviceView.$el.html());
        },

        showDevices: function () {
            this.devicesView = new DevicesView({
                collection: this.collection
            });
            app.elements.placeholder.html(this.devicesView.$el.html());
            this.devicesView.on('deviceChoose', this.connectToDevice);
            this.devicesView.on('refresh', this.onRefresh);
        },

        connectToDevice: function (id) {
            var model = this.collection.get(id);
            app.setStatus("Connection to  device");

            var deviceId = model.getDeviceId();

            if(!deviceId){
                app.setStatus("Cannot find device id");
                return false;
            }

            bluetoothSerial.connect(deviceId, app.onConnectToDevice, app.onDisconnectToDevice);
        },

        onConnectToDevice: function () {
            app.goToState('main');
        },

        onDisconnectToDevice: function () {
            app.setStatus('Cannot connect to device');
        },

        onRefresh: function () {
            this.collection = null;
            this.devicesView.$el.remove();
            this.devicesView = null;

            this.showLoadingView();
            this.requestDevice();
        },

        stop: function () {
            app.elements.placeholder.html('');
            this.loadingDeviceView = null;
            this.devicesView = null;
            this.collection = null;
        }
    };

    function ControllerMain(){}
    ControllerMain.prototype = {
        initialize: function () {
            _.bindAll(this, 'recieveData');

            this.tempModel = new TempModel();
            this.humidityModel = new HumididtyModel();
            this.co2Model = new CO2Model();

            this.mainContentView = new MainContentView();
            app.elements.placeholder.html(this.mainContentView.$el.html());

            this.currentValueView = new CurrentValueView({

            });

            this.subscribeToDeviceData();
        },

        subscribeToDeviceData: function () {
            bluetoothSerial.subscribe('\n', this.recieveData);
        },

        recieveData: function (data) {
            var dataType = data[0];
            switch (dataType){
                case 't':
                    this.tempModel.addData(dataType);
                    break;
                case 'h':
                    this.humidityModel.addData(dataType);
                    break;
                case 'c':
                    this.co2Model.addData(dataType);
                    break;
            }
        },

        stop: function () {
            this.tempModel = null;
            this.humidityModel = null;
            this.co2Model = null;
        }
    };

    //views
    var LoadingDeviceView = Backbone.View.extend({
        events: {
            'click .device': 'onDevice'
        },

        template: _.template($('#loadingDeviceView').html()),

        initialize: function () {
            this.render();
        },

        render: function () {
            this.$el.html(this.template());
        },

        onDevice: function (e) {
            var $el = $(e.target);
            var id = $el.data('id');
            if(!id) return false;


            this.trigger('deviceChoose', id);
        }
    });
    var DevicesView = Backbone.View.extend({

        events: {
            'click .refresh': "onRefresh"
        },

        template: _.template($('#devicesView').html()),

        initialize: function () {
            this.render();
        },

        render: function () {
            this.$el.html(this.template({
                devices: this.collection.toJSON()
            }));
        },

        onRefresh: function () {
            this.trigger('refresh');
        }
    });

    var MainContentView = Backbone.View.extend({
        template: _.template($('#mainContentView').html()),

        initialize: function () {
            this.render();
        },

        render: function () {
            this.$el.html(this.template());
        }
    });
    var CurrentValueView = Backbone.View.extend({
        template: _.template($('currentValueView').html()),

        initialize: function (options) {
            this.tempModel = options.tempModel;
            this.humidityModel = options.humidityModel;
            this.co2Model = options.co2Model;

            this.tempModel.on('change:currentValue', this.onTempCurrentValue);
            this.humidityModel.on('change:currentValue', this.onHumidityCurrentValue);
            this.co2Model.on('change:currentValue', this.onCO2CurrentValue);

            this.render();
        },

        onTempCurrentValue: function () {

        },

        onHumidityCurrentValue: function () {

        },

        onCO2CurrentValue: function () {

        },

        render: function () {
            this.$el.html(this.template(this.getData()));
        },

        getData: function () {
            //tood: from this place
        }
    });

    //models
    var BluetoothModel = Backbone.Model.extend({
        getDeviceId: function () {
            var id = null;

            if( this.get('uuid') ){
                id = this.get('uuid');
            }else if( this.get('address') ){
                id = this.get('address');
            }

            return id;
        }
    });


    /*
     *
     * data = [{
     *   date: new Date(),
     *   value: 34.6
     * }]
     *
     * */
    var BaseDataModel = Backbone.Model.extend({
        data: [],
        addData: function (newData) {
            var data = this.get('data');
            data.push(newData);
            this.set('data', data);
        }
    });
    var TempModel = BaseDataModel.extend({});
    var HumididtyModel = BaseDataModel.extend({});
    var CO2Model = BaseDataModel.extend({});

    //collections
    var BleutoothCollection = Backbone.Collection.extend({
        model: BluetoothModel
    })

});

