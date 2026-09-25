<?php

use App\Http\Controllers\ChallanController;
use App\Http\Controllers\DispatchController;
use App\Http\Controllers\InwardController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\PrintAdminController;
use App\Http\Controllers\ScanAdminController;
use App\Http\Controllers\ScanningController;
use App\Http\Controllers\UserController;
use App\Models\ChallanModel;
use App\Models\CustomerModel;
use App\Models\ExpenseModel;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PdfController;
use App\Http\Controllers\PurchaseController;


/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/
Auth::routes();

Route::get('exportpendingoutward',[App\Http\Controllers\ExportController::class,'exportpendingoutward'])->name('exportpendingoutward');
Route::get('exportoutward',[App\Http\Controllers\ExportController::class,'exportoutward'])->name('exportoutward');
Route::get('exportdispatchchallan',[App\Http\Controllers\ExportController::class,'exportdispatchchallan'])->name('exportdispatchchallan');
Route::get('exportpurchaserec',[App\Http\Controllers\ExportController::class,'exportpurchaserec'])->name('exportpurchaserec');
Route::get('exportmouldreg',[App\Http\Controllers\ExportController::class,'exportmouldreg'])->name('exportmouldreg');
Route::get('exportmould',[App\Http\Controllers\ExportController::class,'exportmould'])->name('exportmould');
Route::get('export',[App\Http\Controllers\ExportController::class,'export'])->name('export');
Route::get('getexpensecountdata',[App\Http\Controllers\ExpenseController::class,'getcountData'])->name("getexpensecountdata");
//Route::get('generate-pdf', [PDFController::class, 'generatePDF']);getowchallandata
//Route::get('printlist', [App\Http\Controllers\ChallanController::class, 'printlist'])->name('challan2');
Route::get('printlist3', [App\Http\Controllers\PdfController::class, 'generatePPDF'])->name('purchase4');
Route::get('printlist2', [App\Http\Controllers\PdfController::class, 'generateWPDF']);
Route::get('printlist', [App\Http\Controllers\PdfController::class, 'generatePDF'])->name('challan2');
Route::get('printlist4', [App\Http\Controllers\PdfController::class, 'generateDPDF'])->name('dispatch2');

Route::get('printlistimage', [App\Http\Controllers\PdfController::class, 'generatePDFTOIMAGE'])->name('challanimage');
Route::get('printlist1', [App\Http\Controllers\PdfController::class, 'generateIPDF'])->name('challan3');
//Route::get('/generate-pdf', [App\Http\Controllers\PdfController::class,'generatePDF']);

Route::get('gethrcountdata',[App\Http\Controllers\WorkController::class,'gethrData'])->name("gethrcountdata");

Route::get('subplatelist',[App\Http\Controllers\SubplateController::class,'index'])->name("subplatelist");
Route::get('getexpensedata',[App\Http\Controllers\ExpenseController::class,'getData'])->name("getexpensedata");
// Route::get('gramlist',[App\Http\Controllers\GramController::class,'index'])->name("gramlist");
Route::get('dashboarddata', [App\Http\Controllers\ScanningController::class, 'dashboarddata'])->name('dashboarddata');

Route::get('getselecteddashboarddata',[App\Http\Controllers\ScanningController::class,'getselecteddashboarddata'])->name("getselecteddashboarddata");
Route::get('getselectedwork',[App\Http\Controllers\WorkController::class,'getselectedWork'])->name("getselectedwork");
Route::get('getwork',[App\Http\Controllers\WorkController::class,'getWork'])->name("getwork");
Route::get('getworkdata',[App\Http\Controllers\WorkController::class,'getData'])->name("getworkdata");
Route::get('getpurchasedata',[App\Http\Controllers\PurchaseController::class,'getData'])->name("getpurchasedata");
Route::get('workdata', [App\Http\Controllers\WorkController::class, 'workdata'])->name('work2');
Route::get('purchaseitems', [App\Http\Controllers\PurchaseController::class, 'purchaseitems'])->name('work2');
Route::get('outwardlist', [App\Http\Controllers\ChallanController::class, 'outwardlist'])->name('outward2');
Route::get('purchaselist', [App\Http\Controllers\PurchaseController::class, 'purchaselist'])->name('purchase2');
Route::get('pendingpurchaselist', [App\Http\Controllers\PurchaseController::class, 'pendingpurchaselist'])->name('purchase3');
Route::get('pendingwork', [App\Http\Controllers\WorkController::class, 'pendingwork'])->name('work3');
Route::get('getpendingwork',[App\Http\Controllers\WorkController::class,'getPendingwork'])->name("getpendingwork");
// Route::get('getpendingwork',[App\Http\Controllers\WorkController::class,'getPending'])->name("getpendingwork");
Route::get('getgramdata',[App\Http\Controllers\GramController::class,'getData'])->name("getgramdata");
// Route::get('scanning/edit/{id}',[ScanningController::class,'edit'])->name("scanning.edit");
// Route::post('scanning/update',[ScanningController::class,'update'])->name("scanning.update");
Route::get('printadmin/delete/{id}',[PrintAdminController::class,'destroy'])->name("printadmin.delete");
Route::get('scan/delete/{id}',[ScanningController::class,'destroy'])->name("scan.delete");
Route::get('expense/delete/{id}',[ExpenseController::class,'destroy'])->name("expense.delete");
Route::get('challan/delete/{id}',[ChallanController::class,'destroy'])->name("challan.delete");
Route::get('dispatch/delete/{id}',[DispatchController::class,'destroy'])->name("dispatch.delete");

Route::get('purchase/delete/{id}',[PurchaseController::class,'destroy'])->name("purchase.delete");
//Route::delete('inward/{id}', [InwardController::class,'destroy'])->name('inward.delete');
Route::get('inward/delete/{id}',[InwardController::class,'destroy'])->name("inward.delete");
Route::get('user/delete/{id}',[UserController::class,'destroy'])->name("user.delete");
Route::get('customer/delete/{id}',[CustomerController::class,'destroy'])->name("customer.delete");
Route::post('getowmainpurchasedata',[App\Http\Controllers\PurchaseInwardController::class,'getowmainpurchasedata'])->name("getowmainpurchasedata");
Route::post('getowmainchallandata',[App\Http\Controllers\InwardController::class,'getowmainchallandata'])->name("getowmainchallandata");
Route::get('getowchallandata',[App\Http\Controllers\InwardController::class,'getowchallandata'])->name("getowchallandata");
Route::get('challanlist',[App\Http\Controllers\ChallanController::class,'index'])->name("challanlist");
Route::get('dispatchlist',[App\Http\Controllers\DispatchController::class,'index'])->name("dispatchlist");

Route::get('inwardlist',[App\Http\Controllers\InwardController::class,'index'])->name("inwardlist");
Route::get('userlist',[App\Http\Controllers\UserController::class,'index'])->name("userlist");
Route::post('scanning/updatesubnote',[App\Http\Controllers\ScanningController::class,'updatesubnote'])->name("scanning.updatesubnote");

Route::post('getcustomerdata',[App\Http\Controllers\CustomerController::class,'getcustomerdata'])->name("customer.getcustomerdata");
Route::post('getsubplatedata',[App\Http\Controllers\ScanningController::class,'getsubplatedata'])->name("scanning.getsubplatedata");
Route::post('getsubplatename',[App\Http\Controllers\CustomerController::class,'getsubplatename'])->name("customer.getsubplatename");
Route::post('getprojects',[App\Http\Controllers\CustomerController::class,'getprojects'])->name("customer.getprojects");
Route::post('getprojectswork',[App\Http\Controllers\CustomerController::class,'getprojectswork'])->name("customer.getprojectswork");
Route::post('geticustomer',[App\Http\Controllers\CustomerController::class,'geticustomer'])->name("customer.geticustomer");
Route::post('getchallanno',[App\Http\Controllers\CustomerController::class,'getchallanno'])->name("customer.getchallanno");
Route::post('getprojectsubplatespurchaseview',[App\Http\Controllers\CustomerController::class,'getprojectsubplatespurchaseview'])->name("customer.getprojectsubplatespurchaseview");
Route::post('getprojectsubplatesview',[App\Http\Controllers\CustomerController::class,'getprojectsubplatesview'])->name("customer.getprojectsubplatesview");
Route::post('getdispatchprojectsubplatesview',[App\Http\Controllers\CustomerController::class,'getdispatchprojectsubplatesview'])->name("customer.getdispatchprojectsubplatesview");
Route::post('getprojectsubplates',[App\Http\Controllers\CustomerController::class,'getprojectsubplates'])->name("customer.getprojectsubplates");
Route::post('getplatedata',[App\Http\Controllers\CustomerController::class,'getplatedata'])->name("customer.getplatedata");
Route::get('customerlist',[App\Http\Controllers\CustomerController::class,'index'])->name("customerlist");
Route::get('getpurchaselistdata',[App\Http\Controllers\PurchaseController::class,'getPData'])->name("getpurchaselistdata");
Route::get('getpurchaseitemslistdata',[App\Http\Controllers\PurchaseController::class,'getPRData'])->name("getpurchaseitemslistdata");
Route::get('getchallanlistdata',[App\Http\Controllers\ChallanController::class,'getCData'])->name("getchallanlistdata");
Route::get('getpendingpurchaselist',[App\Http\Controllers\PurchaseController::class,'getPurchaseData'])->name("getpendingpurchaselist");
Route::get('getdispatchdata',[App\Http\Controllers\DispatchController::class,'getData'])->name("getdispatchdata");
Route::get('getchallandata',[App\Http\Controllers\ChallanController::class,'getData'])->name("getchallandata");
Route::get('getichallandata',[App\Http\Controllers\InwardController::class,'getData'])->name("getichallandata");
Route::get('getiwpurchaseData',[App\Http\Controllers\PurchaseInwardController::class,'getpurchaseData'])->name("getiwpurchaseData");
Route::get('getiwchallandata',[App\Http\Controllers\InwardController::class,'getchallanData'])->name("getiwchallandata");
Route::get('getuserdata',[App\Http\Controllers\UserController::class,'getData'])->name("getuserdata");
Route::post('user/store',[App\Http\Controllers\UserController::class,'store'])->name("user.store");
Route::post('user/updatedata',[App\Http\Controllers\UserController::class,'updatedata'])->name("user.updatedata");
Route::post('customer/updatedata',[App\Http\Controllers\CustomerController::class,'updatedata'])->name("customer.updatedata");
Route::post('customer/checkusername',[App\Http\Controllers\CustomerController::class,'checkusername'])->name("customer.checkusername");
Route::post('customer/checkinitials',[App\Http\Controllers\CustomerController::class,'checkinitials'])->name("customer.checkinitials");
Route::post('user/checkinitial',[App\Http\Controllers\UserController::class,'checkinitial'])->name("user.checkinitial");
Route::get('scanlist',[App\Http\Controllers\PrintingController::class,'index'])->name("scanlist");
Route::get('getprintdata',[App\Http\Controllers\PrintingController::class,'getData'])->name("getprintdata");
Route::post('printing/store',[App\Http\Controllers\PrintingController::class,'store'])->name("printing.store");
Route::post('printadmin/updatestatuspayment',[App\Http\Controllers\PrintAdminController::class,'updatestatuspayment'])->name("printadmin.updatestatuspayment");
Route::post('printadmin/updateamount',[App\Http\Controllers\PrintAdminController::class,'updateamount'])->name("printadmin.updateamount");
Route::post('printadmin/updatestatusqcby',[App\Http\Controllers\PrintAdminController::class,'updatestatusqcby'])->name("printadmin.updatestatusqcby");
Route::post('printadmin/updatestatusprintby',[App\Http\Controllers\PrintAdminController::class,'updatestatusprintby'])->name("printadmin.updatestatusprintby");
Route::post('printing/updatestatusqcby',[App\Http\Controllers\PrintingController::class,'updatestatusqcby'])->name("printing.updatestatusqcby");
Route::post('printing/updatestatusprintby',[App\Http\Controllers\PrintingController::class,'updatestatusprintby'])->name("printing.updatestatusprintby");
Route::post('printing/updatestatusprint',[App\Http\Controllers\PrintingController::class,'updatestatusprint'])->name("printing.updatestatusprint");
Route::post('printadmin/updatestatusprint',[App\Http\Controllers\PrintAdminController::class,'updatestatusprint'])->name("printadmin.updatestatusprint");
Route::get('getprintregisterdata',[App\Http\Controllers\PrintAdminController::class,'getData'])->name("getprintregisterdata");
Route::get('scanlist',[App\Http\Controllers\ScanningController::class,'index'])->name("scanlist");
Route::get('scanregisterlist',[App\Http\Controllers\ScanAdminController::class,'index'])->name("scanregisterlist");
Route::get('getscandata',[App\Http\Controllers\ScanningController::class,'getData'])->name("getscandata");
Route::get('getsampledata',[App\Http\Controllers\SampleController::class,'getData'])->name("getsampledata");
Route::get('getreworkdata',[App\Http\Controllers\SampleController::class,'getreworkData'])->name("getreworkdata");
Route::get('getcustomerdata',[App\Http\Controllers\CustomerController::class,'getData'])->name("getcustomerdata");
Route::post('purchaseinward/store',[App\Http\Controllers\PurchaseInwardController::class,'store'])->name("purchaseinward");
Route::post('scanning/store',[App\Http\Controllers\ScanningController::class,'store'])->name("scanning.store");
Route::post('scanadmin/updatestatuspayment',[App\Http\Controllers\ScanAdminController::class,'updatestatuspayment'])->name("scanadmin.updatestatuspayment");
Route::post('scanadmin/updateamount',[App\Http\Controllers\ScanAdminController::class,'updateamount'])->name("scanadmin.updateamount");
Route::post('scanadmin/updatestatusdesign',[App\Http\Controllers\ScanAdminController::class,'updatestatusdesign'])->name("scanadmin.updatestatusdesign");
Route::post('scanadmin/updatestatusqc',[App\Http\Controllers\ScanAdminController::class,'updatestatusqc'])->name("scanadmin.updatestatusqc");
Route::post('scanadmin/updatestatusscan',[App\Http\Controllers\ScanAdminController::class,'updatestatusscan'])->name("scanadmin.updatestatusscan");
Route::post('scanning/updatestatusdesign',[App\Http\Controllers\ScanningController::class,'updatestatusdesign'])->name("scanning.updatestatusdesign");
Route::post('scanning/updatestatusqc',[App\Http\Controllers\ScanningController::class,'updatestatusqc'])->name("scanning.updatestatusqc");
Route::post('scanning/updatestatusscan',[App\Http\Controllers\ScanningController::class,'updatestatusscan'])->name("scanning.updatestatusscan");
Route::post('scanning/updatestatus',[App\Http\Controllers\ScanningController::class,'updatestatus'])->name("scanning.updatestatus");
Route::post('scanadmin/updatestatus',[App\Http\Controllers\ScanAdminController::class,'updatestatus'])->name("scanadmin.updatestatus");
Route::post('getscanregisterworkdata',[App\Http\Controllers\ScanAdminController::class,'getWork'])->name("getscanregisterworkdata");
Route::get('getscanregisterdata',[App\Http\Controllers\ScanAdminController::class,'getData'])->name("getscanregisterdata");
Route::post('gram/updatedata',[App\Http\Controllers\GramController::class,'updatedata'])->name("gram.updatedata");
Route::get('workdata', [App\Http\Controllers\WorkController::class, 'workdata'])->name('work2');
// Route::resource('/work/workdata', App\Http\Controllers\WorkController::class);
Route::post('report/getmonthwisedata',[App\Http\Controllers\ReportController::class,'getmonthwisedata'])->name("report.getmonthwisedata");
Route::resource('/sample', App\Http\Controllers\SampleController::class);
Route::get('rework', [App\Http\Controllers\SampleController::class, 'rework'])->name('rework2');
//Route::resource('/rework', App\Http\Controllers\SampleController::class);
Route::resource('/expense', App\Http\Controllers\ExpenseController::class);
Route::resource('/report', App\Http\Controllers\ReportController::class);
Route::resource('/work', App\Http\Controllers\WorkController::class);
Route::resource('/purchase', App\Http\Controllers\PurchaseController::class);
Route::resource('/gram', App\Http\Controllers\GramController::class);
Route::resource('/backup', App\Http\Controllers\BackupController::class);
Route::resource('/scanadmin', App\Http\Controllers\ScanAdminController::class);
Route::resource('/printadmin', App\Http\Controllers\PrintAdminController::class);
Route::resource('/challan', App\Http\Controllers\ChallanController::class);
Route::resource('/dispatch', App\Http\Controllers\DispatchController::class);

Route::resource('/inward', App\Http\Controllers\InwardController::class);
Route::resource('/user', App\Http\Controllers\UserController::class);
Route::resource('/printing', App\Http\Controllers\PrintingController::class);
Route::resource('/scanning', App\Http\Controllers\ScanningController::class);
Route::resource('/customer', App\Http\Controllers\CustomerController::class);
Route::get('/', [App\Http\Controllers\ScanningController::class, 'index'])->name('root');
Route::get('shivani', [App\Http\Controllers\HomeController::class, 'shivani'])->name('shivani2');
//Update User Details
Route::post('/update-profile/{id}', [App\Http\Controllers\HomeController::class, 'updateProfile'])->name('updateProfile');
Route::post('/update-password/{id}', [App\Http\Controllers\HomeController::class, 'updatePassword'])->name('updatePassword');
Route::get('{any}',  [App\Http\Controllers\ScanningController::class, 'index'])->name('index');
//Language Translation
Route::get('index/{locale}', [App\Http\Controllers\HomeController::class, 'lang']);


//POST ROUTES
Route::post('/plates/add', [App\Http\Controllers\ScanningController::class,'addPlates'])->name('plates.add');
Route::post('/plates/get', [App\Http\Controllers\ScanningController::class,'getPlates'])->name('getsubplate');
Route::post('/outwardlist/get', [App\Http\Controllers\ChallanController::class,'getCLitems'])->name('getchallanlistitems');
Route::post('/purchaselist/get', [App\Http\Controllers\PurchaseController::class,'getPitems'])->name('getpurchaselistitems');
Route::post('/purchaseitems/get', [App\Http\Controllers\PurchaseController::class,'getPRitems'])->name('getpurchaseitemsdata');
Route::post('/dispatch/get', [App\Http\Controllers\DispatchController::class,'getDitems'])->name('getdispatchitems');
Route::post('/challan/get', [App\Http\Controllers\ChallanController::class,'getCitems'])->name('getchallanitems');
Route::post('/purchase/get', [App\Http\Controllers\PurchaseController::class,'getPitems'])->name('getpurchaseitems');
Route::post('/inward/get', [App\Http\Controllers\InwardController::class,'getIitems'])->name('getichallanitems');
Route::post('getiwchallanitems', [App\Http\Controllers\InwardController::class,'getIchallanitems'])->name('getiwchallanitems');
Route::post('getIpurchaseitems', [App\Http\Controllers\PurchaseInwardController::class,'getIpurchaseitems'])->name('getIpurchaseitems');

Route::post('getsubPlates', [App\Http\Controllers\ScanningController::class,'getsubPlates'])->name('getsubPlates');
Route::post('/plates/update',[App\Http\Controllers\ScanningController::class,'updatesubplate'])->name('updatesubplate');