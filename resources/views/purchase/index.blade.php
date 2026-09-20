@extends('layouts.master')

@section('title') Purchase @endsection

@section('css')
    <!-- DataTables -->
    <link href="//cdnjs.cloudflare.com/ajax/libs/select2/4.0.0/css/select2.min.css" rel="stylesheet" />
    
    <link href="{{ URL::asset('/assets/libs/bootstrap-timepicker/bootstrap-timepicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/bootstrap-datepicker/bootstrap-datepicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/spectrum-colorpicker/spectrum-colorpicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/bootstrap-touchspin/bootstrap-touchspin.min.css') }}" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" href="{{ URL::asset('/assets/libs/datepicker/datepicker.min.css') }}">
    <link href="https://cdn.datatables.net/buttons/1.5.1/css/buttons.dataTables.min.css" rel="stylesheet" type="text/css" />
    
    {{-- <link href="https://nightly.datatables.net/css/jquery.dataTables.css" rel="stylesheet" type="text/css" /> --}}
   
   
    <link href="{{ URL::asset('/assets/libs/datatables/datatables.min.css') }}" rel="stylesheet" type="text/css" />
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
        @slot('li_1') Purchase @endslot
        @slot('title') Purchase Data @endslot
    @endcomponent


    <div class="row">
        <div class="col-lg-12">
            <div class="card">
                <div class="card-body">
                    <div class="row">
                        <div class="col-8">
                            <button onclick="return addwork();" type="button" class="btn btn-primary btn-lg waves-effect waves-light" data-bs-toggle="modal" style="margin-bottom: 10px;">Add Purchase</button>
                            <a href ="{{ route('export') }}" type="button" class="btn btn-primary btn-lg waves-effect waves-light"  style="margin-bottom: 10px;">Export</a>
                    
                        </div>
                        <div class="col-4">
                            <button onclick="window.location='{{ url('/purchaselist') }}'" class="btn btn-primary btn-lg float-end" data-bs-toggle="modal" style="margin-bottom: 10px; margin-left:5px;">Pending Receive</button>

                            <button onclick="window.location='{{ url('/pendingpurchaselist') }}'" class="btn btn-primary btn-lg float-end" data-bs-toggle="modal" style="margin-bottom: 10px;">Pending Purchase</button>
                        </div>
                    </div>
                    <!-- Add Modal Start -->
                    <div class="modal fade" id="exampleModalScrollable" tabindex="-1" role="dialog" aria-labelledby="exampleModalScrollableTitle" aria-hidden="true">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content modal-lg modal-dialog-scrollable">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="exampleModalScrollableTitle">PURCHASE</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                
                                <form autocomplete="off" action="{{route('purchase.store')}}" method="post" class="needs-validation" novalidate>
                                    @csrf
 
                                    <!-- Equivalent to... -->
                                    <input type="hidden" name="_token" value="{{ csrf_token() }}" />
                                <div class="modal-body">
                                        <div class="row">        
                                            <input class="form-control" type="hidden" id="id" name="id">                           
                                                <div class="mb-3">
                                                    <label>Order Date</label>
                                                    <div class="input-group" id="datepicker2">
                                                        <input type="text" name="odate" class="form-control" placeholder="Pick a date"
                                                            data-date-format="dd/mm/yyyy" data-date-container='#datepicker2'
                                                            data-provide="datepicker" data-date-autoclose="true" id="odate">
                        
                                                        <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                                    </div><!-- input-group -->
                                                </div>    
                                        </div>
                                        <div class="mb-3">
                                            <label for="validationCustom01" class="form-label">Supplier Name</label>
                                               <select required class="form-control select2" style="width: 100%;" name="vname" id="vname">
                                                    <option selected disabled value="">Select Supplier Name</option>
                                                    @foreach($vendordata as $value)
                                                        <option value="{{$value->id}}">{{$value->customername}}</option>
                                                    @endforeach
                                                </select>
                                                {{-- <span id="error"></span> --}}
                                                <div class="invalid-feedback">
                                                    Please Select Supplier
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
                    </div><!-- /.modal -->
                    <!-- Add Data Modal End-->
                    

                    <table id="datatablework" class="table table-sm m-0 table-responsive" style="width: 100%!important">
                        <thead>
                            <tr> 
                                <th style="width: 4%;"></th>
                                <th></th>
                                <th style="width: 9%;">Po. No.</th>  
                                <!-- <th style="width: 9%;">Po. No.</th> -->
                                <th style="width: 9%;">Order Date</th>      
                                <th style="width: 20%;">Supplier Name</th>              
                                <th style="width: 20%;">Customer Name</th>
                                <th style="width: 14%;">Mould</th>
                                <th style="width: 8%;">Created by</th>
                                <th style="width: 14%;">Action<th>  
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
    <script src="https://code.jquery.com/jquery-1.11.3.min.js"></script>
     {{-- <script src="https://nightly.datatables.net/js/jquery.dataTables.js"></script> --}}
    <script src="https://cdn.datatables.net/buttons/1.2.2/js/buttons.html5.js"></script>
    
    <script src="https://cdn.datatables.net/buttons/1.5.1/js/dataTables.buttons.min.js"></script>
    <script src="https://cdn.datatables.net/buttons/1.5.1/js/buttons.colVis.min.js"></script>
    <script type="text/javascript" language="javascript" src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.3/jszip.min.js"></script>
   

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
    $(document).ready( function() {
    var now = new Date();
    var month = (now.getMonth() + 1);               
    var day = now.getDate();
    if (month < 10) 
        month = "0" + month;
    if (day < 10) 
        day = "0" + day;
    var today = day  + '/' + month + '/' + now.getFullYear();
    $('#odate').val(today);
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
    function format(d) 
    {
        // Create a table HTML string for the child table
        var childTable = '<table class="table mb-0" style="background-color: gainsboro;">';
        childTable += '<thead>';
        childTable += '<tr class="table-primary">';
        childTable += '<th>Plate Name</th>';
        // childTable += '<th>Description</th>';
        childTable += '<th>Material</th>';
        childTable += '<th>Material Type</th>';
        childTable += '<th>Qty</th>';
        // Add more child table columns as needed
        childTable += '</tr>';
        childTable += '</thead>';
        childTable += '<tbody>';
        // Iterate through the child data and generate rows
        if (d && d.length > 0) {
        // Iterate through the child data and generate rows
        for (var i = 0; i < d.length; i++) {
            childTable += '<tr>';
            childTable += '<td>' + d[i].platename + '</td>';
            childTable += '<td>' + d[i].material + '</td>';
            childTable += '<td>' + d[i].materialtype + '</td>';
            childTable += '<td>' + d[i].qty + '</td>';
            childTable += '</tr>';
        }
    } else {
        // If the child data is undefined or empty, display a message or handle it accordingly
        childTable += '<tr><td colspan="4">No data available</td></tr>';
    }
        childTable += '</tbody>';
        childTable += '</table>';

        return childTable;
    }
    $(document).ready(function() { 
    var table = $('#datatablework').DataTable({
        order: [[1,'desc']],
        processing: true,
        serverSide: true,
        "bDestroy": true,
        pageLength: 100,
        // dom: 'Bfrtip',
        // buttons: [
        //     {
        //         extend: 'excelHtml5',
        //         customize: function(xlsx) {
        //             var table = $('#datatablework').DataTable();
        //             var numColumns = table.columns().header().count();
        //             var sheet = xlsx.xl.worksheets['sheet1.xml'];
        //             // Loop through each row
        //             var col = $('col', sheet);
        //             $(col[1]).attr('width', 20);

        //             // Get a clone of the sheet data.        
        //             var sheetData = $('sheetData', sheet).clone();
        //             $('sheetData', sheet).empty();
        //             var rowCount = 1;
        //             $(sheetData).children().each(function(index) {
        //                 var rowIndex = index - 1;
        //                 if (index > 0) {
            
        //                     // Get row
        //                     var row = $(this.outerHTML);
                        
        //                     // Set the Excel row attr to the current Excel row count.
        //                     row.attr('r', rowCount);
                            
        //                     var colCount = 1;
                            
        //                     // Iterate each cell in the row to change the rwo number.
        //                     row.children().each(function(index) {
        //                     var cell = $(this);
                            
        //                     // Set each cell's row value.
        //                     var rc = cell.attr('r');
        //                     rc = rc.replace(/\d+$/, "") + rowCount;
        //                     cell.attr('r', rc);         
                            
        //                     if (colCount === numColumns) {
        //                         cell.html('');
        //                     }
                            
        //                     colCount++;
        //                 });
        //                 row = row[0].outerHTML;
        //                 $('sheetData', sheet).append(row);
        //                 rowCount++;
                        
        //                 // Get the child data - could be any data attached to the row.
        //                 // var childData = table.row(':eq(' + rowIndex + ')').data().results;
        //                 var childData = table.row(':eq(' + rowIndex + ')').data();
        //                 // if (childData.length > 0) {
                               
        //                 if (childData) {
        //                 // Prepare Excel formated row
        //                 headerRow = '<row r="' + rowCount + 
        //                             '" s="2"><c t="inlineStr" r="A' + rowCount + 
        //                             '"><is><t>' + 
        //                             '</t></is></c><c t="inlineStr" r="B' + rowCount + 
        //                             '" s="2"><is><t>Plate Name' + 
        //                             '</t></is></c><c t="inlineStr" r="C' + rowCount + 
        //                             '" s="2"><is><t>Material' + 
        //                             '</t></is></c><c t="inlineStr" r="D' + rowCount + 
        //                             '" s="2"><is><t>Material Type' + 
        //                             '</t></is></c><c t="inlineStr" r="E' + rowCount + 
        //                             '" s="2"><is><t>Qty' + 
        //                             '</t></is></c></row>';
                        
        //                 // Append header row to sheetData.
        //                 $('sheetData', sheet).append(headerRow);
        //                 rowCount++; // Inc excelt row counter.
                        
        //                 }
                        
        //                 // The child data is an array of rows
        //                 // for (c =0; c<childData.length; c++) {
        //                     for (c =0; c<childData; c++) {
        //                 // Get row data.
        //                 child = childData[c];
                        
        //                 // Prepare Excel formated row
        //                 childRow = '<row r="' + rowCount + 
        //                             '"><c t="inlineStr" r="A' + rowCount + 
        //                             '"><is><t>' + 
        //                             '</t></is></c><c t="inlineStr" r="B' + rowCount + 
        //                             '"><is><t>' + (child.platename || '') + 
        //                             '</t></is></c><c t="inlineStr" r="C' + rowCount + 
        //                             '"><is><t>' + (child.material || '') + 
        //                             '</t></is></c><c t="inlineStr" r="D' + rowCount + 
        //                             '"><is><t>' + (child.materialtype || '') +
        //                             '</t></is></c><c t="inlineStr" r="E' + rowCount + 
        //                             '"><is><t>' + (child.qty || '') +
        //                             '</t></is></c></row>';
                        
        //                 // Append row to sheetData.
        //                 $('sheetData', sheet).append(childRow);
        //                 rowCount++; // Inc excelt row counter.
                            
        //                 }
        //             // Just append the header row and increment the excel row counter.
        //             } else {
        //                 var row = $(this.outerHTML);
                        
        //                 var colCount = 1;
                        
        //                 // Remove the last header cell.
        //                 row.children().each(function(index) {
        //                 var cell = $(this);
                        
        //                 if (colCount === numColumns) {
        //                     cell.html('');
        //                 }
                        
        //                 colCount++;
        //                 });
        //                 row = row[0].outerHTML;
        //                 $('sheetData', sheet).append(row);
        //                 rowCount++;
        //             }
        //             });
        //         }
        //     }
        // ],
        ajax: "{{route('getpurchasedata')}}",
        columns: [
            {
                className: "details-control",
                orderable: false,
                data: null,
                defaultContent: '<i class="fas fa-chevron-down"></i>'
            },
            {data: 'id', name: 'id','visible': false },
            {data: 'srno', name: 'srno'},
            {data: 'odate', name: 'odate', render: {
                _: 'display',
                sort: 'timestamp'
            }},
            {data: 'vname', name: 'vname'},
            {data: 'cname', name: 'cname'},
            {data: 'projectid', name: 'projectid'},      
            {data: 'created_by', name: 'created_by',orderable: true},           
            {data: 'action', name: 'action', orderable: false, searchable: false},
        ]
    });

    $('#datatablework tbody').on('click', 'td.details-control', function() {
        var tr = $(this).closest('tr');
        var row = table.row(tr);

        if (row.child.isShown()) {
            // If the child table is already shown, hide it
            row.child.hide();
            tr.removeClass('shown');
        } else {
            // If the child table is not shown, retrieve the child data and display the child table
            var rowData = row.data();

            // Make an AJAX call to fetch the child table data
            $.ajax({
                url: '{{route("getpurchaseitems")}}',
                data: {
                    pid: rowData.id,
                    _token: "{{csrf_token()}}"
                },
                type: 'POST',
                dataType: 'json', // Pass the parent ID to the server
                success: function(data) {
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

        // $(document).ready(function() { 
        //     var table = $('#datatablework').DataTable({
        //       order:[[1,'desc']],
        //       processing: true,
        //       serverSide: false,
        //       "bDestroy": true,
        //       pageLength:50,
        //       dom: 'Bfrtip',
        //       dom: 'Bfrtip', // Include buttons in the DataTables
        //         buttons: [
        //             {
        //                 extend: 'excelHtml5',
        //                 text: 'Export to Excel',
        //                 action: function(e, dt, button, config) {
        //                     // Export parent and child tables
        //                     $.fn.dataTable.ext.buttons.excelHtml5.action.call(this, e, dt, button, config);
        //                     // Remove the child table rows before export
        //                     $('.child-row').remove();
        //                 }
        //             }
        //         ],
        //       ajax: "{{route('getpurchasedata')}}",
        //       columns: [
        //           {
        //                 className: "details-control",
        //                 orderable: false,
        //                 data: null,
        //                 defaultContent: '<i class="fas fa-chevron-down"></i>'
        //           },
        //           {data: 'id', name: 'id','visible' : false },
        //           {data: 'srno', name: 'srno'},
        //         //   {data: 'pno', name: 'pno'},
        //           {data: 'odate', name: 'odate', render: {
        //                 _: 'display',
        //                 sort: 'timestamp'
        //            }},
        //           {data: 'vname', name: 'vname'},
        //           {data: 'cname', name: 'cname'},
        //           {data: 'projectid', name: 'projectid'},      
        //           {data: 'created_by', name: 'created_by',orderable: true},           
        //           {data: 'action', name: 'action', orderable: false, searchable: false},
        //       ]
        //   });
        //   $('#datatablework tbody').on('click', 'td.details-control', function() {
        //     var tr = $(this).closest('tr');
        //     var row = table.row(tr);

        //     if (row.child.isShown()) 
        //     {
        //         // If the child table is already shown, hide it
        //         row.child.hide();
        //         tr.removeClass('shown');
        //     } 
        //     else 
        //     {
        //         // If the child table is not shown, retrieve the child data and display the child table
        //         var rowData = row.data();

        //         // Make an AJAX call to fetch the child table data
        //         $.ajax({
        //         url: '{{route("getpurchaseitems")}}',
        //                         data: {
        //                             pid:rowData.id,
        //                             _token: "{{csrf_token()}}"
        //                         },
        //                         type: 'POST',
        //                         dataType: 'json', // Pass the parent ID to the server
        //             success: function(data) {
                        
        //                 console.log(data.plateData)
        //             // Display the child table inside the parent row
        //             row.child(format(data.plateData)).show();
        //             tr.addClass('shown');
        //             },
        //             error: function(xhr, status, error) {
        //             console.error(error);
        //             // Handle error case
        //             }
        //         });
        //     }
        // });
        // });
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
        $("#vname").val("").trigger('change');
        $("#cname").val("").trigger('change');
            var now = new Date();
            var month = (now.getMonth() + 1);               
            var day = now.getDate();
            if (month < 10) 
                month = "0" + month;
            if (day < 10) 
                day = "0" + day;
            var today = day  + '/' + month + '/' + now.getFullYear();
            $('#odate').val(today);
            // $("#rdate").val(""); 
            $("#description").html("");
            $("#workdescription").html("");
            $("#worktype").val("");
            $("#materialtype").val("");
            $("#rmaterial").val("");
            $("#qty").val("");
            $("#id").val("");
            $('#odate').removeAttr("disabled");
            $('#dynamic-inputs').empty();
            $("#exampleModalScrollable").modal("toggle");
    }
    function Edit(data,worktype,description){
        if (typeof description === 'string') {
                var data = JSON.parse(data.replace(/'/g, '"'));
        // var data=JSON.parse(data.replaceAll("'","\""));
        project=data.projectid;
        console.log(data);
            $("#vname").val(data.vname).trigger('change');
            $("#cname").val(data.cname).trigger('change');
            @if (Auth::user()->role==0){$("#rdate").val(data.odate);}
            @else{$("#rdate").val(data.odate).prop('disabled', true);}
            @endif
            $("#description").html(description);
            $("#worktype").val(worktype);
            $("#materialtype").val(data.material);
            $("#rmaterial").val(data.rmaterial);
            $("#qty").val(data.qty);        
            $("#id").val(data.id);
            }
            $("#exampleModalScrollable").modal("toggle");
        
        }
    function getcustomerdata(){
 
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
    function getsubplatedata(){
 
 $.ajax({
        type:'POST',
        url:"{{route('scanning.getsubplatedata')}}",
        data: {_token: "{{ csrf_token() }}", subprojectid:$("#subplateid").val()},
        success:function(data) {
         console.log(data);
         
        //  $('#subplateid').empty().trigger('change');
        //   var newOption = [];
          $(data).each(function(key,val){
            console.log(val.material);
              $("#materialtype").val(val.material);
                var length = val.length; // Assuming you have elements with IDs "length", "width", and "height"
                var width = val.width;
                var height = val.height;
                var dimensions = width + 'x' + height + 'x' + length;
                $("#rmaterial").val(dimensions);
                $("#qty").val(val.sqty);
        //       $("#scan_print_id").val(val.projectid);
        //      //  $("#worktype").html(data);
        //      //push subplate array for select2 
        //      newOption.push(new Option(val.platename, val.subprojectid, false, false));
         }); 
        //  $('#subplateid').append(newOption).trigger('change');
          
        }
     });
}
</script> 
<script>
    function AskToDelete(id){
    if (window.confirm("Do you really want to delete?")) {
    var url = "{{ route('purchase.delete',':id') }}";
    url = url.replace(':id', id);
    window.location.href=url;
    }
    }
</script>
<script>
    function getplates(){
             $('#dynamic-inputs').empty();
        }
        function getSelectedPlates() {
    selectedPlates = [];
    $("select[name='categories[]']").each(function() {
        var val = $(this).val();
        if (val) {
            selectedPlates.push(val.split(",")[0]);  // Add only plateid to the list
        }
    });
}
var selectedPlates = [];
var idindex = 1;  
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
        function updatedata(index,val){
            console.log("updatedatavalue")
            console.log(val)
            // console.log(val);
            
            $("#sqty" + index).val(val.split(",")[1]);
            $("#materialtype" + index).val(val.split(",")[2]);
            $("#material" + index).val(val.split(",")[3]);
            $("#qty" + index).val("");
            
            // Update the selected plates list
            getSelectedPlates();
            // Disable the selected options in other selects
            disableSelectedOptions(); 
        }

    $(document).ready(function() {
            // Initialize Select2 for the initial select box
            $('#select222').select2();
            $('#add-input').click(function() {
                $.ajax({
                    url:"{{route('customer.getprojectsubplatespurchaseview')}}",
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
                        var input ="",tempsqty='',tmaterial='',tmaterialtemp='';
                        var options = '<option value="" disabled selected>Select a plate</option>';  // Default placeholder option
                        for (var i = 0; i < data.length; i++) {
                            var value = data[i];
                            if(tempsqty==""){
                             tempsqty=value.pqty;
                            }
                            if(tmaterial==""){
                            tmaterial=value.material;
                            }
                            if(tmaterialtemp==""){
                                tmaterialtemp= value.width +' x '+ value.height +' x '+ value.length +' '+ value.unit;
                            }
                            
                            options += '<option value="' + value.plateid + ',' + value.pqty + ',' + value.material + ','+ value.width +' x '+ value.height +' x '+ value.length +' '+ value.unit +'">' + value.platename + '</option>';
                            if (selectedPlates.includes(value.plateid)) {
                                    options += ' disabled';  // Add disabled attribute if already selected
                                }

                                options += '>' + value.platename + '</option>';
                        }
                            input+='<div class="row">'+
                                '<div class="col-2" style="padding-right: unset;!important">'+
                                '<div class="mb-3">' +
                                    '<input class="form-control" type="hidden" id="pid" name="pids[]" value="">'+
                                    '<input class="form-control" type="hidden" id="purchase" name="pid[]" value="'+idd+'">'+
                                '<label class="form-label">Sub plate</label>' +
                                '<select name="categories[]" class="form-control select222" required onchange="return updatedata(\''+idindex+'\',this.value);">' +
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
                                '<div class="col" style="padding-right: unset;!important">'+
                                '<div class="mb-3">' +
                                '<label class="form-label">Material Type</label>' +
                                '<input class="form-control" type="text" name="materialtype[]" id="materialtype'+idindex+'"  value="'+tmaterial+'" readonly/>' +
                                '</div>' +
                                '</div>' +
                                '<div class="col-3" style="padding-right: unset;!important">'+
                                '<div class="mb-3">' +
                                '<label class="form-label">Required Material</label>' +
                                '<input class="form-control" type="text" name="material[]" id="material'+idindex+'"  value="'+tmaterialtemp+'"/>' +
                                '</div>' +
                                '</div>' +
                                '<div class="col" style="padding-right: unset;!important">' +
                                    '<div class="mb-3">' +
                                        '<label for="description" class="form-label">Order Qty</label>' +
                                        '<input class="form-control" type="text" name="qty[]" id="qty' + idindex + '" onchange="qtyChanged(\'' + idindex + '\', this.value)" required>' +
                                        '<div id="alertDiv' + idindex + '"></div>' +
                                        '<div class="invalid-feedback">' +
                                        'Please Enter Qty' +
                                        '</div>' +
                                    '</div>' +
                                '</div>'+
                                '<div class="col" style="padding-right: unset;!important">' +
                                '<div class="mb-3">' +
                                '<label for="description" class="form-label">Remaining Qty</label>' +
                                '<input class="form-control" type="text" id="sqty'+idindex+'" value="'+tempsqty+'" disabled>' +
                                '</div>' +
                                '</div>' +
                                '<div class="col" >'+
                                '<div class="mb-3 mt-4">' +
                                '<label class="form-label">&nbsp;</label>' +
                                '<button type="button" class="btn btn-danger waves-effect waves-light  delete-input">Delete</button>';
                                '</div>' + 
                                '</div>' +   
                                '</div>' ;     

                       $('#dynamic-inputs').append(input);

                        // Reinitialize Select2 for the new dropdown
                        $('#select222').select2();
                        getSelectedPlates();
                        disableSelectedOptions();
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
                    getSelectedPlates();
        disableSelectedOptions();
            });
    });
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
