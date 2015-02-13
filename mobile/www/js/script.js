$(document).ready(function () {
    var app = {
        currentState: null,
        states: {},
        elements: {},
        settings: {
            maxDataCount: 40
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
        app.elements.status.html('<div class="message">'+message+'</div>');
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

            var _this = this;
            this.currentChartId = 1;

            this.tempModel = new TempModel({
                chartData: {
                    label: "Temperature",
                    fillColor: "rgba(151,187,205,0.2)",
                    strokeColor: "rgba(151,187,205,1)",
                    pointColor: "rgba(151,187,205,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)"
                },
                data: []
            });
            this.humidityModel = new HumididtyModel({
                chartData: {
                    label: "Humidity",
                    fillColor: "rgba(151,187,205,0.2)",
                    strokeColor: "rgba(151,187,205,1)",
                    pointColor: "rgba(151,187,205,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)"
                },
                data: []
            });
            this.co2Model = new CO2Model({
                chartData: {
                    label: "CO2",
                    fillColor: "rgba(151,187,205,0.2)",
                    strokeColor: "rgba(151,187,205,1)",
                    pointColor: "rgba(151,187,205,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)"
                },
                data: []
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
            this.onTabClick(this.currentChartId);

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
            this.mainContentView.on('clearData', function () {
                if(_this.chartView) {
                    _this.chartView.stop();
                    _this.chartView = null;
                }

                _this.tempModel.clearData();
                _this.humidityModel.clearData();
                _this.co2Model.clearData();

                _this.onTabClick(_this.currentChartId);
            });

            this.tabView.on('tabClick', this.onTabClick);

            this.subscribeToDeviceData();
        },

        subscribeToDeviceData: function () {
            bluetoothSerial.subscribe('\n', this.recieveData);
        },

        recieveData: function (data) {
            var dataType = data[0];
            var value = this.clearData(data.slice(2));
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

        clearData: function (value) {
            return Math.ceil((value)*100)/100;
        },

        onTabClick: function (id) {
            var model = null;
            this.currentChartId = id;
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

            this.chartView.stop();
            this.chartView = null;

            this.currentValueView.stop();
            this.currentValueView = null;

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
            'click .anotherDevice': "onAnotherDevice",
            'click .clearData': 'onClearData'
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
        },

        onClearData: function () {
            this.trigger("clearData");
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

            this.listenTo(this.tempModel, 'change:currentValue', this.onTempCurrentValue);
            this.listenTo(this.humidityModel, 'change:currentValue', this.onHumidityCurrentValue);
            this.listenTo(this.co2Model, 'change:currentValue', this.onCO2CurrentValue);

            this.render();
        },

        onTempCurrentValue: function () {
            this.$el.find('.temperature .value').html(this.tempModel.get('currentValue'));
            this.$el.find('.temperature .average').html(this.tempModel.getAverageValue());
        },

        onHumidityCurrentValue: function () {
            this.$el.find('.humidity .value').html(this.humidityModel.get('currentValue'));
            this.$el.find('.humidity .average').html(this.humidityModel.getAverageValue());
        },

        onCO2CurrentValue: function () {
            this.$el.find('.co2 .value').html(this.co2Model.get('currentValue'));
            this.$el.find('.co2 .average').html(this.co2Model.getAverageValue());
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
        },

        stop: function () {
            this.stopListening();
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
            var _this = this;
            _.bindAll(this, 'tryRenderChart', 'onResize');

            $(window).on("resize",_.debounce(_this.onResize,300));

            this.listenTo(this.model, 'change:data', this.tryRenderChart);
            this.render();
            this.onResize();
            this.tryRenderChart();
        },

        onResize: function () {
            this.$el.find('#canvas').attr('width', $(window).width() - 50);
            if(this.chart){
                this.destroyChart();
                this.$el.find('#canvas').attr('width', $(window).width() - 50);
                this.renderChart();
            }
        },

        tryRenderChart: function () {
            if(this.isCanRenderChart()){
                this.hideHelpMessage();
                this.renderChart();
            }else{
                this.showHelpMessage();
                this.destroyChart();
            }
        },

        showHelpMessage: function () {
            this.$el.find('.help').show();
        },

        hideHelpMessage: function () {
            this.$el.find('.help').hide();
        },

        isCanRenderChart: function () {
            return (this.model.get('data').length >= 3) ? true: false;
        },

        renderChart: function () {
            if(!this.chart){
                this.chart = new Chart(this.$el.find('#canvas').get(0).getContext("2d"), {
                    responsive: true
                }).Line(this.getData());
            }else{
                this.chart.addData([this.model.getLastValue()], this.model.getLastDate());

                if(this.model.get('data').length >= app.settings.maxDataCount){
                    this.chart.removeData();
                }
            }
        },

        destroyChart: function () {
            if(this.chart) {
                this.chart.destroy();
                this.chart = null;
            }
        },

        render: function () {
            this.$el.html(this.template({
                label: this.model.get('chartData').label
            }));
        },

        getData: function () {
            var dataset = this.model.get('chartData');
            dataset.data = this.model.getValues();

            return {
                labels: this.model.getDates(),
                datasets: [dataset]
            }
        },

        stop: function () {
            this.stopListening();
            this.destroyChart();
            $(window).off('resize');
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
        clearData: function () {
            this.set('data', []);
            this.set('currentValue', 'undefined');
            this.trigger('change:data');
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
            var lastData = data[data.length-1];
            return (lastData) ? lastData.value : null;
        },
        getLastDate: function () {
            var data = this.get('data');
            var lastData = data[data.length-1];
            return (lastData) ? this.prepareDate(lastData.date) : null;
        },
        getAverageValue: function () {
            var data = this.get('data');
            var sum = 0;
            _.each(data, function (item) {
                sum += item.value;
            });
            return Math.ceil((sum/data.length)*100)/100;
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

