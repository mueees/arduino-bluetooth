$(document).ready(function () {

    var app = {
        currentState: null,
        states: {},
        elements: {},
        settings: {
            maxDataCount: 4
        }
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
            _.bindAll(this, 'onDeviceList',
                'onErrorDeviceList',
                'connectToDevice',
                'onConnectToDevice',
                'onDisconnectToDevice',
                'onRefresh');

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
            app.elements.placeholder.html(this.loadingDeviceView.$el);
        },

        showDevices: function () {
            this.devicesView = new DevicesView({
                collection: this.collection
            });
            app.elements.placeholder.html(this.devicesView.$el);
            this.devicesView.on('deviceChoose', this.connectToDevice);
            this.devicesView.on('refresh', this.onRefresh);
        },

        connectToDevice: function (address) {
            app.setStatus("Connection to device");
            bluetoothSerial.connect(address, this.onConnectToDevice, this.onDisconnectToDevice);
        },

        onConnectToDevice: function () {
            app.clearStatus();
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
            _.bindAll(this, 'recieveData',
                'onTabClick');

            this.tempModel = new TempModel({
                chartData: {
                    label: "Temperature",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "rgba(220,220,220,1)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)"
                }
            });
            this.humidityModel = new HumididtyModel({
                    chartData: {
                        label: "Humidity",
                        fillColor: "rgba(220,220,220,0.2)",
                        strokeColor: "rgba(220,220,220,1)",
                        pointColor: "rgba(220,220,220,1)",
                        pointStrokeColor: "#fff",
                        pointHighlightFill: "#fff",
                        pointHighlightStroke: "rgba(220,220,220,1)"
                    }
                });
            this.co2Model = new CO2Model({
                chartData: {
                    label: "CO2",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "rgba(220,220,220,1)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)"
                }
            });

            this.tabCollection = new TabsCollection([
                {
                    id: "1",
                    value: "Temperature"
                },
                {
                    id: "2",
                    value: "Humidity"
                },
                {
                    id: "3",
                    value: "CO2"
                }/*,
                {
                    id: "4",
                    value: "TOgether"
                }*/
            ]);

            this.mainContentView = new MainContentView();
            app.elements.placeholder.html(this.mainContentView.$el);

            this.currentValueView = new CurrentValueView({
                tempModel: this.tempModel,
                humidityModel: this.humidityModel,
                co2Model: this.co2Model
            });
            this.tabView = new TabsView({
                collection: this.tabCollection
            });

            this.mainContentView.$el.find('.currentValuePlaceholder').append(this.currentValueView.$el);
            this.mainContentView.$el.find('.tabPlaceholder').append(this.tabView.$el);

            this.mainContentView.on('anotherDevice', function () {
                app.setStatus('Closing connection');
                bluetoothSerial.unsubscribe(function () {
                    app.clearStatus();
                    app.goToState('chooseBluetooth');
                }, function () {
                    app.setStatus('Cannot close connection');
                });
            });
            this.tabView.on('tabClick', this.onTabClick);

            this.subscribeToDeviceData();
        },

        subscribeToDeviceData: function () {
            bluetoothSerial.subscribe('\n', this.recieveData);
        },

        recieveData: function (data) {
            var dataType = data[0];
            var value = data.slice(2);
            switch (dataType){
                case 't':
                    this.tempModel.addData(value);
                    break;
                case 'h':
                    this.humidityModel.addData(value);
                    break;
                case 'c':
                    this.co2Model.addData(value);
                    break;
            }
        },

        onTabClick: function (id) {
            var model = null;
            switch (id){
                case 1:
                    model = this.tempModel;
                    break;
                case 2:
                    model = this.humidityModel;
                    break;
                case 3:
                    model = this.co2Model;
                    break;
            }

            this.chartView = new ChartView({
                model: model
            });

            this.mainContentView.$el.find('.chartPlaceholder').html(this.chartView.$el);
        },

        stop: function () {
            this.tempModel = null;
            this.humidityModel = null;
            this.co2Model = null;
        }
    };

    //views
    var LoadingDeviceView = Backbone.View.extend({
        template: _.template($('#loadingDeviceView').html()),

        initialize: function () {
            this.render();
        },

        render: function () {
            this.$el.html(this.template());
        }
    });
    var DevicesView = Backbone.View.extend({
        events: {
            "click .refresh": "onRefresh",
            'click .device': 'onDevice'
        },

        template: _.template($('#devicesView').html()),

        initialize: function () {
            this.render();
        },

        render: function () {
            this.$el.html(this.template({
                devices: this.collection.toJSON()
            }));
            return this;
        },

        onRefresh: function () {
            this.trigger('refresh');
        },

        onDevice: function (e) {
            var $el = $(e.target);
            var address = $el.data('address');
            if(!address) return false;

            this.trigger('deviceChoose', address);
        }
    });

    var MainContentView = Backbone.View.extend({
        events: {
            'click .anotherDevice': "onAnotherDevice"
        },

        template: _.template($('#mainContentView').html()),

        initialize: function () {
            this.render();
        },

        render: function () {
            this.$el.html(this.template());
        },

        onAnotherDevice: function () {
            this.trigger("anotherDevice");
        }
    });
    var CurrentValueView = Backbone.View.extend({
        template: _.template($('#currentValueView').html()),

        initialize: function (options) {
            _.bindAll(this, 'onTempCurrentValue',
                'onHumidityCurrentValue',
                'onCO2CurrentValue');

            this.tempModel = options.tempModel;
            this.humidityModel = options.humidityModel;
            this.co2Model = options.co2Model;

            this.tempModel.on('change:currentValue', this.onTempCurrentValue);
            this.humidityModel.on('change:currentValue', this.onHumidityCurrentValue);
            this.co2Model.on('change:currentValue', this.onCO2CurrentValue);

            this.render();
        },

        onTempCurrentValue: function () {
            this.$el.find('.temperature').html(this.tempModel.get('currentValue'));
        },

        onHumidityCurrentValue: function () {
            this.$el.find('.humidity').html(this.tempModel.get('currentValue'));
        },

        onCO2CurrentValue: function () {
            this.$el.find('.co2').html(this.tempModel.get('currentValue'));
        },

        render: function () {
            this.$el.html(this.template(this.getData()));
        },

        getData: function () {
            return {
                temperature: this.tempModel.get('currentValue'),
                humidity: this.humidityModel.get('currentValue'),
                co2: this.co2Model.get('currentValue')
            }
        }
    });
    var TabsView = Backbone.View.extend({
        events: {
            'click .tab-item': 'onTabClick'
        },

        template: _.template($('#tabsView').html()),

        initialize: function () {
            this.render();
        },

        render: function () {
            this.$el.html(this.template({
                tabs: this.collection.toJSON()
            }));
        },

        onTabClick: function (e) {
            var id = $(e.target).data('id');
            if(!id) return false;
            this.trigger("tabClick", id);
        }
    });
    var ChartView = Backbone.View.extend({

        template: _.template( $('#chartView').html() ),

        initialize: function () {
            _.bindAll(this, 'renderChart');

            this.render();
            this.renderChart();
            this.listenTo(this.model, 'change:data', this.renderChart);
        },

        renderChart: function () {
            if(!this.chart){
                this.chart = new Chart(this.$el.find('#canvas').get(0).getContext("2d")).Line(this.getData());
            }else{
                this.chart.addData([this.model.getLastValue()], this.model.getLastDate());

                if(this.model.get('data').length >= app.settings.maxDataCount){
                    this.chart.removeData();
                }
            }
        },

        render: function () {
            this.$el.html(this.template());
        },

        getData: function () {
            var dataset = this.model.get('chartData');
            dataset.data = this.model.getValues();

            return {
                labels: this.model.getDates(),
                datasets: [dataset]
            }
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
    var TabModel = Backbone.Model.extend({});

    /*
     *
     * data = [{
     *   date: new Date(),
     *   value: 34.6
     * }]
     *
     * */
    var BaseDataModel = Backbone.Model.extend({
        defaults: {
            data: [],
            currentValue: 0
        },
        addData: function (newData) {
            var data = this.get('data');
            data.push({
                date: new Date(),
                value: newData
            });

            if( data.length > app.settings.maxDataCount ){
                data.shift();
            }

            this.set('data', data);
            this.trigger('change:data');
            this.set('currentValue', newData);
        },
        getValues: function () {
            var result = [];
            var data = this.get('data');

            _.each(data, function (item) {
                result.push(item.value);
            });

            return result;
        },

        prepareDate: function (date) {
            return date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
        },

        getDates: function () {
            var result = [];
            var data = this.get('data');
            var _this = this;

            _.each(data, function (item) {
                result.push(_this.prepareDate(item.date));
            });

            return result;
        },
        getLastValue: function () {
            var data = this.get('data');
            return data[data.length-1].value;
        },
        getLastDate: function () {
            var data = this.get('data');
            return this.prepareDate(data[data.length-1].date);
        }
    });
    var TempModel = BaseDataModel.extend({});
    var HumididtyModel = BaseDataModel.extend({});
    var CO2Model = BaseDataModel.extend({});

    //collections
    var BleutoothCollection = Backbone.Collection.extend({
        model: BluetoothModel
    });
    var TabsCollection = Backbone.Collection.extend({
        model: TabModel
    });

    //run app
    //app.initialize();
    app.goToState('chooseBluetooth');

});

