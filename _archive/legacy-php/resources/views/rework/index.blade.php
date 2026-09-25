@extends('layouts.master')

@section('title') Rework Log @endsection

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
        @slot('li_1') Rework @endslot
        @slot('title') Rework Data @endslot
    @endcomponent


    <div class="row">
        <div class="col-lg-12">
            <div class="card">
                <div class="card-body">
                 
                    <table id="datatablescan" class="table table-sm m-0 table-responsive" style="width: 100%!important">                      
                        <thead>                    
                            <tr> 
                                <th style="width: 9%;">Received Dt</th>
                                <th style="width: 10%;">Committed Dt</th>
                                <th style="width: 5%;">Customer</th>
                                <th style="width: 8%;">Work Type</th>
                                <th>Project Description</th>
                                <th style="width: 3%;">Project</th>
                                <th style="width: 5%;">SM Hr</th>
                                <th style="width: 6%;">USM Hr</th>
                                <th style="width: 5%;">M Hr</th>
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
                    pageLength:25,
                    ajax: "{{route('getreworkdata')}}",
                    columns: [
                         {data : {'_': 'rdate.display', 'sort': 'rdate.timestamp'}, name: 'rdate', orderable: true},
                         {data : {'_': 'cdate.display', 'sort': 'cdate.timestamp'}, name: 'cdate', orderable: true},                        
                        //   {data: 'scan_by', name: 'scan_by'},
                        {data: 'cname', name: 'cname',orderable: true, 
                         searchable: true},
                    {data: 'worktype', name: 'worktype',orderable: true, 
                         searchable: true},
                    {data: 'description', name: 'description',orderable: true, 
                         searchable: true},
                    // {data: '', name: '',orderable: true, 
                    //      searchable: true},
                    {data: 'projectid', name: 'projectid',orderable: true, 
                         searchable: true},
                     
                   //   {data: 'mail_done', name: 'mail_done'},
                     
                     
                     {data: 'scan_hr', name: 'scan_hr', orderable: true, searchable: true},
                     {data: 'model_hr', name: 'model_hr', orderable: true, searchable: true},  
                     {data: 'model_hr', name: 'model_hr', orderable: true, searchable: true},
                    //  {data: 'amount', name: 'amount', orderable: false, searchable: false},                
                  
                    ]
            });             
        });
    
       
    </script> 
    
    
@endsection
