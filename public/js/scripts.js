var voltGaugeOpts = {
    chart: {
        type: 'gauge',
        height: 200
    },
    title: null,
    pane: [{
        startAngle: -45,
        endAngle: 45,
        background: null,
        center: ['50%', '120%'],
        size: 300
    }],

    exporting: {
        enabled: false
    },
    credits: {
        enabled: false
    },

    tooltip: {
        enabled: false
    },

    yAxis: [{
        min: 0,
        max: 300,
        minorTickPosition: 'outside',
        tickPosition: 'outside',
        labels: {
            rotation: 'auto',
            distance: 20
        },
        plotBands: [{
            from: 280,
            to: 300,
            color: '#C02316',
            innerRadius: '100%',
            outerRadius: '105%'
        }],
        pane: 0,
        title: {
            text: 'Gride Voltages (Volts)',
            y: -40
        }
    }],

    plotOptions: {
        gauge: {
            dataLabels: {
                enabled: false
            },
            dial: {
                radius: '100%'
            }
        }
    },

    series: [{
        data: [0],
        yAxis: 0
    }]

}
var lineChartOpts = {
    chart: {
        zoomType: 'xy',
        height: 350
    },
    credits: {
        enabled: false
    },
    title: {
        text: 'Your title here'
    },
    subtitle: {
        text: 'Subtitle here'
    },
    xAxis: [{
        type: "datetime",
        crosshair: true
    }],
    yAxis: [{
            title: {
                text: '100'
            }
        },
        { // Secondary yAxis
            opposite: true,
            title: {
                text: '5000'
            }
        }
    ],
    tooltip: {
        shared: true
    },
    series: [{
        name: 'Active Out Power',
        type: 'spline',
        yAxis: 1,
        data: [0],
        pointStart: new Date().getTime(),
        tooltip: {
            valueSuffix: ' W'
        }
    }, {
        name: 'Load',
        type: 'spline',
        data: [0],
        pointStart: new Date().getTime(),
        tooltip: {
            valueSuffix: '%'
        }
    }, {
        name: 'Grid Voltage',
        type: 'spline',
        data: [0],
        yAxis: 1,
        pointStart: new Date().getTime(),
        tooltip: {
            valueSuffix: ' V'
        }
    }, {
        name: 'Battery Voltage',
        type: 'spline',
        data: [0],
        pointStart: new Date().getTime(),
        tooltip: {
            valueSuffix: ' V'
        }
    }, {
        name: 'Inverter Temprature',
        type: 'spline',
        data: [0],
        pointStart: new Date().getTime(),
        tooltip: {
            valueSuffix: '°C'
        }
    }]
};
var tempGaugeOptions = {
    chart: {
        height: 200,
        type: 'solidgauge'
    },
    title: null,
    pane: {
        size: '90%',
        startAngle: -180,
        endAngle: 90,
        background: {
            backgroundColor: '#EEE',
            innerRadius: '90%',
            outerRadius: '100%',
            shape: 'arc'
        }
    },
    tooltip: {
        enabled: false
    },
    // the value axis
    yAxis: {
        stops: [
            [50 / 150, '#008000'],
            [60 / 150, '#ff8c00'],
            [120 / 150, '#ff0000']
        ],
        lineWidth: 0,
        minorTickInterval: 0,
        tickPixelInterval: 50,
        tickWidth: 1,
        labels: {
            enabled: true,
            distance: 10
        }
    },
    plotOptions: {
        solidgauge: {
            innerRadius: '90%',
            dataLabels: {
                y: 5,
                borderWidth: 0,
                useHTML: true
            }
        }
    }
};
var loadGaugesOptions = {
    chart: {
        type: 'solidgauge',
        height: 200
    },

    title: null,
    credits: {
        enabled: false
    },
    pane: {
        center: ['50%', '60%'],
        size: '120%',
        startAngle: -90,
        endAngle: 90,
        background: {
            backgroundColor: Highcharts.defaultOptions.legend.backgroundColor || '#EEE',
            innerRadius: '60%',
            outerRadius: '100%',
            shape: 'arc'
        }
    },

    exporting: {
        enabled: false
    },

    tooltip: {
        enabled: false
    },

    // the value axis
    yAxis: {
        stops: [
            [10, '#55BF3B'], // green
            [50, '#DDDF0D'], // yellow
            [80, '#DF5353'] // red
        ],
        lineWidth: 0,
        tickWidth: 0,
        minorTickInterval: null,
        tickAmount: 2,
        title: {
            y: -70
        },
        labels: {
            y: 16
        }
    },

    plotOptions: {
        solidgauge: {
            dataLabels: {
                y: 5,
                borderWidth: 0,
                useHTML: true
            }
        }
    }
};