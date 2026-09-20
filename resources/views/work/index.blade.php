@extends('layouts.master')

@section('title') Work Log @endsection

@section('css')
    <!-- DataTables -->
    <link href="//cdnjs.cloudflare.com/ajax/libs/select2/4.0.0/css/select2.min.css" rel="stylesheet" />
    
    <link href="{{ URL::asset('/assets/libs/bootstrap-timepicker/bootstrap-timepicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/bootstrap-datepicker/bootstrap-datepicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/spectrum-colorpicker/spectrum-colorpicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/bootstrap-touchspin/bootstrap-touchspin.min.css') }}" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" href="{{ URL::asset('/assets/libs/datepicker/datepicker.min.css') }}">

    <link href="{{ URL::asset('/assets/libs/datatables/datatables.min.css') }}" rel="stylesheet" type="text/css" />
    <style>
        .modal-dialog-scrollable {
        overflow-y: scroll;
        max-height: 80vh; /* You can adjust this value to fit your needs */
    }
    </style>
@endsection

@section('content')



    @component('components.breadcrumb')
        @slot('li_1') Work @endslot
        @slot('title') Work Data @endslot
    @endcomponent


    <div class="row">
        <div class="col-lg-12">
            <div class="card">
                <div class="card-body">
                   <div class="row">
                    <div class="col">
                        <div class="row">
                            <div class="col-sm-auto"> 
                                <button onclick="return addwork();" type="button" class="btn btn-primary btn-lg waves-effect waves-light" data-bs-toggle="modal" style="margin-bottom: 10px;">Add Work</button>   
                            </div>
                            <div class="col-sm-auto"> 
                                {{-- <h2 class="card-title" style="font-size: 18px; margin: 7px 0 0 7px;!important">Total Hr: {{$amount}}</h2> --}}
                                <span class="badge badge-soft-dark" id="totalhr" style="padding: 13px;font-size: 15px;background-color:rgb(88 167 85 / 18%);!important">Total Hr : {{$amount}}</span>
                               
                            </div>
    
                        </div>
                    </div>
                    <div class="col">
                        @if (Auth::user()->role==0 || Auth::user()->role==1)
                               
                        <div class="row gy-2 gx-3 align-items-center" style="justify-content: right;">
                               
                            <div class="col-sm-auto">
                                <label class="visually" for="autoSizingSelect" style="margin-bottom: 10px;">User</label>
                            </div>
                            <div class="col-sm-auto">
                                <select class="form-control" id="select222" style="margin-bottom: 10px;">
                                    <option selected value="">Select </option>
                                        @foreach($data2 as $value)
                                            <option value="{{$value->id}}">{{$value->name}}</option>
                                        @endforeach
                                </select>
                            </div>
                            <div class="col-sm-auto">
                                <div class="input-group" id="datepicker" style="margin-bottom: 10px;">
                                    <input type="text" name="wdate" class="form-control" placeholder="Pick a date" data-date-format="dd/mm/yyyy" data-date-container='#datepicker' data-provide="datepicker" data-date-autoclose="true" id="wdate" autocomplete="off" value={{$currentDateTime}}>
                                    <span class="input-group-text"><i class="mdi mdi-calendar" ></i></span>
                                </div>
                            </div>
                            <div class="col-sm-auto">
                                <button onclick="return gettabledata();" class="btn btn-primary btn-lg float-end" data-bs-toggle="modal" style="margin-bottom: 10px;">View</button>
                            </div>
                           
                            <div class="col-sm-auto">
                                <button onclick="window.location='{{ url('/workdata') }}'" class="btn btn-primary btn-lg float-end" data-bs-toggle="modal" style="margin-bottom: 10px;">View Worklist</button>
                            </div>
                        </div>
                        @else
                                <div class="col-sm-auto"> 
                                            
                                    <button onclick="window.location='{{ url('/workdata') }}'" class="btn btn-primary btn-lg float-end" data-bs-toggle="modal" style="margin-bottom: 10px;">View Worklist</button>
                                </div>
                        @endif
                   
                    </div>
                    </div> 
                    
                    <!-- Add Modal Start -->
                    <div class="modal fade" id="exampleModalScrollable" tabindex="-1" role="dialog" aria-labelledby="exampleModalScrollableTitle" aria-hidden="true">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content modal-lg modal-dialog-scrollable">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="exampleModalScrollableTitle">MOULD WORK</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                
                                <form autocomplete="off" action="{{route('work.store')}}" method="post" class="needs-validation" novalidate>
                                    @csrf
 
                                    <!-- Equivalent to... -->
                                    <input type="hidden" name="_token" value="{{ csrf_token() }}" />
                                <div class="modal-body">
                                        <div class="row">                                   
                                                <div class="mb-3">
                                                    <label>Work Submission for Date</label>
                                                    <div class="input-group" id="datepicker2">
                                                        <input type="text" name="rdate" class="form-control" placeholder="Pick a date"
                                                            data-date-format="dd/mm/yyyy" data-date-container='#datepicker2'
                                                            data-provide="datepicker" data-date-autoclose="true" id="rdate">
                        
                                                        <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                                    </div><!-- input-group -->
                                                </div>    
                                        </div>
                                        <div class="mb-3">
                                            <label for="validationCustom01" class="form-label">Customer Name</label>
                                               <select required class="form-control select2" style="width: 100%;" name="cname" id="cname" onchange="return getproject();">
                                                    <option selected disabled value="">Select Customer Name</option>
                                                    @foreach($data as $value)
                                                        <option value="{{$value->id}}">{{$value->customername}}</option>
                                                    @endforeach
                                                </select>
                                                {{-- <span id="error"></span> --}}
                                                <div class="invalid-feedback">
                                                    Please Select Customer
                                                </div>
                                        </div>
                                        <div class="mb-3">
                                            <label for="validationCustom001" class="form-label">Mould Name</label>
                                               <select required class="form-control select22" style="width: 100%;" name="projectid" id="projectid" onchange="return getcustomerdata();">
                                                    
                                                <option value="">Select Mould Name</option>
                                                                                                  
                                                </select>
                                                {{-- <span id="error"></span> --}}
                                                <div class="invalid-feedback">
                                                    Please Select Mould
                                                </div>
                                        </div>
                                        <div class="mb-3">
                                            <label for="validationCustom001" class="form-label">Sub Plate</label>
                                               <select required class="form-control select22" style="width: 100%;" name="subplateid" id="subplateid">
                                                    
                                                <option value="">Select SubPlate</option>
                                                                                                  
                                                </select>
                                                {{-- <span id="error"></span> --}}
                                                <div class="invalid-feedback">
                                                    Please Select SubPlate
                                                </div>
                                        </div>
                                        <div class="mb-3">
                                            <label for="validationCustom02" class="form-label">Part Description</label>
                                            <textarea required class="form-control" placeholder="Part Description"
                                                 name="description" id="description" readonly></textarea>
                                                 <div class="invalid-feedback">
                                                    Please Enter Part Description
                                                </div>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label">Work Type</label>
                                            <div>
                                                <input  class="form-control" type="text" name="worktype" id="worktype" readonly/>
                                                <input  class="form-control" type="hidden" name="scan_print_id" id="scan_print_id" />
                                                <input  class="form-control" type="hidden" name="id" id="id" />
                                                  
                                                </div>
                                            
                                        </div>
                                        <div class="mb-3">
                                            <label for="validationCustom02" class="form-label">Work Description</label>
                                            <textarea required class="form-control" placeholder="Work Description"
                                                 name="workdescription" id="workdescription"></textarea>
                                                 <div class="invalid-feedback">
                                                    Please Enter Work Description
                                                </div>
                                        </div>
                                        {{-- <div class="row">
                                            <label for="validationCustom03" class="form-label">Work Type</label >
                                            <div class="col-md-3">                                                                                        
                                                    <div class="form-check mb-3">
                                                        <input class="form-check-input" type="radio" name="worktype" id="formRadios1" value="R.E.">
                                                        <label class="form-check-label" for="formRadios1">
                                                            R.E.
                                                        </label>
                                                    </div>    
                                            </div>
                                            <div class="col-md-3">
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="radio" name="worktype" value="Insp." id="formRadios2">
                                                        <label class="form-check-label" for="formRadios2">
                                                            Insp.
                                                        </label>
                                                    </div>  
                                            </div>
                                            <div class="col-md-3">
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="radio" name="worktype" value="Scan" id="formRadios3">
                                                        <label class="form-check-label" for="formRadios3">
                                                            Scan Only
                                                        </label>
                                                    </div>
                                            </div>
                                            <div class="col-md-3">
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="radio" name="worktype" value="Design" id="formRadios4">
                                                        <label class="form-check-label" for="formRadios4">
                                                            Design
                                                        </label>
                                                    </div>
                                              
                                            </div>
                                        </div> --}}
                                        {{-- <div class="mb-3">
                                            <label for="example-text-input" class="form-label">Sub Plate Name</label>
                                            <input class="form-control" type="text" id="initials" name="initials"> 
                                        </div>     --}}
                                        @if (Auth::user()->usersubtype == 'Machine' || Auth::user()->usertype == 'Admin' || Auth::user()->usertype == 'Manager')
                                        <div class="row">
                                            <div class="col">
                                                <div class="mb-3">
                                                    <label>Start Date</label>
                                                    <div class="input-group" id="datepicker3">
                                                        <input type="text" name="sdate" class="form-control" placeholder="Pick a date"
                                                            data-date-format="dd/mm/yyyy" data-date-container='#datepicker3'
                                                            data-provide="datepicker" data-date-autoclose="true" id="sdate">
                        
                                                        <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                                    </div><!-- input-group -->
                                                </div> 
                                            </div>
                                            <div class="col">
                                                <div class="mb-3">
                                                    <label class="form-label">Start Time</label>
                                                    <div class="input-group" id="timepicker-input-group1">
                                                        <input name="starttime" id="timepicker" type="text" class="form-control" data-provide="timepicker">
                                                        <span class="input-group-text"><i class="mdi mdi-clock-outline"></i></span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="row">
                                            <div class="col">
                                                <div class="mb-3">
                                                    <label>End Date</label>
                                                    <div class="input-group" id="datepicker4">
                                                        <input type="text" name="edate" class="form-control" placeholder="Pick a date"
                                                            data-date-format="dd/mm/yyyy" data-date-container='#datepicker4'
                                                            data-provide="datepicker" data-date-autoclose="true" id="edate">
                                                            {{-- data-provide="datepicker" data-date-autoclose="true" id="edate" data-date-start-date="0d"> --}}
                                                        <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                                    </div><!-- input-group -->
                                                </div> 
                                            </div>
                                            <div class="col">
                                                <div class="mb-3">
                                                    <label class="form-label">End Time</label>
                                                    <div class="input-group" id="timepicker-input-group3">
                                                        <input name="endtime" id="timepicker3" type="text" class="form-control" data-provide="timepicker">
                                                        <span class="input-group-text"><i class="mdi mdi-clock-outline"></i></span>
                                                    </div>
                                                </div> 
                                            </div>
                                        </div>
                                        {{-- <div class="mb-3">
                                            <label class="form-label">Start Time</label>
                                            <div class="input-group" id="timepicker-input-group1">
                                                <input name="starttime" id="timepicker" type="text" class="form-control" data-provide="timepicker">
                                                <span class="input-group-text"><i class="mdi mdi-clock-outline"></i></span>
                                            </div>
                                        </div>   --}}
                                        {{-- <div class="mb-3">
                                            <label class="form-label">End Time</label>
                                            <div class="input-group" id="timepicker-input-group3">
                                                <input name="endtime" id="timepicker3" type="text" class="form-control" data-provide="timepicker">
                                                <span class="input-group-text"><i class="mdi mdi-clock-outline"></i></span>
                                            </div>
                                        </div>  --}}
                                        @endif 
                                        <div class="row">
                                            @if (Auth::user()->usersubtype == 'Machine' || Auth::user()->usertype == 'Admin' || Auth::user()->usertype == 'Manager')
                                            <div class="col">
                                                <div class="mb-3">
                                                    <label class="form-label">Work Hr</label>
                                                    <div>
                                                        <input class="form-control" type="text" name="work_hr" id="work_hr" readonly/>
                                                            <div class="invalid-feedback">
                                                              
                                                            </div>
                                                        </div>
                                                    
                                                </div>
                                            </div>
                                            @endif
                                            {{-- @if (Auth::user()->usersubtype != 'Machine')
                                            <div class="col">
                                                <div class="mb-3">
                                                    <label class="form-label">Designing Work Hr</label>
                                                    <div>
                                                        <input class="form-control" type="text" name="design_hr" id="design_hr" />
                                                            <div class="invalid-feedback">
                                                              
                                                            </div>
                                                        </div>
                                                    
                                                </div>
                                            </div>
                                            <div class="col" style="padding-right : 11px;padding-left : 11px;!important">
                                                <div class="mb-3">
                                                    <label class="form-label">Programming Work Hr</label>
                                                    <div>
                                                        <input class="form-control" type="text" name="program_hr" id="program_hr" />
                                                            <div class="invalid-feedback">
                                                              
                                                            </div>
                                                        </div>
                                                    
                                                </div>
                                            </div>
                                            <div class="col">
                                                <div class="mb-3">
                                                    <label class="form-label">Machining Work Hr</label>
                                                    <div>
                                                        <input class="form-control" type="text" name="machine_hr" id="machine_hr" />
                                                            <div class="invalid-feedback">
                                                              
                                                            </div>
                                                        </div>
                                                    
                                                </div>
                                            </div>
                                            <div class="col">
                                                <div class="mb-3">
                                                    <label class="form-label">Drill Tap Work Hr</label>
                                                    <div>
                                                        <input class="form-control" type="text" name="driltap_hr" id="driltap_hr" />
                                                            <div class="invalid-feedback">
                                                              
                                                            </div>
                                                        </div>
                                                    
                                                </div>
                                            </div>
                                            <div class="col">
                                                <div class="mb-3">
                                                    <label class="form-label">QC Work Hr</label>
                                                    <div>
                                                        <input class="form-control" type="text" name="qc_hr" id="qc_hr" />
                                                            <div class="invalid-feedback">
                                                              
                                                            </div>
                                                        </div>
                                                    
                                                </div>
                                            </div>
                                            @endif --}}
                                        </div>  
                                                                         
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-light" data-bs-dismiss="modal">Close</button>
                                    <button class="btn btn-primary" type="submit">Submit form</button>
                                </div>
                                </form>
                            </div><!-- /.modal-content -->
                        </div><!-- /.modal-dialog -->
                    </div><!-- /.modal -->
                    <!-- Add Data Modal End-->
                    

                    <table id="datatablework" class="table table-sm m-0 table-responsive" style="width: 100%!important">
                        <thead>
                            <tr> 
                                {{-- @if (Auth::user()->usersubtype == 'Machine') --}}
                                <th style="width: 6%;">Date</th>                      
                                <th style="width: 11%;">Customer Name</th>
                                <th style="width: 4%;">Mould</th>
                                <th style="width: 7%;">Sub Plate</th>
                                <th style="width: 6%;">Work Type</th>
                                <th>Part Description</th>
                                <th>Work Description</th>
                                <th style="width: 5%;">Username</th>  
                                <th style="width: 6%;">Start Date</th>
                                <th style="width: 6%;">Start Time</th>
                                <th style="width: 6%;">End Date</th>
                                <th style="width: 6%;">End Time</th>            
                                <th style="width: 5%;">Work Hr</th>
                                <th style="width: 1%;">Action<th>
                                {{-- @else
                                
                                <th style="width: 7%;">Date</th>                      
                                <th style="width: 11%;">Customer Name</th>
                                <th style="width: 4%;">Mould</th>
                                <th style="width: 7%;">Sub Plate</th>
                                <th style="width: 8%;">Work Type</th>
                                <th>Part Description</th> 
                                <th style="width: 5%;">Username</th>   
                                <th style="width: 7%;">Design Hr</th>                   
                                <th style="width: 6%;">Prog Hr</th>
                                <th style="width: 7%;">Mach Hr</th>
                                <th style="width: 5%;">DT Hr</th>
                                <th style="width: 5%;">Qc Hr</th>
                                <th style="width: 5%;">M Hr</th>
                                <th style="width: 1%;">Action<th>
                            @endif  --}}
                            </tr>
                            
                        </thead>


                        <tbody>
                            
                        </tbody>
                    </table>
                </div>
            </div>
        </div> <!-- end col -->
    </div> <!-- end row -->

  
@endsection
@section('script')
    <!-- Required datatable js -->

    <script src="{{ URL::asset('/assets/libs/select2/select2.min.js') }}"></script> 
    <script src="{{ URL::asset('/assets/libs/bootstrap-datepicker/bootstrap-datepicker.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/spectrum-colorpicker/spectrum-colorpicker.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/bootstrap-timepicker/bootstrap-timepicker.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/bootstrap-touchspin/bootstrap-touchspin.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/bootstrap-maxlength/bootstrap-maxlength.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/datepicker/datepicker.min.js') }}"></script>

    <!-- form advanced init -->
    <script src="{{ URL::asset('/assets/js/pages/form-validation.init.js') }}"></script>
    <script src="{{ URL::asset('/assets/js/pages/form-advanced.init.js') }}"></script>
    <!-- form advanced init -->
    <script src="{{ URL::asset('/assets/libs/datatables/datatables.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/jszip/jszip.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/pdfmake/pdfmake.min.js') }}"></script>
    <!-- Datatable init js -->
    <script src="{{ URL::asset('/assets/js/pages/datatables.init.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/parsleyjs/parsleyjs.min.js') }}"></script>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js"></script>
    
    {{-- <script src="//cdnjs.cloudflare.com/ajax/libs/select2/4.0.0/js/select2.min.js"></script> --}}


    <!-- form advanced init -->
    <!-- Datatable init js -->
    <script>
//            $(function() {
//         // Listen to changes in start and end time inputs
//         // $('#timepicker, #timepicker3').on('change', function() {
            
//         //     // Get the start and end time values
//         //     // var starttime = $('#timepicker').val();
//         //     // var endtime = $('#timepicker3').val();

//         //     // // Calculate the difference between the two times
//         //     // var start = moment(starttime, 'HH:mm A');
//         //     // var end = moment(endtime, 'HH:mm A');
//         //     // var duration = moment.duration(end.diff(start));
//         //     // var hours = duration.asHours().toFixed(2);

//         //     // // Update the work hours input with the calculated value
//         //     // $('#work_hr').val(hours);
//         //         // Get the start and end time values from your inputs
//         //     var startTime = $('#timepicker').val();
//         //     var endTime = $('#timepicker3').val();

//         //     // Create moment objects with today's date and the start and end time values
//         //     // var startMoment = moment('1970-01-01 ' + startTime, 'YYYY-MM-DD HH:mm A');
//         //     // var endMoment = moment('1970-01-01 ' + endTime, 'YYYY-MM-DD HH:mm A');

//         //     var startMoment = moment(new Date().toLocaleDateString() + ' ' + $('#timepicker').val(), 'MM/DD/YYYY hh:mm A');
//         //     var endMoment = moment(new Date().toLocaleDateString() + ' ' + $('#timepicker3').val(), 'MM/DD/YYYY hh:mm A');

//         //     // Add a day to the end moment if it's earlier than the start moment
//         //     if (endMoment.isBefore(startMoment)) {
//         //         endMoment.add(1, 'day');
//         //     }

//         //     // Calculate the duration in milliseconds
//         //     var duration = endMoment.diff(startMoment);

//         //     // Convert the duration to hours
//         //     var hours = moment.duration(duration).asHours();

//         //     // Output the hours to the work_hr input field
//         //     $('#work_hr').val(hours);
            
//         // });
//         $('#timepicker, #timepicker3').on('change', function() {
//     var startTime = moment($('#timepicker').val(), 'h:mm A');
//     var endTime = moment($('#timepicker3').val(), 'h:mm A');

//     // Calculate the duration between the times
//     var duration = moment.duration(endTime.diff(startTime));

//     // Format the duration as "hh:mm" format
//     var formattedDuration = moment.utc(duration.asMilliseconds()).format("HH:mm");

//     // Output the formatted duration to the work_hr input field
//     $('#work_hr').val(formattedDuration);
// });

//     });
$(document).ready(function() {
    $('#timepicker, #timepicker3, #datepicker3, #datepicker4').on('change', function() {
        // Log the values for debugging
        console.log('Start Date:', $('#sdate').val());
        console.log('Start Time:', $('#timepicker').val());
        console.log('End Date:', $('#edate').val());
        console.log('End Time:', $('#timepicker3').val());

        // Parse start and end date-times using Moment.js
        var startDate = moment($('#sdate').val() + ' ' + $('#timepicker').val(), 'DD/MM/YYYY h:mm A');
        var endDate = moment($('#edate').val() + ' ' + $('#timepicker3').val(), 'DD/MM/YYYY h:mm A');

        // Calculate the duration between the dates and times
        var duration = moment.duration(endDate.diff(startDate));

        // Calculate the hours and minutes
        var hours = Math.floor(duration.asHours());
        var minutes = Math.floor(duration.asMinutes()) - hours * 60;

        // Format the duration as "hh:mm" format
        var formattedDuration = hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');

        // Output the formatted duration to the work_hr input field
        $('#work_hr').val(formattedDuration);
    });
});



    </script>
    <script>
    $(document).ready( function() {
    var now = new Date();
    var month = (now.getMonth() + 1);               
    var day = now.getDate();
    if (month < 10) 
        month = "0" + month;
    if (day < 10) 
        day = "0" + day;
    var today = day  + '/' + month + '/' + now.getFullYear();
    $('#rdate').val(today);
    });
    </script>
     <script>
        $(document).ready( function() {
        var now = new Date();
        var month = (now.getMonth() + 1);               
        var day = now.getDate();
        if (month < 10) 
            month = "0" + month;
        if (day < 10) 
            day = "0" + day;
        var today = day  + '/' + month + '/' + now.getFullYear();
        $('#sdate').val(today);
        });
        </script>
        
        <script>
            $(document).ready( function() {
            var now = new Date();
            var month = (now.getMonth() + 1);               
            var day = now.getDate();
            if (month < 10) 
                month = "0" + month;
            if (day < 10) 
                day = "0" + day;
            var today = day  + '/' + month + '/' + now.getFullYear();
            $('#edate').val(today);
            });
        </script>
    <script>
    $('body').on('click','.editScan',function(){
    var scanid=$this.data('id');
    $.get("{{route('scanning.index')}}"+"/"+scanid+"/edit",function(data){
    $("modalHeading").html("Edit Data");
    $('#ajaxmodal').modal('show');
    $('#scanid').val(data.id);
    });
 });
    </script>
     {{-- @if (Auth::user()->usersubtype == 'Machine') --}}
    <script type="text/javascript">
        function gettabledata(){
            $('#datatablework').DataTable({
                
              processing: true,
              serverSide: false,
              "bDestroy": true,
              pageLength:50,
              ajax: {
                    url: "{{route('getworkdata')}}"+"?userid="+$("#select222").val()+"&wdate="+$("#wdate").val(),
                    type: 'GET',
                }, 
              columns: [
                  {data: 'rdate', name: 'rdate', render: {
                        _: 'display',
                        sort: 'timestamp'
                   }},
                  {data: 'customerid', name: 'customerid'},
                  {data: 'projectid', name: 'projectid'},    
                  {data: 'subplateid', name: 'subplateid'},                
                  {data: 'worktype', name: 'worktype'},                
                  {data: 'description', name: 'description'}, 
                  {data: 'workdescription', name: 'workdescription'},
                  {data: 'username', name: 'username'}, 
                  {data : {'_': 'sdate.display', 'sort': 'sdate.timestamp'}, name: 'sdate', orderable: true},
                  {data: 'starttime', name: 'starttime'},
                  {data : {'_': 'edate.display', 'sort': 'edate.timestamp'}, name: 'edate', orderable: true},
                  {data: 'endtime', name: 'endtime'},         
                  {data: 'work_hr', name: 'work_hr'},                            
                  {data: 'action', name: 'action', orderable: false, searchable: false},
              ]
          });
          $.ajax({
            type: 'GET',
            url: "{{route('gethrcountdata')}}" +"?userid="+$("#select222").val()+"&wdate="+$("#wdate").val(),
            success: function(data) {
                // console.log(data);
                $("#totalhr").text("Total Hr : " + data.amount);
            }
        });
        }
        $(function () {
           
        $('#datatablework').DataTable({
              processing: true,
              serverSide: false,
              "bDestroy": true,
              pageLength:50,
              ajax: "{{route('getworkdata')}}",
              columns: [
                  {data: 'rdate', name: 'rdate', render: {
                        _: 'display',
                        sort: 'timestamp'
                   }},
                  {data: 'customerid', name: 'customerid'},
                  {data: 'projectid', name: 'projectid'},
                  {data: 'subplateid', name: 'subplateid'},                
                  {data: 'worktype', name: 'worktype'},                
                  {data: 'description', name: 'description'},  
                  {data: 'workdescription', name: 'workdescription'},
                  {data: 'username', name: 'username'},
                  {data : {'_': 'sdate.display', 'sort': 'sdate.timestamp'}, name: 'sdate', orderable: true},
                  {data: 'starttime', name: 'starttime'},
                  {data : {'_': 'edate.display', 'sort': 'edate.timestamp'}, name: 'edate', orderable: true},
                  {data: 'endtime', name: 'endtime'},         
                  {data: 'work_hr', name: 'work_hr'},                     
                  {data: 'action', name: 'action', orderable: false, searchable: false},
              ]
          });
          
        });
    </script>
       {{-- @else --}}
       {{-- <script type="text/javascript">
        function gettabledata(){
            $('#datatablework').DataTable({
              processing: true,
              serverSide: false,
              "bDestroy": true,
              pageLength:50,
              ajax: {
                    url: "{{route('getworkdata')}}"+"?userid="+$("#select222").val()+"&wdate="+$("#wdate").val(),
                    type: 'GET',
                }, 
              columns: [
                  {data: 'rdate', name: 'rdate', render: {
                        _: 'display',
                        sort: 'timestamp'
                   }},
                  {data: 'customerid', name: 'customerid'},
                  {data: 'projectid', name: 'projectid'},     
                  {data: 'subplateid', name: 'subplateid'},            
                  {data: 'worktype', name: 'worktype'},                
                  {data: 'description', name: 'description'}, 
                  {data: 'username', name: 'username'},              
                  {data: 'design_hr', name: 'design_hr'},               
                  {data: 'program_hr', name: 'program_hr'},
                  {data: 'machine_hr', name: 'machine_hr'},
                  {data: 'driltap_hr', name: 'driltap_hr'},                    
                  {data: 'qc_hr', name: 'qc_hr'},       
                  {data: 'work_hr', name: 'work_hr'},
                  {data: 'action', name: 'action', orderable: false, searchable: false},
              ]
          });
          $.ajax({
            type: 'GET',
            url: "{{route('gethrcountdata')}}" +"?userid="+$("#select222").val()+"&wdate="+$("#wdate").val(),
            success: function(data) {
                // console.log(data);
                $("#totalhr").text("Total Hr : " + data.amount);
            }
        });
        }
        $(function () {
           
        $('#datatablework').DataTable({
              processing: true,
              serverSide: false,
              "bDestroy": true,
              pageLength:50,
              ajax: "{{route('getworkdata')}}",
              columns: [
                  {data: 'rdate', name: 'rdate', render: {
                        _: 'display',
                        sort: 'timestamp'
                   }},
                  {data: 'customerid', name: 'customerid'},
                  {data: 'projectid', name: 'projectid'},
                  {data: 'subplateid', name: 'subplateid'},                
                  {data: 'worktype', name: 'worktype'},                
                  {data: 'description', name: 'description'},  
                  {data: 'username', name: 'username'},                   
                  {data: 'design_hr', name: 'design_hr'},               
                  {data: 'program_hr', name: 'program_hr'},
                  {data: 'machine_hr', name: 'machine_hr'},
                  {data: 'driltap_hr', name: 'driltap_hr'},                    
                  {data: 'qc_hr', name: 'qc_hr'},   
                  {data: 'work_hr', name: 'work_hr'},     
                  {data: 'action', name: 'action', orderable: false, searchable: false},
              ]
          });
          
        });
    </script>
    @endif    --}}
        <script type="text/javascript">
        function changestatus(id){
            var scan=document.getElementById("scanby_"+id).value;
            var qc=document.getElementById("qc_"+id).value;
            var modeldesign=document.getElementById("modeldesign_"+id).value;
            // if(scan==""){
            //     alert("Select User for scan.")
            //     return false;
            // }
            // if(qc==""){
            //     alert("Select User for qc.")
            //     return false;
            // }
            // if(modeldesign==""){
            //     alert("Select User for model design.")
            //     return false;
            // }
            $.ajax({
               type:'POST',
               url:"{{route('scanning.updatestatus')}}",
               data: {_token: "{{ csrf_token() }}", status:"registered", scan:scan,qc:qc,modeldesign:modeldesign,id:id},
               success:function(data) {
                  $("#scan_"+id).remove();
               }
            });
        }
      </script> 
    
    <script type="text/javascript">
        
        $(document).ready(function() {
    $(".select2").select2({
    dropdownParent: $("#exampleModalScrollable")
  });
  $("#select2").select2({
    dropdownParent: $("#exampleModalScrollable1")
  });
});
         
$(document).on('focus', '.select2.select2-container', function (e) {
            // only open on original attempt - close focus event should not fire open
            if (e.originalEvent && $(this).find(".select2-selection--single").length > 0) {
                $(this).siblings('select').select2('open');
            } 
            });
            $(document).on('select2:open', () => {
                document.querySelector('.select2-search__field').focus();
            });
         </script>
       <script type="text/javascript">
        $(document).ready(function() {
    $(".select2").select2({
    dropdownParent: $("#exampleModalScrollable")
  });
  $("#select2").select2({
    dropdownParent: $("#exampleModalScrollable1")
  });
});
         </script> 
         <script type="text/javascript">
            $(document).ready(function() {
        $(".select22").select2({
        dropdownParent: $("#exampleModalScrollable")
      });
      $("#select22").select2({
        dropdownParent: $("#exampleModalScrollable1")
      });
    });
    var project="";
    function getproject(){
        $("#subplateid").empty().trigger('change');
        $.ajax({
               type:'POST',
               url:"{{route('customer.getprojectswork')}}",
               data: {_token: "{{ csrf_token() }}", cid:$("#cname").val()},
               success:function(data) {
                 $("#projectid").html(data);
                 if(project!=""){
                    $("#projectid").val(project).trigger('change');
                 }
               }
            });
    }
    function addwork(){
        $("#cname").val("").trigger('change');
            var now = new Date();
            var month = (now.getMonth() + 1);               
            var day = now.getDate();
            if (month < 10) 
                month = "0" + month;
            if (day < 10) 
                day = "0" + day;
            var today = day  + '/' + month + '/' + now.getFullYear();
            $('#rdate').val(today);
            $(document).ready( function() {
            var now = new Date();
            var month = (now.getMonth() + 1);               
            var day = now.getDate();
            if (month < 10) 
                month = "0" + month;
            if (day < 10) 
                day = "0" + day;
            var today = day  + '/' + month + '/' + now.getFullYear();
            $('#sdate').val(today);
            });
            $(document).ready( function() {
            var now = new Date();
            var month = (now.getMonth() + 1);               
            var day = now.getDate();
            if (month < 10) 
                month = "0" + month;
            if (day < 10) 
                day = "0" + day;
            var today = day  + '/' + month + '/' + now.getFullYear();
            $('#edate').val(today);
            });
            // $("#rdate").val(""); 
            $("#description").html("");
            $("#workdescription").html("");
            $("#worktype").val("");
            $("#scan_print_id").val("");
            $("#id").val("");
            $("#work_hr").val("");
            $("#design_hr").val("");
            // $("#work_hr").val("");
            var currentTime = now.getHours() + ':' + now.getMinutes();
            $('#timepicker').timepicker('setTime', currentTime);
            $('#timepicker3').timepicker('setTime', currentTime);
            $("#qc_hr").val("");
            $("#driltap_hr").val("");
            $("#machine_hr").val("");
            $("#program_hr").val("");
            $('#rdate').removeAttr("disabled");
            $("#exampleModalScrollable").modal("toggle");
    }
    function Edit(data,worktype,description){
        if (typeof description === 'string') {
                var data = JSON.parse(data.replace(/'/g, '"'));
        // var data=JSON.parse(data.replaceAll("'","\""));
        project=data.projectid;
        console.log(data);
             
            $("#cname").val(data.customerid).trigger('change');
            @if (Auth::user()->role==0){$("#rdate").val(data.rdate);}
            @else{$("#rdate").val(data.rdate).prop('disabled', true);}
            @endif
            $("#description").html(description);
            $("#workdescription").val(data.workdescription.replace("<>","\""));
            // $("#workdescription").html(data.workdescription);
            $("#worktype").val(worktype);
            $("#scan_print_id").val(data.scan_print_id);
            $("#sdate").val(data.sdate);
            $("#edate").val(data.edate);
            $("#id").val(data.id);
            // var whr =  moment(data.work_hr, "HH:mm:ss").format("HH:mm");
            // console.log(whr);
            $("#work_hr").val(data.work_hr);
            var formattedStartTime = moment(data.starttime, "HH:mm:ss").format("h:mm A");
            var formattedEndTime = moment(data.endtime, "HH:mm:ss").format("h:mm A");
            
            $("#timepicker").val(formattedStartTime); // Set the starttime input in "4:26 PM" format
            $("#timepicker3").val(formattedEndTime);     // Set the endtime input in "4:26 PM" format
    
            // $("#timepicker").val(data.starttime);
            // $("#timepicker3").val(data.endtime);
            $("#design_hr").val(data.design_hr);
            $("#driltap_hr").val(data.driltap_hr);
            $("#machine_hr").val(data.machine_hr);
            $("#qc_hr").val(data.qc_hr);
            $("#program_hr").val(data.program_hr);
            $("#scan_hr").val(data.scan_hr);
            $("#model_hr").val(data.model_hr);
            }
            $("#exampleModalScrollable").modal("toggle");
        
        }
    function getcustomerdata(){
       // $('#subplateid').empty().trigger('change');
        // if($("#projectid").val().startsWith("P")){
        //     $("#printhr").css("display","");
        //     $("#reworkhr").css("display","none");
        //     $("#qchr").css("display","none");
        //     $("#insphr").css("display","none");
        //     $("#scanhr").css("display","none");
        //     $("#modelhr").css("display","none");
        // }else{
        //     $("#printhr").css("display","none");
        //     $("#reworkhr").css("display","");
        //     $("#qchr").css("display","");
        //     $("#insphr").css("display","");
        //     $("#scanhr").css("display","");
        //     $("#modelhr").css("display","");
        // }
        // $("#work_hr").val("");
        //     $("#driltap_hr").val("");
        //     $("#program_hr").val("");
        //     $("#machine_hr").val("");
        //     $("#design_hr").val("");
        //     $("#qc_hr").val("");
           // $("#model_hr").val("");
        $.ajax({
               type:'POST',
               url:"{{route('customer.getcustomerdata')}}",
               data: {_token: "{{ csrf_token() }}", cid:$("#cname").val(),projectid:$("#projectid").val()},
               success:function(data) {
                console.log(data);
                $('#subplateid').empty().trigger('change');
                 var newOption = [];
                 $(data).each(function(key,val){
                     $("#description").html(val.description);
                     $("#worktype").val(val.worktype);
                     $("#scan_print_id").val(val.projectid);
                    //  $("#worktype").html(data);
                    //push subplate array for select2 
                    newOption.push(new Option(val.platename, val.subprojectid, false, false));
                }); 
                $('#subplateid').append(newOption).trigger('change');
                 
               }
            });
    }
             </script> 
@endsection
