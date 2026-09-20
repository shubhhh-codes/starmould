@extends('layouts.master')
@section('title') Purchase @endsection
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
        @slot('li_1') Pending Receive @endslot
        @slot('title') Pending Receive Data @endslot
    @endcomponent

    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-body">
                    
                    <table id="datatable-buttons5" class="table table-sm m-0 table-responsive">
                        <thead>
                            <tr>
                                <th style="width: 3%;"></th>
                                <th style="width: 8%;">Po. No.</th>  
                                <!-- <th style="width: 9%;">Po. No.</th> -->
                                <th style="width: 9%;">Order Date</th>      
                                <th style="width: 12%;">Mould</th>  
                                <th style="width: 25%;">Description</th>         
                                <th style="width: 20%;">Customer Name</th>
                                <th style="width: 20%;">Supplier Name</th>
                        
                                {{-- <th>Particulars</th>
                                <th>Description</th> --}}
                                {{-- <th>Qty</th> --}}
                            
                                {{-- <th></th> --}}
                                {{-- @if (Auth::user()->role==0)
                                <th>status</th> 
                                @endif --}}
                                {{-- <th style="width: 8%;">Created by</th> --}}
                                {{-- <th style="width: 5%;">Action</th>                                                         --}}
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
        for (var i = 0; i < d.length; i++) {
            childTable += '<tr>';
            childTable += '<td>' + d[i].platename + '</td>';
            // childTable += '<td>' + d[i].cdescription + '</td>';
            childTable += '<td>' + d[i].imaterial + '</td>';
            childTable += '<td>' + d[i].materialtype + '</td>';
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
              serverSide: false,
              pageLength:50,
              ajax: "{{route('getpurchaseitemslistdata')}}",
              columns: [
                {
                    
                        className: "details-control",
                        orderable: false,
                        data: null,
                        defaultContent: '<i class="fas fa-chevron-down"></i>'
                    },
            
                {data: 'srno', name: 'srno',orderable: true},
                // {data: 'pno', name: 'pno',orderable: true},
                {data : {'_': 'odate.display', 'sort': 'odate.timestamp'}, name: 'odate', orderable: true},
                {data: 'projectid', name:'projectid',orderable: true},
                {data: 'description', name: 'description',orderable: true},
                {data: 'vname', name: 'vname',orderable: true},
                {data: 'cname', name: 'cname',orderable: true}, 
                // {data: 'inward', name: 'inward', orderable: false, searchable: false},  
                //  {data: 'qty', name: 'qty'},
                //                               
              ],
    "rowCallback": function (row, data) {
        // Here, you can define the condition to highlight rows.
        
            $(row).addClass('highlighted-row');
       
    }
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
                url: '{{route("getpurchaseitemsdata")}}', 
                                data: {
                                    pid:rowData.id,
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

        
      </script> 
  
@endsection
