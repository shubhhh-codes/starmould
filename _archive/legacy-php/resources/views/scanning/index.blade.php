@extends('layouts.master')

@section('title') Dashboard @endsection

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
        /* max-height: 80vh; You can adjust this value to fit your needs */
    }
    </style>
@endsection

@section('content')
    <div class="row">
        <div class="col-xl-12">
            <div class="row">
                <div class="col-md-6">
                    <div class="row">
                        <div class="col">
                            <div class="card mini-stats-wid" style="margin-bottom: 0px !important;">
                                <div class="card-body" style="padding: 12px;padding-bottom:10px;">
                                    <div class="d-flex">
                                        <div class="flex-grow-1">
                                            <p class="text-muted text-center fw-medium badge-soft-success" style="margin-bottom:6px;">Design Order</p>
                                            {{-- <h4 class="mb-0" id="scantotal">{{$scantotal}}</h4> --}}
                                        </div>   
                                    </div>
                                    <div class="row">
                                        
                                        <div class="col ">
                                            <div>
                                                <h5 class="mb-0 text-center">{{$scantotal}}</h5>
                                                <p class="text-muted text-center text-truncate mb-0">Moulds</p>
                                            </div>
                                        </div>
                                        <div class="col">
                                            <div>
                                                <h5 class="mb-0 text-center" id="designby">{{$designby}}</h5>
                                                <p class="text-muted  text-center text-truncate mb-0">Plates</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card mini-stats-wid" style="margin-bottom: 0px !important;">
                                <div class="card-body" style="padding: 12px;padding-bottom:10px;">
                                    <div class="d-flex">
                                        <div class="flex-grow-1">
                                            <p class="text-muted text-center fw-medium badge-soft-success" style="margin-bottom:6px;">Material Order</p>
                                            {{-- <h4 class="mb-0" id="scantotal">{{$scantotal}}</h4> --}}
                                        </div>   
                                    </div>
                                    <div class="row">
                                        
                                        <div class="col ">
                                            <div>
                                                <h5 class="mb-0 text-center">{{$scantotal}}</h5>
                                                <p class="text-muted text-center text-truncate mb-0">Moulds</p>
                                            </div>
                                        </div>
                                        <div class="col">
                                            <div>
                                                <h5 class="mb-0 text-center" id="orderby">{{$orderbytotal}}</h5>
                                                <p class="text-muted  text-center text-truncate mb-0">Plates</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card mini-stats-wid" style="margin-bottom: 0px !important;">
                                <div class="card-body" style="padding: 12px;padding-bottom:10px;">
                                    <div class="d-flex">
                                        <div class="flex-grow-1">
                                            <p class="text-muted text-center fw-medium badge-soft-success" style="margin-bottom:6px;">Programming</p>
                                            {{-- <h4 class="mb-0" id="scantotal">{{$scantotal}}</h4> --}}
                                        </div>   
                                    </div>
                                    <div class="row">
                                        
                                        <div class="col ">
                                            <div>
                                                <h5 class="mb-0 text-center">{{$scantotal}}</h5>
                                                <p class="text-muted text-center text-truncate mb-0">Moulds</p>
                                            </div>
                                        </div>
                                        <div class="col">
                                            <div>
                                                <h5 class="mb-0 text-center" id="receivedqcby">{{$receivedqcby}}</h5>
                                                <p class="text-muted  text-center text-truncate mb-0">Plates</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card mini-stats-wid" style="margin-bottom: 0px !important;">
                                <div class="card-body" style="padding: 12px;padding-bottom:10px;">
                                    <div class="d-flex">
                                        <div class="flex-grow-1">
                                            <p class="text-muted text-center fw-medium badge-soft-success" style="margin-bottom:6px;">Machining</p>
                                            {{-- <h4 class="mb-0" id="scantotal">{{$scantotal}}</h4> --}}
                                        </div>   
                                    </div>
                                    <div class="row">
                                        
                                        <div class="col ">
                                            <div>
                                                <h5 class="mb-0 text-center">{{$scantotal}}</h5>
                                                <p class="text-muted text-center text-truncate mb-0">Moulds</p>
                                            </div>
                                        </div>
                                        <div class="col">
                                            <div>
                                                <h5 class="mb-0 text-center" id="vmcworkby">{{$vmcworkby}}</h5>
                                                <p class="text-muted  text-center text-truncate mb-0">Plates</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {{-- <div class="col">
                            <div class="card mini-stats-wid">
                                <div class="card-body">
                                    <div class="d-flex">
                                        <div class="flex-grow-1">
                                            <p class="text-muted text-center fw-medium">Print QC</p>
                                            <h4 class="mb-0" id="printqc">{{$printqc}}</h4>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div> --}}
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="row">
                        
                        <div class="col">
                            <div class="card mini-stats-wid" style="margin-bottom: 0px !important;">
                                <div class="card-body" style="padding: 12px;padding-bottom:10px;">
                                    <div class="d-flex">
                                        <div class="flex-grow-1">
                                            <p class="text-muted text-center fw-medium badge-soft-success" style="margin-bottom:6px;">Drilling & Tapping</p>
                                            {{-- <h4 class="mb-0" id="scantotal">{{$scantotal}}</h4> --}}
                                        </div>   
                                    </div>
                                    <div class="row">
                                        
                                        <div class="col ">
                                            <div>
                                                <h5 class="mb-0 text-center">{{$scantotal}}</h5>
                                                <p class="text-muted text-center text-truncate mb-0">Moulds</p>
                                            </div>
                                        </div>
                                        <div class="col">
                                            <div>
                                                <h5 class="mb-0 text-center" id="drilltapworkby">{{$drilltapworkby}}</h5>
                                                <p class="text-muted  text-center text-truncate mb-0">Plates</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card mini-stats-wid" style="margin-bottom: 0px !important;">
                                <div class="card-body" style="padding: 12px;padding-bottom:10px;">
                                    <div class="d-flex">
                                        <div class="flex-grow-1">
                                            <p class="text-muted text-center fw-medium badge-soft-success" style="margin-bottom:6px;">Final QC</p>
                                            {{-- <h4 class="mb-0" id="scantotal">{{$scantotal}}</h4> --}}
                                        </div>   
                                    </div>
                                    <div class="row">
                                        
                                        <div class="col ">
                                            <div>
                                                <h5 class="mb-0 text-center">{{$scantotal}}</h5>
                                                <p class="text-muted text-center text-truncate mb-0">Moulds</p>
                                            </div>
                                        </div>
                                        <div class="col">
                                            <div>
                                                <h5 class="mb-0 text-center" id="finalqcby">{{$finalqcby}}</h5>
                                                <p class="text-muted  text-center text-truncate mb-0">Plates</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {{-- <div class="col">
                            <div class="card mini-stats-wid">
                                <div class="card-body">
                                    <div class="d-flex">
                                        <div class="flex-grow-1">
                                            <p class="text-muted text-center fw-medium">Print QC</p>
                                            <h4 class="mb-0" id="printqc">{{$printqc}}</h4>
                                        </div>
                                        
                                    </div>
                                </div>
                            </div>
                        </div> --}}
                        <div class="col">
                            <div class="card mini-stats-wid" style="margin-bottom: 0px !important;">
                                <div class="card-body" style="padding: 12px;padding-bottom:10px;">
                                    <div class="d-flex">
                                        <div class="flex-grow-1">
                                            <p class="text-muted text-center fw-medium badge-soft-success" style="margin-bottom:6px;">Material Packing</p>
                                            {{-- <h4 class="mb-0" id="scantotal">{{$scantotal}}</h4> --}}
                                        </div>   
                                    </div>
                                    <div class="row">
                                        
                                        <div class="col ">
                                            <div>
                                                <h5 class="mb-0 text-center">{{$scantotal}}</h5>
                                                <p class="text-muted text-center text-truncate mb-0">Moulds</p>
                                            </div>
                                        </div>
                                        <div class="col">
                                            <div>
                                                <h5 class="mb-0 text-center" id="packingworkby">{{$packingworkby}}</h5>
                                                <p class="text-muted  text-center text-truncate mb-0">Plates</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card mini-stats-wid" style="margin-bottom: 0px !important;">
                                <div class="card-body" style="padding: 12px;padding-bottom:10px;">
                                    <div class="d-flex">
                                        <div class="flex-grow-1">
                                            <p class="text-muted text-center fw-medium badge-soft-success" style="margin-bottom:6px;">Samples</p>
                                            {{-- <h4 class="mb-0" id="scantotal">{{$scantotal}}</h4> --}}
                                        </div>   
                                    </div>
                                    <div class="row">
                                        
                                        <div class="col ">
                                            <div>
                                                <h5 class="mb-0 text-center">{{$samplecount}}</h5>
                                                <p class="text-muted text-center text-truncate mb-0">Moulds</p>
                                            </div>
                                        </div>
                                        {{-- <div class="col">
                                            <div>
                                                <h5 class="mb-0 text-center">18</h5>
                                                <p class="text-muted  text-center text-truncate mb-0">Plates</p>
                                            </div>
                                        </div> --}}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div> 
            </div>
            <!-- end row -->
    
           
        </div>
    </div>   
    <div class="row">
        <div class="col-12">           
            <div class="card-body">
                    <h5>MOULD DATA</h5>
                    @if ((Auth::user()->role==0) || (Auth::user()->role==1)) 
                    <button type="button" onclick="return addscandata();" class="btn btn-primary btn-lg waves-effect waves-light" data-bs-toggle="modal" data-bs-target="#exampleModalScrollable" style="margin-bottom: 10px;    position: absolute;
                    /* left: 248px; */
                    transform: translateX(100%);
                    top: 10px;">Add Mould Data</button>
                    <a href ="{{ route('exportmould') }}" type="button" class="btn btn-primary btn-lg waves-effect waves-light"  style="margin-bottom: 10px;
                    position: absolute;
                    left: 290px;
                    transform: translateX(100%);
                    top: 10px;">Export</a>
                    <script> var dashboardurl = "{{ url('/dashboarddata') }}"; </script>
                     <div class="col-sm-auto">
                                <button onclick="window.location=dashboardurl" class="btn btn-primary btn-lg float-end" data-bs-toggle="modal" style="margin-bottom: 10px;
                                position: absolute;
                                /* right: 100px; */
                                left: 353px;
                                transform: translateX(100%);
                                top: 10px;">View Filter</button>
                            </div>
                    @endif                  
                </div>           
        </div>
    </div>
    <div class="row">
        <div class="col-12">
            <div class="card">
                
                <div class="card-body">

                    <!-- Add Modal Start -->
                    <div class="modal fade" id="exampleModalScrollable" tabindex="-1" role="dialog" aria-labelledby="exampleModalScrollableTitle" aria-hidden="true">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content modal-lg modal-dialog-scrollable">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="exampleModalScrollableTitle">MOULD WORK</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                
                                <form autocomplete="off" action="{{route('scanning.store')}}" method="post" class="needs-validation" novalidate>
                                    @csrf
 
                                    <!-- Equivalent to... -->
                                    <input type="hidden" name="_token" value="{{ csrf_token() }}" />
                                    <div class="modal-body">
                                            <div class="row">
                                                <div class="col-md-6">
                                                    <div class="mb-3">
                                                        <label>Today’s Date</label>
                                                        <div class="input-group" id="datepicker">
                                                            <input type="text" name="rdate" class="form-control" placeholder="Pick a date"
                                                                data-date-format="dd/mm/yyyy" data-date-container='#datepicker'
                                                                data-provide="datepicker" data-date-autoclose="true" id="rdate" value={{$currentDateTime}}>
                            
                                                            <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                                        </div><!-- input-group -->
                                                    </div>
                                                </div>
                                                <div class="col-md-6">
                                                    <div class="mb-3">
                                                        <label>Commited Date</label>
                                                        <div class="input-group" id="datepicker1">
                                                            <input type="text" name="cdate" class="form-control" placeholder="Pick a date"
                                                                data-date-format="dd/mm/yyyy" data-date-container='#datepicker1'
                                                                data-provide="datepicker" data-date-autoclose="true" id="cdate" required>
                            
                                                            <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                                        </div><!-- input-group -->
                                                       
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="mb-3">
                                                <label for="validationCustom01" class="form-label">Customer Name</label>
                                                <select class="form-control select2" style="width: 100%;" name="cname" id="cname" required>
                                                        <option value="">Select Customer Name</option>
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
                                                <label for="description" class="form-label">Part Description</label>
                                                <textarea required class="form-control" id="description" name="description"></textarea>
                                                    <div class="invalid-feedback">
                                                        Please Enter Part Description
                                                    </div>
                                                    <input  class="form-control" type="hidden" name="id" id="id" />
                                            </div>
                                            <div class="row">
                                                <label for="validationCustom03" class="form-label">Work Type</label >
                                                <div class="col-md-2">                                                                                        
                                                        <div class="form-check mb-3">
                                                            <input class="form-check-input" type="radio" name="worktype"  value="Pulp Mould" required>
                                                            <label class="form-check-label" for="formRadios1">
                                                                Pulp Mould
                                                            </label>
                                                        </div>    
                                                </div>
                                                <div class="col-md-2">
                                                        <div class="form-check">
                                                            <input class="form-check-input" type="radio" name="worktype" value="TF" >
                                                            <label class="form-check-label" for="formRadios2">
                                                                TF
                                                            </label>
                                                        </div>  
                                                </div>
                                               
                                                
                                                {{-- <div class="col-md-2">
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="radio" name="worktype" value="Sample" >
                                                        <label class="form-check-label" for="formRadios3">
                                                            Sample
                                                        </label>
                                                    </div>
                                                </div> --}}
                                                <div class="col-md-2">
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="radio" name="worktype" value="Rework" >
                                                        <label class="form-check-label" for="formRadios3">
                                                            Rework
                                                        </label>
                                                    </div>
                                                </div>
                                                <div class="col-md-2">
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="radio" name="worktype" value="Accessories" >
                                                        <label class="form-check-label" for="formRadios3">
                                                            Accessories
                                                        </label>
                                                    </div>
                                                </div>
                                                <div class="col-md-2">
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="radio" name="worktype" value="Machine part" >
                                                        <label class="form-check-label" for="formRadios2">
                                                            Machine part
                                                        </label>
                                                    </div>  
                                                </div>
                                                <div class="col-md-2">
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="radio" name="worktype" value="Other" >
                                                        <label class="form-check-label" for="formRadios3">
                                                            Other
                                                        </label>
                                                    </div>
                                            </div>
                                            </div>
                                            
                                            <div class="mb-3">
                                                <label for="Note" class="form-label">Note</label>
                                                <textarea  class="form-control" id="note" name="note"></textarea>
                                            </div>
                                            {{-- <div class="row">
                                                <div class="col-md-4">
                                                    <div class="mb-3">
                                                        <label for="validationCustom03" class="form-label">State</label>
                                                        <select class="form-select" id="validationCustom03" name="state" required>
                                                            <option selected disabled value="">Choose...</option>
                                                            <option>...</option>
                                                        </select>
                                                        <div class="invalid-feedback">
                                                            Please select a valid state.
                                                        </div>
                    
                                                    </div>
                                                </div>
                                                <div class="col-md-4">
                                                    <div class="mb-3">
                                                        <label for="validationCustom04" class="form-label">City</label>
                                                        <input type="text" class="form-control" name="city" id="validationCustom04" placeholder="City"
                                                            required>
                                                        <div class="invalid-feedback">
                                                            Please provide a valid city.
                                                        </div>
                                                    </div>
                                                </div>
                    
                                                <div class="col-md-4">
                                                    <div class="mb-3">
                                                        <label for="validationCustom05" class="form-label">Zip</label>
                                                        <input type="text" class="form-control" name="zip" id="validationCustom05" placeholder="Zip"
                                                            required>
                                                        <div class="invalid-feedback">
                                                            Please provide a valid zip.
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="form-check mb-3">
                                                <input class="form-check-input" type="checkbox" value="" id="invalidCheck" required>
                                                <label class="form-check-label" for="invalidCheck">
                                                    Agree to terms and conditions
                                                </label>
                                                <div class="invalid-feedback">
                                                    You must agree before submitting.
                                                </div>
                                            </div> --}}                                       
                                    </div>
                                    <div class="modal-footer">
                                        <button type="button" class="btn btn-light" data-bs-dismiss="modal">Close</button>
                                        <button class="btn btn-primary" type="submit">Submit form</button>
                                    </div>
                                </form>
                            </div><!-- /.modal-content -->
                        </div><!-- /.modal-dialog -->
                    </div>
                    
                    <!-- Add Data Modal End-->
                    
                    
                    <table id="datatablescan" class="table table-striped mb-0 table-responsive" style="width: 100%!important">                      
                        <thead>                    
                            <tr> 
                                @if (Auth::user()->role==0) 
                                    <th style="width:9%;">Received Dt</th>
                                    {{-- <th style="width: 11%;">Committed Dt</th> --}}
                                    <th style="width: 5%;">Cust.</th>
                                    <th style="width: 8%;">WorkType</th>
                                    <th>Mould/Part Name</th>
                                    <th style="width: 1%;">Note</th>
                                    {{-- <th style="width: 5%;">Sub Plate</th> --}}
                                    
                                    <th style="width: 3%;">Mould</th>
                                    {{-- <th>Designing</th>
                                    <th>Material Order</th>
                                    <th>Material Received</th>
                                    <th>VMC</th>
                                    <th>Drilling & Tapping</th>
                                    <th>Final QC</th>
                                    <th>Packing</th> --}}
                                    {{-- <th style="width: 4%;">Scan By</th>
                                    <th style="width: 5%;">Design By</th>
                                    <th style="width: 4%;">QC By</th> --}}
                                    <th style="width: 2%;text-align:center">Disp.</th>
                                    {{-- <th style="width: 5%;">SM Hr</th>
                                    <th style="width: 6%;">USM Hr</th> --}}
                                    <th style="width: 6%;">M Hr</th>
                                    <th style="width: 12%;">Subnote</th>
                                    {{-- <th style="width: 6%;">Amount</th> --}}
                                    <th style="width: 17%;">Action<th>
                                    <th style="width: 1%;"></th>
                            </tr>
                                        {{-- <th>Received Dt</th>
                                        <th>Committed Dt</th>
                                        <th>Customer Initials</th>
                                        <th>Work Type</th>
                                        <th>Project Description</th>  
                                        <th>Sub Plate Name</th> 
                                        <th>Project</th>
                                        <th>L</th>
                                        <th>W</th>
                                        <th>H</th>
                                        <th>Weight</th>
                                        <th>Photo</th>
                                        <th>Designing</th>
                                        <th>Material Order</th>
                                        <th>Material Received</th>
                                        <th>VMC</th>
                                        <th>Drilling & Tapping</th>
                                        <th>Final QC</th>
                                        <th>Packing</th>
                                        <th>Dispatch</th>
                                        <th>SM Time</th>
                                        <th>USM Time</th>
                                        <th>Machine Time</th>
                                        <th>Action<th>     --}}
                                @else
                                <th style="width: 10%;">Received Dt</th>
                                <th style="width: 11%;">Committed Dt</th>
                                <th style="width: 5%;">Cust.</th>
                                <th style="width: 8%;">WorkType</th>
                                <th>Mould/Part Name</th>
                                <th style="width: 2%;">Note</th>
                                {{-- <th style="width: 5%;">Sub Plate</th> --}}
                                
                                <th style="width: 3%;">Project</th>
                                {{-- <th>Designing</th>
                                <th>Material Order</th>
                                <th>Material Received</th>
                                <th>VMC</th>
                                <th>Drilling & Tapping</th>
                                <th>Final QC</th>
                                <th>Packing</th> --}}
                                {{-- <th style="width: 4%;">Scan By</th>
                                <th style="width: 5%;">Design By</th>
                                <th style="width: 4%;">QC By</th> --}}
                                <th style="width: 2%;text-align:center">Disp.</th>
                                {{-- <th style="width: 5%;">SM Hr</th>
                                <th style="width: 6%;">USM Hr</th> --}}
                                <th style="width: 6%;">M Hr</th>
                                {{-- <th style="width: 6%;">Amount</th> --}}
                                <th style="width: 17%;">Action<th>
                                <th></th>
                                @endif  
                            </tr>
                            
                        </thead>


                        <tbody>
                            
                        </tbody>
                    </table>
                </div>
            </div>
        </div> <!-- end col -->
    </div> <!-- end row -->
    {{-- <div class="modal fade" id="myModal" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="exampleModalLabel">View Data</h5>
              <button type="button" class="close" data-dismiss="modal" aria-label="Close" id="close1">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div class="modal-body">
              <!-- Your form HTML code goes here -->
            <form class="repeater" enctype="multipart/form-data">
                <div data-repeater-list="group-a">
                    <div data-repeater-item class="row">
                        <div class="mb-3 col-lg-2">
                            <label for="name">Name</label>
                            <input type="text" id="name" name="untyped-input" class="form-control" placeholder="Enter Your Name" />
                        </div>

                        <div class="mb-3 col-lg-2">
                            <label for="email">Email</label>
                            <input type="email" id="email" class="form-control" placeholder="Enter Your Email ID" />
                        </div>

                        <div class="mb-3 col-lg-2">
                            <label for="subject">Subject</label>
                            <input type="text" id="subject" class="form-control" placeholder="Enter Your Subject" />
                        </div>

                        <div class="mb-3 col-lg-2">
                            <label for="resume">Resume</label>
                            <input type="file" class="form-control" id="resume">
                        </div>

                        <div class="mb-3 col-lg-2">
                            <label for="message">Message</label>
                            <textarea id="message" class="form-control" placeholder="Enter Your Message"></textarea>
                        </div>

                        <div class="col-lg-2 align-self-center">
                            <div class="d-grid">
                                <input data-repeater-delete type="button" class="btn btn-primary" value="Delete" />
                            </div>
                        </div>
                    </div>

                </div>
                <input data-repeater-create type="button" class="btn btn-success mt-3 mt-lg-0" value="Add" />
            </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-dismiss="modal" id="close1">Close</button>
            </div>
          </div>
        </div>
    </div> --}}
    
      <div class="modal fade" id="myModal" tabindex="-1" role="dialog" aria-labelledby="exampleModalScrollableTitle" aria-hidden="true">
        <div class="modal-dialog modal-xl">
            <div class="modal-content modal-xl">
                <div class="modal-header">
                    <h5 class="modal-title" id="exampleModalScrollableTitle">Sub Plate</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <form action="{{route('plates.add')}}" id="addPlates" class="repeater_new" method="POST" enctype="multipart/form-data" style="margin: 15px;">
                    @csrf
                    <input type="text" id="mainprojectid" class="form-control d-none" name="mainprojectid" readonly/>
                    <input type="text" id="actualprojectid" class="form-control d-none" name="actualprojectid" readonly/>
                    <div data-repeater-list="plates" id="dataRepeaterId">
                        <div data-repeater-item class="row">
                            <div class="mb-3 col" style="padding-right: 2px;padding-left: 4px;">
                                <label for="name">Name</label>
                                <input type="text" id="platename" name="platename" class="form-control" required/>
                            </div>
    
                            <div class="mb-3 col-auto" style="padding-right: 2px;padding-left: 2px;width:10%;">
                                <label for="email">Project</label>
                                <input type="text" id="subproject" class="form-control" name="subproject" readonly/>
                            </div>
                            <div class="mb-3 col-auto" style="padding-right: 2px;padding-left: 2px;width:6%;">
                                <label for="shape">Shape</label>
                                <select class="form-control" id="shape"  name="shape" onchange="calculateWeight(this)">
                                  <option value="">Select</option>
                                  <option value="Rectangle">Rectangle</option>
                                  <option value="Round">Round</option>
                                  <option value="Pipe">Pipe</option>
                                </select>
                              </div>  
                            
                            <div class="mb-3 col-auto" style="padding-right: 2px;padding-left: 2px;width:6%;">
                                <label for="subject">Width / OD</label>
                                <input type="text" id="width" class="form-control" name="width" onkeyup="calculateWeight(this)" />
                            </div>
                            <div class="mb-3 col-auto" style="padding-right: 2px;padding-left: 2px;width:6%;">
                                <label for="subject">Height / ID</label>
                                <input type="text" id="height" class="form-control" name="height" onkeyup="calculateWeight(this)" />
                            </div>
                            <div class="mb-3 col-auto" style="padding-right: 2px;padding-left: 0px;width:6%;">
                                <label for="subject">Length</label>
                                <input type="text" id="length" class="form-control" name="length" onkeyup="calculateWeight(this)"/>
                            </div>
                            <div class="mb-3 col-auto" style="padding-right: 2px;padding-left: 2px;width:6%;">
                                <label for="unit">Unit</label>
                                <select class="form-control" id="unit"  name="unit" onchange="calculateWeight(this)">
                                  <option value="">Select</option>
                                  <option value="mm">mm</option>
                                  <option value="cm">cm</option>
                                  <option value="feet">feet</option>
                                  <option value="meter">meter</option>
                                  <option value="inch">inch</option>
                                </select>
                              </div>
                            <div class="mb-3 col-auto" style="padding-right: 2px;padding-left: 2px;width:6%;">
                                <label for="material">Material</label>
                                <select class="form-control" id="material"  name="material" onchange="calculateWeight(this)">
                                  <option value="">Select</option>
                                  <option value="Acralic">Acralic</option>
                                  <option value="Aluminium">Aluminium</option>
                                  <option value="Brass">Brass</option>
                                  <option value="C45">C45</option>
                                  <option value="Copper">Copper</option>
                                  <option value="D-2">D-2</option>
                                  <option value="Derlin">Derlin</option>
                                  <option value="EN8">EN8</option>
                                  <option value="Gun Metal">Gun Metal</option>
                                  <option value="MS-Black">MS-Black</option>
                                  <option value="MS-Bright">MS-Bright</option>
                                  <option value="Nylon">Nylon</option>
                                  <option value="O-ring">O-ring</option>
                                  <option value="Rubber">Rubber</option>
                                  <option value="Silver Bar">Silver Bar</option>
                                  <option value="Spring">Spring</option>
                                  <option value="SS">SS</option>
                                  <option value="SS-202">SS-202</option>
                                  <option value="SS-304">SS-304</option>
                                  <option value="U-seal">U-seal</option>
                                  <option value="Wood">Wood</option>
                                  <option value="Wooden Box">Wooden Box</option>
                                  <option value="WPS">WPS</option>
                                </select>
                              </div>
                            
                            <div class="mb-3 col-auto" style="padding-right: 2px;padding-left: 2px;width:10%;">
                                <label for="subject">Weight (Kg)</label>
                                <input type="text" id="weight" class="form-control" name="weight" readonly/>
                            </div>
                            <div class="mb-3 col-auto" style="padding-right: 2px;padding-left: 2px;width:5%;">
                                <label for="subject">Qty</label>
                                <input type="text" id="sqty" class="form-control" name="sqty"/>
                            </div>
                            <div class="mb-3 col-auto" style="padding-right: 2px;padding-left: 2px;width:16%;">
                                <label for="resume">Photo</label>
                                <input type="file" class="form-control" id="photo" name="photo" width="40%">
                            </div>
                            <div class="mb-3 col d-none">
                                <label for="resume">Photo</label>
                                <input type="text" class="form-control" id="photo_name" name="photo_name">
                            </div>
                            <div class="mb-3 col-auto align-self-center" style="padding-right: 2px;padding-left: 2px;width:7%;">
                                <div class="d-grid">
                                    <label for="subject">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</label>
                                    <input data-repeater-delete type="button" class="btn btn-danger" value="Delete" />
                                </div>
                            </div>
                        </div>
    
                    </div>
                    <input data-repeater-create type="button" class="btn btn-success mt-3 mt-lg-0 add" value="Add" projectid="" />
                    <button name="submit" id="submit" class="btn btn-primary">Submit</button>
                </form>
                
            </div><!-- /.modal-content -->
        </div><!-- /.modal-dialog -->
        </div>
        <div class="modal fade bs-example-modal-center" id="exampleModalScrollable2" tabindex="-1" role="dialog" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Note</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p id="projectnote">
                    </div>
                </div><!-- /.modal-content -->
            </div><!-- /.modal-dialog -->
        </div>
        {{-- <div class="modal fade bs-example-modal-center show" id="exampleModalScrollable2" tabindex="-1" role="dialog" aria-labelledby="exampleModalScrollableTitle2" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content modal-dialog-centered" style="padding:5px;">
                    <div class="modal-header">
                        <h5 class="modal-title">Note</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                    {{-- <p></p> --}}
                    {{-- <p id="projectnote"></p>
                               
                    </div>
                </div><!-- /.modal-content -->
            </div><!-- /.modal-dialog -->
        </div> --}} 
@endsection
@section('script')
    <script>    
        var flag = false;
    </script>
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
    <script src="{{ URL::asset('/assets/libs/jquery.repeater/jquery.repeater.min.js') }}"></script>

<script src="{{ URL::asset('/assets/js/pages/form-repeater.int.js') }}"></script>
    
    {{-- <script src="//cdnjs.cloudflare.com/ajax/libs/select2/4.0.0/js/select2.min.js"></script> --}}


    <!-- form advanced init -->
    <!-- Datatable init js -->

    <script>
    window.calculateWeight = function(element) {
        var str = $(element).attr("name");
        var segments = str.split("[");
        if(segments[1] == undefined){
            var shapeValue ="shape";
            var lengthValue = "length";  // this will be "plates[0]"
            var widthValue = "width";  // this will be "plates[0]"
            var heightValue ="height"; 
            var unitValue ="unit"; // this will be "plates[0]"
            var materialValue = "material";  // this will be "plates[0]"
            var weightValue = "weight";  // this will be "plates[0]" 
        }else{
            
            var shapeValue = segments[0] + "[" + segments[1]+ "[shape]";
            var lengthValue = segments[0] + "[" + segments[1]+ "[length]";  // this will be "plates[0]"
            var widthValue = segments[0] + "[" + segments[1]+ "[width]";  // this will be "plates[0]"
            var heightValue = segments[0] + "[" + segments[1]+ "[height]";  // this will be "plates[0]"
            var unitValue = segments[0] + "[" + segments[1]+ "[unit]";  // this will be "plates[0]"
            var materialValue = segments[0] + "[" + segments[1]+ "[material]";  // this will be "plates[0]"
            var weightValue = segments[0] + "[" + segments[1]+ "[weight]";  // this will be "plates[0]"
        }

        var rowElement = $(element).closest('.row'); // Get the closest parent row element
        var shape = rowElement.find('.form-control[name="'+shapeValue+'"]').val();
        var length = rowElement.find('.form-control[name="'+lengthValue+'"]').val();
        var width = rowElement.find('.form-control[name="'+widthValue+'"]').val();
        var height = rowElement.find('.form-control[name="'+heightValue+'"]').val();
        var unit = rowElement.find('.form-control[name="'+unitValue+'"]').val();
        var material = rowElement.find('.form-control[name="'+materialValue+'"]').val();
        console.log(length,width,height,material);
        var density = 0;
        if(material == "Aluminium")
        {
            density = 2.71;
        }
        else if(material == "MS-Bright" || material == "MS-Black"){
            density = 7.81;
        }
        else if(material == "D-2")
        {
            density = 7.7;
        }
        else if(material == "EN8")
        {
            density = 7.85;
        }
        else if(material == "C45" || material == "WPS")
        {
            density = 7.80;
        }
        else if(material == "Derlin")
        {
            density = 1.41;
        }
        else if(material == "Nylon")
        {
            density = 1.14;
        }
        else if(material == "Brass")
        {
            density = 8.73;
        }
        else if(material == "Copper")
        {
            density = 8.96;
        }
        else if(material == "SS-304")
        {
            density = 7.93;
        }
        else if(material == "SS-202")
        {
            density = 7.86;
        }
        else if(material == "SS")
        {
            density = 0;
        }
        else if(material == "U-seal")
        {
            density = 0;
        }
        else if(material == "Rubber")
        {
            density = 0;
        }
        else{
            if(material == "Gun Metal")
            {
                density = 8.719;
            }
        }
        var unitvalue = 1
        if(unit =="cm")
        {
            unitvalue = 10;
        }
        else if(unit =="meter")
        {
            unitvalue = 1000;
        }
        else if(unit =="feet")
        {
            unitvalue = 304.8;
        }
        else 
        {
            if(unit =="inch")
            {
                unitvalue = 25.4;
            }
        }
        var weight = 0;
        var mm = 1000000;
        if (shape == "Rectangle") {
           
            weight = (density * (length*unitvalue) * (width*unitvalue) * (height*unitvalue))/mm;
            var height = rowElement.find('.form-control[name="'+heightValue+'"]').prop("disabled", false);
        }
        else if (shape == "Round") {
            
            weight = ((3.14*((width*unitvalue)/2)*((width*unitvalue)/2)*(length*unitvalue))*2.71)/mm;
            var height = rowElement.find('.form-control[name="'+heightValue+'"]').val('');
            var height = rowElement.find('.form-control[name="'+heightValue+'"]').prop("disabled", true);
        }
        else
        {
            if(shape == "Pipe") {
               
                weight = (((((width*unitvalue)) - (height*unitvalue))*(height*unitvalue)*3.14*(length*unitvalue))*2.71)/mm;
                var height = rowElement.find('.form-control[name="'+heightValue+'"]').prop("disabled", false);
            }
        }
        rowElement.find('.form-control[name="'+weightValue+'"]').val(weight.toFixed(3));
    }

    </script>
    
    <script>
        // $('.add').on('click', function(){
        //     setTimeout(() => {
        //         var projectid = $('#mainprojectid').val();
        //         var scanprojectid = $(this).attr('projectid');
        //         var firstInputValue = $('input[name="plates[0][subproject]"]').val();
        //         var splitedValue = firstInputValue.substring(scanprojectid.length);
        //         var count = $('input[name^="plates["][name$="[subproject]"]').length;
        //         var inputNumber = $('input[name^="plates["][subproject]').length; // get the number of existing input elements
        //         var lastInputElement = $('input[name^="plates["][name$="[subproject]"]').last();
        //         var originalValue = firstInputValue;
        //         // var prefix = scanprojectid;
        //         // var number =parseInt(splitedValue);
        //         // number = number+ (count-1);
        //         // var newValue = prefix + ('000' + number).slice(-3);
        //         // lastInputElement.val(newValue);

        //         //console.log(originalValue);
        //         var prefix = scanprojectid;
        //         //console.log(prefix);

        //         //var number =parseInt(splitedValue);
        //         var number = parseInt(splitedValue.replace("_", ""));
        //         //console.log(number);
        //         number = number+ (count-1);
        //         var newValue = prefix +"_"+ ('000' + number).slice(-3);
        //         //console.log(newValue);
        //         lastInputElement.val(newValue);
        //     }, 200);
        // });
        $('.add').on('click', function() {
    setTimeout(() => {
        var projectid = $('#mainprojectid').val();
        var scanprojectid = $(this).attr('projectid');
        var firstInputValue = $('input[name="plates[0][subproject]"]').val();

        // Find all subproject input elements
        var allInputs = $('input[name^="plates["][name$="[subproject]"]');

        // Find the last value numerically
        var maxNumber = 0;
        allInputs.each(function() {
            var value = $(this).val();
            if (value.startsWith(scanprojectid)) {
                // Extract the numeric suffix after scanprojectid
                var numericPart = value.substring(scanprojectid.length + 1); // +1 to skip the "_"
                var number = parseInt(numericPart) || 0;
                if (number > maxNumber) {
                    maxNumber = number;
                }
            }
        });

        // Calculate the next subproject value
        var nextNumber = maxNumber + 1;
        var newValue = scanprojectid + "_" + ('000' + nextNumber).slice(-3);

        console.log("projectid", projectid);
        console.log("scanprojectid", scanprojectid);
        console.log("firstInputValue", firstInputValue);
        console.log("Last Max Number:", maxNumber);
        console.log("New Value:", newValue);

        // Add the new value to the appropriate input field (this part depends on how you're adding the new input field)
        // Example: Add to the last input element
        $('input[name^="plates["][name$="[subproject]"]').last().val(newValue);
    }, 200);
});
        function addscandata(data){
            $("#cname").val("").trigger('change');
            $("#description").val("");
            $("#note").val("");
           // $("#worktype").val("");
            // var now = new Date();
            // var month = (now.getMonth() + 1);               
            // var day = now.getDate();
            // if (month < 10) 
            //     month = "0" + month;
            // if (day < 10) 
            //     day = "0" + day;
            // var today = day  + '/' + month + '/' + now.getFullYear();
            // $('#rdate').val($currentDateTime);

            // var now = new Date();
            // var month = (now.getMonth() + 1);               
            // var day = now.getDate()+2;
            // if (month < 10) 
            //     month = "0" + month;
            // if (day < 10) 
            //     day = "0" + day;
            // var today = day  + '/' + month + '/' + now.getFullYear();
            // $('#cdate').val($newDateTime);
            var inputs = document.getElementsByName("worktype");
            for (var i = 0; i < inputs.length; ++i) {
                // if (inputs[i].checked) {
                    
                // }
              //  if(inputs[i].value==data.worktype){
                    inputs[i].checked=false;
             //   }
            }
            $('#cdate').removeAttr("disabled");
            $('#rdate').removeAttr("disabled");
            $("#id").val("");
            $("#exampleModalScrollable").modal("toggle");
        }
         function Edit(data){
            if (typeof data === 'string') {
                var data = JSON.parse(data.replace(/'/g, '"'));
                
        // var data=JSON.parse(data.replaceAll("'","\""));
            //  $("exampleModalScrollableTitle").html("Edit Data");
            $("#cname").val(data.cname).trigger('change');
            $("#cname").prop('disabled', true);
            $("#description").val(data.description.replace("<>","\""));
            $("#note").val(data.note.replace("<>","\""));
           // $("#worktype").val(data.worktype);
            $("#rdate").val(data.rdate);
            $("#cdate").val(data.cdate);
            $("#id").val(data.id);
            var inputs = document.getElementsByName("worktype");
            for (var i = 0; i < inputs.length; ++i) {
                // if (inputs[i].checked) {
                    
                // }
                if(inputs[i].value==data.worktype){
                    inputs[i].checked=true;
                }
            }
            }
           
            $("#exampleModalScrollable").modal("toggle");
        }
    $('#exampleModalScrollable').on('submit', function() {
        $('#cname').prop('disabled', false);
    });
    </script>
    @if (Auth::user()->role==0)
    <script>
        $(function () { 
            $('body').on('click', '.image-name-cell', function() {
                var imageName = $(this).attr('data-image');
                console.log($(this));
                var imageUrl = '{{ asset("/")."images/subplates/" }}' + imageName; // Update the path to your images folder

                // Create the modal
                var modal = $('<div/>', {
                    'class': 'image-modal',
                    'css': {
                        'position': 'fixed',
                        'top': '0',
                        'left': '0',
                        'width': '100%',
                        'height': '100%',
                        'background-color': 'rgba(0, 0, 0, 0.7)',
                        'display': 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        'z-index': '9999'
                    }
                });

                // Create the image element
                var img = $('<img/>', {
                    'src': imageUrl,
                    'css': {
                        'max-width': '90%',
                        'max-height': '90%'
                    }
                });

                // Create the close button
                var closeButton = $('<button/>', {
                    'class': 'btn btn-sm btn-danger',
                    'type': 'button',
                    'text': 'Close',
                    'css': {
                        'position': 'absolute',
                        'top': '10px',
                        'right': '10px'
                    }
                }).on('click', function() {
                    $(this).closest('.image-modal').remove();
                });

                // Add the image and close button to the modal
                modal.append(img);
                modal.append(closeButton);

                // Add the modal to the body
                $('body').append(modal);
            });
            function createSubplateTable(subplates) {
                if(subplates.length>0){

                    var table = $('<table/>', {
                        'class': 'table table-bordered table-striped table-responsive'
                    }).css({
                        'max-width': '100%',
                        'width': '',
                        'padding':'10px',
                        'background-color': 'lavender',
                        'border-color': '#b2b2b2',
                    });
                    // Add table headers
                    var headers = [
                        { text: 'Plate Name', width: '100px' },
                        { text: 'Subproject ID', width: '180px' },
                        { text: 'Shape', width: '50px' },
                        { text: 'W (OD)', width: '50px' },
                        { text: 'H (ID)', width: '50px' },
                        { text: 'Length', width: '50px' },
                        { text: 'Weight', width: '70px' },
                        { text: 'Unit', width: '60px' },
                        { text: 'Material', width: '100px' },
                        { text: 'Qty', width: '20px' },
                        { text: 'Photo', width: '150px' },
                        { text: 'Design by', width: '50px' },
                        { text: 'Order by', width: '50px' },
                        { text: 'Received WorkBy', width: '50px' },
                        { text: 'Prog by', width: '50px' },
                        { text: 'Machine WorkBy', width: '50px' },
                        { text: 'Machine QCby', width: '50px' },
                        { text: 'DrillTap WorkBy', width: '70px' },
                        { text: 'Final QCby', width: '50px' },
                        { text: 'Packing WorkBy', width: '50px' },
                        { text: 'Packing Photo', width: '170px' },
                        { text: 'Location', width: '30px' }
                    ];
                    var headerRow = $('<tr/>');
                    // var headers = [
                    //     'Plate Name', 'Subproject ID ','Shape', 'Width', 'Height', 'Length', 'Weight', 'Unit','Material','Qty', 'Photo', 'Design By', 'Order By', 'Received Work By', 'Prog By', 'Machining Work By', 'Machining QC By','DrillTap Work By', 'Final QC By', 'Packing Work By', 'Packing Photo','Location'];
                    headers.forEach(function(headerInfo) {
                        var headerCell = $('<th/>').text(headerInfo.text).css('padding', '2px').css('width', headerInfo.width);
                        headerRow.append(headerCell);
                    });

                    // headers.forEach(function(headerText) {
                    //     var headerCell = $('<th/>').text(headerText).css('padding', '2px');
                    //     headerRow.append(headerCell);
                    // });
    
                    table.append(headerRow);
    
                    // console.log(subplates);
                    subplates.forEach(function(subplate) {
                        var row = $('<tr/>');
                        flag = true;
                        var sub_id = '';
                        var platename = '';
                        // Iterate through key-value pairs of the subplate object
                        var dropdownfieldarray = ['design_by','order_by','received_workby','received_qcby','vmc_workby','vmc_qcby','drilltap_workby','final_qcby','packing_workby'];
                        var finalqc=0;
                        var packingwork=0;
                        Object.entries(subplate).forEach(function([key, value]) {
                            if(key=='id')
                            {
                                sub_id = value;
                            }

                            if(key=="platename"){
                                platename = value;
                            }
                            
                            if(key != 'created_at' && key != 'updated_at' && key != 'id' && key != 'projectid'){
                                if ('photo' == key || 'packing_photo' == key) {
                                    if(value==null || value==''){
                                        var image_element = '<input type="file" class="form-control updatesubproject" platename="'+platename+'" sub_id="'+sub_id+'" id="'+key+'_'+id+'" name="'+key+'_'+id+'" width="40%">';
                                        var cell = $('<td/>').html(image_element);
                                    }else{
                                        var cell = $('<td/>').html(('photo' == key) ? '<button class="btn btn-outline-primary waves-effect waves-light btn-sm mr-2 image-name-cell" style="padding: 1px; padding-right: 10px;padding-left: 10px;border-width: thin;!important;margin-right:10px" title="View Image" data-image="'+value+'"><i class="fa fa-eye"></i></button><button class="btn btn-outline-primary waves-effect waves-light btn-sm deletesubprojectimage" style="padding: 1px; padding-right: 10px;padding-left: 10px;border-width: thin;" title="Delete Image" onclick="confirm(`Are you sure you want to delete?`)"  platename="'+platename+'" sub_id="'+sub_id+'" id="'+key+'_'+id+'" name="'+key+'_'+id+'"><i class="fa fa-trash"></i></button>' : '<button class="btn btn-outline-primary waves-effect waves-light btn-sm mr-2 image-name-cell" style="padding: 1px; padding-right: 10px;padding-left: 10px;border-width: thin;!important;margin-right:10px" title="View Image" data-image="'+value+'"><i class="fa fa-eye"></i></button><button class="btn btn-outline-primary waves-effect waves-light btn-sm deletesubprojectimage" style="padding: 1px; padding-right: 10px;padding-left: 10px;border-width: thin;" title="Delete Image" onclick="confirm(`Are you sure you want to delete?`)"  platename="'+platename+'" sub_id="'+sub_id+'" id="'+key+'_'+id+'" name="'+key+'_'+id+'"><i class="fa fa-trash"></i></button>').css({
                                            'cursor': 'pointer',
                                            'text-decoration': ('photo' == key) ? 'underline' : 'none',
                                            'color': ('photo' == key) ? '#007bff' : 'inherit'
                                        });
                                    }
                                } else {
                                    var image_fieldarray = ['packing_photo'];
                                  
                                    if($.inArray(key,dropdownfieldarray) !== -1){
                                        
                                        if(key=="final_qcby"){
                                            if(value!="" && value!=null && value!=undefined){
                                                packingwork++;
                                            }
                                            var dropdown_element  = "<select name='"+key+"' id='"+key+"_"+sub_id+"' class='form-control updatesubproject' sub_id='"+sub_id+"' "+(finalqc==7?'':'disabled')+" placeholder='select user' style='padding-right:10px;padding-left:10px;padding: 1px;border-width: thin;border: 1px solid #c2c2c2;!important'><option value=''>Select</option>@foreach($userdata as $udata) <option value='{{$udata->id}}'>{{$udata->initials}}</option> @endforeach</select>";
                                            var cell = $('<td/>').html(dropdown_element);
                                            var elementid = "#"+key+"_"+sub_id;
                                            setTimeout(function(){
                                                $(elementid).val(value).change();
                                            },100);
                                        }else if(key=="packing_workby"){
                                            var dropdown_element  = "<select name='"+key+"' id='"+key+"_"+sub_id+"' class='form-control updatesubproject' sub_id='"+sub_id+"' "+(packingwork==8?'':'disabled')+" placeholder='select user' style='padding-right:10px;padding-left:10px;padding: 1px;border-width: thin;border: 1px solid #c2c2c2;!important'><option value=''>Select</option>@foreach($userdata as $udata) <option value='{{$udata->id}}'>{{$udata->initials}}</option> @endforeach</select>";
                                            var cell = $('<td/>').html(dropdown_element);
                                            var elementid = "#"+key+"_"+sub_id;
                                            setTimeout(function(){
                                                $(elementid).val(value).change();
                                            },100);
                                        }else{
                                            if(value!="" && value!=null && value!=undefined){
                                                finalqc++;
                                                packingwork++;
                                            }
                                            var dropdown_element  = "<select name='"+key+"' id='"+key+"_"+sub_id+"' class='form-control updatesubproject' sub_id='"+sub_id+"' placeholder='select user' style='padding-right:10px;padding-left:10px;padding: 1px;border-width: thin;border: 1px solid #c2c2c2;!important'><option value=''>Select</option>@foreach($userdata as $udata) <option value='{{$udata->id}}'>{{$udata->initials}}</option> @endforeach</select>";
                                            var cell = $('<td/>').html(dropdown_element);
                                            var elementid = "#"+key+"_"+sub_id;
                                            setTimeout(function(){
                                                $(elementid).val(value).change();
                                            },100);
                                        }
                                        
                                    }else{
                                        var cell = $('<td/>').text(value).css('text-align', 'center');
                                    }
                                }  
                                row.append(cell);
                            }
                        });
                        table.append(row);
                        setTimeout(function(){
                            flag = false;
                        },200);
                    });
    
                    return table;
                }else{
                    var table = $('<table/>', {
                        'class': 'table table-bordered table-striped table-responsive'
                    }).css({
                        'max-width': '100%',
                        'width': 'auto',
                        'padding':'10px',
                    });
                    // Add table headers
                    var headerRow = $('<tr/>');
                    // var headers = [
                    //     'Plate Name', 'Subproject ID', 'Shape', 'Width', 'Height', 'Length','Weight',  'Unit', 'Material','Qty', 'Photo', 'Design By', 'Order By', 'Received Work By', 'Prog By', 'Machining Work By', 'Machining QC By', 'DrillTap Work By','Final QC By', 'Packing Work By', 'Packing Photo','Location'];
                    var headers = [
                        { text: 'Plate Name', width: '100px' },
                        { text: 'Subproject ID', width: '180px' },
                        { text: 'Shape', width: '50px' },
                        { text: 'W (OD)', width: '50px' },
                        { text: 'H (ID)', width: '50px' },
                        { text: 'Length', width: '50px' },
                        { text: 'Weight', width: '70px' },
                        { text: 'Unit', width: '60px' },
                        { text: 'Material', width: '100px' },
                        { text: 'Qty', width: '20px' },
                        { text: 'Photo', width: '150px' },
                        { text: 'Design by', width: '50px' },
                        { text: 'Order by', width: '50px' },
                        { text: 'Received WorkBy', width: '50px' },
                        { text: 'Prog by', width: '50px' },
                        { text: 'Machine WorkBy', width: '50px' },
                        { text: 'Machine QCby', width: '50px' },
                        { text: 'DrillTap WorkBy', width: '70px' },
                        { text: 'Final QCby', width: '50px' },
                        { text: 'Packing WorkBy', width: '50px' },
                        { text: 'Packing Photo', width: '170px' },
                        { text: 'Location', width: '30px' }
                    ];
                    // headers.forEach(function(headerText) {
                    //     var headerCell = $('<th/>').text(headerText).css('padding', '2px');;
                    //     headerRow.append(headerCell);
                    // });
                    headers.forEach(function(headerInfo) {
                        var headerCell = $('<th/>').text(headerInfo.text).css('padding', '2px').css('width', headerInfo.width);
                        headerRow.append(headerCell);
                    });
                    var tbody = $('<tr colspan="20"><td>No data found</td></tr>').                    
    
                    table.append(headerRow);
                                            
                    return table;
                }
            }
            $('#datatablescan tbody').on('click', 'td.subplate-toggle', function() {
                var scanRow = $(this).closest('tr');
                var scanData = scanTable.row(scanRow).data();
                var mainTableColumns = 20; // Set this to the number of columns in your main table

                if (scanRow.hasClass('shown') && scanRow.next().hasClass('subplate-row')) {
                    // Hide the nested Subplate table
                    scanRow.next().remove();
                    scanRow.removeClass('shown');
                } else {
                    // Show the nested Subplate table
                    var subplateRow = $('<tr/>', {
                        'class': 'subplate-row'
                    })

                    var subplateCell = $('<td/>', {
                        'colspan': mainTableColumns
                    });

                    scanRow.after(subplateRow);
                    scanRow.addClass('shown');
                    scanData.subplates.forEach(function(subplate) {
                        subplate.platename = $('<div/>').html(subplate.platename).text();
                        // Add other decoding as needed for other fields
                    });
                    subplateCell.append(createSubplateTable(scanData.subplates));
                    subplateRow.append(subplateCell);

                }
            });
           var scanTable = $('#datatablescan').DataTable({
                order:[[5, 'desc']],
                processing: true,
                 serverSide: true,
                 pageLength:50,
                 ajax: "{{route('getscandata')}}",
                 columns: [
                        {data : {'_': 'rdate.display', 'sort': 'rdate.timestamp'}, name: 'rdate', orderable: true},
                        // {data : {'_': 'cdate.display', 'sort': 'cdate.timestamp'}, name: 'cdate', orderable: true},                
                    //   {data: 'scan_by', name: 'scan_by'},
                        {data: 'cname', name: 'cname',orderable: true, 
                            searchable: true},
                        {data: 'worktype', name: 'worktype',orderable: true, 
                            searchable: true},
                        {data: 'description', name: 'description',orderable: true, 
                            searchable: true},
                        {   
                            data: 'note', 
                            name: 'note',  
                            "className": "text-center",           
                            orderable: false, 
                            searchable: false
                        },
                        // {data: '', name: '',orderable: true, 
                        //      searchable: true},
                        {data: 'projectid', name: 'projectid',orderable: true, 
                         searchable: true},
                        
                        // {   
                        //     data: 'mowork', 
                        //     name: 'mowork',  
                        //     "className": "text-center",           
                        //     orderable: false, 
                        //     searchable: false
                        // },
                        //  {   
                        //     data: 'mwork', 
                        //     name: 'mwork',  
                        //     "className": "text-center",           
                        //     orderable: false, 
                        //     searchable: false
                        // },
                        // {   
                        //     data: 'vwork', 
                        //     name: 'vwork',  
                        //     "className": "text-center",           
                        //     orderable: false, 
                        //     searchable: false
                        // },
                        // {   
                        //     data: 'dwork', 
                        //     name: 'dwork',  
                        //     "className": "text-center",           
                        //     orderable: false, 
                        //     searchable: false
                        // },
                        // {   
                        //     data: 'fwork', 
                        //     name: 'fwork',  
                        //     "className": "text-center",           
                        //     orderable: false, 
                        //     searchable: false
                        // },
                        // {   
                        //     data: 'pwork', 
                        //     name: 'pwork',  
                        //     "className": "text-center",           
                        //     orderable: false, 
                        //     searchable: false
                        // },
                        // {   
                        //      data: 'scan_by', 
                        //      name: 'scan_by',             
                        //      orderable: false, 
                        //      searchable: false
                        //  },
                        //  {   
                        //      data: 'modeldesign_by', 
                        //      name: 'modeldesign_by ',             
                        //      orderable: false, 
                        //      searchable: false
                        //  },
                        //  {   
                        //      data: 'qc_by', 
                        //      name: 'qc_by',             
                        //      orderable: false, 
                        //      searchable: false
                        //  },
                        //   {data: 'modeldesign_by', name: 'modeldesign_by'},
                        //   {data: 'qc_by', name: 'qc_by'},
                        {   
                            data: 'mail_done', 
                            name: 'mail_done',  
                            "className": "text-center",orderable: false, 
                            searchable: false
                        },
                    //   {data: 'mail_done', name: 'mail_done'},
                        
                        
                        // {data: 'sm_hr', name: 'sm_hr', orderable: true, searchable: true},
                        // {data: 'usm_hr', name: 'usm_hr', orderable: true, searchable: true},  
                        {data: 'm_hr', name: 'm_hr', orderable: true, searchable: true},
                         {data: 'subnote', name: 'subnote', orderable: true, searchable: true},                
                        {data: 'action', name: 'action', orderable: false, searchable: false},
                        {data: "subplates", name:'subplates',visible: false , searchable: false },
                        {data: null,defaultContent: "",className: "subplate-toggle", orderable: false,render: function(data, type, row, meta) {
                                // Render a custom button to toggle the Subplate table
                                if(data.subplates.length>0){
                                    return '<button class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;" title="View Plates"><i class="fa fa-eye"></i></button>';
                                }else{
                                    return '';
                                }
                            }
                        },
                 ]
             });
             
        });
    </script>
    @else
    <script>
             $(function () { 
            $('body').on('click', '.image-name-cell', function() {
                var imageName = $(this).attr('data-image');
                // console.log($(this));
                var imageUrl = '{{ asset("/")."images/subplates/" }}' + imageName; // Update the path to your images folder

                // Create the modal
                var modal = $('<div/>', {
                    'class': 'image-modal',
                    'css': {
                        'position': 'fixed',
                        'top': '0',
                        'left': '0',
                        'width': '100%',
                        'height': '100%',
                        'background-color': 'rgba(0, 0, 0, 0.7)',
                        'display': 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        'z-index': '9999'
                    }
                });

                // Create the image element
                var img = $('<img/>', {
                    'src': imageUrl,
                    'css': {
                        'max-width': '90%',
                        'max-height': '90%'
                    }
                });

                // Create the close button
                var closeButton = $('<button/>', {
                    'class': 'btn btn-sm btn-danger',
                    'type': 'button',
                    'text': 'Close',
                    'css': {
                        'position': 'absolute',
                        'top': '10px',
                        'right': '10px'
                    }
                }).on('click', function() {
                    $(this).closest('.image-modal').remove();
                });

                // Add the image and close button to the modal
                modal.append(img);
                modal.append(closeButton);

                // Add the modal to the body
                $('body').append(modal);
            });
            function createSubplateTable(subplates) {
                if(subplates.length>0){

                    var table = $('<table/>', {
                        'class': 'table table-bordered table-striped table-responsive'
                    }).css({
                        'max-width': '100%',
                        'width': '',
                        'padding':'10px',
                        'background-color': 'lavender',
                        'border-color': '#b2b2b2',
                    });
                    // Add table headers
                    var headerRow = $('<tr/>');
                    // var headers = [
                    //     'Plate Name', 'Subproject ID ', 'Shape', 'Width', 'Height', 'Length','Weight', 'Unit', 'Material','Qty', 'Photo', 'Design By', 'Order By', 'Received Work By', 'Prog By', 'Machining Work By', 'Machining QC By','DrillTap Work By', 'Final QC By', 'Packing Work By', 'Packing Photo','Location'];
                     
                    var headers = [
                        { text: 'Plate Name', width: '100px' },
                        { text: 'Subproject ID', width: '180px' },
                        { text: 'Shape', width: '50px' },
                        { text: 'W (OD)', width: '50px' },
                        { text: 'H (ID)', width: '50px' },
                        { text: 'Length', width: '50px' },
                        { text: 'Weight', width: '70px' },
                        { text: 'Unit', width: '60px' },
                        { text: 'Material', width: '100px' },
                        { text: 'Qty', width: '20px' },
                        { text: 'Photo', width: '150px' },
                        { text: 'Design by', width: '50px' },
                        { text: 'Order by', width: '50px' },
                        { text: 'Received WorkBy', width: '50px' },
                        { text: 'Prog by', width: '50px' },
                        { text: 'Machine WorkBy', width: '50px' },
                        { text: 'Machine QCby', width: '50px' },
                        { text: 'DrillTap WorkBy', width: '70px' },
                        { text: 'Final QCby', width: '50px' },
                        { text: 'Packing WorkBy', width: '50px' },
                        { text: 'Packing Photo', width: '170px' },
                        { text: 'Location', width: '30px' }
                    ];
                    // headers.forEach(function(headerText) {
                    //     var headerCell = $('<th/>').text(headerText).css('padding', '2px');
                    //     headerRow.append(headerCell);
                    // });
                    headers.forEach(function(headerInfo) {
                        var headerCell = $('<th/>').text(headerInfo.text).css('padding', '2px').css('width', headerInfo.width);
                        headerRow.append(headerCell);
                    });
                    table.append(headerRow);
    
                    // console.log(subplates);
                    subplates.forEach(function(subplate) {
                        var row = $('<tr/>');
                        flag = true;
                        var sub_id = '';
                        var platename = '';
                        // Iterate through key-value pairs of the subplate object
                        var dropdownfieldarray = ['design_by','order_by','received_workby','received_qcby','vmc_workby','vmc_qcby','drilltap_workby','final_qcby','packing_workby'];
                        Object.entries(subplate).forEach(function([key, value]) {
                            if(key=='id')
                            {
                                sub_id = value;
                            }

                            if(key=="platename"){
                                platename = value;
                            }
                            if(key != 'created_at' && key != 'updated_at' && key != 'id' && key != 'projectid'){
                                if ('photo' == key || 'packing_photo' == key) {
                                    if(value==null || value==''){
                                        var image_element = '<input type="file" class="form-control updatesubproject" platename="'+platename+'" sub_id="'+sub_id+'" id="'+key+'_'+id+'" name="'+key+'_'+id+'" width="40%">';
                                        var cell = $('<td/>').html(image_element);
                                    }else{
                                        var cell = $('<td/>').html(('photo' == key) ? '<button class="btn btn-outline-primary waves-effect waves-light btn-sm mr-2 image-name-cell" style="padding: 1px; padding-right: 10px;padding-left: 10px;border-width: thin;!important;margin-right:10px" title="View Image" data-image="'+value+'"><i class="fa fa-eye"></i></button><button class="btn btn-outline-primary waves-effect waves-light btn-sm deletesubprojectimage" style="padding: 1px; padding-right: 10px;padding-left: 10px;border-width: thin;" title="Delete Image" onclick="confirm(`Are you sure you want to delete?`)"  platename="'+platename+'" sub_id="'+sub_id+'" id="'+key+'_'+id+'" name="'+key+'_'+id+'"><i class="fa fa-trash"></i></button>' : '<button class="btn btn-outline-primary waves-effect waves-light btn-sm mr-2 image-name-cell" style="padding: 1px; padding-right: 10px;padding-left: 10px;border-width: thin;!important;margin-right:10px" title="View Image" data-image="'+value+'"><i class="fa fa-eye"></i></button><button class="btn btn-outline-primary waves-effect waves-light btn-sm deletesubprojectimage" style="padding: 1px; padding-right: 10px;padding-left: 10px;border-width: thin;" title="Delete Image" onclick="confirm(`Are you sure you want to delete?`)"  platename="'+platename+'" sub_id="'+sub_id+'" id="'+key+'_'+id+'" name="'+key+'_'+id+'"><i class="fa fa-trash"></i></button>').css({
                                            'cursor': 'pointer',
                                            'text-decoration': ('photo' == key) ? 'underline' : 'none',
                                            'color': ('photo' == key) ? '#007bff' : 'inherit'
                                        });
                                    }
                                } else {
                                    var image_fieldarray = ['packing_photo'];
                                    if($.inArray(key,dropdownfieldarray) !== -1){
                                        var dropdown_element  = "<select name='"+key+"' id='"+key+"_"+sub_id+"' class='form-control updatesubproject' sub_id='"+sub_id+"' placeholder='select user' style='padding-right:10px;padding-left:10px;padding: 1px;border-width: thin;border: 1px solid #c2c2c2;!important'><option value=''>Select</option>@foreach($userdata as $udata) <option value='{{$udata->id}}'>{{$udata->initials}}</option> @endforeach</select>";
                                        var cell = $('<td/>').html(dropdown_element);
                                        var elementid = "#"+key+"_"+sub_id;
                                        setTimeout(function(){
                                            $(elementid).val(value).change();
                                        },100);
                                    }else{
                                        var cell = $('<td/>').text(value).css('text-align', 'center');
                                    }
                                }  
                                row.append(cell);
                            }
                        });
                        table.append(row);
                        setTimeout(function(){
                            flag = false;
                        },200);
                    });
    
                    return table;
                }else{
                    var table = $('<table/>', {
                        'class': 'table table-bordered table-striped table-responsive'
                    }).css({
                        'max-width': '100%',
                        'width': 'auto',
                        'padding':'10px',
                    });
                    // Add table headers
                    var headerRow = $('<tr/>');
                    // var headers = [
                    //     'Plate Name', 'Subproject ID', 'Shape', 'Width', 'Height', 'Length', 'Weight', 'Unit', 'Material','Qty', 'Photo', 'Design By', 'Order By', 'Received Work By', 'Prog By', 'Machining Work By', 'Machining QC By', 'DrillTap Work By','Final QC By', 'Packing Work By', 'Packing Photo','Location'];
    
                    var headers = [
                        { text: 'Plate Name', width: '100px' },
                        { text: 'Subproject ID', width: '180px' },
                        { text: 'Shape', width: '50px' },
                        { text: 'W (OD)', width: '50px' },
                        { text: 'H (ID)', width: '50px' },
                        { text: 'Length', width: '50px' },
                        { text: 'Weight', width: '70px' },
                        { text: 'Unit', width: '60px' },
                        { text: 'Material', width: '100px' },
                        { text: 'Qty', width: '20px' },
                        { text: 'Photo', width: '150px' },
                        { text: 'Design by', width: '50px' },
                        { text: 'Order by', width: '50px' },
                        { text: 'Received WorkBy', width: '50px' },
                        { text: 'Prog by', width: '50px' },
                        { text: 'Machine WorkBy', width: '50px' },
                        { text: 'Machine QCby', width: '50px' },
                        { text: 'DrillTap WorkBy', width: '70px' },
                        { text: 'Final QCby', width: '50px' },
                        { text: 'Packing WorkBy', width: '50px' },
                        { text: 'Packing Photo', width: '170px' },
                        { text: 'Location', width: '30px' }
                    ];
                    // headers.forEach(function(headerText) {
                    //     var headerCell = $('<th/>').text(headerText).css('padding', '2px');;
                    //     headerRow.append(headerCell);
                    // });
                    headers.forEach(function(headerInfo) {
                        var headerCell = $('<th/>').text(headerInfo.text).css('padding', '2px').css('width', headerInfo.width);
                        headerRow.append(headerCell);
                    });
                    var tbody = $('<tr colspan="20"><td>No data found</td></tr>').                    
    
                    table.append(headerRow);
                                            
                    return table;
                }
            }
            $('#datatablescan tbody').on('click', 'td.subplate-toggle', function() {
                var scanRow = $(this).closest('tr');
                var scanData = scanTable.row(scanRow).data();
                var mainTableColumns = 20; // Set this to the number of columns in your main table

                if (scanRow.hasClass('shown') && scanRow.next().hasClass('subplate-row')) {
                    // Hide the nested Subplate table
                    scanRow.next().remove();
                    scanRow.removeClass('shown');
                } else {
                    // Show the nested Subplate table
                    var subplateRow = $('<tr/>', {
                        'class': 'subplate-row'
                    })

                    var subplateCell = $('<td/>', {
                        'colspan': mainTableColumns
                    });

                    scanRow.after(subplateRow);
                    scanRow.addClass('shown');
                    scanData.subplates.forEach(function(subplate) {
                        subplate.platename = $('<div/>').html(subplate.platename).text();
                        // Add other decoding as needed for other fields
                    });
                    subplateCell.append(createSubplateTable(scanData.subplates));
                    subplateRow.append(subplateCell);

                }
            });
           var scanTable = $('#datatablescan').DataTable({
                order:[[0, 'desc'],[1,'desc']],
                processing: true,
                 serverSide: true,
                 pageLength:50,
                 ajax: "{{route('getscandata')}}",
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
                        {   
                            data: 'note', 
                            name: 'note',  
                            "className": "text-center",           
                            orderable: false, 
                            searchable: false
                        },
                        // {data: '', name: '',orderable: true, 
                        //      searchable: true},
                        {data: 'projectid', name: 'projectid',orderable: true, 
                         searchable: true},
                        
                        // {   
                        //     data: 'mowork', 
                        //     name: 'mowork',  
                        //     "className": "text-center",           
                        //     orderable: false, 
                        //     searchable: false
                        // },
                        //  {   
                        //     data: 'mwork', 
                        //     name: 'mwork',  
                        //     "className": "text-center",           
                        //     orderable: false, 
                        //     searchable: false
                        // },
                        // {   
                        //     data: 'vwork', 
                        //     name: 'vwork',  
                        //     "className": "text-center",           
                        //     orderable: false, 
                        //     searchable: false
                        // },
                        // {   
                        //     data: 'dwork', 
                        //     name: 'dwork',  
                        //     "className": "text-center",           
                        //     orderable: false, 
                        //     searchable: false
                        // },
                        // {   
                        //     data: 'fwork', 
                        //     name: 'fwork',  
                        //     "className": "text-center",           
                        //     orderable: false, 
                        //     searchable: false
                        // },
                        // {   
                        //     data: 'pwork', 
                        //     name: 'pwork',  
                        //     "className": "text-center",           
                        //     orderable: false, 
                        //     searchable: false
                        // },
                        // {   
                        //      data: 'scan_by', 
                        //      name: 'scan_by',             
                        //      orderable: false, 
                        //      searchable: false
                        //  },
                        //  {   
                        //      data: 'modeldesign_by', 
                        //      name: 'modeldesign_by ',             
                        //      orderable: false, 
                        //      searchable: false
                        //  },
                        //  {   
                        //      data: 'qc_by', 
                        //      name: 'qc_by',             
                        //      orderable: false, 
                        //      searchable: false
                        //  },
                        //   {data: 'modeldesign_by', name: 'modeldesign_by'},
                        //   {data: 'qc_by', name: 'qc_by'},
                        {   
                            data: 'mail_done', 
                            name: 'mail_done',  
                            "className": "text-center",orderable: false, 
                            searchable: false
                        },
                    //   {data: 'mail_done', name: 'mail_done'},
                        
                        
                        // {data: 'sm_hr', name: 'sm_hr', orderable: true, searchable: true},
                        // {data: 'usm_hr', name: 'usm_hr', orderable: true, searchable: true},  
                        {data: 'm_hr', name: 'm_hr', orderable: true, searchable: true},
                        //  {data: 'amount', name: 'amount', orderable: false, searchable: false},                
                        {data: 'action', name: 'action', orderable: false, searchable: false},
                        {data: "subplates", name:'subplates',visible: false , searchable: false },
                        {data: null,defaultContent: "",className: "subplate-toggle", orderable: false,render: function(data, type, row, meta) {
                                // Render a custom button to toggle the Subplate table
                                if(data.subplates.length>0){
                                    return '<button class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;" title="View Plates"><i class="fa fa-eye"></i></button>';
                                }else{
                                    return '';
                                }
                            }
                        },
                 ]
             });
             
        });
    </script>
    @endif   
    <script type="text/javascript">
        function changestatusscan(field,value,id){
        //    var scan=document.getElementById("scanby_"+id).value;          
            $.ajax({
               type:'POST',
               url:"{{route('scanning.updatestatusscan')}}",
               data: {_token: "{{ csrf_token() }}", field:field,value:value,id:id}, 
               success:function(data) {
                  data=JSON.parse(data);
                  //console.log(data)
                $("#scantotal").html(data.scantotal);
                $("#scanby").html(data.scanby);
                //$("#designby").html(data.designby);
                $("#qcby").html(data.qcby);
                $("#printtotal").html(data.printtotal);
                $("#printby").html(data.printby);
                $("#printqc").html(data.printqc);
               }            
            });
        }
        
        function changestatus(val,id){
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
            val.checked=false;
            $.ajax({
               type:'POST',
               url:"{{route('scanning.updatestatus')}}",
               data: {_token: "{{ csrf_token() }}", status:"registered",id:id},
               success:function(data) {
                
                  data=JSON.parse(data);
                  if(data.status){
                    val.checked=true;
                    $("#scan_"+id).remove();
                    $("#scantotal").html(data.scantotal);
                    window.location.reload()
                  }else{
                    $('#formError'+id).html(data.message);
                    val.checked=false;
                    
                  }
               }
            });
        }
        function addprintdata(data){
        // var data=JSON.parse(data.replaceAll("'","\""));
            // $("modalHeading").html("Edit Data");
            $("#select2").val("").trigger('change');
            $("#description1").val("");  
            // var now = new Date();
            // var month = (now.getMonth() + 1);               
            // var day = now.getDate();
            // if (month < 10) 
            //     month = "0" + month;
            // if (day < 10) 
            //     day = "0" + day;
            // var today = day  + '/' + month + '/' + now.getFullYear();
            // $('#tdate1').val(today);
            // var now = new Date();
            // var month = (now.getMonth() + 1);               
            // var day = now.getDate()+2;
            // if (month < 10) 
            //     month = "0" + month;
            
            // if (day < 10) 
            //     day = "0" + day;
            // var today = day  + '/' + month + '/' + now.getFullYear();
            // $('#cdate1').val(today);
            $("#pid").val("");
            $("#gram").val("");
            $("#time").val("");
            $("#exampleModalScrollable1").modal("toggle");
        }
        function Edit1(data){
        var data=JSON.parse(data.replaceAll("'","\""));
            // $("modalHeading").html("Edit Data");
            $("#select2").val(data.cname).trigger('change');
            $("#description1").val(data.description);
            $("#tdate1").val(data.tdate).prop('disabled', true);
            $("#cdate1").val(data.cdate).prop('disabled', true);
            $("#pid").val(data.id);
            $("#gram").val(data.gram);
            $("#time").val(data.hr);
            $("#exampleModalScrollable1").modal("toggle");
        }
    </script> 
        
    <script type="text/javascript">
          
           function changestatus1print(field,value,id){
            // var print=document.getElementById("printby_"+id).value;         
            $.ajax({
               type:'POST',
               url:"{{route('printing.updatestatusprintby')}}",
               data: {_token: "{{ csrf_token() }}", field:field,value:value,id:id},
               success:function(data) {
                  data=JSON.parse(data);
                $("#printtotal").html(data.printtotal);
                $("#printby").html(data.printby);
                $("#printqc").html(data.printqc);
               }    
            });
            }
        // function changestatus1qc(id){
        //     var qc=document.getElementById("qcby_"+id).value;  
        //     $.ajax({
        //        type:'POST',
        //        url:"{{route('printing.updatestatusqcby')}}",
        //        data: {_token: "{{ csrf_token() }}", qc:qc,id:id},
        //     });
        // }
        
           function changestatus1(id){
        
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
               url:"{{route('printing.updatestatusprint')}}",
               data: {_token: "{{ csrf_token() }}", status:"registered",id:id},
               success:function(data) {
                  $("#print_"+id).remove();
                  data=JSON.parse(data);
                $("#printtotal").html(data.printtotal);
               }
            });
        }
       
            $(document).ready(function() {
                $(".select2").select2({
                minimumInputLength: 3,
                dropdownParent: $("#exampleModalScrollable")
            });
            $("#select2").select2({
                minimumInputLength: 3,
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
    </script> 
        <script>
            var repeatervar = $('.repeater_new').repeater({
                    defaultValues: {
                        'textarea-input': 'foo',
                        'text-input': 'bar',
                        'select-input': 'B',
                        'checkbox-input': ['A', 'B'],
                        'radio-input': 'B'
                    },
                    show: function () {
                        $(this).slideDown();
                    },
                    hide: function (deleteElement) {
                        if(confirm('Are you sure you want to delete this element?')) {
                            $(this).slideUp(deleteElement);
                        }
                    },
                    ready: function (setIndexes) {

                    }
            });
            var datarepeaterhtml = $('#dataRepeaterId').html();
            function openModal(projectid,actualid) {
                // console.log(datarepeaterhtml);
                $('.add').attr('projectid', projectid);
                $('#dataRepeaterId').html('');
                $('#dataRepeaterId').html(datarepeaterhtml);
                // repeatervar.repeater('destroy');
                // repeatervar.init();
                // $('#addPlates')[0].reset();
                $.ajax({
                    url: '{{route("getsubplate")}}',
                    data: {
                        projectid:actualid,
                        _token: "{{csrf_token()}}"
                    },
                    type: 'POST',
                    dataType: 'json',
                    success: function(data) {
                        // Handle the response data here
                        //console.log(data);
                        setTimeout(() => {
                        $.each(data, function(index, plate) {
                            // Clone the HTML template for the plate
                            var $plateTemplate = $('[data-repeater-item]').first().clone();
                            // Update the input values with data from the plate
                            if (plate.shape === 'Round') {
                                $plateTemplate.find('#height').prop('disabled', true);
                            } else {
                                $plateTemplate.find('#height').prop('disabled', false);
                            }
                            $plateTemplate.find('#platename').val(plate.platename);
                            $plateTemplate.find('#subproject').val(plate.subprojectid);
                            $plateTemplate.find('#width').val(plate.width);
                            $plateTemplate.find('#height').val(plate.height);
                            $plateTemplate.find('#length').val(plate.length);
                            $plateTemplate.find('#unit').val(plate.unit);
                            $plateTemplate.find('#shape').val(plate.shape);
                            $plateTemplate.find('#material').val(plate.material);
                            $plateTemplate.find('#weight').val(plate.weight);
                            $plateTemplate.find('#sqty').val(plate.sqty);
                            $plateTemplate.find('#photo_name').val(plate.photo);
                            $plateTemplate.find('[name="plates[' + index + '][designing]"]').val(plate.design_by);
                            $plateTemplate.find('[name="plates[' + index + '][photo_name]"]').val(plate.photo);
                            $plateTemplate.find('[name="plates[' + index + '][MO]"]').val(plate.order_by);
                            $plateTemplate.find('[name="plates[' + index + '][MRinit2]"]').val(plate.received_qcby);
                            $plateTemplate.find('[name="plates[' + index + '][VMCinit1]"]').val(plate.vmc_workby);
                            $plateTemplate.find('[name="plates[' + index + '][VMCinit2]"]').val(plate.vmc_qcby);
                            $plateTemplate.find('[name="plates[' + index + '][DTinit1]"]').val(plate.driltap_workby);
                            $plateTemplate.find('[name="plates[' + index + '][DTinit2]"]').val(plate.driltap_qcby);
                            $plateTemplate.find('[name="plates[' + index + '][FQC]"]').val(plate.final_qcby);
                            $plateTemplate.find('[name="plates[' + index + '][packinginit1]"]').val(plate.packing_workby);
                            $('[name="designing"]').attr('disabled', true);
                            $('[name="MO"]').attr('disabled', true);
                            $('[name="MRinit1"]').attr('disabled', true);
                            $('[name="MRinit2"]').attr('disabled', true);
                            $('[name="VMCinit1"]').attr('disabled', true);
                            $('[name="VMCinit2"]').attr('disabled', true);
                            $('[name="DTinit1"]').attr('disabled', true);
                            $('[name="DTinit2"]').attr('disabled', true);
                            $('[name="FQC"]').attr('disabled', true);
                            $('[name="packinginit1"]').attr('disabled', true);
                            // Append the cloned template to the HTML
                            $('[data-repeater-list="plates"]').append($plateTemplate);
                        });
                        if(data.length > 0){
                            $('[data-repeater-item]').first().remove();
                        }

                        $('[data-repeater-list="plates"]').find('[data-repeater-item]').each(function(index, element) {
                            // For each input in the current repeater item...
                            console.log(index);
                            $(element).find('div').find('input,select,textarea').each(function() {
                                // Replace the index in its name attribute with the current index
                                if($(this).attr('name')!= undefined){
                                    var name = $(this).attr('name').replace(/\[\d+\]/, '[' + index + ']');
                                    $(this).attr('name', name);
                                }
                            });
                        });
                         },200)
                    },
                    error: function(xhr, status, error) {
                        // Handle any errors that occur during the request
                        console.log('Error: ' + error);
                    }
                });
                //get data attribute project id from this element
                // console.log(projectid);
                 // Parse the JSON data for the row
                $('#mainprojectid').val(projectid);
                $('#actualprojectid').val(actualid);
                $('#subproject').val(projectid+'_001');
                // Populate the form fields in the modal with the data for the row
                // $('#myModal #name').val(data.name);
                // $('#myModal #email').val(data.email);
                // $('#myModal #subject').val(data.subject);
                // Add code to populate the other form fields as needed

                // Show the modal
                $('#myModal').modal('show');
            }

            $('.modal .close').on('click', function() {
                $('#myModal').hide();
            });
            $(document).on('click', '.deletesubprojectimage', function() {
                var parentdivthis = $(this);
                if (flag == false) {
                    var columnname = $(this).attr('name');
                    var value = $(this).val();
                    var columntype = $(this).attr('type');
                    var sub_id = $(this).attr('sub_id');
                    var formData = new FormData(); // Create a new FormData object
                    
                    var platename = $(this).attr('platename');
                    formData.append('deleteimage', 'true');
                    formData.append('_token', "{{ csrf_token() }}");
                    formData.append('platename',platename);
                    formData.append('field', columnname);
                    formData.append('sub_id', sub_id);
                    $.ajax({
                        type: 'POST',
                        url: "{{route('updatesubplate')}}",
                        data: formData,
                        processData: false,
                        contentType: false,
                        success: function(data) {
                            location.reload();
                            data = JSON.parse(data);
                            // console.log(data);
                            $("#design_by").html(data.design_by);
                            if(columntype== 'file'){    
                                var ogcolumnname = columnname.replace('_[object HTMLInputElement]', '');
                                parentdivthis.parent().css({
                                "cursor": "pointer",
                                "text-decoration": "underline",
                                "color": "rgb(0, 123, 255)"
                                });
                                var imageviewhtml = '<button class="btn btn-outline-primary waves-effect waves-light btn-sm image-name-cell" style="padding: 1px; padding-right: 10px;padding-left: 10px;border-width: thin;!important;margin-right:10px;" title="View Plates" data-image="'+data[0][ogcolumnname]+'"><i class="fa fa-eye"></i></button><button class="btn btn-outline-primary waves-effect waves-light btn-sm deletesubprojectimage" style="padding: 1px; padding-right: 10px;padding-left: 10px;border-width: thin;" title="Delete Image" onclick="confirm(`Are you sure you want to delete?`)"  platename="'+platename+'" sub_id="'+sub_id+'" id="'+ogcolumnname+'_[object HTMLInputElement]" name="'+key+'_'+id+'"><i class="fa fa-trash"></i></button>';
                                $(parentdivthis).parent().html(imageviewhtml);
                            }
                        }
                    });
                }
            });
            $(document).on('change', '.updatesubproject', function() {
                var parentdivthis = $(this);
                if (flag == false) {
                    var columnname = $(this).attr('name');
                    
                    var value = $(this).val();
                    var columntype = $(this).attr('type');
                    var sub_id = $(this).attr('sub_id');
                    var formData = new FormData(); // Create a new FormData object
                    
                    if (columntype != undefined && columntype != 'file') {
                        formData.append('_token', "{{ csrf_token() }}");
                        formData.append('field', columnname);
                        formData.append('value', value);
                        formData.append('sub_id', sub_id);
                    } else if (columntype != undefined && columntype == 'file') {
                        var platename = $(this).attr('platename');
                        var file = $(this).prop('files')[0]; // Get the selected file
                        formData.append('_token', "{{ csrf_token() }}");
                        formData.append('platename',platename);
                        formData.append('field', columnname);
                        formData.append('value', file);
                        formData.append('sub_id', sub_id);
                    } else {
                        formData.append('_token', "{{ csrf_token() }}");
                        formData.append('field', columnname);
                        formData.append('value', value);
                        formData.append('sub_id', sub_id);
                    }
                    $.ajax({
                        type: 'POST',
                        url: "{{route('updatesubplate')}}",
                        data: formData,
                        processData: false,
                        contentType: false,
                        success: function(data) {
                            data = JSON.parse(data);
                            // console.log('here it comes');
                           
                            $("#designby").html(data.designby);
                            $("#orderby").html(data.orderbytotal);
                            $("#receivedworkby").html(data.receivedworkby);
                            $("#receivedqcby").html(data.receivedqcby);
                            $("#vmcworkby").html(data.vmcworkby);
                            $("#vmcqcby").html(data.vmcqcby);
                            $("#drilltapworkby").html(data.drilltapworkby);
                            //console.log((data["0"].design_by!=null) +"::"+ (data["0"].order_by!=null) +"::"+ (data["0"].received_workby!=null) +"::"+ (data["0"].received_qcby!=null) +"::"+ (data["0"].vmc_workby!=null) +"::"+ (data["0"].vmc_qcby!=null) +"::"+ (data["0"].drilltap_workby!=null))
                            if(data["0"].design_by!=null && data["0"].order_by!=null && data["0"].received_workby!=null && data["0"].received_qcby!=null && data["0"].vmc_workby!=null && data["0"].vmc_qcby!=null && data["0"].drilltap_workby!=null){
                                $("#final_qcby_"+sub_id).removeAttr('disabled')
                            }else{
                                $("#final_qcby_"+sub_id).attr('disabled', 'disabled')
                            }
                            $("#finalqcby").html(data.finalqcby);
                            if(data["0"].design_by!=null && data["0"].order_by!=null && data["0"].received_workby!=null && data["0"].received_qcby!=null && data["0"].vmc_workby!=null && data["0"].vmc_qcby!=null && data["0"].drilltap_workby!=null && data["0"].final_qcby!=null){
                                $("#packing_workby_"+sub_id).removeAttr('disabled')
                            }else{
                                $("#packing_workby_"+sub_id).attr('disabled', 'disabled')
                            }
                            $("#packingworkby").html(data.packingworkby);
                            if(columntype== 'file'){    
                                var ogcolumnname = columnname.replace('_[object HTMLInputElement]', '');
                                parentdivthis.parent().css({
                                "cursor": "pointer",
                                "text-decoration": "underline",
                                "color": "rgb(0, 123, 255)"
                                });
                                var imageviewhtml = '<button class="btn btn-outline-primary waves-effect waves-light btn-sm image-name-cell" style="padding: 1px; padding-right: 10px;padding-left: 10px;border-width: thin;!important;margin-right:10px;" title="View Plates" data-image="'+data[0][ogcolumnname]+'"><i class="fa fa-eye"></i></button><button class="btn btn-outline-primary waves-effect waves-light btn-sm deletesubprojectimage" style="padding: 1px; padding-right: 10px;padding-left: 10px;border-width: thin;" title="Delete Image" onclick="confirm(`Are you sure you want to delete?`)"  platename="'+platename+'" sub_id="'+sub_id+'" id="'+ogcolumnname+'_[object HTMLInputElement]"  name="'+ogcolumnname+'_[object HTMLInputElement]"><i class="fa fa-trash"></i></button';
                                $(parentdivthis).parent().html(imageviewhtml);
                            }
                        }
                    });
                }
            });
        </script>
        <script>
            function View(data,id) 
                {

                    if (typeof data === 'string') {
                    var data = JSON.parse(data.replace(/'/g, '"'));
                    $("#projectnote").text(data.note.replace("<>","\""));
                    $("#exampleModalScrollable2").modal("toggle"); 
                    return false;}
                }
        </script>
    <script>
        function scanDelete(id){
     if (window.confirm("Do you really want to delete?")) {
         var url = "{{ route('scan.delete',':id') }}";
         url = url.replace(':id', id);
         window.location.href=url;
     }
    }
    function editSubnote(id) {
    // Hide the label and show the input field for editing
    $('.subnote-label').show(); // Show all labels
    $('.subnote-input').hide(); // Hide all inputs

    $('#subnote_label_' + id).hide();
    $('#subnote_' + id).show().focus();
    }

    function changesubnote(id){
            var subnote=document.getElementById("subnote_"+id).value;          
            $.ajax({
               type:'POST',
               url:"{{route('scanning.updatesubnote')}}",
               data: {_token: "{{ csrf_token() }}", subnote:subnote,id:id}, 
               success: function(response) {
            // On success, update the label with the new value and hide the input
            $('#subnote_label_' + id).text(subnote).show();
            $('#subnote_' + id).hide();
        },
        error: function() {
            // Optionally handle errors
            alert('Failed to update subnote.');
        }            
            });

        }
    </script>
@endsection
