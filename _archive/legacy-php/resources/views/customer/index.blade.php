@extends('layouts.master')
@section('title') Customer / Vendor Management @endsection
@section('css')
    <!-- DataTables -->
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
    </style>
@endsection
@section('content')
{{-- 
    @component('components.breadcrumb')
        @slot('li_1') Scanning @endslot
        @slot('title') Scanning Data @endslot
    @endcomponent --}}
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-body">
                    <button type="button" class="btn btn-outline-primary waves-effect waves-light mb-3" data-bs-toggle="modal" data-bs-target="#exampleModalScrollable1" onclick="return Add();">Add Customer</button>
                    <!-- Add Modal Start -->
                    <div class="modal fade" id="exampleModalScrollable1" tabindex="-1" role="dialog" aria-labelledby="exampleModalScrollableTitle" aria-hidden="true">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content modal-lg ">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="exampleModalScrollableTitle">Add New Customer</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>                              
                                <form autocomplete="off" id="customerform" action="{{route('customer.store')}}" onsubmit="return checkusername();" method="post" id="customerform" class="needs-validation" novalidate>
                                    @csrf
                                    <!-- Equivalent to... -->
                                    <input type="hidden" name="_token" value="{{ csrf_token() }}" />
                                <div class="modal-body modal-dialog-scrollable">                                                                       
                                    <div class="mb-3 row">
                                        <label for="example-text-input" class="col-md-2 col-form-label">Name</label>
                                        <div class="col-md-10">
                                            <input class="form-control" type="text" id="customername" name="customername" required>
                                            <input class="form-control" type="hidden" id="id" name="id">
                                        </div>
                                    </div>
                                    {{-- <div class="mb-3 row">
                                        <label for="example-text-input" class="col-md-2 col-form-label">Initials</label>
                                        <div class="col-md-10">
                                            <input class="form-control" type="text" id="initials" name="initials" onblur="return checkinitial();" maxlength="3" required>
                                        </div>
                                    </div> --}}
                                    <div class="mb-3 row">
                                        <label for="example-text-input" class="col-md-2 col-form-label">Initials</label>
                                        <div class="col-md-10">
                                            <input class="form-control" type="text" id="initials" name="initials" maxlength="3" oninput="this.value = this.value.replace(/\s+/g, '').toUpperCase();" onblur="return checkinitials();" required>
                                            <div id="alertDiv"></div>
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3 row">
                                        <label for="example-text-input" class="col-md-2 col-form-label">Mobile No. 1</label>
                                        <div class="col-md-10">
                                            <input class="form-control" type="text" id="mobile" name="mobile">
                                        </div>
                                    </div> 
                                    <div class="mb-3 row">
                                        <label for="example-text-input" class="col-md-2 col-form-label">Mobile No. 2</label>
                                        <div class="col-md-10">
                                            <input class="form-control" type="text" id="mobile1" name="mobile1">
                                        </div>
                                    </div> 
                                    <div class="mb-3 row">
                                        <label for="example-email-input" class="col-md-2 col-form-label">Email</label>
                                        <div class="col-md-10">
                                            <input class="form-control" type="email" id="email" name="email">
                                        </div>
                                    </div>
                                    <div class="mb-3 row">
                                        <label for="description" class="col-md-2 col-form-label">Address</label>
                                        <div class="col-md-10">
                                            <textarea class="form-control" id="address" name="address"></textarea>
                                        </div>
                                            <input  class="form-control" type="hidden" name="id" id="id" />
                                    </div> 
                                    <div class="row">
                                        <label for="validationCustom03" class="col-md-2 col-form-label">Type</label >
                                        <div class="col-md-2">                                                                                        
                                                <div class="form-check mb-3">
                                                    <input class="form-check-input" type="radio" name="usertype"  value="Customer" required>
                                                    <label class="form-check-label" for="formRadios1">
                                                        Customer
                                                    </label>
                                                </div>    
                                        </div>
                                        <div class="col-md-2">
                                                <div class="form-check">
                                                    <input class="form-check-input" type="radio" name="usertype" value="Vendor" >
                                                    <label class="form-check-label" for="formRadios2">
                                                        Vendor
                                                    </label>
                                                </div>  
                                        </div>
                                        <div class="col-md-2">
                                            <div class="form-check">
                                                <input class="form-check-input" type="radio" name="usertype" value="Transport" >
                                                <label class="form-check-label" for="formRadios3">
                                                    Transport
                                                </label>
                                            </div>  
                                        </div>
                                        <div class="col-md-2">
                                            <div class="form-check">
                                                <input class="form-check-input" type="radio" name="usertype" value="Other" >
                                                <label class="form-check-label" for="formRadios4">
                                                    Other
                                                </label>
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
                    <table id="datatable-buttons5" class="table table-sm m-0 table-responsive">
                        <thead>
                            <tr>
                                <th style="width:15%;">Name</th>
                                <th style="width:4%;">Initials</th> 
                                <th style="width:9%;">Mobile No. 1</th> 
                                <th style="width:9%;">Mobile No. 2</th> 
                                <th style="width:10%;">Email</th> 
                                <th>Address</th>
                                <th style="width:4%;">Type</th>
                                <th style="width:9%;">Action</th>                                                        
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
    <script>
        function AskToDelete(id){
         if (window.confirm("Do you really want to delete?")) {
             var url = "{{ route('customer.delete',':id') }}";
             url = url.replace(':id', id);
             window.location.href=url;
         }
        }
    </script>
    <script type="text/javascript">
   
    function checkusername(){
       
            $.ajax({
               type:'POST',
               url:"{{route('customer.checkusername')}}",
               data: {_token: "{{ csrf_token() }}", username:$("#customername").val(),id:$("#id").val()},
               success:function(data) {
                  if(!data.success){
                    //$("#customerform").submit();
                    if($("#id").val()!=""){
                        $.ajax({
                        type:'POST',
                        url:"{{route('customer.updatedata')}}",
                        data: {_token: "{{ csrf_token() }}", id:$("#id").val(),customername:$("#customername").val(),mobile:$("#mobile").val(),mobile1:$("#mobile1").val(),email:$("#email").val(),address:$("#address").val(),usertype: $("input[name='usertype']:checked").val(),initials:$("#initials").val()},
                        success:function(data) {
                            window.location.reload();
                        },                       
                        });
                    }
                    else{
                        $.ajax({
                        type:'POST',
                        url:"{{route('customer.store')}}",
                        data: {_token: "{{ csrf_token() }}", customername:$("#customername").val(),mobile:$("#mobile").val(),mobile1:$("#mobile1").val(),email:$("#email").val(),address:$("#address").val(),usertype: $("input[name='usertype']:checked").val(),initials:$("#initials").val()},
                        success:function(data) {
                            window.location.reload();
                        },
                        
                        });
                    }
                  }else{
                    alert("Customer name is already exist.")
                  }
               },
               
            });
        
        return false;
    }
    function checkinitials() {
    var initials = $('#initials').val();
    $.ajax({
        type: 'POST',
        url: "{{ route('customer.checkinitials') }}",
        data: {_token: "{{ csrf_token() }}", initials: initials},
        success: function(data) {
            var alertDiv = $('#alertDiv');
            var inputField = $('#initials');

            if (data.initialExists) {
                // If the initial is found
                alertDiv.html('<div class="alert alert-danger" role="alert">Initial already exists!</div>');
                inputField.val('');
                inputField.focus();
            } else {
                // If the initial is not found
                alertDiv.empty();
                inputField.next().removeAttr('disabled');
            }
        }
    });
    }

    // function checkinitials() {
    //     // var initials = 
    //     // console.log(initials);
    //     $.ajax({
    //             type: 'POST',
    //             url:"{{route('customer.checkinitials')}}",
    //             data: {_token: "{{ csrf_token() }}", username:$('#initials').val()},
    //             success: function(data){
    //                 console.log(data);
    //                 {   
    //                     if(!data.suceess){
    //                     var alertDiv = $('#alertDiv');
    //                     var inputField = $('#initials');
    //                     inputField.val('');
    //                     inputField.focus();
    //                     alertDiv.html('<div class="alert alert-danger" role="alert">Initial alredy exists!</div>');
    //                     }
    //                     else{
    //                         if(data.suceess){
    //                         alertDiv.empty();
    //                         inputField.next().removeAttr('disabled');    
    //                         }
    //                     }
                               
    //                 }
    //             } 
    //         });
    //     }
    // function checkinitial() {
    //     var initials = document.getElementById("initials").value;
    //     var capitalLettersRegex = /^[A-Z]+$/;
        
    //     if (!capitalLettersRegex.test(initials)) {
    //         alert("Initials can only contain capital letters.");
    //         setTimeout(function() {
    //         document.getElementById("initials").value = "";
    //         document.getElementById("initials").focus();
    //         }, 0);
    //         return false;
    //     }

        // if (initials.length > 8) {
        //     alert("Initials cannot be more than 8 characters long.");
        //     setTimeout(function() {
        //     document.getElementById("initials").value = "";
        //     document.getElementById("initials").focus();
        //     }, 0);  
        //     return false;
        // }
        

    // function checkinitial() {
    //     var initials = document.getElementById("initials").value;
    //     if (initials.length > 8 || !/^[A-Z]+$/.test(initials)) {
    //         alert("Initials must contain at least 8 capital letters.");
    //         setTimeout(function() {
    //         document.getElementById("initials").focus();
    //         }, 0);
    //         return false;
    //     }
    //     return true;
    //     }
        $(function () {         
        $('#datatable-buttons5').DataTable({

              processing: true,
              serverSide: true,
              pageLength:50,
              dom: 'Bfrtip', 
              buttons: [
                        {
                            extend: 'excel',
                            exportOptions: {
                            columns: ':not(.action)'
                             }
                        }, 
                        {
                            extend: 'pdfHtml5',
                            orientation: 'landscape',
                            pageSize: 'LEGAL',
                            exportOptions: {
                            columns: ':not(.action)'
                            }
                        }, 'print'],
              ajax: "{{route('getcustomerdata')}}",
              columns: [
                  {data: 'customername', name: 'customername', orderable: true, searchable: true},
                  {data: 'initials', name: 'initials'},
                  {data: 'mobile', name: 'mobile'},  
                  {data: 'mobile1', name: 'mobile1'},
                  {data: 'email', name: 'email'},
                  {data: 'address', name: 'address'},
                  {data: 'usertype', name: 'usertype'},
                  {data: 'action', name: 'action', orderable: false, searchable: false, className: 'action'},                              
              ]
          });        
        });
        function Add(data,id) {
           // var data=JSON.parse(data.replaceAll("'","\""));
            //  $("exampleModalScrollableTitle").html("Edit Data");
            $('#customerform').attr('action', "{{route('customer.store')}}");
            $("#customername").val("");
            $("#initials").val("");
            $("#address").val("");
            $("#email").val("");
            $("#mobile").val("");
            $("#mobile1").val("");
            var inputs = document.getElementsByName("usertype");
            for (var i = 0; i < inputs.length; ++i) {
                // if (inputs[i].checked) {
                    
                // }
              //  if(inputs[i].value==data.worktype){
                    inputs[i].checked=false;
             //   }
            }
            $("#id").val();
          
            $("#exampleModalScrollable1").modal("toggle");
            return false;
        }
        function Edit(data,id) {
            // console.log(data)
            var data=JSON.parse(data.replaceAll("'","\""));
            //  $("exampleModalScrollableTitle").html("Edit Data");
            $('#customerform').attr('action', "{{route('customer.updatedata')}}");
            $("#initials").val(data.initials).attr('readonly', 'true');
            $("#address").val(data.address);
            $("#email").val(data.email);
            $("#mobile1").val(data.mobile1);
            $("#customername").val(data.customername);
            $("#mobile").val(data.mobile);
            var inputs = document.getElementsByName("usertype");
            for (var i = 0; i < inputs.length; ++i) {
                // if (inputs[i].checked) {
                    inputs[i].disabled = true;
                // }
                if(inputs[i].value==data.usertype){
                    inputs[i].checked=true;
                }
            }
            $("#id").val(data.id);
            
            $("#exampleModalScrollable1").modal("toggle");
        }
        $('#exampleModalScrollable').on('submit', function() {
            var inputs = document.getElementsByName("usertype");
            for (var i = 0; i < inputs.length; ++i) {
                // if (inputs[i].checked) {
                    inputs[i].disabled = false;
                // }
                if(inputs[i].value==data.usertype){
                    inputs[i].checked=true;
                }
            }
    });
      </script> 
@endsection
