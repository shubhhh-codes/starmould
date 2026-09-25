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

    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-body">
                    <table id="datatable-buttons5" class="table table-bordered dt-responsive nowrap w-100">
                        <thead>
                            <tr>
                                <th>Received Date</th>
                                <th>Committed Date</th>
                                <th>Gram</th>
                                <th>Hr</th>
                                <th>Print By</th>
                                <th>QC By</th>
                                <th>Dispatch</th>
                                <th>Customer Name</th>
                                <th>Part Description</th>
                             
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
    <script src="{{ URL::asset('/assets/libs/jszip/jszip.min.js') }}"></script>
    <script src="{{ URL::asset('/assets/libs/pdfmake/pdfmake.min.js') }}"></script>
    <!-- Datatable init js -->
    <script src="{{ URL::asset('/assets/js/pages/datatables.init.js') }}"></script>
@endsection
