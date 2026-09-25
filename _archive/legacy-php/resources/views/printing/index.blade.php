@extends('layouts.master')

@section('title') Print Register @endsection

@section('css')
    <!-- DataTables -->
    <link href="{{ URL::asset('/assets/libs/select2/select2.min.css') }}" rel="stylesheet" type="text/css" />
    <link href="{{ URL::asset('/assets/libs/bootstrap-datepicker/bootstrap-datepicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/spectrum-colorpicker/spectrum-colorpicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/bootstrap-timepicker/bootstrap-timepicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/bootstrap-touchspin/bootstrap-touchspin.min.css') }}" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" href="{{ URL::asset('/assets/libs/datepicker/datepicker.min.css') }}">
    <link href="{{ URL::asset('/assets/libs/datatables/datatables.min.css') }}" rel="stylesheet" type="text/css" />
    <style>
        .modal-dialog-scrollable {
        overflow-y: scroll;
        max-height: 80vh; /* You can adjust this value to fit your needs */
    }
    </style>
@section('content')

    @component('components.breadcrumb')
        @slot('li_1') Printing @endslot
        @slot('title') Printing Data @endslot
    @endcomponent

    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-body">

                    <button type="button" class="btn btn-outline-primary waves-effect waves-light mb-3" data-bs-toggle="modal" data-bs-target="#exampleModalScrollable">Add Data</button>
                    <!-- Add Modal Start -->
                    <div class="modal fade" id="exampleModalScrollable" tabindex="-1" role="dialog" aria-labelledby="exampleModalScrollableTitle" aria-hidden="true">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content modal-lg ">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="exampleModalScrollableTitle">ADD NEW PRINTING WORK</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                
                                <form action="{{route('printing.store')}}" method="post" class="needs-validation" novalidate>
                                    @csrf
 
                                    <!-- Equivalent to... -->
                                    <input type="hidden" name="_token" value="{{ csrf_token() }}" />
                                <div class="modal-body modal-dialog-scrollable">
                                    <div class="row">
                                         
                                        <div class="col-md-6">
                                            <div class="mb-3">
                                                <label>Today’s Date</label>
                                                <div class="input-group" id="datepicker">
                                                    <input type="text" name="tdate1" class="form-control" placeholder="Pick a date"
                                                        data-date-format="dd/mm/yyyy" data-date-container='#datepicker'
                                                        data-provide="datepicker" data-date-autoclose="true">
                    
                                                    <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                                </div><!-- input-group -->
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="mb-3">
                                                <label>Commited Date</label>
                                                <div class="input-group" id="datepicker1">
                                                    <input type="text" name="cdate1" class="form-control" placeholder="Pick a date"
                                                        data-date-format="dd/mm/yyyy" data-date-container='#datepicker1'
                                                        data-provide="datepicker" data-date-autoclose="true">
                    
                                                    <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                                </div><!-- input-group -->
                                            </div>
                                        </div>
                                    </div>
                                    <div class="mb-3">
                                        <label for="validationCustom01" class="form-label">Customer Name</label>
                                        <input type="text" class="form-control" id="validationCustom01" placeholder="Customer Name"
                                             name="cname1" required>
                                        <div class="valid-feedback">
                                            Looks good!
                                        </div>
                                    </div>
                                    <div class="mb-3">
                                        <label for="validationCustom02" class="form-label">Part Description</label>
                                        <textarea class="form-control" id="validationCustom02" placeholder="Part Description"
                                             name="description1" required></textarea>
                                        <div class="valid-feedback">
                                            Looks good!
                                        </div>
                                    </div>
                                        <div class="row">
                                            <div class="col-md-6">
                                                <div class="mb-3">
                                                    <label class="form-label">Gram</label>
                                                    <div>
                                                        <input data-parsley-type="number" type="text" name="gram" id="gram" class="form-control" required
                                                            placeholder="Enter only numbers" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="col-md-6">
                                                <div class="mb-3">
                                                    <label class="form-label">Print Time</label>
                        
                                                    <div>
                                                        <input data-parsley-type="number" type="text" name="time" class="form-control" required
                                                            placeholder="Enter only numbers" />
                                                    </div>
                                                </div>
                                            </div>
                
                                            
                                        </div>
                                        
                                                                            
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

                    <table id="datatable-buttons2" class="table table-bordered dt-responsive nowrap w-100">
                        <thead>
                            <tr>
                                <th>Received Date</th>
                                <th>Committed Date</th>
                                <th>Gram</th>
                                <th>Hr</th>
                                <th>Print By</th>
                                <th>Dispatch</th>
                                <th>QC By</th>
                                <th>Customer Name</th>
                                <th>Part Description</th>
                                <th>Suggested Amount</th>
                                <th></th>
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
    <script type="text/javascript">
        $(function () {
           
        $('#datatable-buttons2').DataTable({
              processing: true,
              serverSide: true,
              ajax: "{{route('getprintdata')}}",
              columns: [
                  {data: 'tdate', name: 'tdate1'},
                  {data: 'cdate', name: 'cdate1'},    
                  {data: 'gram', name: 'gram'},
                  {data: 'hr', name: 'time'},            
                  {data: 'print_by', name: 'print_by'},
                  {data: 'dispatch', name: 'dispatch'},
                  {data: 'qc_by', name: 'qc_by'},
                  {data: 'cname', name: 'cname1'},
                  {data: 'description', name: 'description1'},
                  {data: 'amount', name: 'amount'},                
                  {   
                      data: 'action', 
                      name: 'action',             
                      orderable: true, 
                      searchable: true
                  },
              ]
          });
          
        });
      </script> 
@endsection
