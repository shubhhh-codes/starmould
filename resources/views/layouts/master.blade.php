<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="utf-8" />
    <title> @yield('title') | Star Mould</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta content="Premium Multipurpose Admin & Dashboard Template" name="description" />
    <meta content="Themesbrand" name="author" />
    <!-- App favicon -->
    <link rel="shortcut icon" href="{{ URL::asset('assets/images/favicon.ico') }}">
    @include('layouts.head-css')
</head>

@section('body')
    <body data-sidebar="dark">
@show
    <!-- Begin page -->
    <div id="layout-wrapper">
        @include('layouts.topbar')
        @include('layouts.sidebar')
        <!-- ============================================================== -->
        <!-- Start right Content here -->
        <!-- ============================================================== -->
        <div class="main-content">
            <div class="page-content">
                <div class="container-fluid">
                    @yield('content')
                </div>
                <!-- container-fluid -->
            </div>
            <!-- End Page-content -->
            @include('layouts.footer')
        </div>
        <!-- end main content-->
    </div>
    <!-- END layout-wrapper -->

    <!-- Right Sidebar -->
    @include('layouts.right-sidebar')
    <!-- /Right-bar -->

    <!-- JAVASCRIPT -->
    @include('layouts.vendor-scripts')
    <script>
        
        document.addEventListener('DOMContentLoaded', function () {
    let confirmClose = false;

    document.querySelectorAll('.modal').forEach(function (modalEl) {
        const modalInstance = new bootstrap.Modal(modalEl);

        modalEl.addEventListener('show.bs.modal', function () {
            modalEl.setAttribute('data-bs-backdrop', 'static');
            modalEl.setAttribute('data-bs-keyboard', 'false');
        });

        modalEl.addEventListener('hide.bs.modal', function (event) {
            if (!confirmClose) {
                event.preventDefault(); // Block immediate close
                showReconfirm().then(function (confirmed) {
                    if (confirmed) {
                        confirmClose = true;

                        // Hide modal manually
                        modalInstance.hide();

                        // Clean up backdrop manually if it sticks
                        removeModalBackdrop();
                    }
                });
            } else {
                confirmClose = false; // Reset for next time
            }
        });
    });

    function showReconfirm() {
        return new Promise(function (resolve) {
            if (confirm('Are you sure you want to close this modal?')) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    }

    function removeModalBackdrop() {
        // Remove any stuck backdrop
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());

        // Also remove 'modal-open' from body to restore scroll
        document.body.classList.remove('modal-open');
    }
});


    </script>
</body>

</html>
