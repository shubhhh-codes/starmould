@extends('layouts.master')

@section('title') Print Register @endsection

@section('css')
    <!-- DataTables -->
    <link href="{{ URL::asset('/assets/libs/datatables/datatables.min.css') }}" rel="stylesheet" type="text/css" />
@endsection

@section('content')

    @component('components.breadcrumb')
        @slot('li_1') Admin @endslot
        @slot('title') Print Register Admin @endslot
    @endcomponent
    <style>
        .page-content {
            padding: 30px 12px 60px;!important
        }
        .vertical-menu { 
            top: 0px;!important
        }
        </style>
        {{-- <style type="text/css">
            table { border-collapse: collapse; } //to remove cell spacings
            table td { padding: 2px; }
            tr.accepted, tr.accepted td { background-color: green; }
            tr.rejected, tr.rejected td { background-color: red; }
            </style> --}}
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-body">
                    <table id="datatableprint" class="table table-sm m-0 table-responsive" style="width: 100%!important">
                        <thead>
                            <tr>
                                @if (Auth::user()->role==0)
                                <th style="width: 7%;">Received Dt</th>
                                <th style="width: 8%;">Committed Dt</th>
                                <th style="width: 2%;">Gram</th>
                                <th style="width: 2%;">Hr</th>
                                <th style="width: 4%;">Print By</th>
                                <th style="width: 3%;">Dispatch</th>
                                <th style="width: 4%;">QC By</th>
                                <th style="width: 20%;">Customer Name</th>
                                <th>Part Description</th>
                                <th style="width: 7%;">Print Work Hr</th>
                                <th style="width: 3%;">Uid</th>
                                <th style="width: 4%;">Payment</th>
                                <th style="width: 5%;">Amount</th>  
                                <th style="width: 3%;">Delete</th>
                                @else
                                <th style="width: 7%;">Received Dt</th>
                                <th style="width: 8%;">Committed Dt</th>
                                <th style="width: 2%;">Gram</th>
                                <th style="width: 2%;">Hr</th>
                                <th style="width: 4%;">Print By</th>
                                <th style="width: 3%;">Dispatch</th>
                                <th style="width: 4%;">QC By</th>
                                <th style="width: 20%;">Customer Name</th>
                                <th>Part Description</th>
                                @endif
                                {{-- <th style="width: 5%;">Action</th> --}}
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
    <script>
    $(document).ready( function() {
    var now = new Date();
    var month = (now.getMonth() + 1);               
    var day = now.getDate();
    if (month < 10) 
        month = "0" + month;
    if (day < 10) 
        day = "0" + day;
    var today = day  + '-' + month + '-' + now.getFullYear();
    $('#date1').val(today);
    });
    </script>
    <script>
        $(document).ready( function() {
    var now = new Date();
    var month = (now.getMonth() + 1);               
    var day = now.getDate()+2;
    if (month < 10) 
        month = "0" + month;
    if (day < 10) 
        day = "0" + day;
    var today = day  + '-' + month + '-' + now.getFullYear();
    $('#date2').val(today);
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
    @if (Auth::user()->role==0)
    <script>

         $(function () {
           
           $('#datatableprint').DataTable({
                 processing: true,
                 serverSide: false,
                 ajax: "{{route('getprintregisterdata')}}",
                 columns: [
                    {data : {'_': 'tdate.display', 'sort': 'tdate.timestamp'}, name: 'tdate', orderable: true},
                    {data : {'_': 'cdate.display', 'sort': 'cdate.timestamp'}, name: 'cdate', orderable: true},            
                        {data: 'gram', name: 'gram', orderable: true, searchable: true},
                        {data: 'hr', name: 'time', orderable: true, searchable: true},            
                       //  {data: 'print_by', name: 'print_by'},
                       {   
                            data: 'print_by', 
                            name: 'print_by',             
                            orderable: false, 
                            searchable: false
                        },
                       //  {data: 'dispatch', name: 'dispatch'},
                        {   
                            data: 'dispatch', 
                            name: 'dispatch',
                            "className": "text-center",             
                            orderable: false, 
                            searchable: false
                        },
                       //  {data: 'qc_by', name: 'qc_by'},
                       {   
                            data: 'qc_by', 
                            name: 'qc_by',             
                            orderable: false, 
                            searchable: false
                        },
                        {data: 'cname', name: 'cname', orderable: true, searchable: true},
                        {data: 'description', name: 'description', orderable: true, searchable: true},
                        {data: 'pr_printhr', name: 'pr_printhr', orderable: true, searchable: true},
                        {data: 'id', name: 'id', orderable: true, searchable: true},
                        {data: 'payment', name: 'payment',"className": "text-center", orderable: true},
                        {   
                            data: 'ramount', 
                            name: 'ramount',             
                            orderable: false, 
                            searchable: false
                        },
                        {data: 'delete', name: 'delete', orderable: false, searchable: false},  
                       //  {data: 'action', name: 'action', orderable: false, searchable: false},                                  
                    ],
                    createdRow: function( nRow, aData, iDisplayIndex ) {
                       //console.log(nRow,aData,iDisplayIndex)
                       $( nRow ).find('td:eq(11)').attr('data-order', aData.paymentt); 
                    },
                    columnDefs: [
                        { 
                            targets: [11], // cell target
                                render: function(data, type, full, meta) {
                                    
                                    if(type === "sort") {
                                        var api = new $.fn.dataTable.Api(meta.settings);
                                        var td = api.cell({row: meta.row, column: meta.col}).node(); // the td of the row
                                        data = $(td).attr('data-order');
                                    }
                                    return data;
                                }
                            },
                        ]     
             });
             
           });
        </script>
        @else
        <script>
            $(function () {
           
           $('#datatableprint').DataTable({
                 processing: true,
                 serverSide: false,
                 ajax: "{{route('getprintregisterdata')}}",
                 columns: [
                    {data : {'_': 'tdate.display', 'sort': 'tdate.timestamp'}, name: 'tdate', orderable: true},
                    {data : {'_': 'cdate.display', 'sort': 'cdate.timestamp'}, name: 'cdate', orderable: true},   
                        {data: 'gram', name: 'gram', orderable: true, searchable: true},
                        {data: 'hr', name: 'time', orderable: true, searchable: true},            
                       //  {data: 'print_by', name: 'print_by'},
                       {   
                            data: 'print_by', 
                            name: 'print_by',             
                            orderable: false, 
                            searchable: false
                        },
                       //  {data: 'dispatch', name: 'dispatch'},
                        {   
                            data: 'dispatch', 
                            name: 'dispatch',             
                            orderable: false, 
                            searchable: false
                        },
                       //  {data: 'qc_by', name: 'qc_by'},
                       {   
                            data: 'qc_by', 
                            name: 'qc_by',             
                            orderable: false, 
                            searchable: false
                        },
                        {data: 'cname', name: 'cname', orderable: true, searchable: true},
                        {data: 'description', name: 'description', orderable: true, searchable: true},
                        
                       //  {data: 'action', name: 'action', orderable: false, searchable: false},                                  
                    ]
             });
             
           });
        </script>
        @endif
    <script type="text/javascript">
    function changestatuspayment(id){
            // var scan=document.getElementById("scanby_"+id).value;  
            var checkres=0;
            if($("#payment"+id).prop('checked') == true){
                //do something
                checkres=1;
            }        
            $.ajax({
               type:'POST',
               url:"{{route('printadmin.updatestatuspayment')}}",
               data: {_token: "{{ csrf_token() }}",status:"registered",id:id,checkres:checkres},             
            });
        }
    // function changestatuspayment(id){
    //         // var scan=document.getElementById("scanby_"+id).value;          
    //         $.ajax({
    //            type:'POST',
    //            url:"{{route('printadmin.updatestatuspayment')}}",
    //            data: {_token: "{{ csrf_token() }}",status:"registered",id:id},             
    //         });
    //     }
   function changeamount(id){
            var ramount=document.getElementById("ramount_"+id).value;          
            $.ajax({
               type:'POST',
               url:"{{route('printadmin.updateamount')}}",
               data: {_token: "{{ csrf_token() }}", ramount:ramount,id:id},             
            });
        }
        function changestatus1print(field,value,id){
            // var print=document.getElementById("printby_"+id).value;         
            $.ajax({
               type:'POST',
               url:"{{route('printing.updatestatusprintby')}}",
               data: {_token: "{{ csrf_token() }}", field:field,value:value,id:id},
            });
        }
        // function changestatus1qc(id){
        //     var qc=document.getElementById("qcby_"+id).value;         
        //     $.ajax({
        //        type:'POST',
        //        url:"{{route('printing.updatestatusqcby')}}",
        //        data: {_token: "{{ csrf_token() }}", qc:qc,id:id},
        //     });
        // }
        function changestatus1(id){
            // var amt=document.getElementById("amt_").value;
           
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
               url:"{{route('printadmin.updatestatusprint')}}",
               data: {_token: "{{ csrf_token() }}", status:"pending",id:id},
               success:function(data) {
                  $("#print_"+id).remove();
               }
            });
        }
      </script> 
    
       <script src="{{ URL::asset('/assets/libs/datatables/datatables.min.js') }}"></script>
       <script src="{{ URL::asset('/assets/libs/select2/select2.min.js') }}"></script>
       <script src="{{ URL::asset('/assets/libs/bootstrap-datepicker/bootstrap-datepicker.min.js') }}"></script>
       <script src="{{ URL::asset('/assets/libs/spectrum-colorpicker/spectrum-colorpicker.min.js') }}"></script>
       <script src="{{ URL::asset('/assets/libs/bootstrap-timepicker/bootstrap-timepicker.min.js') }}"></script>
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
       {{-- <script type="text/javascript">
        function Accept(el)
        {
            
           var tr = el.parentNode.parentNode; //tr
           tr.className = "accepted";
        }
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
        var today = day  + '-' + month + '-' + now.getFullYear();
        $('#date3').val(today);
    });
        </script>
        <script>
            $(document).ready( function() {
        var now = new Date();
        var month = (now.getMonth() + 1);               
        var day = now.getDate()+2;
        if (month < 10) 
            month = "0" + month;
        if (day < 10) 
            day = "0" + day;
        var today = day  + '-' + month + '-' + now.getFullYear();
        $('#date4').val(today);
    });

         </script>
        <script>
                function printDelete(id){
                if (window.confirm("Do you really want to delete?")) {
                    var url = "{{ route('printadmin.delete',':id') }}";
                    url = url.replace(':id', id);
                    window.location.href=url;
                }
                }
        </script>
@endsection
