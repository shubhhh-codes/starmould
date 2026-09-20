@extends('layouts.master')
@section('title')Inward Challan @endsection
@section('css')
    <!-- DataTables -->
    <link href="//cdnjs.cloudflare.com/ajax/libs/select2/4.0.0/css/select2.min.css" rel="stylesheet" />
    <link href="{{ URL::asset('/assets/libs/select2/select2.min.css') }}" rel="stylesheet" type="text/css" />
    <link href="{{ URL::asset('/assets/libs/bootstrap-datepicker/bootstrap-datepicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/spectrum-colorpicker/spectrum-colorpicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/bootstrap-touchspin/bootstrap-touchspin.min.css') }}" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" href="{{ URL::asset('/assets/libs/datepicker/datepicker.min.css') }}">
    <link href="{{ URL::asset('/assets/libs/datatables/datatables.min.css') }}" rel="stylesheet" type="text/css" />  
    <link href="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/css/select2.min.css" rel="stylesheet" />
<style>
    .modal-dialog-scrollable {
    overflow-y: scroll;
    max-height: 80vh; /* You can adjust this value to fit your needs */
}
td.details-control {
  cursor: pointer;
}
tr.shown td.details-control i {
  -webkit-transform: rotate(180deg);
  -moz-transform: rotate(180deg);
  -ms-transform: rotate(180deg);
  -o-transform: rotate(180deg);
  transform: rotate(180deg);
}
.alert {
    padding: 0px !important;
}
.alert-danger {
     background-color:unset !important;
     border-color: unset !important;
     border: 0px !important;
     border-radius: unset !important;
     margin-bottom : 0px !important;
}
</style>

@endsection
@section('content')

    @component('components.breadcrumb')
        @slot('li_1') Inward @endslot
        @slot('title') Inward Data @endslot
    @endcomponent

    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-body">
                    {{-- <button type="button" class="btn btn-outline-primary waves-effect waves-light mb-3" data-bs-toggle="modal" onclick="return Add();">Inward Challan</button> --}}
                    <!-- Add Modal Start -->
                    <div class="modal fade" id="exampleModalScrollable1" tabindex="-1" role="dialog" aria-labelledby="exampleModalScrollableTitle" aria-hidden="true">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content modal-lg">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="exampleModalScrollableTitle">Inward Challan</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                <form autocomplete="off" action="{{ route('inward.store') }}" id="userform" method="post" class="needs-validation" novalidate>
                                    @csrf
                                    <input type="hidden" name="_token" value="{{ csrf_token() }}" />
                                    <div class="modal-body modal-dialog-scrollable">
                                        <input class="form-control" type="hidden" id="id" name="id">
                                        <div class="mb-3">
                                            <label>Today’s Date</label>
                                            <div class="input-group" id="datepicker">
                                                <input type="text" name="chdate" class="form-control" placeholder="Pick a date" data-date-format="dd/mm/yyyy" data-date-container='#datepicker' data-provide="datepicker" data-date-autoclose="true" id="chdate" value="{{ $currentDateTime }}">
                    
                                                <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                            </div>
                                        </div>
                                        <div class="mb-3">
                                            <label for="validationCustom01" class="form-label">Vendor Name</label>
                                            <select class="form-control select2" style="width: 100%;" name="vendorid" id="vendorid" onchange="return geticustomer();" required>
                                                <option value="">Select Vendor Name</option>
                                                @foreach($data as $value)
                                                <option value="{{$value->id}}">{{$value->customername}}</option>
                                                @endforeach
                                            </select>
                                            <div class="invalid-feedback">
                                                Please Select Vendor
                                            </div>
                                        </div>
                                        <div class="mb-3">
                                            <label for="validationCustom01" class="form-label">Customer Name</label>
                                            <select class="form-control select2" style="width: 100%;" name="customerid" id="customerid"onchange="return getchallanno();" required>
                                                {{-- <option value="">Select Customer Name</option> --}}
                                                {{-- @foreach($datacus as $value)
                                                <option value="{{$value->id}}">{{$value->customername}}</option>
                                                @endforeach --}}
                                            </select>
                                            <div class="invalid-feedback">
                                                Please Select Customer
                                            </div>
                                        </div>
                                        <div class="mb-3">
                                            <label for="validationCustom01" class="form-label">Transporter Name</label>
                                            <select class="form-control select222" style="width: 100%;" name="vendortid" id="vendortid" required>
                                                <option value="">Select Transporter Name</option>
                                                @foreach($datavendor as $value)
                                                <option value="{{$value->id}}">{{$value->customername}}</option>
                                                @endforeach
                                            </select>
                                            <div class="invalid-feedback">
                                                Please Select Transporter
                                            </div>
                                        </div>
                                        <div class="mb-3">
                                            <label for="validationCustom01" class="form-label">Challan No</label>
                                            <select class="form-control select222" style="width: 100%;" name="challanno" id="challanno" onchange="return getichallandata(this.value);" required>
                                                <option value="">Select Challan No</option>
                                                {{-- @foreach($challandata as $value)
                                                
                                                <option value="{{$value->id}}">{{$value->challanno}}</option>
                                                @endforeach --}}
                                            </select>
                                            <div class="invalid-feedback">
                                                Please Select Vendor
                                            </div>
                                            {{-- <input type="hidden" id="vendorid" name="vendorid"> --}}
                                            <input type="hidden" id="projectid" name="projectid">
                                            {{-- //<input type="hidden" id="chdate" name="chdate"> --}}
                                        </div>
                                        
                                        {{-- <div class="mb-3">
                                            <label>Today’s Date</label>
                                            <div class="input-group" id="datepicker">
                                                <input type="text" name="chdate" class="form-control" placeholder="Pick a date" data-date-format="dd/mm/yyyy" data-date-container='#datepicker' data-provide="datepicker" data-date-autoclose="true" id="chdate" value="{{ $currentDateTime }}">
                    
                                                <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                            </div>
                                        </div>
                                        <div class="mb-3">
                                            <label for="validationCustom01" class="form-label">Vendor Name</label>
                                            <select class="form-control select2" style="width: 100%;" name="vendorid" id="vendorid"onchange="return getproject();" required>
                                                <option value="">Select Vendor Name</option>
                                                @foreach($data as $value)
                                                <option value="{{$value->id}}">{{$value->customername}}</option>
                                                @endforeach
                                            </select>
                                            <div class="invalid-feedback">
                                                Please Select Vendor
                                            </div>
                                        </div>
                                        <div class="mb-3">
                                            <label for="validationCustom001" class="form-label">Project Name</label>
                                               <select required class="form-control select22" style="width: 100%;" name="projectid" id="projectid">
                                                    
                                                <option value="">Select Project Name</option>
                                                                                                  
                                                </select>
                                                {{-- <span id="error"></span> --}}
                                                {{-- <div class="invalid-feedback">
                                                    Please Select Project
                                                </div>
                                        </div> --}}
                                        <table id="datatable-buttons56" class="table table-sm m-0 table-responsive">
                                            <thead>
                                                <tr>
                                                    <th></th>
                                                    <th>Challan No</th>
                                                    <th>Date</th>
                                                    <th>Vendor name</th>
                                                    <th>Mould</th>
                                                    {{-- <th>Particulars</th>
                                                    <th>Description</th> --}}
                                                    {{-- <th>Qty</th> --}}
                                                
                                                    {{-- <th></th> --}}
                                                    {{-- @if (Auth::user()->role==0)
                                                    <th>status</th> 
                                                    @endif --}}
                                                    {{-- <th>Action</th>                                                         --}}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                                           
                                            </tbody>
                                        </table>
                                    {{-- <div id="dynamic-inputs"> --}}
                                            {{-- <div class="mb-3">
                                                <label class="form-label">Category</label>
                                                <select name="categories[]" class="form-control select2" id="select2" required>
                                                    @foreach($data as $value)
                                                    <option value="{{$value->id}}">{{$value->customername}}</option>
                                                    @endforeach
                                                </select>
                                            </div> --}}
                                        {{-- </div> --}}
                                        {{-- <button type="button" class="btn btn-primary mt-3 mb-3" id="add-input">Add Plate</button> --}}
                                   
                                    </div>
                                    <div class="modal-footer">
                                        <button type="button" class="btn btn-light" data-bs-dismiss="modal">Close</button>
                                        <button class="btn btn-primary" type="submit">Submit form</button>
                                    </div>
                                </form>
                            </div><!-- /.modal-content -->
                        </div><!-- /.modal-dialog -->
                    </div>
                    <!-- /.modal -->
                    <!-- Add Data Modal End-->
                    <table id="datatable-buttons55" class="table table-sm m-0 table-responsive">
                        <thead>
                            <tr>
                                <th style="width:3%;"></th>
                                <th style="width:7%;">Inward No</th>
                                <th style="width:8%;">Job Work No</th>
                                <th style="width:7%;">Date</th>
                                {{-- <th style="width: 16%;">Customer name</th> --}}
                                <th style="width: 16%;">Vendor name</th>
                                <th style="width: 16%;">Transporter</th>
                                {{-- <th style="width:8%;">Mould</th> --}}
                                {{-- <th>Particulars</th>
                                <th>Description</th> --}}
                                {{-- <th>Qty</th> --}}
                            
                                {{-- <th></th> --}}
                                {{-- @if (Auth::user()->role==0)
                                <th>status</th> 
                                @endif --}}
                                
                                <th style="width:14%;">Action</th>                                                        
                            </tr>
                        </thead>
                        <tbody>
                                                       
                        </tbody>
                    </table>
                </div>
            </div>
        </div> <!-- end col -->
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
    <script src="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js"></script>
    {{-- <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script> --}}
    <script>
        // function getichallandata() 
        // {
        //     //var vendorIdInput = document.getElementById("vendorid");
        //     function format(d) 
        //         {
        //             // Create a table HTML string for the child table
        //             var childTable = '<table class="table mb-0" style="background-color: gainsboro;">';
        //             childTable += '<thead>';
        //             childTable += '<tr class="table-primary">';
        //             childTable += '<th>Plate Name</th>';
        //             childTable += '<th>Description</th>';
        //             childTable += '<th>Particulars</th>';
        //             childTable += '<th>Qty</th>';
        //             childTable += '<th>Inward Qty</th>';
        //            // childTable += '<th>Pending Qty</th>';
        //             // Add more child table columns as needed
        //             childTable += '</tr>';
        //             childTable += '</thead>';
        //             childTable += '<tbody>';
        //             // Iterate through the child data and generate rows
        //             for (var i = 0; i < d.length; i++) {
        //                 childTable += '<tr>';
        //                 childTable += '<td><input type="hidden" name="categories['+i+']" value="' + d[i].plateid + '">' + d[i].platename + '</td>';
        //                 childTable += '<td><input type="hidden" name="cdescription['+i+']" value="' + d[i].cdescription + '">' + d[i].cdescription + '</td>';
        //                 childTable += '<td><input type="hidden" name="particulars['+i+']" value="' + d[i].particulars + '">' + d[i].particulars + '</td>';
        //                 childTable += '<td><input type="hidden" name="qty['+i+']" value="' + d[i].qty + '">' + d[i].qty + '</td>';
        //                 childTable += '<td><input type="text" name="inward_qty['+i+']" ></td>';
                    
        //                 // childTable += '<td><input type="text" name="inward_qty[' +i+ ']"></td>';
        //                 // childTable += '<td><input type="text" name="pending_qty[' +i+ ']" readonly></td>';
        //                 // Add more child table cells as needed
        //                 childTable += '</tr>';
        //             }
        //             childTable += '</tbody>';
        //             childTable += '</table>';

        //             return childTable;
        //         }
        //         $(document).ready(function() {   
                        
        //             var table = $('#datatable-buttons56').DataTable({
        //                 processing: true,
        //                 serverSide: true,
        //                "bDestroy": true,
        //                 ajax: "{{route('getiwchallandata')}}"+"?challanno="+$("#challanno").val(),
        //                 columns: [
        //                     {
                                
        //                             className: "details-control",
        //                             orderable: false,
        //                             data: null,
        //                             defaultContent: '<i class="fas fa-chevron-down"></i>'
        //                     },
        //                     {data: 'challanno', name: 'challanno'},
        //                     {data : {'_': 'chdate.display', 'sort': 'chdate.timestamp'}, name: 'chdate', orderable: true},
        //                     {data: 'vendorid', name: 'vendorid'}, 
        //                     {data: 'projectid', name:'projectid'},
        //                     //   {data: 'particulars', name: 'particulars'},               
        //                     //   {data: 'cdescription', name: 'cdescription'}, 
        //                     //  {data: 'qty', name: 'qty'},
        //                     // {data: 'action', name: 'action', orderable: false, searchable: false},                              
        //                 ]
        //             }); 
        //             $('#datatable-buttons56 tbody').on('click', 'td.details-control', function() {
        //                 var tr = $(this).closest('tr');
        //                 var row = table.row(tr);
        //                 console.log(tr);
        //                 if (row.child.isShown()) 
        //                 {
        //                     // If the child table is already shown, hide it
        //                     row.child.hide();
        //                     tr.removeClass('shown');
        //                 } 
        //                 else 
        //                 {
        //                     // If the child table is not shown, retrieve the child data and display the child table
        //                     var rowData = row.data();

        //                     // Make an AJAX call to fetch the child table data
        //                     $.ajax({
        //                     url: '{{route("getiwchallanitems")}}',
        //                                     data: {
        //                                         inchallanid:rowData.id,
        //                                         _token: "{{csrf_token()}}"
        //                                     },
        //                                     type: 'POST',
        //                                     dataType: 'json', // Pass the parent ID to the server
        //                         success: function(data) {
        //                             console.log(data.plateData)
        //                         // Display the child table inside the parent row
        //                         row.child(format(data.plateData)).show();
        //                         tr.addClass('shown');
        //                         },
        //                         error: function(xhr, status, error) {
        //                         console.error(error);
        //                         // Handle error case
        //                         }
        //                     });
        //                 }
                        
        //             }); 
        //         });
        //         $.ajax({
        //                 type:'post',
        //                 url:"{{route('getowmainchallandata')}}",
        //                 data: {_token: "{{ csrf_token() }}",challanno:$("#challanno").val()},
        //                 success:function(data) {
        //                     console.log(data);
        //                     $("#vendorid").val(data[0].vendorid);
        //                     $("#projectid").val(data[0].projectid);
        //                     // $("#chdate").val(data[0].chdate);
        //                 }
        //                 });
        // }
        function getichallandata(value) {
    function format(d) {
        // Create a table HTML string for the child table
        var childTable = '<table class="table mb-0" style="background-color: gainsboro;">';
        childTable += '<thead>';
        childTable += '<tr class="table-primary">';
        childTable += '<th>Plate Name</th>';
        //childTable += '<th>Description</th>';
        childTable += '<th>Particulars</th>';
        childTable += '<th>Qty</th>';
        childTable += '<th>Inward Qty</th>';
        childTable += '<th>Pending Qty</th>';
        childTable += '</tr>';
        childTable += '</thead>';
        childTable += '<tbody>';
        // Iterate through the child data and generate rows
        for (var i = 0; i < d.length; i++) {
            childTable += '<tr>';
            childTable += '<td><input type="hidden" name="categories[' + i + ']" value="' + d[i].plateid + '">' + d[i].platename + '</td>';
            //childTable += '<td><input type="hidden" name="cdescription[' + i + ']" value="' + d[i].cdescription + '">' + d[i].cdescription + '</td>';
            childTable += '<td><input type="hidden" name="particulars[' + i + ']" value="' + d[i].particulars + '">' + d[i].particulars + '</td>';
            // childTable += '<td><input type="hidden" name="qty[' + i + ']" value="' + d[i].qty + '">' + d[i].qty + '</td>';
            // childTable += '<td><input type="text" name="inward_qty[' + i + ']" ></td>';

            // childTable += '<td><input type="hidden" name="qty[' + i + ']" value="' + d[i].qty + '">' + d[i].qty + '</td>';
            // childTable += '<td><input type="text" name="inward_qty[' + i + ']" onchange="checkInwardQty(this, ' + d[i].qty + ')"></td>';
          
            childTable += '<td><input type="hidden" name="qty[' + i + ']" value="' + d[i].qty + '">' + d[i].qty + '</td>';
            childTable += '<td><input type="text" name="inward_qty[' + i + ']" onchange="checkInwardQty(' + i + ')" required></td>';
            childTable += '<td><input type="hidden" name="pending_qty[' + i + ']" value="' + d[i].pending_qty + '">' + d[i].pending_qty + '</td>';

            childTable += '</tr>';
        }
        childTable += '</tbody>';
        childTable += '</table>';

        return childTable;
    }

    $(document).ready(function() {
        var table = $('#datatable-buttons56').DataTable({
            order:[[1,'desc'],[2,'desc'],[3,'desc']],
            processing: true,
            serverSide: false,
            paging: false,
            searching: false,
            bInfo : false,
            destroy: true, // Use "destroy" instead of "bDestroy"
            ajax: {
                url: "{{route('getiwchallandata')}}",
                data: function (d) {
                    d.challanno = value;
                }
            },
            columns: [
                {
                    className: "details-control",
                    orderable: false,
                    data: null,
                    defaultContent: '<i class="fas fa-chevron-down"></i>'
                },
                {data: 'challanno', name: 'challanno',orderable: true},
                {data: {'_': 'chdate.display', 'sort': 'chdate.timestamp'}, name: 'chdate', orderable: true},
                // {data: 'customerid', name: 'customerid',orderable: true},
                {data: 'vendorid', name: 'vendorid',orderable: true},
                {data: 'projectid', name: 'projectid',orderable: true}
            ]
        });

        $('#datatable-buttons56 tbody').on('click', 'td.details-control', function() {
            var tr = $(this).closest('tr');
            var row = table.row(tr);
            console.log(tr);
            if (row.child.isShown()) {
                // If the child table is already shown, hide it
                row.child.hide();
                tr.removeClass('shown');
            } else {
                // If the child table is not shown, retrieve the child data and display the child table
                var rowData = row.data();

                if (rowData && rowData.id) { // Check if rowData is defined and has the id property
                    // Make an AJAX call to fetch the child table data
                    $.ajax({
                        url: '{{route("getiwchallanitems")}}',
                        data: {
                            inchallanid: rowData.id,
                            _token: "{{csrf_token()}}"
                        },
                        type: 'POST',
                        dataType: 'json',
                        success: function(data) {
                            console.log(data.viewdata);
                            // Display the child table inside the parent row
                            row.child(format(data.viewdata)).show();
                            tr.addClass('shown');
                        },
                        error: function(xhr, status, error) {
                            console.error(error);
                            // Handle error case
                        }
                    });
                }
            }
        });

    });

    $.ajax({
        type: 'post',
        url: "{{route('getowmainchallandata')}}",
        data: {
            _token: "{{ csrf_token() }}",
            challanno: value
        },
        success: function(data) {
            console.log(data);
            $("#customerid").val(data[0].customerid);
            $("#projectid").val(data[0].projectid);
            // $("#chdate").val(data[0].chdate);
        }
    });
}


        function AskToDelete(id){
        if (window.confirm("Do you really want to delete?")) {
            var url = "{{ route('inward.delete',':id') }}";
            url = url.replace(':id', id);
            window.location.href=url;
        }
        }
    </script>
        <script>
            // function checkInwardQty(inputField, availableQty) {
            //   var inwardQty = parseInt(inputField.value);
            //   if (inwardQty > availableQty) {
            //     alert("Can't add more than the available quantity!");
            //     // Optionally, you can reset the input field value
            //     inputField.value = "";
            //   }
            // }
            //             function showAlert(message) {
            // var alertDiv = document.createElement('div');
            // alertDiv.className = 'alert alert-danger';
            // alertDiv.setAttribute('role', 'alert');
            // alertDiv.textContent = message;

            // // Append the alert to the document body or any other desired element
            // document.body.appendChild(alertDiv);
            // }

            // // Example usage:
            // showAlert("Can't add more than the available quantity!");
            // function checkInwardQty(index) {
            // var qty = parseInt(document.getElementsByName('qty[' + index + ']')[0].value);
            // var inwardQty = parseInt(document.getElementsByName('inward_qty[' + index + ']')[0].value);

            // if (inwardQty > qty) {
            //     var alertDiv = document.createElement('div');
            //     alertDiv.className = 'alert alert-danger';
            //     alertDiv.setAttribute('role', 'alert');
            //     alertDiv.textContent = 'Cannot add more than ' + qty + '!';
                
            //     // Remove any existing alert
            //     var existingAlert = document.querySelector('.alert.alert-danger');
            //     if (existingAlert) {
            //     existingAlert.remove();
            //     }
                
            //     // Append the new alert to the document body
            //     document.body.appendChild(alertDiv);
            // }
            // }
            // function checkInwardQty(index) {
            // var qty = parseInt(document.getElementsByName('qty[' + index + ']')[0].value);
            // var inwardQty = parseInt(document.getElementsByName('inward_qty[' + index + ']')[0].value);

            // var alertDivId = 'alert-' + index;

            // // Remove existing alert, if any
            // var existingAlert = document.getElementById(alertDivId);
            // if (existingAlert) {
            //     existingAlert.remove();
            // }

            // if (inwardQty > qty) {
            //     var alertDiv = document.createElement('div');
            //     alertDiv.id = alertDivId;
            //     alertDiv.className = 'alert alert-danger';
            //     alertDiv.setAttribute('role', 'alert');
            //     alertDiv.textContent = 'Cannot add more than ' + qty + '!';

            //     // Append the new alert after the input field
            //     var inputField = document.getElementsByName('inward_qty[' + index + ']')[0];
            //     inputField.parentNode.insertBefore(alertDiv, inputField.nextSibling);
            // }
            // }

            function checkInwardQty(index) 
            {
            var pending_qty = parseInt(document.getElementsByName('pending_qty[' + index + ']')[0].value);
            console.log(pending_qty);
            var inwardQtyInput = document.getElementsByName('inward_qty[' + index + ']')[0];
            var inwardQty = parseInt(inwardQtyInput.value);

            var alertDivId = 'alert-' + index;

            // Remove existing alert, if any
            var existingAlert = document.getElementById(alertDivId);
            if (existingAlert) {
                existingAlert.remove();
            }
            if(inwardQty > pending_qty) {
                var alertDiv = document.createElement('div');
                alertDiv.id = alertDivId;
                alertDiv.className = 'alert alert-danger';
                alertDiv.setAttribute('role', 'alert');
                alertDiv.textContent = 'Cannot add more than Remaining Qty (' + pending_qty + ')';

                // Append the new alert after the input field
                inwardQtyInput.parentNode.insertBefore(alertDiv, inwardQtyInput.nextSibling);

                // Clear the input field
                inwardQtyInput.value = '';
                inwardQtyInput.focus();
                inwardQtyInput.setAttribute('tabindex', '-1');
            } else {
                // Enable the next input field/tab stop
                inwardQtyInput.nextElementSibling.removeAttribute('disabled');
                inwardQtyInput.removeAttribute('tabindex');
            }
            }

            </script>
    <script type="text/javascript">
    function format(d) 
    {
        // Create a table HTML string for the child table
        var childTable = '<table class="table mb-0" style="background-color: gainsboro;">';
        childTable += '<thead>';
        childTable += '<tr class="table-primary">';
        childTable += '<th>Plate Name</th>';
        childTable += '<th>Customer Name</th>';
        childTable += '<th>Mould</th>';
        childTable += '<th>Particulars</th>';
        childTable += '<th>Qty</th>';
        childTable += '<th>Inward Qty</th>';
        
        // Add more child table columns as needed
        childTable += '</tr>';
        childTable += '</thead>';
        childTable += '<tbody>';
        // Iterate through the child data and generate rows
        for (var i = 0; i < d.length; i++) {
            childTable += '<tr>';
            childTable += '<td>' + d[i].platename + '</td>';
            childTable += '<td>' + d[i].customername + '</td>';
            childTable += '<td>' + d[i].project + '</td>';
            childTable += '<td>' + d[i].particulars + '</td>';
            childTable += '<td>' + d[i].qty + '</td>';
            childTable += '<td>' + d[i].inward_qty + '</td>';
            // Add more child table cells as needed
            childTable += '</tr>';
        }
        childTable += '</tbody>';
        childTable += '</table>';

        return childTable;
    }
    $(document).ready(function() {         
        var table = $('#datatable-buttons55').DataTable({
             order:[[1,'desc'],[2,'desc'],[3,'desc']],
              processing: true,
              serverSide: false,
              pageLength:50,
              ajax: "{{route('getichallandata')}}",
              columns: [
                {
                    
                        className: "details-control",
                        orderable: false,
                        data: null,
                        defaultContent: '<i class="fas fa-chevron-down"></i>'
                    },
            
                {data: 'inchallanno', name: 'inchallanno',orderable: true},
                {data: 'challanid', name: 'challanid',orderable: true},
                {data : {'_': 'chdate.display', 'sort': 'chdate.timestamp'}, name: 'chdate', orderable: true},
                // {data: 'customerid', name: 'customerid'}, 
                  {data: 'vendorid', name: 'vendorid'}, 
                  {data: 'vendortid', name: 'vendortid'},
                //   {data: 'projectid', name:'projectid'},
                //   {data: 'particulars', name: 'particulars'},               
                //   {data: 'cdescription', name: 'cdescription'},
                 
                //  {data: 'qty', name: 'qty'},
                  {data: 'action', name: 'action', orderable: false, searchable: false},                              
              ]
          }); 
        $('#datatable-buttons55 tbody').on('click', 'td.details-control', function() {
            var tr = $(this).closest('tr');
            var row = table.row(tr);

            if (row.child.isShown()) 
            {
                // If the child table is already shown, hide it
                row.child.hide();
                tr.removeClass('shown');
            } 
            else 
            {
                // If the child table is not shown, retrieve the child data and display the child table
                var rowData = row.data();

                // Make an AJAX call to fetch the child table data
                $.ajax({
                url: '{{route("getichallanitems")}}',
                                data: {
                                    inchallanid:rowData.id,
                                    _token: "{{csrf_token()}}"
                                },
                                type: 'POST',
                                dataType: 'json', // Pass the parent ID to the server
                    success: function(data) {
                        console.log(data.plateData)
                    // Display the child table inside the parent row
                    row.child(format(data.plateData)).show();
                    tr.addClass('shown');
                    },
                    error: function(xhr, status, error) {
                    console.error(error);
                    // Handle error case
                    }
                });
            }
        });
    });
        function Add(data,id) {
            console.log("add");
            
           // var data=JSON.parse(data.replaceAll("'","\""));
            //  $("exampleModalScrollableTitle").html("Edit Data");
            $('#userform').attr('action', "{{route('inward.store')}}");
            $("#customerid").val("").trigger('change');
            $("#vendorid").val("").trigger('change');
            $("#challanno").val("").trigger('change');
            $("#challanno").prop('disabled',false);
            $("#worktype").val("");
            var now = new Date();
            var month = (now.getMonth() + 1);               
            var day = now.getDate();
            if (month < 10) 
                month = "0" + month;
            if (day < 10) 
                day = "0" + day;
            var today = day  + '/' + month + '/' + now.getFullYear();
            $('#chdate').val(today);
            // $('#chdate').val("");
            $("#id").val();
           // $("#SwitchCheckSizemd").val("");
           $('#dynamic-inputs').empty();
            $("#exampleModalScrollable1").modal("toggle");
            return false;
        }

        $(document).ready(function() {
    $(".select2").select2({
    dropdownParent: $("#exampleModalScrollable1")
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
$(document).ready(function() {
    $(".select222").select2({
    dropdownParent: $("#exampleModalScrollable1")
  });
  $("#select222").select2({
    dropdownParent: $("#exampleModalScrollable1")
  });
});
$(document).ready(function() {
    $(".select22").select2({
    dropdownParent: $("#exampleModalScrollable1")
  });
  $("#select22").select2({
    dropdownParent: $("#exampleModalScrollable1")
  });
});
var project="";
    function getchallanno(){
        
        $.ajax({
               type:'POST',
               url:"{{route('customer.getchallanno')}}",
               data: {_token: "{{ csrf_token() }}", cid:$("#customerid").val(),vid:$("#vendorid").val()},
               success:function(data) {
                 $("#challanno").html(data);
                 if(project!=""){
                    
                    $("#challanno").val(project).trigger('change');
                 }
               }
            });
    }
    var project1="";
    function geticustomer(){
        $("#challanno").val("").trigger('change');
        $.ajax({
               type:'POST',
               url:"{{route('customer.geticustomer')}}",
               data: {_token: "{{ csrf_token() }}", vid:$("#vendorid").val()},
               success:function(data) {
                 $("#customerid").html(data);
                 if(project1!=""){
                    $("#customerid").val(project1).trigger('change');
                 }
               }
            });
    }
        function Edit(data) {
            console.log("edit");
            var data=JSON.parse(data.replaceAll("'","\""));
            project=data.challanid;
            console.log(data);
            //  $("exampleModalScrollableTitle").html("Edit Data");
            // $("#challanno").val(data.challanid).trigger('change');
            $("#challanno").val(data.challanid).trigger('change');
            $("#challanno").prop('disabled', true);
            project1=data.customerid;
            $("#customerid").val(data.customerid);
            $("#vendorid").val(data.vendorid).trigger('change');
            $("#vendortid").val(data.vendortid).trigger('change');
            $("#projectid").val(data.projectid);
            $("#qty").val(data.qty);
            // $("#").val(data.chdate);
            $("#chdate").val(data.chdate);
            $("#id").val(data.id);
            $('#dynamic-inputs').empty();
            $.ajax({
                    url: '{{route("getichallanitems")}}',
                    data: {
                        inchallanid:data.id,projectid:data.projectid,
                        _token: "{{csrf_token()}}"
                    },
                    type: 'POST',
                    dataType: 'json',
                    success: function(data) {
                        // Handle the response data here
                        console.log(data.platenames);
                        // console.log(data.viewdata);
                        
                        $.each(data.plateData, function(index, plate) {
                            var options = '';
                            $.each(data.platenames, function(i, value) {
                if (value.id != plate.plateid) { // Exclude the selected value
                    options += '<option value="' + value.id + '">' + value.platename + '</option>';
                }
            });

        var input = '<div class="row">' +
        '<div class="col">' +
        '<div class="mb-3">' +
            '<input class="form-control" type="hidden" id="challan" name="inchallanid[]" value="'+$("#id").val()+'">'+
       '<input class="form-control" type="hidden" id="pid" name = "pids[]" value="' +plate.id+'">'+
        '<label class="form-label">Sub plate</label>' +
        '<select name="categories[]" class="form-control select2" required>' +
        '<option value="' + plate.plateid + '">' + plate.platename + '</option>' +
        options +
        '</select>' +
        '</div>' +
        '</div>' +
        // '<div class="col">' +
        // '<div class="mb-3">' +
        // '<label for="description" class="form-label">Description</label>' +
        // '<textarea required class="form-control" name="cdescription[]" style="height: 20px;!important">' + plate.cdescription + '</textarea>' +
        // '<div class="invalid-feedback">' +
        // 'Please Enter Description' +
        // '</div>' +
        // '</div>' +
        // '</div>' +
        '<div class="col">' +
        '<div class="mb-3">' +
        '<label for="description" class="form-label">Particulars</label>' +
        '<textarea required class="form-control" name="particulars[]" style="height: 20px;!important">' + plate.particulars + '</textarea>' +
        '<div class="invalid-feedback">' +
        'Please Enter Particulars' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="col">' +
        '<div class="mb-3">' +
        '<label for="description" class="form-label">Qty</label>' +
        '<input class="form-control" type="text" name="qty[]" value="' + plate.qty + '"oninput="this.value = this.value.replace(/g, \'\').replace(/(\..*)\./g, \'$1\');">' +
        '</div>' +
        '</div>' +
        '<div class="col">' +
        '<div class="mb-3">' +
        '<label for="description" class="form-label">Qty</label>' +
        '<input class="form-control" type="text" name="inward_qty[]" value="' + plate.inward_qty + '"oninput="this.value = this.value.replace(/g, \'\').replace(/(\..*)\./g, \'$1\');">' +
        '</div>' +
        '</div>' +
        '<div class="col">' +
        '<div class="mb-3 mt-4">' +
        '<label class="form-label">&nbsp;</label>' +
        '<button type="button" class="btn btn-danger waves-effect waves-light delete-input">Delete</button>' +
        '</div>' +
        '</div>' +
        '</div>';

    $('#dynamic-inputs').append(input);

    // Reinitialize Select2 for the new dropdown
    $('#select2').select2();
});

                    },
                    error: function(xhr, status, error) {
                        // Handle any errors that occur during the request
                        console.log('Error: ' + error);
                    }
                });
              
            $("#exampleModalScrollable1").modal("toggle");
        }
      </script> 
    <script>
        $(document).ready(function() {
            // Initialize Select2 for the initial select box
            $('#select2').select2();

           
            $('#add-input').click(function() {
    $.ajax({
        url:"{{route('customer.getprojectsubplates')}}",
                                type:'POST',
                                data: {_token: "{{ csrf_token() }}", projectid:$("#projectid").val()},
        success: function(response) {
            var data = response.data; // Assuming the array is stored in the 'data' property of the response
            var idd=$("#id").val();
            var options = '';
            for (var i = 0; i < data.length; i++) {
                var value = data[i];
                options += '<option value="' + value.id + '">' + value.platename + '</option>';
            }

            var input = '<div class="row">'+
                    '<div class="col">'+
                    '<div class="mb-3">' +
                        '<input class="form-control" type="hidden" id="pid" name="pids[]" value="">'+
                        '<input class="form-control" type="hidden" id="challan" name="inchallanid[]" value="'+idd+'">'+
                    '<label class="form-label">Sub plate</label>' +
                    '<select name="categories[]" class="form-control select2" required>' +
                    options +
                    '</select>' +
                    '</div>' +
                    '</div>' +
                    // '<div class="col">'+
                    // '<div class="mb-3">' +
                    // '<label for="description" class="form-label">Description</label>' +
                    // '<textarea required class="form-control" name="cdescription[]" style="height: 20px;!important"></textarea>' +
                    // '<div class="invalid-feedback">' +
                    // 'Please Enter Description' +
                    // '</div>' +
                    // '</div>' +
                    // '</div>' +
                    '<div class="col">'+
                    '<div class="mb-3">' +
                    '<label for="description" class="form-label">Particulars</label>' +
                    '<textarea required class="form-control" name="particulars[]" style="height: 20px;!important"></textarea>' +
                    '<div class="invalid-feedback">' +
                    'Please Enter Particulars' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="col">'+
                    '<div class="mb-3">' +
                    '<label for="description" class="form-label">Qty</label>' +
                    '<input class="form-control" type="text"  name="qty[]" oninput="this.value = this.value.replace(/g, \'\').replace(/(\..*)\./g, \'$1\');">' +
                    '</div>' +
                    '</div>'+
                    '<div class="col">'+
                    '<div class="mb-3">' +
                    '<label for="description" class="form-label">Inward Qty</label>' +
                    '<input class="form-control" type="text"  name="inward_qty[]" oninput="this.value = this.value.replace(/g, \'\').replace(/(\..*)\./g, \'$1\');">' +
                    '</div>' +
                    '</div>'+
                    '<div class="col">'+
                    '<div class="mb-3 mt-4">' +
                    '<label class="form-label">&nbsp;</label>' +
                    '<button type="button" class="btn btn-danger waves-effect waves-light  delete-input">Delete</button>';
                    '</div>' + 
                    '</div>' +   
                    '</div>' +
                    
                    

            $('#dynamic-inputs').append(input);

            // Reinitialize Select2 for the new dropdown
            $('#select2').select2();
        },
        error: function() {
            alert('Failed to fetch dropdown options.');
        }
    });
});


            // Delete button click event
            $(document).on('click', '.delete-input', function() {
                    $(this).closest('.row').remove();
            });
        });
    </script>

    
    
    
    
    
    
@endsection
