@extends('layouts.master')
@section('title') Dispatch @endsection
@section('css')
<!-- DataTables -->
<!-- <link href="//cdnjs.cloudflare.com/ajax/libs/select2/4.0.0/css/select2.min.css" rel="stylesheet" /> -->
<link href="{{ URL::asset('/assets/libs/select2/select2.min.css') }}" rel="stylesheet" type="text/css" />
<link href="{{ URL::asset('/assets/libs/spectrum-colorpicker/spectrum-colorpicker.min.css') }}" rel="stylesheet" type="text/css">
<link href="{{ URL::asset('/assets/libs/bootstrap-touchspin/bootstrap-touchspin.min.css') }}" rel="stylesheet" type="text/css" />
<link href="{{ URL::asset('/assets/libs/datatables/datatables.min.css') }}" rel="stylesheet" type="text/css" />
<!-- <link href="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/css/select2.min.css" rel="stylesheet" /> -->

<!-- jQuery -->
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<!-- Bootstrap Bundle (includes Popper) -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<!-- Select2 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js"></script>



<style>
    .modal-dialog-scrollable {
        overflow-y: scroll;
        max-height: 80vh;
        /* You can adjust this value to fit your needs */
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
        background-color: unset !important;
        border-color: unset !important;
        border: 0px !important;
        border-radius: unset !important;
        margin-bottom: 0px !important;
    }

    select option:disabled {
        color: #888;
        /* Light gray text */
        background-color: #f0f0f0;
        /* Light background to emphasize disabled state */
        /* Italicized text for further emphasis */
        opacity: 0.6;
        /* Slight transparency */
    }

    select option[value=""]:disabled {
        color: #888;
        /* Light gray text */
        font-weight: bold;
        /* Make it bold for more emphasis */
        background-color: #f9f9f9;
        /* Lighter background for default option */
    }
</style>

@endsection
@section('content')

@component('components.breadcrumb')
@slot('li_1') Dispatch @endslot
@slot('title') Dispatch Data @endslot
@endcomponent

<div class="row">
    <div class="col-12">
        <div class="card">
            <div class="card-body">
                <div class="row">
                    <div class="col-10">
                        <!-- Modal Trigger Button -->
                        <button type="button" class="btn btn-primary btn-lg waves-effect waves-light" data-bs-toggle="modal" data-bs-target="#challanModal" style="margin-bottom: 10px;">
                            Add Dispatch Challan
                        </button>
                        <a href="{{ route('exportdispatchchallan') }}" type="button" class="btn btn-primary btn-lg waves-effect waves-light" style="margin-bottom: 10px;">Export</a>

                    </div>

                </div>
                <!-- Add Modal Start -->
                <div class="modal fade" id="challanModal" tabindex="-1" aria-labelledby="challanModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-xl">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="challanModalLabel">Add Dispatch Challan</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <form autocomplete="off" action="{{ route('dispatch.store') }}" id="userform" method="post" class="needs-validation" novalidate>
                                @csrf
                                <!-- Select2 -->
                                <link href="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/css/select2.min.css" rel="stylesheet" />
                                <script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-datepicker/1.9.0/js/bootstrap-datepicker.min.js"></script>

                                <div class="modal-body modal-dialog-scrollable">
                                    <input class="form-control" type="hidden" id="id" name="id">

                                    <style>
                                        .floating-label,
                                        .select2-float-wrapper {
                                            position: relative;
                                            margin-bottom: 1.5rem;
                                        }

                                        .floating-label input[type="text"] {
                                            width: 100%;
                                            padding: 14px 12px 6px 12px;
                                            font-size: 14px;
                                            border: 1px solid #ced4da;
                                            border-radius: 4px;
                                            background-color: white;
                                        }

                                        .floating-label label,
                                        .select2-float-wrapper label {
                                            position: absolute;
                                            top: 12px;
                                            left: 12px;
                                            background: white;
                                            color: #999;
                                            font-size: 14px;
                                            padding: 0 4px;
                                            pointer-events: none;
                                            transition: all 0.2s ease;
                                        }

                                        .floating-label input:focus+label,
                                        .floating-label input:not(:placeholder-shown)+label,
                                        .select2-float-wrapper.filled label {
                                            top: -6px;
                                            left: 10px;
                                            font-size: 11px;
                                            color: #0d6efd;
                                        }

                                        .select2-float-wrapper .select2-container--default .select2-selection--single {
                                            height: 46px;
                                            line-height: 46px;
                                            border: 1px solid #ced4da;
                                            border-radius: 4px;
                                            background-color: white;
                                            padding: 0 12px;
                                        }

                                        .select2-float-wrapper .select2-selection__rendered {
                                            line-height: 46px !important;
                                            padding-left: 0;
                                            padding-right: 30px;
                                        }

                                        .select2-float-wrapper .select2-selection__arrow {
                                            top: 10px !important;
                                        }
                                    </style>






                                    <!-- Row 1: Compact Input Fields -->
                                    <div class="row g-2">
                                        <div class="col" style="flex: 0 0 14%; max-width: 14%;">
                                            <div class="mb-3">
                                                <div class="input-group" id="datepicker">
                                                <input
                                                    type="text"
                                                    id="chdate"
                                                    name="chdate"
                                                    class="form-control"
                                                    placeholder="Pick a date"
                                                    data-provide="datepicker"
                                                    data-date-format="dd/mm/yyyy"
                                                    data-date-autoclose="true"
                                                    data-date-today-highlight="true"
                                                    data-date-container="#challanModal"
                                                    data-date-orientation="bottom left"
                                                    value="{{ $currentDateTime }}"
                                                    >
                                                    <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                                </div><!-- input-group -->
                                            </div>
                                            
                                        </div>

                                        <div class="col" style="flex: 0 0 14%; max-width: 14%;">
                                            <div class="floating-label">
                                                <input type="text" name="invoiceno" id="invoiceno" class="form-control" placeholder=" " required>
                                                <label for="invoiceno">Invoice No</label>
                                            </div>
                                        </div>

                                        <div class="col" style="flex: 0 0 14%; max-width: 14%;">
                                            <div class="floating-label">
                                                <input type="text" name="vehicleno" id="vehicleno" class="form-control" placeholder=" " required>
                                                <label for="vehicleno">Vehicle No</label>
                                            </div>
                                        </div>

                                        <div class="col" style="flex: 0 0 14%; max-width: 14%;">
                                            <div class="floating-label">
                                                <input type="text" name="freightcharge" id="freightcharge" class="form-control" placeholder=" " required>
                                                <label for="freightcharge">Freight Charge</label>
                                            </div>
                                        </div>

                                        <div class="col" style="flex: 0 0 10%; max-width: 10%;">
                                            <div class="floating-label">
                                                <input type="text" name="noofcases" id="noofcases" class="form-control" placeholder=" " required>
                                                <label for="noofcases">No. of Cases</label>
                                            </div>
                                        </div>

                                        <div class="col" style="flex: 0 0 17%; max-width: 17%;">
                                            <div class="select2-float-wrapper">
                                                <select class="form-control select2 select2-tag" name="deliverytype" id="deliverytype" required>
                                                    <option></option>
                                                    <option value="Door Delivery">Door Delivery</option>
                                                    <option value="Godown Delivery">Godown Delivery</option>
                                                    <option value="Door Pickup">Door Pickup</option>
                                                    <option value="Hand To Hand">Hand To Hand</option>
                                                </select>
                                                <label for="deliverytype">Delivery Type</label>
                                            </div>
                                        </div>

                                        <div class="col" style="flex: 0 0 17%; max-width: 17%;">
                                            <div class="select2-float-wrapper">
                                                <select class="form-control select2 select2-tag" name="freightmode" id="freightmode" required>
                                                    <option></option>
                                                    <option value="To Pay">To Pay</option>
                                                    <option value="Paid">Paid</option>
                                                </select>
                                                <label for="freightmode">Freight Mode</label>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Row 2: Big Dropdowns -->
                                    <div class="row mt-3">
                                        <div class="col-md-3">
                                            <div class="select2-float-wrapper">
                                                <select class="form-control select2" name="customerid" id="customerid" required onchange="lockDropdown(this);">
                                                    <option value="" disabled selected></option>
                                                    @foreach($datacus as $value)
                                                    <option value="{{ $value->id }}">{{ $value->customername }}</option>
                                                    @endforeach
                                                </select>
                                                <label for="customerid">Customer Name</label>
                                                <input type="hidden" name="customerid_hidden" id="customerid_hidden">
                                            </div>
                                        </div>

                                        <div class="col-md-3">
                                            <div class="select2-float-wrapper">
                                                <select class="form-control select2" name="vendortid" id="vendortid" required>
                                                    <option value="" disabled selected></option>
                                                    @foreach($datavendor as $value)
                                                    <option value="{{ $value->id }}">{{ $value->customername }}</option>
                                                    @endforeach
                                                </select>
                                                <label for="vendortid">Transporter Name</label>
                                            </div>
                                        </div>

                                        <div class="col-md-6">
                                            <div class="select2-float-wrapper">
                                                <select required class="form-control select2" name="projectid" id="projectid" onchange="return getplates();">
                                                    <option value="" disabled selected></option>
                                                </select>
                                                <label for="projectid">Mould Name</label>
                                            </div>
                                        </div>
                                    </div>





                                    <script>
                                        $(document).ready(function() {
                                            function initSelect2WithModalContext($modal) {
                                                $modal.find('.select2').each(function() {
                                                    const $select = $(this);

                                                    // Remove old select2 if already initialized
                                                    if ($select.hasClass("select2-hidden-accessible")) {
                                                        $select.select2('destroy');
                                                    }

                                                    $select.select2({
                                                        width: '100%',
                                                        tags: $select.hasClass('select2-tag'), // 👈 enables typing only for select2-tag
                                                        dropdownParent: $modal
                                                    }).on('change', function() {
                                                        const wrapper = $select.closest('.select2-float-wrapper');
                                                        if ($select.val()) {
                                                            wrapper.addClass('filled');
                                                        } else {
                                                            wrapper.removeClass('filled');
                                                        }
                                                    });

                                                    // Set float if already selected
                                                    if ($select.val()) {
                                                        $select.closest('.select2-float-wrapper').addClass('filled');
                                                    }
                                                });
                                            }

                                            // When modal shown, re-init inside it (only for Add mode, not Edit)
                                            $('#challanModal').on('shown.bs.modal', function() {
                                                // Only initialize if we're in Add mode (no id value)
                                                if (!$('#id').val()) {
                                                    initSelect2WithModalContext($(this));
                                                }
                                            });


                                            // Outside modal
                                            initSelect2WithModalContext($(document));
                                        });
                                       
                                    </script>

                                    <!-- Dynamic Plates -->
                                    <div id="dynamic-inputs" class="mt-3"></div>
                                    <button type="button" class="btn btn-primary mt-2 mb-3" id="add-input">Add Plate</button>
                                    <br>
                                    <button type="button" class="btn btn-outline-secondary mb-2" id="add-custom-input">Add Custom Plate</button>

                                    <!-- Dynamic Default Plates Block -->
                                    <div id="dynamic-inputs" class="mb-3"></div>

                                    <!-- Custom Plates Block -->
                                    <div id="custom-inputs" class="mb-3" style="border-color: #ccc !important; display:none;">

                                    </div>
                                    <button type="button" class="btn btn-outline-secondary mb-2" style="display:none;" id="add-custom-input-duplicate">Add Custom Plate</button>

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
                <table id="datatable-buttons5" class="table table-sm m-0 table-responsive">
                    <thead>
                        <tr>
                            <th style="width: 3%;"></th>
                            <th></th>
                            <th style="width: 7%;">Dispatch No</th>
                            <th style="width: 7%;">Date</th>
                            <th style="width: 17%;">Customer name</th>
                            {{-- <th style="width: 8%;">Mould</th> --}}
                            {{-- <th style="width: 19%;">Customer name</th> --}}
                            <th style="width: 11%;">Transporter</th>
                            <th style="width: 7%;">Invoice No</th>
                            <th style="width: 7%;">Vehicle No</th>
                            <th style="width: 8%;">Delivery Type</th>
                            <!-- <th style="width: 6%;">F.Mode</th> -->
                            <!-- <th style="width: 6%;">F.Charge</th> -->
                            <!-- <th style="width: 6%;">Cases</th> -->
                            {{-- <th>Particulars</th>
                                <th>Description</th> --}}
                            {{-- <th>Qty</th> --}}

                            {{-- <th></th> --}}
                            {{-- @if (Auth::user()->role==0)
                                <th>status</th> 
                                @endif --}}
                            <!-- <th style="width: 8%;">User</th> -->
                            <th style="width: 10%;">Action</th>
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
<script src="{{ URL::asset('/assets/libs/spectrum-colorpicker/spectrum-colorpicker.min.js') }}"></script>
<script src="{{ URL::asset('/assets/libs/bootstrap-touchspin/bootstrap-touchspin.min.js') }}"></script>
<script src="{{ URL::asset('/assets/libs/bootstrap-maxlength/bootstrap-maxlength.min.js') }}"></script>
<!-- form advanced init -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/timepicker/1.3.5/jquery.timepicker.min.js"></script>
<link href="https://cdnjs.cloudflare.com/ajax/libs/timepicker/1.3.5/jquery.timepicker.min.css" rel="stylesheet" />

<script src="{{ URL::asset('/assets/js/pages/form-advanced.init.js') }}"></script>
<script src="{{ URL::asset('/assets/libs/jszip/jszip.min.js') }}"></script>
<script src="{{ URL::asset('/assets/libs/pdfmake/pdfmake.min.js') }}"></script>
<!-- Datatable init js -->
<script src="{{ URL::asset('/assets/js/pages/datatables.init.js') }}"></script>
<script src="{{ URL::asset('/assets/libs/parsleyjs/parsleyjs.min.js') }}"></script>
<script src="{{ URL::asset('/assets/js/pages/form-validation.init.js') }}"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js"></script>
{{-- <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script> --}}
<script>
    function AskToDelete(id) {
        if (window.confirm("Do you really want to delete?")) {
            var url = "{{ route('dispatch.delete',':id') }}";
            url = url.replace(':id', id);
            window.location.href = url;
        }
    }
</script>

<script type="text/javascript">
    // Setup CSRF token for all AJAX requests
    $.ajaxSetup({
        headers: {
            'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
        }
    });

    function format(d) {
        // Create a table HTML string for the child table
        var childTable = '<table class="table mb-0" style="background-color: gainsboro;">';
        childTable += '<thead>';
        childTable += '<tr class="table-primary">';
        childTable += '<th>Plate Name</th>';
        // childTable += '<th>Customer Name</th>';
        childTable += '<th>Mould</th>';
        childTable += '<th>Description</th>';
        childTable += '<th>Particulars</th>';
        childTable += '<th>Condition</th>';
        childTable += '<th>Work</th>';
        childTable += '<th>Qty</th>';
        // Add more child table columns as needed
        childTable += '</tr>';
        childTable += '</thead>';
        childTable += '<tbody>';
        // Iterate through the child data and generate rows
        for (var i = 0; i < d.length; i++) {
            childTable += '<tr>';
            childTable += '<td>' + d[i].platename + '</td>';
            // childTable += '<td>' + d[i].customername + '</td>';
            childTable += '<td>' + d[i].project + '</td>';
            childTable += '<td>' + d[i].description + '</td>';
            childTable += '<td>' + d[i].particulars + '</td>';
            childTable += '<td>' + d[i].condition + '</td>';
            childTable += '<td>' + d[i].work + '</td>';
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
            order: [
                [1, 'desc']
            ],
            processing: true,
            serverSide: true,
            pageLength: 100,
            ajax: "{{route('getdispatchdata')}}",
            columns: [{

                    className: "details-control",
                    orderable: false,
                    data: null,
                    defaultContent: '<i class="fas fa-chevron-down"></i>'
                },
                {
                    data: 'id',
                    name: 'id',
                    'visible': false
                },
                {
                    data: 'challanno',
                    name: 'challanno',
                    orderable: true
                },
                {
                    data: {
                        '_': 'chdate.display',
                        'sort': 'chdate.timestamp'
                    },
                    name: 'chdate',
                    orderable: true
                },
                // {data: 'projectid', name:'projectid',orderable: true},
                // {data: 'vendorid', name: 'vendorid',orderable: true}, 
                {
                    data: 'customerid',
                    name: 'customerid',
                    orderable: true
                },
                {
                    data: 'vendortid',
                    name: 'vendortid',
                    orderable: true
                },
                {
                    data: 'invoiceno',
                    name: 'invoiceno',
                    orderable: true
                },
                {
                    data: 'vehicleno',
                    name: 'vehicleno',
                    orderable: true
                },
                {
                    data: 'deliverytype',
                    name: 'deliverytype',
                    orderable: true
                },
                // {data: 'freightmode', name: 'freightmode',orderable: true},
                // {data: 'freightcharge', name: 'freightcharge',orderable: true},
                // {data: 'noofcases', name: 'noofcases',orderable: true},    

                // {data: 'created_by', name: 'created_by',orderable: true}, 
                //  {data: 'qty', name: 'qty'},
                {
                    data: 'action',
                    name: 'action',
                    orderable: false,
                    searchable: false
                },
            ],
            columnDefs: [{
                targets: [2], // Index of the challanno column
                render: function(data, type, row) {
                    if (data.startsWith('SM/JW/')) {
                        var numericValue = data.replace('SM/JW/', '');
                        return 'SM/JW/' + numericValue;
                    }
                    return data;
                },
                type: 'string'
            }]
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

            if (row.child.isShown()) {
                // If the child table is already shown, hide it
                row.child.hide();
                tr.removeClass('shown');
            } else {
                // If the child table is not shown, retrieve the child data and display the child table
                var rowData = row.data();

                // Make an AJAX call to fetch the child table data
                $.ajax({
                    url: '{{route("getdispatchitems")}}',
                    data: {
                        dispatchid: rowData.id,
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

    function prepareAddModal() {
        const modal = document.getElementById('challanModal');
        if (!modal) return;

        // Reset form fields
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }

        // Manually clear input values
        const inputs = modal.querySelectorAll('input[type="text"], input[type="hidden"], textarea');
        inputs.forEach(input => {
            // Don't clear the CSRF token
            if (input.name === '_token') return;
            input.value = '';
        });

        // Reset select elements
        const selects = modal.querySelectorAll('select');
        selects.forEach(select => {
            select.selectedIndex = 0;
        });

        // Reset Select2 elements
        $(modal).find('.select2').each(function() {
            $(this).val(null).trigger('change');
        });

        // Clear dynamically added content
        const dynamicContent = modal.querySelector('#dynamic-inputs');
        if (dynamicContent) {
            dynamicContent.innerHTML = '';
        }
        const customContent = modal.querySelector('#custom-inputs');
        if (customContent) {
            customContent.innerHTML = '';
            customContent.style.display = 'none';
        }

        // Restore button visibility
        const addCustomButton = modal.querySelector('#add-custom-input');
        if (addCustomButton) {
            addCustomButton.style.display = 'block';
        }
        const addCustomDuplicateButton = modal.querySelector('#add-custom-input-duplicate');
        if (addCustomDuplicateButton) {
            addCustomDuplicateButton.style.display = 'none';
        }

        // Set the title for 'Add' operation
        const modalTitle = modal.querySelector('.modal-title');
        if (modalTitle) {
            modalTitle.textContent = 'Add Dispatch Challan';
        }

        // Set the form action for 'Add' operation
        const formElement = modal.querySelector('form');
        if (formElement) {
            formElement.action = "{{ route('dispatch.store') }}";
        }

        // Set the current date
        const dateInput = modal.querySelector('#chdate');
        if (dateInput) {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            dateInput.value = `${day}/${month}/${year}`;
        }
    }

    // Bind to the 'Add' button's click event
    $(document).ready(function() {
        $('button[data-bs-target="#challanModal"]').on('click', function() {
            prepareAddModal();
        });
    });

    $(document).ready(function() {
        $(".select2").select2({
            dropdownParent: $("#exampleModalScrollable1")
        });
        $("#select2").select2({
            dropdownParent: $("#exampleModalScrollable1")
        });
    });
    $(document).on('focus', '.select2.select2-container', function(e) {
        // only open on original attempt - close focus event should not fire open
        if (e.originalEvent && $(this).find(".select2-selection--single").length > 0) {
            $(this).siblings('select').select2('open');
        }
    });
    $(document).on('select2:open', () => {
        document.querySelector('.select2-search__field').focus();
    });
    $(document).ready(function() {
        $(".select22").select2({
            dropdownParent: $("#exampleModalScrollable1")
        });
        $("#select22").select2({
            dropdownParent: $("#exampleModalScrollable1")
        });
    });
    $(document).ready(function() {
        $(".select222").select2({
            dropdownParent: $("#exampleModalScrollable1")
        });
        $("#select222").select2({
            dropdownParent: $("#exampleModalScrollable1")
        });
    });
    $(document).ready(function() {
        $(".select2222").select2({
            dropdownParent: $("#exampleModalScrollable1")
        });
        $("#select2222").select2({
            dropdownParent: $("#exampleModalScrollable1")
        });
    });
    // $(document).ready(function() {
    //     $(".freightmode").select2({
    //     dropdownParent: $("#exampleModalScrollable1")
    //   });
    //   $("#freightmode").select2({
    //     dropdownParent: $("#exampleModalScrollable1")
    //   });
    // });
    $(document).ready(function() {
        $('#freightmode').select2({
            tags: true, // Enable custom values
            dropdownParent: $('#exampleModalScrollable1'),
            placeholder: "Select or Type Freight Mode",
            allowClear: true
        });
    });
    $(document).ready(function() {
        $('#deliverytype').select2({
            tags: true, // Enable custom values
            dropdownParent: $('#exampleModalScrollable1'),
            placeholder: "Select or Type Delivery Type",
            allowClear: true
        });
    });

    var project = "";

    function getproject() {
        $.ajax({
            type: 'POST',
            url: "{{route('customer.getprojects')}}",
            data: {
                _token: "{{ csrf_token() }}",
                cid: $("#customerid").val()
            },
            success: function(data) {
                $("#projectid").html(data);
                if (project != "") {
                    $("#projectid").val(project).trigger('change');
                }
            }
        });
    }

    function Edit(data) {
        var data = JSON.parse(data);
        console.log(data);
        project = data.projectid;

        // Change modal title and form action for editing
        $('#challanModalLabel').text('Edit Dispatch Challan');
        $('#userform').attr('action', "{{ route('dispatch.store') }}"); // Assuming store handles update

        // Clear out previous data from modal
        $('#dynamic-inputs').empty();
        $('#custom-inputs').empty();
        $('.header-row').remove();
        $('#custom-inputs').hide();
        $('#add-custom-input-duplicate').hide();
        $('#add-custom-input').show();

        // Reset and re-populate dropdowns to ensure all options are available
        // Customer dropdown - reset to show all options, then set selected value
        $("#customerid").prop('disabled', false); // Ensure it's not disabled
        $("#customerid").val(data.customerid).trigger('change');
        
        // Transporter dropdown - reset to show all options, then set selected value  
        $("#vendortid").val(data.vendortid).trigger('change');
        
        // Other form fields
        $("#id").val(data.id);
        $("#chdate").val(data.chdate);
        $("#invoiceno").val(data.invoiceno);
        $("#vehicleno").val(data.vehicleno);
        $("#freightcharge").val(data.freightcharge);
        $("#noofcases").val(data.noofcases);
        $("#deliverytype").val(data.deliverytype).trigger('change');
        $("#freightmode").val(data.freightmode).trigger('change');
        
        // getproject() is called by customerid change event.
        // It will then set the projectid using the global 'project' variable.
        
        $("#challanModal").modal("show");

        // Use setTimeout to ensure modal is fully shown and Select2 is initialized
        setTimeout(function() {
            // Re-initialize Select2 dropdowns to ensure they show all options
            $('#challanModal .select2').each(function() {
                const $select = $(this);
                
                // Remove old select2 if already initialized
                if ($select.hasClass("select2-hidden-accessible")) {
                    $select.select2('destroy');
                }
                
                // Re-initialize Select2 with modal context
                $select.select2({
                    width: '100%',
                    tags: $select.hasClass('select2-tag'),
                    dropdownParent: $('#challanModal')
                }).on('change', function() {
                    const wrapper = $select.closest('.select2-float-wrapper');
                    if ($select.val()) {
                        wrapper.addClass('filled');
                    } else {
                        wrapper.removeClass('filled');
                    }
                });
                
                // Set float if already selected
                if ($select.val()) {
                    $select.closest('.select2-float-wrapper').addClass('filled');
                }
            });
            // Fetch plate data using the same endpoint as add modal
            $.ajax({
                url: "{{route('customer.getdispatchprojectsubplatesview')}}",
                type: 'POST',
                data: {
                    _token: "{{ csrf_token() }}",
                    projectid: data.projectid
                },
                success: function(plateResponse) {
                    var platenames = plateResponse.data || [];
                    
                    // Also fetch existing dispatch items
                    $.ajax({
                        url: '{{route("getchallanitems")}}',
                        data: { dispatchid: data.id, projectid: data.projectid, _token: "{{csrf_token()}}" },
                        type: 'POST',
                        dataType: 'json',
                        success: function(response) {

                // --- Headers for plates ---
                if (data.dispatch_items && data.dispatch_items.some(item => !item.custom_plate_name)) {
                    $('#dynamic-inputs').before(`
                        <div class="row header-row fw-bold mb-2" style="font-size: 14px;">
                            <div class="col-md-2 pe-1 px-1" style="width: 200px;">Sub plate</div>
                            <div class="col-md-2 pe-1 px-1" style="width: 140px;">Mould</div>
                            <div class="col-md-1 pe-1 px-1" style="width: 400px;">Particulars</div>
                            <div class="col-md-1 pe-1 px-1" style="width: 140px;">Condition</div>
                            <div class="col-md-1 pe-1 px-1" style="width: 140px;">Work</div>
                            <div class="col-md-1 pe-1 px-1" style="width: 75px;">Qty</div>
                            <div class="col-md-1 pe-1 px-1" style="width: 80px;">Avail. Qty</div>
                            <div class="col-md-1 pe-1 px-1">Action</div>
                        </div>
                    `);
                }

                if (data.dispatch_items && data.dispatch_items.some(item => item.custom_plate_name)) {
                    $('#custom-inputs').show();
                    $('#add-custom-input-duplicate').show();
                    $('#add-custom-input').hide();
                    $('#custom-inputs').prepend(`
                        <div class="row header-row fw-bold mb-2" style="font-size: 14px;">
                            <div class="col-md-2 pe-1 px-1" style="width: 200px;">Custom Plate Name</div>
                            <div class="col-md-2 pe-1 px-1" style="width: 140px;">Mould</div>
                            <div class="col-md-2 pe-1 px-1" style="width: 400px;">Particulars</div>
                            <div class="col-md-2 pe-1 px-1" style="width: 140px;">Condition</div>
                            <div class="col-md-2 pe-1 px-1" style="width: 140px;">Work</div>
                            <div class="col-md-1 pe-1 px-1" style="width: 75px;">Qty</div>
                            <div class="col-md-1 pe-1 px-1">Action</div>
                        </div>
                    `);
                }

                // --- Populate plate rows ---
                if(data.dispatch_items) {
                    let plateIndex = 0, customIndex = 0;
                    data.dispatch_items.forEach(function(item) {
                        if (item.custom_plate_name) {
                            addFetchedCustomPlateRow(item, customIndex++);
                        } else {
                            addFetchedPlateRow(item, plateIndex++, platenames);
                        }
                    });
                }

                // --- Re-initialize plugins ---
                // Initialize Select2 for all select222 elements in the modal
                $('#challanModal .select222').each(function() {
                    const $select = $(this);
                    
                    // Remove old select2 if already initialized
                    if ($select.hasClass("select2-hidden-accessible")) {
                        $select.select2('destroy');
                    }
                    
                    // Initialize Select2 with modal context
                    $select.select2({
                        dropdownParent: $("#challanModal"),
                        width: '100%'
                    });
                });
                
                getSelectedPlates();
                disableSelectedOptions();
                        }
                    });
                }
            });
        }, 100); // Wait 100ms for modal to be fully shown
    }


function addFetchedPlateRow(plate, index, platenames) {
    // Find the correct plate name & available qty
    console.log('Plate names',platenames);
    console.log('Current plate data:', plate);
    let currentPlate = platenames.find(p => p.plateid == plate.plateid);
    let options = '<option value="" disabled>Select a plate</option>';
    platenames.forEach(function(p) {
        let plateId = p.plateid;
        let pqty = p.pqty || 0; // Handle undefined pqty
        let selected = (plateId == plate.plateid) ? 'selected' : '';
        options += `<option value="${plateId},${pqty}" ${selected}>${p.platename}</option>`;
    });

    let platename = currentPlate ? currentPlate.platename : '';

    let rowHtml = `
    <div class="row mb-1">
        <div class="col-md-2 pe-1 px-1" style="width: 200px;">
            <input type="hidden" class="form-control" name="pids[]" value="${plate.id || ''}">
            <input type="hidden" class="form-control" name="dispatchid[]" value="${plate.dispatchid || ''}">
            <select name="categories[]" class="form-control select222" required onchange="return updatedata('${index}',this.value);">
                ${options}
            </select>
        </div>
        <input type="hidden" class="form-control" name="customer[]" value="${plate.customer || ''}">
        <input type="hidden" class="form-control" value="" readonly>
        <div class="col-md-2 pe-1 px-1" style="width: 140px;">
            <input type="text" class="form-control" name="project[]" value="${plate.project || ''}" readonly>
        </div>
        <div class="col-md-1 pe-1 px-1" style="width: 400px;">
            <textarea class="form-control" name="particulars[]" style="height: 28px;" required>${plate.particulars || ''}</textarea>
            <div class="invalid-feedback">Please Enter Particulars</div>
        </div>
        <div class="col-md-1 pe-1 px-1" style="width: 140px;">
            <textarea class="form-control" name="condition[]" style="height: 28px;" required>${plate.condition || ''}</textarea>
            <div class="invalid-feedback">Please Enter Condition</div>
        </div>
        <div class="col-md-1 pe-1 px-1" style="width: 140px;">
            <textarea class="form-control" name="work[]" style="height: 28px;" required>${plate.work || ''}</textarea>
            <div class="invalid-feedback">Please Enter Work</div>
        </div>
        <div class="col-md-1 pe-1 px-1" style="width: 75px;">
            <input class="form-control" type="text" name="qty[]" id="qty${index}" value="${plate.qty || ''}" onchange="qtyChanged('${index}', this.value)" required>
            <div id="alertDiv${index}"></div>
            <div class="invalid-feedback">Please Enter Qty</div>
        </div>
        <div class="col-md-1 pe-1 px-1" style="width: 75px;">
            <input class="form-control" type="text" id="sqty${index}" value="" disabled>
        </div>
        <div class="col-md-1 pe-1 px-1">
            <button type="button" class="btn btn-danger waves-effect waves-light delete-input">Delete</button>
        </div>
    </div>
    `;
    
    // Append the row first
    $('#dynamic-inputs').append(rowHtml);
    
    // Initialize Select2 for the newly added dropdown
    const $newSelect = $('#dynamic-inputs').find(`select[name='categories[]']:last`);
    if ($newSelect.length) {
        // Remove old select2 if already initialized
        if ($newSelect.hasClass("select2-hidden-accessible")) {
            $newSelect.select2('destroy');
        }
        
        // Initialize Select2 with modal context
        $newSelect.select2({
            dropdownParent: $("#challanModal"),
            width: '100%'
        });
        
        // If there's a selected value, trigger the updatedata function to populate available quantity
        const selectedValue = $newSelect.val();
        if (selectedValue) {
            updatedata(index, selectedValue, true); // true = preserve qty in edit mode
        }
    }
}

function addFetchedCustomPlateRow(plate, index) {
    let rowHtml = `
    <div class="row mb-1">
        <input type="hidden" name="categories[]" value="">
        <div class="col-md-2 pe-1 px-1" style="width: 200px;">
            <input type="hidden" class="form-control" name="pids[]" value="${plate.id || ''}">
            <input type="hidden" class="form-control" name="dispatchid[]" value="${plate.dispatchid || ''}">
            <input type="text" class="form-control" name="custom_plate_name[]" value="${plate.custom_plate_name || ''}" placeholder="e.g. PLATE-X" required>
        </div>
        <input type="hidden" name="customer[]" value="${plate.customer || ''}">
        <input type="hidden" class="form-control" value="" readonly>
        <div class="col-md-2 pe-1 px-1" style="width: 140px;">
            <input type="text" class="form-control" name="project[]" value="${plate.project || ''}" readonly>
        </div>
        <div class="col-md-2 pe-1 px-1" style="width: 400px;">
            <textarea class="form-control" name="particulars[]" style="height: 28px;" required>${plate.particulars || ''}</textarea>
            <div class="invalid-feedback">Please Enter Particulars</div>
        </div>
        <div class="col-md-2 pe-1 px-1" style="width: 140px;">
            <textarea class="form-control" name="condition[]" style="height: 28px;" required>${plate.condition || ''}</textarea>
            <div class="invalid-feedback">Please Enter Condition</div>
        </div>
        <div class="col-md-2 pe-1 px-1" style="width: 140px;">
            <textarea class="form-control" name="work[]" style="height: 28px;" required>${plate.work || ''}</textarea>
            <div class="invalid-feedback">Please Enter Work</div>
        </div>
        <div class="col-md-1 pe-1 px-1" style="width: 75px;">
            <input type="text" class="form-control" name="custom_plate_qty[]" value="${plate.custom_plate_qty || plate.qty || ''}" placeholder="Qty" required>
        </div>
        <div class="col-md-1 pe-1 px-1">
            <button type="button" class="btn btn-danger waves-effect waves-light delete-input">Delete</button>
        </div>
    </div>
    `;
    $('#custom-inputs').append(rowHtml);
}



</script>
{{--
<script>
    function getplates(){
       // $('#dynamic-inputs').empty();
    }

    var selectedPlateId;
    function updatedata(index, val){
        console.log(val);
        selectedPlateId = val.split(",")[0];
        $("#sqty" + index).val(val.split(",")[1]);
    }

    var idindex = 1;

    $(document).ready(function() {
        $('#select222').select2();

        $('#add-input').click(function() {
            $.ajax({
                url: "{{ route('customer.getdispatchprojectsubplatesview') }}",
type: 'POST',
data: {
_token: "{{ csrf_token() }}",
projectid: $("#projectid").val()
},
success: function(response) {
var data = response.data;
var idd = $("#id").val();
var options = '', input = '', tempsqty = '';

for (var i = 0; i < data.length; i++) { var value=data[i]; if (tempsqty==="" ) { tempsqty=value.pqty; } options +='<option value="' + value.plateid + ',' + value.pqty + '"' ; if (value.plateid==selectedPlateId) { options +=' selected disabled' ; } options +='>' + value.platename + '</option>' ; } input +='<div class="row">' + '<div class="col" style="padding-right: unset;">' + '<div class="mb-3">' + '<input class="form-control" type="hidden" id="pid" name="pids[]" value="">' + '<input class="form-control" type="hidden" id="challan" name="dispatchid[]" value="' + idd + '">' + '<label class="form-label">Sub plate</label>' + '<select name="categories[]" class="form-control select222" required onchange="return updatedata(\'' + idindex + ' \',this.value);">' +
    options +
    '</select>' +
    '</div>' +
    '</div>' +

    '<div class="col" style="padding-right: unset;">' +
        '<div class="mb-3">' +
            '<label for="description" class="form-label">Customer Name</label>' +
            '<input class="form-control" type="hidden" name="customer[]" id="customer" value="' + $(" #customerid").val() + '">' + '<input class="form-control" type="text" value="' + $("#customerid option:selected").text() + '" readonly>' + '</div>' + '</div>' + '<div class="col" style="padding-right: unset;">' + '<div class="mb-3">' + '<label for="description" class="form-label">Mould</label>' + '<input class="form-control" type="text" name="project[]" id="project" value="' + $("#projectid").val() + '" readonly>' + '</div>' + '</div>' + '<div class="col" style="padding-right: unset;">' + '<div class="mb-3">' + '<label for="description" class="form-label">Particulars</label>' + '<textarea required class="form-control" name="particulars[]" style="height: 20px;"></textarea>' + '<div class="invalid-feedback">Please Enter Particulars</div>' + '</div>' + '</div>' + '<div class="col-1" style="padding-right: unset;">' + '<div class="mb-3">' + '<label for="description" class="form-label">Qty</label>' + '<input class="form-control" type="text" name="qty[]" id="qty' + idindex + '" onchange="qtyChanged(\'' + idindex + ' \', this.value)" required>' +
            '<div id="alertDiv' + idindex + '"></div>' +
            '<div class="invalid-feedback">Please Enter Qty</div>' +
            '</div>' +
        '</div>' +

    '<div class="col" style="padding-right: unset;">' +
        '<div class="mb-3">' +
            '<label for="description" class="form-label">Available Qty</label>' +
            '<input class="form-control" type="text" id="sqty' + idindex + '" value="' + tempsqty + '" disabled>' +
            '</div>' +
        '</div>' +

    '<div class="col" style="padding-right: unset;">' +
        '<div class="mb-3 mt-4">' +
            '<label class="form-label">&nbsp;</label>' +
            '<button type="button" class="btn btn-danger waves-effect waves-light delete-input">Delete</button>' +
            '</div>' +
        '</div>' +
    '</div>';

    $('#dynamic-inputs').append(input);
    $('#select222').select2();
    },
    error: function() {
    alert('Failed to fetch dropdown options.');
    }
    });
    idindex++;
    });

    $(document).on('click', '.delete-input', function() {
    $(this).closest('.row').remove();
    });
    });
    </script>
    --}}

    <script>
        function getplates() {
            //  $('#dynamic-inputs').empty();
        }
        var selectedPlates = [];
        var idindex = 1; // Make sure idindex is defined globally

        function getSelectedPlates() {
            selectedPlates = [];
            $("select[name='categories[]']").each(function() {
                var val = $(this).val();
                if (val) {
                    selectedPlates.push(val.split(",")[0]); // Add only plateid to the list
                }
            });
        }

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

        function updatedata(index, val, preserveQty = false) {
            console.log('updatedata called with:', val, 'preserveQty:', preserveQty);
            selectedPlateId = val.split(",")[0];
            var availableQty = val.split(",")[1];
            
            // Set available quantity, handle undefined values
            $("#sqty" + index).val(availableQty || '0');
            
            // Only clear qty if not preserving (i.e., in Add mode, not Edit mode)
            if (!preserveQty) {
                $("#qty" + index).val("");
            }
            
            // Update the selected plates list
            getSelectedPlates();
            // Disable the selected options in other selects
            disableSelectedOptions();
        }

        $(document).ready(function() {
            $('#select222').select2();

            $('#add-input').click(function() {
                $.ajax({
                    url: "{{route('customer.getdispatchprojectsubplatesview')}}",
                    type: 'POST',
                    data: {
                        _token: "{{ csrf_token() }}",
                        projectid: $("#projectid").val()
                    },
                    success: function(response) {
                        var data = response.data;
                        var idd = $("#id").val();
                        var options = '';
                        var input = '',
                            tempsqty = '';

                        // Only insert label row once
                        if ($('#dynamic-inputs').prev('.header-row').length === 0) {
                            $('#dynamic-inputs').before(`
                        <div class="row header-row fw-bold mb-2" style="font-size: 14px;">
                            <div class="col-md-2 pe-1 px-1" style="width: 200px;">Sub plate</div>
                            <div class="col-md-2 pe-1 px-1" style="width: 140px;">Mould</div>
                            <div class="col-md-1 pe-1 px-1" style="width: 400px;">Particulars</div>
                            <div class="col-md-1 pe-1 px-1" style="width: 140px;">Condition</div>
                            <div class="col-md-1 pe-1 px-1" style="width: 140px;">Work</div>
                            <div class="col-md-1 pe-1 px-1" style="width: 75px;">Qty</div>
                            <div class="col-md-1 pe-1 px-1" style="width: 80px;">Avail. Qty</div>
                            <div class="col-md-1 pe-1 px-1">Action</div>
                        </div>
                    `);
                        }

                        options = '<option value="" disabled selected>Select a plate</option>';
                        for (var i = 0; i < data.length; i++) {
                            var value = data[i];
                            if (tempsqty === "") tempsqty = value.pqty;
                            options += '<option value="' + value.plateid + ',' + value.pqty + '"';
                            if (selectedPlates.includes(value.plateid)) options += ' disabled';
                            options += '>' + value.platename + '</option>';
                        }

                        input += '<div class="row mb-1">';

                        input += '<div class="col-md-2 pe-1 px-1" style="width: 200px;">' +
                            '<div class="">' +
                            '<input type="hidden" class="form-control" name="pids[]" value="">' +
                            '<input type="hidden" class="form-control" name="dispatchid[]" value="' + idd + '">' +
                            '<select name="categories[]" class="form-control select222" required onchange="return updatedata(\'' + idindex + '\',this.value);">' +
                            options +
                            '</select>' +
                            '</div>' +
                            '</div>';

                        input += '<input type="hidden" class="form-control" name="customer[]" value="' + $("#customerid").val() + '">' +
                            '<input type="hidden" class="form-control" value="' + $("#customerid option:selected").text() + '" readonly>';

                        input += '<div class="col-md-2 pe-1 px-1" style="width: 140px;">' +
                            '<div class="">' +
                            '<input type="text" class="form-control" name="project[]" value="' + $("#projectid").val() + '" readonly>' +
                            '</div>' +
                            '</div>';

                        input += '<div class="col-md-1 pe-1 px-1" style="width: 400px;">' +
                            '<div class="">' +
                            '<textarea class="form-control" name="particulars[]" style="height: 28px;" required></textarea>' +
                            '<div class="invalid-feedback">Please Enter Particulars</div>' +
                            '</div>' +
                            '</div>';

                        input += '<div class="col-md-1 pe-1 px-1" style="width: 140px;">' +
                            '<div class="">' +
                            '<textarea class="form-control" name="condition[]" style="height: 28px;" required></textarea>' +
                            '<div class="invalid-feedback">Please Enter Condition</div>' +
                            '</div>' +
                            '</div>';

                        input += '<div class="col-md-1 pe-1 px-1" style="width: 140px;">' +
                            '<div class="">' +
                            '<textarea class="form-control" name="work[]" style="height: 28px;" required></textarea>' +
                            '<div class="invalid-feedback">Please Enter Work</div>' +
                            '</div>' +
                            '</div>';

                        input += '<div class="col-md-1 pe-1 px-1" style="width: 75px;">' +
                            '<div class="">' +
                            '<input class="form-control" type="text" name="qty[]" id="qty' + idindex + '" onchange="qtyChanged(\'' + idindex + '\', this.value)" required>' +
                            '<div id="alertDiv' + idindex + '"></div>' +
                            '<div class="invalid-feedback">Please Enter Qty</div>' +
                            '</div>' +
                            '</div>';

                        input += '<div class="col-md-1 pe-1 px-1" style="width: 75px;">' +
                            '<div class="">' +
                            '<input class="form-control" type="text" id="sqty' + idindex + '" value="" disabled>' +
                            '</div>' +
                            '</div>';

                        input += '<div class="col-md-1 pe-1 px-1">' +
                            '<div class="">' +
                            '<button type="button" class="btn btn-danger waves-effect waves-light delete-input">Delete</button>' +
                            '</div>' +
                            '</div>';

                        input += '</div>';

                        $('#dynamic-inputs').append(input);
                        $('#select222').select2();

                        getSelectedPlates();
                        disableSelectedOptions();
                        idindex++;
                    },
                    error: function() {
                        alert('Failed to fetch dropdown options.');
                    }
                });
            });

            $(document).on('click', '.delete-input', function() {
                $(this).closest('.row').remove();

                if ($('#custom-inputs .row').length === 1) {
                    $('#custom-inputs .header-row').remove(); // Remove label row if no input
                }
                if ($('#dynamic-inputs .row').length === 0) {
                    $('.header-row').remove(); // Remove simple label if all rows deleted
                }

                getSelectedPlates();
                disableSelectedOptions();
            });

            $('#add-custom-input, #add-custom-input-duplicate').click(function() {
                $('#custom-inputs').show();
                $('#add-custom-input-duplicate').show();
                $('#add-custom-input').hide();

                // Only insert label row once
                if ($('#custom-inputs .row.header-row').length === 0) {
                    $('#custom-inputs').prepend(`
                <div class="row header-row fw-bold mb-2" style="font-size: 14px;">
                    <div class="col-md-2 pe-1 px-1" style="width: 200px;">Custom Plate Name</div>
                    <div class="col-md-2 pe-1 px-1" style="width: 140px;">Mould</div>
                    <div class="col-md-2 pe-1 px-1" style="width: 400px;">Particulars</div>
                    <div class="col-md-2 pe-1 px-1" style="width: 140px;">Condition</div>
                    <div class="col-md-2 pe-1 px-1" style="width: 140px;">Work</div>
                    <div class="col-md-1 pe-1 px-1" style="width: 75px;">Qty</div>
                    <div class="col-md-1 pe-1 px-1">Action</div>
                </div>
            `);
                }

                var idd = $("#id").val();
                var customerId = $("#customerid").val();
                var customerName = $("#customerid option:selected").text();
                var projectId = $("#projectid").val();

                var input = '<div class="row mb-1">';
                input += '<input type="hidden" name="categories[]" value="">';
                input += '<div class="col-md-2 pe-1 px-1" style="width: 200px;">' +
                    '<div class="">' +
                    '<input type="hidden" class="form-control" name="pids[]" value="">' +
                    '<input type="hidden" class="form-control" name="dispatchid[]" value="' + idd + '">' +
                    '<input type="text" class="form-control" name="custom_plate_name[]" placeholder="e.g. PLATE-X" required>' +
                    '</div>' +
                    '</div>';

                input += '<input type="hidden" name="customer[]" value="' + customerId + '">' +
                    '<input type="hidden" class="form-control" value="' + customerName + '" readonly>';

                input += '<div class="col-md-2 pe-1 px-1" style="width: 140px;">' +
                    '<div class="">' +
                    '<input type="text" class="form-control" name="project[]" value="' + projectId + '"> readonly' +
                    '</div>' +
                    '</div>';

                input += '<div class="col-md-2 pe-1 px-1" style="width: 400px;">' +
                    '<div class="">' +
                    '<textarea class="form-control" name="particulars[]" style="height: 28px;" required></textarea>' +
                    '<div class="invalid-feedback">Please Enter Particulars</div>' +
                    '</div>' +
                    '</div>';

                input += '<div class="col-md-2 pe-1 px-1" style="width: 140px;">' +
                    '<div class="">' +
                    '<textarea class="form-control" name="condition[]" style="height: 28px;" required></textarea>' +
                    '<div class="invalid-feedback">Please Enter Condition</div>' +
                    '</div>' +
                    '</div>';

                input += '<div class="col-md-2 pe-1 px-1" style="width: 140px;">' +
                    '<div class="">' +
                    '<textarea class="form-control" name="work[]" style="height: 28px;" required></textarea>' +
                    '<div class="invalid-feedback">Please Enter Work</div>' +
                    '</div>' +
                    '</div>';

                input += '<div class="col-md-1 pe-1 px-1" style="width: 75px;">' +
                    '<div class="">' +
                    '<input type="text" class="form-control" name="custom_plate_qty[]" placeholder="Qty" required>' +
                    '</div>' +
                    '</div>';

                input += '<div class="col-md-1 pe-1 px-1">' +
                    '<div class="">' +
                    '<button type="button" class="btn btn-danger waves-effect waves-light delete-input">Delete</button>' +
                    '</div>' +
                    '</div>';

                input += '</div>';

                $('#custom-inputs').append(input);
                idindex++;
            });
        });
    </script>
    <script>
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
    <script>
        function lockDropdown(select) {
            if (select.value !== "") {
                // Always populate the hidden field as a backup
                document.getElementById("customerid_hidden").value = select.value;
                // Don't disable the dropdown - keep it editable for all operations
                // $(select).prop("disabled", true);
                $(select).select2();
                getproject(); // assuming this is defined elsewhere
            }
        }
        
        // Also ensure the hidden field is populated when dropdown changes
        $(document).ready(function() {
            $('#customerid').on('change', function() {
                $('#customerid_hidden').val($(this).val());
            });
            
            // Add form submit handler for debugging
            $('#userform').on('submit', function(e) {
                console.log('Form being submitted...');
                console.log('Customer ID:', $('#customerid').val());
                console.log('Customer ID Hidden:', $('#customerid_hidden').val());
                console.log('CSRF Token:', $('input[name="_token"]').val());
                console.log('Meta CSRF Token:', $('meta[name="csrf-token"]').attr('content'));
                
                // Ensure customerid_hidden is populated if main customerid has value
                if ($('#customerid').val() && !$('#customerid_hidden').val()) {
                    $('#customerid_hidden').val($('#customerid').val());
                    console.log('Fixed customerid_hidden:', $('#customerid_hidden').val());
                }
            });
        });            
    </script>

    @endsection