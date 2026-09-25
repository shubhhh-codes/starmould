@extends('layouts.master')

@section('title')
    Report
@endsection

@section('css')
    <!-- DataTables -->
    <link href="{{ URL::asset('/assets/libs/select2/select2.min.css') }}" rel="stylesheet" type="text/css" />
    <link href="{{ URL::asset('/assets/libs/bootstrap-datepicker/bootstrap-datepicker.min.css') }}" rel="stylesheet"
        type="text/css">
    <link href="{{ URL::asset('/assets/libs/spectrum-colorpicker/spectrum-colorpicker.min.css') }}" rel="stylesheet"
        type="text/css">
    <link href="{{ URL::asset('/assets/libs/bootstrap-touchspin/bootstrap-touchspin.min.css') }}" rel="stylesheet"
        type="text/css" />
    <link rel="stylesheet" href="{{ URL::asset('/assets/libs/datepicker/datepicker.min.css') }}">
    <link href="{{ URL::asset('/assets/libs/datatables/datatables.min.css') }}" rel="stylesheet" type="text/css" />
    <link href="{{ URL::asset('/assets/libs/tui-chart/tui-chart.min.css') }}" rel="stylesheet" type="text/css" />
@endsection

@section('content')
    @component('components.breadcrumb')
        @slot('li_1')
            Report
        @endslot
        @slot('title')
            Report Data
        @endslot
    @endcomponent
    <style>
        .page-content {
            padding: 30px 12px 60px;
             !important
        }

        .vertical-menu {
            top: 0px;
             !important
        }
    </style>
    <div class="mb-3 mt-3">
        <div class="row">
            <div class="col-sm-2">
                
            </div>
            <div class="col-sm-1">
                <label for="validationCustom01" class="form-label"
                    style="font-size: 15px; margin-right: -14px; margin-top: 6px;!important">Year</label>
            </div>
            <div class="col-sm-3">
                {{-- <select class="form-control" id="select222">
                <option selected value="">Select </option>
                @foreach ($result as $value)
                    <option value="{{$value}}">{{$value}}</option>
                @endforeach
            </select> --}}
                <input class="form-control" type="month" value="{{ $startDate }}" id="startdate">
            </div>
            <div class="col-sm-3">
                <input class="form-control" type="month" value="{{ $endDate }}" id="enddate">
            </div>
            <div class="col-sm-3">
                <button class="btn btn-primary" type="submit" onclick="return changeenddate();">Update Chart</button>
            </div>
        </div>
        {{-- <div class="invalid-feedback">
        Please Select Customer
        </div> --}}
    </div>

    {{-- <div class="row">
        <div class="col-xl-12">
            <div class="card">
                <div class="card-body">
                    <h4 class="card-title mb-4">Line charts</h4>
                    <div id="line_chart_datalabel" data-colors='["--bs-success","--bs-primary", "--bs-danger","--bs-info", "--bs-warning"]'
                        dir="ltr">

                    </div>
                </div>
            </div>
        </div>
    </div> --}}
    {{-- <div class="row">
        <div class="col-xl-12">
            <div class="card">
                <div class="card-body">
                    <h4 class="card-title mb-4">Column charts</h4>
                    <div id="column-charts" data-colors='["--bs-success","--bs-primary", "--bs-danger","--bs-info", "--bs-warning"]' dir="ltr">

                    </div>
                </div>
            </div>
        </div>
    </div> --}}
    
    {{-- <div class="row">
        <div class="col-xl-12">
            <div class="card">
                <div class="card-body">
                    <h4 class="card-title mb-4">Line charts</h4>
                    <div id="line_chart_datalabel1" data-colors='["--bs-purple", "#cdcf67", "--bs-primary", "#faa0ff", "--bs-danger", "--bs-info", "--bs-success"]'
                        dir="ltr">

                    </div>
                </div>
            </div>
        </div>
    </div> --}}
    <div class="row">
        <div class="col-xl-12">
            <div class="card">
                <div class="card-body">
                    <h4 class="card-title mb-4">Training of Scanning and Printing work</h4>
                    <div id="line_chart_datalabel11" data-colors='["--bs-purple", "#cdcf67", "--bs-primary", "#faa0ff", "--bs-danger", "--bs-info", "--bs-success"]'
                        dir="ltr">

                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="row">
        <div class="col-xl-12">
            <div class="card">
                <div class="card-body">
                    <h4 class="card-title mb-4">Pie charts</h4>
                    <div id="pie-charts"
                        data-colors='["--bs-purple", "#cdcf67", "--bs-primary", "#faa0ff", "--bs-danger", "--bs-info", "--bs-success"]'
                        dir="ltr">

                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
@section('script')
    <!-- Required datatable js -->
    <script src="{{ URL::asset('/assets/libs/datatables/datatables.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/select2/select2.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/bootstrap-datepicker/bootstrap-datepicker.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/spectrum-colorpicker/spectrum-colorpicker.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/bootstrap-touchspin/bootstrap-touchspin.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/bootstrap-maxlength/bootstrap-maxlength.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/datepicker/datepicker.min.js') }}"></script>
    <!-- form advanced init -->
    <script src="{{ URL::asset('/assets/js/pages/form-advanced.init.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/jszip/jszip.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/pdfmake/pdfmake.min.js') }}"></script>
    <!-- Datatable init js -->
    <script src="{{ URL::asset('/assets/js/pages/datatables.init.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/parsleyjs/parsleyjs.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/js/pages/form-validation.init.js') }}"></script>
    <!-- tui charts plugins -->
    <script src="{{ URL::asset('/assets/libs/tui-chart/tui-chart.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/apexcharts/apexcharts.min.js') }}"></script>
    <!-- tui charts plugins -->
    <script>
        function getChartColorsArray(chartId) {
            if (document.getElementById(chartId) !== null) {
                var colors = document.getElementById(chartId).getAttribute("data-colors");

                if (colors) {
                    colors = JSON.parse(colors);
                    return colors.map(function(value) {
                        var newValue = value.replace(" ", "");
                        if (newValue.indexOf(",") === -1) {
                            var color = getComputedStyle(document.documentElement).getPropertyValue(newValue);

                            if (color) {
                                color = color.replace(" ", "");
                                return color;
                            } else return newValue;;
                        } else {
                            var val = value.split(',');
                            if (val.length == 2) {
                                var rgbaColor = getComputedStyle(document.documentElement).getPropertyValue(val[0]);
                                rgbaColor = "rgba(" + rgbaColor + "," + val[1] + ")";
                                return rgbaColor;
                            } else {
                                return newValue;
                            }
                        }
                    });
                }
            }
        }
        var pieChartColors = getChartColorsArray("pie-charts");
        if (pieChartColors) {
            var pieChartWidth = $("#pie-charts").width();
            var piecontainer = document.getElementById('pie-charts');
            var piedata = {
                categories: ['Scan'],
                series: [{
                        name: 'VMC Fault Maintenance',
                        data: <?php print_r(json_encode($vmc)); ?>.reduce((partialSum, a) => partialSum + parseFloat(a),0)
                    },
                    {
                        name: 'Electric Fault',
                        data: <?php print_r(json_encode($electric)); ?>.reduce((partialSum, a) => partialSum + parseFloat(a), 0)
                    },
                    {
                        name: 'Setting Time',
                        data: <?php print_r(json_encode($setting)); ?>.reduce((partialSum, a) => partialSum + parseFloat(a), 0)
                    },
                    {
                        name: 'Chhol Clearing',
                        data: <?php print_r(json_encode($chhol)); ?>.reduce((partialSum, a) => partialSum + parseFloat(a), 0)
                    },
                    {
                        name: 'Operator Fault',
                        data: <?php print_r(json_encode($operator)); ?>.reduce((partialSum, a) => partialSum + parseFloat(a), 0)
                    },
                    {
                        name: 'Lunch Time',
                        data: <?php print_r(json_encode($lunch)); ?>.reduce((partialSum, a) => partialSum + parseFloat(a), 0)
                    },
                    {
                        name: 'No Any Work',
                        data: <?php print_r(json_encode($noanywork)); ?>.reduce((partialSum, a) => partialSum + parseFloat(a), 0)
                    }
                ]
            };
            var pieoptions = {
                chart: {
                    width: pieChartWidth,
                    height: 380,
                    title: 'Worktype of Scan'
                },
                tooltip: {
                    suffix: 'hr'
                }
            };
            var theme = {
                chart: {
                    background: {
                        color: '#fff',
                        opacity: 0
                    },
                },
                title: {
                    color: '#8791af',
                },

                plot: {
                    lineColor: 'rgba(166, 176, 207, 0.1)'
                },
                legend: {
                    label: {
                        color: '#8791af'
                    }
                },
                series: {
                    colors: pieChartColors
                }
            };

            // For apply theme

            tui.chart.registerTheme('myTheme', theme);
            pieoptions.theme = 'myTheme';

            var pieChart = tui.chart.pieChart(piecontainer, piedata, pieoptions);
        }

        $(window).resize(function() {
            pieChartWidth = $("#pie-charts").width();
            pieChart.resize({
                width: pieChartWidth,
                height: 350
            });
        });


        //  line chart datalabel
      

      
        var lineChartDatalabelColors = getChartColorsArray("line_chart_datalabel11");
        if (lineChartDatalabelColors) {
            var options = {
                chart: {
                    height: 380,
                    type: 'line',
                    zoom: {
                        enabled: false
                    },
                    toolbar: {
                        show: false
                    }
                },
                colors: lineChartDatalabelColors,
                dataLabels: {
                    enabled: false,
                },
                stroke: {
                    width: [3, 3],
                    curve: 'straight'
                },
                series: [ {
                        name: 'VMC Fault Maintenance',
                        data: <?php print_r(json_encode($totalvmc)); ?>
                    },
                    {
                        name: 'Electric Fault',
                        data: <?php print_r(json_encode($totalelectricfault)); ?>
                    },
                    {
                        name: 'Setting Time',
                        data: <?php print_r(json_encode($totalsetting)); ?>
                    },
                    {
                        name: 'Chhol Clearing',
                        data: <?php print_r(json_encode($totalchhol)); ?>
                    },
                    {
                        name: 'Operator Fault',
                        data: <?php print_r(json_encode($totaloperator)); ?>
                    },
                    {
                        name: 'Lunch Time',
                        data: <?php print_r(json_encode($totallunch)); ?>
                    },
                    {
                        name: 'No Any Work',
                        data: <?php print_r(json_encode($totalnoanywork)); ?>
                    },
                ],
                title: {
                    text: 'Monthly Total',
                    align: 'left',
                    style: {
                        fontWeight: '500',
                    },
                },
                grid: {
                    row: {
                        colors: ['transparent', 'transparent'], // takes an array which will be repeated on columns
                        opacity: 0.2
                    },
                    borderColor: '#f1f1f1'
                },
                markers: {
                    style: 'inverted',
                    size: 6
                },
                xaxis: {
                    categories: <?php print_r(json_encode($months)); ?>,
                    title: {
                        text: 'Month'
                    }
                },
                yaxis: {
                    title: {
                        text: 'Total Hours'
                    },
                    min: 0,
                    max: <?php print_r(json_encode($totalamount2)); ?>.reduce((partialSum, a) => partialSum > parseFloat(a) ? partialSum :
                        parseFloat(a), 10)
                        
                },
                legend: {
                    position: 'top',
                    horizontalAlign: 'right',
                    floating: true,
                    offsetY: -25,
                    offsetX: -5
                },
                responsive: [{
                    breakpoint: 600,
                    options: {
                        chart: {
                            toolbar: {
                                show: false
                            }
                        },
                        legend: {
                            show: false
                        },
                    }
                }]
            }

            var chart = new ApexCharts(
                document.querySelector("#line_chart_datalabel11"),
                options
            );

            chart.render();
        }
        function changeenddate() {
            $.ajax({
                    type: 'POST',
                    url: "{{ route('report.getmonthwisedata') }}",
                    data: {
                        _token: "{{ csrf_token() }}",
                        startdate: $("#startdate").val(),
                        enddate: $("#enddate").val()
                    },
                    success: function(datares) {
                        datares = JSON.parse(datares);
                        data = {
                            categories: (datares.months),
                            series: [
                                {
                                    name: 'Scan Revenue',
                                    data: datares.scantotall
                                },
                                {
                                    name: 'LRS Revenue',
                                    data: datares.lrs
                                },
                                {
                                    name: 'Drone Revenue',
                                    data: datares.drone
                                },
                                {
                                    name: 'Total Revenue',
                                    data: datares.totalamount
                                }
                            ]
                        };
                        console.log(data);
                        
                        $("#pie-charts").html('');
                        pieChart = tui.chart.pieChart(piecontainer, piedata, pieoptions);
                        pieChartWidth = $("#pie-charts").width();
                        pieChart.resize({
                            width: pieChartWidth,
                            height: 350
                        });
                        $("#line_chart_datalabel11").html(''); 
                        var lineChartDatalabelColors = getChartColorsArray("line_chart_datalabel11");
                        var maxamount=10;
                        datares.totalamount2.forEach(element => {
                            if(element>maxamount){
                                maxamount=element;
                            }
                        });
                        if (lineChartDatalabelColors) {
                            var options = {
                                chart: {
                                    height: 380,
                                    type: 'line',
                                    zoom: {
                                        enabled: false
                                    },
                                    toolbar: {
                                        show: false
                                    }
                                },
                                colors: lineChartDatalabelColors,
                                dataLabels: {
                                    enabled: false,
                                },
                                stroke: {
                                    width: [3, 3],
                                    curve: 'straight'
                                },
                                series: [{
                                        name: 'VMC Fault Maintenance',
                                        data: datares.totalvmc
                                    },
                                    {
                                        name: 'Electric Fault',
                                        data: datares.totalelectricfault
                                    },
                                    {
                                        name: 'Setting Time',
                                        data: datares.totalsetting
                                    },
                                    {
                                        name: 'Chhol Clearing',
                                        data: datares.totalchhol
                                    },
                                    {
                                        name: 'Operator Fault',
                                        data: datares.totaloperator
                                    },
                                    {
                                        name: 'Lunch Time',
                                        data: datares.totallunch
                                    },
                                    {
                                        name: 'No Any Work',
                                        data: datares.totalnoanywork
                                    }
                                ],
                                title: {
                                    text: 'Monthly Total',
                                    align: 'left',
                                    style: {
                                        fontWeight: '500',
                                    },
                                },
                                grid: {
                                    row: {
                                        colors: ['transparent',
                                        'transparent'], // takes an array which will be repeated on columns
                                        opacity: 0.2
                                    },
                                    borderColor: '#f1f1f1'
                                },
                                markers: {
                                    style: 'inverted',
                                    size: 6
                                },
                                xaxis: {
                                    categories: (datares.months),
                                    title: {
                                        text: 'Month'
                                    }
                                },
                                yaxis: {
                                    title: {
                                        text: 'Total Hours'
                                    },
                                    min: 0,
                                    max: maxamount
                                },
                                legend: {
                                    position: 'top',
                                    horizontalAlign: 'right',
                                    floating: true,
                                    offsetY: -25,
                                    offsetX: -5
                                },
                                responsive: [{
                                    breakpoint: 600,
                                    options: {
                                        chart: {
                                            toolbar: {
                                                show: false
                                            }
                                        },
                                        legend: {
                                            show: false
                                        },
                                    }
                                }]
                            }
                            console.log(options);
                            var chart = new ApexCharts(
                                document.querySelector("#line_chart_datalabel11"),
                                options
                            );

                            chart.render();

                        }
                    }

                    });
                return false;
            }
    </script>
    {{-- <script src="{{ URL::asset('/assets/js/pages/tui-charts.init.js') }}"></script> --}}
    <script src="{{ URL::asset('assets/js/app.min.js') }}"></script>
@endsection
