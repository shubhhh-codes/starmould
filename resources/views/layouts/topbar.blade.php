<header id="page-topbar">
    <div class="navbar-header" style="background-color: #2a3042;">
        <div class="d-flex">
            <!-- LOGO -->
            <div class="navbar-brand-box" style="padding:0px;">
                <a href="index" class="logo logo-light" style="">
                    <span class="logo-lg">
                        {{-- <img src="{{ URL::asset('/assets/images/starmould.png') }}" alt="" > --}}
                        {{-- <img src="{{ URL::asset('/assets/images/logo.png') }}" alt="" > --}}
                    </span>
                </a>
            </div>
            <style>
                .active span {
                    color: white !important;
                }
            
                .active i {
                    color: white !important;
                }
            </style>
            {{-- <button type="button" class="btn btn-sm px-3 font-size-16 header-item waves-effect" id="vertical-menu-btn">
                <i class="fa fa-fw fa-bars"></i>
            </button> --}}

           <!-- App Search-->

        {{-- <div class="dropdown dropdown-mega d-none d-lg-block ms-2">
            <button type="button" class="btn header-item waves-effect" >
                <a href="{{route('scanning.index')}}" class="waves-effect">
                    <i class="bx bx-home-circle"></i>
                    <span key="t-multi-level">Live Projects</span>
                </a>
            </button>
        </div> --}}
        <div class="dropdown dropdown-mega d-none d-lg-block ">
            <button type="button" class="btn header-item waves-effect">
                <a href="{{ route('scanning.index') }}" class="waves-effect">
                    <i class="bx bx-home-circle"></i>
                    <span key="t-multi-level">Live Projects</span>
                </a>
            </button>
        </div>      
        {{-- <div class="dropdown dropdown-mega d-none d-lg-block ms-2">
            <button type="button" class="btn header-item waves-effect">
                <button type="button" class="btn header-item waves-effect" data-bs-toggle="dropdown" aria-haspopup="false" aria-expanded="false">
                <a href="{{ route('scanning.index') }}" class="waves-effect">
                    <i class="bx bx-home-circle"></i>
                    <span key="t-multi-level">Live Projects</span>
                </a>
            </button>
            <div class="dropdown-menu dropdown-menu">
                <ul class="sub-menu" aria-expanded="false">
                    <li>
                        <a href="{{ route('scanning.index') }}" class="waves-effect"><i class="bx bx-home-circle"></i>
                            <span key="t-multi-level">Live Projects</span></a>
                    </li>
                    <li>
                        <a href="javascript:void(0);" key="t-range-slider">@lang('translation.Range_Slider')</a>
                    </li>
                    <li>
                        <a href="javascript:void(0);" key="t-sweet-alert">@lang('translation.Sweet_Alert')</a>
                    </li>
                    <li>
                        <a href="javascript:void(0);" key="t-rating">@lang('translation.Rating')</a>
                    </li>
                    <li>
                        <a href="javascript:void(0);" key="t-forms">@lang('translation.Forms')</a>
                    </li>
                    <li>
                        <a href="javascript:void(0);" key="t-tables">@lang('translation.Tables')</a>
                    </li>
                    <li>
                        <a href="javascript:void(0);" key="t-charts">@lang('translation.Charts')</a>
                    </li>
                </ul>

            </div>
        </div> --}}
        @if ((Auth::user()->role==0) || (Auth::user()->role==1))
        <div class="dropdown dropdown-mega d-none d-lg-block ">
            <button type="button" class="btn header-item waves-effect" aria-haspopup="false" aria-expanded="false">
                <a href="{{route('purchase.index')}}" class="waves-effect">
                    <i class="bx bx-copy-alt"></i>
                    <span key="t-multi-level">Purchase</span>
                </a>
            </button>
        </div>
        @endif
        @if ((Auth::user()->role==0) || (Auth::user()->role==2) || (Auth::user()->role==1))
        <div class="dropdown dropdown-mega d-none d-lg-block ">
            <button type="button" class="btn header-item waves-effect" aria-haspopup="false" aria-expanded="false">
                <a href="{{route('challan.index')}}" class="waves-effect">
                    <i class="bx bx-copy-alt"></i>
                    <span key="t-multi-level">Outward Challan</span>
                </a>
            </button>
        </div>
        <div class="dropdown dropdown-mega d-none d-lg-block ">
            <button type="button" class="btn header-item waves-effect" aria-haspopup="false" aria-expanded="false">
                <a href="{{route('dispatch.index')}}" class="waves-effect">
                    <i class="bx bx-package"></i>
                    <span key="t-multi-level">Dispatch Challan</span>
                </a>
            </button>
        </div>
        <div class="dropdown dropdown-mega d-none d-lg-block ">
            <button type="button" class="btn header-item waves-effect" aria-haspopup="false" aria-expanded="false">
                <a href="{{route('inward.index')}}" class="waves-effect">
                    <i class="bx bx-copy-alt"></i>
                    <span key="t-multi-level">Inward Challan</span>
                </a>
            </button>
        </div>
        
        {{-- <div class="dropdown dropdown-mega d-none d-lg-block ">
            <button type="button" class="btn header-item waves-effect" >
                <a href="{{route('sample.index')}}" class="waves-effect">
                    <i class="bx bx-home-circle"></i>
                    <span key="t-multi-level">Samples</span>
                </a>
            </button>
        </div> --}}
        @endif
        {{-- <div class="dropdown dropdown-mega d-none d-lg-block ms-2">
            <button type="button" class="btn header-item waves-effect" >
                <a href="{{route('rework2')}}" class="waves-effect">
                    <i class="bx bx-home-circle"></i>
                    <span key="t-multi-level">Rework</span>
                </a>
            </button>
        </div> --}}
        @if ((Auth::user()->role==0) || (Auth::user()->role==1) || (Auth::user()->role==2))
        <div class="dropdown dropdown-mega d-none d-lg-block ">
            <button type="button" class="btn header-item waves-effect" aria-haspopup="false" aria-expanded="false">
                <a href="{{route('user.index')}}" class="waves-effect">
                    <i class="bx bx-user"></i>
                    <span key="t-multi-level">User Management</span>    
                </a>
            </button>
        </div>
        @endif
        @if ((Auth::user()->role==0) || (Auth::user()->role==1))
        <div class="dropdown dropdown-mega d-none d-lg-block ">
            <button type="button" class="btn header-item waves-effect" aria-haspopup="false" aria-expanded="false">
                <a href="{{route('customer.index')}}" class="waves-effect">
                    <i class="bx bx-user-pin"></i>
                    <span key="t-multi-level">Customers / Vendors</span>
                </a>
            </button>
        </div>
        @endif
        @if ((Auth::user()->role==0) || (Auth::user()->role==1) || (Auth::user()->usersubtype == 'Machine'))
        <div class="dropdown dropdown-mega d-none d-lg-block ">
            <button type="button" class="btn header-item waves-effect" aria-haspopup="false" aria-expanded="false">
                <a href="{{route('work.index')}}" class="waves-effect">
                    <i class="bx bx-briefcase-alt"></i>
                    <span key="t-multi-level">Archived Work</span>
                </a>
            </button>
        </div>
        @endif
        @if ((Auth::user()->role==0) || (Auth::user()->role==1))
        {{-- <div class="dropdown dropdown-mega d-none d-lg-block ">
            <button type="button" class="btn header-item waves-effect" aria-haspopup="false" aria-expanded="false">
                <a href="{{route('work3')}}" class="waves-effect">
                    <i class="bx bx-briefcase-alt"></i>
                    <span key="t-multi-level">Today's Pending</span>
                </a>
            </button>
        </div> --}}
        <div class="dropdown dropdown-mega d-none d-lg-block ">
            <button type="button" class="btn header-item waves-effect" aria-haspopup="false" aria-expanded="false">
                <a href="{{route('expense.index')}}" class="waves-effect">
                    <i class="bx bx-down-arrow-alt"></i>
                    <span key="t-multi-level">Expense</span>
                </a>
            </button>
        </div>
        @endif
        @if ((Auth::user()->role==0) || (Auth::user()->role==1))
        <div class="dropdown dropdown-mega d-none d-lg-block ">
            <button type="button" class="btn header-item waves-effect" aria-haspopup="false" aria-expanded="false">
                <a href="{{route('scanadmin.index')}}" class="waves-effect">
                    <i class="bx bx-copy-alt"></i>
                    <span key="t-multi-level">Project Register</span>
                </a>
            </button>
        </div>
        @endif
        {{-- <div class="dropdown dropdown-mega d-none d-lg-block ms-2">
            <button type="button" class="btn header-item waves-effect" aria-haspopup="false" aria-expanded="false">
                <a href="{{route('backup.index')}}" class="waves-effect">
                    <i class="bx bx-download"></i>
                    <span key="t-multi-level">Backup</span>
                </a>
            </button>
        </div> --}}
        <div class="dropdown dropdown-mega d-none d-lg-block ms-2">
            <button type="button" class="btn header-item waves-effect"  aria-haspopup="false" aria-expanded="false">
                <a href="{{route('report.index')}}" class="waves-effect">
                    <i class="bx bxs-bar-chart-alt-2"></i>
                    <span key="t-multi-level">Report</span>
                </a>
            </button>
        </div>
       
        <div class="dropdown dropdown-mega d-none d-lg-block ms-2">
            <button type="button" class="btn header-item waves-effect"  aria-haspopup="false" aria-expanded="false">
                <a href="javascript:void();" onclick="event.preventDefault(); document.getElementById('logout-form').submit();" class="waves-effect">
                    <i class="mdi mdi-logout"></i>
                    <span key="t-multi-level">logout</span><br>{{Auth::user()->name}}
                    <form id="logout-form" action="{{ route('logout') }}" method="POST" style="display: none;">
                        @csrf
                    </form>
                </a>
            </button>
        </div>
    </div>

    
</div>
</header>
<!--  Change-Password example -->
<div class="modal fade change-password" tabindex="-1" role="dialog"
aria-labelledby="myLargeModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="myLargeModalLabel">Change Password</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"
                    aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form method="POST" id="change-password">
                    @csrf
                    <input type="hidden" value="{{ Auth::user()->id }}" id="data_id">
                    <div class="mb-3">
                        <label for="current_password">Current Password</label>
                        <input id="current-password" type="password"
                            class="form-control @error('current_password') is-invalid @enderror"
                            name="current_password" autocomplete="current_password"
                            placeholder="Enter Current Password" value="{{ old('current_password') }}">
                        <div class="text-danger" id="current_passwordError" data-ajax-feedback="current_password"></div>
                    </div>

                    <div class="mb-3">
                        <label for="newpassword">New Password</label>
                        <input id="password" type="password"
                            class="form-control @error('password') is-invalid @enderror" name="password"
                            autocomplete="new_password" placeholder="Enter New Password">
                        <div class="text-danger" id="passwordError" data-ajax-feedback="password"></div>
                    </div>

                    <div class="mb-3">
                        <label for="userpassword">Confirm Password</label>
                        <input id="password-confirm" type="password" class="form-control" name="password_confirmation"
                            autocomplete="new_password" placeholder="Enter New Confirm password">
                        <div class="text-danger" id="password_confirmError" data-ajax-feedback="password-confirm"></div>
                    </div>

                    <div class="mt-3 d-grid">
                        <button class="btn btn-primary waves-effect waves-light UpdatePassword" data-id="{{ Auth::user()->id }}"
                            type="submit">Update Password</button>
                    </div>
                </form>
            </div>
        </div><!-- /.modal-content -->
    </div><!-- /.modal-dialog -->
</div><!-- /.modal -->
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script>
    // $(document).ready(function() {
    //     // Get the current route path
    //     var currentPath = window.location.pathname;
    //     console.log(currentPath)
    //     // Remove 'active' class from all menu items
    //     $('.dropdown-mega a').removeClass('active');

    //     // Add 'active' class to the menu item that matches the current route path
    //     $('.dropdown-mega a[href="' + currentPath + '"]').addClass('active');
    // });
   
    $(document).ready(function() 
    {
        // Get the current URL
        
        var currentURL = window.location.href;

        // Remove 'active' class from all menu items
        $('.dropdown-mega a').removeClass('active');

        // Add 'active' class to the menu item that matches the current URL
        $('.dropdown-mega a').each(function() {
            var href = $(this).attr('href');
            if (currentURL.includes(href)) {
                $(this).addClass('active');
            }
        });
    });

</script>
