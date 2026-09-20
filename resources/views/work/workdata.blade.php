@extends('layouts.master')

@section('title') Work Log @endsection

@section('css')
    <!-- DataTables -->
    <!-- <link href="//cdn.datatables.net/1.13.7/css/jquery.dataTables.min.css" rel="stylesheet" /> -->
    <link rel="stylesheet" type="text/css" href="{{ URL::asset('/assets/newlib/buttons.dataTables.min.css') }}">
    <link href="{{ URL::asset('/assets/newlib/select2.min.css') }}" rel="stylesheet" />
    <link href="{{ URL::asset('/assets/newlib/jquery.dataTables.min.css') }}" rel="stylesheet" />
    <!-- <link href="//cdn.datatables.net/buttons/2.4.2/css/buttons.dataTables.min.css" rel="stylesheet" /> -->
    <link href="{{ URL::asset('/assets/libs/bootstrap-datepicker/bootstrap-datepicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/spectrum-colorpicker/spectrum-colorpicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/bootstrap-touchspin/bootstrap-touchspin.min.css') }}" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" href="{{ URL::asset('/assets/libs/datepicker/datepicker.min.css') }}">

    <!-- <link href="{{ URL::asset('/assets/libs/datatables/datatables.min.css') }}" rel="stylesheet" type="text/css" /> -->
   
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
            <div class="row gy-2 gx-3 align-items-center" style="justify-content: right;">
                                <div class="col-sm-auto" style="margin-bottom: 10px;">
                                
                                    <!-- <label class="form-label">Multiple Select</label> -->

                                    <select id="select22" class="form-control select2-multiple" multiple="multiple"
                                        data-placeholder="Customer" onchange="return gettabledata();">
                                        @foreach($data2 as $value)
                                            <option value="{{$value->id}}">{{$value->name}}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="col-sm-auto" style="margin-bottom: 10px;">
                                    <select id="select2" class="form-control select2-multiple" multiple="multiple"
                                        data-placeholder="Worktype" onchange="return gettabledata();">
                                        @foreach($datawork as $value)
                                            <option value="{{$value->worktype}}">{{$value->worktype}}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="col-sm-auto" style="margin-bottom: 10px;">
                                    <select id="select222" class="form-control select2-multiple" multiple="multiple"
                                        data-placeholder="Mould" onchange="return gettabledata();">
                                        @foreach($dataproject as $value)
                                            <option value="{{$value->projectid}}">{{$value->projectid}}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="col-sm-auto" style="margin-bottom: 10px;">
                                    <select id="select2222" class="form-control select2-multiple" multiple="multiple"
                                        data-placeholder="Username" onchange="return gettabledata();">
                                        @foreach($datauser as $value)
                                            <option value="{{$value->id}}">{{$value->name}}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="col-sm-auto">
                                    <div class="input-group" id="datepicker3"  style="margin-bottom: 10px;">
                                        <input type="text" class="form-control" placeholder="Date" data-provide="datepicker"
                                            data-date-container='#datepicker3' data-date-format="dd/mm/yyyy"
                                            data-date-multidate="true" id="rdate" onchange="return gettabledata();" >

                                        <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                    </div>
                                </div>
                                <!-- <div class="col-sm-auto">
                                <button onclick="return gettabledata();" class="btn btn-secondary btn-lg float-end w-100" data-bs-toggle="modal" style="margin-bottom: 10px;"><i class="mdi mdi-filter-outline align-middle"></i> Filter</button>
                                </div> -->
                           </div>
                <table id="datatableworkdata" class="table table-sm m-0 table-responsive" style="width: 100%!important">
                    
                    <thead>
                        <tr>   
                            <th style="width: 7%;">Date</th>                      
                            <th style="width: 13%;">Customer Name</th>
                            <th style="width: 8%;">Mould</th>
                            <th style="width: 8%;">Sub Plate</th>
                            <th style="width: 8%;">Work Type</th>
                            <th>Part Description</th>  
                            <th>Work Description</th>  
                            <th style="width: 6%;">Username</th>             
                            {{-- <th style="width: 6%;">Design Hr</th>
                            <th style="width: 8%;">Prog Hr</th>                   
                            <th style="width: 5%;">Mach Hr</th>
                            <th style="width: 6%;">DT Hr </th>
                            <th style="width: 6%;">Qc Hr</th> --}}
                            <th style="width: 6%;">Start Date</th>
                            <th style="width: 6%;">Start Time</th>
                            <th style="width: 6%;">End Date</th>
                            <th style="width: 6%;">End Time</th> 
                            <th style="width: 7%;">Machining Hr</th>
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
    @if (Auth::user()->role==0)
    <script>
          function gettabledata(){
            var customerIds = $("#select22").val();
            var worktype = $("#select2").val(); // Assuming select22 is the ID of your multiple select dropdown
            var projectid = $("#select222").val();
            var userid = $("#select2222").val();
            var maindate = $("#rdate").val();
            // console.log(maindate);
            var url = "{{ route('getselectedwork') }}?customerids=" + customerIds.join(',')+"&worktype=" + worktype.join(',')+"&projectid=" + projectid.join(',')+"&userid=" + userid.join(',')+"&maindate="+ maindate;  
            $('#datatableworkdata').DataTable({
                    order: [[0,'desc']],
                    pageLength:25,
                    processing: true,
                    "bDestroy": true,
                    serverSide: false,
                    dom: 'Bfrtip', 
                    dataSrc: 'group',
                    buttons: [  
                                {
                                    extend: 'excel',
                                    text: 'Export Excel',
                                    exportOptions: {
                                        columns: ':visible'
                                    }
                                },
                                {
                                    extend: 'pdfHtml5', // Custom PDF button configuration
                                    // Button text
                                    orientation: 'landscape',
                                    pageSize: 'A4',
                                    download: 'open',
                                    exportOptions: {
                                        columns: ':visible'
                                    }
                                },
                                // 'print', 
                                'colvis'],
                    // ajax: "{{route('getwork')}}",
                    ajax: {
                            url: url,
                            type: 'GET',
                          }, 
                    columns: [
                        {data : {'_': 'rdate.display', 'sort': 'rdate.timestamp'}, name: 'rdate', orderable: true},
                        {data: 'customerid', name: 'customerid', orderable: true, searchable: true},
                        {data: 'projectid', name: 'projectid', orderable: true, searchable: true},
                        {data: 'subplateid', name: 'subplateid', orderable: true, searchable: true},                
                        {data: 'worktype', name: 'worktype', orderable: true, searchable: true},                
                        {data: 'description', name: 'description', orderable: true, searchable: true}, 
                        {data: 'workdescription', name: 'workdescription', orderable: true, searchable: true}, 
                        {data: 'username', name: 'username', orderable: true, searchable: true}, 
                        {data : {'_': 'sdate.display', 'sort': 'sdate.timestamp'}, name: 'sdate', orderable: true},
                        {data: 'starttime', name: 'starttime'},
                        {data : {'_': 'edate.display', 'sort': 'edate.timestamp'}, name: 'edate', orderable: true},
                        {data: 'endtime', name: 'endtime'},    
                        // {data: 'design_hr', name: 'design_hr', orderable: true, searchable: true},                     
                        // {data: 'program_hr', name: 'program_hr', orderable: true, searchable: true},               
                        // {data: 'machine_hr', name: 'machine_hr', orderable: true, searchable: true},               
                        // {data: 'driltap_hr', name: 'driltap_hr', orderable: true, searchable: true},               
                        // {data: 'qc_hr', name: 'qc_hr', orderable: true, searchable: true},    
                        {data: 'work_hr', name: 'work_hr', orderable: true, searchable: true},      
                        //   {data: 'action', name: 'action', orderable: false, searchable: false},
                    ]
                }); 
        }
        $(function () {
                $('#datatableworkdata').DataTable({
                    order: [[0,'desc']],
                    pageLength:25,
                    processing: true,
                    serverSide: false,
                    dom: 'Bfrtip', 
                    buttons: [  
                                {
                                    extend: 'excel',
                                    text: 'Export Excel',
                                    exportOptions: {
                                        columns: ':visible'
                                    }
                                },
                                {
                                    extend: 'pdfHtml5', // Custom PDF button configuration
                                    // Button text
                                    orientation: 'landscape',
                                    pageSize: 'A4',
                                    download: 'open',
                                    exportOptions: {
                                        columns: ':visible'
                                    }
                                },
                                // 'print', 
                                'colvis'],
                    ajax: "{{route('getwork')}}",
                    columns: [
                        {data : {'_': 'rdate.display', 'sort': 'rdate.timestamp'}, name: 'rdate', orderable: true},
                        {data: 'customerid', name: 'customerid', orderable: true, searchable: true},
                        {data: 'projectid', name: 'projectid', orderable: true, searchable: true},
                        {data: 'subplateid', name: 'subplateid', orderable: true, searchable: true},                
                        {data: 'worktype', name: 'worktype', orderable: true, searchable: true},                
                        {data: 'description', name: 'description', orderable: true, searchable: true}, 
                        {data: 'workdescription', name: 'workdescription', orderable: true, searchable: true}, 
                        {data: 'username', name: 'username', orderable: true, searchable: true}, 
                        {data : {'_': 'sdate.display', 'sort': 'sdate.timestamp'}, name: 'sdate', orderable: true},
                        {data: 'starttime', name: 'starttime'},
                        {data : {'_': 'edate.display', 'sort': 'edate.timestamp'}, name: 'edate', orderable: true},
                        {data: 'endtime', name: 'endtime'},    
                        // {data: 'design_hr', name: 'design_hr', orderable: true, searchable: true},                     
                        // {data: 'program_hr', name: 'program_hr', orderable: true, searchable: true},               
                        // {data: 'machine_hr', name: 'machine_hr', orderable: true, searchable: true},               
                        // {data: 'driltap_hr', name: 'driltap_hr', orderable: true, searchable: true},               
                        // {data: 'qc_hr', name: 'qc_hr', orderable: true, searchable: true},    
                        {data: 'work_hr', name: 'work_hr', orderable: true, searchable: true},      
                        //   {data: 'action', name: 'action', orderable: false, searchable: false},
                    ]
                });
                
            });
    </script>
    @else
    <script>
        $(function () {
                
                $('#datatableworkdata').DataTable({
                    processing: true,
                    serverSide: false,
                    ajax: "{{route('getwork')}}",
                    columns: [
                        {data : {'_': 'rdate.display', 'sort': 'rdate.timestamp'}, name: 'rdate', orderable: true},
                        {data: 'customerid', name: 'customerid', orderable: true, searchable: true},
                        {data: 'projectid', name: 'projectid', orderable: true, searchable: true},
                        {data: 'subplateid', name: 'subplateid', orderable: true, searchable: true},                
                        {data: 'worktype', name: 'worktype', orderable: true, searchable: true},                
                        {data: 'description', name: 'description', orderable: true, searchable: true}, 
                        {data: 'workdescription', name: 'workdescription', orderable: true, searchable: true}, 
                        
                        {data: 'username', name: 'username', orderable: true, searchable: true}, 
                        {data : {'_': 'sdate.display', 'sort': 'sdate.timestamp'}, name: 'sdate', orderable: true},
                        {data: 'starttime', name: 'starttime'},
                        {data : {'_': 'edate.display', 'sort': 'edate.timestamp'}, name: 'edate', orderable: true},
                        {data: 'endtime', name: 'endtime'},    
                        // {data: 'design_hr', name: 'design_hr', orderable: true, searchable: true},                     
                        // {data: 'program_hr', name: 'program_hr', orderable: true, searchable: true},
                        // {data: 'machine_hr', name: 'machine_hr', orderable: true, searchable: true},               
                        // {data: 'driltap_hr', name: 'driltap_hr', orderable: true, searchable: true},               
                        // {data: 'qc_hr', name: 'qc_hr', orderable: true, searchable: true},    
                        {data: 'work_hr', name: 'work_hr', orderable: true, searchable: true},    
                        //   {data: 'action', name: 'action', orderable: false, searchable: false},
                    ]
                });
                
            });
    </script>
    @endif
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
            $('#select22').select2();
        });
        $(document).ready(function() {
            $('#select2').select2();
        });
        $(document).ready(function() {
            $('#select222').select2();
        });
        $(document).ready(function() {
            $('#select2222').select2();
        });
    //         $(document).ready(function() {
    //     $(".select22").select2({
    //     dropdownParent: $("#exampleModalScrollable")
    //   });
    //   $("#select22").select2({
    //     dropdownParent: $("#exampleModalScrollable1")
    //   });
    // });
    var project="";
    function getproject(){
        $.ajax({
               type:'POST',
               url:"{{route('customer.getprojects')}}",
               data: {_token: "{{ csrf_token() }}", cid:$("#cname").val()},
               success:function(data) {
                 $("#projectid").html(data);
                 if(project!=""){
                    $("#projectid").val(project).trigger('change');
                 }
               }
            });
    }
  
    function getcustomerdata(){
       
        if($("#projectid").val().startsWith("P")){
            $("#printhr").css("display","");
            $("#reworkhr").css("display","none");
            $("#qchr").css("display","none");
            $("#insphr").css("display","none");
            $("#scanhr").css("display","none");
            $("#modelhr").css("display","none");
        }else{
            $("#printhr").css("display","none");
            $("#reworkhr").css("display","");
            $("#qchr").css("display","");
            $("#insphr").css("display","");
            $("#scanhr").css("display","");
            $("#modelhr").css("display","");
        }
        $("#work_hr").val("");
            $("#rework_hr").val("");
            $("#work_hr").val("");
            $("#qc_hr").val("");
            $("#insp_hr").val("");
            $("#scan_hr").val("");
            $("#model_hr").val("");
        $.ajax({
               type:'POST',
               url:"{{route('customer.getcustomerdata')}}",
               data: {_token: "{{ csrf_token() }}", cid:$("#cname").val(),projectid:$("#projectid").val()},
               success:function(data) {
                console.log(data);
                 $("#description").html(data.description);
                 $("#worktype").val(data.worktype);
                 $("#scan_print_id").val(data.id);
                //  $("#worktype").html(data);
                 
               }
            });
    }
             </script>   
    
    <!-- <script src="{{ URL::asset('/assets/libs/select2/select2.min.js') }}"></script>  -->
    <script src="{{ URL::asset('/assets/libs/bootstrap-datepicker/bootstrap-datepicker.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/spectrum-colorpicker/spectrum-colorpicker.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/bootstrap-timepicker/bootstrap-timepicker.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/bootstrap-touchspin/bootstrap-touchspin.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/bootstrap-maxlength/bootstrap-maxlength.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/datepicker/datepicker.min.js') }}"></script>

    <!-- form advanced init -->
    <script src="{{ URL::asset('/assets/js/pages/form-validation.init.js') }}"></script>
  
    <!-- form advanced init -->
    <!-- <script src="{{ URL::asset('/assets/libs/datatables/datatables.min.js') }}"></script> -->
    <!-- <script src="{{ URL::asset('/assets/libs/jszip/jszip.min.js') }}"></script> -->
    <!-- <script src="{{ URL::asset('/assets/libs/pdfmake/pdfmake.min.js') }}"></script> -->
    <!-- Datatable init js -->
     
    <!-- <script src="{{ URL::asset('/assets/js/pages/datatables.init.js') }}"></script> -->
    <script src="{{ URL::asset('/assets/libs/parsleyjs/parsleyjs.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/newlib/jquery-3.6.4.min.js') }}"></script>

<!-- DataTables CSS and JS -->

<script src="{{ URL::asset('/assets/newlib/jquery.dataTables.min.js') }}"></script>

<!-- Buttons Extension CSS and JS -->

<script type="text/javascript" src="{{ URL::asset('/assets/newlib/dataTables.buttons.min.js') }}"></script>
<script type="text/javascript" src="{{ URL::asset('/assets/newlib/buttons.colVis.min.js') }}"></script>
<script type="text/javascript" src="{{ URL::asset('/assets/newlib/pdfmake.min.js') }}"></script>
<script type="text/javascript" src="{{ URL::asset('/assets/newlib/vfs_fonts.js') }}"></script>
<script type="text/javascript" src="{{ URL::asset('/assets/newlib/jszip.min.js') }}"></script>
<script type="text/javascript" src="{{ URL::asset('/assets/newlib/buttons.html5.min.js') }}"></script>
<script src="{{ URL::asset('/assets/js/pages/form-advanced.init.js') }}"></script>
<script src="{{ URL::asset('/assets/newlib/select2.min.js') }}"></script>


    <!-- form advanced init -->
    <!-- Datatable init js -->

 
@endsection
