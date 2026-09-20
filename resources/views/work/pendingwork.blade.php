@extends('layouts.master')

@section('title') Work Log @endsection

@section('css')
    <!-- DataTables -->
    <link href="//cdnjs.cloudflare.com/ajax/libs/select2/4.0.0/css/select2.min.css" rel="stylesheet" />
    
    <link href="{{ URL::asset('/assets/libs/bootstrap-datepicker/bootstrap-datepicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/spectrum-colorpicker/spectrum-colorpicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/bootstrap-touchspin/bootstrap-touchspin.min.css') }}" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" href="{{ URL::asset('/assets/libs/datepicker/datepicker.min.css') }}">

    <link href="{{ URL::asset('/assets/libs/datatables/datatables.min.css') }}" rel="stylesheet" type="text/css" />
   
@endsection

@section('content')



    @component('components.breadcrumb')
        @slot('li_1') Work @endslot
        @slot('title') Work Data @endslot
    @endcomponent
<style>
.page-content {
    padding: 30px 12px 60px;!important
}
.vertical-menu { 
    top: 0px;!important
}
</style>

<div class="row">
    <div class="col-12">
        <div class="card">
            <div class="card-body">
                <div class="row">
                    <div class="col-4">
                    </div>
                    <div class="col-3">
                        <div class="input-group" id="datepicker" style="margin-bottom: 10px;">
                            <input type="text" name="wdate" class="form-control" placeholder="Pick a date" data-date-format="dd/mm/yyyy" data-date-container='#datepicker' data-provide="datepicker" data-date-autoclose="true" id="wdate" autocomplete="off" value={{$currentDateTime}} >
                            <span class="input-group-text"><i class="mdi mdi-calendar" ></i></span>
                        </div>
                    </div>
                    <div class="col-1" style="width:5.333333% !important;">
                            <button onclick="return gettabledata();" class="btn btn-primary btn-lg float-end" data-bs-toggle="modal" style="margin-bottom: 10px;">View</button>
                    </div>
                    <div class="col-4">
                    </div>
                </div>
                <table id="datatablependingworkdata" class="table table-sm m-0 table-responsive" style="width: 100%!important">
                    
                    <thead>
                        <tr>   
                            <th style="width: 6%;">Date</th>                      
                            {{-- <th style="width: 18%;">Customer Name</th> --}}
                            {{-- <th style="width: 8%;">Project Name</th> --}}
                            {{-- <th style="width: 7%;">Work Type</th> --}}
                            {{-- <th>Part Description</th>   --}}
                            <th style="width: 10%;">Username</th>             
                            <th style="width: 5%;">Work Hr</th>
                            <th style="width: 6%;">Designing Hr</th>                   
                            <th style="width: 4%;">Programming Hr</th>
                            <th style="width: 5%;">Machining Hr </th>
                            <th style="width: 5%;">Drill Tap Hr</th>
                            <th style="width: 6%;">QC Hr</th>
                            <th style="width: 6%;">Total</th>
                            {{-- <th style="width: 6%;">Action<th> --}}
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
  
    <!-- form advanced init -->
    <script src="{{ URL::asset('/assets/libs/datatables/datatables.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/jszip/jszip.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/pdfmake/pdfmake.min.js') }}"></script>
    <!-- Datatable init js -->
    <script src="{{ URL::asset('/assets/js/pages/datatables.init.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/parsleyjs/parsleyjs.min.js') }}"></script>
    
    {{-- <script src="//cdnjs.cloudflare.com/ajax/libs/select2/4.0.0/js/select2.min.js"></script> --}}


    <!-- form advanced init -->
    <!-- Datatable init js -->

    {{-- <script>
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
 $('body').on('click','.editScan',function(){
    var scanid=$this.data('id');
    $.get("{{route('scanning.index')}}"+"/"+scanid+"/edit",function(data){
    $("modalHeading").html("Edit Data");
    $('#ajaxmodal').modal('show');
    $('#scanid').val(data.id);
    });
 });
 
    </script> --}}
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
            function gettabledata(){
            $('#datatablependingworkdata').DataTable({
                pageLength:50,
              processing: true,
              serverSide: false,
              "bDestroy": true,
              ajax: {
                    url: "{{route('getpendingwork')}}"+"?wdate="+$("#wdate").val(),
                    type: 'GET',
                }, 
                columns: [
                        {data : {'_': 'rdate.display', 'sort': 'rdate.timestamp'}, name: 'rdate', orderable: true},
                        // {data: 'customerid', name: 'customerid', orderable: true, searchable: true},
                        // {data: 'projectid', name: 'projectid', orderable: true, searchable: true},                
                        // {data: 'worktype', name: 'worktype', orderable: true, searchable: true},                
                        // {data: 'description', name: 'description', orderable: true, searchable: true}, 
                        {data: 'name', name: 'name', orderable: true, searchable: true},           
                        {data: 'work_hr', name: 'work_hr', orderable: true, searchable: true},                     
                        {data: 'design_hr', name: 'design_hr', orderable: true, searchable: true},                     
                        {data: 'program_hr', name: 'program_hr', orderable: true, searchable: true},               
                        {data: 'machine_hr', name: 'machine_hr', orderable: true, searchable: true},               
                        {data: 'driltap_hr', name: 'driltap_hr', orderable: true, searchable: true},               
                        {data: 'qc_hr', name: 'qc_hr', orderable: true, searchable: true},    
                        {data: 'total', name: 'total', orderable: true, searchable: true},         
                        //   {data: 'action', name: 'action', orderable: false, searchable: false},
                    ],
                    "createdRow": function( row, data, dataIndex){
                        
                            if( data['total'] >= 9  ){
                                $(row).css('background-color', '#c3f7bd');
                            }
                            else if( data['total'] >= 8  ){
                                    $(row).css('background-color', '#f4db91');
                                }
                                else{
                                    $(row).css('background-color', '#f5b2b2');
                                }
                        }
          });
          
        }
        </script>
    @if (Auth::user()->role==0)
    <script>
        $(function () {
                
                $('#datatablependingworkdata').DataTable({
                    pageLength:50,
                    processing: true,
                    serverSide: false,
                    "bDestroy": true,
                    // dom: 'Bfrtip', 
                    // buttons: ['excel', 'pdf', 'print'],
                    ajax: "{{route('getpendingwork')}}",
                    columns: [
                        {data : {'_': 'rdate.display', 'sort': 'rdate.timestamp'}, name: 'rdate', orderable: true},
                        // {data: 'customerid', name: 'customerid', orderable: true, searchable: true},
                        // {data: 'projectid', name: 'projectid', orderable: true, searchable: true},                
                        // {data: 'worktype', name: 'worktype', orderable: true, searchable: true},                
                        // {data: 'description', name: 'description', orderable: true, searchable: true}, 
                        {data: 'name', name: 'name', orderable: true, searchable: true},           
                        {data: 'work_hr', name: 'work_hr', orderable: true, searchable: true},                     
                        {data: 'design_hr', name: 'design_hr', orderable: true, searchable: true},                     
                        {data: 'program_hr', name: 'program_hr', orderable: true, searchable: true},               
                        {data: 'machine_hr', name: 'machine_hr', orderable: true, searchable: true},               
                        {data: 'driltap_hr', name: 'driltap_hr', orderable: true, searchable: true},               
                        {data: 'qc_hr', name: 'qc_hr', orderable: true, searchable: true},    
                        {data: 'total', name: 'total', orderable: true, searchable: true},         
                        //   {data: 'action', name: 'action', orderable: false, searchable: false},
                    ],
                    "createdRow": function( row, data, dataIndex){
                            
                            if( data['total'] >= 9  ){
                                $(row).css('background-color', '#c3f7bd');
                            }
                            else if( data['total'] >= 8  ){
                                    $(row).css('background-color', '#f4db91');
                                }
                                else{
                                    $(row).css('background-color', '#f5b2b2');
                                }
                        }
                });
                
            });
    </script>
    @else
    <script>
        $(function () {
                
                $('#datatablependingworkdata').DataTable({
                    pageLength:25,
                    processing: true,
                    serverSide: false,
                    "bDestroy": true,
                    ajax: "{{route('getpendingwork')}}",
                    columns: [
                        {data : {'_': 'rdate.display', 'sort': 'rdate.timestamp'}, name: 'rdate', orderable: true},
                        // {data: 'customerid', name: 'customerid', orderable: true, searchable: true},
                        // {data: 'projectid', name: 'projectid', orderable: true, searchable: true},                
                        // {data: 'worktype', name: 'worktype', orderable: true, searchable: true},                
                        // {data: 'description', name: 'description', orderable: true, searchable: true}, 
                        {data: 'name', name: 'name', orderable: true, searchable: true},           
                        {data: 'work_hr', name: 'work_hr', orderable: true, searchable: true},                     
                        {data: 'design_hr', name: 'design_hr', orderable: true, searchable: true},                     
                        {data: 'program_hr', name: 'program_hr', orderable: true, searchable: true},
                        {data: 'machine_hr', name: 'machine_hr', orderable: true, searchable: true},               
                        {data: 'driltap_hr', name: 'driltap_hr', orderable: true, searchable: true},               
                        {data: 'qc_hr', name: 'qc_hr', orderable: true, searchable: true},
                        {data: 'total', name: 'total', orderable: true, searchable: true},              
                        //   {data: 'action', name: 'action', orderable: false, searchable: false},
                    ],
                    "createdRow": function( row, data, dataIndex){
                        if( data['total'] >= 9  ){
                                $(row).css('background-color', '#c3f7bd');
                            }
                            else if( data['total'] >= 8  ){
                                    $(row).css('background-color', '#f4db91');
                                }
                                else{
                                    $(row).css('background-color', '#f5b2b2');
                                }
                        }
                });
                
            });
    </script>
    @endif
@endsection
