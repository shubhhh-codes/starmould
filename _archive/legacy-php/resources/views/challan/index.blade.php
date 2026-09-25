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
select option:disabled {
    color: #888;          /* Light gray text */
    background-color: #f0f0f0;  /* Light background to emphasize disabled state */
      /* Italicized text for further emphasis */
    opacity: 0.6;         /* Slight transparency */
}
select option[value=""]:disabled {
    color: #888;                /* Light gray text */
    font-weight: bold;          /* Make it bold for more emphasis */
    background-color: #f9f9f9;  /* Lighter background for default option */
}
</style>

@endsection
@section('content')

    @component('components.breadcrumb')
        @slot('li_1') Challan @endslot
        @slot('title') Challan Data @endslot
    @endcomponent

    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-body">
                    <div class="row">
                        <div class="col-10">
                            <button type="button" class="btn btn-outline-primary waves-effect waves-light mb-3" data-bs-toggle="modal" onclick="return Add();">Add Delivery / Job Work Challan</button>
                            <a href ="{{ route('exportoutward') }}" type="button" class="btn btn-primary btn-lg waves-effect waves-light"  style="margin-bottom: 10px;">Export</a>
                     
                        </div>
                        <div class="col-2">
                            <button onclick="window.location='{{ url('/outwardlist') }}'" class="btn btn-primary btn-lg float-end" data-bs-toggle="modal" style="margin-bottom: 10px;">Pending Outward</button>
                        </div>
                    </div>
                     <!-- Add Modal Start -->
                    <div class="modal fade" id="exampleModalScrollable1" tabindex="-1" role="dialog" aria-labelledby="exampleModalScrollableTitle" aria-hidden="true">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content modal-lg">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="exampleModalScrollableTitle">Delivery / Job Work Challan</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                <form autocomplete="off" action="{{ route('challan.store') }}" id="userform" method="post" class="needs-validation" novalidate>
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
                                            <select class="form-control select2" style="width: 100%;" name="vendorid" id="vendorid" required>
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
                                            <label for="validationCustom01" class="form-label">Customer Name</label>
                                            <select class="form-control select2" style="width: 100%;" name="customerid" id="customerid"onchange="return getproject();" required>
                                                <option value="">Select Customer Name</option>
                                                @foreach($datacus as $value)
                                                <option value="{{$value->id}}">{{$value->customername}}</option>
                                                @endforeach
                                            </select>
                                            <div class="invalid-feedback">
                                                Please Select Vendor
                                            </div>
                                        </div>
                                        <div class="mb-3">
                                            <label for="validationCustom001" class="form-label">Mould Name</label>
                                               <select required class="form-control select22" style="width: 100%;" name="projectid" id="projectid" onchange="return getplates();">
                                                    
                                                <option value="">Select Mould Name</option>
                                                                                                  
                                                </select>
                                                {{-- <span id="error"></span> --}}
                                                <div class="invalid-feedback">
                                                    Please Select Mould
                                                </div>
                                        </div>
                                        <div id="dynamic-inputs">
                                            {{-- <div class="mb-3">
                                                <label class="form-label">Category</label>
                                                <select name="categories[]" class="form-control select2" id="select2" required>
                                                    @foreach($data as $value)
                                                    <option value="{{$value->id}}">{{$value->customername}}</option>
                                                    @endforeach
                                                </select>
                                            </div> --}}
                                        </div>
                                        <button type="button" class="btn btn-primary mt-3 mb-3" id="add-input">Add Plate</button>
                                   
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
                    <table id="datatable-buttons5" class="table table-sm m-0 table-responsive">
                        <thead>
                            <tr>
                                <th style="width: 3%;"></th>
                                <th></th>
                                <th style="width: 7%;">Challan No</th>
                                <th style="width: 7%;">Date</th>
                                {{-- <th style="width: 8%;">Mould</th> --}}
                                <th style="width: 19%;">Vendor name</th>
                                {{-- <th style="width: 19%;">Customer name</th> --}}
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
        function AskToDelete(id){
         if (window.confirm("Do you really want to delete?")) {
             var url = "{{ route('challan.delete',':id') }}";
             url = url.replace(':id', id);
             window.location.href=url;
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
        childTable += '<th>Description</th>';
        childTable += '<th>Particulars</th>';
        childTable += '<th>Qty</th>';
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
            childTable += '<td>' + d[i].description + '</td>';
            childTable += '<td>' + d[i].particulars + '</td>';
            childTable += '<td>' + d[i].qty + '</td>';
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
              serverSide: true,
              pageLength:100,
              ajax: "{{route('getchallandata')}}",
              columns: [
                {
                    
                        className: "details-control",
                        orderable: false,
                        data: null,
                        defaultContent: '<i class="fas fa-chevron-down"></i>'
                    },
                {data: 'id', name: 'id','visible' : false },  
                {data: 'challanno', name: 'challanno',orderable: true},
                {data : {'_': 'chdate.display', 'sort': 'chdate.timestamp'}, name: 'chdate', orderable: true},
                // {data: 'projectid', name:'projectid',orderable: true},
                {data: 'vendorid', name: 'vendorid',orderable: true}, 
                // {data: 'customerid', name: 'customerid',orderable: true}, 
                {data: 'vendortid', name: 'vendortid',orderable: true}, 
                {data: 'created_by', name: 'created_by',orderable: true}, 
                //  {data: 'qty', name: 'qty'},
                  {data: 'action', name: 'action', orderable: false, searchable: false},                              
              ],
              columnDefs: [
        {
            targets: [2], // Index of the challanno column
            render: function (data, type, row) {
                if (data.startsWith('SM/JW/')) {
                    var numericValue = data.replace('SM/JW/', '');
                    return 'SM/JW/' + numericValue;
                }
                return data;
            },
            type: 'string'
        }
        ]
            //   columnDefs: [
        // {
            // targets: [1], // Index of the challanno column
            // render: function (data, type, row) {
            //     return parseInt(data.replace('SM/JW/', ''));
            // }
            
        // }
    // ]
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
                url: '{{route("getchallanitems")}}',
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
        function Add(data,id) {
            console.log("add");
           // var data=JSON.parse(data.replaceAll("'","\""));
            //  $("exampleModalScrollableTitle").html("Edit Data");
            $('#userform').attr('action', "{{route('challan.store')}}");
            $("#customerid").val("").trigger('change');
            $("#vendorid").val("").trigger('change');
            $("#vendortid").val("").trigger('change');
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
    $(".select22").select2({
    dropdownParent: $("#exampleModalScrollable1")
  });
  $("#select22").select2({
    dropdownParent: $("#exampleModalScrollable1")
  });
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
    $(".select222").select2({
    dropdownParent: $("#exampleModalScrollable1")
  });
  $("#select2222").select2({
    dropdownParent: $("#exampleModalScrollable1")
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
        function Edit(data) {
            console.log("edit");
            var data=JSON.parse(data.replaceAll("'","\""));
            project=data.projectid;
            console.log(data);
            //  $("exampleModalScrollableTitle").html("Edit Data");
            $("#customerid").val(data.customerid).trigger('change');
            $("#vendorid").val(data.vendorid).trigger('change');
            $("#vendortid").val(data.vendortid).trigger('change');
            $("#projectid").val(data.projectid);
            $("#qty").val(data.qty);
            // $("#").val(data.chdate);
            $("#chdate").val(data.chdate);
            $("#id").val(data.id);
            $('#dynamic-inputs').empty();
            $.ajax({
                    url: '{{route("getchallanitems")}}',
                    data: {
                        challanid:data.id,projectid:data.projectid,
                        _token: "{{csrf_token()}}"
                    },
                    type: 'POST',
                    dataType: 'json',
                    success: function(data) {
                        // Handle the response data here
                        console.log(data.platenames);
                        
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
            '<input class="form-control" type="hidden" id="challan" name="challanid[]" value="'+$("#id").val()+'">'+
       '<input class="form-control" type="hidden" id="pid" name = "pids[]" value="' +plate.id+'">'+
        '<label class="form-label">Sub plate</label>' +
        '<select name="categories[]" class="form-control select222" required>' +
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
        // '</div>' +`
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
        '<input class="form-control" type="text" name="qty[]" value="' + plate.qty + '"oninput="this.value = this.value.replace(/g, \'\').replace(/(\..*)\./g, \'$1\'); " >' +
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
    $('#select222').select2();
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
    {{-- <script>
        function getplates(){
           //  $('#dynamic-inputs').empty();
        }
        var selectedPlateId;
        function updatedata(index,val){
            console.log(val)
            selectedPlateId = val.split(",")[0];
            $("#sqty"+index).val(val.split(",")[1]);
        }
        
        var idindex=1;
        $(document).ready(function() {
            // Initialize Select2 for the initial select box
            $('#select222').select2();
            $('#add-input').click(function() {
                $.ajax({
                    url:"{{route('customer.getprojectsubplatesview')}}",
                                            type:'POST',
                                            data: {_token: "{{ csrf_token() }}", projectid:$("#projectid").val()},
                    success: function(response) {
                        console.log(response.data);
                        var data = response.data; 
                        
                        
                        // var sqty = data.sqty; 

                        // Assuming the array is stored in the 'data' property of the response
                        var idd=$("#id").val();
                        var options = '';
                        // console.log(sqty);
                        var input ="",tempsqty='';
                        for (var i = 0; i < data.length; i++) {
                            var value = data[i];
                            if(tempsqty==""){
                             tempsqty=value.pqty;
                            }
                            // options += '<option value="' + value.plateid + ',' + value.pqty + '">' + value.platename + '</option>';
                             options += '<option value="' + value.plateid + ',' + value.pqty + '"';
                            if (value.plateid == selectedPlateId) {
                                options += ' selected disabled';
                            }
                            options += '>' + value.platename + '</option>';
                            // options += '<option value="' + value.plateid + ',' + value.pqty + '"';
                            // if (value.plateid == selectedPlateId) {
                            //     options += ' style="display:none;"';
                            // }
                            // options += '>' + value.platename + '</option>';
                           
                        
                        }
                            input+='<div class="row">'+
                                '<div class="col" style="padding-right: unset;!important">'+
                                '<div class="mb-3">' +
                                    '<input class="form-control" type="hidden" id="pid" name="pids[]" value="">'+
                                    '<input class="form-control" type="hidden" id="challan" name="challanid[]" value="'+idd+'">'+
                                '<label class="form-label">Sub plate</label>' +
                                '<select name="categories[]" class="form-control select222" required onchange="return updatedata(\''+idindex+'\',this.value);">' +
                                options +
                                '</select>' +
                                '</div>' +
                                '</div>' +
                                '<div class="col" style="padding-right: unset;!important">' +
                                '<div class="mb-3">' +
                                '<label for="description" class="form-label">Customer Name</label>' +
                                '<input class="form-control" type="hidden" name="customer[]" id="customer" value="' + $("#customerid").val() + '">' +
                                '<input class="form-control" type="text"  value="' + $("#customerid option:selected").text() + '" readonly>' +
                                '</div>' +
                                '</div>' +
                                '<div class="col" style="padding-right: unset;!important">' +
                                '<div class="mb-3">' +
                                '<label for="description" class="form-label">Mould</label>' +
                                '<input class="form-control" type="text" name="project[]" id="project" value="' + $("#projectid").val() + '" readonly>' +
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
                                '<div class="col" style="padding-right: unset;!important">'+
                                '<div class="mb-3">' +
                                '<label for="description" class="form-label">Particulars</label>' +
                                '<textarea required class="form-control" name="particulars[]" style="height: 20px;!important"></textarea>' +
                                '<div class="invalid-feedback">' +
                                'Please Enter Particulars' +
                                '</div>' +
                                '</div>' +
                                '</div>' +
                                '<div class="col-1" style="padding-right: unset;!important">' +
                                    '<div class="mb-3">' +
                                        '<label for="description" class="form-label">Qty</label>' +
                                        '<input class="form-control" type="text" name="qty[]" id="qty' + idindex + '" onchange="qtyChanged(\'' + idindex + '\', this.value)" required>' +
                                        '<div id="alertDiv' + idindex + '"></div>' +
                                        '<div class="invalid-feedback">' +
                                        'Please Enter Qty' +
                                        '</div>' +
                                    '</div>' +
                                '</div>'+
                                '<div class="col" style="padding-right: unset;!important">' +
                                '<div class="mb-3">' +
                                '<label for="description" class="form-label">Available Qty</label>' +
                                '<input class="form-control" type="text" id="sqty'+idindex+'" value="'+tempsqty+'" disabled>' +
                                '</div>' +
                                '</div>' +
                                '<div class="col" style="padding-right: unset;!important">'+
                                '<div class="mb-3 mt-4">' +
                                '<label class="form-label">&nbsp;</label>' +
                                '<button type="button" class="btn btn-danger waves-effect waves-light  delete-input">Delete</button>';
                                '</div>' + 
                                '</div>' +   
                                '</div>' ;     

                       $('#dynamic-inputs').append(input);

                        // Reinitialize Select2 for the new dropdown
                        $('#select222').select2();
                    },
                    error: function() {
                        alert('Failed to fetch dropdown options.');
                    }
                });
                idindex++;
            });
            // Delete button click event
            $(document).on('click', '.delete-input', function() {
                
                    $(this).closest('.row').remove();
            });
        });
    </script> --}}
    <script>
          function getplates(){
           //  $('#dynamic-inputs').empty();
        }
        var selectedPlates = [];
var idindex = 1;  // Make sure idindex is defined globally

function getSelectedPlates() {
    selectedPlates = [];
    $("select[name='categories[]']").each(function() {
        var val = $(this).val();
        if (val) {
            selectedPlates.push(val.split(",")[0]);  // Add only plateid to the list
        }
    });
}

function disableSelectedOptions() {
    $("select[name='categories[]']").each(function() {
        var currentSelect = $(this);
        currentSelect.find('option').each(function() {
            var plateId = $(this).val().split(",")[0];
            if (selectedPlates.includes(plateId) && plateId != currentSelect.val().split(",")[0]) {
                $(this).attr('disabled', 'disabled');
            } else {
                $(this).removeAttr('disabled');
            }
        });
    });
}

function updatedata(index, val) {
    console.log(val);
    selectedPlateId = val.split(",")[0];
    $("#sqty" + index).val(val.split(",")[1]);
    $("#qty" + index).val("");
    // Update the selected plates list
    getSelectedPlates();
    // Disable the selected options in other selects
    disableSelectedOptions();
}

$(document).ready(function() {
    $('#select222').select2();

    $('#add-input').click(function() {
        $.ajax({
            url: "{{route('customer.getprojectsubplatesview')}}",
            type: 'POST',
            data: { _token: "{{ csrf_token() }}", projectid: $("#projectid").val() },
            success: function(response) {
                console.log(response.data);
                var data = response.data;
                var idd = $("#id").val();
                var options = '';
                var input = '', tempsqty = '';
                
                var options = '<option value="" disabled selected>Select a plate</option>';  // Default placeholder option
                for (var i = 0; i < data.length; i++) {
                    var value = data[i];
                    if (tempsqty == "") {
                        tempsqty = value.pqty;
                    }
                    options += '<option value="' + value.plateid + ',' + value.pqty + '"';
                    if (selectedPlates.includes(value.plateid)) {
                        options += ' disabled';  // Disable already selected plates
                    }
                    options += '>' + value.platename + '</option>';
                }
                
                input += '<div class="row">' +
                    '<div class="col" style="padding-right: unset;!important">' +
                    '<div class="mb-3">' +
                    '<input class="form-control" type="hidden" id="pid" name="pids[]" value="">' +
                    '<input class="form-control" type="hidden" id="challan" name="challanid[]" value="' + idd + '">' +
                    '<label class="form-label">Sub plate</label>' +
                    '<select name="categories[]" class="form-control select222" required onchange="return updatedata(\'' + idindex + '\',this.value);">' +
                    options +
                    '</select>' +
                    '</div>' +
                    '</div>' +
                    '<div class="col" style="padding-right: unset;!important">' +
                    '<div class="mb-3">' +
                    '<label for="description" class="form-label">Customer Name</label>' +
                    '<input class="form-control" type="hidden" name="customer[]" id="customer" value="' + $("#customerid").val() + '">' +
                    '<input class="form-control" type="text" value="' + $("#customerid option:selected").text() + '" readonly>' +
                    '</div>' +
                    '</div>' +
                    '<div class="col" style="padding-right: unset;!important">' +
                    '<div class="mb-3">' +
                    '<label for="description" class="form-label">Mould</label>' +
                    '<input class="form-control" type="text" name="project[]" id="project" value="' + $("#projectid").val() + '" readonly>' +
                    '</div>' +
                    '</div>' +
                    '<div class="col" style="padding-right: unset;!important">' +
                    '<div class="mb-3">' +
                    '<label for="description" class="form-label">Particulars</label>' +
                    '<textarea required class="form-control" name="particulars[]" style="height: 20px;!important"></textarea>' +
                    '<div class="invalid-feedback">Please Enter Particulars</div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="col-1" style="padding-right: unset;!important">' +
                    '<div class="mb-3">' +
                    '<label for="description" class="form-label">Qty</label>' +
                    '<input class="form-control" type="text" name="qty[]" id="qty' + idindex + '" onchange="qtyChanged(\'' + idindex + '\', this.value)" required>' +
                    '<div id="alertDiv' + idindex + '"></div>' +
                    '<div class="invalid-feedback">Please Enter Qty</div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="col" style="padding-right: unset;!important">' +
                    '<div class="mb-3">' +
                    '<label for="description" class="form-label">Available Qty</label>' +
                    '<input class="form-control" type="text" id="sqty' + idindex + '" value="' + tempsqty + '" disabled>' +
                    '</div>' +
                    '</div>' +
                    '<div class="col" style="padding-right: unset;!important">' +
                    '<div class="mb-3 mt-4">' +
                    '<label class="form-label">&nbsp;</label>' +
                    '<button type="button" class="btn btn-danger waves-effect waves-light delete-input">Delete</button>' +
                    '</div>' +
                    '</div>' +
                    '</div>';
                
                $('#dynamic-inputs').append(input);
                $('#select222').select2();

                // Update selected plates and disable selected options
                getSelectedPlates();
                disableSelectedOptions();
            },
            error: function() {
                alert('Failed to fetch dropdown options.');
            }
        });
        idindex++;  // Increment idindex each time a new row is added
    });

    $(document).on('click', '.delete-input', function() {
        $(this).closest('.row').remove();
        // Update selected plates and re-enable the options
        getSelectedPlates();
        disableSelectedOptions();
    });
});


    </script>
<script>
    // function qtyChanged(input) {
    // Access the value entered in the Qty input field
    // var qtyValue = input.value;
    
    // Perform any desired actions with the qtyValue
    // console.log("Qty changed: " + qtyValue);
// }
// function qtyChanged(index,val) {
//     console.log(val);
//     var qtyValue = val;
//     // var index = input.dataset.index;
//     var availableQty = parseFloat($("#sqty" + index).val());

//     if (qtyValue === '') {
//         return; // Exit the function if the input is empty
//     }

//     if (parseFloat(qtyValue) > availableQty) {
//         val = availableQty; // Reset the value to the available quantity
//         alert("Quantity exceeds available quantity. Set to: " + availableQty);
//     } else {
//         console.log("Qty changed: " + qtyValue);
//     }
// }
// function qtyChanged(index, val) {
//     console.log(val);
//     var qtyValue = parseFloat(val);
//     var availableQty = parseFloat($("#sqty" + index).val());

//     if (isNaN(qtyValue)) {
//         return; // Exit the function if the input is not a valid number
//     }

//     // Remove any existing alert div
//     $('#alertDiv' + index).remove();

//     if (qtyValue > availableQty) {
//         val = availableQty; // Reset the value to the available quantity

//         var alertDiv = $('<div>', {
//             class: 'alert alert-danger',
//             role: 'alert',
//             id: 'alertDiv' + index,
//             text: 'Cannot (' + availableQty +')'
//         });

//         // Insert the new alert div below the quantity input field
//         $('#qty' + index).closest('.col').after(alertDiv);

//         // Clear the input field
//         var inputField = $('#qty' + index);
//         inputField.val(val);
//     } else {
//         console.log("Qty changed: " + qtyValue);
//     }
// }

// function qtyChanged(index, val) {
//     console.log(val);
//     var qtyValue = parseFloat(val);
//     var availableQty = parseFloat($("#sqty" + index).val());

//     if (isNaN(qtyValue)) {
//         return; // Exit the function if the input is not a valid number
//     }

//     var alertDiv = $('#alertDiv' + index);

//     if (qtyValue > availableQty) {
//         val = availableQty; // Reset the value to the available quantity

//         alertDiv.html('<div class="alert alert-danger" role="alert">Cannot add more than Available Qty (' + availableQty + ')</div>');

//         // Clear the input field
//         var inputField = $('#qty' + index);
//         inputField.val(val);
//     } else {
//         alertDiv.empty();
//         console.log("Qty changed: " + qtyValue);
//     }
// }

function qtyChanged(index, val) {
    console.log(val);
    var qtyValue = parseFloat(val);
    var availableQty = parseFloat($("#sqty" + index).val());

    if (isNaN(qtyValue)) {
        return; // Exit the function if the input is not a valid number
    }

    var alertDiv = $('#alertDiv' + index);
    var inputField = $('#qty' + index);

    if (qtyValue > availableQty) {
        val = availableQty; // Reset the value to the available quantity

        // Clear the input field
        inputField.val('');

        // Keep the focus on the input field
        inputField.focus();

        // Show the alert message
        alertDiv.html('<div class="alert alert-danger" role="alert">Quantity exceeds available quantity. Set to: ' + availableQty + '</div>');
    } else {
        // Clear the alert message
        alertDiv.empty();
        console.log("Qty changed: " + qtyValue);

        // Enable the next input field/tab stop
        inputField.next().removeAttr('disabled');
    }
}
</script>    
@endsection
