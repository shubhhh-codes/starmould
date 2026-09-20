<?php
  
namespace App\Http\Controllers;
use App\Models\ChallanModel;
use App\Models\DispatchModel;
use App\Models\CustomerModel;
use App\Models\InwardModel;
use App\Models\PurchaseModel;
use App\Models\WorkModel;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Barryvdh\DomPDF\Facade\Pdf;
use Excel;
  
class PdfController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function generatePDFmobile(Request $request)
    {
        // $data = [
        //     'title' => 'Welcome to ItSolutionStuff.com'
        //    // 'date' => date('m/d/Y')
        // ];
          
        // $pdf = PDF::loadView('myPDF', $data);
        $cdata = ChallanModel::leftJoin('customers', 'challan.vendorid', '=', 'customers.id')
        ->leftJoin('challan_items', 'challan.id', '=', 'challan_items.challanid')
        ->leftJoin('subplate', 'challan_items.plateid', '=', 'subplate.id')
        ->select('challan.*', 'customers.customername', 'customers.mobile', 'customers.mobile1','customers.address','subplate.platename','challan_items.plateid','challan_items.particulars','challan_items.qty')
        ->where('status', '1')
        ->where('challan.id', $request->challan)
        ->get();
        foreach ($cdata as $challan) {
            $carbonDate = Carbon::createFromFormat('Y-m-d', $challan->chdate);
            $formattedDate = $carbonDate->format('d/m/Y');
            $formattedDates[] = $formattedDate;
        }
        $pdf = PDF::loadView('challan.printlist',["request"=>$request,'cdata' => $cdata,"formattedDate"=>$formattedDate])->setPaper('a5', 'landscape'); 
        return $pdf->download('document.pdf');
    }
    public function generateIPDFmobile(Request $request)
    {
        // $data = [
        //     'title' => 'Welcome to ItSolutionStuff.com'
        //    // 'date' => date('m/d/Y')
        // ];
          
        // $pdf = PDF::loadView('myPDF', $data);
        $cdata = InwardModel::leftJoin('customers', 'inward.vendorid', '=', 'customers.id')
        ->leftJoin('challan', 'inward.challanid', '=', 'challan.id')
        ->leftJoin('inward_items', 'inward.id', '=', 'inward_items.inchallanid')
        ->leftJoin('subplate', 'inward_items.plateid', '=', 'subplate.id')
        ->select('inward.*', 'challan.challanno','customers.customername', 'customers.mobile', 'customers.mobile1','customers.address','subplate.platename','inward_items.plateid','inward_items.particulars','inward_items.qty','inward_items.inward_qty',ChallanModel::raw("(SELECT c.customername from customers c WHERE inward.vendortid = c.id) as cname"))
        ->where('inward_items.inward_qty','<>','0')
        ->where('inward.status', '1')
        ->where('inward.id', $request->inward)
        ->get();
        foreach ($cdata as $inward) {
            $carbonDate = Carbon::createFromFormat('Y-m-d', $inward->chdate);
            $formattedDate = $carbonDate->format('d/m/Y');
            $formattedDates[] = $formattedDate;
        }
        $pdf = PDF::loadView('inward.printlist',["request"=>$request,'cdata' => $cdata,"formattedDate"=>$formattedDate])->setPaper('a4', 'landscape'); 
        return $pdf->stream('document.pdf');
    }
    public function generateWPDFmobile(Request $request)
    {
        $wdata = WorkModel::leftJoin('customers', 'worklog.customerid', '=', 'customers.id')
        ->leftJoin('users', 'worklog.userid', '=', 'users.id')
        ->leftJoin('subplate', 'worklog.subplateid', '=', 'subplate.subprojectid')
        ->leftJoin('scan', 'worklog.projectid', '=', 'scan.projectid')
        ->select('worklog.*', 'customers.customername AS customername', 'users.name AS username', 'subplate.platename AS platename', 'scan.description AS description', 'scan.worktype AS worktype')
        ->orderBy('rdate', 'DESC')
        ->get();
    
        // Format the rdate field
        foreach ($wdata as $work) {
            $work->formatted_rdate = Carbon::createFromFormat('Y-m-d', $work->rdate)->format('d/m/Y');
        }
        $pdf = PDF::loadView('work.printlist',["request"=>$request,"wdata" => $wdata])->setPaper('a4', 'landscape'); 
        return $pdf->stream('document.pdf');
    }
    public function generatePDF(Request $request)
    {
        // $data = [
        //     'title' => 'Welcome to ItSolutionStuff.com'
        //    // 'date' => date('m/d/Y')
        // ];
          
        // $pdf = PDF::loadView('myPDF', $data);
        // $cdata = ChallanModel::leftJoin('customers', 'challan.vendorid', '=', 'customers.id')
        // // ->leftJoin('customers', 'challan.vendortid', '=', 'customers.id')
        // ->leftJoin('challan_items', 'challan.id', '=', 'challan_items.challanid')
        // ->leftJoin('subplate', 'challan_items.plateid', '=', 'subplate.id')
        // ->select('challan.*', 'customers.customername', 'customers.mobile', 'customers.mobile1','customers.address','subplate.platename','challan_items.plateid','challan_items.cdescription','challan_items.particulars','challan_items.qty', ChallanModel::raw("(SELECT customername from customers LEFT JOIN customers c on challan.vendortid= customers.id) as cname"))
        // ->where('status', '1')
        // ->where('challan.id', $request->challan)
        // ->get();
        $cdata = ChallanModel::leftJoin('customers', 'challan.vendorid', '=', 'customers.id')
        ->leftJoin('challan_items', 'challan.id', '=', 'challan_items.challanid')
        ->leftJoin('subplate', 'challan_items.plateid', '=', 'subplate.id')
        ->select(
            'challan.*',
            'customers.customername',
            'customers.mobile',
            'customers.mobile1',
            'customers.address',
            'subplate.platename',
            'challan_items.plateid',
            'challan_items.project',
            'challan_items.particulars',
            'challan_items.qty',
            ChallanModel::raw("(SELECT c.customername from customers c WHERE challan.vendortid = c.id) as cname")
        )
        ->where('status', '1')
        ->where('challan.id', $request->challan)
        ->get();

        foreach ($cdata as $challan) {
            $carbonDate = Carbon::createFromFormat('Y-m-d', $challan->chdate);
            $formattedDate = $carbonDate->format('d/m/Y');
            $formattedDates[] = $formattedDate;
        }
        $pdf = PDF::loadView('challan.printlist',["request"=>$request,'cdata' => $cdata,"formattedDate"=>$formattedDate])->setPaper('a4', 'landscape'); 

        return $pdf->stream('document.pdf');
    }
    
    public function generateDPDF(Request $request)
    {
        $cdata = DispatchModel::leftJoin('customers', 'dispatch.customerid', '=', 'customers.id')
            ->leftJoin('dispatch_items', 'dispatch.id', '=', 'dispatch_items.dispatchid')
            ->leftJoin('subplate', 'dispatch_items.plateid', '=', 'subplate.id')
            ->leftJoin('customers as transport', 'dispatch.vendortid', '=', 'transport.id')
            ->select(
                'dispatch.*',
                'customers.customername',
                'customers.mobile',
                'customers.mobile1',
                'customers.address',
                'transport.customername as transportername',
                'subplate.platename as original_platename',
                'dispatch_items.plateid',
                'dispatch_items.custom_plate_name',
                'dispatch_items.custom_plate_qty',
                'dispatch_items.project',
                'dispatch_items.particulars',
                'dispatch_items.condition',
                'dispatch_items.work',
                'dispatch_items.qty',
                DispatchModel::raw("(SELECT c.customername from customers c WHERE dispatch.vendortid = c.id) as cname")
            )
            ->where('status', '1')
            ->where('dispatch.id', $request->dispatch)
            ->get();

        // Apply transformation: use custom_plate_name if plateid is null or not numeric
        $transformed = $cdata->map(function ($item) {
            // Replace platename dynamically
            $item->platename = (!is_numeric($item->plateid) || $item->plateid == null)
                ? $item->custom_plate_name
                : $item->original_platename;

            // Replace qty for custom plate
            $item->display_qty = (!is_numeric($item->plateid) || $item->plateid == null)
                ? $item->custom_plate_qty
                : $item->qty;

            return $item;
        });

        // Format chdate once
        $formattedDate = $cdata->first()?->chdate ? Carbon::parse($cdata->first()->chdate)->format('d/m/Y') : '';

        $pdf = PDF::loadView('dispatch.printlist', [
            'request' => $request,
            'cdata' => $transformed,
            'formattedDate' => $formattedDate
        ])->setPaper('a4', 'landscape');

        return $pdf->stream('document.pdf');
    }




    public function generatePDFTOIMAGE(Request $request)
    {
        // $data = [
        //     'title' => 'Welcome to ItSolutionStuff.com'
        //    // 'date' => date('m/d/Y')
        // ];
          
        // $pdf = PDF::loadView('myPDF', $data);
        // $cdata = ChallanModel::leftJoin('customers', 'challan.vendorid', '=', 'customers.id')
        // // ->leftJoin('customers', 'challan.vendortid', '=', 'customers.id')
        // ->leftJoin('challan_items', 'challan.id', '=', 'challan_items.challanid')
        // ->leftJoin('subplate', 'challan_items.plateid', '=', 'subplate.id')
        // ->select('challan.*', 'customers.customername', 'customers.mobile', 'customers.mobile1','customers.address','subplate.platename','challan_items.plateid','challan_items.cdescription','challan_items.particulars','challan_items.qty', ChallanModel::raw("(SELECT customername from customers LEFT JOIN customers c on challan.vendortid= customers.id) as cname"))
        // ->where('status', '1')
        // ->where('challan.id', $request->challan)
        // ->get();
        $cdata = ChallanModel::leftJoin('customers', 'challan.vendorid', '=', 'customers.id')
        ->leftJoin('challan_items', 'challan.id', '=', 'challan_items.challanid')
        ->leftJoin('subplate', 'challan_items.plateid', '=', 'subplate.id')
        ->select(
            'challan.*',
            'customers.customername',
            'customers.mobile',
            'customers.mobile1',
            'customers.address',
            'subplate.platename',
            'challan_items.plateid',
            'challan_items.project',
            'challan_items.particulars',
            'challan_items.qty',
            ChallanModel::raw("(SELECT c.customername from customers c WHERE challan.vendortid = c.id) as cname")
        )
        ->where('status', '1')
        ->where('challan.id', $request->challan)
        ->get();

        foreach ($cdata as $challan) {
            $carbonDate = Carbon::createFromFormat('Y-m-d', $challan->chdate);
            $formattedDate = $carbonDate->format('d/m/Y');
            $formattedDates[] = $formattedDate;
        }
        $pdf = PDF::loadView('challan.printlistimage',["request"=>$request,'cdata' => $cdata,"formattedDate"=>$formattedDate])->setPaper('a4', 'landscape'); 

        return $pdf->stream('document.pdf');
    }
    public function generateIPDF(Request $request)
    {
        // $data = [
        //     'title' => 'Welcome to ItSolutionStuff.com'
        //    // 'date' => date('m/d/Y')
        // ];
          
        // $pdf = PDF::loadView('myPDF', $data);
        $cdata = InwardModel::leftJoin('customers', 'inward.vendorid', '=', 'customers.id')
        ->leftJoin('challan', 'inward.challanid', '=', 'challan.id')
        ->leftJoin('inward_items', 'inward.id', '=', 'inward_items.inchallanid')
        ->leftJoin('subplate', 'inward_items.plateid', '=', 'subplate.id')
        ->select('inward.*', 'challan.challanno','customers.customername', 'customers.mobile', 'customers.mobile1','customers.address','subplate.platename','inward_items.plateid','inward_items.particulars','inward_items.project','inward_items.qty','inward_items.inward_qty',ChallanModel::raw("(SELECT c.customername from customers c WHERE inward.vendortid = c.id) as cname"))
        ->where('inward_items.inward_qty','<>','0')
        ->where('inward.status', '1') 
        ->where('inward.id', $request->inward)
        ->get();
        foreach ($cdata as $inward) {
            $carbonDate = Carbon::createFromFormat('Y-m-d', $inward->chdate);
            $formattedDate = $carbonDate->format('d/m/Y');
            $formattedDates[] = $formattedDate;
        }    
        $pdf = PDF::loadView('inward.printlist',["request"=>$request,'cdata' => $cdata,"formattedDate"=>$formattedDate])->setPaper('a4', 'landscape'); 
        return $pdf->stream('document.pdf');
    }
    public function generatePPDF(Request $request)
    {
        $pdata = PurchaseModel::leftJoin('customers', 'purchase.vname', '=', 'customers.id')
        ->leftJoin('purchase_items', 'purchase.id', '=', 'purchase_items.pid')
        ->leftJoin('subplate', 'purchase_items.plateid', '=', 'subplate.id')
        ->select(
            'purchase.*',
            'customers.customername',
            'customers.mobile',
            'customers.mobile1',
            'customers.address',
            'subplate.platename',
            'subplate.subprojectid',
            'purchase_items.plateid',
            'purchase_items.material',
            'purchase_items.materialtype',
            'purchase_items.qty'
        )
        ->where('status', '1')
        ->where('purchase.id', $request->purchase)
        ->get();

        foreach ($pdata as $purchase) {
            $carbonDate = Carbon::createFromFormat('Y-m-d', $purchase->odate);
            $formattedDate = $carbonDate->format('d/m/Y');
            $formattedDates[] = $formattedDate;
        }
        $pdf = PDF::loadView('purchase.printlist',["request"=>$request,'pdata' => $pdata,"formattedDate"=>$formattedDate])->setPaper('a4', 'landscape'); 

        return $pdf->stream('document.pdf');
    }
}