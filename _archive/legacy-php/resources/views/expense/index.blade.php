@extends('layouts.master')

@section('title') Expense @endsection

@section('css')
    <!-- DataTables -->
    <link href="//cdnjs.cloudflare.com/ajax/libs/select2/4.0.0/css/select2.min.css" rel="stylesheet" />
    
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
        @slot('li_1') Expense @endslot
        @slot('title') Expense Data @endslot
    @endcomponent


    <div class="row">
        <div class="col-lg-12">
            <div class="card">
                <div class="card-body">
                   <div class="row">
                        <div class="col">
                            {{-- {{$startDate}} --}}
                            <div class="row">
                                <div class="col-sm-auto" style="padding-right:3px; padding-left:0px;!important"> 
                                    <button onclick="return addexpense();" type="button" class="btn btn-primary" data-bs-toggle="modal" style="margin-bottom: 10px;">Add</button>   
                                </div>
                                <div class="col-sm-auto" style="padding-right:3px; padding-left:3px;!important"> 
                                   <!-- <span class="badge badge-soft-dark" id="balance" style="padding: 12px; font-size: 15px; background-color: rgb(88 167 85 / 18%) !important">
                                        Balance : <span id="formattedBalance"></span>
                                    </span> -->
                                </div>
                                <div class="col-sm-auto" style="padding-right:3px; padding-left:3px;!important"> 
                                    <span class="badge badge-soft-dark" id="maxbalance" style="padding: 12px; font-size: 15px; background-color: rgb(88 167 85 / 18%) !important">
                                       Balance : <span id="formattedmaxBalance"></span>
                                    </span>
                                </div>
                                <div class="col-sm-auto" style="padding-right:3px; padding-left:3px;!important"> 
                                    {{-- <span class="badge badge-soft-dark" id="totalcredit" style="padding: 12px;font-size: 12px;background-color:rgb(88 167 85 / 18%);!important">Total Credit : {{$totalcredit}}</span> --}}
                                    {{-- <h2 class="card-title"  style="font-size: 18px; margin: 7px 0 0 7px;!important">Total Credit: {{$totalcredit}}</h2> --}}
                                    <span class="badge badge-soft-dark" id="totalcredit" style="padding: 12px; font-size: 15px; background-color: rgb(91 85 167 / 18%) !important">
                                        Total Credit : <span id="formattedTotalCredit">{{$totalcredit}}</span>
                                    </span>
                                </div>
                                <div class="col-sm-auto" style="padding-right:3px; padding-left:3px;!important"> 
                                    {{-- <span class="badge badge-soft-dark" id="totaldebit" style="padding: 12px;font-size: 12px;background-color:rgb(189 117 187 / 18%);!important">Total Debit : {{$totaldebit}}</span> --}}
                                    {{-- <h2 class="card-title"  style="font-size: 18px; margin: 7px 0 0 7px;!important">Total Credit: {{$totalcredit}}</h2> --}}
                                    <span class="badge badge-soft-dark" id="totaldebit" style="padding: 12px; font-size: 15px; background-color: rgb(189 117 187 / 18%) !important">
                                        Total Debit : <span id="formattedTotalDebit">{{$totaldebit}}</span>
                                    </span>
                                    
                                </div>
                                {{-- <div class="col-sm-auto" style="padding-right:3px; padding-left:3px;!important">  --}}
                                    {{-- <span class="badge badge-soft-dark" id="totaldebit" style="padding: 12px;font-size: 12px;background-color:rgb(189 117 187 / 18%);!important">Total Debit : {{$totaldebit}}</span> --}}
                                    {{-- <h2 class="card-title"  style="font-size: 18px; margin: 7px 0 0 7px;!important">Total Credit: {{$totalcredit}}</h2> --}}
                                    {{-- <span class="badge badge-soft-dark" id="totaloutstanding" style="padding: 12px; font-size: 15px; background-color: rgb(189 117 187 / 18%) !important"> --}}
                                        {{-- Total Outstanding : <span id="formattedTotalOutstanding">{{$outstanding}}</span> --}}
                                    {{-- </span> --}}
                                    
                                {{-- </div> --}}
                                <div class="col-sm-auto">
                                    <div class="input-group" id="datepicker1" style="margin-bottom: 10px;">
                                        <input type="text" name="wdate" class="form-control" placeholder="Pick a date" data-date-format="dd/mm/yyyy" data-date-container='#datepicker1' data-provide="datepicker" data-date-autoclose="true" id="wdate" autocomplete="off" value={{$currentDateTime}}>
                                        <span class="input-group-text"><i class="mdi mdi-calendar" ></i></span>
                                    </div>
                                </div>
                                <div class="col-sm-auto">
                                    <div class="input-group" id="datepicker2" style="margin-bottom: 10px;">
                                        <input type="text" name="edate" class="form-control" placeholder="Pick a date" data-date-format="dd/mm/yyyy" data-date-container='#datepicker2' data-provide="datepicker" data-date-autoclose="true" id="edate" autocomplete="off" value={{$currentDateTime}}>
                                        <span class="input-group-text"><i class="mdi mdi-calendar" ></i></span>
                                    </div>
                                </div>
                                {{-- <div class="col-sm-auto" style="padding-right:3px; padding-left:3px;!important">
                                    <input class="form-control" type="month" value="{{ $startDate }}" id="startdate">
                                </div> --}}
                                <div class="col-sm-auto" style="padding-right:0px; padding-left:3px;!important">
                                    <button class="btn btn-primary" type="submit" onclick="return changeenddate();">View</button>
                                </div>
                            </div>
                        </div>
                    </div> 
                    <!-- Add Modal Start -->
                    <div class="modal fade" id="exampleModalScrollable" tabindex="-1" role="dialog" aria-labelledby="exampleModalScrollableTitle" aria-hidden="true">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content modal-lg">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="exampleModalScrollableTitle">ADD Expense Data</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                
                                <form autocomplete="off" action="{{route('expense.store')}}" method="post" class="needs-validation" novalidate>
                                    @csrf
 
                                    <!-- Equivalent to... -->
                                    <input type="hidden" name="_token" value="{{ csrf_token() }}" />
                                <div class="modal-body modal-dialog-scrollable">
                                        <div class="row">                                   
                                                <div class="mb-3">
                                                    <input  class="form-control" type="hidden" name="id" id="id" />
                                                    <label>Work Submission for Date</label>
                                                    <div class="input-group" id="datepicker">
                                                        <input type="text" name="rdate" class="form-control" placeholder="Pick a date"
                                                            data-date-format="dd/mm/yyyy" data-date-container='#datepicker'
                                                            data-provide="datepicker" data-date-autoclose="true" data-date-start-date="{{$maxdate}}"  id="rdate">
                        
                                                        <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                                    </div><!-- input-group -->
                                                </div>    
                                        </div>
                                        <div class="mb-3">
                                            <label for="validationCustom01" class="form-label">Account Name</label>
                                               <select required class="form-control select2" style="width: 100%;" name="cname" id="cname" onchange="return getproject();">
                                                    <option selected disabled value="">Select Account Name</option>
                                                    @foreach($data as $value)
                                                        <option value="{{$value->id}}">{{$value->customername}}</option>
                                                    @endforeach
                                                </select>
                                                {{-- <span id="error"></span> --}}
                                                <div class="invalid-feedback">
                                                    Please Select Account
                                                </div>
                                        </div>
                                        {{-- <div class="mb-3">
                                            <label for="validationCustom001" class="form-label">Mould Name</label>
                                               <select required class="form-control select22" style="width: 100%;" name="projectid" id="projectid" onchange="return getcustomerdata();">
                                                    
                                                <option value="">Select Mould Name</option>
                                                                                                  
                                                </select>
                                                
                                                <div class="invalid-feedback">
                                                    Please Select Mould
                                                </div>
                                        </div> --}}
                                        <div class="mb-3">
                                            <label for="validationCustom02" class="form-label">Description</label>
                                            <textarea required class="form-control" name="description" id="description"></textarea>
                                                 <div class="invalid-feedback">
                                                    Please Enter Description
                                                </div>
                                        </div>
                                        {{-- <div class="mb-3">
                                            <label class="form-label">Work Type</label>
                                            <div>
                                                <input  class="form-control" type="text" name="worktype" id="worktype" readonly/>
                                                <input  class="form-control" type="hidden" name="scan_print_id" id="scan_print_id" />
                                               
                                                  
                                                </div>
                                            
                                        </div> --}}
                                 
                                            <div class="col-5">
                                                <div class="row">
                                                    <label for="validationCustom03" class="form-label">Type</label >
                                                    <div class="col">                                                                                        
                                                            <div class="form-check mb-3">
                                                                <input class="form-check-input" type="radio" name="payment_type"  value="Credit" required>
                                                                <label class="form-check-label" for="formRadios1">
                                                                    Credit
                                                                </label>
                                                            </div>    
                                                    </div>
                                                    <div class="col">
                                                            <div class="form-check">
                                                                <input class="form-check-input" type="radio" name="payment_type" value="Debit" >
                                                                <label class="form-check-label" for="formRadios2">
                                                                    Debit
                                                                </label>
                                                            </div>  
                                                    </div>
                                                </div>  
                                            </div>
                                            <div class="col-5">
                                                <div class="row">
                                                    <label for="validationCustom03" class="form-label">Mode</label >
                                                    <div class="col">                                                                                        
                                                            <div class="form-check mb-3">
                                                                <input class="form-check-input" type="radio" name="payment_mode"  value="Cash" required>
                                                                <label class="form-check-label" for="formRadios1">
                                                                    Cash
                                                                </label>
                                                            </div>    
                                                    </div>
                                                    <div class="col">
                                                            <div class="form-check">
                                                                <input class="form-check-input" type="radio" name="payment_mode" value="Gpay" >
                                                                <label class="form-check-label" for="formRadios2">
                                                                    Gpay
                                                                </label>
                                                            </div>  
                                                    </div>
                                                    <div class="col">
                                                        <div class="form-check">
                                                            <input class="form-check-input" type="radio" name="payment_mode" value="Check" >
                                                            <label class="form-check-label" for="formRadios2">
                                                                Check
                                                            </label>
                                                        </div>  
                                                    </div>
                                                    <div class="col">
                                                        <div class="form-check">
                                                            <input class="form-check-input" type="radio" name="payment_mode" value="NEFT" >
                                                            <label class="form-check-label" for="formRadios2">
                                                                NEFT
                                                            </label>
                                                        </div>  
                                                    </div>
                                                </div>
                                            
                                            <div class="col-5">
                                                <div class="mb-3">
                                                    <label class="form-label">Amount</label>
                                                    <div>
                                                        <input required class="form-control" type="text" name="amount" id="amount" oninput="this.value = this.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');"/>
                                                        
                                                        {{-- <input data-parsley-type="number" type="text" name="amount" class="form-control" required
                                                            placeholder="Enter only numbers" /> --}}
                                                    </div>
                                                </div> 
                                            </div>
                                        </div>
                                        {{-- <div class="row"> --}}
                                            {{-- <div class="col">
                                                <div class="row">
                                                    <label for="validationCustom03" class="form-label">Amount Received By</label >
                                                    <div class="col-md-3">                                                                                        
                                                            <div class="form-check mb-3">
                                                                <input class="form-check-input" type="radio" name="amountby"  value="Accountant" required>
                                                                <label class="form-check-label" for="formRadios1">
                                                                    Accountant
                                                                </label>
                                                            </div>    
                                                    </div> --}}
                                                    {{-- <div class="col-md-3">
                                                            <div class="form-check">
                                                                <input class="form-check-input" type="radio" name="amountby" value="Yash" >
                                                                <label class="form-check-label" for="formRadios2">
                                                                    Yash
                                                                </label>
                                                            </div>  
                                                    </div> --}}
                                                    {{-- <div class="col-md-3">
                                                        <div class="form-check">
                                                            <input class="form-check-input" type="radio" name="amountby" value="Bank" >
                                                            <label class="form-check-label" for="formRadios2">
                                                                Bank
                                                            </label>
                                                        </div>  
                                                    </div> --}}
                                                {{-- </div>  
                                            </div> --}}
                                            
                                        {{-- </div>                                   --}}
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
                    

                    <table id="datatableexpense" class="table table-sm m-0 table-responsive" style="width: 100%!important">
                        <thead>
                            <tr>   
                                <th></th>
                                <th style="width: 7%;">Date</th>                      
                                <th style="width: 11%;">Account Name</th>
                                {{-- <th style="width: 4%;">Mould</th>
                                <th style="width: 8%;">Work Type</th> --}}
                                <th>Description</th> 
                                {{-- <th style="width: 5%;">Username</th>               --}}
                                <th style="width: 10%;">Payment Mode</th>
                                <th style="width: 10%;">Payment Type</th>                   
                                {{-- <th style="width: 13%;">Amount Received by</th> --}}
                                <th style="width: 5%;">Cedit</th>
                                <th style="width: 5%;">Debit</th>
                                <th style="width: 5%;">Balance</th> 
                                {{-- <th style="width: 5%;">Scan Hr</th>
                                <th style="width: 6%;">Model Hr</th> --}}
                                <th style="width: 9%;">Action<th>
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
    $('body').on('click','.editScan',function(){
    var scanid=$this.data('id');
    $.get("{{route('scanning.index')}}"+"/"+scanid+"/edit",function(data){
    $("modalHeading").html("Edit Data");
    $('#ajaxmodal').modal('show');
    $('#scanid').val(data.id);
    });
 });
    </script>
    <script>
          function AskToDelete(id){
         if (window.confirm("Do you really want to delete?")) {
             var url = "{{ route('expense.delete',':id') }}";
            url = url.replace(':id', id);
            window.location.href=url;
            // window.location.href = "{{ route('expense.index')}}";
            //  return redirect(route('expense.index'));
         }
        }
    </script>

    <script type="text/javascript">
    
    function changeenddate() {
            
                    // type: 'POST',
                    // url: "{{ route('report.getmonthwisedata') }}",
                    // data: {
                    //     _token: "{{ csrf_token() }}",
                    //     startdate: $("#startdate").val(),
                    //     enddate: $("#enddate").val()
                    // },
                    $('#datatableexpense').DataTable({
                        order:[[0, 'desc']],
                        processing: true,
                        serverSide: false,
                        "bDestroy": true,
                        pageLength:50,
                        dom: 'Bfrtip', 
                                buttons: [
                                    {
                                        extend: 'excel',
                                        exportOptions: {
                                            columns: ':not(.action, .idd)'
                                        }
                                    }, 
                                    {
                                        extend: 'pdfHtml5',
                                        orientation: 'landscape',
                                        pageSize: 'LEGAL',
                                        exportOptions: {
                                        columns: ':not(.action, .idd)'
                                        }
                                    }, 'print'],
                        ajax: {
                                // url: "{{route('getexpensedata')}}"+"?startdate="+$("#startdate").val(),
                                url: "{{route('getexpensedata')}}"+"?wdate="+$("#wdate").val()+"&edate="+$("#edate").val(),
                                type: 'GET',
                            }, 
                        columns: [
                            {data: 'id', name: 'id','visible' : false ,className: 'idd'},
                            {data: 'rdate', name: 'rdate', render: {
                                    _: 'display',
                                    sort: 'timestamp'
                            }},
                            {data: 'customerid', name: 'customerid'},
                            // {data: 'projectid', name: 'projectid'},                
                            // {data: 'worktype', name: 'worktype'},                
                            {data: 'description', name: 'description'}, 
                            //   {data: 'username', name: 'username'},           
                            {data: 'payment_type', name: 'payment_type'},                     
                            {data: 'payment_mode', name: 'payment_mode'},                     
                            // {data: 'amountby', name: 'amountby'},   
                            {data: 'credit', name: 'credit',orderable: false, searchable: false},  
                            {data: 'debit', name: 'debit',orderable: false, searchable: false},     
                            {data: 'balance', name: 'balance',orderable: false, searchable: false},      
                            //   {data: 'scan_hr', name: 'scan_hr'},               
                            //   {data: 'model_hr', name: 'model_hr'},        
                            {data: 'action', name: 'action', orderable: false, searchable: false,className: 'action'},
                        ]
          });
          $.ajax({
            type: 'GET',
            url: "{{route('getexpensecountdata')}}" + "?wdate=" + $("#wdate").val()+ "&edate=" + $("#edate").val(),
            success: function(data) {
                // console.log(data);
                $("#totalcredit").text("Total Credit : " + data.totalcredit);
                $("#totaldebit").text("Total Debit : " + data.totaldebit);
                // $("#totaloutstanding").text("Total Outstanding : " + data.outstanding);
                // $("#balance").text("Balance : " + data.balance);
                $("#maxbalance").text("Balance : " + data.maxbalance);
                
            }
        });
    
                return false;
            }

            $('#datatableexpense').DataTable({
                order:[[0, 'desc']],
              processing: true,
              serverSide: false,
              "bDestroy": true,
              pageLength:50,
              dom: 'Bfrtip', 
              buttons: [
                        {
                            extend: 'excel',
                            exportOptions: {
                            columns: ':not(.action, .idd)'
                             }
                        }, 
                        {
                            extend: 'pdfHtml5',
                            orientation: 'landscape',
                            pageSize: 'LEGAL',
                            exportOptions: {
                            columns: ':not(.action,.idd)'
                            }
                        }, 'print'],
              ajax: {
                    url: "{{route('getexpensedata')}}"+"?wdate="+$("#wdate").val()+"&edate="+$("#edate").val(),
                    type: 'GET',
                }, 
              columns: [
                {data: 'id', name: 'id','visible' : false ,className: 'idd'},
                  {data: 'rdate', name: 'rdate', render: {
                        _: 'display',
                        sort: 'timestamp'
                   }},
                  {data: 'customerid', name: 'customerid'},
                //   {data: 'projectid', name: 'projectid'},                
                //   {data: 'worktype', name: 'worktype'},                
                  {data: 'description', name: 'description'}, 
                //   {data: 'username', name: 'username'},           
                  {data: 'payment_type', name: 'payment_type'},                     
                  {data: 'payment_mode', name: 'payment_mode'},                     
                //   {data: 'amountby', name: 'amountby'},   
                  {data: 'credit', name: 'credit',orderable: false, searchable: false},  
                  {data: 'debit', name: 'debit',orderable: false, searchable: false},    
                  {data: 'balance', name: 'balance',orderable: false, searchable: false},       
                //   {data: 'scan_hr', name: 'scan_hr'},               
                //   {data: 'model_hr', name: 'model_hr'},        
                  {data: 'action', name: 'action', orderable: false, searchable: false,className: 'action'},
              ]
          });
          
    
        // $(function () {
           
        // $('#datatablework').DataTable({
        //       processing: true,
        //       serverSide: false,
        //       "bDestroy": true,
        //       ajax: "{{route('getworkdata')}}",
        //       columns: [
        //           {data: 'rdate', name: 'rdate', render: {
        //                 _: 'display',
        //                 sort: 'timestamp'
        //            }},
        //           {data: 'customerid', name: 'customerid'},
        //           {data: 'projectid', name: 'projectid'},                
        //           {data: 'worktype', name: 'worktype'},                
        //           {data: 'description', name: 'description'},  
        //           {data: 'username', name: 'username'},          
        //           {data: 'print_hr', name: 'print_hr'},                     
        //           {data: 'rework_hr', name: 'rework_hr'},                     
        //           {data: 'qc_hr', name: 'qc_hr'},               
        //           {data: 'insp_hr', name: 'insp_hr'},               
        //           {data: 'scan_hr', name: 'scan_hr'},               
        //           {data: 'model_hr', name: 'model_hr'},        
        //           {data: 'action', name: 'action', orderable: false, searchable: false},
        //       ]
        //   });
          
        // });
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
    $(".select222").select2({
        dropdownParent: $("#exampleModalScrollable")
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
    function addexpense(){
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
            // $("#rdate").val(""); 
            $("#description").html("");
            // $("#worktype").val("");
            // $("#scan_print_id").val("");
            $("#id").val("");
            $("#payment_type").val("");
            $("#payment_mode").val("");
            // $("#amountby").val("");
            $("#amount").val("");
            // $("#insp_hr").val("");
            // $("#scan_hr").val("");
            // $("#model_hr").val("");
            $('#rdate').removeAttr("disabled");
            $("#exampleModalScrollable").modal("toggle");
    }  
    function Editdata(data) {
    if (typeof data === 'string') {
        var data = JSON.parse(data.replace(/'/g, '"'));
        $("#cname").val(data.customerid).trigger('change');
        $("#cname").val(data.customerid).prop('disabled', true);
        $("#rdate").val(data.rdate).prop('disabled', true);
        $("#amount").val(data.amount).prop('disabled', true);

        var inputs = document.getElementsByName("payment_type");
        for (var i = 0; i < inputs.length; ++i) {
            if (inputs[i].value == data.payment_type) {
                inputs[i].checked = true;
                inputs[i].disabled = true;
            } 
            inputs[i].disabled = true;
        }
        var inputs = document.getElementsByName("payment_mode");
            for (var i = 0; i < inputs.length; ++i) {
                if(inputs[i].value==data.payment_mode){
                    inputs[i].checked=true;
                    inputs[i].disabled = true;
                }
                inputs[i].disabled = true;
            }
        $("#description").val(data.description.replace("<>","\""));
        $("#id").val(data.id);
        // Set values for common fields
        
    }
    $("#exampleModalScrollable").modal("toggle");
}
// Add an event listener to the form submission
$("#exampleModalScrollable").on("submit", function(event) {
    // Prevent the default form submission
    // event.preventDefault();

    // Enable all disabled fields
    $("#cname").prop('disabled', false);
    $("#rdate").prop('disabled', false);
    $("#amount").prop('disabled', false);

    var paymentTypeInputs = document.getElementsByName("payment_type");
    for (var i = 0; i < paymentTypeInputs.length; ++i) {
        paymentTypeInputs[i].disabled = false;
    }

    var paymentModeInputs = document.getElementsByName("payment_mode");
    for (var i = 0; i < paymentModeInputs.length; ++i) {
        paymentModeInputs[i].disabled = false;
    }

    // Add additional code if needed for other fields
});

    function Edit(data){
       
        if (typeof data === 'string') {
                var data = JSON.parse(data.replace(/'/g, '"'));
        // var data=JSON.parse(data.replaceAll("'","\""));
        // project=data.projectid;
       // $("#cname").select2("val", data.customerid);
            $("#cname").val(data.customerid).trigger('change');
            $("#cname").val(data.customerid).prop('disabled', false);
            $("#rdate").val(data.rdate).prop('disabled', true);
            $("#description").val(data.description.replace("<>","\""));
            // $("#worktype").val(worktype);
            // $("#scan_print_id").val(data.scan_print_id);
            $("#id").val(data.id);
            var inputs = document.getElementsByName("payment_type");
            for (var i = 0; i < inputs.length; ++i) {
                // if (inputs[i].checked) {
                    
                // }
                if(inputs[i].value==data.payment_type){
                    inputs[i].checked=true;
                    inputs[i].disabled = false;
                }
                inputs[i].disabled = false;
            }
            var inputs = document.getElementsByName("payment_mode");
            for (var i = 0; i < inputs.length; ++i) {
                // if (inputs[i].checked) {
                    
                // }
                if(inputs[i].value==data.payment_mode){
                    inputs[i].checked=true;
                    inputs[i].disabled = false;
                }
                inputs[i].disabled = false;
            }
            // $("#payment_type").val("");
            // $("#payment_mode").val("");
            // $("#amountby").val("");
            // $("#amount").val(data.amount);
            $("#amount").val(data.amount).prop('disabled', false);

        }
            $("#exampleModalScrollable").modal("toggle");
           
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
        $("#print_hr").val("");
            $("#rework_hr").val("");
            $("#print_hr").val("");
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
                $(data).each(function(key,val){
                     $("#description").html(val.description);
                     $("#worktype").val(val.worktype);
                     $("#scan_print_id").val(val.projectid);
                    //  $("#worktype").html(data);
                    //push subplate array for select2 
                   });
                 
               }
            });
    }
             </script> 
           
        <script>
            // Get the balance element by its ID
            const balancemaxElement = document.getElementById('formattedmaxBalance');
        
            // Convert the balance to a comma-separated number format with two decimal places
            const formattedmaxBalance = parseFloat('{{$maxbalance}}').toLocaleString('en-IN', { maximumFractionDigits: 2 });
        
            // Set the formatted balance as the inner text of the element
            balancemaxElement.innerText = formattedmaxBalance;
        </script>
        <script>
            // Get the totalcredit element by its ID
            const totalcreditElement = document.getElementById('formattedTotalCredit');
        
            // Convert the totalcredit to a comma-separated number format with two decimal places
            const formattedTotalCredit = parseFloat('{{$totalcredit}}').toLocaleString('en-IN', { maximumFractionDigits: 2 });
        
            // Set the formatted totalcredit as the inner text of the element
            totalcreditElement.innerText = formattedTotalCredit;
        </script> 
        <script>
            // Get the totaldebit element by its ID
            const totaldebitElement = document.getElementById('formattedTotalDebit');
        
            // Convert the totaldebit to a comma-separated number format with two decimal places
            const formattedTotalDebit = parseFloat('{{$totaldebit}}').toLocaleString('en-IN', { maximumFractionDigits: 2 });
        
            // Set the formatted totaldebit as the inner text of the element
            totaldebitElement.innerText = formattedTotalDebit;
        </script>
         
@endsection
