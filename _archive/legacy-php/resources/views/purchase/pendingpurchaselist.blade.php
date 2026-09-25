@extends('layouts.master')

@section('title') Pending Purchase @endsection

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
        @slot('li_1') Pending Purchase @endslot
        @slot('title') Pending Purchase Data @endslot
    @endcomponent


    <div class="row">
        <div class="col-lg-12">
            <div class="card">
                <div class="card-body">
                 
                    <table id="datatablescan" class="table table-sm m-0 table-responsive" style="width: 100%!important">                      
                        <thead>                    
                            <tr> 
                                <th style="width: 9%;">Plate Name</th>
                                <th style="width: 10%;">Mould</th>
                                <th style="width: 5%;">Length</th>
                                <th style="width: 8%;">Width</th>
                                <th style="width: 8%;">Height</th>
                                <th style="width: 3%;">Material</th>
                                <th style="width: 3%;">qty</th>
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

  
    <script type="text/javascript">
       
        $(function () {
           
            $('#datatablescan').DataTable({
                    processing: true,
                    serverSide: false,
                    pageLength:50,
                    ajax: "{{route('getpendingpurchaselist')}}",
                    columns: [
                    {data: 'platename', name: 'platename'},
                    {data: 'projectid', name: 'projectid'},
                    {data: 'length', name: 'length'},
                    {data: 'width', name: 'width'},
                    {data: 'height', name: 'height'},               
                    {data: 'material', name: 'material'},    
                    {data: 'sqty', name: 'sqty'},
                    ]
            });
                
        });
    
       
    </script> 
    
    
@endsection
