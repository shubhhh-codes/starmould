@extends('layouts.master')
@section('title') User Management @endsection
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
                    <button type="button" class="btn btn-outline-primary waves-effect waves-light mb-3" data-bs-toggle="modal" onclick="return Add();">Add User</button>
                    <!-- Add Modal Start -->
                    <div class="modal fade" id="exampleModalScrollable1" tabindex="-1" role="dialog" aria-labelledby="exampleModalScrollableTitle" aria-hidden="true">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content modal-lg modal-dialog-scrollable">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="exampleModalScrollableTitle">ADD NEW USER</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>                              
                                <form autocomplete="off" action="{{route('user.store')}}" id="userform" method="post" class="needs-validation" novalidate>
                                    @csrf
                                    <!-- Equivalent to... -->
                                    <input type="hidden" name="_token" value="{{ csrf_token() }}" />
                                <div class="modal-body">                                                                       
                                    <div class="mb-3 row">
                                        <label for="example-text-input" class="col-md-2 col-form-label">Name</label>
                                        <div class="col-md-10">
                                            <input class="form-control" type="text" id="example-text-input" name="name">
                                            <input class="form-control" type="hidden" id="id" name="id">
                                        </div>
                                    </div>
                                    <div class="mb-3 row">
                                        <label for="example-text-input" class="col-md-2 col-form-label">User Name</label>
                                        <div class="col-md-10">
                                            <input class="form-control" type="text" id="example-text-input1" name="username">
                                        </div>
                                    </div> 
                                    <div class="mb-3 row">
                                        <label for="example-text-input" class="col-md-2 col-form-label">Initials</label>
                                        <div class="col-md-10">
                                            <input class="form-control" type="text" id="example-text-input2" name="initials" maxlength="3" oninput="this.value = this.value.toUpperCase();" onblur="return checkinitial();">
                                            <div id="alertDiv"></div>
                                        </div>
                                    </div>   
                                    <div class="mb-3 row">
                                        <label for="example-email-input" class="col-md-2 col-form-label">Email</label>
                                        <div class="col-md-10">
                                            <input class="form-control" type="email" id="example-email-input3" name="email">
                                        </div>
                                    </div>  
                                    <div class="mb-3 row">
                                        <label for="example-password-input" class="col-md-2 col-form-label">Password</label>
                                        <div class="col-md-10">
                                            <input class="form-control" type="text" id="example-password-input4" name="password">
                                        </div>
                                    </div> 
                                    <div class="row">
                                        <label for="validationCustom03" class="col-md-2 col-form-label">User Type</label >
                                        <div class="col-md-2">                                                                                        
                                                <div class="form-check mb-3">
                                                    <input class="form-check-input" type="radio" name="usertype"  value="Admin" required>
                                                    <label class="form-check-label" for="formRadios1">
                                                        Admin
                                                    </label>
                                                </div>    
                                        </div>
                                        <div class="col-md-2">
                                                <div class="form-check">
                                                    <input class="form-check-input" type="radio" name="usertype" value="Manager" >
                                                    <label class="form-check-label" for="formRadios2">
                                                        Manager
                                                    </label>
                                                </div>  
                                        </div>
                                        <div class="col-md-2">
                                            <div class="form-check">
                                                <input class="form-check-input" type="radio" name="usertype" value="Supervisor" >
                                                <label class="form-check-label" for="formRadios2">
                                                    Supervisor
                                                </label>
                                            </div>  
                                        </div>
                                        <div class="col-md-2">
                                            <div class="form-check">
                                                <input class="form-check-input" type="radio" name="usertype" value="Designer" >
                                                <label class="form-check-label" for="formRadios2">
                                                    Designer
                                                </label>
                                            </div>  
                                        </div>
                                        <div class="col-md-2">
                                                <div class="form-check">
                                                    <input class="form-check-input" type="radio" name="usertype" value="User" >
                                                    <label class="form-check-label" for="formRadios3">
                                                        User
                                                    </label>
                                                </div>
                                        </div>
                                    </div>
                                    <div class="row">
                                        <label for="validationCustom03" class="col-md-2 col-form-label">User Subtype</label >
                                        {{-- <div class="col-md-2">                                                                                        
                                                <div class="form-check mb-3">
                                                    <input class="form-check-input" type="radio" name="usersubtype"  value="Manager" required>
                                                    <label class="form-check-label" for="formRadios1">
                                                        Manager
                                                    </label>
                                                </div>    
                                        </div> --}}
                                        <div class="col-md-2">
                                                <div class="form-check">
                                                    <input class="form-check-input" type="radio" name="usersubtype" value="Skilled MP" >
                                                    <label class="form-check-label" for="formRadios2">
                                                        Skilled MP
                                                    </label>
                                                </div>  
                                        </div>
                                        <div class="col-md-2">
                                                <div class="form-check">
                                                    <input class="form-check-input" type="radio" name="usersubtype" value="Unskilled MP" >
                                                    <label class="form-check-label" for="formRadios3">
                                                        Unskilled MP
                                                    </label>
                                                </div>
                                        </div>
                                        {{-- <div class="col-md-2">
                                            <div class="form-check">
                                                <input class="form-check-input" type="radio" name="usersubtype" value="Office Staff" >
                                                <label class="form-check-label" for="formRadios3">
                                                    Office Staff
                                                </label>
                                            </div>
                                        </div> --}}
                                        <div class="col-md-2">
                                            <div class="form-check">
                                                <input class="form-check-input" type="radio" name="usersubtype" value="Machine" >
                                                <label class="form-check-label" for="formRadios3">
                                                    Machine
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="mb-3 row">
                                        <label for="example-password-input" class="col-md-2 col-form-label">Status</label>
                                        <div class="col-md-10">
                                            <div class="form-check form-switch form-switch-md mb-3" dir="ltr">
                                                <input class="form-check-input" type="checkbox" id="SwitchCheckSizemd" name="status">
                                                {{-- <label class="form-check-label" for="SwitchCheckSizemd"></label> --}}
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
                                <th>Name</th>
                                <th>User Name</th>
                                <th>Initials</th>
                                <th>User Type</th>
                                <th>User Subtype</th>
                                <th>Email</th>
                                <th>Password</th> 
                                {{-- <th></th> --}}
                                {{-- @if (Auth::user()->role==0)
                                <th>status</th> 
                                @endif --}}
                                <th>Action</th>                                                        
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
             var url = "{{ route('user.delete',':id') }}";
             url = url.replace(':id', id);
             window.location.href=url;
         }
        }
        function checkinitial() 
        {
            var initials = $('#example-text-input2').val();
            $.ajax({
                type: 'POST',
                url: "{{ route('user.checkinitial') }}",
                data: {_token: "{{ csrf_token() }}", initials: initials},
                success: function(data) {
                    var alertDiv = $('#alertDiv');
                    var inputField = $('#example-text-input2');

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
    </script>
    <script type="text/javascript">
        $(function () {         
        $('#datatable-buttons5').DataTable({
              processing: true,
              serverSide: true,
              pageLength:50,
              ajax: "{{route('getuserdata')}}",
              columns: [
                  {data: 'name', name: 'name'},
                  {data: 'username', name: 'username'},                
                  {data: 'initials', name: 'initials'},
                  {data: 'usertype', name: 'usertype'},
                  {data: 'usersubtype', name: 'usersubtype'},
                  {data: 'email', name: 'email'},
                  {data: 'password', name: 'password'},
                //   {data: 'status', name: 'status'},
                  {data: 'action', name: 'action', orderable: false, searchable: false},                              
              ],
              "createdRow": function( row, data, dataIndex){
                        
                        if( data['status'] == 1  ){
                            $(row).css('background-color', '#c3f7bd');
                        }
                        else{
                            $(row).css('background-color', '#ffffff');
                        }
                    }
          });        
        });
        function Add(data,id) {
           // var data=JSON.parse(data.replaceAll("'","\""));
            //  $("exampleModalScrollableTitle").html("Edit Data");
            $('#userform').attr('action', "{{route('user.store')}}");
            $("#example-text-input").val("");
            $("#example-password-input4").val("");
            $("#example-text-input1").val("");
            $("#example-text-input2").val("");
            $("#example-email-input3").val("");
            var inputs = document.getElementsByName("usertype");
            for (var i = 0; i < inputs.length; ++i) {
                // if (inputs[i].checked) {
                    
                // }
              //  if(inputs[i].value==data.worktype){
                    inputs[i].checked=false;
             //   }
            }
            var inputs = document.getElementsByName("usersubtype");
            for (var i = 0; i < inputs.length; ++i) {
                // if (inputs[i].checked) {
                    
                // }
              //  if(inputs[i].value==data.worktype){
                    inputs[i].checked=false;
             //   }
            }
            $("#id").val();
           // $("#SwitchCheckSizemd").val("");
            $("#exampleModalScrollable1").modal("toggle");
            return false;
        }
        function Edit(data,id) {
            var data=JSON.parse(data.replaceAll("'","\""));
            //  $("exampleModalScrollableTitle").html("Edit Data");
            $('#userform').attr('action', "{{route('user.updatedata')}}");
            $("#example-text-input").val(data.name);
            $("#example-password-input4").val(data.password2);
            $("#example-text-input1").val(data.username);
            $("#example-text-input2").val(data.initials);
            $("#example-email-input3").val(data.email);
            var inputs = document.getElementsByName("usertype");
            for (var i = 0; i < inputs.length; ++i) {
                // if (inputs[i].checked) {
                    
                // }
                if(inputs[i].value==data.usertype){
                    inputs[i].checked=true;
                }
            }
            var inputs = document.getElementsByName("usersubtype");
            for (var i = 0; i < inputs.length; ++i) {
                // if (inputs[i].checked) {
                    
                // }
                if(inputs[i].value==data.usersubtype){
                    inputs[i].checked=true;
                }
            }
            $("#id").val(data.id);
           
            if(data.status==1){
              //  $("#SwitchCheckSizemd").val("On");
                $('#SwitchCheckSizemd').prop('checked', true);
            }else{
               // $("#SwitchCheckSizemd").val("Off");
                $('#SwitchCheckSizemd').prop('checked', false);
            }
            $("#exampleModalScrollable1").modal("toggle");
        }
      </script> 
      <script>
        const userTypeRadios = document.getElementsByName("usertype");
        const userSubtypeRadios = document.getElementsByName("usersubtype");

        // add event listener to the user type radio buttons
        for (let i = 0; i < userTypeRadios.length; i++) {
        userTypeRadios[i].addEventListener("change", function() {
            // check if the selected user type is admin
            if (this.value == "Admin" || this.value == "Manager" || this.value == "Supervisor" || this.value == "Designer") {
            // hide the non-skilled MP and machine options for user subtype
            for (let j = 0; j < userSubtypeRadios.length; j++) {
                if (userSubtypeRadios[j].value !== "Skilled MP") {
                userSubtypeRadios[j].parentNode.parentNode.style.display = "none";
                }
            }
            } else {
            // show all user subtype options
            for (let j = 0; j < userSubtypeRadios.length; j++) {
                userSubtypeRadios[j].parentNode.parentNode.style.display = "";
            }
            }
        });
        }
    </script>
@endsection
