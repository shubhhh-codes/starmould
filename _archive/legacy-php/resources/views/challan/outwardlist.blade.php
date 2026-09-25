@extends('layouts.master')
@section('title') Challan @endsection
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
.highlighted-row {
    background-color: rgb(222, 252, 252); /* Adjust the color to your preference */
}
</style>


@endsection
@section('content')

    @component('components.breadcrumb')
        @slot('li_1') Pending Outward @endslot
        @slot('title') Pending Outward Data @endslot
    @endcomponent

    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-body">
                    <a href ="{{ route('exportpendingoutward') }}" type="button" class="btn btn-primary btn-lg waves-effect waves-light"  style="margin-bottom: 10px;">Export</a>
                     
                    <table id="datatable-buttons5" class="table table-sm m-0 table-responsive">
                        <thead>
                            <tr>
                                <th style="width: 3%;"></th>
                                <th style="width: 7%;">Challan No</th>
                                <th style="width: 7%;">Date</th>
                                <th style="width: 8%;"></th>
                                <th style="width: 10%;">Vendor</th>
                                <th style="width: 10%;"></th>
                                <th style="width: 19%;">Transporter</th>
                        
                                {{-- <th>Particulars</th>
                                <th>Description</th> --}}
                                {{-- <th>Qty</th> --}}
                            
                                {{-- <th></th> --}}
                                {{-- @if (Auth::user()->role==0)
                                <th>status</th> 
                                @endif --}}
                                <th style="width: 8%;">Created by</th>
                                <th style="width: 14%;">Action</th>                                                        
                            </tr>
                        </thead>
                        <tbody>
                                                       
                        </tbody>
                    </table>
                </div>
            </div>
        </div> <!-- end col -->
        
    </div>
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
                            <input required class="form-control" type="text"  id="vendorname" readonly/>
                            <input type="hidden" name="vendorid" id="vendorid">
                            {{-- <select class="form-control select2" style="width: 100%;" name="vendorid" id="vendorid"  required>
                                <option value="">Select Vendor Name</option>
                                @foreach($data as $value)
                                <option value="{{$value->id}}">{{$value->customername}}</option>
                                @endforeach
                            </select> --}}
                            <div class="invalid-feedback">
                                Please Select Vendor
                            </div>
                        </div>
                        {{-- <div class="mb-3">
                            <label for="validationCustom01" class="form-label">Customer Name</label>
                            <input required class="form-control" type="text"  id="customername" readonly/>
                            <input type="hidden" name="customerid" id="customerid">
                            <div class="invalid-feedback">
                                Please Select Customer
                            </div>                          
                            {{-- <select class="form-control select2" style="width: 100%;" name="customerid" id="customerid" required>
                                <option value="">Select Customer Name</option>
                                @foreach($datacus as $value)
                                <option value="{{$value->id}}">{{$value->customername}}</option>
                                @endforeach
                            </select>
                            <div class="invalid-feedback">
                                Please Select Customer
                            </div> --}}
                        {{-- </div> --}} 
                        <div class="mb-3">
                            <label for="validationCustom01" class="form-label">Transporter Name</label>
                            {{-- <input required class="form-control" type="text"  id="transportername" readonly/>
                            <input type="hidden" name="vendortid" id="vendortid"> --}}
                            <select class="form-control select222" style="width: 100%;" name="vendortid" id="vendortid" required >
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
                            
                            <select class="form-control" readonly style="width: 100%;" name="challanno" id="challanno" onchange="return getichallandata(this.value);" required>
                                <option value="">Select Challan No</option>
                                @foreach($challandata as $value)
                                
                                <option value="{{$value->id}}">{{$value->challanno}}</option>
                                @endforeach
                            </select>
                            <div class="invalid-feedback">
                                Please Select Challan No
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
        childTable += '<th>Location</th>';
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
            childTable += '<td>' + d[i].location + '</td>';
            // Add more child table cells as needed
            childTable += '</tr>';
        }
        childTable += '</tbody>';
        childTable += '</table>';

        return childTable;
    }
    
    $(document).ready(function() {         
        var table = $('#datatable-buttons5').DataTable({
              order:[[1,'desc']],
              processing: true,
              serverSide: false,
              pageLength:50,
              ajax: "{{route('getchallanlistdata')}}",
              columns: [
                {
                    
                        className: "details-control",
                        orderable: false,
                        data: null,
                        defaultContent: '<i class="fas fa-chevron-down"></i>'
                    },
            
                {data: 'challanno1', name: 'challanno1',orderable: true},
                {data : {'_': 'chdate.display', 'sort': 'chdate.timestamp'}, name: 'chdate', orderable: true},
                {data: 'projectid', name:'projectid',orderable: true,visible:false},
                {data: 'vendorid', name: 'vendorid',orderable: true},
                {data: 'customerid', name: 'customerid',orderable: true,visible:false} , 
                  {data: 'vendortid', name: 'vendortid',orderable: true}, 
                  {data: 'created_by', name: 'created_by',orderable: true},
                  {data: 'inward', name: 'inward', orderable: false, searchable: false},  
                //  {data: 'qty', name: 'qty'},
                //                               
              ],
              columnDefs: [
        {
            targets: [1], // Index of the challanno column
            render: function (data, type, row) {
                if (data.startsWith('SM/JW/')) {
                    var numericValue = data.replace('SM/JW/', '');
                    return 'SM/JW/' + numericValue;
                }
                return data;
            },
            type: 'string'
        }
    ],
    "rowCallback": function (row, data) {
        // Here, you can define the condition to highlight rows.
        
            $(row).addClass('highlighted-row');
       
    }
          }); 
        $('#datatable-buttons5 tbody').on('click', 'td.details-control', function() {
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
                url: '{{route("getchallanlistitems")}}',
                                data: {
                                    challanid:rowData.id,
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
      
var project="";
    function getproject(){
        $.ajax({
               type:'POST',
               url:"{{route('customer.getprojects')}}",
               data: {_token: "{{ csrf_token() }}", cid:$("#customerid").val()},
               success:function(data) {
                 $("#projectid").html(data);
                 if(project!=""){
                    $("#projectid").val(project).trigger('change');
                 }
               }
            });
    }
        
      </script> 
    <script>
        function getplates(){
             $('#dynamic-inputs').empty();
        }
        function updatedata(index,val){
            console.log(val)
            $("#sqty"+index).val(val.split(",")[1]);
        }
     
        function View(data,id)
        {
            var data=JSON.parse(data.replaceAll("'","\""));
            console.log(data);
            // $("#chdate").val(data.chdate).trigger('change');
            $("#challanno").val(data.id).trigger('change');
            $("#challanno").prop('disabled', true);
            // $("#challanno").prop('disabled', true);
            $("#customername").val(data.customername);
            $("#customerid").val(data.customerid);
            $("#vendorname").val(data.vendorname);
            $("#vendorid").val(data.vendorid);
            // $("#transportername").val(data.transportername);
            $("#vendortid").val(data.vendortid).trigger('change');
            $("#exampleModalScrollable1").modal("toggle");
            
        }
        $('#exampleModalScrollable1').on('submit', function() {
        $('#challanno').prop('disabled', false);
    });
      
    function getichallandata(value) {
    function format(d) {
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
        childTable += '<th>Pending Qty</th>';
        childTable += '</tr>';
        childTable += '</thead>';
        childTable += '<tbody>';
        
        // Iterate through the child data and generate rows
        for (var i = 0; i < d.length; i++) {
            childTable += '<tr>';
            childTable += '<td><input type="hidden" name="categories[' + i + ']" value="' + d[i].plateid + '">' + d[i].platename + '</td>';
            childTable += '<td><input type="hidden" name="customer[' + i + ']" value="' + d[i].customer + '" readonly>' + d[i].customername + '</td>';
            childTable += '<td><input type="hidden" name="project[' + i + ']" value="' + d[i].projectid + '" readonly>' + d[i].projectid + '</td>';
            var particularsValue = d[i].particulars.replace(/"/g, '&quot;');
            childTable += '<td><input type="hidden" name="particulars[' + i + ']" value="' + particularsValue + '">' + d[i].particulars + '</td>';
            // childTable += '<td><input type="hidden" name="qty[' + i + ']" value="' + d[i].qty + '">' + d[i].qty + '</td>';
            // childTable += '<td><input type="text" name="inward_qty[' + i + ']" ></td>';

            // childTable += '<td><input type="hidden" name="qty[' + i + ']" value="' + d[i].qty + '">' + d[i].qty + '</td>';
            // childTable += '<td><input type="text" name="inward_qty[' + i + ']" onchange="checkInwardQty(this, ' + d[i].qty + ')"></td>';
          
            childTable += '<td><input type="hidden" name="qty[' + i + ']" value="' + d[i].qty + '">' + d[i].qty + '</td>';
            childTable += '<td><input type="text" class="form-control" name="inward_qty[' + i + ']" onchange="checkInwardQty(' + i + ')" style="width: 75px;padding: 0px 0px 0px 0px;text-align:center;!important" required></td>';
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
    </script>  
@endsection
