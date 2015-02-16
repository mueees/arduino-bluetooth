$(document).ready(function () {
    var app = {
        currentState: null,
        states: {},
        elements: {},
        settings: {
            maxValuesCount: 20
        }
    };

    app.elements = {
        placeholder: $(".content"),
        status: $('.status')
    };

    app.initialize = function () {
        document.addEventListener('deviceready', function (){
            app.goToState('chooseBluetooth');
        }, false);
    };

    app.setStatus = function (message) {
        app.elements.status.html('<div class="message">'+message+'</div>');
    };

    app.clearStatus = function () {
        app.elements.status.html('');
    };

    app.elements.status.on('click', app.clearStatus);

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
                label: "Temperature",
                data: []
            });
            this.humidityModel = new HumididtyModel({
                label: "Humidity",
                data: []
            });
            this.co2Model = new CO2Model({
                label: "CO2",
                data: []
            });

            this.tabCollection = new TabsCollection([
                {
                    id: "1",
                    value: "Temp"
                },
                {
                    id: "2",
                    value: "Hum"
                },
                {
                    id: "3",
                    value: "CO2"
                },
                {
                    id: "4",
                    value: "All"
                }
            ]);

            this.mainContentView = new MainContentView();
            app.elements.placeholder.html(this.mainContentView.$el);

            this.currentPeriodId = null;
            this.periodsCollection = null;
            this.periodView = null;
            this.renderPeriod();

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
                _this.tempModel.clearData();
                _this.humidityModel.clearData();
                _this.co2Model.clearData();
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
                case 4:
                    model = {
                        tempModel: this.tempModel,
                        humidityModel: this.humidityModel,
                        co2Model: this.co2Model
                    };
                    break;
            }

            if(this.chartView){
                this.chartView.stop();
                this.chartView = null;
            }

            if(id == 4){
                this.chartView = new ChartisAllView({
                    model: model,
                    currentPeriodId: this.currentPeriodId
                });
            }else{
                this.chartView = new ChartisView({
                    model: model,
                    currentPeriodId: this.currentPeriodId
                });
            }


            this.mainContentView.$el.find('.chartPlaceholder').html(this.chartView.$el);
            this.renderPeriod();
        },

        getCurrentModel: function () {
            var result;
            switch (this.currentChartId){
                case 1:
                    result = this.tempModel;
                    break;
                case 2:
                    result = this.humidityModel;
                    break;
                case 3:
                    result = this.co2Model;
                    break;
                case 4:
                    result = this.tempModel;
                    break;
            }
            return result;
        },

        getPeriods: function () {
            var model = this.getCurrentModel();
            return model.getPeriods();
        },

        renderPeriod: function () {
            var periods = this.getPeriods(),
                _this = this;

            if( !this.periodsCollection ){
                this.periodsCollection = new TabsCollection(periods);
            }else{
                if(this.periodsCollection.toJSON() == periods) return false;
                this.periodsCollection = new TabsCollection(periods);
            }

            if(this.periodView) this.periodView = null;

            this.periodView = new TabsView({
                collection: this.periodsCollection
            });

            if(!this.currentPeriodId && periods.length){
                this.currentPeriodId = periods[0].id;
            }else{
                var perdiosResult = _.find(periods, function (period) {
                    return period.id == _this.currentPeriodId;
                });

                if(!perdiosResult && periods.length){
                    this.currentPeriodId = periods[0].id;
                }
            }

            this.periodView.on('tabClick', function(periodId){
                _this.currentPeriodId = periodId;
                _this.chartView.updatePeriodId(_this.currentPeriodId);
            });

            this.mainContentView.$el.find('.periodsPlaceholder').html(this.periodView.$el);
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

        initialize: function (options) {
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
    var ChartisView = Backbone.View.extend({
        template: _.template($('#chartlis').html()),

        initialize: function (options) {
            this.currentPeriodId = options.currentPeriodId;

            this.render();
            this.renderChart();
            this.listenTo(this.model, 'change:data', this.onChangeData);
        },

        render: function () {
            this.$el.html(this.template({
                label: this.getLabel()
            }));
        },

        getLabel: function () {
            return this.model.get('label');
        },

        renderChart: function () {
            var $el = this.$el.find('.chart-placeholder');
            this.chart = new Chartist.Line($el[0], this.getData(), {
                showArea: true,
                lineSmooth: Chartist.Interpolation.cardinal({
                    tension: 4
                })
            });
        },

        updatePeriodId: function (id) {
            if(this.currentPeriodId == id ) return false;
            this.currentPeriodId = id;
            this.updateChart();
        },

        getData: function () {
            return {
                labels: this.model.getDates(this.currentPeriodId),
                series: [
                    this.model.getValues(this.currentPeriodId)
                ]
            }
        },

        onChangeData: function () {
            this.updateChart();
        },

        updateChart: function () {
            this.chart.data = this.getData();
            this.chart.update();
        },

        stop: function () {
            this.stopListening();
        }
    });

    var ChartisAllView = ChartisView.extend({
        template: _.template($('#chartlis').html()),

        initialize: function (options) {
            this.currentPeriodId = options.currentPeriodId;
            this.periodView = null;

            this.render();
            this.renderChart();

            this.listenTo(this.model.tempModel, 'change:data', this.onChangeData);
            this.listenTo(this.model.humidityModel, 'change:data', this.onChangeData);
            this.listenTo(this.model.co2Model, 'change:data', this.onChangeData);
        },

        renderChart: function () {
            var $el = this.$el.find('.chart-placeholder');
            this.chart = new Chartist.Line($el[0], this.getData(), {
                showArea: true,
                lineSmooth: Chartist.Interpolation.cardinal({
                    tension: 4
                })
            });
        },

        getLabel: function () {
            return 'All'
        },

        getData: function () {
            return {
                labels: this.model.tempModel.getDates(this.currentPeriodId),
                series: [
                    this.model.tempModel.getValues(this.currentPeriodId),
                    this.model.humidityModel.getValues(this.currentPeriodId),
                    this.model.co2Model.getValues(this.currentPeriodId)
                ]
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

    var BaseDataModel = Backbone.Model.extend({
        defaults: {
            data: [],
            currentValue: 0
        },
        defaultPeriods: [
            {
                id: '1',
                value: "All"
            },
            {
                id: '11',
                value: '3 m',
                milliseconds: 1000*60*3
            },
            {
                id: '2',
                value: '10 m',
                milliseconds: 1000*60*10
            },
            {
                id: '3',
                value: '30 m',
                milliseconds: 1000*60*30
            },
            {
                id: '4',
                value: '1 hours',
                milliseconds: 1000*60*60
            },
            {
                id: '5',
                value: '2 h',
                milliseconds: 1000*60*60*2
            },
            {
                id: '6',
                value: '4 h',
                milliseconds: 1000*60*60*4
            }
        ],
        addData: function (newData) {
            var data = this.get('data');
            data.push({
                date: new Date(),
                value: newData
            });

            this.set('data', data);
            this.trigger('change:data');
            this.set('currentValue', newData);
        },
        getValues: function (periodId) {
            var result = [];
            var values = this._getValues(periodId);

            _.each(values, function (item) {
                result.push(item.value);
            });

            return result;
        },
        getDates: function (periodId) {
            var result = [];
            var _this = this;

            var values = this._getValues(periodId);

            _.each(values, function (item, i) {
                if(i == 0) {
                    result.push(_this.prepareDate(item.date));
                }else{
                    var nextObj = values[i+1];
                    if(nextObj){
                        var next = _this.prepareDate(values[i+1]['date']);
                    }
                    var current = _this.prepareDate(item.date);

                    if( next && current == next ){
                        result.push("");
                    }else {
                        result.push(current);
                    }
                }

            });

            return result;
        },

        _getValues: function (periodId) {
            var result = [],
                data = this.get('data');

            var periodObject = _.find(this.defaultPeriods, function (period) {
                return period.id == periodId;
            });

            var now = new Date();
            _.each(data, function (item) {
                if(periodObject.id == 1){
                    result.push(item);
                }else if( (now - item.date) < periodObject.milliseconds ){
                    result.push(item);
                }
            });

            //слишком много значений, надо пропорционально уменьшить до app.settings.maxValuesCount
            if(result.length > app.settings.maxValuesCount){
                var currentAveragePeriod = ((result[result.length-1].date - result[0].date)/1000)/result.length;
                var featureAveragePeriod = ((result[result.length-1].date - result[0].date)/1000)/app.settings.maxValuesCount;

                var filterResult = [];
                var scipedItem = [];
                var previousItem;

                function getAvaregeValue(array) {
                    var sum = 0;
                    _.each(array, function (item) {
                        sum += item.value;
                    });
                    return sum/array.length;
                }

                _.each(result, function (item, i) {
                    if(i == 0){
                        filterResult.push(item);
                        previousItem = item;
                    }else{
                        var diffSec = featureAveragePeriod - (item.date - previousItem.date)/1000;
                        if( diffSec < currentAveragePeriod ){
                            scipedItem.push(item);
                            item.value = getAvaregeValue(scipedItem);
                            filterResult.push(item);
                            previousItem = item;
                            scipedItem = [];
                        }else{
                            scipedItem.push(item);
                        }
                    }
                });

                result = filterResult;
            }

            return result;
        },

        prepareDate: function (date) {
            //return date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
            return date.getMinutes();
        },
        clearData: function () {
            this.set('data', []);
            this.set('currentValue', 0);
            this.trigger('change:data');
        },

        getAverageValue: function () {
            var data = this.get('data');
            var sum = 0;
            _.each(data, function (item) {
                sum += item.value;
            });
            return Math.ceil((sum/data.length)*100)/100;
        },
        getPeriods: function () {
            var data = this.get('data');
            var periods = [];

            if(!data.length){
                return [this.defaultPeriods[0]];
            }

            var diff = data[data.length-1].date - data[0].date;
            _.each(this.defaultPeriods, function (currentPeriod) {
                if(currentPeriod.id == 1 || currentPeriod.milliseconds < diff) {
                    periods.push(currentPeriod);
                }
            });

            return periods;
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

    app.initialize();
    //app.goToState('chooseBluetooth');
});

