@extends('layouts.master')

@section('title') Mould Register @endsection

@section('css')
    <!-- DataTables -->
    <link href="//cdnjs.cloudflare.com/ajax/libs/select2/4.0.0/css/select2.min.css" rel="stylesheet" />
    <link href="{{ URL::asset('/assets/libs/select2/select2.min.css') }}" rel="stylesheet" type="text/css" />
    <link href="{{ URL::asset('/assets/libs/bootstrap-datepicker/bootstrap-datepicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/spectrum-colorpicker/spectrum-colorpicker.min.css') }}" rel="stylesheet" type="text/css">
    <link href="{{ URL::asset('/assets/libs/bootstrap-touchspin/bootstrap-touchspin.min.css') }}" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" href="{{ URL::asset('/assets/libs/datepicker/datepicker.min.css') }}">

    <link href="{{ URL::asset('/assets/libs/datatables/datatables.min.css') }}" rel="stylesheet" type="text/css" />
    <style>
        .modal-dialog-scrollable {
        overflow-y: scroll;
        max-height: 80vh; /* You can adjust this value to fit your needs */
    }
    </style>
   
@endsection

@section('content')



    @component('components.breadcrumb')
        @slot('li_1') Mould @endslot
        @slot('title') Mould Data @endslot
    @endcomponent


    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-body">
                    <a href ="{{ route('exportmouldreg') }}" type="button" class="btn btn-primary btn-lg waves-effect waves-light"  style="margin-bottom: 10px;">Export</a>
                    <!-- Add Modal Start -->
                    <div class="modal fade" id="exampleModalScrollable" tabindex="-1" role="dialog" aria-labelledby="exampleModalScrollableTitle" aria-hidden="true">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content modal-lg">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="exampleModalScrollableTitle">MOULD WORK</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                
                                <form autocomplete="off" action="{{route('scanning.store')}}" method="post" class="needs-validation" novalidate>
                                    @csrf
 
                                    <!-- Equivalent to... -->
                                    <input type="hidden" name="_token" value="{{ csrf_token() }}" />
                                    <div class="modal-body modal-dialog-scrollable">
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
                                                                data-provide="datepicker" data-date-autoclose="true" id="cdate" value={{$newDateTime}}>
                            
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
                                                            <input class="form-check-input" type="radio" name="worktype"  value="Pulp" required>
                                                            <label class="form-check-label" for="formRadios1">
                                                                Pulp
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
                                                <div class="col-md-2">
                                                        <div class="form-check">
                                                            <input class="form-check-input" type="radio" name="worktype" value="Plastic" >
                                                            <label class="form-check-label" for="formRadios3">
                                                                Plastic
                                                            </label>
                                                        </div>
                                                </div>
                                                <div class="col-md-2">
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="radio" name="worktype" value="Sample" >
                                                        <label class="form-check-label" for="formRadios3">
                                                            Sample
                                                        </label>
                                                    </div>
                                                </div>
                                                <div class="col-md-2">
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="radio" name="worktype" value="Rework" >
                                                        <label class="form-check-label" for="formRadios3">
                                                            Rework
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
                    <!-- /.modal -->
                    <!-- Add Data Modal End-->
                    

                    <table id="datatablescan" class="table table-sm m-0 table-responsive" style="width: 100%!important">
                        <thead>                    
                            <tr> 
                                @if (Auth::user()->role==0) 
                                    <th style="width: 9%;">Received Dt</th>
                                    <th style="width: 10%;">Dispatch Dt</th>
                                    <th style="width: 5%;">Customer</th>
                                    <th style="width: 8%;">Work Type</th>
                                    <th>Mould/Part Name</th>
                                    <th>Note</th>
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
                                    <th style="width: 2%;text-align:center">Dispatch</th>
                                    <!-- <th style="width: 5%;">SM Hr</th>
                                    <th style="width: 6%;">USM Hr</th> -->
                                    <th style="width: 5%;">M Hr</th>
                                    {{-- <th style="width: 6%;">Amount</th> --}}
                                    {{-- <th style="width: 11%;">Action<th> --}}
                                    <th></th> 
                            </tr>
                                        {{-- <th>Received Dt</th>
                                        <th>Committed Dt</th>
                                        <th>Customer Initials</th>
                                        <th>Work Type</th>
                                        <th>Mould Description</th>  
                                        <th>Sub Plate Name</th> 
                                        <th>Mould</th>
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
                                        <!-- <th>SM Time</th>
                                        <th>USM Time</th> -->
                                        <th>Machine Time</th>
                                        <th>Action<th>     --}}
                                @else
                                <th style="width: 9%;">Received Dt</th>
                                <th style="width: 10%;">Dispatch Dt</th>
                                <th style="width: 5%;">Customer</th>
                                <th style="width: 8%;">Work Type</th>
                                <th>Mould/Part Name</th>
                                <th>Note</th>
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
                                <th style="width: 2%;text-align:center">Dispatch</th>
                                <!-- <th style="width: 5%;">SM Hr</th>
                                <th style="width: 6%;">USM Hr</th> -->
                                <th style="width: 5%;">M Hr</th>
                                {{-- <th style="width: 6%;">Amount</th> --}}
                                {{-- <th style="width: 11%;">Action<th> --}}
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

   <!-- view start-->
   
                <!-- Add Modal Start -->
                <div class="modal fade" id="myModal" tabindex="-1" role="dialog" aria-labelledby="exampleModalScrollableTitle" aria-hidden="true">
                    <div class="modal-dialog modal-xl">
                        <div class="modal-content modal-xl">
                            <div class="modal-header">
                                <h5 class="modal-title" id="exampleModalScrollableTitle">Sub Plate</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <form action="{{route('plates.add')}}" id="addPlates" class="repeater" method="POST" enctype="multipart/form-data" style="margin: 15px;!important">
                                @csrf
                                <input type="text" id="mainprojectid" class="form-control d-none" name="mainprojectid" readonly/>
                                <input type="text" id="actualprojectid" class="form-control d-none" name="actualprojectid" readonly/>
                                <div data-repeater-list="plates" id="dataRepeaterId">
                                    <div data-repeater-item class="row">
                                        <div class="mb-3 col">
                                            <label for="name">Name</label>
                                            <input type="text" id="platename" name="platename" class="form-control"/>
                                        </div>
                
                                        <div class="mb-3 col">
                                            <label for="email">Project</label>
                                            <input type="text" id="subproject" class="form-control" name="subproject" readonly/>
                                        </div>
                                            
                                        <div class="mb-3 col">
                                            <label for="subject">Length</label>
                                            <input type="text" id="length" class="form-control" name="length" onchange="calculateWeight(this)"/>
                                        </div>
                                        <div class="mb-3 col">
                                            <label for="subject">Width</label>
                                            <input type="text" id="width" class="form-control" name="width" onchange="calculateWeight(this)"/>
                                        </div>
                                        <div class="mb-3 col">
                                            <label for="subject">Height</label>
                                            <input type="text" id="height" class="form-control" name="height" onchange="calculateWeight(this)" />
                                        </div>
                                        <div class="mb-3 col">
                                            <label for="material">Material</label>
                                            <select class="form-control" id="material"  name="material" onchange="calculateWeight(this)">
                                              <option value="">Select</option>
                                              <option value="AL">AL</option>
                                              <option value="MS">MS</option>
                                            </select>
                                          </div>
                                        
                                        <div class="mb-3 col">
                                            <label for="subject">Weight</label>
                                            <input type="text" id="weight" class="form-control" name="weight" readonly/>
                                        </div>
                                        <div class="mb-3 col">
                                            <label for="resume">Photo</label>
                                            <input type="file" class="form-control" id="photo" name="photo" width="70%">
                                        </div>
                                        <div class="mb-3 col d-none">
                                            <label for="resume">Photo</label>
                                            <input type="text" class="form-control" id="photo_name" name="photo_name">
                                        </div>
                                        <div class="col align-self-center">
                                            <div class="d-grid">
                                                <input data-repeater-delete type="button" class="btn btn-primary" value="Delete" />
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
                <!-- /.modal -->
                <!-- Add Data Modal End-->
                

       


@endsection
@section('script')
    <script>    
        var flag = false;
    </script>
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
    <script src="{{ URL::asset('/assets/libs/jquery.repeater/jquery.repeater.min.js') }}"></script>

    <script src="{{ URL::asset('/assets/js/pages/form-repeater.int.js') }}"></script>

    <script>
        function calculateWeight(element) {
            var rowElement = $(element).closest('.row'); // Get the closest parent row element
            var length = rowElement.find('.form-control[name="length"]').val();
            var width = rowElement.find('.form-control[name="width"]').val();
            var height = rowElement.find('.form-control[name="height"]').val();
            var material = rowElement.find('.form-control[name="material"]').val();
            var weight = 0;
            if (material == "AL") {
                weight = (2.71 * length * width * height)/1000000;
            } else if (material == "MS") {
                weight = (7.81 * length * width * height)/1000000;
            }

            rowElement.find('.form-control[name="weight"]').val(weight.toFixed(5));
        }
    </script>
    <script>
        $('.add').on('click', function(){
            setTimeout(() => {
                var projectid = $('#mainprojectid').val();
                var scanprojectid = $(this).attr('projectid');
                var firstInputValue = $('input[name="plates[0][subproject]"]').val();
                var splitedValue = firstInputValue.substring(scanprojectid.length);
                var count = $('input[name^="plates["][name$="[subproject]"]').length;
                var inputNumber = $('input[name^="plates["][subproject]').length; // get the number of existing input elements
                var lastInputElement = $('input[name^="plates["][name$="[subproject]"]').last();
                var originalValue = firstInputValue;
                var prefix = scanprojectid;
                var number =parseInt(splitedValue);
                number = number+ (count-1);
                var newValue = prefix + ('000' + number).slice(-3);
                lastInputElement.val(newValue);
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
        var data=JSON.parse(data.replaceAll("'","\""));
            //  $("exampleModalScrollableTitle").html("Edit Data");
            $("#cname").val(data.cname).trigger('change');
            $("#description").val(data.description);
            $("#note").val(data.note);
           // $("#worktype").val(data.worktype);
            $("#rdate").val(data.rdate).prop('disabled', true);
            $("#cdate").val(data.cdate).prop('disabled', true);
            $("#id").val(data.id);
            var inputs = document.getElementsByName("worktype");
            for (var i = 0; i < inputs.length; ++i) {
                // if (inputs[i].checked) {
                    
                // }
                if(inputs[i].value==data.worktype){
                    inputs[i].checked=true;
                }
            }
            $("#exampleModalScrollable").modal("toggle");
        }
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
                                        var image_element = '<input type="file" class="form-control updatesubproject" platename="'+platename+'" sub_id="'+sub_id+'" id="'+key+'_'+id+'" name="'+key+'_'+id+'" width="40%" disabled>';
                                        var cell = $('<td/>').html(image_element);
                                    }else{
                                        var cell = $('<td/>').html(('photo' == key) ? '<button class="btn btn-outline-primary waves-effect waves-light btn-sm mr-2 image-name-cell" style="padding: 1px; padding-right: 10px;padding-left: 10px;border-width: thin;!important;margin-right:10px" title="View Image" data-image="'+value+'"><i class="fa fa-eye"></i></button>' : '<button class="btn btn-outline-primary waves-effect waves-light btn-sm mr-2 image-name-cell" style="padding: 1px; padding-right: 10px;padding-left: 10px;border-width: thin;!important;margin-right:10px" title="View Image" data-image="'+value+'"><i class="fa fa-eye"></i></button>').css({
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
                                            var dropdown_element  = "<select name='"+key+"' id='"+key+"_"+sub_id+"' class='form-control updatesubproject' sub_id='"+sub_id+"' "+(finalqc==7?'':'disabled')+" placeholder='select user' style='padding-right:10px;padding-left:10px;padding: 1px;border-width: thin;border: 1px solid #c2c2c2;!important' disabled><option value=''>Select</option>@foreach($userdata as $udata) <option value='{{$udata->id}}'>{{$udata->initials}}</option> @endforeach</select>";
                                            var cell = $('<td/>').html(dropdown_element);
                                            var elementid = "#"+key+"_"+sub_id;
                                            setTimeout(function(){
                                                $(elementid).val(value).change();
                                            },100);
                                        }else if(key=="packing_workby"){
                                            var dropdown_element  = "<select name='"+key+"' id='"+key+"_"+sub_id+"' class='form-control updatesubproject' sub_id='"+sub_id+"' "+(packingwork==8?'':'disabled')+" placeholder='select user' style='padding-right:10px;padding-left:10px;padding: 1px;border-width: thin;border: 1px solid #c2c2c2;!important' disabled><option value=''>Select</option>@foreach($userdata as $udata) <option value='{{$udata->id}}'>{{$udata->initials}}</option> @endforeach</select>";
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
                                            var dropdown_element  = "<select name='"+key+"' id='"+key+"_"+sub_id+"' class='form-control updatesubproject' sub_id='"+sub_id+"' placeholder='select user' style='padding-right:10px;padding-left:10px;padding: 1px;border-width: thin;border: 1px solid #c2c2c2;!important' disabled><option value=''>Select</option>@foreach($userdata as $udata) <option value='{{$udata->id}}'>{{$udata->initials}}</option> @endforeach</select>";
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

                    subplateCell.append(createSubplateTable(scanData.subplates));
                    subplateRow.append(subplateCell);

                }
            });
           var scanTable = $('#datatablescan').DataTable({
                order:[[0, 'desc'],[1,'desc']],
                processing: true,
                 serverSide: true,
                 pageLength:100,
                 ajax: "{{route('getscanregisterdata')}}",
                 columns: [
                        {data : {'_': 'rdate.display', 'sort': 'rdate.timestamp'}, name: 'rdate', orderable: true},
                        {data : {'_': 'dispatchdate.display', 'sort': 'dispatchdate.timestamp'}, name: 'dispatchdate', orderable: true},                
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
                        // {data: 'action', name: 'action', orderable: false, searchable: false},
                        // {data: "subplates", name:'subplates',visible: false , searchable: false },
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
                $('#datatablescan').DataTable({
                    processing: true,
                    serverSide: true,
                    pageLength:100,
                    ajax: "{{route('getscanregisterdata')}}",
                    columns: [
                         {data : {'_': 'rdate.display', 'sort': 'rdate.timestamp'}, name: 'rdate', orderable: true},
                         {data : {'_': 'dispatchdate.display', 'sort': 'dispatchdate.timestamp'}, name: 'dispatchdate', orderable: true},                        
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
                        //  {   
                        //     data: 'dswork', 
                        //     name: 'dswork',  
                        //     "className": "text-center",           
                        //     orderable: false, 
                        //     searchable: false
                        // },
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
                     
                     
                    //  {data: 'sm_hr', name: 'sm_hr', orderable: true, searchable: true},
                    //  {data: 'usm_hr', name: 'usm_hr', orderable: true, searchable: true},  
                     {data: 'm_hr', name: 'm_hr', orderable: true, searchable: true},
                    //  {data: 'amount', name: 'amount', orderable: false, searchable: false},                
                    //  {data: 'action', name: 'action', orderable: false, searchable: false},
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
                $("#scantotal").html(data.scantotal);
                $("#scanby").html(data.scanby);
                $("#designby").html(data.designby);
                $("#qcby").html(data.qcby);
                $("#printtotal").html(data.printtotal);
                $("#printby").html(data.printby);
                $("#printqc").html(data.printqc);
               }            
            });
        }
        function changestatus(id){
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
               url:"{{route('scanadmin.updatestatus')}}",
               data: {_token: "{{ csrf_token() }}", status:"pending",id:id},
               success:function(data) {
                  $("#scan_"+id).remove();
                  data=JSON.parse(data);
                $("#scantotal").html(data.scantotal);
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
                dropdownParent: $("#exampleModalScrollable")
            });
            $("#select2").select2({
                dropdownParent: $("#exampleModalScrollable1")
            });
            });
    </script> 
        <script>
            var datarepeaterhtml = $('#dataRepeaterId').html();
            function openModal(projectid,actualid) {
                console.log(datarepeaterhtml);
                $('.add').attr('projectid', projectid);
                $('#dataRepeaterId').html('');
                $('#dataRepeaterId').html(datarepeaterhtml);
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
                        console.log(data);
                        $.each(data, function(index, plate) {
                            // Clone the HTML template for the plate
                            var $plateTemplate = $('[data-repeater-item]').first().clone();
                            // Update the input values with data from the plate
                            $plateTemplate.find('#platename').val(plate.platename);
                            $plateTemplate.find('#subproject').val(plate.subprojectid);
                            $plateTemplate.find('#length').val(plate.length);
                            $plateTemplate.find('#width').val(plate.width);
                            $plateTemplate.find('#height').val(plate.height);
                            $plateTemplate.find('#weight').val(plate.weight);
                            $plateTemplate.find('[name="plates[' + index + '][designing]"]').val(plate.design_by);
                            $plateTemplate.find('[name="plates[' + index + '][MO]"]').val(plate.order_by);
                            $plateTemplate.find('[name="plates[' + index + '][MRinit1]"]').val(plate.received_workby);
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
                    },
                    error: function(xhr, status, error) {
                        // Handle any errors that occur during the request
                        console.log('Error: ' + error);
                    }
                });
                //get data attribute project id from this element
                console.log(projectid);
                 // Parse the JSON data for the row
                $('#mainprojectid').val(projectid);
                $('#actualprojectid').val(actualid);
                $('#subproject').val(projectid+'001');
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
                            $("#design_by").html(data.design_by);
                            if(columntype== 'file'){    
                                var ogcolumnname = columnname.replace('_[object HTMLInputElement]', '');
                                parentdivthis.parent().css({
                                "cursor": "pointer",
                                "text-decoration": "underline",
                                "color": "rgb(0, 123, 255)"
                                });
                                parentdivthis.prop('disabled', true);
                                var imageviewhtml = '<button class="btn btn-outline-primary waves-effect waves-light btn-sm image-name-cell" style="padding: 1px; padding-right: 10px;padding-left: 10px;border-width: thin;!important;margin-right:10px;" title="View Plates" data-image="'+data[0][ogcolumnname]+'"><i class="fa fa-eye"></i></button>';
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
                            console.log('here it comes');
                            console.log(data);
                            $("#design_by").html(data.design_by);
                            if(columntype== 'file'){    
                                var ogcolumnname = columnname.replace('_[object HTMLInputElement]', '');
                                parentdivthis.parent().css({
                                "cursor": "pointer",
                                "text-decoration": "underline",
                                "color": "rgb(0, 123, 255)"
                                });
                                var imageviewhtml = '<button class="btn btn-outline-primary waves-effect waves-light btn-sm image-name-cell" style="padding: 1px; padding-right: 10px;padding-left: 10px;border-width: thin;!important;margin-right:10px;" title="View Plates" data-image="'+data[0][ogcolumnname]+'"><i class="fa fa-eye"></i></button>';
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
                    var data=JSON.parse(data.replaceAll("'","\""));
                    $("#projectnote").text(data.note);
                    $("#exampleModalScrollable2").modal("toggle"); 
                    return false;
                }
        </script>
@endsection
