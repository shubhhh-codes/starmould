<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/
Route::post('/login', function (Request $request) {
    $credentials = $request->only('email', 'password');
 
    if (Auth::attempt($credentials)) {
        $user = Auth::user();
        $username = $user->name;
        $role = $user->role;
        $success=  $user->createToken("usertoken");
        return response()->json(['status'=>true,'data' => $success,"message"=>'login success','role'=>$role,'username'=>$username], 200);
    }
    else{
        return response()->json(['status'=>false,"message"=>'Your email/password combination was incorrect'], 401);
    }
    //return $request->user();
});
Route::middleware('auth:sanctum')->post('updatesubplatemobile',[App\Http\Controllers\ScanningController::class,'updatesubplatemobile']);
Route::middleware('auth:sanctum')->post('getcountDatamobile',[App\Http\Controllers\ExpenseController::class,'getcountDatamobile']);
Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    print_r("hello");
    //return $request->user();
});
Route::middleware('auth:sanctum')->post('getCLitemsmobile', [App\Http\Controllers\ChallanController::class,'getCLitemsmobile']);
Route::middleware('auth:sanctum')->post('getprojectsubplatesviewmobile', [App\Http\Controllers\CustomerController::class,'getprojectsubplatesviewmobile']);
Route::middleware('auth:sanctum')->post('addCPlatesmobile', [App\Http\Controllers\ChallanController::class,'addCPlatesmobile']);
Route::middleware('auth:sanctum')->post('addPlatesmobile', [App\Http\Controllers\ScanningController::class,'addPlatesmobile']);
Route::middleware('auth:sanctum')->get('scanlist',[App\Http\Controllers\ScanningController::class,'indexmobile']);
Route::middleware('auth:sanctum')->get('scanlist',[App\Http\Controllers\ScanningController::class,'indexmobile']);
Route::middleware('auth:sanctum')->get('scancount',[App\Http\Controllers\ScanningController::class,'scancount']);
Route::middleware('auth:sanctum')->post('addscandata',[App\Http\Controllers\ScanningController::class,'addscandata']);


Route::middleware('auth:sanctum')->post('getIchallanitems', [App\Http\Controllers\InwardController::class,'getIchallanitems']);
Route::middleware('auth:sanctum')->post('getowmainchallandatamobile', [App\Http\Controllers\InwardController::class,'getowmainchallandatamobile']);
Route::middleware('auth:sanctum')->post('getIitems', [App\Http\Controllers\InwardController::class,'getIitems']);
Route::middleware('auth:sanctum')->get('getaccountmobile',[App\Http\Controllers\CustomerController::class,'getaccountmobile']);
Route::middleware('auth:sanctum')->get('getcustomermobile',[App\Http\Controllers\CustomerController::class,'getcustomermobile']);
Route::middleware('auth:sanctum')->post('getprojectsmobile',[App\Http\Controllers\CustomerController::class,'getprojectsmobile']);
Route::middleware('auth:sanctum')->post('getprojectsworkmobile',[App\Http\Controllers\CustomerController::class,'getprojectsworkmobile']);
Route::middleware('auth:sanctum')->post('geticustomermobile',[App\Http\Controllers\CustomerController::class,'geticustomermobile']);
Route::middleware('auth:sanctum')->post('getchallannomobile',[App\Http\Controllers\CustomerController::class,'getchallannomobile']);
Route::middleware('auth:sanctum')->post('addinward',[App\Http\Controllers\InwardController::class,'addinward']);
Route::middleware('auth:sanctum')->get('inwardlist',[App\Http\Controllers\InwardController::class,'indexmobile']);
Route::middleware('auth:sanctum')->get('dropdowninitialsmobile', [App\Http\Controllers\ScanningController::class,'dropdowninitialsmobile']);
Route::middleware('auth:sanctum')->post('getCitemsmobile', [App\Http\Controllers\ChallanController::class,'getCitemsmobile']);
Route::middleware('auth:sanctum')->post('getcustomerdatamobile',[App\Http\Controllers\CustomerController::class,'getcustomerdatamobile']);
Route::middleware('auth:sanctum')->post('getPlatesmobile',[App\Http\Controllers\ScanningController::class,'getPlatesmobile']);
Route::middleware('auth:sanctum')->post('getPlatesbyidmobile',[App\Http\Controllers\ScanningController::class,'getPlatesbyidmobile']);

Route::middleware('auth:sanctum')->get('userlist',[App\Http\Controllers\UserController::class,'indexmobile']);
Route::middleware('auth:sanctum')->post('adduser',[App\Http\Controllers\UserController::class,'adduser']);
Route::middleware('auth:sanctum')->post('updateuser',[App\Http\Controllers\UserController::class,'updateuser']);
Route::middleware('auth:sanctum')->post('deleteuser',[App\Http\Controllers\UserController::class,'deleteuser']);
Route::middleware('auth:sanctum')->get('printlist',[App\Http\Controllers\PrintingController::class,'indexmobile']);
Route::middleware('auth:sanctum')->post('addprintdata',[App\Http\Controllers\PrintingController::class,'addprintdata']);
Route::middleware('auth:sanctum')->post('customerlist',[App\Http\Controllers\CustomerController::class,'indexmobile']);
Route::middleware('auth:sanctum')->get('customerdata',[App\Http\Controllers\CustomerController::class,'customerdata']);
Route::middleware('auth:sanctum')->get('samplelist',[App\Http\Controllers\SampleController::class,'indexmobile']);  
Route::middleware('auth:sanctum')->get('reworklist',[App\Http\Controllers\SampleController::class,'indexreworkmobile']);
Route::middleware('auth:sanctum')->post('deletechallan',[App\Http\Controllers\ChallanController::class,'deletechallan']);
Route::middleware('auth:sanctum')->post('deleteinward',[App\Http\Controllers\ChallanController::class,'deleteinward']);
Route::middleware('auth:sanctum')->get('challanlist',[App\Http\Controllers\ChallanController::class,'indexmobile']);
Route::middleware('auth:sanctum')->post('addchallan',[App\Http\Controllers\ChallanController::class,'addchallan']);
Route::middleware('auth:sanctum')->post('addcustomer',[App\Http\Controllers\CustomerController::class,'addcustomer']);
Route::middleware('auth:sanctum')->post('updatecustomer',[App\Http\Controllers\CustomerController::class,'updatecustomer']);
Route::middleware('auth:sanctum')->post('deletesubplate',[App\Http\Controllers\ScanningController::class,'deletesubplate']);

Route::middleware('auth:sanctum')->get('scanadminlist',[App\Http\Controllers\ScanAdminController::class,'indexmobile']);
Route::middleware('auth:sanctum')->get('printadminlist',[App\Http\Controllers\PrintAdminController::class,'indexmobile']);
Route::middleware('auth:sanctum')->post('updatestatusmobile',[App\Http\Controllers\ScanningController::class,'updatestatusmobile']);
Route::middleware('auth:sanctum')->post('updatestatuspaymentprint',[App\Http\Controllers\PrintAdminController::class,'updatestatuspaymentmobileprint']);
Route::middleware('auth:sanctum')->post('updateamountprint',[App\Http\Controllers\PrintAdminController::class,'updateamountmobileprint']);
Route::middleware('auth:sanctum')->get('gramlist',[App\Http\Controllers\GramController::class,'indexmobile']);
Route::middleware('auth:sanctum')->post('updategramdata',[App\Http\Controllers\GramController::class,'updategramdata']);
Route::middleware('auth:sanctum')->post('deletescandata',[App\Http\Controllers\ScanAdminController::class,'deletescandata']);
Route::middleware('auth:sanctum')->post('deleteprintdata',[App\Http\Controllers\PrintAdminController::class,'deleteprintdata']);
Route::middleware('auth:sanctum')->post('worklist',[App\Http\Controllers\WorkController::class,'indexmobile']);
Route::middleware('auth:sanctum')->get('allworklist',[App\Http\Controllers\WorkController::class,'getWorkmobile']);
Route::middleware('auth:sanctum')->post('scanadminworklist',[App\Http\Controllers\ScanAdminController::class,'getWorkmobile']);
Route::middleware('auth:sanctum')->post('updatestatuspaymentscan',[App\Http\Controllers\ScanAdminController::class,'updatestatuspaymentmobilescan']);
Route::middleware('auth:sanctum')->post('updateamountscan',[App\Http\Controllers\ScanAdminController::class,'updateamountmobilescan']);
Route::middleware('auth:sanctum')->post('addwork',[App\Http\Controllers\WorkController::class,'addwork']);
Route::middleware('auth:sanctum')->post('getexpensedata',[App\Http\Controllers\ExpenseController::class,'indexmobile']);
Route::middleware('auth:sanctum')->post('getpendingwork',[App\Http\Controllers\WorkController::class,'getPendingworkmobile']);
Route::middleware('auth:sanctum')->post('addexpense',[App\Http\Controllers\ExpenseController::class,'addexpense']);
Route::middleware('auth:sanctum')->post('deleteexpense',[App\Http\Controllers\ExpenseController::class,'deleteexpense']);
Route::middleware('auth:sanctum')->post('projectlist',[App\Http\Controllers\ScanningController::class,'projectlist']);
Route::middleware('auth:sanctum')->post('getcustomerprojectdata',[App\Http\Controllers\ScanningController::class,'getcustomerprojectdata']);
Route::get('generatePDFmobile', [App\Http\Controllers\PdfController::class, 'generatePDFmobile']);
Route::get('generateIPDFmobile', [App\Http\Controllers\PdfController::class, 'generateIPDFmobile']);
Route::get('generateWPDFmobile', [App\Http\Controllers\PdfController::class, 'generateWPDFmobile']);
Route::middleware('auth:sanctum')->get('Vendornamemobile', [App\Http\Controllers\ChallanController::class, 'Vendornamemobile']);
Route::middleware('auth:sanctum')->get('Transporternamemobile', [App\Http\Controllers\ChallanController::class, 'Transporternamemobile']);
